import { IconMicrophoneFill, IconMicrophoneSlashFill } from "@karrotmarket/react-monochrome-icon";
import type { Room } from "livekit-client";
import { useToggleMic } from "../model/use-toggle-mic";

export function MicToggleButton({ room }: { room: Room | null }) {
	const { state, togglePower } = useToggleMic(room);
	const powered = state === "on";
	return (
		<button
			type="button"
			disabled={!room}
			onClick={togglePower}
			aria-pressed={powered}
			className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-3xl bg-muted text-sm font-semibold focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40"
		>
			<span
				className={`grid size-14 place-items-center rounded-full ${powered ? "bg-foreground text-background" : "bg-card"}`}
			>
				{powered ? (
					<IconMicrophoneFill className="size-7" aria-hidden />
				) : (
					<IconMicrophoneSlashFill className="size-7" aria-hidden />
				)}
			</span>
			{powered ? "마이크 켜짐" : "마이크 꺼짐"}
		</button>
	);
}
