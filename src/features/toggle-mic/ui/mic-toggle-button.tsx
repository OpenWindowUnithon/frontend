import { IconMicrophoneFill, IconMicrophoneSlashFill } from "@karrotmarket/react-monochrome-icon";
import type { Room } from "livekit-client";
import { useToggleMic } from "../model/use-toggle-mic";

export function MicToggleButton({ room }: { room: Room | null }) {
	const { state, togglePower, toggleMute } = useToggleMic(room);
	const powered = state !== "off";
	const muted = state === "muted";
	return (
		<div className="grid w-full grid-cols-2 gap-3">
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
					<IconMicrophoneFill className="size-7" aria-hidden />
				</span>
				{powered ? "마이크 켜짐" : "마이크 꺼짐"}
			</button>
			<button
				type="button"
				disabled={!powered}
				onClick={toggleMute}
				aria-pressed={muted}
				className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-3xl bg-muted text-sm font-semibold focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40"
			>
				<span
					className={`grid size-14 place-items-center rounded-full ${muted ? "bg-foreground text-background" : "bg-card"}`}
				>
					<IconMicrophoneSlashFill className="size-7" aria-hidden />
				</span>
				{muted ? "음소거 해제" : "음소거"}
			</button>
		</div>
	);
}
