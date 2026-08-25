import type { Room } from "livekit-client";
import type { CallMode } from "@/entities/call";
import { AgentAudioPlayer } from "@/features/play-agent-audio";
import { CaptionList } from "@/features/receive-captions";
import { SignCaptureView } from "@/features/sign-capture";
import { MicToggleButton } from "@/features/toggle-mic";

function DeafRoom({ room }: { room: Room | null }) {
	return (
		<div className="flex flex-col items-center gap-6 p-8">
			<SignCaptureView room={room} />
			<CaptionList room={room} />
		</div>
	);
}

function HearingRoom({ room }: { room: Room | null }) {
	return (
		<div className="flex flex-col items-center gap-6 p-8">
			<MicToggleButton room={room} />
			<AgentAudioPlayer room={room} />
		</div>
	);
}

/**
 * Composes this call's two directions by mode: DEAF captures sign language
 * locally and sees the agent's live captions of what HEARING says; HEARING
 * toggles their mic and hears the agent speak DEAF's recognized text aloud.
 * All STT/TTS happens server-side (the backend's LiveKit agent) — this
 * widget only wires the LiveKit room, no direct OpenAI connection.
 */
export function CallRoom({ room, mode }: { room: Room | null; mode: CallMode }) {
	return mode === "HEARING" ? <HearingRoom room={room} /> : <DeafRoom room={room} />;
}
