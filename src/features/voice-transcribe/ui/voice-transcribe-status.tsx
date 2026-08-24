import { useEffect, useRef } from "react";
import type { RealtimeStatus } from "@/shared/lib";

const STATUS_LABEL: Record<RealtimeStatus, string> = {
	idle: "",
	connecting: "음성 연결 중...",
	connected: "🎙️ 듣고 있어요",
	error: "음성 연결에 실패했어요. 새로고침 후 다시 시도해주세요.",
};

/** Mic status badge + the hidden `<audio>` sink that plays synthesized speech back to the listener. */
export function VoiceTranscribeStatus({
	status,
	remoteStream,
}: {
	status: RealtimeStatus;
	remoteStream: MediaStream | null;
}) {
	const audioRef = useRef<HTMLAudioElement>(null);

	useEffect(() => {
		if (audioRef.current) audioRef.current.srcObject = remoteStream;
	}, [remoteStream]);

	return (
		<div className="flex flex-col items-center gap-2">
			<p className="text-muted-foreground text-sm">{STATUS_LABEL[status]}</p>
			{/* biome-ignore lint/a11y/useMediaCaption: synthesized speech has no source track to caption */}
			<audio ref={audioRef} autoPlay />
		</div>
	);
}
