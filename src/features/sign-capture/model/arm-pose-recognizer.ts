import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { RecognizedSign } from "./sign-recognizer";

export interface ArmPoseFrame {
	poseLandmarks: NormalizedLandmark[] | null;
	leftHandLandmarks: NormalizedLandmark[] | null;
	rightHandLandmarks: NormalizedLandmark[] | null;
	timestamp: number;
}

function dist2D(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
	const dx = p1.x - p2.x;
	const dy = p1.y - p2.y;
	return Math.sqrt(dx * dx + dy * dy);
}

function getShoulderWidth(pose: NormalizedLandmark[]): number {
	const leftShoulder = pose[11];
	const rightShoulder = pose[12];
	if (!leftShoulder || !rightShoulder) return 0.25;
	return Math.max(0.08, dist2D(leftShoulder, rightShoulder));
}

function getChestCenter(pose: NormalizedLandmark[]): { x: number; y: number } {
	const leftShoulder = pose[11];
	const rightShoulder = pose[12];
	if (!leftShoulder || !rightShoulder) return { x: 0.5, y: 0.5 };
	return {
		x: (leftShoulder.x + rightShoulder.x) / 2,
		y: (leftShoulder.y + rightShoulder.y) / 2,
	};
}

/**
 * Checks for "감사합니다" (Thank you):
 * Left forearm is horizontal in front of chest (palm down or flat),
 * Right hand rests on or taps the back of the left hand.
 */
function checkThankYouSign(
	pose: NormalizedLandmark[],
	sw: number,
	chest: { x: number; y: number },
	timestamp: number,
): RecognizedSign | null {
	const leftWrist = pose[15];
	const rightWrist = pose[16];
	if (!leftWrist || !rightWrist) return null;

	const wristDist = dist2D(leftWrist, rightWrist);
	const leftNearChest = dist2D(leftWrist, chest) < sw * 1.2;
	const rightNearChest = dist2D(rightWrist, chest) < sw * 1.2;

	// Hands meet in front of chest
	if (wristDist < sw * 0.45 && leftNearChest && rightNearChest) {
		return {
			id: "ksl_thank_you",
			label: "감사합니다",
			description: "왼손 등 위에 오른손을 얹어 감사를 표하는 한국 수어",
			icon: "🙏",
			confidence: 0.94,
			category: "expression",
			timestamp,
		};
	}

	return null;
}

function isArmRaisedNearHead(
	wrist: NormalizedLandmark | undefined,
	shoulder: NormalizedLandmark | undefined,
	nose: NormalizedLandmark | undefined,
	sw: number,
): boolean {
	if (!wrist || !shoulder) return false;
	const isAboveShoulder = wrist.y < shoulder.y + sw * 0.2;
	if (!isAboveShoulder) return false;
	return nose ? dist2D(wrist, nose) < sw * 1.4 : true;
}

function isPoliteChestGreeting(
	leftWrist: NormalizedLandmark | undefined,
	rightWrist: NormalizedLandmark | undefined,
	chest: { x: number; y: number },
	sw: number,
): boolean {
	if (!leftWrist || !rightWrist) return false;
	const leftDist = dist2D(leftWrist, chest);
	const rightDist = dist2D(rightWrist, chest);
	return (
		leftDist < sw * 0.7 && rightDist < sw * 0.7 && Math.abs(leftWrist.y - rightWrist.y) < sw * 0.3
	);
}

/**
 * Checks for "안녕하세요" (Hello / Greeting):
 * Raised hand waving at shoulder/head height, or polite two-arm greeting at chest level.
 */
function checkHelloGreetingSign(
	pose: NormalizedLandmark[],
	sw: number,
	chest: { x: number; y: number },
	timestamp: number,
): RecognizedSign | null {
	const nose = pose[0];
	const leftShoulder = pose[11];
	const rightShoulder = pose[12];
	const leftWrist = pose[15];
	const rightWrist = pose[16];

	// Right hand raised high near shoulder/head
	if (isArmRaisedNearHead(rightWrist, rightShoulder, nose, sw)) {
		return {
			id: "ksl_hello_wave",
			label: "안녕하세요",
			description: "손과 팔을 들어 반갑게 인사하는 수어 동작",
			icon: "👋",
			confidence: 0.93,
			category: "greeting",
			timestamp,
		};
	}

	// Left hand raised high
	if (isArmRaisedNearHead(leftWrist, leftShoulder, nose, sw)) {
		return {
			id: "ksl_hello_wave_left",
			label: "안녕하세요",
			description: "손과 팔을 들어 반갑게 인사하는 수어 동작",
			icon: "👋",
			confidence: 0.93,
			category: "greeting",
			timestamp,
		};
	}

	// Both arms symmetrically poised in front of chest for greeting
	if (isPoliteChestGreeting(leftWrist, rightWrist, chest, sw)) {
		return {
			id: "ksl_hello_polite",
			label: "안녕하세요",
			description: "두 팔을 모아 정중하게 인사하는 수어 동작",
			icon: "🙇‍♂️",
			confidence: 0.91,
			category: "greeting",
			timestamp,
		};
	}

	return null;
}

/**
 * Checks for "식사 / 밥" (Meal / Eat):
 * Hand brought near mouth/chin level.
 */
function checkMealSign(
	pose: NormalizedLandmark[],
	sw: number,
	timestamp: number,
): RecognizedSign | null {
	const nose = pose[0];
	const rightWrist = pose[16];
	const leftWrist = pose[15];
	if (!nose) return null;

	const rightNearMouth =
		rightWrist && dist2D(rightWrist, nose) < sw * 0.55 && rightWrist.y > nose.y;
	const leftNearMouth = leftWrist && dist2D(leftWrist, nose) < sw * 0.55 && leftWrist.y > nose.y;

	if (rightNearMouth || leftNearMouth) {
		return {
			id: "ksl_meal_eat",
			label: "식사 / 밥",
			description: "손을 입 쪽으로 가져가는 식사 수어 동작",
			icon: "🍚",
			confidence: 0.9,
			category: "action",
			timestamp,
		};
	}

	return null;
}

/**
 * Checks for "만나다" (Meet):
 * Both hands approach each other and meet directly in front of the chest.
 */
function checkMeetSign(
	pose: NormalizedLandmark[],
	sw: number,
	chest: { x: number; y: number },
	timestamp: number,
): RecognizedSign | null {
	const leftWrist = pose[15];
	const rightWrist = pose[16];
	if (!leftWrist || !rightWrist) return null;

	const wristDist = dist2D(leftWrist, rightWrist);
	const midpoint = {
		x: (leftWrist.x + rightWrist.x) / 2,
		y: (leftWrist.y + rightWrist.y) / 2,
	};
	const distToChest = dist2D(midpoint, chest);

	// Both hands upright meeting at chest center
	if (wristDist < sw * 0.5 && distToChest < sw * 0.8) {
		return {
			id: "ksl_meet",
			label: "만나다",
			description: "양손을 가슴 중앙으로 모아 만남을 표현하는 수어",
			icon: "👥",
			confidence: 0.92,
			category: "action",
			timestamp,
		};
	}

	return null;
}

/**
 * Checks for "나 / 저" (Me / I):
 * Hand pointed towards the center of one's own chest.
 */
function checkMeSign(
	pose: NormalizedLandmark[],
	sw: number,
	chest: { x: number; y: number },
	timestamp: number,
): RecognizedSign | null {
	const rightWrist = pose[16];
	const leftWrist = pose[15];

	const rightOnChest = rightWrist && dist2D(rightWrist, chest) < sw * 0.35;
	const leftOnChest = leftWrist && dist2D(leftWrist, chest) < sw * 0.35;

	if (rightOnChest || leftOnChest) {
		return {
			id: "ksl_me",
			label: "나 / 저",
			description: "가슴 중앙을 가리켜 자신을 나타내는 수어",
			icon: "🙋",
			confidence: 0.88,
			category: "action",
			timestamp,
		};
	}

	return null;
}

/**
 * Analyzes upper body pose (shoulders, elbows, wrists) and hand landmarks
 * to recognize full-arm sign language gestures.
 */
export function recognizeArmPoseSign(
	poseLandmarks: NormalizedLandmark[] | null,
	timestamp = performance.now(),
): RecognizedSign | null {
	if (!poseLandmarks || poseLandmarks.length < 17) return null;

	const sw = getShoulderWidth(poseLandmarks);
	const chest = getChestCenter(poseLandmarks);

	// 1. 감사합니다 (Thank you - two hands meeting / right over left)
	const thankYouSign = checkThankYouSign(poseLandmarks, sw, chest, timestamp);
	if (thankYouSign) return thankYouSign;

	// 2. 안녕하세요 (Hello / Greeting - waving or polite arm posture)
	const helloSign = checkHelloGreetingSign(poseLandmarks, sw, chest, timestamp);
	if (helloSign) return helloSign;

	// 3. 식사 (Meal / Eat - hand to mouth)
	const mealSign = checkMealSign(poseLandmarks, sw, timestamp);
	if (mealSign) return mealSign;

	// 4. 만나다 (Meet - both hands meeting in center)
	const meetSign = checkMeetSign(poseLandmarks, sw, chest, timestamp);
	if (meetSign) return meetSign;

	// 5. 나 (Me / I - hand to chest center)
	const meSign = checkMeSign(poseLandmarks, sw, chest, timestamp);
	if (meSign) return meSign;

	return null;
}
