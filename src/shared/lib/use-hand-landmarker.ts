import {
	FilesetResolver,
	HandLandmarker,
	type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { type RefObject, useEffect, useRef } from "react";

const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_ASSET_URL =
	"https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let landmarkerPromise: Promise<HandLandmarker> | null = null;

function loadHandLandmarker(): Promise<HandLandmarker> {
	landmarkerPromise ??= FilesetResolver.forVisionTasks(WASM_BASE_URL).then((vision) =>
		HandLandmarker.createFromOptions(vision, {
			baseOptions: { modelAssetPath: MODEL_ASSET_URL },
			runningMode: "VIDEO",
			numHands: 2,
		}),
	);
	return landmarkerPromise;
}

/** Runs MediaPipe Hand Landmarker against a live `<video>` element and reports each frame's result. */
export function useHandLandmarker(
	videoRef: RefObject<HTMLVideoElement | null>,
	enabled: boolean,
	onResult: (result: HandLandmarkerResult) => void,
) {
	const onResultRef = useRef(onResult);
	onResultRef.current = onResult;

	useEffect(() => {
		if (!enabled) return;

		let frameId: number;
		let cancelled = false;

		loadHandLandmarker().then((landmarker) => {
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
