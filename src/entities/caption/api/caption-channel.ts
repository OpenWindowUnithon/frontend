import type { Room } from "livekit-client";
import { onRoomText } from "@/shared/lib";
import type { CaptionType } from "../model/types";

const TRANSCRIPTION_TOPIC = "lk.transcription";

/**
 * Subscribes to the backend agent's live captions of the HEARING participant's
 * speech. Fires once per interim update (same `id`, growing `text`) and once
 * more with `final: true`. Returns an unsubscribe function.
 */
export function subscribeToCaptions(
	room: Room,
	onCaption: (caption: CaptionType) => void,
): () => void {
	return onRoomText(room, TRANSCRIPTION_TOPIC, (text, attributes) => {
		const id = attributes["lk.segment_id"];
		if (!id) return;
		onCaption({ id, text, final: attributes["lk.transcription_final"] === "true" });
	});
}
