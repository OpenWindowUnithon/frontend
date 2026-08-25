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

export const CONFIDENCE_THRESHOLD = 0.8;

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
