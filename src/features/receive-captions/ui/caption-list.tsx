import type { Room } from "livekit-client";
import { Caption, type CaptionType } from "@/entities/caption";
import { useReceiveCaptions } from "../model/use-receive-captions";

export function CaptionList({
	room,
	onCaption,
}: {
	room: Room | null;
	onCaption?: (caption: CaptionType) => void;
}) {
	const captions = useReceiveCaptions(room, onCaption);

	return (
		<div className="flex w-full max-w-md flex-col gap-2 overflow-y-auto">
			{captions.map((caption) => (
				<Caption caption={caption} key={caption.id} />
			))}
		</div>
	);
}
