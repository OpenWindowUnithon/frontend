import type { Room } from "livekit-client";
import { useEffect, useState } from "react";
import { type CaptionType, subscribeToCaptions } from "@/entities/caption";

/**
 * Subscribes to captions from the other participant. `onCaption` is optional —
 * the listener side wires it to `voice-transcribe`'s `speak` to also hear the
 * signer's text spoken aloud; the signer side leaves it unset (captions only).
 */
export function useReceiveCaptions(room: Room | null, onCaption?: (caption: CaptionType) => void) {
	const [captions, setCaptions] = useState<CaptionType[]>([]);

	useEffect(() => {
		if (!room) return;
		return subscribeToCaptions(room, (caption) => {
			setCaptions((prev) => [...prev, caption]);
			onCaption?.(caption);
		});
	}, [room, onCaption]);

	return captions;
}
