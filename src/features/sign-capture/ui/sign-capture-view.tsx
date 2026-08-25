import { Badge } from "@seed-design/react";
import type { Room } from "livekit-client";
import { useState } from "react";
import { ActionButton } from "@/shared/ui/seed-design/ui/action-button";
import { TextField, TextFieldInput } from "@/shared/ui/seed-design/ui/text-field";
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
		<div className="flex w-full flex-col gap-3">
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
				<div className="pointer-events-none absolute inset-6 rounded-[2rem] border-2 border-dashed border-white/70" />
				<p className="absolute top-4 left-0 right-0 text-center text-sm font-medium text-white">
					얼굴과 양손을 화면 안에 맞춰주세요
				</p>
				<Badge
					className="absolute bottom-4 left-4"
					variant="solid"
					tone={cameraError ? "critical" : text ? "warning" : "neutral"}
				>
					{cameraError
						? "카메라 권한이 필요해요"
						: text
							? "인식됨 · 전달 전 확인 필요"
							: "수어 인식 중…"}
				</Badge>
			</div>
			<TextField
				label="인식된 내용"
				size="large"
				value={text}
				onValueChange={({ value }) => setRecognizedText(value)}
				invalid={error}
				errorMessage="전달하지 못했어요. 원문을 확인하고 다시 시도해주세요."
				description="내용을 확인하거나 수정한 뒤 직접 전달하세요."
			>
				<TextFieldInput placeholder="수어를 인식하면 여기에 표시돼요" />
			</TextField>
			<div className="grid grid-cols-[0.8fr_1.2fr] gap-3">
				<ActionButton variant="neutralOutline" size="large" onClick={() => setRecognizedText(null)}>
					다시 인식
				</ActionButton>
				<ActionButton
					variant="neutralSolid"
					size="large"
					loading={sending}
					disabled={!text.trim() || sending}
					onClick={send}
				>
					{sending ? "전달 중…" : error ? "다시 전달" : "확인하고 전달"}
				</ActionButton>
			</div>
		</div>
	);
}
