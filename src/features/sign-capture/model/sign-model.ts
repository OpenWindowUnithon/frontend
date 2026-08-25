import type * as TF from "@tensorflow/tfjs";

const MODEL_URL = "/ksl/model/model.json";

// index 0 is the model's own "no sign" class and is never treated as a recognized word.
// See public/ksl/model/NOTICE.md for provenance and label-mapping verification.
export const SIGN_LABELS = [
	null,
	"오늘",
	"날씨",
	"좋다",
	"맛있다",
	"식사",
	"감사",
	"안녕",
	"소개",
	"나",
	"만나다",
	"반갑다",
] as const;

export const KSL_WORD_METADATA: Record<string, { icon: string; description: string }> = {
	오늘: { icon: "📅", description: "양손을 가슴 앞에서 아래로 가볍게 내리는 수어" },
	날씨: { icon: "☀️", description: "손을 펴서 뺨이나 가슴 쪽에서 흔드는 수어" },
	좋다: { icon: "👍", description: "엄지손가락을 세워 긍정과 만족을 나타내는 수어" },
	맛있다: { icon: "😋", description: "손끝을 뺨이나 턱에 대고 톡톡 치는 수어" },
	식사: { icon: "🍚", description: "손을 모아 입 쪽으로 가져가는 식사 수어" },
	감사: { icon: "🙏", description: "왼손 등 위에 오른손을 얹어 톡톡 두드리는 수어" },
	안녕: { icon: "👋", description: "손과 팔을 들어 반갑게 인사하는 수어" },
	소개: { icon: "💁‍♂️", description: "손바닥을 위로 하여 부드럽게 펼치는 수어" },
	나: { icon: "🙋", description: "검지손가락으로 자신의 가슴 중앙을 가리키는 수어" },
	만나다: { icon: "👥", description: "양손을 가슴 중앙으로 모아 마주보는 수어" },
	반갑다: { icon: "😊", description: "양 손바닥으로 가슴을 가볍게 쓸어내리는 수어" },
};

export const CONFIDENCE_THRESHOLD = 0.75;

// @tensorflow/tfjs is ~800kB and only needed by DEAF-mode signers, so it's
// dynamically imported (code-split) instead of pulled into the main call chunk.
let modelPromise: Promise<{ tf: typeof TF; model: TF.LayersModel }> | null = null;

function loadSignModel(): Promise<{ tf: typeof TF; model: TF.LayersModel }> {
	modelPromise ??= import("@tensorflow/tfjs").then(async (tf) => ({
		tf,
		model: await tf.loadLayersModel(MODEL_URL),
	}));
	return modelPromise;
}

export interface SignPrediction {
	label: (typeof SIGN_LABELS)[number];
	confidence: number;
}

/** Runs the 30x150 landmark window through the Legatalee LSTM classifier. */
export async function predictSign(frames: number[][]): Promise<SignPrediction> {
	const { tf, model } = await loadSignModel();
	const input = tf.tensor3d([frames]);
	const output = model.predict(input) as TF.Tensor;
	try {
		const values = output.dataSync();
		let bestIndex = 0;
		for (let i = 1; i < values.length; i += 1) {
			if ((values[i] ?? -Infinity) > (values[bestIndex] ?? -Infinity)) bestIndex = i;
		}
		return { label: SIGN_LABELS[bestIndex] ?? null, confidence: values[bestIndex] ?? 0 };
	} finally {
		input.dispose();
		output.dispose();
	}
}
