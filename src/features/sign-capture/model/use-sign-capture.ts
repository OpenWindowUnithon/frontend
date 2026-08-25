import type {
	HandLandmarkerResult,
	NormalizedLandmark,
	PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { Room } from "livekit-client";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { sendChatText } from "@/entities/call";
import { drawFullBodySkeleton, useHandLandmarker, usePoseLandmarker } from "@/shared/lib";
import { composeSignSentence } from "../api/sign-api";
import { clearReference, listReferences, matchReference, saveReference } from "./dtw";
import {
	extractFeatures,
	latestPoseLandmarks,
	RollingWindow,
	splitHandsByHandedness,
} from "./landmarks";
import { CONFIDENCE_THRESHOLD, KSL_WORD_METADATA, predictSign } from "./sign-model";
import type { RecognizedSign } from "./sign-recognizer";

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
	toggleCamera: () => void;
	toggleSkeleton: () => void;
	clearHistory: () => void;
	recordReference: (word: string) => boolean;
	removeReference: (word: string) => void;
}

const CONSECUTIVE_REQUIRED = 3;
const NO_SIGN_STREAK_TO_RESET = 6;
const UTTERANCE_PAUSE_MS = 1400;

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
	insertedForSegment: boolean;
}

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

	if (candidate === null && state.candidateStreak >= NO_SIGN_STREAK_TO_RESET) {
		state.insertedForSegment = false;
	}

	if (candidate && state.candidateStreak >= CONSECUTIVE_REQUIRED && !state.insertedForSegment) {
		state.insertedForSegment = true;
		return { isConfirmed: true };
	}

	return { isConfirmed: false };
}

/**
 * Captures local webcam stream, runs MediaPipe Hand & Pose landmarker,
 * accumulates 30-frame sequence windows into the LSTM neural classifier & DTW matching,
 * segments word glosses by pause/consecutive hold, and passes the gloss sequence
 * to the backend LLM for natural conversational Korean sentence translation.
 */
export function useSignCapture(room: Room | null = null): UseSignCaptureReturn {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const streamRef = useRef<MediaStream | null>(null);

	// 30-Frame Rolling Window & LSTM State
	const windowRef = useRef(new RollingWindow());
	const latestPoseRef = useRef<PoseLandmarkerResult | null>(null);
	const predictionStateRef = useRef<PredictionState>({
		lastCandidate: null,
		candidateStreak: 0,
		insertedForSegment: false,
	});
	const predictingRef = useRef(false);

	// Word buffer & Utterance state for LLM translation
	const wordBufferRef = useRef<string[]>([]);
	const utteranceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
		};
	}, [startCamera, stopCamera]);

	// Debounced LLM translation of word sequence
	const flushUtterance = useCallback(() => {
		if (utteranceTimerRef.current) clearTimeout(utteranceTimerRef.current);
		utteranceTimerRef.current = setTimeout(() => {
			const words = [...wordBufferRef.current];
			if (words.length === 0) return;

			setIsComposing(true);
			composeSignSentence(words)
				.then((sentence) => {
					setComposedSentence(sentence);
					if (room) {
						sendChatText(room, sentence);
					}
				})
				.catch(() => {
					const fallback = words.join(" ");
					setComposedSentence(fallback);
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

			// Append word to sentence buffer
			wordBufferRef.current = [...wordBufferRef.current, sign.label];
			setWordBuffer([...wordBufferRef.current]);
			setRecognizedText(wordBufferRef.current.join(" "));

			// Trigger debounced LLM sentence composition
			flushUtterance();
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
			} else {
				setActiveSign(null);
			}

			const { isConfirmed } = updateCandidateStreak(predictionStateRef.current, candidate);
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

	// Main Frame processing callback: 30-frame sequence evaluation
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

			// Extract 150-dimensional pose & dual-hand feature vector
			const { leftHandLandmarks, rightHandLandmarks } = splitHandsByHandedness(handResult);
			windowRef.current.push(
				extractFeatures({ poseLandmarks, leftHandLandmarks, rightHandLandmarks }),
			);

			const frames = windowRef.current.toArray();
			if (!frames || predictingRef.current) return;

			predictingRef.current = true;
			predictSign(frames)
				.then(({ label, confidence }) => {
					const lstmCandidate = label && confidence >= CONFIDENCE_THRESHOLD ? label : null;
					const dtwMatch = matchReference(frames);
					const finalCandidate = lstmCandidate ?? dtwMatch?.word ?? null;
					const finalConfidence = lstmCandidate ? confidence : dtwMatch ? 0.9 : 0;

					handleKslPrediction(finalCandidate, finalConfidence);
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

	const recordReference = useCallback((word: string): boolean => {
		const frames = windowRef.current.toArray();
		if (!frames || !word.trim()) return false;
		saveReference(word.trim(), frames);
		setReferences(listReferences());
		return true;
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
		toggleCamera,
		toggleSkeleton,
		clearHistory,
		recordReference,
		removeReference,
	};
}
