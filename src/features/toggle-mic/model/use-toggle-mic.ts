import {
	createLocalAudioTrack,
	LocalAudioTrack,
	type Room,
	RoomEvent,
	Track,
} from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";

export type MicState = "off" | "on";

/** Starts the HEARING participant's mic when the call opens, then lets them mute/unmute it. */
export function useToggleMic(room: Room | null) {
	const [state, setState] = useState<MicState>("off");
	const trackRef = useRef<LocalAudioTrack | null>(null);
	const powerOperationRef = useRef<Promise<void>>(Promise.resolve());
	const autoStartedRoomRef = useRef<Room | null>(null);
	const syncWithRoom = useCallback(() => {
		if (!room) {
			trackRef.current = null;
			setState("off");
			return;
		}
		const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
		const track = publication?.track;
		if (!(track instanceof LocalAudioTrack) || track.mediaStreamTrack.readyState !== "live") {
			trackRef.current = null;
			setState("off");
			return;
		}
		trackRef.current = track;
		setState("on");
	}, [room]);

	const togglePower = useCallback(() => {
		if (!room) return Promise.resolve();
		const operation = powerOperationRef.current
			.catch(() => {})
			.then(async () => {
				let createdTrack: LocalAudioTrack | null = null;
				try {
					if (trackRef.current) {
						const track = trackRef.current;
						await room.localParticipant.unpublishTrack(track);
						track.stop();
						trackRef.current = null;
						setState("off");
					} else {
						const track = await createLocalAudioTrack({
							echoCancellation: true,
							noiseSuppression: true,
							autoGainControl: true,
						});
						createdTrack = track;
						await room.localParticipant.publishTrack(track);
						trackRef.current = track;
						setState("on");
					}
				} catch {
					createdTrack?.stop();
					syncWithRoom();
				}
			});
		powerOperationRef.current = operation;
		return operation;
	}, [room, syncWithRoom]);

	useEffect(() => {
		syncWithRoom();
		if (!room) return;
		room.on(RoomEvent.LocalTrackPublished, syncWithRoom);
		room.on(RoomEvent.LocalTrackUnpublished, syncWithRoom);
		if (autoStartedRoomRef.current !== room) {
			autoStartedRoomRef.current = room;
			void togglePower();
		}

		return () => {
			room.off(RoomEvent.LocalTrackPublished, syncWithRoom);
			room.off(RoomEvent.LocalTrackUnpublished, syncWithRoom);
			trackRef.current?.stop();
		};
	}, [room, syncWithRoom, togglePower]);

	return { state, togglePower };
}
