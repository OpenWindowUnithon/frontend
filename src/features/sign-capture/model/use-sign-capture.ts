import type { HandLandmarkerResult, NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { Room } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { sendChatText } from "@/entities/call";
import { drawHandLandmarks, useHandLandmarker } from "@/shared/lib";
import { type RecognizedSign, recognizeSignGesture, SignStabilityFilter } from "./sign-recognizer";

export interface UseSignCaptureReturn {
	videoRef: React.RefObject<HTMLVideoElement | null>;
	canvasRef: React.RefObject<HTMLCanvasElement | null>;
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

function renderLandmarksToCanvas(
	canvas: HTMLCanvasElement | null,
	video: HTMLVideoElement | null,
	hands: NormalizedLandmark[][],
	showSkeleton: boolean,
) {
	if (!showSkeleton || !canvas || !video?.videoWidth || !video.videoHeight) {
		return;
	}

	if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
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

/**
 * Captures local webcam stream, processes hand landmarks via MediaPipe,
 * classifies sign language gestures, renders skeletons on canvas, and
 * publishes recognized text to the LiveKit room.
 */
export function useSignCapture(room: Room | null): UseSignCaptureReturn {
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

	// Frame processing callback
	const handleLandmarkerResult = useCallback(
		(result: HandLandmarkerResult) => {
			const hands = result.landmarks ?? [];
			setDetectedHandsCount(hands.length);

			renderLandmarksToCanvas(canvasRef.current, videoRef.current, hands, showSkeleton);

			const now = performance.now();
			const candidate = recognizeSignGesture(hands, now);
			const { activeSign: currentActive, confirmedSign } = filterRef.current?.update(
				candidate,
				now,
			) ?? {
				activeSign: null,
				confirmedSign: null,
			};

			setActiveSign(currentActive);

			if (confirmedSign) {
				setLastConfirmedSign(confirmedSign);
				setRecognizedText(confirmedSign.label);
				setRecentSigns((prev) => [confirmedSign, ...prev.slice(0, 9)]);
				if (room) {
					sendChatText(room, confirmedSign.label);
				}
			}
		},
		[showSkeleton, room],
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
