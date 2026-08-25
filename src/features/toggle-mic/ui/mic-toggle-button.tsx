import type { Room } from "livekit-client";
import { Button } from "@/shared/ui";
import { useToggleMic } from "../model/use-toggle-mic";

const LABEL = {
	off: "마이크 켜기",
	on: "마이크 끄기",
	muted: "마이크 켜기",
} as const;

export function MicToggleButton({ room }: { room: Room | null }) {
	const { state, toggle } = useToggleMic(room);
	return (
		<Button disabled={!room} onClick={toggle} size="md">
			{LABEL[state]}
		</Button>
	);
}
