import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ConnectionState, type Room, RoomEvent } from "livekit-client";
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
	type StatusResult,
	sendHeartbeat,
	terminateCall,
} from "@/entities/call";
import { connectRoom } from "@/shared/lib";
import { getOrCreateSessionKey } from "./session-keys";

type JoinCallStatus =
	| "idle"
	| "connecting"
	| "ringing"
	| "connected"
	| "reconnecting"
	| "ended"
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
	participantKey: string;
}

const HEARTBEAT_INTERVAL_MS = 10_000;
const STATUS_POLL_INTERVAL_MS = 1_500;
const RETRY_DELAY_MS = 5_000;
const MAX_RETRIES = 6;
const relayNotice = new Audio("/audio/naru-relay-notice.mp3");
const RELAY_NOTICE_DELAY_MS = 1_000;
// How many times (and how far apart) to re-check call status right after a LiveKit disconnect
// before giving up and showing the "reconnecting" UI. The disconnect notification can arrive
// over the realtime connection before the call-status row finishes updating server-side, so a
// single immediate check can still read a stale ACTIVE status for a call the other side just
// ended -- that's the "다시 연결 중..." flash this session would otherwise show for an
// already-finished call. A couple of quick retries absorbs that race; a real network drop
// still falls through to the normal reconnect flow after this, just ~1s later.
const END_CHECK_ATTEMPTS = 3;
const END_CHECK_RETRY_DELAY_MS = 500;

function hasLiveKitCredentials(
	result: StatusResult,
): result is StatusResult & { livekitUrl: string; token: string } {
	return result.status === "ACTIVE" && Boolean(result.livekitUrl && result.token);
}

/** Owns the create → ringing → accept/reject → LiveKit connection state machine. */
export function useJoinCall() {
	const [state, setState] = useState<JoinCallState>({
		room: null,
		status: "idle",
		callId: null,
		role: null,
	});
	const stateRef = useRef(state);
	const [rejectedBySelf, setRejectedBySelf] = useState(false);
	stateRef.current = state;
	const paramsRef = useRef<JoinParams | null>(null);
	const heartbeatRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
	const manualLeaveRef = useRef(false);
	const connectingRef = useRef(false);
	const generationRef = useRef(0);

	const updateState = (next: JoinCallState | ((current: JoinCallState) => JoinCallState)) => {
		setState((current) => {
			const value = typeof next === "function" ? next(current) : next;
			stateRef.current = value;
			return value;
		});
	};

	const isCurrent = (generation: number) =>
		generation === generationRef.current && !manualLeaveRef.current;

	const stopHeartbeat = () => {
		clearInterval(heartbeatRef.current);
		heartbeatRef.current = undefined;
	};

	const markRejected = (bySelf = false, ended = false, endedRoom: Room | null = null) => {
		setRejectedBySelf(bySelf);
		generationRef.current += 1;
		manualLeaveRef.current = true;
		connectingRef.current = false;
		stopHeartbeat();
		stateRef.current.room?.disconnect();
		// CallPage only renders CallRoom's "ended" screen while `room` is still set (see
		// the statusQuery effect below, which does the same) -- nulling it here would fall
		// back to a blank JoinCall screen instead. `endedRoom` covers the retry-loop path,
		// where the room already got nulled out of state before the "ended" status was
		// confirmed (see retryLoop).
		updateState((current) => ({
			...current,
			room: ended ? (endedRoom ?? current.room) : null,
			status: ended ? "ended" : "rejected",
		}));
	};

	const statusQuery = useQuery({
		queryKey: ["call-status", state.callId, paramsRef.current?.participantKey],
		queryFn: () => {
			const params = paramsRef.current;
			if (!state.callId || !params) throw new Error("통화 상태 조회 정보가 없습니다.");
			return getCallStatus(state.callId, params.participantKey);
		},
		enabled: (state.status === "ringing" || state.status === "connected") && Boolean(state.callId),
		refetchInterval: STATUS_POLL_INTERVAL_MS,
		refetchIntervalInBackground: true,
		retry: 2,
	});

	const acceptMutation = useMutation({
		mutationFn: () => {
			const params = paramsRef.current;
			const { callId } = stateRef.current;
			if (!callId || !params) throw new Error("수락할 통화가 없습니다.");
			return acceptCall(callId, params.participantKey);
		},
	});

	const rejectMutation = useMutation({
		mutationFn: () => {
			const params = paramsRef.current;
			const { callId } = stateRef.current;
			if (!callId || !params) throw new Error("거절할 통화가 없습니다.");
			return rejectCall(callId, params.participantKey);
		},
	});

	async function connectWithCredentials(
		result: StatusResult,
		generation: number,
		isRetry: boolean,
	): Promise<boolean> {
		if (!isCurrent(generation) || connectingRef.current) return false;
		if (!hasLiveKitCredentials(result)) throw new Error("ACTIVE 응답에 LiveKit 정보가 없습니다.");

		connectingRef.current = true;
		updateState((current) => ({
			...current,
			status: isRetry ? "reconnecting" : "connecting",
		}));
		try {
			const room = await connectRoom(result.livekitUrl, result.token);
			if (!isCurrent(generation)) {
				room.disconnect();
				return false;
			}

			room.once(RoomEvent.Disconnected, () => {
				if (!isCurrent(generation)) return;
				stopHeartbeat();
				connectingRef.current = false;
				void retryLoop(generation, true);
			});

			const params = paramsRef.current;
			const callId = stateRef.current.callId;
			if (!params || !callId) {
				room.disconnect();
				return false;
			}

			stopHeartbeat();
			heartbeatRef.current = setInterval(() => {
				if (isCurrent(generation)) sendHeartbeat(callId, params.participantKey).catch(() => {});
			}, HEARTBEAT_INTERVAL_MS);
			updateState((current) => ({ ...current, room, status: "connected" }));
			return true;
		} finally {
			connectingRef.current = false;
		}
	}

	// Repeatedly checks whether the call has already ended server-side, and calls
	// markRejected + returns true the moment it finds REJECTED/ENDED. Pulled out of
	// retryLoop to keep that function's cognitive complexity down. Retries a few times
	// (END_CHECK_ATTEMPTS) rather than trusting a single read: the LiveKit disconnect
	// notification can arrive over the realtime connection before the call-status row
	// finishes updating server-side, so one immediate check can still read a stale ACTIVE
	// status for a call the other side just ended.
	async function checkAlreadyEnded(
		callId: string,
		participantKey: string,
		generation: number,
		wasConnected: boolean,
		previousRoom: Room | null,
	): Promise<boolean> {
		for (let attempt = 0; attempt < END_CHECK_ATTEMPTS && isCurrent(generation); attempt += 1) {
			try {
				const result = await getCallStatus(callId, participantKey);
				if (result.status === "REJECTED" || result.status === "ENDED") {
					markRejected(false, wasConnected, previousRoom);
					return true;
				}
			} catch {
				// Status check failed -- keep retrying below.
			}
			if (attempt < END_CHECK_ATTEMPTS - 1) {
				await new Promise((resolve) => setTimeout(resolve, END_CHECK_RETRY_DELAY_MS));
			}
		}
		return false;
	}

	async function retryLoop(generation: number, wasConnected = false): Promise<void> {
		const params = paramsRef.current;
		const callId = stateRef.current.callId;
		if (!isCurrent(generation) || !params || !callId) return;

		// Capture the about-to-be-cleared room before nulling it out below, so that if this
		// reconnect attempt turns out to be a real call-end (not just a network blip), the
		// "ended" screen still has a room to render against instead of falling back to a
		// blank JoinCall screen.
		const previousRoom = stateRef.current.room;

		// Check whether the call already ended server-side (the other side hung up) before
		// showing a "reconnecting" UI -- a dropped LiveKit connection after the other party
		// ends the call looks identical to a network blip otherwise, and this side would
		// flash "다시 연결 중..." for an already-finished call.
		const alreadyEnded = await checkAlreadyEnded(
			callId,
			params.participantKey,
			generation,
			wasConnected,
			previousRoom,
		);
		if (alreadyEnded) return;
		if (!isCurrent(generation)) return;

		updateState((current) => ({ ...current, room: null, status: "reconnecting" }));

		for (let attempt = 0; attempt < MAX_RETRIES && isCurrent(generation); attempt += 1) {
			const result = await retryOnce(params, callId, generation, wasConnected, previousRoom);
			if (result === "connected" || result === "terminal" || result === "stale") return;
			if (result === "fatal") break;
		}
		if (isCurrent(generation)) {
			updateState((current) => ({ ...current, room: null, status: "error" }));
		}
	}

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: bounded retry result classifier
	async function retryOnce(
		params: JoinParams,
		callId: string,
		generation: number,
		wasConnected: boolean,
		previousRoom: Room | null,
	): Promise<"connected" | "terminal" | "retry" | "stale" | "fatal"> {
		await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
		if (!isCurrent(generation)) return "stale";
		try {
			const result = await getCallStatus(callId, params.participantKey);
			if (result.status === "REJECTED" || result.status === "ENDED") {
				markRejected(false, wasConnected, previousRoom);
				return "terminal";
			}
			if (!hasLiveKitCredentials(result)) return "retry";
			return (await connectWithCredentials(result, generation, true)) ? "connected" : "retry";
		} catch (error) {
			const status = axios.isAxiosError(error) ? error.response?.status : undefined;
			return status !== undefined && status < 500 ? "fatal" : "retry";
		}
	}

	// This callback only reads refs and stable React setters. Keeping it stable prevents
	// CallPage's join effect from restarting the server session on every render.
	// biome-ignore lint/correctness/useExhaustiveDependencies: refs-only state machine entrypoint
	const join = useCallback(async (roomCode: string, mode: CallMode, isCreator: boolean) => {
		generationRef.current += 1;
		const generation = generationRef.current;
		manualLeaveRef.current = false;
		setRejectedBySelf(false);
		connectingRef.current = false;
		stopHeartbeat();
		stateRef.current.room?.disconnect();

		const participantKey = getOrCreateSessionKey("participant", roomCode);
		const params = { roomCode, mode, isCreator, participantKey };
		paramsRef.current = params;
		updateState({ room: null, status: "connecting", callId: null, role: null });

		try {
			if (isCreator) {
				await createCall(roomCode, getOrCreateSessionKey("creator", roomCode));
			}
			const result = await joinCall(roomCode, mode, participantKey);
			if (!isCurrent(generation)) {
				const currentParams = paramsRef.current;
				const supersededBySameJoin =
					!manualLeaveRef.current &&
					currentParams?.roomCode === roomCode &&
					currentParams.mode === mode;
				if (!supersededBySameJoin) {
					await rejectCall(result.callId, participantKey).catch(() => {});
				}
				return;
			}
			updateState({ room: null, status: "ringing", callId: result.callId, role: result.role });
		} catch (error) {
			console.error("[join-call] join failed", error);
			if (isCurrent(generation)) {
				updateState({ room: null, status: "error", callId: null, role: null });
			}
		}
	}, []);

	const accept = async () => {
		if (stateRef.current.role !== "CALLEE") return;
		const generation = generationRef.current;
		let result: StatusResult;
		try {
			result = await acceptMutation.mutateAsync();
		} catch {
			return;
		}
		if (paramsRef.current?.mode === "HEARING") {
			window.setTimeout(() => {
				if (!isCurrent(generation)) return;
				relayNotice.currentTime = 0;
				void relayNotice.play().catch(() => {});
			}, RELAY_NOTICE_DELAY_MS);
		}
		try {
			await connectWithCredentials(result, generation, false);
		} catch (error) {
			console.error("[join-call] accepted call connection failed", error);
			void retryLoop(generation);
		}
	};

	const reject = async () => {
		try {
			await rejectMutation.mutateAsync();
			markRejected(true);
		} catch {
			return;
		}
	};

	const leave = async () => {
		manualLeaveRef.current = true;
		stopHeartbeat();
		const generation = generationRef.current;
		const params = paramsRef.current;
		const { room, callId, status } = stateRef.current;

		try {
			if (params && callId) {
				if (status === "ringing" || status === "connecting") {
					await rejectCall(callId, params.participantKey);
				} else {
					await terminateCall(callId, params.participantKey);
				}
			}
			generationRef.current += 1;
			const endedState: JoinCallState = { room, status: "ended", callId: null, role: null };
			stateRef.current = endedState;
			setState(endedState);
			room?.disconnect();
		} catch (error) {
			manualLeaveRef.current = false;
			if (room?.state === ConnectionState.Disconnected) void retryLoop(generation);
			throw error;
		}
	};

	// The state-machine helpers intentionally read current refs; the query result is
	// the only reactive trigger for this transition.
	// biome-ignore lint/correctness/useExhaustiveDependencies: refs-only transition helpers
	useEffect(() => {
		if (statusQuery.isError && stateRef.current.status === "ringing") {
			updateState((current) => ({ ...current, status: "error" }));
			return;
		}
		const result = statusQuery.data;
		if (!result) return;
		if (
			stateRef.current.status === "connected" &&
			(result.status === "REJECTED" || result.status === "ENDED")
		) {
			generationRef.current += 1;
			manualLeaveRef.current = true;
			stopHeartbeat();
			stateRef.current.room?.disconnect();
			updateState((current) => ({ ...current, status: "ended" }));
			return;
		}
		if (stateRef.current.status !== "ringing") return;
		if (result.status === "REJECTED" || result.status === "ENDED") {
			markRejected();
			return;
		}
		if (result.status === "ACTIVE" && !hasLiveKitCredentials(result)) {
			updateState((current) => ({ ...current, status: "error" }));
			return;
		}
		if (hasLiveKitCredentials(result)) {
			void connectWithCredentials(result, generationRef.current, false).catch((error) => {
				console.error("[join-call] LiveKit connect failed", error);
				void retryLoop(generationRef.current);
			});
		}
	}, [statusQuery.data, statusQuery.isError]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: unmount-only refs cleanup
	useEffect(() => {
		return () => {
			generationRef.current += 1;
			manualLeaveRef.current = true;
			stopHeartbeat();
			const params = paramsRef.current;
			const { room, callId, status } = stateRef.current;
			if (params && callId && (status === "ringing" || status === "connecting")) {
				rejectCall(callId, params.participantKey).catch(() => {});
			} else if (params && callId && (status === "connected" || status === "reconnecting")) {
				disconnectCall(callId, params.participantKey).catch(() => {});
			}
			room?.disconnect();
		};
	}, []);

	return {
		...state,
		join,
		accept,
		reject,
		leave,
		accepting: acceptMutation.isPending,
		rejecting: rejectMutation.isPending,
		actionError: acceptMutation.isError || rejectMutation.isError,
		rejectedBySelf,
	};
}
