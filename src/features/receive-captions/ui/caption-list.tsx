import type { Room } from "livekit-client";
import { Caption } from "@/entities/caption";
import { useReceiveCaptions } from "../model/use-receive-captions";

export function CaptionList({ room }: { room: Room | null }) {
	const captions = useReceiveCaptions(room);

	return (
		<div className="flex w-full flex-col items-start gap-2" aria-live="polite">
			{captions.length > 0 ? (
				captions.map((caption) => <Caption caption={caption} key={caption.id} />)
			) : (
				<p className="w-fit max-w-[85%] rounded-3xl rounded-tl-lg bg-muted px-5 py-3.5 text-base leading-7 text-muted-foreground">
					상대방이 말하면 이곳에 실시간으로 표시돼요.
				</p>
			)}
		</div>
	);
}
