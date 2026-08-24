import { z } from "zod";

/**
 * A single translated message flowing over the call's data channel — either a
 * recognized sign or a voice transcript. `sourceRole` intentionally re-states
 * entities/call's role enum rather than importing it — entities may not
 * cross-import each other (see steiger's fsd/no-cross-imports).
 */
export const captionSchema = z.object({
	id: z.string(),
	text: z.string().min(1),
	sourceRole: z.enum(["signer", "listener"]),
	timestamp: z.number(),
});
export type Caption = z.infer<typeof captionSchema>;
