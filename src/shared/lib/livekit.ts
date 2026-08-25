import { Room } from "livekit-client";

/** Connects to a LiveKit room. The backend's Python agent joins automatically (see room dispatch config). */
export async function connectRoom(url: string, token: string): Promise<Room> {
	const room = new Room();
	await room.connect(url, token);
	return room;
}

/** Sends text on a topic via LiveKit's text stream API (not a raw data channel — matches the backend agent's contract). */
export function sendRoomText(room: Room, topic: string, text: string) {
	return room.localParticipant.sendText(text, { topic });
}

/** Subscribes to text sent on a topic. Returns an unsubscribe function. */
export function onRoomText(
	room: Room,
	topic: string,
	handler: (text: string, attributes: Record<string, string>) => void,
): () => void {
	room.registerTextStreamHandler(topic, async (reader) => {
		handler(await reader.readAll(), reader.info.attributes ?? {});
	});
	return () => room.unregisterTextStreamHandler(topic);
}
