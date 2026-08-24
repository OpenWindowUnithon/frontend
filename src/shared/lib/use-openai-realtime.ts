import { useCallback, useEffect, useRef, useState } from "react";

const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
const DATA_CHANNEL_NAME = "oai-events";

export type RealtimeStatus = "idle" | "connecting" | "connected" | "error";

interface UseOpenAIRealtimeOptions {
	/** Ephemeral client secret from entities/realtime-session's api — null until fetched. */
	clientSecret: string | null;
	/** System instructions for this session, e.g. "repeat any message you receive verbatim, in Korean." */
	instructions: string;
	onTranscript?: (text: string) => void;
}

interface UseOpenAIRealtimeResult {
	status: RealtimeStatus;
	/** Attach to an `<audio autoPlay>` element's `srcObject` to hear synthesized speech. */
	remoteStream: MediaStream | null;
	/** Asks the session to speak `text` aloud. See instructions above for how it's made to say it verbatim. */
	speak: (text: string) => void;
}

/**
 * Opens a direct browser↔OpenAI Realtime WebRTC connection (per
 * https://developers.openai.com/api/docs/guides/realtime-webrtc). Handles both
 * directions of this app's voice/text bridge: live transcription of the mic
 * (`conversation.item.input_audio_transcription.completed`) and speaking
 * injected text back via {@link speak}.
 *
 * `create_response: false` on turn_detection stops the model from replying to
 * the caller's own speech — we only ever want it to speak text we inject.
 */
export function useOpenAIRealtime({
	clientSecret,
	instructions,
	onTranscript,
}: UseOpenAIRealtimeOptions): UseOpenAIRealtimeResult {
	const [status, setStatus] = useState<RealtimeStatus>("idle");
	const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
	const dcRef = useRef<RTCDataChannel | null>(null);
	const onTranscriptRef = useRef(onTranscript);
	onTranscriptRef.current = onTranscript;

	useEffect(() => {
		if (!clientSecret) return;

		let cancelled = false;
		const pc = new RTCPeerConnection();

		pc.ontrack = (event) => {
			if (!cancelled) setRemoteStream(event.streams[0] ?? null);
		};

		const dc = pc.createDataChannel(DATA_CHANNEL_NAME);
		dcRef.current = dc;
		dc.addEventListener("open", () => {
			dc.send(
				JSON.stringify({
					type: "session.update",
					session: {
						instructions,
						turn_detection: { type: "server_vad", create_response: false },
					},
				}),
			);
		});
		dc.addEventListener("message", (event) => {
			const data = JSON.parse(event.data);
			if (
				data.type === "conversation.item.input_audio_transcription.completed" &&
				data.transcript
			) {
				onTranscriptRef.current?.(data.transcript);
			}
		});

		setStatus("connecting");

		(async () => {
			const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
			for (const track of mic.getTracks()) {
				pc.addTrack(track, mic);
			}

			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);

			const response = await fetch(REALTIME_CALLS_URL, {
				method: "POST",
				body: offer.sdp,
				headers: {
					Authorization: `Bearer ${clientSecret}`,
					"Content-Type": "application/sdp",
				},
			});
			if (!response.ok) {
				throw new Error(`OpenAI Realtime handshake failed: ${response.status}`);
			}
			await pc.setRemoteDescription({ type: "answer", sdp: await response.text() });

			if (!cancelled) setStatus("connected");
		})().catch(() => {
			if (!cancelled) setStatus("error");
		});

		return () => {
			cancelled = true;
			dcRef.current = null;
			pc.close();
		};
	}, [clientSecret, instructions]);

	const speak = useCallback((text: string) => {
		const dc = dcRef.current;
		if (dc?.readyState !== "open") return;
		dc.send(
			JSON.stringify({
				type: "conversation.item.create",
				item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
			}),
		);
		dc.send(JSON.stringify({ type: "response.create" }));
	}, []);

	return { status, remoteStream, speak };
}
