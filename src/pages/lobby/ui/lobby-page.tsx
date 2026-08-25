import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { CallMode } from "@/entities/call";
import { Button, Input } from "@/shared/ui";

const ROOM_CODE_PATTERN = /^[A-Za-z0-9_-]{3,40}$/;

export function LobbyPage() {
	const navigate = useNavigate();
	const [roomCode, setRoomCode] = useState("demo");
	const [error, setError] = useState<string | null>(null);

	const enter = (mode: CallMode) => {
		if (!ROOM_CODE_PATTERN.test(roomCode)) {
			setError("방 코드는 영문, 숫자, _, - 3~40자만 사용할 수 있어요.");
			return;
		}
		navigate({ to: "/call", search: { room: roomCode, mode } });
	};

	return (
		<main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
			<h1 className="text-2xl font-bold">통화 방 코드를 입력하세요</h1>
			<Input
				className="max-w-xs"
				onChange={(event) => setRoomCode(event.target.value)}
				placeholder="방 코드"
				value={roomCode}
			/>
			{error && <p className="text-destructive text-sm">{error}</p>}
			<div className="flex gap-4">
				<Button onClick={() => enter("DEAF")} size="md">
					청각장애인으로 입장 (방 생성)
				</Button>
				<Button onClick={() => enter("HEARING")} size="md" variant="outline">
					비장애인으로 입장
				</Button>
			</div>
		</main>
	);
}
