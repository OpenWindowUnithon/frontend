import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Camera, Sparkles } from "lucide-react";
import { SignCaptureView } from "@/features/sign-capture";

export function TestCameraPage() {
	const navigate = useNavigate();

	return (
		<main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col bg-card px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
			<header className="mb-4 flex items-center justify-between">
				<button
					type="button"
					onClick={() => navigate({ to: "/" })}
					className="flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900/70 px-3.5 py-2 font-medium text-neutral-300 text-xs transition-colors hover:bg-neutral-800 hover:text-white"
					aria-label="키패드로 돌아가기"
				>
					<ArrowLeft className="h-4 w-4" />
					<span>키패드로 돌아가기</span>
				</button>
				<div className="flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 font-semibold text-blue-400 text-xs">
					<Camera className="h-3.5 w-3.5" />
					<span>수어 카메라 테스트 모드</span>
				</div>
			</header>

			<div className="flex flex-1 flex-col items-center justify-start gap-4">
				<div className="flex w-full items-center justify-between rounded-xl border border-blue-500/20 bg-blue-950/20 p-3 text-blue-300 text-xs">
					<div className="flex items-center gap-2">
						<Sparkles className="h-4 w-4 shrink-0 text-blue-400" />
						<span>
							통화 연결 없이 실시간 웹캠 관절 추적, KSL 수어 인식, DTW 커스텀 단어 등록을 테스트할
							수 있습니다.
						</span>
					</div>
				</div>
				<SignCaptureView room={null} />
			</div>
		</main>
	);
}
