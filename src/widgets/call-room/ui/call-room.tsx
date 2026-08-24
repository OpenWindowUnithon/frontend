import type { Room } from "livekit-client";
import { useCallback } from "react";
import type { CallRole } from "@/entities/call";
import type { CaptionType } from "@/entities/caption";
import { CaptionList } from "@/features/receive-captions";
import { SignCaptureView } from "@/features/sign-capture";
import { useVoiceTranscribe, VoiceTranscribeStatus } from "@/features/voice-transcribe";

function SignerRoom({ room }: { room: Room | null }) {
	return (
		<div className="flex flex-col items-center gap-6 p-8">
			<SignCaptureView room={room} />
			<CaptionList room={room} />
		</div>
	);
}

function ListenerRoom({ room }: { room: Room | null }) {
	const { status, remoteStream, speak } = useVoiceTranscribe(room);
	const speakCaption = useCallback((caption: CaptionType) => speak(caption.text), [speak]);
	return (
		<div className="flex flex-col items-center gap-6 p-8">
			<VoiceTranscribeStatus remoteStream={remoteStream} status={status} />
			<CaptionList onCaption={speakCaption} room={room} />
		</div>
	);
}

/**
 * Composes this call's two directions by role: the signer captures sign
 * language and sees the other side's speech as captions only; the listener
 * speaks into the mic and hears the signer's recognized text as synthesized
 * speech (via `speak`, wired as `CaptionList`'s `onCaption`).
 */
export function CallRoom({ room, role }: { room: Room | null; role: CallRole }) {
	return role === "listener" ? <ListenerRoom room={room} /> : <SignerRoom room={room} />;
}
