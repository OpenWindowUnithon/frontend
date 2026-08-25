import type { Room } from "livekit-client";
import {
	Activity,
	Camera,
	CameraOff,
	CheckCircle2,
	Eye,
	EyeOff,
	Hand,
	HelpCircle,
	History,
	Sparkles,
} from "lucide-react";
import { useState } from "react";
import type { RecognizedSign } from "../model/sign-recognizer";
import { useSignCapture } from "../model/use-sign-capture";

const SUPPORTED_SIGNS = [
	{ label: "안녕하세요", icon: "👋", desc: "손바닥을 펴서 인사" },
	{ label: "사랑합니다", icon: "🤟", desc: "엄지, 검지, 새끼 펴기 (I Love You)" },
	{ label: "최고예요 / 좋아요", icon: "👍", desc: "엄지손가락 세우기" },
	{ label: "확인 / OK", icon: "👌", desc: "엄지·검지 원 만들기" },
	{ label: "승리 / 화이팅", icon: "✌️", desc: "V자 손가락 (숫자 2)" },
	{ label: "부탁 / 죄송", icon: "🙏", desc: "두 손 모으기" },
	{ label: "감사합니다", icon: "🤝", desc: "두 손 맞대기" },
	{ label: "1, 3, 4 (지화 숫자)", icon: "☝️", desc: "손가락 개수 펴기" },
	{ label: "지화 'ㄴ' / 'ㅁ'", icon: "🔤", desc: "L자형 / 주먹" },
];

function CameraStatusBar({
	isLoadingModel,
	isModelReady,
	isCameraActive,
	detectedHandsCount,
}: {
	isLoadingModel: boolean;
	isModelReady: boolean;
	isCameraActive: boolean;
	detectedHandsCount: number;
}) {
	return (
		<div className="flex items-center gap-2">
			{isLoadingModel && (
				<span className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/20 px-3 py-1 font-medium text-amber-300 text-xs backdrop-blur-md">
					<Activity className="h-3.5 w-3.5 animate-spin" />
					AI 모델 로딩 중...
				</span>
			)}

			{isModelReady && isCameraActive && (
				<span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 font-medium text-emerald-300 text-xs backdrop-blur-md">
					<Sparkles className="h-3.5 w-3.5" />
					수화 인식 AI 활성
				</span>
			)}

			{isCameraActive && (
				<span className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 font-medium text-neutral-300 text-xs backdrop-blur-md">
					<Hand className="h-3.5 w-3.5" />
					{detectedHandsCount > 0 ? `${detectedHandsCount}개 손 감지` : "손 대기 중"}
				</span>
			)}
		</div>
	);
}

function ActiveSignOverlay({
	activeSign,
	recognizedText,
}: {
	activeSign: RecognizedSign | null;
	recognizedText: string | null;
}) {
	if (activeSign) {
		return (
			<div className="flex w-full items-center justify-between rounded-xl border border-blue-500/40 bg-black/75 px-4 py-2.5 text-white shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95">
				<div className="flex items-center gap-3">
					<span className="text-2xl">{activeSign.icon}</span>
					<div className="text-left">
						<div className="flex items-center gap-2">
							<span className="font-bold text-base text-white">{activeSign.label}</span>
							<span className="rounded border border-blue-400/30 bg-blue-500/20 px-1.5 py-0.5 font-semibold text-[10px] text-blue-300">
								인식 중 {Math.round(activeSign.confidence * 100)}%
							</span>
						</div>
						<p className="text-neutral-400 text-xs">{activeSign.description}</p>
					</div>
				</div>
				<div className="flex items-center gap-1 font-medium text-emerald-400 text-xs">
					<CheckCircle2 className="h-4 w-4" />
					<span>인식 완료</span>
				</div>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-4 py-1.5 text-neutral-300 text-xs backdrop-blur-md">
			<Hand className="h-3.5 w-3.5 text-neutral-400" />
			<span>
				{recognizedText
					? `마지막 수화: "${recognizedText}"`
					: "카메라를 향해 손을 비춰 수어를 표현해보세요"}
			</span>
		</div>
	);
}

function CameraDisabledState({
	cameraError,
	onRetry,
}: {
	cameraError: boolean;
	onRetry: () => void;
}) {
	return (
		<div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/90 p-6 text-center">
			<CameraOff className="mb-3 h-12 w-12 text-neutral-500" />
			<h4 className="font-semibold text-base text-neutral-200">
				{cameraError ? "카메라 접근 권한이 필요합니다" : "카메라가 꺼져 있습니다"}
			</h4>
			<p className="mt-1 max-w-xs text-neutral-400 text-xs">
				{cameraError
					? "브라우저 설정에서 카메라 사용 권한을 허용해주세요."
					: "상단의 카메라 버튼을 눌러 웹캠을 다시 켜실 수 있습니다."}
			</p>
			<button
				type="button"
				onClick={onRetry}
				className="mt-4 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-medium text-sm text-white shadow-lg transition-colors hover:bg-blue-500"
			>
				<Camera className="h-4 w-4" />
				카메라 시작
			</button>
		</div>
	);
}

function RecentSignsHistory({
	recentSigns,
	onClear,
}: {
	recentSigns: RecognizedSign[];
	onClear: () => void;
}) {
	if (recentSigns.length === 0) return null;

	return (
		<div className="flex w-full items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/60 p-2.5 backdrop-blur-sm">
			<div className="flex items-center gap-2 overflow-x-auto py-0.5 scrollbar-none">
				<span className="flex items-center gap-1 pl-1 font-medium text-neutral-400 text-xs whitespace-nowrap">
					<History className="h-3.5 w-3.5" />
					기록:
				</span>
				{recentSigns.map((item) => (
					<span
						key={item.timestamp}
						className="flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800/80 px-2 py-1 font-medium text-neutral-200 text-xs whitespace-nowrap"
					>
						<span>{item.icon}</span>
						<span>{item.label}</span>
					</span>
				))}
			</div>
			<button
				type="button"
				onClick={onClear}
				className="ml-2 text-neutral-500 text-xs whitespace-nowrap hover:text-neutral-300"
			>
				지우기
			</button>
		</div>
	);
}

function GesturesGuide({ onClose }: { onClose: () => void }) {
	return (
		<div className="w-full rounded-xl border border-neutral-800 bg-neutral-900/90 p-4 text-neutral-200 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
			<div className="mb-3 flex items-center justify-between border-neutral-800 border-b pb-2">
				<h5 className="flex items-center gap-2 font-semibold text-sm text-white">
					<Sparkles className="h-4 w-4 text-amber-400" />
					인식 가능한 수어 & 제스처 가이드
				</h5>
				<button
					type="button"
					onClick={onClose}
					className="text-neutral-400 text-xs hover:text-white"
				>
					닫기
				</button>
			</div>
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
				{SUPPORTED_SIGNS.map((sign) => (
					<div
						key={sign.label}
						className="flex items-start gap-2.5 rounded-lg border border-neutral-700/50 bg-neutral-800/60 p-2.5"
					>
						<span className="text-xl">{sign.icon}</span>
						<div className="min-w-0 flex-1">
							<div className="truncate font-medium text-white text-xs">{sign.label}</div>
							<div className="text-[11px] text-neutral-400 leading-tight">{sign.desc}</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

/** Camera preview for the signer — runs Hand Landmarker locally and shows the last recognized phrase. */
export function SignCaptureView({
	room = null,
	className = "",
}: {
	room?: Room | null;
	className?: string;
}) {
	const {
		videoRef,
		canvasRef,
		isCameraActive,
		cameraError,
		isLoadingModel,
		isModelReady,
		showSkeleton,
		detectedHandsCount,
		activeSign,
		recentSigns,
		recognizedText,
		toggleCamera,
		toggleSkeleton,
		clearHistory,
	} = useSignCapture(room);

	const [showGuide, setShowGuide] = useState(false);

	return (
		<div className={`flex w-full max-w-2xl flex-col items-center gap-3 ${className}`}>
			{/* Camera Feed Container */}
			<div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl">
				{/* Video Feed (mirrored for natural interaction) */}
				<video
					ref={videoRef}
					autoPlay
					muted
					playsInline
					className={`h-full w-full object-cover transition-opacity duration-300 ${
						isCameraActive ? "scale-x-[-1] opacity-100" : "opacity-0"
					}`}
				>
					<track kind="captions" />
				</video>

				{/* Hand Landmark Skeleton Canvas Overlay */}
				<canvas
					ref={canvasRef}
					className="pointer-events-none absolute inset-0 h-full w-full object-cover"
				/>

				{/* Top Controls & Status Bar */}
				<div className="pointer-events-auto absolute top-3 right-3 left-3 flex items-center justify-between">
					<CameraStatusBar
						isLoadingModel={isLoadingModel}
						isModelReady={isModelReady}
						isCameraActive={isCameraActive}
						detectedHandsCount={detectedHandsCount}
					/>

					{/* Action Buttons */}
					<div className="flex items-center gap-1.5">
						<button
							type="button"
							onClick={toggleSkeleton}
							title={showSkeleton ? "스켈레톤 숨기기" : "스켈레톤 표시"}
							className={`flex h-8 w-8 items-center justify-center rounded-lg border backdrop-blur-md transition-colors ${
								showSkeleton
									? "border-blue-400/40 bg-blue-600/80 text-white"
									: "border-white/10 bg-black/50 text-neutral-400 hover:text-white"
							}`}
						>
							{showSkeleton ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
						</button>

						<button
							type="button"
							onClick={toggleCamera}
							title={isCameraActive ? "카메라 끄기" : "카메라 켜기"}
							className={`flex h-8 w-8 items-center justify-center rounded-lg border backdrop-blur-md transition-colors ${
								isCameraActive
									? "border-white/10 bg-neutral-800/80 text-white hover:bg-neutral-700/80"
									: "border-red-400/40 bg-red-600/80 text-white"
							}`}
						>
							{isCameraActive ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
						</button>

						<button
							type="button"
							onClick={() => setShowGuide((prev) => !prev)}
							title="수어 제스처 가이드"
							className={`flex h-8 w-8 items-center justify-center rounded-lg border backdrop-blur-md transition-colors ${
								showGuide
									? "border-amber-300/40 bg-amber-500/80 text-white"
									: "border-white/10 bg-black/50 text-neutral-400 hover:text-white"
							}`}
						>
							<HelpCircle className="h-4 w-4" />
						</button>
					</div>
				</div>

				{/* Camera Inactive / Error Overlay */}
				{(!isCameraActive || cameraError) && (
					<CameraDisabledState cameraError={cameraError} onRetry={toggleCamera} />
				)}

				{/* Bottom Active Recognized Sign HUD */}
				{isCameraActive && (
					<div className="absolute right-3 bottom-3 left-3 flex flex-col items-center">
						<ActiveSignOverlay activeSign={activeSign} recognizedText={recognizedText} />
					</div>
				)}
			</div>

			{/* Recognition History Log */}
			<RecentSignsHistory recentSigns={recentSigns} onClear={clearHistory} />

			{/* Supported Gestures Guide Card */}
			{showGuide && <GesturesGuide onClose={() => setShowGuide(false)} />}
		</div>
	);
}
