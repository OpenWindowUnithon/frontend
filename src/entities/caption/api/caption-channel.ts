import type { Room } from "livekit-client";
import { onRoomData, sendRoomData } from "@/shared/lib";
import { type Caption, captionSchema } from "../model/types";

export function publishCaption(room: Room, caption: Caption) {
	sendRoomData(room, caption);
}

/** Subscribes to captions sent by the other participant. Returns an unsubscribe function. */
export function subscribeToCaptions(room: Room, onCaption: (caption: Caption) => void): () => void {
	return onRoomData(room, (payload) => {
		const result = captionSchema.safeParse(payload);
		if (result.success) {
			onCaption(result.data);
		}
	});
}
