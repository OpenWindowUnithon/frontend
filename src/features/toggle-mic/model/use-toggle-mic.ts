import { createLocalAudioTrack, type LocalAudioTrack, type Room } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";

export type MicState = "off" | "on" | "muted";

/** Publishes/mutes the local mic track on first use — matches the backend token grant (HEARING only can publish). */
export function useToggleMic(room: Room | null) {
	const [state, setState] = useState<MicState>("off");
	const trackRef = useRef<LocalAudioTrack | null>(null);

	const toggle = useCallback(async () => {
		if (!room) return;
		try {
			if (!trackRef.current) {
				const track = await createLocalAudioTrack({
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				});
				await room.localParticipant.publishTrack(track);
				trackRef.current = track;
				setState("on");
			} else if (trackRef.current.isMuted) {
				await trackRef.current.unmute();
				setState("on");
			} else {
				await trackRef.current.mute();
				setState("muted");
			}
		} catch {
			setState("off");
		}
	}, [room]);

	useEffect(() => {
		return () => {
			trackRef.current?.stop();
		};
	}, []);

	return { state, toggle };
}
