import {
	type RemoteTrack,
	type RemoteTrackPublication,
	type Room,
	RoomEvent,
	Track,
} from "livekit-client";
import { useEffect, useRef, useState } from "react";

const AGENT_AUDIO_TRACK_NAME = "accessibility-agent-audio";

/** Attaches the backend agent's synthesized-speech track to an `<audio>` element as soon as it's subscribed. */
export function usePlayAgentAudio(room: Room | null) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const [needsPlayTap, setNeedsPlayTap] = useState(false);

	useEffect(() => {
		if (!room) return;

		const onTrackSubscribed = (track: RemoteTrack, publication: RemoteTrackPublication) => {
			if (track.kind !== Track.Kind.Audio || publication.trackName !== AGENT_AUDIO_TRACK_NAME)
				return;
			const element = audioRef.current;
			if (!element) return;
			track.attach(element);
			element.play().catch(() => setNeedsPlayTap(true));
		};

		room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
		return () => {
			room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
		};
	}, [room]);

	const retryPlay = () => {
		audioRef.current
			?.play()
			.then(() => setNeedsPlayTap(false))
			.catch(() => {});
	};

	return { audioRef, needsPlayTap, retryPlay };
}
