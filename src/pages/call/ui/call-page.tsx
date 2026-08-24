import { useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { JoinCall, useJoinCall } from "@/features/join-call";
import { CallRoom } from "@/widgets/call-room";

export function CallPage() {
	const { role, room: roomName } = useSearch({ from: "/call" });
	const { room, status, join } = useJoinCall();

	useEffect(() => {
		join(roomName, `${role}-${crypto.randomUUID().slice(0, 8)}`);
	}, [roomName, role, join]);

	if (status !== "connected" || !room) {
		return (
			<main className="flex min-h-screen items-center justify-center">
				<JoinCall status={status} />
			</main>
		);
	}

	return <CallRoom role={role} room={room} />;
}
