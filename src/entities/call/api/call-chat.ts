import type { Room } from "livekit-client";
import { sendRoomText } from "@/shared/lib";
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
