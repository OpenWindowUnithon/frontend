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

// The demo only needs these 7 words recognized -- the rest of the currently-trained model's
// vocabulary (and any custom DTW words) is filtered out of the user flow in use-sign-capture.ts
// so it never surfaces as a recognized sign, history entry, or composed sentence. The model is
// being retrained to specifically target this set; until then, only the words below that also
// exist in SIGN_LABELS ("오늘", "안녕", "감사") are actually recognizable.
export const DEMO_KSL_WORDS = ["안녕", "오늘", "예약", "가능", "네", "좋아요", "감사"] as const;

export function isDemoKslWord(word: string): word is (typeof DEMO_KSL_WORDS)[number] {
	return (DEMO_KSL_WORDS as readonly string[]).includes(word);
}

export const KSL_WORD_METADATA: Record<string, { icon: string; description: string }> = {
	안녕: { icon: "👋", description: "손과 팔을 들어 반갑게 인사하는 수어" },
	오늘: { icon: "📅", description: "양손을 가슴 앞에서 아래로 가볍게 내리는 수어" },
	예약: { icon: "📆", description: "한 손으로 달력에 표시하듯 짚어 보이는 수어" },
	가능: { icon: "👌", description: "엄지와 검지를 맞대어 동그라미를 만드는 수어" },
	네: { icon: "🙆", description: "고개를 끄덕이듯 주먹을 위아래로 가볍게 흔드는 수어" },
	좋아요: { icon: "👍", description: "엄지손가락을 세워 긍정과 만족을 나타내는 수어" },
	감사: { icon: "🙏", description: "왼손 등 위에 오른손을 얹어 톡톡 두드리는 수어" },
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
