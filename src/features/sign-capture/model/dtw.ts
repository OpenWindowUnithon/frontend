import { apiClient } from "@/shared/api";

const MAX_SAMPLES_PER_WORD = 10;
// Favor recall for live rolling windows, which include gesture transitions unlike saved samples.
export const DEFAULT_DTW_THRESHOLD = 3;

type ReferenceStore = Record<string, number[][][]>;

// Reference samples are global now (see backend PR: com.ssu.unithon.sign.domain.SignWordReference)
// -- there's no per-user auth in this app, so a word one signer records becomes recognizable
// for everyone. DTW matching runs client-side on every video frame (15-30x/second), so it
// cannot be a network call -- this in-memory cache is the thing actually queried per frame,
// refreshed from the server on load and kept in sync optimistically on save/delete.
let cache: ReferenceStore = {};

/** Fetches the full reference store from the server and refreshes the in-memory matching cache. Call once on mount; recognition uses the cache, not the network, per frame. */
export async function loadReferencesFromServer(): Promise<Record<string, number>> {
	const { data } = await apiClient.get<ReferenceStore>("/api/sign-language/references");
	cache = data;
	return countsFromCache();
}

function countsFromCache(): Record<string, number> {
	return Object.fromEntries(Object.entries(cache).map(([word, samples]) => [word, samples.length]));
}

/** word -> saved sample count, for display in the recording UI. Reads the in-memory cache -- call loadReferencesFromServer first to populate it. */
export function listReferences(): Record<string, number> {
	return countsFromCache();
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

/** Replaces `word`'s entire reference set on the server with `samples` (each a raw, un-normalized landmark sequence) and updates the in-memory matching cache to match. A take is meant to supersede whatever was recorded before, not accumulate alongside it. */
export async function replaceReferenceSamples(word: string, samples: number[][][]): Promise<void> {
	const normalized = samples.map(normalizeSequence).slice(-MAX_SAMPLES_PER_WORD);
	await apiClient.put(`/api/sign-language/references/${encodeURIComponent(word)}`, {
		samples: normalized,
	});
	cache = { ...cache, [word]: normalized };
}

export async function deleteReference(word: string): Promise<void> {
	await apiClient.delete(`/api/sign-language/references/${encodeURIComponent(word)}`);
	const { [word]: _removed, ...rest } = cache;
	cache = rest;
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

/**
 * Finds the closest saved reference to `sequence` (raw, un-normalized), regardless of
 * distance -- always returns a nearest neighbor if any reference is registered, even a bad
 * one. The caller (use-sign-capture.ts's resolvePrediction) is what applies
 * DEFAULT_DTW_THRESHOLD to decide whether the match is close enough to actually confirm, vs.
 * just showing it as a live "closest so far" hint. Reads the in-memory cache synchronously
 * (no network call) since this runs every video frame.
 */
export function closestReference(sequence: number[][]): DtwMatch | null {
	const normalized = normalizeSequence(sequence);
	let best: DtwMatch | null = null;
	for (const [word, samples] of Object.entries(cache)) {
		for (const sample of samples) {
			const distance = dtwDistance(normalized, sample);
			if (!best || distance < best.distance) {
				best = { word, distance };
			}
		}
	}
	return best;
}
