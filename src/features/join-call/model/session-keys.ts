/**
 * The backend has no real accounts — a participant "is" whoever holds this
 * random key (hashed and matched server-side). Persist per roomCode so a
 * page reload rejoins as the same participant instead of a stranger.
 */
function storageKey(prefix: "creator" | "participant", roomCode: string): string {
	return `${prefix}:${roomCode}`;
}

export function getOrCreateSessionKey(prefix: "creator" | "participant", roomCode: string): string {
	const key = storageKey(prefix, roomCode);
	const existing = sessionStorage.getItem(key);
	if (existing) return existing;
	const created = crypto.randomUUID();
	sessionStorage.setItem(key, created);
	return created;
}

export function setSessionKey(
	prefix: "creator" | "participant",
	roomCode: string,
	value: string,
): void {
	sessionStorage.setItem(storageKey(prefix, roomCode), value);
}
