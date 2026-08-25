import type { Room } from "livekit-client";
import {
	Activity,
	Bot,
	Camera,
	CameraOff,
	ChevronDown,
	Eye,
	EyeOff,
	Hand,
	HelpCircle,
	History,
	Plus,
	Sparkles,
	Trash2,
	User,
} from "lucide-react";
import { useState } from "react";
import type { CaptionType } from "@/entities/caption";
import { Button, Input } from "@/shared/ui";
import { KSL_WORD_METADATA } from "../model/sign-model";
import type { RecognizedSign } from "../model/types";
import { useSignCapture } from "../model/use-sign-capture";

// Only the real, sequence-trained KSL words -- the guide used to also list a handful of
// single-frame static gestures (thumbs up, OK sign, finger-counted numbers), but that
// recognizer was removed (see use-sign-capture.ts's docstring), so listing them here
// would promise something that no longer works.
const KSL_VOCABULARY_LIST = Object.entries(KSL_WORD_METADATA).map(([label, meta]) => ({
	label,
	icon: meta.icon,
	desc: meta.description,
}));

function CameraStatusBar({
	isLoadingModel,
	isModelReady,
	isCameraActive,
	detectedHandsCount,
	isArmDetected,
}: {
	isLoadingModel: boolean;
	isModelReady: boolean;
	isCameraActive: boolean;
	detectedHandsCount: number;
	isArmDetected: boolean;
}) {
	return (
		<div className="flex items-center gap-1.5 overflow-x-auto">
			{isLoadingModel && (
				<span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/20 px-2.5 py-0.5 font-medium text-amber-300 text-xs backdrop-blur-md whitespace-nowrap">
					<Activity className="h-3 w-3 animate-spin" />
					AI 로딩 중
				</span>
			)}

			{isModelReady && isCameraActive && (
				<span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-0.5 font-medium text-emerald-300 text-xs backdrop-blur-md whitespace-nowrap">
					<Sparkles className="h-3 w-3" />
					하이브리드 AI
				</span>
			)}

			{isCameraActive && (
				<>
					<span
						className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-medium text-xs backdrop-blur-md whitespace-nowrap ${
							isArmDetected
								? "border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
								: "border-white/10 bg-black/40 text-neutral-400"
						}`}
					>
						<User className="h-3 w-3" />
						{isArmDetected ? "상체/팔 감지" : "팔 대기"}
					</span>

					<span
						className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-medium text-xs backdrop-blur-md whitespace-nowrap ${
							detectedHandsCount > 0
								? "border-blue-500/30 bg-blue-500/20 text-blue-300"
								: "border-white/10 bg-black/40 text-neutral-400"
						}`}
					>
						<Hand className="h-3 w-3" />
						{detectedHandsCount > 0 ? `${detectedHandsCount}개 손` : "손 대기"}
					</span>
				</>
			)}
		</div>
	);
}

function SentenceResultBanner({
	composedSentence,
	isComposing,
}: {
	composedSentence: string | null;
	isComposing: boolean;
}) {
	if (!composedSentence && !isComposing) return null;

	return (
		<div className="flex w-full items-center justify-between rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-3.5 text-emerald-200 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
			<div className="flex items-center gap-3">
				<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
					{isComposing ? (
						<Activity className="h-4 w-4 animate-spin" />
					) : (
						<Bot className="h-4 w-4" />
					)}
				</div>
				<div>
					<div className="flex items-center gap-2">
						<span className="font-semibold text-emerald-400 text-xs">
							{isComposing ? "LLM 자연어 문장 변환 중..." : "AI 실시간 번역 문장"}
						</span>
					</div>
					<p className="mt-0.5 font-bold text-sm text-white">
						{composedSentence ?? "단어들을 자연스러운 문장으로 조합하고 있습니다..."}
					</p>
				</div>
			</div>
			{!isComposing && (
				<span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 font-medium text-[11px] text-emerald-300">
					음성 발화 완료
				</span>
			)}
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
					단어 기록:
				</span>
				{recentSigns.map((item) => (
					<span
						key={item.id}
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
				초기화
			</button>
		</div>
	);
}

function CustomWordRecorder({
	references,
	isRecording,
	recordingSecond,
	recordingTotalSeconds,
	recordingResult,
	onStartRecording,
	onCancelRecording,
	onRemove,
}: {
	references: Record<string, number>;
	isRecording: boolean;
	recordingSecond: number;
	recordingTotalSeconds: number;
	recordingResult: { ok: boolean; message: string } | null;
	onStartRecording: (word: string) => boolean;
	onCancelRecording: () => void;
	onRemove: (word: string) => void;
}) {
	const [newWord, setNewWord] = useState("");

	const handleStart = () => {
		const word = newWord.trim();
		if (!word) return;
		onStartRecording(word);
	};

	return (
		<details className="w-full rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 text-neutral-200 text-sm backdrop-blur-sm">
			<summary className="flex cursor-pointer items-center justify-between font-medium text-neutral-300 text-xs hover:text-white">
				<span>고급: 모델에 없는 나만의 수어 단어 등록 (DTW 매칭)</span>
				<ChevronDown className="h-4 w-4 text-neutral-400" />
			</summary>
			<div className="flex flex-col gap-2.5 pt-3">
				<p className="text-neutral-400 text-xs leading-relaxed">
					기본 모델에 없는 단어(예: 병원, 예약, 도움)를 등록해보세요. "학습 시작"을 누르면{" "}
					{recordingTotalSeconds}초 동안 1초에 한 번씩 그 단어의 동작을 반복해주시면 자동으로 나눠서
					저장합니다.
				</p>
				<div className="flex gap-2">
					<Input
						placeholder="단어 이름 (예: 병원)"
						value={newWord}
						onChange={(e) => setNewWord(e.target.value)}
						disabled={isRecording}
						className="h-9 border-neutral-700 bg-neutral-800/80 text-xs text-white"
					/>
					{isRecording ? (
						<Button
							size="sm"
							variant="outline"
							onClick={onCancelRecording}
							className="shrink-0 gap-1 border-red-500/40 text-red-300 hover:bg-red-500/10"
						>
							취소
						</Button>
					) : (
						<Button
							size="sm"
							disabled={!newWord.trim()}
							onClick={handleStart}
							className="shrink-0 gap-1 bg-blue-600 hover:bg-blue-500"
						>
							<Plus className="h-3.5 w-3.5" />
							학습 시작
						</Button>
					)}
				</div>

				{isRecording && (
					<div className="flex flex-col gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 p-2.5">
						<span className="font-semibold text-blue-300 text-xs">
							{recordingSecond}초 / {recordingTotalSeconds}초 — 1초에 한 번씩 동작을 반복해주세요
						</span>
						<div className="flex gap-1">
							{Array.from({ length: recordingTotalSeconds }, (_, i) => (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length tick display, never reordered
									key={i}
									className={`h-1.5 flex-1 rounded-full transition-colors ${
										i < recordingSecond ? "bg-blue-400" : "bg-neutral-700"
									}`}
								/>
							))}
						</div>
					</div>
				)}

				{!isRecording && recordingResult && (
					<p
						className={`font-medium text-xs ${recordingResult.ok ? "text-emerald-300" : "text-amber-300"}`}
					>
						{recordingResult.message}
					</p>
				)}

				{Object.keys(references).length > 0 && (
					<ul className="mt-1 flex flex-col gap-1 border-neutral-800 border-t pt-2">
						{Object.entries(references).map(([word, count]) => (
							<li key={word} className="flex items-center justify-between gap-2 py-0.5 text-xs">
								<span className="text-neutral-300">
									{word} <span className="text-neutral-500">({count}개 샘플)</span>
								</span>
								<button
									type="button"
									onClick={() => onRemove(word)}
									disabled={isRecording}
									className="flex items-center gap-1 text-red-400 hover:text-red-300 disabled:opacity-40"
								>
									<Trash2 className="h-3 w-3" />
									삭제
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</details>
	);
}

function GesturesGuide({ onClose }: { onClose: () => void }) {
	return (
		<div className="w-full rounded-xl border border-neutral-800 bg-neutral-900/95 p-4 text-neutral-200 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
			<div className="mb-3 flex items-center justify-between border-neutral-800 border-b pb-2">
				<h5 className="flex items-center gap-2 font-semibold text-sm text-white">
					<Sparkles className="h-4 w-4 text-blue-400" />
					지원하는 한국수어(KSL) 단어
				</h5>
				<button
					type="button"
					onClick={onClose}
					className="text-neutral-400 text-xs hover:text-white"
				>
					닫기
				</button>
			</div>
			<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{KSL_VOCABULARY_LIST.map((sign) => (
					<div
						key={sign.label}
						className="flex items-start gap-2.5 rounded-lg border border-neutral-700/50 bg-neutral-800/70 p-2.5"
					>
						<span className="text-xl">{sign.icon}</span>
						<div className="min-w-0 flex-1">
							<span className="truncate font-semibold text-white text-xs">{sign.label}</span>
							<div className="mt-0.5 text-[11px] text-neutral-400 leading-tight">{sign.desc}</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

/** Camera preview for the signer — runs Hand & Pose Landmarker locally, recognizing signs from the 30-frame sequence window (LSTM + DTW). */
export function SignCaptureView({
	room = null,
	captions = [],
	className = "",
}: {
	room?: Room | null;
	captions?: CaptionType[];
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
		isArmDetected,
		isComposing,
		recentSigns,
		composedSentence,
		references,
		isRecordingWord,
		recordingSecond,
		recordingTotalSeconds,
		recordingResult,
		toggleCamera,
		toggleSkeleton,
		clearHistory,
		startRecordingReference,
		cancelRecordingReference,
		removeReference,
	} = useSignCapture(room, captions);

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

				{/* Full-Body Arm & Hand Landmark Skeleton Canvas Overlay */}
				<canvas
					ref={canvasRef}
					className="pointer-events-none absolute inset-0 h-full w-full object-cover"
				/>

				{/* Top Controls & Status Bar */}
				<div className="pointer-events-auto absolute top-3 right-3 left-3 flex items-center justify-between gap-2">
					<CameraStatusBar
						isLoadingModel={isLoadingModel}
						isModelReady={isModelReady}
						isCameraActive={isCameraActive}
						detectedHandsCount={detectedHandsCount}
						isArmDetected={isArmDetected}
					/>

					{/* Action Buttons */}
					<div className="flex shrink-0 items-center gap-1.5">
						<button
							type="button"
							onClick={toggleSkeleton}
							title={showSkeleton ? "스켈레톤 숨기기" : "스켈레톤 표시"}
							className={`flex h-8 w-8 items-center justify-center rounded-lg border backdrop-blur-md transition-colors ${
								showSkeleton
									? "border-emerald-400/40 bg-emerald-600/80 text-white"
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
							title="수어 동작 가이드"
							className={`flex h-8 w-8 items-center justify-center rounded-lg border backdrop-blur-md transition-colors ${
								showGuide
									? "border-blue-400/40 bg-blue-600/80 text-white"
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
			</div>

			{/* AI Translated Natural Sentence Banner */}
			<SentenceResultBanner composedSentence={composedSentence} isComposing={isComposing} />

			{/* Recognition History Log */}
			<RecentSignsHistory recentSigns={recentSigns} onClear={clearHistory} />

			{/* Custom DTW Word Recording Component */}
			<CustomWordRecorder
				references={references}
				isRecording={isRecordingWord}
				recordingSecond={recordingSecond}
				recordingTotalSeconds={recordingTotalSeconds}
				recordingResult={recordingResult}
				onStartRecording={startRecordingReference}
				onCancelRecording={cancelRecordingReference}
				onRemove={removeReference}
			/>

			{/* Supported Gestures Guide Card */}
			{showGuide && <GesturesGuide onClose={() => setShowGuide(false)} />}
		</div>
	);
}
