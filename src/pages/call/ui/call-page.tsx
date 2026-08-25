import { useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { JoinCall, useJoinCall } from "@/features/join-call";
import { CallRoom } from "@/widgets/call-room";

export function CallPage() {
	const { mode, room: roomCode } = useSearch({ from: "/call" });
	const { room, status, role, join, accept, reject } = useJoinCall();

	useEffect(() => {
		join(roomCode, mode, mode === "DEAF");
	}, [roomCode, mode, join]);

	if (status !== "connected" || !room) {
		return (
			<main className="flex min-h-screen items-center justify-center">
				<JoinCall status={status} role={role} onAccept={accept} onReject={reject} />
			</main>
		);
	}

	return <CallRoom mode={mode} room={room} />;
}
