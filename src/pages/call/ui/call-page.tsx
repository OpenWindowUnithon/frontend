import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { JoinCall, useJoinCall } from "@/features/join-call";
import { CallRoom } from "@/widgets/call-room";

const UUID_ROOM_CODE =
	/^call-([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/i;

function normalizeRoomCode(roomCode: string) {
	return roomCode.replace(UUID_ROOM_CODE, "call-$1$2$3$4$5");
}

export function CallPage() {
	const { mode, room: roomCode, communication, contactName, phone } = useSearch({ from: "/call" });
	const normalizedRoomCode = normalizeRoomCode(roomCode);
	const navigate = useNavigate();
	const {
		room,
		status,
		role,
		join,
		accept,
		reject,
		leave,
		accepting,
		rejecting,
		actionError,
		rejectedBySelf,
	} = useJoinCall();
	const [seconds, setSeconds] = useState(0);

	useEffect(() => {
		join(normalizedRoomCode, mode, mode === "DEAF");
	}, [normalizedRoomCode, mode, join]);

	useEffect(() => {
		if (status !== "connected") return;
		const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
		return () => window.clearInterval(timer);
	}, [status]);

	if ((status !== "connected" && status !== "ended") || !room) {
		return (
			<main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-card pb-[max(1.75rem,env(safe-area-inset-bottom))]">
				<JoinCall
					status={status}
					role={role}
					contactName={contactName}
					phone={phone}
					onAccept={accept}
					onReject={reject}
					onCancel={async () => {
						try {
							await leave();
							navigate({ to: "/" });
						} catch (error) {
							console.error("[call-page] cancel failed", error);
						}
					}}
					accepting={accepting}
					rejecting={rejecting}
					actionError={actionError}
					rejectedBySelf={rejectedBySelf}
				/>
			</main>
		);
	}

	return (
		<CallRoom
			mode={mode}
			room={room}
			communication={communication}
			contactName={contactName}
			phone={phone}
			seconds={seconds}
			onEnd={leave}
			endedExternally={status === "ended"}
		/>
	);
}
