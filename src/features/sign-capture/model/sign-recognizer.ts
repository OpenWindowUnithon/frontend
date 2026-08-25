import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export interface RecognizedSign {
	id: string;
	label: string;
	description: string;
	icon: string;
	confidence: number;
	category: "greeting" | "expression" | "number" | "fingerspelling" | "action";
	timestamp: number;
}

interface FingerState {
	thumb: boolean;
	index: boolean;
	middle: boolean;
	ring: boolean;
	pinky: boolean;
	thumbIndexPinch: boolean;
	thumbMiddlePinch: boolean;
}

function dist2D(p1: NormalizedLandmark, p2: NormalizedLandmark): number {
	const dx = p1.x - p2.x;
	const dy = p1.y - p2.y;
	return Math.sqrt(dx * dx + dy * dy);
}

function getPalmScale(lm: NormalizedLandmark[]): number {
	const wrist = lm[0];
	const middleMcp = lm[9];
	if (!wrist || !middleMcp) return 0.2;
	return Math.max(0.05, dist2D(wrist, middleMcp));
}

function isFingerExtended(
	wrist: NormalizedLandmark,
	mcp?: NormalizedLandmark,
	pip?: NormalizedLandmark,
	tip?: NormalizedLandmark,
): boolean {
	if (!mcp || !pip || !tip) return false;
	return (
		dist2D(wrist, tip) > dist2D(wrist, pip) * 1.15 && dist2D(mcp, tip) > dist2D(mcp, pip) * 1.3
	);
}

function isThumbExtended(
	palmScale: number,
	thumbTip?: NormalizedLandmark,
	thumbMcp?: NormalizedLandmark,
	indexMcp?: NormalizedLandmark,
): boolean {
	if (!thumbTip || !thumbMcp || !indexMcp) return false;
	const thumbDistIndexMcp = dist2D(thumbTip, indexMcp);
	const thumbDistMcp = dist2D(thumbTip, thumbMcp);
	return thumbDistIndexMcp > palmScale * 0.65 && thumbDistMcp > palmScale * 0.6;
}

function isPinching(
	palmScale: number,
	tip1?: NormalizedLandmark,
	tip2?: NormalizedLandmark,
): boolean {
	if (!tip1 || !tip2) return false;
	return dist2D(tip1, tip2) < palmScale * 0.35;
}

function analyzeFingerStates(lm: NormalizedLandmark[]): FingerState {
	const wrist = lm[0];
	const palmScale = getPalmScale(lm);

	if (!wrist) {
		return {
			thumb: false,
			index: false,
			middle: false,
			ring: false,
			pinky: false,
			thumbIndexPinch: false,
			thumbMiddlePinch: false,
		};
	}

	return {
		thumb: isThumbExtended(palmScale, lm[4], lm[2], lm[5]),
		index: isFingerExtended(wrist, lm[5], lm[6], lm[8]),
		middle: isFingerExtended(wrist, lm[9], lm[10], lm[12]),
		ring: isFingerExtended(wrist, lm[13], lm[14], lm[16]),
		pinky: isFingerExtended(wrist, lm[17], lm[18], lm[20]),
		thumbIndexPinch: isPinching(palmScale, lm[4], lm[8]),
		thumbMiddlePinch: isPinching(palmScale, lm[4], lm[12]),
	};
}

function checkTwoHandGesture(
	landmarksList: NormalizedLandmark[][],
	timestamp: number,
): RecognizedSign | null {
	if (landmarksList.length < 2) return null;
	const hand1 = landmarksList[0];
	const hand2 = landmarksList[1];
	if (!hand1?.[0] || !hand2?.[0]) return null;

	const wristDist = dist2D(hand1[0], hand2[0]);
	const palmScale = (getPalmScale(hand1) + getPalmScale(hand2)) / 2;
	if (wristDist >= palmScale * 1.8) return null;

	const state1 = analyzeFingerStates(hand1);
	const state2 = analyzeFingerStates(hand2);

	const isBothHandsOpen =
		state1.index &&
		state1.middle &&
		state1.ring &&
		state1.pinky &&
		state2.index &&
		state2.middle &&
		state2.ring &&
		state2.pinky;

	if (isBothHandsOpen) {
		return {
			id: "please_sorry",
			label: "부탁합니다 / 죄송합니다",
			description: "두 손을 모아 부탁이나 사과의 뜻을 전하는 수어",
			icon: "🙏",
			confidence: 0.92,
			category: "expression",
			timestamp,
		};
	}

	return {
		id: "thank_you_two_hands",
		label: "감사합니다",
		description: "두 손을 맞대어 감사의 마음을 표현하는 수어",
		icon: "🤝",
		confidence: 0.88,
		category: "expression",
		timestamp,
	};
}

function checkLoveSign(state: FingerState, timestamp: number): RecognizedSign | null {
	if (state.thumb && state.index && !state.middle && !state.ring && state.pinky) {
		return {
			id: "love",
			label: "사랑합니다",
			description: "엄지, 검지, 새끼손가락을 편 세계 공통 수어 'I Love You'",
			icon: "🤟",
			confidence: 0.95,
			category: "expression",
			timestamp,
		};
	}
	return null;
}

function checkThumbsUp(
	hand: NormalizedLandmark[],
	state: FingerState,
	timestamp: number,
): RecognizedSign | null {
	const thumbTip = hand[4];
	const indexMcp = hand[5];
	if (state.thumb && !state.index && !state.middle && !state.ring && !state.pinky) {
		if (thumbTip && indexMcp && thumbTip.y < indexMcp.y) {
			return {
				id: "thumbs_up",
				label: "최고예요 / 좋아요",
				description: "엄지손가락을 위로 세워 칭찬과 긍정을 나타내는 제스처",
				icon: "👍",
				confidence: 0.93,
				category: "expression",
				timestamp,
			};
		}
	}
	return null;
}

function checkOkSign(state: FingerState, timestamp: number): RecognizedSign | null {
	if (state.thumbIndexPinch && state.middle && state.ring && state.pinky) {
		return {
			id: "ok_confirm",
			label: "확인했습니다 / OK",
			description: "엄지와 검지로 원을 만들어 확인이나 동의를 나타내는 수어",
			icon: "👌",
			confidence: 0.92,
			category: "action",
			timestamp,
		};
	}
	return null;
}

function checkVictorySign(state: FingerState, timestamp: number): RecognizedSign | null {
	if (!state.thumb && state.index && state.middle && !state.ring && !state.pinky) {
		return {
			id: "victory_peace",
			label: "승리 / 화이팅 (숫자 2)",
			description: "검지와 중지를 V자로 펼쳐 승리나 희망을 나타내는 수어",
			icon: "✌️",
			confidence: 0.94,
			category: "expression",
			timestamp,
		};
	}
	return null;
}

function checkHelloSign(
	hand: NormalizedLandmark[],
	state: FingerState,
	timestamp: number,
): RecognizedSign | null {
	const wrist = hand[0];
	const indexTip = hand[8];
	if (state.thumb && state.index && state.middle && state.ring && state.pinky) {
		if (wrist && indexTip && wrist.y > indexTip.y) {
			return {
				id: "hello_greeting",
				label: "안녕하세요",
				description: "손바닥을 앞으로 펴서 반갑게 인사하는 수어",
				icon: "👋",
				confidence: 0.91,
				category: "greeting",
				timestamp,
			};
		}
	}
	return null;
}

function checkExpressionSigns(
	hand: NormalizedLandmark[],
	state: FingerState,
	timestamp: number,
): RecognizedSign | null {
	return (
		checkLoveSign(state, timestamp) ??
		checkThumbsUp(hand, state, timestamp) ??
		checkOkSign(state, timestamp) ??
		checkVictorySign(state, timestamp) ??
		checkHelloSign(hand, state, timestamp)
	);
}

function checkNumberAndFingerspelling(
	hand: NormalizedLandmark[],
	state: FingerState,
	palmScale: number,
	timestamp: number,
): RecognizedSign | null {
	const thumbTip = hand[4];
	const indexMcp = hand[5];
	if (!thumbTip || !indexMcp) return null;

	// Number 1 (1 / 하나 - ☝️)
	if (!state.thumb && state.index && !state.middle && !state.ring && !state.pinky) {
		return {
			id: "number_one",
			label: "1 (하나 / 선택)",
			description: "검지손가락 하나를 펴서 1 또는 가리킴을 나타내는 수어",
			icon: "☝️",
			confidence: 0.9,
			category: "number",
			timestamp,
		};
	}

	// Number 3 (3 / 셋 - 3️⃣)
	if (state.index && state.middle && state.ring && !state.pinky) {
		return {
			id: "number_three",
			label: "3 (셋)",
			description: "검지, 중지, 약지 세 손가락을 펴서 3을 나타내는 수어",
			icon: "3️⃣",
			confidence: 0.89,
			category: "number",
			timestamp,
		};
	}

	// Number 4 (4 / 넷 - 4️⃣)
	if (!state.thumb && state.index && state.middle && state.ring && state.pinky) {
		return {
			id: "number_four",
			label: "4 (넷)",
			description: "엄지를 접고 네 손가락을 펴서 4를 나타내는 수어",
			icon: "4️⃣",
			confidence: 0.9,
			category: "number",
			timestamp,
		};
	}

	// Finger alphabet 'ㄴ' (니은 - 👆)
	if (state.thumb && state.index && !state.middle && !state.ring && !state.pinky) {
		if (Math.abs(thumbTip.x - indexMcp.x) > palmScale * 0.5) {
			return {
				id: "finger_letter_nieun",
				label: "지화 'ㄴ' (니은)",
				description: "엄지와 검지를 직각으로 펼치는 한글 지화",
				icon: "🔤",
				confidence: 0.88,
				category: "fingerspelling",
				timestamp,
			};
		}
	}

	// Fist / Rock / ㅁ (미음 - ✊)
	if (!state.thumb && !state.index && !state.middle && !state.ring && !state.pinky) {
		return {
			id: "fist_rock",
			label: "주먹 / 지화 'ㅁ'",
			description: "손을 꼭 쥔 주먹 또는 한글 지화 'ㅁ'",
			icon: "✊",
			confidence: 0.85,
			category: "fingerspelling",
			timestamp,
		};
	}

	return null;
}

/**
 * Recognizes sign language gestures from MediaPipe Hand Landmarks.
 * Supports standard KSL/ASL gestures, numbers, and two-hand expressions.
 */
export function recognizeSignGesture(
	landmarksList: NormalizedLandmark[][],
	timestamp = performance.now(),
): RecognizedSign | null {
	if (!landmarksList || landmarksList.length === 0) return null;

	const twoHandSign = checkTwoHandGesture(landmarksList, timestamp);
	if (twoHandSign) return twoHandSign;

	const hand = landmarksList[0];
	if (!hand || hand.length < 21) return null;

	const state = analyzeFingerStates(hand);
	const palmScale = getPalmScale(hand);

	const expressionSign = checkExpressionSigns(hand, state, timestamp);
	if (expressionSign) return expressionSign;

	return checkNumberAndFingerspelling(hand, state, palmScale, timestamp);
}

function findDominantEntry(
	history: Array<{ sign: RecognizedSign; time: number }>,
): { count: number; sign: RecognizedSign } | null {
	const counts = new Map<string, { count: number; sign: RecognizedSign }>();
	for (const item of history) {
		const existing = counts.get(item.sign.id);
		if (existing) {
			existing.count += 1;
			if (item.sign.confidence > existing.sign.confidence) {
				existing.sign = item.sign;
			}
		} else {
			counts.set(item.sign.id, { count: 1, sign: item.sign });
		}
	}

	let dominant: { count: number; sign: RecognizedSign } | null = null;
	for (const entry of counts.values()) {
		if (!dominant || entry.count > dominant.count) {
			dominant = entry;
		}
	}
	return dominant;
}

/**
 * Sliding window stabilizer to debounce and smoothly confirm recognized signs.
 */
export class SignStabilityFilter {
	private history: Array<{ sign: RecognizedSign; time: number }> = [];
	private lastConfirmedSign: RecognizedSign | null = null;
	private lastConfirmedTime = 0;
	private windowDurationMs: number;
	private minConsensusRatio: number;
	private emitCooldownMs: number;

	constructor(
		options: {
			windowDurationMs?: number;
			minConsensusRatio?: number;
			emitCooldownMs?: number;
		} = {},
	) {
		this.windowDurationMs = options.windowDurationMs ?? 350;
		this.minConsensusRatio = options.minConsensusRatio ?? 0.6;
		this.emitCooldownMs = options.emitCooldownMs ?? 2000;
	}

	public update(
		candidate: RecognizedSign | null,
		now = performance.now(),
	): {
		activeSign: RecognizedSign | null;
		confirmedSign: RecognizedSign | null;
	} {
		this.history = this.history.filter((item) => now - item.time <= this.windowDurationMs);
		if (candidate) this.history.push({ sign: candidate, time: now });

		if (this.history.length === 0) {
			return { activeSign: null, confirmedSign: null };
		}

		const dominant = findDominantEntry(this.history);
		if (!dominant) return { activeSign: null, confirmedSign: null };

		const ratio = dominant.count / this.history.length;
		const activeSign = ratio >= 0.5 ? dominant.sign : null;
		const confirmedSign = this.evaluateConfirmation(dominant.sign, ratio, now);

		return { activeSign, confirmedSign };
	}

	private evaluateConfirmation(
		sign: RecognizedSign,
		ratio: number,
		now: number,
	): RecognizedSign | null {
		if (ratio < this.minConsensusRatio || this.history.length < 4) {
			return null;
		}

		const isDifferent = this.lastConfirmedSign?.id !== sign.id;
		const isCooledDown = now - this.lastConfirmedTime >= this.emitCooldownMs;

		if (isDifferent || isCooledDown) {
			this.lastConfirmedSign = sign;
			this.lastConfirmedTime = now;
			return sign;
		}

		return null;
	}

	public reset(): void {
		this.history = [];
		this.lastConfirmedSign = null;
		this.lastConfirmedTime = 0;
	}
}
