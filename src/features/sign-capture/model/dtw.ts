const STORAGE_KEY = "naru-sign-references-v1";
const MAX_SAMPLES_PER_WORD = 10;
// Starting point only -- tune against real recordings once references exist.
const DEFAULT_DTW_THRESHOLD = 0.15;

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

/** Stores one 30-frame landmark sample as a reference for `word`. Returns the sample count for that word. */
export function saveReference(word: string, sequence: number[][]): number {
	const store = loadReferences();
	const samples = [...(store[word] ?? []), sequence].slice(-MAX_SAMPLES_PER_WORD);
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

/** Finds the closest saved reference to `sequence`, or null if nothing is within threshold. */
export function matchReference(
	sequence: number[][],
	threshold = DEFAULT_DTW_THRESHOLD,
): DtwMatch | null {
	const store = loadReferences();
	let best: DtwMatch | null = null;
	for (const [word, samples] of Object.entries(store)) {
		for (const sample of samples) {
			const distance = dtwDistance(sequence, sample);
			if (distance <= threshold && (!best || distance < best.distance)) {
				best = { word, distance };
			}
		}
	}
	return best;
}
