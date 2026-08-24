import { Link } from "@tanstack/react-router";
import { Button } from "@/shared/ui";

const DEMO_ROOM = "demo";

export function LobbyPage() {
	return (
		<main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
			<h1 className="text-2xl font-bold">통화 역할을 선택하세요</h1>
			<div className="flex gap-4">
				<Link search={{ role: "signer", room: DEMO_ROOM }} to="/call">
					<Button size="md">청각장애인으로 입장</Button>
				</Link>
				<Link search={{ role: "listener", room: DEMO_ROOM }} to="/call">
					<Button size="md" variant="outline">
						비장애인으로 입장
					</Button>
				</Link>
			</div>
		</main>
	);
}
