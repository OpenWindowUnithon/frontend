import type { Room } from "livekit-client";
import { useEffect, useState } from "react";
import { publishCaption } from "@/entities/caption";
import { fetchRealtimeClientSecret } from "@/entities/realtime-session";
import { type RealtimeStatus, useOpenAIRealtime } from "@/shared/lib";

const INSTRUCTIONS =
	"당신은 텍스트 음성 변환 도우미입니다. 사용자가 보낸 메시지를 그대로, 추가 설명이나 대답 없이 소리 내어 읽기만 하세요.";

/**
 * Connects this listener's mic directly to OpenAI Realtime (STT), and exposes
 * `speak` so the widget can feed in the signer's recognized text (TTS) — both
 * directions share one session, see shared/lib/use-openai-realtime.ts.
 */
export function useVoiceTranscribe(room: Room | null) {
	const [clientSecret, setClientSecret] = useState<string | null>(null);
	const [secretError, setSecretError] = useState(false);

	useEffect(() => {
		if (!room) return;
		fetchRealtimeClientSecret()
			.then(setClientSecret)
			.catch(() => setSecretError(true));
	}, [room]);

	const { status, remoteStream, speak } = useOpenAIRealtime({
		clientSecret,
		instructions: INSTRUCTIONS,
		onTranscript: (text) => {
			if (!room) return;
			publishCaption(room, {
				id: crypto.randomUUID(),
				text,
				sourceRole: "listener",
				timestamp: Date.now(),
			});
		},
	});

	const effectiveStatus: RealtimeStatus = secretError ? "error" : status;

	return { status: effectiveStatus, remoteStream, speak };
}
