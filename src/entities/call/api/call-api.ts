import { apiClient } from "@/shared/api";
import type { CallMode, JoinResult } from "../model/types";
import { joinResultSchema } from "../model/types";

/** Idempotent per creator key — same key + roomCode returns the existing call instead of erroring. */
export async function createCall(roomCode: string, creatorKey: string): Promise<void> {
	await apiClient.post("/api/calls", { roomCode }, { headers: { "X-Creator-Key": creatorKey } });
}

export async function joinCall(
	roomCode: string,
	mode: CallMode,
	participantKey: string,
): Promise<JoinResult> {
	const { data } = await apiClient.post(
		`/api/calls/${encodeURIComponent(roomCode)}/join`,
		{ mode },
		{ headers: { "X-Participant-Key": participantKey } },
	);
	return joinResultSchema.parse(data);
}

/** Call every ~10s while connected — the server's participant lease expires without it. */
export async function sendHeartbeat(callId: string, participantKey: string): Promise<void> {
	await apiClient.post(`/api/calls/${callId}/heartbeat`, undefined, {
		headers: { "X-Participant-Key": participantKey },
	});
}

export async function disconnectCall(callId: string, participantKey: string): Promise<void> {
	await apiClient.post(`/api/calls/${callId}/disconnect`, undefined, {
		headers: { "X-Participant-Key": participantKey },
	});
}

export async function endCall(callId: string, creatorKey: string): Promise<void> {
	await apiClient.post(`/api/calls/${callId}/end`, undefined, {
		headers: { "X-Creator-Key": creatorKey },
	});
}
