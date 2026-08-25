import { Badge } from "@seed-design/react";
import type { Room } from "livekit-client";
import { useState } from "react";
import { Button, Input } from "@/shared/ui";
import { useSignCapture } from "../model/use-sign-capture";

/** Camera preview for the signer — runs Hand Landmarker locally and shows the last recognized phrase. */
export function SignCaptureView({ room }: { room: Room | null }) {
	const { videoRef, recognizedText, cameraError, references, recordReference, removeReference } =
		useSignCapture(room);
	const [newWord, setNewWord] = useState("");
	const [recordHint, setRecordHint] = useState<string | null>(null);

	function handleRecord() {
		const recorded = recordReference(newWord);
		setRecordHint(
			recorded
				? `"${newWord.trim()}" 저장됨`
				: "아직 카메라 준비 중이에요. 잠시 후 다시 눌러주세요.",
		);
	}

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
					tone={cameraError ? "critical" : recognizedText ? "positive" : "neutral"}
				>
					{cameraError ? "카메라를 확인해 주세요" : recognizedText ? "인식 완료" : "인식 중"}
				</Badge>
			</div>
			{recognizedText && (
				<p className="rounded-2xl bg-muted px-4 py-3 text-lg font-semibold">{recognizedText}</p>
			)}

			<details className="w-full rounded-2xl bg-muted px-4 py-3 text-sm">
				<summary className="cursor-pointer font-medium text-muted-foreground">단어 등록</summary>
				<div className="flex flex-col gap-2 pt-2">
					<p className="text-muted-foreground text-xs">
						모델에 없는 단어(예: 병원, 예약, 도움)를 카메라 앞에서 여러 번 반복하고 매번 "이 동작
						저장"을 누르면, 다음부터 인식됩니다. 영상은 저장되지 않고 이 브라우저에만 남습니다.
					</p>
					<div className="flex gap-2">
						<Input
							aria-label="등록할 단어"
							placeholder="예: 병원"
							value={newWord}
							onChange={(event) => setNewWord(event.target.value)}
						/>
						<Button size="md" disabled={!newWord.trim()} onClick={handleRecord}>
							이 동작 저장
						</Button>
					</div>
					{recordHint && <p className="text-muted-foreground text-xs">{recordHint}</p>}
					<ul className="flex flex-col gap-1">
						{Object.entries(references).map(([word, count]) => (
							<li key={word} className="flex items-center justify-between gap-2">
								<span>
									{word} ({count}개)
								</span>
								<Button size="sm" onClick={() => removeReference(word)}>
									삭제
								</Button>
							</li>
						))}
					</ul>
				</div>
			</details>
		</div>
	);
}
