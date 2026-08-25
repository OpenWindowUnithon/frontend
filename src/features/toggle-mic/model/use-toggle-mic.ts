import {
	createLocalAudioTrack,
	LocalAudioTrack,
	type Room,
	RoomEvent,
	Track,
} from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";

export type MicState = "off" | "on" | "muted";

/** Publishes/mutes the local mic track on first use — matches the backend token grant (HEARING only can publish). */
export function useToggleMic(room: Room | null) {
	const [state, setState] = useState<MicState>("off");
	const trackRef = useRef<LocalAudioTrack | null>(null);
	const powerOperationRef = useRef<Promise<void>>(Promise.resolve());
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
		setState(track.isMuted ? "muted" : "on");
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

	const toggleMute = useCallback(async () => {
		const track = trackRef.current;
		if (!track) return;
		if (track.isMuted) {
			await track.unmute();
			setState("on");
		} else {
			await track.mute();
			setState("muted");
		}
	}, []);

	useEffect(() => {
		syncWithRoom();
		if (!room) return;
		room.on(RoomEvent.LocalTrackPublished, syncWithRoom);
		room.on(RoomEvent.LocalTrackUnpublished, syncWithRoom);
		room.on(RoomEvent.TrackMuted, syncWithRoom);
		room.on(RoomEvent.TrackUnmuted, syncWithRoom);

		return () => {
			room.off(RoomEvent.LocalTrackPublished, syncWithRoom);
			room.off(RoomEvent.LocalTrackUnpublished, syncWithRoom);
			room.off(RoomEvent.TrackMuted, syncWithRoom);
			room.off(RoomEvent.TrackUnmuted, syncWithRoom);
			trackRef.current?.stop();
		};
	}, [room, syncWithRoom]);

	return { state, togglePower, toggleMute };
}
