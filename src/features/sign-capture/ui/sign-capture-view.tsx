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

			<details className="w-full max-w-md text-sm">
				<summary className="cursor-pointer text-muted-foreground">
					고급: 모델이 모르는 단어 등록
				</summary>
				<div className="flex flex-col gap-2 pt-2">
					<p className="text-muted-foreground text-xs">
						모델에 없는 단어(예: 병원, 예약, 도움)를 카메라 앞에서 여러 번 반복하고 매번 "이 동작
						저장"을 누르면, 다음부터 인식됩니다. 영상은 저장되지 않고 이 브라우저에만 남습니다.
					</p>
					<div className="flex gap-2">
						<Input
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
