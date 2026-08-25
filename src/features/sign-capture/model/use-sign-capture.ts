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
	closestReference,
	DEFAULT_DTW_THRESHOLD,
	deleteReference,
	listReferences,
	loadReferencesFromServer,
	replaceReferenceSamples,
} from "./dtw";
import {
	extractFeatures,
	latestPoseLandmarks,
	RollingWindow,
	splitHandsByHandedness,
} from "./landmarks";
import type { RecognizedSign } from "./types";
import { KSL_WORD_METADATA } from "./word-metadata";

/** Live DTW readout for the recognition-clarity debug strip -- not used for logic. */
export interface RecognitionDebug {
	dtwWord: string | null;
	dtwDistance: number | null;
}

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
	composedSentences: string[];
	references: Record<string, number>;
	recognitionDebug: RecognitionDebug | null;
	handsGoneSince: number | null;
	isRecordingWord: boolean;
	isSavingReference: boolean;
	recordingSecond: number;
	recordingTotalSeconds: number;
	recordingTotalReps: number;
	recordingRepIntervalSeconds: number;
	recordingResult: { ok: boolean; message: string } | null;
	toggleCamera: () => void;
	toggleSkeleton: () => void;
	clearHistory: () => void;
	startRecordingReference: (word: string) => boolean;
	finishRecordingNow: () => void;
	cancelRecordingReference: () => void;
	removeReference: (word: string) => void;
}

// The DTW candidate is recomputed every processed frame (~30/s), and during the transition
// between two signs (motion blur, hand briefly leaving the ideal pose) the momentarily
// closest reference can flicker to an unrelated word for a frame or two. Requiring the same
// candidate to win a few frames in a row filters that transitional noise out before it's
// treated as a real confirmation, without adding perceptible lag once a sign is actually
// being held. See updateCandidateStreak.
const REQUIRED_STREAK = 5;
// How many consecutive no-hands frames before the "already confirmed" guard clears, letting
// the same word be confirmed again on a later, separate signing of it. Needs to be longer
// than a typical brief tracking dropout mid-gesture (fast motion, hand grazing frame edge),
// or the same word gets re-confirmed moments after it was already added to the buffer.
const NO_SIGN_STREAK_TO_RESET = 10;
// If both hands haven't been detected for this long, treat it as the end of the signer's
// turn and send whatever's been confirmed so far off for translation. Replaces a
// pause-since-last-confirmed-word debounce, which didn't distinguish "hands down, done
// signing" from "hands still up, just pausing mid-sentence." The repeated-sentence bug this
// was once bumped up to work around (575e847..7ed7a64) was actually caused by unconditional
// DTW confirmation and stale recognition state surviving a flush, not by this being too
// short -- both are fixed now (see resolvePrediction's threshold gate and sendUtteranceNow's
// reset), so this stays short for a responsive turn-taking feel.
export const HANDS_GONE_FLUSH_MS = 1500;
// How many prior turns (both sides combined) to send as context with each compose call.
const MAX_HISTORY_TURNS = 12;
// How many past translated sentences to keep around for display -- translation keeps
// running for every utterance, not just the first, so this is a rolling log, not a cap on
// how many times compose can fire.
const MAX_DISPLAYED_SENTENCES = 20;
// Custom-word recording: the signer repeats the gesture once per REP_INTERVAL_SECONDS, and
// the continuous recording is split into one DTW reference sample per rep -- RECORD_REPS
// matches dtw.ts's MAX_SAMPLES_PER_WORD (10), so a single take fully replaces a word's
// reference set. REP_INTERVAL_SECONDS is deliberately close to how long the live recognition
// window (WINDOW_FRAMES=30 processed frames, landmarks.ts) actually spans in wall-clock time
// -- on a typical device running the hand+pose landmarkers per frame, that's on the order of
// 1-2s, not a flat 1s. Pacing reps faster than that risks each recorded sample capturing only
// part of the gesture, which DTW's time-warping can't fix (warping absorbs speed differences,
// not missing motion).
const RECORD_REPS = 10;
const REP_INTERVAL_SECONDS = 2;
const RECORD_TOTAL_SECONDS = RECORD_REPS * REP_INTERVAL_SECONDS;
// Skip a per-rep bucket that's mostly empty (hand out of frame, dropped frames) rather than
// saving a near-empty/garbage reference sample for it.
const MIN_SEGMENT_FRAMES = 5;

interface ResolvedPrediction {
	// Threshold-gated -- null unless the closest reference actually clears DEFAULT_DTW_THRESHOLD.
	// This is the only value handleKslPrediction/updateCandidateStreak ever sees, so an idle
	// hand (in frame but not forming any registered sign) can't get matched to "whichever word
	// happens to be least-far-away" and confirmed anyway.
	candidate: string | null;
	confidence: number;
	// Whichever reference is nearest, regardless of threshold -- purely for the always-on
	// "인식 중" live card (buildActiveSignFromClosest), so the signer can see "this is what
	// it's closest to" even when it's not close enough to confirm.
	closestWord: string | null;
	closestSimilarity: number;
	debug: RecognitionDebug;
}

// Finds the closest DTW reference match for the current window. Recognition is DTW-only: a
// pretrained LSTM classifier for a fixed 11-word vocabulary used to run alongside this and be
// checked first, but it always emitted *some* confident top-1 guess (softmax over 12 classes,
// including "no action") for arbitrary hand motion, and since it was checked first it
// permanently shadowed DTW candidates -- a registered custom word could match its reference
// perfectly and still never be the one shown. Dropping it means every word, including a
// starter vocabulary, now has to actually be recorded by the signer, but recognition behavior
// becomes fully predictable: whatever you record is what gets recognized. Packages a debug
// snapshot alongside the result -- pulled out of handleLandmarkerResult to keep that
// callback's cognitive complexity down.
//
// Confirmation is threshold-gated: a resting hand, a transition between two signs, or just
// raising your hand back into frame will always be *closest* to some registered word (DTW
// always returns a nearest neighbor), but that doesn't mean it resembles it -- without a
// distance cutoff, any hand presence gets matched to and confirms *something* almost
// immediately (see REQUIRED_STREAK). DEFAULT_DTW_THRESHOLD gates `candidate`; the live card
// still shows the closest match unconditionally via `closestWord` so the signer gets feedback
// even on a near-miss.
function resolvePrediction(frames: number[][]): ResolvedPrediction {
	const dtwBest = closestReference(frames);
	const closestSimilarity = dtwBest ? Math.max(0, 1 - dtwBest.distance / DEFAULT_DTW_THRESHOLD) : 0;
	const dtwMatch = dtwBest && dtwBest.distance <= DEFAULT_DTW_THRESHOLD ? dtwBest : null;

	return {
		candidate: dtwMatch?.word ?? null,
		confidence: dtwMatch ? closestSimilarity : 0,
		closestWord: dtwBest?.word ?? null,
		closestSimilarity,
		debug: {
			dtwWord: dtwBest?.word ?? null,
			dtwDistance: dtwBest?.distance ?? null,
		},
	};
}

// Builds the live "인식 중" card from the closest DTW match, or null if there's no reference
// to compare against at all (no custom words registered yet).
function buildActiveSignFromClosest(
	word: string | null,
	similarity: number,
): RecognizedSign | null {
	if (!word) return null;
	const meta = KSL_WORD_METADATA[word];
	return {
		id: `dtw_${word}`,
		label: word,
		description: meta?.description ?? `등록한 수어: ${word}`,
		icon: meta?.icon ?? "🤟",
		confidence: similarity,
		category: "action",
		timestamp: Date.now(),
	};
}

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

// Confirms a candidate once it has held steady for REQUIRED_STREAK frames, as long as it
// isn't the same word already confirmed last (which would just be the signer continuing to
// hold the same pose). Gating on "already confirmed *this word*" rather than "already
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

	if (state.candidateStreak >= REQUIRED_STREAK && state.lastConfirmedCandidate !== candidate) {
		state.lastConfirmedCandidate = candidate;
		return { isConfirmed: true };
	}

	return { isConfirmed: false };
}

/**
 * Captures webcam stream and recognizes signs purely from the 30-frame sequence window via
 * DTW matching against signer-recorded reference samples (see dtw.ts) -- sign language is
 * distinguished by motion over time, not a single frame, so there is deliberately no
 * single-frame/static-pose classifier here (an earlier version had one for zero-latency
 * generic gestures like "thumbs up"/numbers; it was removed because judging any KSL sign
 * from one still frame produced false positives, especially during the pause between
 * words that the utterance-compose debounce relies on). There is also no pretrained
 * classifier for a fixed vocabulary -- every recognized word has to be recorded by the
 * signer first, which trades zero-setup recognition for fully predictable behavior (see
 * resolvePrediction's docstring for why the earlier hybrid LSTM+DTW setup was dropped).
 * Accumulates confirmed words and converts them to natural sentences via LLM translation.
 */
export function useSignCapture(
	room: Room | null = null,
	captions: CaptionType[] = [],
	onSentence?: (text: string) => void,
): UseSignCaptureReturn {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const streamRef = useRef<MediaStream | null>(null);

	// 30-Frame Rolling Window & DTW Recognition State
	const windowRef = useRef(new RollingWindow());
	const latestPoseRef = useRef<PoseLandmarkerResult | null>(null);
	const predictionStateRef = useRef<PredictionState>({
		lastCandidate: null,
		candidateStreak: 0,
		lastConfirmedCandidate: null,
	});

	// Word buffer for LLM translation
	const wordBufferRef = useRef<string[]>([]);

	// Utterance-end detection: both hands absent for HANDS_GONE_FLUSH_MS triggers a send.
	// handsGoneAtRef is the timestamp hands were last seen missing (null while visible);
	// flushedForGapRef prevents re-sending repeatedly for the same absence.
	const handsGoneAtRef = useRef<number | null>(null);
	const flushedForGapRef = useRef(false);

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
	const [composedSentences, setComposedSentences] = useState<string[]>([]);
	const [references, setReferences] = useState<Record<string, number>>(() => listReferences());
	const [recognitionDebug, setRecognitionDebug] = useState<RecognitionDebug | null>(null);
	const [handsGoneSince, setHandsGoneSince] = useState<number | null>(null);
	const [isRecordingWord, setIsRecordingWord] = useState(false);
	const [isSavingReference, setIsSavingReference] = useState(false);
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
		setRecognitionDebug(null);
		handsGoneAtRef.current = null;
		flushedForGapRef.current = false;
		setHandsGoneSince(null);
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
		setComposedSentences([]);
	}, []);

	// Initialize webcam on mount
	useEffect(() => {
		startCamera();
		return () => {
			stopCamera();
			if (recordingTickTimerRef.current) clearInterval(recordingTickTimerRef.current);
			if (recordingEndTimerRef.current) clearTimeout(recordingEndTimerRef.current);
		};
	}, [startCamera, stopCamera]);

	// Load the global reference store once on mount -- recognition itself reads the
	// in-memory cache dtw.ts keeps (synchronous, per video frame), so this is a one-time
	// sync point, not something re-fetched per frame.
	useEffect(() => {
		let cancelled = false;
		loadReferencesFromServer()
			.then((counts) => {
				if (!cancelled) setReferences(counts);
			})
			.catch((err) => {
				console.error("Failed to load sign word references:", err);
			});
		return () => {
			cancelled = true;
		};
	}, []);

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

	// Sends whatever's in the word buffer off for LLM translation right now -- triggered when
	// both hands have been gone for HANDS_GONE_FLUSH_MS (see handleLandmarkerResult), not on a
	// timer per word. Clears the buffer immediately so a word signed while this request is in
	// flight starts a fresh utterance instead of being resent with the old one.
	//
	// Also resets every piece of per-utterance recognition state -- the rolling frame window,
	// the confirmation streak/lock, the live sign, and the recognized-text readout -- so the
	// next utterance starts from a clean slate. Without this, raising hands back up to start a
	// new sentence could immediately re-confirm whatever was last recognized (stale frames
	// still in the window, or the confirmation lock already cleared from the hands-gone gap),
	// silently duplicating the just-sent sentence.
	const sendUtteranceNow = useCallback(() => {
		windowRef.current.clear();
		predictionStateRef.current = {
			lastCandidate: null,
			candidateStreak: 0,
			lastConfirmedCandidate: null,
		};
		setActiveSign(null);
		setRecognitionDebug(null);
		setRecognizedText(null);

		const words = [...wordBufferRef.current];
		wordBufferRef.current = [];
		setWordBuffer([]);
		if (words.length === 0) return;

		setIsComposing(true);
		// Snapshot history before this turn -- it must not include the sentence this call is
		// about to produce.
		const historyForThisTurn = historyRef.current;
		composeSignSentence(words, historyForThisTurn)
			.then((sentence) => {
				setComposedSentences((prev) => [...prev, sentence].slice(-MAX_DISPLAYED_SENTENCES));
				const turn: ConversationTurn = { speaker: "DEAF", text: sentence };
				historyRef.current = [...historyRef.current, turn].slice(-MAX_HISTORY_TURNS);
				if (room) {
					sendChatText(room, sentence);
				}
				onSentence?.(sentence);
			})
			.catch((error) => {
				// Falling back to the raw joined words is intentional (never drop the signer's
				// message), but doing it silently makes a failed compose call indistinguishable
				// from the LLM genuinely returning the words unchanged -- log it so a network/API
				// failure is diagnosable instead of just looking like "GPT isn't running".
				console.error("[sign-capture] compose failed, sending raw words instead:", error);
				const fallback = words.join(" ");
				setComposedSentences((prev) => [...prev, fallback].slice(-MAX_DISPLAYED_SENTENCES));
				const turn: ConversationTurn = { speaker: "DEAF", text: fallback };
				historyRef.current = [...historyRef.current, turn].slice(-MAX_HISTORY_TURNS);
				if (room) {
					sendChatText(room, fallback);
				}
				onSentence?.(fallback);
			})
			.finally(() => {
				setIsComposing(false);
			});
	}, [room, onSentence]);

	const commitConfirmedSign = useCallback((sign: RecognizedSign) => {
		setLastConfirmedSign(sign);
		setRecentSigns((prev) => [sign, ...prev.slice(0, 9)]);

		// Append word to sentence buffer (avoid consecutive duplicate words in buffer). The
		// buffer is sent off for translation when both hands go missing for
		// HANDS_GONE_FLUSH_MS (handleLandmarkerResult), not from here.
		const lastWord = wordBufferRef.current[wordBufferRef.current.length - 1];
		if (lastWord !== sign.label) {
			wordBufferRef.current = [...wordBufferRef.current, sign.label];
			setWordBuffer([...wordBufferRef.current]);
			setRecognizedText(wordBufferRef.current.join(" "));
		}
	}, []);

	// Pose Landmarker hook for upper body / arm tracking
	usePoseLandmarker(videoRef, isCameraActive, (result: PoseLandmarkerResult) => {
		latestPoseRef.current = result;
		const pose = latestPoseLandmarks(result);
		setIsArmDetected(Boolean(pose && pose.length >= 17));
	});

	// Confirms a candidate into the word buffer once it holds steady for REQUIRED_STREAK
	// frames. Doesn't touch activeSign -- that's driven directly by the closest DTW match
	// (see handleLandmarkerResult), independent of whether it clears the confirmation
	// threshold.
	const handleKslPrediction = useCallback(
		(candidate: string | null, confidence: number) => {
			const { isConfirmed } = updateCandidateStreak(predictionStateRef.current, candidate);
			if (candidate && isConfirmed) {
				const meta = KSL_WORD_METADATA[candidate];
				const kslSign: RecognizedSign = {
					id: `ksl_${candidate}_${Date.now()}`,
					label: candidate,
					description: meta?.description ?? `등록한 수어: ${candidate}`,
					icon: meta?.icon ?? "🤟",
					confidence,
					category: "action",
					timestamp: Date.now(),
				};
				commitConfirmedSign(kslSign);
			}
		},
		[commitConfirmedSign],
	);

	// Utterance-end detection: both hands gone for HANDS_GONE_FLUSH_MS sends whatever has been
	// confirmed so far, instead of waiting on a per-word pause timer. Pulled out of
	// handleLandmarkerResult to keep that callback's cognitive complexity down.
	const updateHandsGoneTracking = useCallback(
		(handsLength: number) => {
			if (handsLength > 0) {
				if (handsGoneAtRef.current !== null) {
					handsGoneAtRef.current = null;
					flushedForGapRef.current = false;
					setHandsGoneSince(null);
				}
				return;
			}

			if (handsGoneAtRef.current === null) {
				handsGoneAtRef.current = performance.now();
				setHandsGoneSince(handsGoneAtRef.current);
			} else if (
				!flushedForGapRef.current &&
				performance.now() - handsGoneAtRef.current >= HANDS_GONE_FLUSH_MS
			) {
				flushedForGapRef.current = true;
				sendUtteranceNow();
			}
		},
		[sendUtteranceNow],
	);

	// Main frame processing callback: sequence-only DTW recognition, no single-frame
	// static gesture path.
	const handleLandmarkerResult = useCallback(
		(handResult: HandLandmarkerResult) => {
			const hands = handResult.landmarks ?? [];
			setDetectedHandsCount(hands.length);
			updateHandsGoneTracking(hands.length);

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

			// No hands in frame means no gesture is happening -- skip DTW lookup entirely
			// rather than matching a zero-filled hand vector against whatever's registered
			// (which, since confirmation is unconditional, would otherwise keep confirming
			// some "closest" word even with nobody signing).
			if (hands.length === 0) {
				setActiveSign(null);
				handleKslPrediction(null, 0);
				return;
			}

			const frames = windowRef.current.toArray();
			if (!frames) return;

			const { candidate, confidence, closestWord, closestSimilarity, debug } =
				resolvePrediction(frames);
			setRecognitionDebug(debug);
			// Always show the closest match as a live card, however low the similarity -- lets
			// the signer see "this is what it thinks you're doing," even when it isn't close
			// enough to actually confirm (see resolvePrediction -- `candidate` is threshold-gated,
			// `closestWord` isn't).
			setActiveSign(buildActiveSignFromClosest(closestWord, closestSimilarity));

			handleKslPrediction(candidate, confidence);
		},
		[showSkeleton, handleKslPrediction, updateHandsGoneTracking],
	);

	const { isLoading: isLoadingModel, isReady: isModelReady } = useHandLandmarker(
		videoRef,
		isCameraActive,
		handleLandmarkerResult,
	);

	// Splits the just-recorded continuous take into one reference sample per rep (bucketed by
	// elapsed time, not frame count, so it's robust to frame-rate jitter) and replaces the
	// word's entire reference set with them -- a take is meant to supersede whatever was
	// recorded before, not accumulate alongside it. Also callable early (finishRecordingNow)
	// so the signer isn't locked into waiting the full RECORD_TOTAL_SECONDS if they've already
	// done enough reps -- whatever reps completed so far still get saved, unlike
	// cancelRecordingReference which discards everything.
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
			const idx = Math.min(RECORD_REPS - 1, Math.floor(t / (REP_INTERVAL_SECONDS * 1000)));
			buckets[idx]?.push(f);
		}
		const validSamples = buckets.filter((bucket) => bucket.length >= MIN_SEGMENT_FRAMES);

		if (validSamples.length === 0) {
			setRecordingResult({
				ok: false,
				message: "동작이 감지되지 않았습니다. 손이 잘 보이는 곳에서 다시 시도해주세요.",
			});
			return;
		}

		setIsSavingReference(true);
		replaceReferenceSamples(word, validSamples)
			.then(() => {
				setReferences(listReferences());
				setRecordingResult({
					ok: true,
					message: `'${word}' 동작 샘플 ${validSamples.length}개를 저장했습니다.`,
				});
			})
			.catch((err) => {
				console.error("Failed to save sign word reference:", err);
				setRecordingResult({
					ok: false,
					message: "저장에 실패했습니다. 네트워크 연결을 확인하고 다시 시도해주세요.",
				});
			})
			.finally(() => {
				setIsSavingReference(false);
			});
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
			setRecognitionDebug(null);

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
		deleteReference(word)
			.then(() => setReferences(listReferences()))
			.catch((err) => {
				console.error("Failed to delete sign word reference:", err);
			});
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
		composedSentences,
		references,
		recognitionDebug,
		handsGoneSince,
		isRecordingWord,
		isSavingReference,
		recordingSecond,
		recordingTotalSeconds: RECORD_TOTAL_SECONDS,
		recordingTotalReps: RECORD_REPS,
		recordingRepIntervalSeconds: REP_INTERVAL_SECONDS,
		recordingResult,
		toggleCamera,
		toggleSkeleton,
		clearHistory,
		startRecordingReference,
		finishRecordingNow: finishRecordingReference,
		cancelRecordingReference,
		removeReference,
	};
}
