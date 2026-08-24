import { z } from "zod";

const sessionResponseSchema = z.object({ clientSecret: z.string() });

/**
 * Mints an OpenAI Realtime ephemeral client secret via
 * functions/api/openai-realtime-session.ts. Plain `fetch`, same reasoning as
 * entities/call's fetchLiveKitToken — this is a same-origin Pages Function,
 * not the `apiClient` backend.
 */
export async function fetchRealtimeClientSecret(): Promise<string> {
	const response = await fetch("/api/openai-realtime-session", { method: "POST" });
	if (!response.ok) {
		throw new Error(`Failed to fetch OpenAI Realtime session: ${response.status}`);
	}
	const { clientSecret } = sessionResponseSchema.parse(await response.json());
	return clientSecret;
}
