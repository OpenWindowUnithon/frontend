import type { Room } from "livekit-client";
import { sendRoomText } from "@/shared/lib";

const CHAT_TOPIC = "lk.chat";

/** Sends text for the backend agent to speak aloud verbatim to the HEARING participant. */
export function sendChatText(room: Room, text: string) {
	return sendRoomText(room, CHAT_TOPIC, text);
}
