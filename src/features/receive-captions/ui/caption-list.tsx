import type { Room } from "livekit-client";
import { Caption } from "@/entities/caption";
import { useReceiveCaptions } from "../model/use-receive-captions";

export function CaptionList({ room }: { room: Room | null }) {
	const captions = useReceiveCaptions(room);

	return (
		<div className="flex w-full max-w-md flex-col gap-2 overflow-y-auto">
			{captions.map((caption) => (
				<Caption caption={caption} key={caption.id} />
			))}
		</div>
	);
}
