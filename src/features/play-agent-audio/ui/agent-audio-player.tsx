import type { Room } from "livekit-client";
import { Button } from "@/shared/ui";
import { usePlayAgentAudio } from "../model/use-play-agent-audio";

export function AgentAudioPlayer({ room }: { room: Room | null }) {
	const { audioRef, needsPlayTap, retryPlay } = usePlayAgentAudio(room);
	return (
		<>
			{/* biome-ignore lint/a11y/useMediaCaption: synthesized speech has no source track to caption */}
			<audio autoPlay playsInline ref={audioRef} />
			{needsPlayTap && (
				<Button onClick={retryPlay} size="sm" variant="outline">
					소리를 재생하려면 눌러주세요
				</Button>
			)}
		</>
	);
}
