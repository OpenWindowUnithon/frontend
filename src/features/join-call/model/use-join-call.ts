import axios from "axios";
import { type Room, RoomEvent } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type CallMode,
	createCall,
	disconnectCall,
	endCall,
	joinCall,
	sendHeartbeat,
} from "@/entities/call";
import { connectRoom } from "@/shared/lib";
import { getOrCreateSessionKey } from "./session-keys";

type JoinCallStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

interface JoinCallState {
	room: Room | null;
	status: JoinCallStatus;
	callId: string | null;
}

interface JoinParams {
	roomCode: string;
	mode: CallMode;
	isCreator: boolean;
}

const HEARTBEAT_INTERVAL_MS = 10_000;
const RETRY_DELAY_MS = 5_000;
const MAX_RETRIES = 6;

/**
 * Joins a call room per the backend's contract: create (DEAF only) → join →
 * connect to LiveKit → heartbeat every 10s (the server's participant lease
 * expires without it) → on an unexpected disconnect, retry joining for up to
 * 30s (matching the lease window) before giving up.
 *
 * `generationRef` guards every async step (connect/retry/heartbeat/the
 * Disconnected handler) against acting after a newer `join()` call has
 * superseded them. Without it, two Rooms connecting with the same identity
 * (e.g. React StrictMode's double effect invocation in dev) kick each other
 * off and reconnect forever — each side's stale retry loop fights the other.
 */
export function useJoinCall() {
	const [state, setState] = useState<JoinCallState>({ room: null, status: "idle", callId: null });
	const stateRef = useRef(state);
	stateRef.current = state;
	const paramsRef = useRef<JoinParams | null>(null);
	const heartbeatRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
	const manualLeaveRef = useRef(false);
	const generationRef = useRef(0);

	const isCurrent = (generation: number) =>
		generation === generationRef.current && !manualLeaveRef.current;

	const stopHeartbeat = () => {
		clearInterval(heartbeatRef.current);
		heartbeatRef.current = undefined;
	};

	// "connected" on success; "retry" for anything that might resolve itself
	// (network blip, transient 5xx); "fatal" for errors retrying can't fix
	// (4xx — bad room code, rejected mode, etc.) so we can fail fast instead of
	// burning the full 30s retry window on something that will never succeed.
	async function connect(
		params: JoinParams,
		isRetry: boolean,
		generation: number,
	): Promise<"connected" | "retry" | "fatal"> {
		if (!isCurrent(generation)) return "retry";
		setState((prev) => ({ ...prev, status: isRetry ? "reconnecting" : "connecting" }));
		try {
			const { roomCode, mode, isCreator } = params;
			const participantKey = getOrCreateSessionKey("participant", roomCode);
			if (isCreator) {
				await createCall(roomCode, getOrCreateSessionKey("creator", roomCode));
			}
			const result = await joinCall(roomCode, mode, participantKey);
			const room = await connectRoom(result.livekitUrl, result.token);

			if (!isCurrent(generation)) {
				room.disconnect();
				return "retry";
			}

			room.once(RoomEvent.Disconnected, () => {
				if (!isCurrent(generation)) return;
				stopHeartbeat();
				void retryLoop(generation);
			});

			stopHeartbeat();
			heartbeatRef.current = setInterval(() => {
				if (isCurrent(generation)) sendHeartbeat(result.callId, participantKey).catch(() => {});
			}, HEARTBEAT_INTERVAL_MS);

			setState({ room, status: "connected", callId: result.callId });
			return "connected";
		} catch (error) {
			console.error("[join-call] connect failed", error);
			const status = axios.isAxiosError(error) ? error.response?.status : undefined;
			return status !== undefined && status < 500 ? "fatal" : "retry";
		}
	}

	// Waits out one retry delay, then attempts a connect — pulled out of
	// retryLoop purely to keep that function's cognitive complexity in check.
	async function retryOnce(
		params: JoinParams,
		generation: number,
	): Promise<"connected" | "retry" | "fatal" | "stale"> {
		await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
		if (!isCurrent(generation)) return "stale";
		return connect(params, true, generation);
	}

	async function retryLoop(generation: number): Promise<void> {
		const params = paramsRef.current;
		if (!isCurrent(generation) || !params) return;
		setState((prev) => ({ ...prev, room: null, status: "reconnecting" }));

		for (let attempt = 0; attempt < MAX_RETRIES && isCurrent(generation); attempt += 1) {
			const result = await retryOnce(params, generation);
			if (result === "connected" || result === "stale") return;
			if (result === "fatal") break;
		}
		if (isCurrent(generation)) setState({ room: null, status: "error", callId: null });
	}

	// connect/retryLoop/stopHeartbeat/isCurrent are refs-and-setState-only closures
	// declared in this hook's body, not reactive values — stable by construction, so
	// the empty dep array is intentional.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
	const join = useCallback(async (roomCode: string, mode: CallMode, isCreator: boolean) => {
		generationRef.current += 1;
		const generation = generationRef.current;
		manualLeaveRef.current = false;
		stopHeartbeat();
		stateRef.current.room?.disconnect();

		const params = { roomCode, mode, isCreator };
		paramsRef.current = params;
		setState({ room: null, status: "connecting", callId: null });
		const result = await connect(params, false, generation);
		if (result === "retry") void retryLoop(generation);
		else if (result === "fatal" && isCurrent(generation)) {
			setState({ room: null, status: "error", callId: null });
		}
	}, []);

	// Explicit user-initiated leave. Mark it manual before disconnecting so the
	// RoomEvent.Disconnected handler cannot start the retry loop again.
	// biome-ignore lint/correctness/useExhaustiveDependencies: stopHeartbeat is a refs-only closure
	const leave = useCallback(async () => {
		manualLeaveRef.current = true;
		stopHeartbeat();

		const params = paramsRef.current;
		const { room, callId } = stateRef.current;
		try {
			if (params && callId) {
				await (params.isCreator
					? endCall(callId, getOrCreateSessionKey("creator", params.roomCode))
					: disconnectCall(callId, getOrCreateSessionKey("participant", params.roomCode)));
			}
			generationRef.current += 1;
			stateRef.current = { room: null, status: "idle", callId: null };
			room?.disconnect();
		} catch (error) {
			manualLeaveRef.current = false;
			if (params && callId) {
				const participantKey = getOrCreateSessionKey("participant", params.roomCode);
				heartbeatRef.current = setInterval(() => {
					sendHeartbeat(callId, participantKey).catch(() => {});
				}, HEARTBEAT_INTERVAL_MS);
			}
			throw error;
		}
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: see comment above join
	useEffect(() => {
		return () => {
			generationRef.current += 1;
			manualLeaveRef.current = true;
			stopHeartbeat();
			const params = paramsRef.current;
			const { room, callId } = stateRef.current;
			if (params && callId) {
				const notifyServer = params.isCreator
					? endCall(callId, getOrCreateSessionKey("creator", params.roomCode))
					: disconnectCall(callId, getOrCreateSessionKey("participant", params.roomCode));
				notifyServer.catch(() => {});
			}
			room?.disconnect();
		};
	}, []);

	return { ...state, join, leave };
}
