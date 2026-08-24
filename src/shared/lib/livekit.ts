import { Room, RoomEvent } from "livekit-client";

/** Connects to a LiveKit room for presence + the data channel only — no audio/video tracks are published. */
export async function connectRoom(url: string, token: string): Promise<Room> {
	const room = new Room();
	await room.connect(url, token);
	return room;
}

/** Broadcasts a JSON-serializable payload to every other participant in the room. */
export function sendRoomData(room: Room, payload: unknown) {
	const bytes = new TextEncoder().encode(JSON.stringify(payload));
	room.localParticipant.publishData(bytes, { reliable: true });
}

/** Subscribes to JSON payloads sent via {@link sendRoomData}. Returns an unsubscribe function. */
export function onRoomData(room: Room, handler: (payload: unknown) => void): () => void {
	const listener = (payload: Uint8Array) => {
		handler(JSON.parse(new TextDecoder().decode(payload)));
	};
	room.on(RoomEvent.DataReceived, listener);
	return () => {
		room.off(RoomEvent.DataReceived, listener);
	};
}
