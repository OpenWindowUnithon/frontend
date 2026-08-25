import type { Room } from "livekit-client";
import { useEffect, useState } from "react";
import { type CaptionType, subscribeToCaptions } from "@/entities/caption";

/** Subscribes to the agent's live captions (DEAF only — see entities/caption). Upserts by segment id as interim updates arrive. */
export function useReceiveCaptions(room: Room | null) {
	const [captions, setCaptions] = useState<CaptionType[]>([]);

	useEffect(() => {
		if (!room) return;
		return subscribeToCaptions(room, (caption) => {
			setCaptions((prev) => {
				const index = prev.findIndex((c) => c.id === caption.id);
				if (index === -1) return [...prev, caption];
				return prev.map((c, i) => (i === index ? caption : c));
			});
		});
	}, [room]);

	return captions;
}
