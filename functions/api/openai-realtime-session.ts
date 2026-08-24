interface Env {
	OPENAI_API_KEY: string;
	OPENAI_REALTIME_MODEL: string;
}

/**
 * Mints a short-lived OpenAI Realtime client secret so the browser can open
 * a WebRTC connection directly to OpenAI without ever seeing OPENAI_API_KEY.
 * https://developers.openai.com/api/docs/guides/realtime-webrtc
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
	const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${context.env.OPENAI_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			session: {
				type: "realtime",
				model: context.env.OPENAI_REALTIME_MODEL,
				audio: {
					output: { voice: "marin" },
					input: { transcription: { model: "gpt-4o-transcribe" } },
				},
			},
		}),
	});

	if (!response.ok) {
		return Response.json({ error: await response.text() }, { status: response.status });
	}

	const data = (await response.json()) as { value: string };
	return Response.json({ clientSecret: data.value });
};
