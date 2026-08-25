import { Badge } from "@seed-design/react";
import type { Room } from "livekit-client";
import { useState } from "react";
import { ActionButton, TextField, TextFieldInput } from "@/shared/ui";
import { useSignCapture } from "../model/use-sign-capture";

/** Camera preview for the signer — runs Hand Landmarker locally and shows the last recognized phrase. */
export function SignCaptureView({ room }: { room: Room | null }) {
	const { videoRef, recognizedText, setRecognizedText, sendRecognizedText, cameraError } =
		useSignCapture(room);
	const [sending, setSending] = useState(false);
	const [error, setError] = useState(false);
	const text = recognizedText ?? "";
	const send = async () => {
		setSending(true);
		setError(false);
		try {
			await sendRecognizedText(text);
		} catch {
			setError(true);
		} finally {
			setSending(false);
		}
	};

	return (
		<div className="flex w-full flex-col gap-4">
			<div className="relative overflow-hidden rounded-3xl bg-neutral-900">
				<video
					className="aspect-[4/3] w-full object-cover"
					ref={videoRef}
					autoPlay
					muted
					playsInline
				>
					<track kind="captions" />
				</video>
				<Badge
					className="absolute bottom-4 left-4"
					variant="solid"
					tone={cameraError ? "critical" : text ? "positive" : "neutral"}
				>
					{cameraError ? "카메라를 확인해 주세요" : text ? "인식 완료" : "인식 중"}
				</Badge>
			</div>
			{(text || error) && (
				<div className="rounded-3xl bg-muted p-4">
					<TextField
						label="인식된 문장"
						size="large"
						value={text}
						onValueChange={({ value }) => setRecognizedText(value)}
						invalid={error}
						errorMessage="전달하지 못했어요. 다시 시도해 주세요."
					>
						<TextFieldInput />
					</TextField>
					<ActionButton
						variant="neutralSolid"
						size="large"
						className="mt-3 w-full"
						loading={sending}
						disabled={!text.trim() || sending}
						onClick={send}
					>
						{sending ? "전달 중…" : error ? "다시 전달" : "전달"}
					</ActionButton>
				</div>
			)}
		</div>
	);
}
