import type { Room } from "livekit-client";
import { onRoomText, sendRoomText } from "@/shared/lib";
import { getCallPreferences } from "../model/call-preferences";

const CHAT_TOPIC = "lk.chat";

/** Sends text for the backend agent to speak aloud verbatim to the HEARING participant. */
export function sendChatText(room: Room, text: string) {
	const preferences = getCallPreferences();
	return sendRoomText(room, CHAT_TOPIC, text, {
		"openwindow.voice": preferences.aiVoice,
		"openwindow.voice_speed": preferences.aiVoiceSpeed,
	});
}

/**
 * Subscribes to the text the DEAF participant sends for the agent to speak aloud (same
 * `lk.chat` topic `sendChatText` publishes to, which is room-broadcast, not addressed only
 * to the agent). Lets the HEARING participant's own screen show it as text alongside hearing
 * the synthesized audio, instead of relying on audio alone. Each message arrives whole (no
 * interim/final split like transcription captions), so every call is one complete message.
 */
export function subscribeToChatText(room: Room, onText: (text: string) => void): () => void {
	return onRoomText(room, CHAT_TOPIC, (text) => onText(text));
}
