import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { type Room, RoomEvent } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	acceptCall,
	type CallMode,
	type CallRole,
	createCall,
	disconnectCall,
	getCallStatus,
	joinCall,
	rejectCall,
	sendHeartbeat,
} from "@/entities/call";
import { connectRoom } from "@/shared/lib";
import { getOrCreateSessionKey } from "./session-keys";

type JoinCallStatus =
	| "idle"
	| "connecting"
	| "ringing"
	| "connected"
	| "reconnecting"
	| "rejected"
	| "error";

interface JoinCallState {
	room: Room | null;
	status: JoinCallStatus;
	callId: string | null;
	role: CallRole | null;
}

interface JoinParams {
	roomCode: string;
	mode: CallMode;
	isCreator: boolean;
}

const HEARTBEAT_INTERVAL_MS = 10_000;
const RETRY_DELAY_MS = 5_000;
const MAX_RETRIES = 6;
const RINGING_POLL_MS = 1_500;

/**
 * Joins a call room per the backend's ring-then-accept contract: create (DEAF only) → join
 * (reserves a slot, no LiveKit token yet — reports RINGING plus a CALLER/CALLEE role) →
 * poll `/status` every 1.5s (the CALLEE may instead call `accept()` directly) → once ACTIVE,
 * connect to LiveKit → heartbeat every 10s. On an unexpected disconnect, rejoin and re-enter
 * the ringing/poll cycle — the backend reuses the existing slot and is almost always already
 * ACTIVE by then, so this resolves in one poll — retrying for up to 30s before giving up.
 *
 * `generationRef` guards every async step (poll reaction/connect/retry/heartbeat/the
 * Disconnected handler) against acting after a newer `join()` call has superseded them.
 * Without it, two Rooms connecting with the same identity (e.g. React StrictMode's double
 * effect invocation in dev) kick each other off and reconnect forever.
 */
export function useJoinCall() {
	const [state, setState] = useState<JoinCallState>({
		room: null,
		status: "idle",
		callId: null,
		role: null,
	});
	const stateRef = useRef(state);
	stateRef.current = state;
	const paramsRef = useRef<JoinParams | null>(null);
	const participantKeyRef = useRef<string | null>(null);
	const heartbeatRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
	const manualLeaveRef = useRef(false);
	const connectingRef = useRef(false);
	const generationRef = useRef(0);

	const isCurrent = (generation: number) =>
		generation === generationRef.current && !manualLeaveRef.current;

	const stopHeartbeat = () => {
		clearInterval(heartbeatRef.current);
		heartbeatRef.current = undefined;
	};

	async function connectToLiveKit(
		livekitUrl: string,
		token: string,
		callId: string,
		role: CallRole,
		generation: number,
	) {
		if (!isCurrent(generation) || connectingRef.current) return;
		connectingRef.current = true;
		try {
			const room = await connectRoom(livekitUrl, token);
			if (!isCurrent(generation)) {
				room.disconnect();
				return;
			}

			room.once(RoomEvent.Disconnected, () => {
				if (!isCurrent(generation)) return;
				stopHeartbeat();
				void retryLoop(generation);
			});

			stopHeartbeat();
			heartbeatRef.current = setInterval(() => {
				const participantKey = participantKeyRef.current;
				if (isCurrent(generation) && participantKey) {
					sendHeartbeat(callId, participantKey).catch(() => {});
				}
			}, HEARTBEAT_INTERVAL_MS);

			setState({ room, status: "connected", callId, role });
		} finally {
			connectingRef.current = false;
		}
	}

	// Reserves the participant slot and moves to "ringing" (or straight to "rejected" if this
	// room code's call was already declined/ended). Split out of doJoin purely to keep that
	// function's cognitive complexity in check.
	async function performJoin(params: JoinParams, generation: number): Promise<void> {
		const { roomCode, mode, isCreator } = params;
		const participantKey = getOrCreateSessionKey("participant", roomCode);
		participantKeyRef.current = participantKey;
		if (isCreator) {
			await createCall(roomCode, getOrCreateSessionKey("creator", roomCode));
		}
		const result = await joinCall(roomCode, mode, participantKey);
		if (!isCurrent(generation)) {
			const current = paramsRef.current;
			const replacedBySameJoin =
				!manualLeaveRef.current && current?.roomCode === roomCode && current.mode === mode;
			if (!replacedBySameJoin) await rejectCall(result.callId, participantKey).catch(() => {});
			return;
		}

		const status =
			result.status === "REJECTED" || result.status === "ENDED" ? "rejected" : "ringing";
		setState({ room: null, status, callId: result.callId, role: result.role });
	}

	// "joined" on success (now ringing, not yet connected to LiveKit); "retry" for anything
	// that might resolve itself (network blip, transient 5xx); "fatal" for errors retrying
	// can't fix (4xx — bad room code, rejected mode, etc.) so we can fail fast instead of
	// burning the full retry window on something that will never succeed.
	async function doJoin(
		params: JoinParams,
		isRetry: boolean,
		generation: number,
	): Promise<"joined" | "retry" | "fatal"> {
		if (!isCurrent(generation)) return "retry";
		setState((prev) => ({ ...prev, status: isRetry ? "reconnecting" : "connecting" }));
		try {
			await performJoin(params, generation);
			return "joined";
		} catch (error) {
			console.error("[join-call] join failed", error);
			const httpStatus = axios.isAxiosError(error) ? error.response?.status : undefined;
			return httpStatus !== undefined && httpStatus < 500 ? "fatal" : "retry";
		}
	}

	// Waits out one retry delay, then attempts a join — pulled out of retryLoop purely to
	// keep that function's cognitive complexity in check.
	async function retryOnce(
		params: JoinParams,
		generation: number,
	): Promise<"joined" | "retry" | "fatal" | "stale"> {
		await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
		if (!isCurrent(generation)) return "stale";
		return doJoin(params, true, generation);
	}

	async function retryLoop(generation: number): Promise<void> {
		const params = paramsRef.current;
		if (!isCurrent(generation) || !params) return;
		setState((prev) => ({ ...prev, room: null, status: "reconnecting" }));

		for (let attempt = 0; attempt < MAX_RETRIES && isCurrent(generation); attempt += 1) {
			const result = await retryOnce(params, generation);
			if (result === "joined" || result === "stale") return;
			if (result === "fatal") break;
		}
		if (isCurrent(generation)) setState({ room: null, status: "error", callId: null, role: null });
	}

	// doJoin/retryLoop/connectToLiveKit/isCurrent are refs-and-setState-only closures
	// declared in this hook's body, not reactive values — stable by construction, so the
	// empty dep array is intentional.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
	const join = useCallback(async (roomCode: string, mode: CallMode, isCreator: boolean) => {
		generationRef.current += 1;
		const generation = generationRef.current;
		manualLeaveRef.current = false;
		connectingRef.current = false;
		stopHeartbeat();
		stateRef.current.room?.disconnect();

		const params = { roomCode, mode, isCreator };
		paramsRef.current = params;
		setState({ room: null, status: "connecting", callId: null, role: null });
		const result = await doJoin(params, false, generation);
		if (result === "retry") void retryLoop(generation);
		else if (result === "fatal" && isCurrent(generation)) {
			setState({ room: null, status: "error", callId: null, role: null });
		}
	}, []);

	const { callId, status, role } = state;
	const generation = generationRef.current;
	const pollingEnabled = status === "ringing" && callId !== null;

	const statusQuery = useQuery({
		queryKey: ["call-status", callId, participantKeyRef.current],
		queryFn: () => getCallStatus(callId as string, participantKeyRef.current as string),
		enabled: pollingEnabled,
		refetchInterval: RINGING_POLL_MS,
		refetchIntervalInBackground: true,
		staleTime: 0,
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: connectToLiveKit is a stable ref-only closure
	useEffect(() => {
		const result = statusQuery.data;
		if (!result || !pollingEnabled || !callId || !role) return;
		if (result.status === "ACTIVE" && result.token) {
			void connectToLiveKit(result.livekitUrl, result.token, callId, role, generation);
		} else if (result.status === "REJECTED" || result.status === "ENDED") {
			setState((prev) => ({ ...prev, room: null, status: "rejected" }));
		}
	}, [statusQuery.data, pollingEnabled, callId, role, generation]);

	const acceptMutation = useMutation({
		mutationFn: () => acceptCall(callId as string, participantKeyRef.current as string),
		onSuccess: (result) => {
			if (!isCurrent(generation) || !callId || !role || !result.token) return;
			void connectToLiveKit(result.livekitUrl, result.token, callId, role, generation);
		},
	});

	const rejectMutation = useMutation({
		mutationFn: () => rejectCall(callId as string, participantKeyRef.current as string),
		onSuccess: () => {
			if (!isCurrent(generation)) return;
			setState((prev) => ({ ...prev, room: null, status: "rejected" }));
		},
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: see comment above join
	useEffect(() => {
		return () => {
			generationRef.current += 1;
			manualLeaveRef.current = true;
			stopHeartbeat();
			const params = paramsRef.current;
			const { room, callId: activeCallId } = stateRef.current;
			const participantKey = participantKeyRef.current;
			const currentStatus = stateRef.current.status;
			if (params && activeCallId && participantKey && currentStatus === "ringing") {
				rejectCall(activeCallId, participantKey).catch(() => {});
			} else if (
				params &&
				activeCallId &&
				participantKey &&
				(currentStatus === "connected" || currentStatus === "reconnecting")
			) {
				disconnectCall(activeCallId, participantKey).catch(() => {});
			}
			room?.disconnect();
		};
	}, []);

	return {
		...state,
		join,
		accept: acceptMutation.mutate,
		reject: rejectMutation.mutate,
	};
}
