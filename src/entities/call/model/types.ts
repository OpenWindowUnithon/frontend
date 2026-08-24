import { z } from "zod";

export const callRoleSchema = z.enum(["signer", "listener"]);
export type CallRole = z.infer<typeof callRoleSchema>;

export const callParamsSchema = z.object({
	room: z.string().min(1),
	role: callRoleSchema,
});
export type CallParams = z.infer<typeof callParamsSchema>;
