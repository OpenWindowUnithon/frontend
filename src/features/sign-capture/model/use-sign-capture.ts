import type {
	HandLandmarkerResult,
	NormalizedLandmark,
	PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { Room } from "livekit-client";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { sendChatText } from "@/entities/call";
import type { CaptionType } from "@/entities/caption";
import { drawFullBodySkeleton, useHandLandmarker, usePoseLandmarker } from "@/shared/lib";
import { type ConversationTurn, composeSignSentence } from "../api/sign-api";
import {
	clearReference,
	DEFAULT_DTW_THRESHOLD,
	listReferences,
	matchReference,
	saveReference,
} from "./dtw";
import {
	extractFeatures,
	latestPoseLandmarks,
	RollingWindow,
	splitHandsByHandedness,
} from "./landmarks";
import { CONFIDENCE_THRESHOLD, KSL_WORD_METADATA, predictSign } from "./sign-model";
import type { RecognizedSign } from "./types";

export interface UseSignCaptureReturn {
	videoRef: RefObject<HTMLVideoElement | null>;
	canvasRef: RefObject<HTMLCanvasElement | null>;
	isCameraActive: boolean;
	cameraError: boolean;
	isLoadingModel: boolean;
	isModelReady: boolean;
	showSkeleton: boolean;
	detectedHandsCount: number;
	isArmDetected: boolean;
	isComposing: boolean;
	activeSign: RecognizedSign | null;
	lastConfirmedSign: RecognizedSign | null;
	recentSigns: RecognizedSign[];
	recognizedText: string | null;
	wordBuffer: string[];
	composedSentence: string | null;
	references: Record<string, number>;
	isRecordingWord: boolean;
	recordingSecond: number;
	recordingTotalSeconds: number;
	recordingResult: { ok: boolean; message: string } | null;
	toggleCamera: () => void;
	toggleSkeleton: () => void;
	clearHistory: () => void;
	startRecordingReference: (word: string) => boolean;
	cancelRecordingReference: () => void;
	removeReference: (word: string) => void;
}

const CONSECUTIVE_REQUIRED = 2;
const NO_SIGN_STREAK_TO_RESET = 5;
const UTTERANCE_PAUSE_MS = 3000;
// How many prior turns (both sides combined) to send as context with each compose call.
const MAX_HISTORY_TURNS = 12;
// Custom-word recording: the signer repeats the gesture once per second for this long, and
// the continuous recording is split into one DTW reference sample per second -- this matches
// dtw.ts's MAX_SAMPLES_PER_WORD (10), so a single take fully replaces a word's reference set.
const RECORD_TOTAL_SECONDS = 10;
const RECORD_REPS = RECORD_TOTAL_SECONDS;
// Skip a per-second bucket that's mostly empty (hand out of frame, dropped frames) rather
// than saving a near-empty/garbage reference sample for it.
const MIN_SEGMENT_FRAMES = 5;

function renderLandmarksToCanvas(
	canvas: HTMLCanvasElement | null,
	video: HTMLVideoElement | null,
	hands: NormalizedLandmark[][],
	poseLandmarks: NormalizedLandmark[] | null,
	showSkeleton: boolean,
) {
	if (!canvas || !showSkeleton) return;

	if (video?.videoWidth && video.videoHeight) {
		if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;
		}
	}

	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	drawFullBodySkeleton(ctx, hands, poseLandmarks, canvas.width, canvas.height, {
		isMirrored: true,
		connectorColor: "rgba(59, 130, 246, 0.85)",
		jointColor: "rgba(255, 255, 255, 0.95)",
		fingertipColor: "rgba(239, 68, 68, 0.95)",
		armConnectorColor: "rgba(16, 185, 129, 0.85)",
		armJointColor: "rgba(52, 211, 153, 1)",
		lineWidth: 3,
		nodeRadius: 4,
	});
}

interface PredictionState {
	lastCandidate: string | null;
	candidateStreak: number;
	lastConfirmedCandidate: string | null;
}

// Confirms a candidate once it has held steady for CONSECUTIVE_REQUIRED frames, as long as
// it isn't the same word already confirmed last (which would just be the signer continuing
// to hold the same pose). Gating on "already confirmed *this word*" rather than "already
// confirmed *something* this segment" is what lets consecutive different words (A -> B with
// no no-sign gap in between, since the recognizer doesn't reliably dip to null between two
// signs performed back-to-back) each get confirmed on their own -- previously a single
// shared `insertedForSegment` flag only re-armed after a sustained no-sign streak, so a
// second word right after the first was silently dropped unless the signer paused.
function updateCandidateStreak(
	state: PredictionState,
	candidate: string | null,
): { isConfirmed: boolean } {
	if (candidate === state.lastCandidate) {
		state.candidateStreak += 1;
	} else {
		state.lastCandidate = candidate;
		state.candidateStreak = 1;
	}

	if (candidate === null) {
		if (state.candidateStreak >= NO_SIGN_STREAK_TO_RESET) {
			state.lastConfirmedCandidate = null;
		}
		return { isConfirmed: false };
	}

	if (state.candidateStreak >= CONSECUTIVE_REQUIRED && state.lastConfirmedCandidate !== candidate) {
		state.lastConfirmedCandidate = candidate;
		return { isConfirmed: true };
	}

	return { isConfirmed: false };
}

/**
 * Captures webcam stream and recognizes signs purely from the 30-frame sequence window
 * (LSTM for the trained 11 words, DTW for custom-recorded ones) -- sign language is
 * distinguished by motion over time, not a single frame, so there is deliberately no
 * single-frame/static-pose classifier here (an earlier version had one for zero-latency
 * generic gestures like "thumbs up"/numbers; it was removed because judging any KSL sign
 * from one still frame produced false positives, especially during the pause between
 * words that the utterance-compose debounce relies on).
 * Accumulates confirmed words and converts them to natural sentences via LLM translation.
 */
export function useSignCapture(
	room: Room | null = null,
	captions: CaptionType[] = [],
): UseSignCaptureReturn {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const streamRef = useRef<MediaStream | null>(null);

	// 30-Frame Rolling Window & LSTM State
	const windowRef = useRef(new RollingWindow());
	const latestPoseRef = useRef<PoseLandmarkerResult | null>(null);
	const predictionStateRef = useRef<PredictionState>({
		lastCandidate: null,
		candidateStreak: 0,
		lastConfirmedCandidate: null,
	});
	const predictingRef = useRef(false);

	// Word buffer & Utterance state for LLM translation
	const wordBufferRef = useRef<string[]>([]);
	const utteranceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Conversation history for LLM context: this side's own composed sentences plus the
	// other side's final captions, in chronological order.
	const historyRef = useRef<ConversationTurn[]>([]);
	const processedCaptionIdsRef = useRef<Set<string>>(new Set());

	// Custom-word (DTW) recording: continuously buffers frames for RECORD_TOTAL_SECONDS while
	// recordingWordRef is set, then finishRecordingReference splits them into per-second samples.
	const recordingWordRef = useRef<string | null>(null);
	const recordingFramesRef = useRef<{ t: number; f: number[] }[]>([]);
	const recordingStartRef = useRef(0);
	const recordingTickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const recordingEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const [isCameraActive, setIsCameraActive] = useState(true);
	const [cameraError, setCameraError] = useState(false);
	const [showSkeleton, setShowSkeleton] = useState(true);
	const [detectedHandsCount, setDetectedHandsCount] = useState(0);
	const [isArmDetected, setIsArmDetected] = useState(false);
	const [isComposing, setIsComposing] = useState(false);
	const [activeSign, setActiveSign] = useState<RecognizedSign | null>(null);
	const [lastConfirmedSign, setLastConfirmedSign] = useState<RecognizedSign | null>(null);
	const [recentSigns, setRecentSigns] = useState<RecognizedSign[]>([]);
	const [wordBuffer, setWordBuffer] = useState<string[]>([]);
	const [recognizedText, setRecognizedText] = useState<string | null>(null);
	const [composedSentence, setComposedSentence] = useState<string | null>(null);
	const [references, setReferences] = useState<Record<string, number>>(() => listReferences());
	const [isRecordingWord, setIsRecordingWord] = useState(false);
	const [recordingSecond, setRecordingSecond] = useState(0);
	const [recordingResult, setRecordingResult] = useState<{ ok: boolean; message: string } | null>(
		null,
	);

	// Start webcam stream
	const startCamera = useCallback(async () => {
		try {
			setCameraError(false);
			if (streamRef.current) {
				for (const track of streamRef.current.getTracks()) track.stop();
			}
			const stream = await navigator.mediaDevices.getUserMedia({
				video: {
					width: { ideal: 1280 },
					height: { ideal: 720 },
					facingMode: "user",
				},
				audio: false,
			});
			streamRef.current = stream;
			if (videoRef.current) {
				videoRef.current.srcObject = stream;
				await videoRef.current.play().catch(() => {});
			}
			setIsCameraActive(true);
		} catch (err) {
			console.error("Camera access error:", err);
			setCameraError(true);
			setIsCameraActive(false);
		}
	}, []);

	// Stop webcam stream
	const stopCamera = useCallback(() => {
		if (streamRef.current) {
			for (const track of streamRef.current.getTracks()) track.stop();
			streamRef.current = null;
		}
		if (videoRef.current) videoRef.current.srcObject = null;
		if (canvasRef.current) {
			const ctx = canvasRef.current.getContext("2d");
			ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
		}
		setIsCameraActive(false);
		setDetectedHandsCount(0);
		setIsArmDetected(false);
		setActiveSign(null);
	}, []);

	const toggleCamera = useCallback(() => {
		if (isCameraActive) stopCamera();
		else startCamera();
	}, [isCameraActive, startCamera, stopCamera]);

	const toggleSkeleton = useCallback(() => {
		setShowSkeleton((prev) => {
			if (prev && canvasRef.current) {
				const ctx = canvasRef.current.getContext("2d");
				ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
			}
			return !prev;
		});
	}, []);

	const clearHistory = useCallback(() => {
		setRecentSigns([]);
		wordBufferRef.current = [];
		setWordBuffer([]);
		setRecognizedText(null);
		setComposedSentence(null);
	}, []);

	// Initialize webcam on mount
	useEffect(() => {
		startCamera();
		return () => {
			stopCamera();
			if (utteranceTimerRef.current) clearTimeout(utteranceTimerRef.current);
			if (recordingTickTimerRef.current) clearInterval(recordingTickTimerRef.current);
			if (recordingEndTimerRef.current) clearTimeout(recordingEndTimerRef.current);
		};
	}, [startCamera, stopCamera]);

	// Records each newly-finalized caption (the HEARING side's speech) into the shared
	// history so the next compose call has it as context. Interim captions are skipped —
	// only the final text for a given segment id is recorded, once.
	useEffect(() => {
		for (const caption of captions) {
			if (!caption.final || processedCaptionIdsRef.current.has(caption.id)) continue;
			processedCaptionIdsRef.current.add(caption.id);
			const turn: ConversationTurn = { speaker: "HEARING", text: caption.text };
			historyRef.current = [...historyRef.current, turn].slice(-MAX_HISTORY_TURNS);
		}
	}, [captions]);

	// Debounced LLM translation of word sequence. Fires UTTERANCE_PAUSE_MS after the last
	// confirmed word; clears the buffer immediately so a word signed while this request is
	// in flight starts a fresh utterance instead of being resent with the old one.
	const flushUtterance = useCallback(() => {
		if (utteranceTimerRef.current) clearTimeout(utteranceTimerRef.current);
		utteranceTimerRef.current = setTimeout(() => {
			const words = [...wordBufferRef.current];
			wordBufferRef.current = [];
			setWordBuffer([]);
			if (words.length === 0) return;

			setIsComposing(true);
			// Snapshot history before this turn -- it must not include the sentence this
			// call is about to produce.
			const historyForThisTurn = historyRef.current;
			composeSignSentence(words, historyForThisTurn)
				.then((sentence) => {
					setComposedSentence(sentence);
					const turn: ConversationTurn = { speaker: "DEAF", text: sentence };
					historyRef.current = [...historyRef.current, turn].slice(-MAX_HISTORY_TURNS);
					if (room) {
						sendChatText(room, sentence);
					}
				})
				.catch(() => {
					const fallback = words.join(" ");
					setComposedSentence(fallback);
					const turn: ConversationTurn = { speaker: "DEAF", text: fallback };
					historyRef.current = [...historyRef.current, turn].slice(-MAX_HISTORY_TURNS);
					if (room) {
						sendChatText(room, fallback);
					}
				})
				.finally(() => {
					setIsComposing(false);
				});
		}, UTTERANCE_PAUSE_MS);
	}, [room]);

	const commitConfirmedSign = useCallback(
		(sign: RecognizedSign) => {
			setLastConfirmedSign(sign);
			setRecentSigns((prev) => [sign, ...prev.slice(0, 9)]);

			// Append word to sentence buffer (avoid consecutive duplicate words in buffer)
			const lastWord = wordBufferRef.current[wordBufferRef.current.length - 1];
			if (lastWord !== sign.label) {
				wordBufferRef.current = [...wordBufferRef.current, sign.label];
				setWordBuffer([...wordBufferRef.current]);
				setRecognizedText(wordBufferRef.current.join(" "));
				flushUtterance();
			}
		},
		[flushUtterance],
	);

	// Pose Landmarker hook for upper body / arm tracking
	usePoseLandmarker(videoRef, isCameraActive, (result: PoseLandmarkerResult) => {
		latestPoseRef.current = result;
		const pose = latestPoseLandmarks(result);
		setIsArmDetected(Boolean(pose && pose.length >= 17));
	});

	const handleKslPrediction = useCallback(
		(candidate: string | null, confidence: number) => {
			const meta = candidate ? KSL_WORD_METADATA[candidate] : undefined;
			const icon = meta?.icon ?? "🤟";
			const desc = meta?.description ?? `KSL 수어: ${candidate}`;

			const { isConfirmed } = updateCandidateStreak(predictionStateRef.current, candidate);

			if (candidate) {
				setActiveSign({
					id: `ksl_${candidate}`,
					label: candidate,
					description: desc,
					icon,
					confidence,
					category: "action",
					timestamp: Date.now(),
				});
			} else if (predictionStateRef.current.candidateStreak >= NO_SIGN_STREAK_TO_RESET) {
				// Only clear once the "no sign" streak is sustained, not on every single null
				// tick -- otherwise the live indicator flickers off during brief detection
				// gaps mid-gesture. This mirrors the same threshold updateCandidateStreak uses
				// to reset the segment, so "recognition ended" and "indicator cleared" agree.
				setActiveSign(null);
			}

			if (candidate && isConfirmed) {
				const kslSign: RecognizedSign = {
					id: `ksl_${candidate}_${Date.now()}`,
					label: candidate,
					description: desc,
					icon,
					confidence,
					category: "action",
					timestamp: Date.now(),
				};
				commitConfirmedSign(kslSign);
			}
		},
		[commitConfirmedSign],
	);

	// Main frame processing callback: sequence-only recognition (LSTM + DTW), no
	// single-frame static gesture path.
	const handleLandmarkerResult = useCallback(
		(handResult: HandLandmarkerResult) => {
			const hands = handResult.landmarks ?? [];
			setDetectedHandsCount(hands.length);

			const poseLandmarks = latestPoseLandmarks(latestPoseRef.current);
			renderLandmarksToCanvas(
				canvasRef.current,
				videoRef.current,
				hands,
				poseLandmarks,
				showSkeleton,
			);

			const { leftHandLandmarks, rightHandLandmarks } = splitHandsByHandedness(handResult);
			const features = extractFeatures({ poseLandmarks, leftHandLandmarks, rightHandLandmarks });
			windowRef.current.push(features);
			if (recordingWordRef.current) {
				recordingFramesRef.current.push({
					t: performance.now() - recordingStartRef.current,
					f: features,
				});
			}

			// While a custom-word take is recording, skip live recognition entirely -- the
			// signer is deliberately repeating one gesture on a beat for registration, not
			// signing normally, so running the recognizer here would only risk polluting the
			// word buffer/LLM compose flow with junk from the practice reps.
			if (recordingWordRef.current) return;

			const frames = windowRef.current.toArray();
			if (!frames || predictingRef.current) return;

			predictingRef.current = true;
			predictSign(frames)
				.then(({ label, confidence }) => {
					const lstmCandidate = label && confidence >= CONFIDENCE_THRESHOLD ? label : null;
					const dtwMatch = matchReference(frames);
					const finalCandidate = lstmCandidate ?? dtwMatch?.word ?? null;
					// DTW has no natural 0-1 confidence -- derive one from how close the match
					// distance is to the threshold, so a borderline match doesn't look as
					// trustworthy in the UI as a near-exact one.
					const dtwConfidence = dtwMatch
						? Math.max(0, 1 - dtwMatch.distance / DEFAULT_DTW_THRESHOLD)
						: 0;
					const finalConfidence = lstmCandidate ? confidence : dtwConfidence;

					if (finalCandidate) {
						handleKslPrediction(finalCandidate, finalConfidence);
					}
				})
				.catch((err) => {
					console.error("Sign prediction error:", err);
				})
				.finally(() => {
					predictingRef.current = false;
				});
		},
		[showSkeleton, handleKslPrediction],
	);

	const { isLoading: isLoadingModel, isReady: isModelReady } = useHandLandmarker(
		videoRef,
		isCameraActive,
		handleLandmarkerResult,
	);

	// Splits the just-recorded continuous take into one reference sample per second (bucketed
	// by elapsed time, not frame count, so it's robust to frame-rate jitter) and replaces the
	// word's entire reference set with them -- a full 10s take is meant to supersede whatever
	// was recorded before, not accumulate alongside it.
	const finishRecordingReference = useCallback(() => {
		if (recordingTickTimerRef.current) clearInterval(recordingTickTimerRef.current);
		if (recordingEndTimerRef.current) clearTimeout(recordingEndTimerRef.current);
		recordingTickTimerRef.current = null;
		recordingEndTimerRef.current = null;

		const word = recordingWordRef.current;
		const frames = recordingFramesRef.current;
		recordingWordRef.current = null;
		recordingFramesRef.current = [];
		setIsRecordingWord(false);
		setRecordingSecond(0);
		if (!word) return;

		const buckets: number[][][] = Array.from({ length: RECORD_REPS }, () => []);
		for (const { t, f } of frames) {
			const idx = Math.min(RECORD_REPS - 1, Math.floor(t / 1000));
			buckets[idx]?.push(f);
		}

		clearReference(word);
		let saved = 0;
		for (const bucket of buckets) {
			if (bucket.length < MIN_SEGMENT_FRAMES) continue;
			saveReference(word, bucket);
			saved += 1;
		}
		setReferences(listReferences());
		setRecordingResult(
			saved > 0
				? { ok: true, message: `'${word}' 동작 샘플 ${saved}개를 저장했습니다.` }
				: {
						ok: false,
						message: "동작이 감지되지 않았습니다. 손이 잘 보이는 곳에서 다시 시도해주세요.",
					},
		);
	}, []);

	const startRecordingReference = useCallback(
		(word: string): boolean => {
			const trimmed = word.trim();
			if (!trimmed || recordingWordRef.current) return false;

			recordingWordRef.current = trimmed;
			recordingFramesRef.current = [];
			recordingStartRef.current = performance.now();
			setRecordingResult(null);
			setRecordingSecond(1);
			setIsRecordingWord(true);

			recordingTickTimerRef.current = setInterval(() => {
				const elapsedMs = performance.now() - recordingStartRef.current;
				setRecordingSecond(Math.min(RECORD_TOTAL_SECONDS, Math.floor(elapsedMs / 1000) + 1));
			}, 1000);
			recordingEndTimerRef.current = setTimeout(
				finishRecordingReference,
				RECORD_TOTAL_SECONDS * 1000,
			);

			return true;
		},
		[finishRecordingReference],
	);

	const cancelRecordingReference = useCallback(() => {
		if (!recordingWordRef.current) return;
		if (recordingTickTimerRef.current) clearInterval(recordingTickTimerRef.current);
		if (recordingEndTimerRef.current) clearTimeout(recordingEndTimerRef.current);
		recordingTickTimerRef.current = null;
		recordingEndTimerRef.current = null;
		recordingWordRef.current = null;
		recordingFramesRef.current = [];
		setIsRecordingWord(false);
		setRecordingSecond(0);
		setRecordingResult(null);
	}, []);

	const removeReference = useCallback((word: string) => {
		clearReference(word);
		setReferences(listReferences());
	}, []);

	return {
		videoRef,
		canvasRef,
		isCameraActive,
		cameraError,
		isLoadingModel,
		isModelReady,
		showSkeleton,
		detectedHandsCount,
		isArmDetected,
		isComposing,
		activeSign,
		lastConfirmedSign,
		recentSigns,
		wordBuffer,
		recognizedText,
		composedSentence,
		references,
		isRecordingWord,
		recordingSecond,
		recordingTotalSeconds: RECORD_TOTAL_SECONDS,
		recordingResult,
		toggleCamera,
		toggleSkeleton,
		clearHistory,
		startRecordingReference,
		cancelRecordingReference,
		removeReference,
	};
}
