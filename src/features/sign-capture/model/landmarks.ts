import type {
	HandLandmarkerResult,
	NormalizedLandmark,
	PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

export const POSE_LANDMARK_INDICES = [11, 12, 13, 14, 15, 16] as const;
export const HAND_LANDMARK_COUNT = 21;
export const FEATURE_LENGTH = POSE_LANDMARK_INDICES.length * 4 + HAND_LANDMARK_COUNT * 3 * 2;
export const WINDOW_FRAMES = 30;

function poseFeatures(poseLandmarks: NormalizedLandmark[] | null): number[] {
	const out = new Array(POSE_LANDMARK_INDICES.length * 4).fill(0);
	if (!poseLandmarks) return out;
	POSE_LANDMARK_INDICES.forEach((index, i) => {
		const point = poseLandmarks[index];
		if (!point) return;
		out[i * 4] = point.x;
		out[i * 4 + 1] = point.y;
		out[i * 4 + 2] = point.z;
		out[i * 4 + 3] = point.visibility ?? 0;
	});
	return out;
}

function handFeatures(handLandmarks: NormalizedLandmark[] | null): number[] {
	const out = new Array(HAND_LANDMARK_COUNT * 3).fill(0);
	if (!handLandmarks) return out;
	handLandmarks.forEach((point, i) => {
		out[i * 3] = point.x;
		out[i * 3 + 1] = point.y;
		out[i * 3 + 2] = point.z;
	});
	return out;
}

// MediaPipe HandLandmarker reports handedness per detection rather than fixed
// left/right slots, so results must be sorted into left/right by category label.
export function splitHandsByHandedness(handResult: HandLandmarkerResult | null): {
	leftHandLandmarks: NormalizedLandmark[] | null;
	rightHandLandmarks: NormalizedLandmark[] | null;
} {
	let leftHandLandmarks: NormalizedLandmark[] | null = null;
	let rightHandLandmarks: NormalizedLandmark[] | null = null;
	handResult?.landmarks.forEach((landmarks, i) => {
		const label = handResult.handedness?.[i]?.[0]?.categoryName;
		if (label === "Left") leftHandLandmarks = landmarks;
		else if (label === "Right") rightHandLandmarks = landmarks;
	});
	return { leftHandLandmarks, rightHandLandmarks };
}

interface ExtractFeaturesInput {
	poseLandmarks: NormalizedLandmark[] | null;
	leftHandLandmarks: NormalizedLandmark[] | null;
	rightHandLandmarks: NormalizedLandmark[] | null;
}

// pose(6 landmarks x xyz+visibility=24) + left hand(21x3=63) + right hand(21x3=63) = 150,
// matching the Legatalee LSTM model's training-time feature contract.
export function extractFeatures({
	poseLandmarks,
	leftHandLandmarks,
	rightHandLandmarks,
}: ExtractFeaturesInput): number[] {
	return [
		...poseFeatures(poseLandmarks),
		...handFeatures(leftHandLandmarks),
		...handFeatures(rightHandLandmarks),
	];
}

export function latestPoseLandmarks(
	result: PoseLandmarkerResult | null,
): NormalizedLandmark[] | null {
	return result?.landmarks[0] ?? null;
}

export class RollingWindow {
	private frames: number[][] = [];

	constructor(private readonly size: number = WINDOW_FRAMES) {}

	push(features: number[]) {
		this.frames.push(features);
		if (this.frames.length > this.size) this.frames.shift();
	}

	get isFull() {
		return this.frames.length === this.size;
	}

	toArray(): number[][] | null {
		return this.isFull ? this.frames.map((frame) => frame.slice()) : null;
	}

	clear() {
		this.frames = [];
	}
}
