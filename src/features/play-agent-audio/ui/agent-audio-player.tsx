import type { Room } from "livekit-client";
import { usePlayAgentAudio } from "../model/use-play-agent-audio";

export function AgentAudioPlayer({ room }: { room: Room | null }) {
	const { audioRef, needsPlayTap, retryPlay } = usePlayAgentAudio(room);
	return (
		<>
			{/* biome-ignore lint/a11y/useMediaCaption: synthesized speech has no source track to caption */}
			<audio autoPlay playsInline ref={audioRef} />
			{needsPlayTap && (
				// Browsers (iOS Safari in particular) block audio.play() unless it's called
				// directly from a user gesture, so the initial autoplay attempt in
				// use-play-agent-audio.ts fails silently -- without a hard-to-miss prompt, the
				// call just looks completely silent with no indication why. Full-width and
				// high-contrast on purpose: this is the only control on the HEARING screen, and
				// missing it means the whole call is silent for that person.
				<button
					type="button"
					onClick={retryPlay}
					className="w-full max-w-sm animate-pulse rounded-2xl bg-destructive px-5 py-4 text-center text-base font-bold text-white shadow-lg focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring"
				>
					소리가 재생되지 않고 있어요 — 여기를 눌러 소리 켜기
				</button>
			)}
		</>
	);
}
