import { z } from "zod";

/** Matches the backend's Mode enum exactly (com.ssu.unithon.call.domain.Mode) — DEAF types, HEARING speaks. */
export const callModeSchema = z.enum(["DEAF", "HEARING"]);
export type CallMode = z.infer<typeof callModeSchema>;

export const roomCodeSchema = z.string().regex(/^[A-Za-z0-9_-]{3,40}$/);

export const callParamsSchema = z.object({
	room: roomCodeSchema,
	mode: callModeSchema,
});
export type CallParams = z.infer<typeof callParamsSchema>;

/** Matches the backend's CallStatus enum (com.ssu.unithon.call.domain.CallStatus). */
export const callStatusSchema = z.enum(["CREATED", "RINGING", "ACTIVE", "REJECTED", "ENDED"]);
export type CallStatus = z.infer<typeof callStatusSchema>;

/**
 * Matches the backend's Role enum (com.ssu.unithon.call.domain.Role): whoever's slot was
 * created first for a call is the CALLER (waits), the other is the CALLEE (answers).
 */
export const callRoleSchema = z.enum(["CALLER", "CALLEE"]);
export type CallRole = z.infer<typeof callRoleSchema>;

/** No LiveKit token yet -- that's only issued once the call reaches ACTIVE, via `acceptCall`/`getCallStatus`. */
export const joinResultSchema = z.object({
	callId: z.string(),
	roomCode: z.string(),
	identity: z.string(),
	mode: callModeSchema,
	status: callStatusSchema,
	role: callRoleSchema,
});
export type JoinResult = z.infer<typeof joinResultSchema>;

export const statusResultSchema = z.object({
	status: callStatusSchema,
	livekitUrl: z.string(),
	token: z.string().nullable(),
});
export type StatusResult = z.infer<typeof statusResultSchema>;
