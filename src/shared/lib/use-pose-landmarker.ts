import {
	FilesetResolver,
	PoseLandmarker,
	type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { type RefObject, useEffect, useRef } from "react";

const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_ASSET_URL =
	"https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

function loadPoseLandmarker(): Promise<PoseLandmarker> {
	landmarkerPromise ??= FilesetResolver.forVisionTasks(WASM_BASE_URL).then((vision) =>
		PoseLandmarker.createFromOptions(vision, {
			baseOptions: { modelAssetPath: MODEL_ASSET_URL },
			runningMode: "VIDEO",
			numPoses: 1,
		}),
	);
	return landmarkerPromise;
}

/** Runs MediaPipe Pose Landmarker against a live `<video>` element and reports each frame's result. */
export function usePoseLandmarker(
	videoRef: RefObject<HTMLVideoElement | null>,
	enabled: boolean,
	onResult: (result: PoseLandmarkerResult) => void,
) {
	const onResultRef = useRef(onResult);
	onResultRef.current = onResult;

	useEffect(() => {
		if (!enabled) return;

		let frameId: number;
		let cancelled = false;

		loadPoseLandmarker().then((landmarker) => {
			if (cancelled) return;
			const loop = () => {
				const video = videoRef.current;
				if (video && video.readyState >= 2) {
					onResultRef.current(landmarker.detectForVideo(video, performance.now()));
				}
				frameId = requestAnimationFrame(loop);
			};
			loop();
		});

		return () => {
			cancelled = true;
			cancelAnimationFrame(frameId);
		};
	}, [enabled, videoRef]);
}
