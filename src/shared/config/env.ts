import { z } from "zod";

const envSchema = z.object({
	// Empty string is valid — apiClient then targets the current origin, which
	// `vite dev`'s /api proxy (vite.config.ts) forwards to the backend without
	// hitting its (currently missing) CORS config.
	VITE_API_BASE_URL: z.union([z.string().url(), z.literal("")]).default(""),
});

/** Validated env vars. Throws at startup if `.env` is missing or malformed. */
export const env = envSchema.parse(import.meta.env);
