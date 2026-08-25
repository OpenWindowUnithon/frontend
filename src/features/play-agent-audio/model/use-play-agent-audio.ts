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

		// The agent's track may already be subscribed by the time this effect
		// runs (React state propagation lags the LiveKit connection) — catch up
		// on already-subscribed publications before listening for future ones.
		for (const participant of room.remoteParticipants.values()) {
			for (const publication of participant.trackPublications.values()) {
				if (publication.track) onTrackSubscribed(publication.track, publication);
			}
		}

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
