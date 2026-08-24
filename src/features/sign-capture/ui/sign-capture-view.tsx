import type { Room } from "livekit-client";
import { useSignCapture } from "../model/use-sign-capture";

/** Camera preview for the signer — runs Hand Landmarker locally and shows the last recognized phrase. */
export function SignCaptureView({ room }: { room: Room | null }) {
	const { videoRef, recognizedText, cameraError } = useSignCapture(room);

	return (
		<div className="flex flex-col items-center gap-2">
			<video
				className="aspect-video w-full max-w-md rounded-lg bg-black"
				ref={videoRef}
				autoPlay
				muted
				playsInline
			>
				<track kind="captions" />
			</video>
			<p className="text-muted-foreground text-sm">
				{cameraError ? "카메라 권한이 필요해요" : (recognizedText ?? "손을 카메라에 비춰보세요")}
			</p>
		</div>
	);
}
