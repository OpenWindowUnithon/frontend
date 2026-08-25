import {
	FilesetResolver,
	HandLandmarker,
	type HandLandmarkerResult,
	type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { type RefObject, useEffect, useRef, useState } from "react";

const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_ASSET_URL =
	"https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let landmarkerPromise: Promise<HandLandmarker> | null = null;

export function loadHandLandmarker(): Promise<HandLandmarker> {
	landmarkerPromise ??= FilesetResolver.forVisionTasks(WASM_BASE_URL).then((vision) =>
		HandLandmarker.createFromOptions(vision, {
			baseOptions: {
				modelAssetPath: MODEL_ASSET_URL,
				delegate: "GPU",
			},
			runningMode: "VIDEO",
			numHands: 2,
			minHandDetectionConfidence: 0.5,
			minHandPresenceConfidence: 0.5,
			minTrackingConfidence: 0.5,
		}),
	);
	return landmarkerPromise;
}

export interface UseHandLandmarkerReturn {
	isLoading: boolean;
	isReady: boolean;
	error: Error | null;
}

function processVideoFrame(
	landmarker: HandLandmarker,
	video: HTMLVideoElement | null,
	lastVideoTime: number,
	onResult?: (result: HandLandmarkerResult) => void,
): number {
	if (!video || video.readyState < 2 || video.paused) return lastVideoTime;
	const currentTime = video.currentTime;
	if (currentTime === lastVideoTime) return lastVideoTime;

	try {
		const result = landmarker.detectForVideo(video, performance.now());
		onResult?.(result);
	} catch {
		// Frame drop or timestamp collision handled gracefully
	}
	return currentTime;
}

/** Runs MediaPipe Hand Landmarker against a live `<video>` element and reports each frame's result. */
export function useHandLandmarker(
	videoRef: RefObject<HTMLVideoElement | null>,
	enabled = true,
	onResult?: (result: HandLandmarkerResult) => void,
): UseHandLandmarkerReturn {
	const [isLoading, setIsLoading] = useState(enabled);
	const [isReady, setIsReady] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const onResultRef = useRef(onResult);
	onResultRef.current = onResult;

	useEffect(() => {
		if (!enabled) {
			setIsLoading(false);
			setIsReady(false);
			return;
		}

		let frameId: number;
		let cancelled = false;
		let lastVideoTime = -1;

		setIsLoading(true);
		setError(null);

		loadHandLandmarker()
			.then((landmarker) => {
				if (cancelled) return;
				setIsLoading(false);
				setIsReady(true);

				const loop = () => {
					if (cancelled) return;
					lastVideoTime = processVideoFrame(
						landmarker,
						videoRef.current,
						lastVideoTime,
						onResultRef.current,
					);
					frameId = requestAnimationFrame(loop);
				};
				loop();
			})
			.catch((err) => {
				if (cancelled) return;
				setIsLoading(false);
				setError(err instanceof Error ? err : new Error(String(err)));
			});

		return () => {
			cancelled = true;
			cancelAnimationFrame(frameId);
		};
	}, [enabled, videoRef]);

	return { isLoading, isReady, error };
}

export const HAND_CONNECTIONS: ReadonlyArray<[number, number]> = [
	// Palm
	[0, 1],
	[0, 5],
	[0, 17],
	[5, 9],
	[9, 13],
	[13, 17],
	// Thumb
	[1, 2],
	[2, 3],
	[3, 4],
	// Index
	[5, 6],
	[6, 7],
	[7, 8],
	// Middle
	[9, 10],
	[10, 11],
	[11, 12],
	// Ring
	[13, 14],
	[14, 15],
	[15, 16],
	// Pinky
	[17, 18],
	[18, 19],
	[19, 20],
];

const FINGERTIP_INDICES = new Set([4, 8, 12, 16, 20]);

export interface DrawLandmarkOptions {
	isMirrored?: boolean;
	connectorColor?: string;
	jointColor?: string;
	fingertipColor?: string;
	lineWidth?: number;
	nodeRadius?: number;
}

interface Point2D {
	x: number;
	y: number;
}

function drawConnections(
	ctx: CanvasRenderingContext2D,
	points: Point2D[],
	color: string,
	width: number,
) {
	ctx.lineWidth = width;
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.strokeStyle = color;

	for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
		const start = points[startIdx];
		const end = points[endIdx];
		if (!start || !end) continue;

		ctx.beginPath();
		ctx.moveTo(start.x, start.y);
		ctx.lineTo(end.x, end.y);
		ctx.stroke();
	}
}

function drawNodes(
	ctx: CanvasRenderingContext2D,
	points: Point2D[],
	jointColor: string,
	fingertipColor: string,
	nodeRadius: number,
) {
	for (let i = 0; i < points.length; i++) {
		const pt = points[i];
		if (!pt) continue;

		const isTip = FINGERTIP_INDICES.has(i);
		const radius = isTip ? nodeRadius + 2 : nodeRadius;

		ctx.beginPath();
		ctx.arc(pt.x, pt.y, radius, 0, 2 * Math.PI);
		ctx.fillStyle = isTip ? fingertipColor : jointColor;
		ctx.fill();

		if (isTip) {
			ctx.lineWidth = 2;
			ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
			ctx.stroke();
		}
	}
}

/**
 * Utility to render 21 hand landmarks and skeleton onto a Canvas 2D context.
 */
export function drawHandLandmarks(
	ctx: CanvasRenderingContext2D,
	landmarksList: NormalizedLandmark[][],
	width: number,
	height: number,
	options: DrawLandmarkOptions = {},
) {
	const {
		isMirrored = true,
		connectorColor = "rgba(59, 130, 246, 0.85)",
		jointColor = "rgba(255, 255, 255, 0.95)",
		fingertipColor = "rgba(239, 68, 68, 0.95)",
		lineWidth = 3,
		nodeRadius = 4,
	} = options;

	ctx.save();
	ctx.clearRect(0, 0, width, height);

	for (const landmarks of landmarksList) {
		const points: Point2D[] = landmarks.map((lm) => ({
			x: isMirrored ? (1 - lm.x) * width : lm.x * width,
			y: lm.y * height,
		}));

		drawConnections(ctx, points, connectorColor, lineWidth);
		drawNodes(ctx, points, jointColor, fingertipColor, nodeRadius);
	}

	ctx.restore();
}
