import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { JoinCall, useJoinCall } from "@/features/join-call";
import { Button } from "@/shared/ui";
import { CallRoom } from "@/widgets/call-room";

export function CallPage() {
	const { mode, room: roomCode } = useSearch({ from: "/call" });
	const navigate = useNavigate();
	const { room, status, role, isCreator, join, accept, reject, end } = useJoinCall();

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

	return (
		<div className="flex flex-col gap-4">
			<div className="flex justify-end gap-2 p-4">
				{isCreator && (
					<Button
						onClick={() => end().finally(() => navigate({ to: "/" }))}
						size="sm"
						variant="outline"
					>
						통화 종료
					</Button>
				)}
				<Button onClick={() => navigate({ to: "/" })} size="sm" variant="outline">
					나가기
				</Button>
			</div>
			<CallRoom mode={mode} room={room} />
		</div>
	);
}
