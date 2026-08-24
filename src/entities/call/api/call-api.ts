import { z } from "zod";

const tokenResponseSchema = z.object({ token: z.string() });

/**
 * Mints a LiveKit room token via functions/api/livekit-token.ts. Plain `fetch`,
 * not `apiClient` — this hits a same-origin Cloudflare Pages Function, not the
 * VITE_API_BASE_URL backend `apiClient` is configured for.
 */
export async function fetchLiveKitToken(room: string, identity: string): Promise<string> {
	const response = await fetch("/api/livekit-token", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ room, identity }),
	});
	if (!response.ok) {
		throw new Error(`Failed to fetch LiveKit token: ${response.status}`);
	}
	const { token } = tokenResponseSchema.parse(await response.json());
	return token;
}
