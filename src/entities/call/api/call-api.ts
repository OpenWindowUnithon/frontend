import { apiClient } from "@/shared/api";
import type { CallMode, JoinResult, StatusResult } from "../model/types";
import { joinResultSchema, statusResultSchema } from "../model/types";

/** Idempotent per creator key — same key + roomCode returns the existing call instead of erroring. */
export async function createCall(roomCode: string, creatorKey: string): Promise<void> {
	await apiClient.post("/api/calls", { roomCode }, { headers: { "X-Creator-Key": creatorKey } });
}

/** Reserves a participant slot and reports RINGING/role — no LiveKit token yet, see `acceptCall`/`getCallStatus`. */
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

/** Poll while RINGING (also refreshes this participant's heartbeat) -- returns a token once ACTIVE. */
export async function getCallStatus(callId: string, participantKey: string): Promise<StatusResult> {
	const { data } = await apiClient.get(`/api/calls/${callId}/status`, {
		headers: { "X-Participant-Key": participantKey },
	});
	return statusResultSchema.parse(data);
}

/** Only the CALLEE may accept (the backend rejects the CALLER's attempt). Returns the accepter's own token. */
export async function acceptCall(callId: string, participantKey: string): Promise<StatusResult> {
	const { data } = await apiClient.post(`/api/calls/${callId}/accept`, undefined, {
		headers: { "X-Participant-Key": participantKey },
	});
	return statusResultSchema.parse(data);
}

/** Either side can call this while RINGING -- CALLER cancelling and CALLEE declining have the same effect. */
export async function rejectCall(callId: string, participantKey: string): Promise<void> {
	await apiClient.post(`/api/calls/${callId}/reject`, undefined, {
		headers: { "X-Participant-Key": participantKey },
	});
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
