import { IconPhoneXmarkFill } from "@karrotmarket/react-monochrome-icon";
import { PrefixIcon } from "@seed-design/react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { JoinCall, useJoinCall } from "@/features/join-call";
import { ActionButton } from "@/shared/ui/seed-design/ui/action-button";
import { CallRoom } from "@/widgets/call-room";

export function CallPage() {
	const { mode, room: roomCode, communication, contactName, phone } = useSearch({ from: "/call" });
	const navigate = useNavigate();
	const { room, status, join } = useJoinCall();
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
			<main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-card pb-7">
				<header className="border-b py-5 text-center text-xl font-bold">
					{communication === "SIGN" ? "수어 통화" : "텍스트 통화"}
				</header>
				<JoinCall status={status} contactName={contactName} phone={phone} />
				<ActionButton
					variant="ghost"
					color="fg.critical"
					className="mx-auto"
					onClick={() => navigate({ to: "/" })}
				>
					<PrefixIcon svg={<IconPhoneXmarkFill />} /> 전화 취소
				</ActionButton>
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
		/>
	);
}
