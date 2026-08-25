// v2: references are now stored body-relative (see normalizeFrame) instead of raw
// screen-space coordinates. v1 references would silently mismatch under the new
// normalization, so this bumps the key and effectively starts everyone fresh --
// re-record any custom words after this ships.
const STORAGE_KEY = "naru-sign-references-v2";
const MAX_SAMPLES_PER_WORD = 10;
// Starting point -- tune against real recordings. Distances are now body-relative
// (shoulder-width units), so this is unrelated to the old v1 threshold's scale.
export const DEFAULT_DTW_THRESHOLD = 0.6;

type ReferenceStore = Record<string, number[][][]>;

// Reference sequences never leave the browser: no server call, no upload.
function loadReferences(): ReferenceStore {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
	} catch {
		return {};
	}
}

function persist(store: ReferenceStore) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// Layout matches landmarks.ts's extractFeatures: pose is 6 landmarks x [x,y,z,visibility]
// (indices 0-23, in POSE_LANDMARK_INDICES order [11,12,13,14,15,16] -- left shoulder is
// frame[0..3], right shoulder is frame[4..7]), followed by left hand and right hand,
// each 21 landmarks x [x,y,z].
const POSE_BLOCK_LEN = 24;
const MIN_SHOULDER_SPAN = 0.01;

/**
 * Re-anchors a frame's x/y/z to the shoulder midpoint and rescales by shoulder width, so
 * DTW compares gesture *shape* instead of the signer's raw position in the camera frame.
 * Without this, moving even slightly between recording a reference and testing it (closer
 * to the camera, shifted left/right) changes every coordinate enough that DTW distance
 * balloons regardless of how well the gesture itself matches.
 */
function normalizeFrame(frame: number[]): number[] {
	const leftShoulderX = frame[0] ?? 0;
	const leftShoulderY = frame[1] ?? 0;
	const rightShoulderX = frame[4] ?? 0;
	const rightShoulderY = frame[5] ?? 0;
	const centerX = (leftShoulderX + rightShoulderX) / 2;
	const centerY = (leftShoulderY + rightShoulderY) / 2;
	const scale = Math.max(
		Math.hypot(rightShoulderX - leftShoulderX, rightShoulderY - leftShoulderY),
		MIN_SHOULDER_SPAN,
	);

	const normalized = frame.slice();
	for (let i = 0; i + 2 < frame.length; i += i < POSE_BLOCK_LEN ? 4 : 3) {
		normalized[i] = ((frame[i] ?? 0) - centerX) / scale;
		normalized[i + 1] = ((frame[i + 1] ?? 0) - centerY) / scale;
		normalized[i + 2] = (frame[i + 2] ?? 0) / scale;
	}
	return normalized;
}

function normalizeSequence(frames: number[][]): number[][] {
	return frames.map(normalizeFrame);
}

/** Stores one 30-frame landmark sample as a reference for `word`. Returns the sample count for that word. */
export function saveReference(word: string, sequence: number[][]): number {
	const store = loadReferences();
	const samples = [...(store[word] ?? []), normalizeSequence(sequence)].slice(
		-MAX_SAMPLES_PER_WORD,
	);
	store[word] = samples;
	persist(store);
	return samples.length;
}

export function clearReference(word: string) {
	const store = loadReferences();
	delete store[word];
	persist(store);
}

/** word -> saved sample count, for display in the recording UI. */
export function listReferences(): Record<string, number> {
	const store = loadReferences();
	return Object.fromEntries(Object.entries(store).map(([word, samples]) => [word, samples.length]));
}

function frameDistance(a: number[], b: number[]): number {
	let sum = 0;
	for (let i = 0; i < a.length; i += 1) {
		const diff = (a[i] ?? 0) - (b[i] ?? 0);
		sum += diff * diff;
	}
	return Math.sqrt(sum);
}

// Classic O(n*m) DTW over per-frame Euclidean distance, normalized by path length
// so short and long sequences remain comparable.
function dtwDistance(sequenceA: number[][], sequenceB: number[][]): number {
	const n = sequenceA.length;
	const m = sequenceB.length;
	const rows: number[][] = Array.from({ length: n + 1 }, () =>
		new Array(m + 1).fill(Number.POSITIVE_INFINITY),
	);
	const firstRow = rows[0];
	if (firstRow) firstRow[0] = 0;

	for (let i = 1; i <= n; i += 1) {
		const row = rows[i];
		const prevRow = rows[i - 1];
		const a = sequenceA[i - 1];
		if (!row || !prevRow) continue;
		for (let j = 1; j <= m; j += 1) {
			const b = sequenceB[j - 1];
			const d = a && b ? frameDistance(a, b) : 0;
			row[j] =
				d +
				Math.min(
					prevRow[j] ?? Number.POSITIVE_INFINITY,
					row[j - 1] ?? Number.POSITIVE_INFINITY,
					prevRow[j - 1] ?? Number.POSITIVE_INFINITY,
				);
		}
	}
	return (rows[n]?.[m] ?? Number.POSITIVE_INFINITY) / (n + m);
}

export interface DtwMatch {
	word: string;
	distance: number;
}

/** Finds the closest saved reference to `sequence` (raw, un-normalized), or null if nothing is within threshold. */
export function matchReference(
	sequence: number[][],
	threshold = DEFAULT_DTW_THRESHOLD,
): DtwMatch | null {
	const store = loadReferences();
	const normalized = normalizeSequence(sequence);
	let best: DtwMatch | null = null;
	for (const [word, samples] of Object.entries(store)) {
		for (const sample of samples) {
			const distance = dtwDistance(normalized, sample);
			if (distance <= threshold && (!best || distance < best.distance)) {
				best = { word, distance };
			}
		}
	}
	return best;
}
