import { z } from "zod";

/** Matches the backend's Mode enum exactly (com.ssu.unithon.call.domain.Mode) — DEAF types, HEARING speaks. */
export const callModeSchema = z.enum(["DEAF", "HEARING"]);
export type CallMode = z.infer<typeof callModeSchema>;

export const callParamsSchema = z.object({
	room: z.string().min(1),
	mode: callModeSchema,
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
