import type {
	HandLandmarkerResult,
	NormalizedLandmark,
	PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { Room } from "livekit-client";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { sendChatText } from "@/entities/call";
import { drawHandLandmarks, useHandLandmarker, usePoseLandmarker } from "@/shared/lib";
import {
	extractFeatures,
	latestPoseLandmarks,
	RollingWindow,
	splitHandsByHandedness,
} from "./landmarks";
import { CONFIDENCE_THRESHOLD, predictSign } from "./sign-model";
import { type RecognizedSign, recognizeSignGesture, SignStabilityFilter } from "./sign-recognizer";

export interface UseSignCaptureReturn {
	videoRef: RefObject<HTMLVideoElement | null>;
	canvasRef: RefObject<HTMLCanvasElement | null>;
	isCameraActive: boolean;
	cameraError: boolean;
	isLoadingModel: boolean;
	isModelReady: boolean;
	showSkeleton: boolean;
	detectedHandsCount: number;
	activeSign: RecognizedSign | null;
	lastConfirmedSign: RecognizedSign | null;
	recentSigns: RecognizedSign[];
	recognizedText: string | null;
	toggleCamera: () => void;
	toggleSkeleton: () => void;
	clearHistory: () => void;
}

const CONSECUTIVE_REQUIRED = 3;
const NO_SIGN_STREAK_TO_RESET = 5;

function renderLandmarksToCanvas(
	canvas: HTMLCanvasElement | null,
	video: HTMLVideoElement | null,
	hands: NormalizedLandmark[][],
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

	drawHandLandmarks(ctx, hands, canvas.width, canvas.height, {
		isMirrored: true,
		connectorColor: "rgba(59, 130, 246, 0.85)",
		jointColor: "rgba(255, 255, 255, 0.95)",
		fingertipColor: "rgba(239, 68, 68, 0.95)",
		lineWidth: 3,
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
 * processes KSL neural recognition & gesture classification, renders skeletons,
 * and publishes recognized text to the LiveKit room.
 */
export function useSignCapture(room: Room | null = null): UseSignCaptureReturn {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const streamRef = useRef<MediaStream | null>(null);

	const filterRef = useRef<SignStabilityFilter | null>(null);
	if (!filterRef.current) {
		filterRef.current = new SignStabilityFilter({
			windowDurationMs: 350,
			minConsensusRatio: 0.65,
			emitCooldownMs: 2200,
		});
	}

	// KSL LSTM Window & State
	const windowRef = useRef(new RollingWindow());
	const latestPoseRef = useRef<PoseLandmarkerResult | null>(null);
	const predictionStateRef = useRef<PredictionState>({
		lastCandidate: null,
		candidateStreak: 0,
		insertedForSegment: false,
	});
	const predictingRef = useRef(false);

	const [isCameraActive, setIsCameraActive] = useState(true);
	const [cameraError, setCameraError] = useState(false);
	const [showSkeleton, setShowSkeleton] = useState(true);
	const [detectedHandsCount, setDetectedHandsCount] = useState(0);
	const [activeSign, setActiveSign] = useState<RecognizedSign | null>(null);
	const [lastConfirmedSign, setLastConfirmedSign] = useState<RecognizedSign | null>(null);
	const [recentSigns, setRecentSigns] = useState<RecognizedSign[]>([]);
	const [recognizedText, setRecognizedText] = useState<string | null>(null);

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
	}, []);

	// Initialize webcam on mount
	useEffect(() => {
		startCamera();
		return () => {
			stopCamera();
		};
	}, [startCamera, stopCamera]);

	const commitConfirmedSign = useCallback(
		(sign: RecognizedSign) => {
			setLastConfirmedSign(sign);
			setRecognizedText(sign.label);
			setRecentSigns((prev) => [sign, ...prev.slice(0, 9)]);
			if (room) {
				sendChatText(room, sign.label);
			}
		},
		[room],
	);

	// Pose Landmarker hook
	usePoseLandmarker(videoRef, isCameraActive, (result: PoseLandmarkerResult) => {
		latestPoseRef.current = result;
	});

	const handleKslPrediction = useCallback(
		(candidate: string | null, confidence: number) => {
			if (candidate) {
				setActiveSign((prev) =>
					prev && prev.category !== "action"
						? prev
						: {
								id: `ksl_${candidate}`,
								label: candidate,
								description: `KSL 수어 인식: ${candidate}`,
								icon: "🤟",
								confidence,
								category: "action",
								timestamp: Date.now(),
							},
				);
			}

			const { isConfirmed } = updateCandidateStreak(predictionStateRef.current, candidate);
			if (candidate && isConfirmed) {
				const kslSign: RecognizedSign = {
					id: `ksl_${candidate}_${Date.now()}`,
					label: candidate,
					description: `KSL 수어: ${candidate}`,
					icon: "🤟",
					confidence,
					category: "action",
					timestamp: Date.now(),
				};
				commitConfirmedSign(kslSign);
			}
		},
		[commitConfirmedSign],
	);

	// Frame processing callback
	const handleLandmarkerResult = useCallback(
		(handResult: HandLandmarkerResult) => {
			const hands = handResult.landmarks ?? [];
			setDetectedHandsCount(hands.length);

			renderLandmarksToCanvas(canvasRef.current, videoRef.current, hands, showSkeleton);

			const now = performance.now();

			// 1. Rule-based gesture recognition
			const gestureCandidate = recognizeSignGesture(hands, now);
			const { activeSign: gestureActive, confirmedSign: gestureConfirmed } =
				filterRef.current?.update(gestureCandidate, now) ?? {
					activeSign: null,
					confirmedSign: null,
				};

			if (gestureActive) {
				setActiveSign(gestureActive);
			}

			if (gestureConfirmed) {
				commitConfirmedSign(gestureConfirmed);
			}

			// 2. KSL LSTM Sequence Recognition
			const { leftHandLandmarks, rightHandLandmarks } = splitHandsByHandedness(handResult);
			const poseLandmarks = latestPoseLandmarks(latestPoseRef.current);
			windowRef.current.push(
				extractFeatures({ poseLandmarks, leftHandLandmarks, rightHandLandmarks }),
			);

			const frames = windowRef.current.toArray();
			if (!frames || predictingRef.current) return;

			predictingRef.current = true;
			predictSign(frames)
				.then(({ label, confidence }) => {
					const candidate = label && confidence >= CONFIDENCE_THRESHOLD ? label : null;
					handleKslPrediction(candidate, confidence);
				})
				.catch((err) => {
					console.error("Sign prediction error:", err);
				})
				.finally(() => {
					predictingRef.current = false;
				});
		},
		[showSkeleton, commitConfirmedSign, handleKslPrediction],
	);

	const { isLoading: isLoadingModel, isReady: isModelReady } = useHandLandmarker(
		videoRef,
		isCameraActive,
		handleLandmarkerResult,
	);

	return {
		videoRef,
		canvasRef,
		isCameraActive,
		cameraError,
		isLoadingModel,
		isModelReady,
		showSkeleton,
		detectedHandsCount,
		activeSign,
		lastConfirmedSign,
		recentSigns,
		recognizedText,
		toggleCamera,
		toggleSkeleton,
		clearHistory,
	};
}
