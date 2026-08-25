import { z } from "zod";

/** Matches the backend's Mode enum exactly (com.ssu.unithon.call.domain.Mode) — DEAF types, HEARING speaks. */
export const callModeSchema = z.enum(["DEAF", "HEARING"]);
export type CallMode = z.infer<typeof callModeSchema>;

export const communicationModeSchema = z.enum(["TEXT", "SIGN"]);
export type CommunicationMode = z.infer<typeof communicationModeSchema>;

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
	livekitUrl: z.string(),
	identity: z.string(),
	mode: callModeSchema,
	token: z.string(),
});
export type JoinResult = z.infer<typeof joinResultSchema>;
