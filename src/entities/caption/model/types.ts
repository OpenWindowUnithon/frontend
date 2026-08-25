import { z } from "zod";

/**
 * One caption from the backend agent's live transcription of the HEARING
 * participant's speech (`lk.transcription` topic). `id` is the agent's
 * segment id — the same id repeats with updated `text` while interim, then
 * arrives once more with `final: true`.
 */
export const captionSchema = z.object({
	id: z.string(),
	text: z.string(),
	final: z.boolean(),
});
export type CaptionType = z.infer<typeof captionSchema>;
