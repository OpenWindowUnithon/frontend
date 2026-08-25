import { z } from "zod";

/** Matches the backend's Mode enum exactly (com.ssu.unithon.call.domain.Mode) — DEAF types, HEARING speaks. */
export const callModeSchema = z.enum(["DEAF", "HEARING"]);
export type CallMode = z.infer<typeof callModeSchema>;

export const communicationModeSchema = z.enum(["TEXT", "SIGN"]);
export type CommunicationMode = z.infer<typeof communicationModeSchema>;

export const callStatusSchema = z.enum(["CREATED", "RINGING", "ACTIVE", "REJECTED", "ENDED"]);
export type CallStatus = z.infer<typeof callStatusSchema>;

export const callRoleSchema = z.enum(["CALLER", "CALLEE"]);
export type CallRole = z.infer<typeof callRoleSchema>;

export const callParamsSchema = z.object({
	room: z.string().min(1),
	mode: callModeSchema,
	communication: communicationModeSchema.optional().default("TEXT"),
	contactName: z.string().optional().default("예약할 매장"),
	phone: z.string().optional().default("010-1234-5678"),
});
export type CallParams = z.infer<typeof callParamsSchema>;

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
	livekitUrl: z.string().nullish(),
	token: z.string().nullish(),
	identity: z.string().nullish(),
	mode: callModeSchema.nullish(),
});
export type StatusResult = z.infer<typeof statusResultSchema>;

export const outgoingCallSchema = z.object({
	callId: z.string(),
	roomCode: z.string(),
	status: z.literal("RINGING"),
	role: z.literal("CALLER"),
});
export type OutgoingCall = z.infer<typeof outgoingCallSchema>;

export const incomingCallSchema = z.object({
	callId: z.string(),
	roomCode: z.string(),
	callerPhone: z.string(),
	calleePhone: z.string(),
	callerMode: callModeSchema,
	status: z.literal("RINGING"),
	createdAt: z.string(),
});
export type IncomingCall = z.infer<typeof incomingCallSchema>;
