import type { Room } from "livekit-client";
import { useCallback, useState } from "react";
import { fetchLiveKitToken } from "@/entities/call";
import { env } from "@/shared/config";
import { connectRoom } from "@/shared/lib";

type JoinCallStatus = "idle" | "connecting" | "connected" | "error";

interface JoinCallState {
	room: Room | null;
	status: JoinCallStatus;
}

/** Fetches a LiveKit room token and connects — the room is used for presence + the data channel only. */
export function useJoinCall() {
	const [state, setState] = useState<JoinCallState>({ room: null, status: "idle" });

	const join = useCallback(async (roomName: string, identity: string) => {
		setState({ room: null, status: "connecting" });
		try {
			const token = await fetchLiveKitToken(roomName, identity);
			const room = await connectRoom(env.VITE_LIVEKIT_URL, token);
			setState({ room, status: "connected" });
		} catch {
			setState({ room: null, status: "error" });
		}
	}, []);

	return { ...state, join };
}
