import { Link } from "@tanstack/react-router";
import { Camera, Sparkles, Video } from "lucide-react";
import { useState } from "react";
import { SignCaptureView } from "@/features/sign-capture";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/shared/ui";

export function HomePage() {
	const [showTestView, setShowTestView] = useState(false);

	return (
		<main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
			{/* Title & Info */}
			<div className="flex flex-col items-center gap-2 text-center">
				<div className="flex items-center gap-2">
					<h1 className="font-bold text-3xl text-white">수화 인식 영상 통화</h1>
					<Dialog>
						<DialogTrigger render={<Button variant="ghost" size="sm" />}>정보</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>수화 인식 영상 통화 솔루션</DialogTitle>
								<DialogDescription>
									MediaPipe Vision AI를 활용하여 웹캠으로 손 제스처 및 수어를 실시간 인식하고
									자막으로 변환합니다.
								</DialogDescription>
							</DialogHeader>
						</DialogContent>
					</Dialog>
				</div>
				<p className="max-w-md text-neutral-400 text-sm">
					웹캠을 통해 실시간으로 수어를 인식하고, 음성 및 자막으로 실시간 소통할 수 있습니다.
				</p>
			</div>

			{/* Action Buttons */}
			<div className="flex flex-wrap items-center justify-center gap-3">
				<Button
					onClick={() => setShowTestView((prev) => !prev)}
					size="md"
					variant={showTestView ? "ghost" : "outline"}
					className="flex items-center gap-2"
				>
					<Camera className="h-4 w-4" />
					{showTestView ? "테스트 화면 닫기" : "웹캠 수화 인식 즉시 테스트"}
				</Button>

				<Link to="/lobby">
					<Button size="md" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500">
						<Video className="h-4 w-4" />
						통화 방 입장하기
					</Button>
				</Link>
			</div>

			{/* Standalone Sign Capture Test Container */}
			{showTestView && (
				<div className="mt-2 flex w-full max-w-2xl flex-col items-center gap-3 rounded-3xl border border-neutral-800 bg-neutral-900/50 p-5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95">
					<div className="flex w-full items-center justify-between px-1">
						<h3 className="flex items-center gap-2 font-semibold text-neutral-200 text-sm">
							<Sparkles className="h-4 w-4 text-blue-400" />
							로컬 웹캠 수화 인식 테스트
						</h3>
						<span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 font-medium text-blue-400 text-xs border border-blue-500/20">
							독립 실행 모드
						</span>
					</div>
					<SignCaptureView />
				</div>
			)}
		</main>
	);
}
