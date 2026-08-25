import { IconPhoneXmarkFill } from "@karrotmarket/react-monochrome-icon";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { JoinCall, useJoinCall } from "@/features/join-call";
import { CallRoom } from "@/widgets/call-room";

export function CallPage() {
	const { mode, room: roomCode, communication, contactName, phone } = useSearch({ from: "/call" });
	const navigate = useNavigate();
	const { room, status, join, leave } = useJoinCall();
	const [seconds, setSeconds] = useState(0);

	useEffect(() => {
		join(roomCode, mode, mode === "DEAF");
	}, [roomCode, mode, join]);

	useEffect(() => {
		if (status !== "connected") return;
		const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
		return () => window.clearInterval(timer);
	}, [status]);

	if (status !== "connected" || !room) {
		return (
			<main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-card pb-[max(1.75rem,env(safe-area-inset-bottom))]">
				<JoinCall status={status} contactName={contactName} phone={phone} />
				<button
					type="button"
					className="mx-auto flex min-h-28 min-w-28 flex-col items-center justify-center gap-3 rounded-3xl text-sm font-bold text-destructive focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring"
					onClick={() => navigate({ to: "/" })}
				>
					<span className="grid size-17 place-items-center rounded-full bg-destructive text-white shadow-sm">
						<IconPhoneXmarkFill className="size-8" aria-hidden />
					</span>
					전화 취소
				</button>
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
		/>
	);
}
