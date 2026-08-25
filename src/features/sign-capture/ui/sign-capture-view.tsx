import type { Room } from "livekit-client";
import {
	Activity,
	Bot,
	Camera,
	CameraOff,
	CheckCircle2,
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
import { useEffect, useState } from "react";
import type { CaptionType } from "@/entities/caption";
import { Button, Input } from "@/shared/ui";
import { DEFAULT_DTW_THRESHOLD } from "../model/dtw";
import type { RecognizedSign } from "../model/types";
import {
	type RecognitionDebug,
	UTTERANCE_PAUSE_MS,
	useSignCapture,
} from "../model/use-sign-capture";
import { KSL_WORD_METADATA } from "../model/word-metadata";

// Suggested starter vocabulary for the guide -- recognition is DTW-only now, so none of these
// (or any word) are recognized until the signer actually records them via the "고급: 나만의
// 수어 단어 등록" flow. This list is just icons/descriptions to help someone decide what to
// record first, not a promise that these already work.
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
					동작 인식 준비됨
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

// Live single-word recognition indicator -- a compact badge, not the full accumulated
// caption (the translated-sentence list below now covers that role), just enough to
// confirm recognition is actually running while signing.
function ActiveSignBadge({ activeSign }: { activeSign: RecognizedSign | null }) {
	if (!activeSign) return null;

	return (
		<div className="flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-black/70 px-3 py-1 text-white text-xs shadow-lg backdrop-blur-md animate-in fade-in">
			<span className="text-base">{activeSign.icon}</span>
			<span className="font-semibold">{activeSign.label}</span>
			<span className="rounded border border-blue-400/30 bg-blue-500/20 px-1.5 py-0.5 font-semibold text-[10px] text-blue-300">
				{Math.round(activeSign.confidence * 100)}%
			</span>
			<span className="flex items-center gap-1 font-medium text-emerald-400">
				<CheckCircle2 className="h-3 w-3" />
				인식 중
			</span>
		</div>
	);
}

// Always-on technical readout of what the recognizer is actually seeing -- the closest DTW
// reference (even above threshold, so a near-miss custom word is visible instead of the
// recognizer just looking silently broken).
function RecognitionDebugStrip({ debug }: { debug: RecognitionDebug | null }) {
	if (!debug) return null;

	const dtwText = debug.dtwWord
		? `${debug.dtwWord} · 거리 ${debug.dtwDistance?.toFixed(2)} / 임계값 ${DEFAULT_DTW_THRESHOLD}`
		: "저장된 커스텀 단어 없음";

	return (
		<div className="flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 font-mono text-[11px] text-neutral-400">
			<span>DTW 최근접: {dtwText}</span>
		</div>
	);
}

// Ticks locally (display-only) so the signer knows exactly how much longer to wait before the
// buffered words get sent off for translation, instead of the 3s pause being invisible.
function UtteranceCountdown({
	wordBuffer,
	lastConfirmedAt,
	isComposing,
}: {
	wordBuffer: string[];
	lastConfirmedAt: number | null;
	isComposing: boolean;
}) {
	const pending = wordBuffer.length > 0 && !isComposing && lastConfirmedAt !== null;
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (!pending) return;
		const id = setInterval(() => setNow(Date.now()), 200);
		return () => clearInterval(id);
	}, [pending]);

	if (!pending || lastConfirmedAt === null) return null;

	const remainingMs = UTTERANCE_PAUSE_MS - (now - lastConfirmedAt);
	if (remainingMs <= 0) return null;

	return (
		<p className="text-[11px] text-neutral-400">
			{Math.ceil(remainingMs / 1000)}초간 더 동작이 없으면 "{wordBuffer.join(" ")}"를 문장으로
			번역합니다.
		</p>
	);
}

const MAX_SHOWN_SENTENCES = 5;

// Rolling log of translated sentences (newest first) rather than a single line that gets
// replaced -- translation keeps firing for every utterance, and showing only the latest one
// made it look like it only ever ran once.
function SentenceResultBanner({
	composedSentences,
	isComposing,
}: {
	composedSentences: string[];
	isComposing: boolean;
}) {
	if (composedSentences.length === 0 && !isComposing) return null;

	const recent = composedSentences
		.map((sentence, index) => ({ sentence, index }))
		.slice(-MAX_SHOWN_SENTENCES)
		.reverse();

	return (
		<div className="flex w-full flex-col gap-2.5 rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-3.5 text-emerald-200 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
			<div className="flex items-center gap-2">
				<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
					{isComposing ? (
						<Activity className="h-4 w-4 animate-spin" />
					) : (
						<Bot className="h-4 w-4" />
					)}
				</div>
				<span className="font-semibold text-emerald-400 text-xs">
					{isComposing ? "LLM 자연어 문장 변환 중..." : "AI 실시간 번역 문장"}
				</span>
			</div>
			<div className="flex flex-col gap-1.5 pl-1">
				{isComposing && recent.length === 0 && (
					<p className="text-sm text-white/70">단어들을 자연스러운 문장으로 조합하고 있습니다...</p>
				)}
				{recent.map(({ sentence, index }, i) => (
					<p
						key={index}
						className={i === 0 ? "font-bold text-sm text-white" : "text-emerald-200/60 text-xs"}
					>
						{sentence}
					</p>
				))}
			</div>
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
	recordingTotalReps,
	recordingRepIntervalSeconds,
	recordingResult,
	onStartRecording,
	onFinishNow,
	onCancelRecording,
	onRemove,
}: {
	references: Record<string, number>;
	isRecording: boolean;
	recordingSecond: number;
	recordingTotalSeconds: number;
	recordingTotalReps: number;
	recordingRepIntervalSeconds: number;
	recordingResult: { ok: boolean; message: string } | null;
	onStartRecording: (word: string) => boolean;
	onFinishNow: () => void;
	onCancelRecording: () => void;
	onRemove: (word: string) => void;
}) {
	// recordingSecond is elapsed whole seconds (1..recordingTotalSeconds); derive which rep
	// beat that falls into so the cadence bar shows reps, not raw seconds.
	const currentRep = Math.min(
		recordingTotalReps,
		Math.floor((recordingSecond - 1) / recordingRepIntervalSeconds) + 1,
	);
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
					{recordingTotalSeconds}초 동안 {recordingRepIntervalSeconds}초에 한 번씩 그 단어의 동작을
					반복해주시면(총 {recordingTotalReps}번) 자동으로 나눠서 저장합니다.
				</p>
				<div className="flex items-center gap-2">
					<Input
						placeholder="단어 이름 (예: 병원)"
						value={newWord}
						onChange={(e) => setNewWord(e.target.value)}
						disabled={isRecording}
						className="h-9 border-neutral-700 bg-neutral-800/80 text-xs text-white"
					/>
					{isRecording ? (
						<>
							<Button
								size="sm"
								onClick={onFinishNow}
								className="shrink-0 gap-1 bg-blue-600 hover:bg-blue-500"
							>
								완료(지금까지 저장)
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={onCancelRecording}
								className="shrink-0 gap-1 border-red-500/40 text-red-300 hover:bg-red-500/10"
							>
								취소(저장 안 함)
							</Button>
						</>
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
					<div className="flex flex-col gap-1.5">
						<div className="flex items-center justify-between text-xs">
							<span className="font-medium text-blue-300">
								{recordingRepIntervalSeconds}초에 한 번씩 동작을 반복해주세요
							</span>
							<span className="font-mono text-blue-300/70 tabular-nums">
								{currentRep}/{recordingTotalReps}
							</span>
						</div>
						{/* Cadence bar: one segment per rep (not per second) -- the current beat
						    pulses as the cue for "repeat the gesture now" rather than making the
						    signer read and do math on a raw seconds counter. */}
						<div className="flex gap-1">
							{Array.from({ length: recordingTotalReps }, (_, i) => {
								const isPast = i < currentRep - 1;
								const isCurrentBeat = i === currentRep - 1;
								return (
									<div
										// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length beat display, never reordered
										key={i}
										className={`h-2 flex-1 rounded-full transition-colors ${
											isPast || isCurrentBeat ? "bg-blue-400" : "bg-neutral-700"
										} ${isCurrentBeat ? "animate-pulse" : ""}`}
									/>
								);
							})}
						</div>
						<p className="text-[11px] text-neutral-500">
							반복이 끝났다면 {recordingTotalSeconds}초를 다 기다리지 않고 "완료(지금까지 저장)"를
							눌러도 그때까지 녹화된 반복이 저장됩니다.
						</p>
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
					추천 시작 단어 (아래에서 직접 녹화해야 인식됩니다)
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

/** Camera preview for the signer — runs Hand & Pose Landmarker locally, recognizing signs from the 30-frame sequence window via DTW matching against signer-recorded words. */
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
		activeSign,
		lastConfirmedSign,
		recentSigns,
		wordBuffer,
		composedSentences,
		references,
		recognitionDebug,
		isRecordingWord,
		recordingSecond,
		recordingTotalSeconds,
		recordingTotalReps,
		recordingRepIntervalSeconds,
		recordingResult,
		toggleCamera,
		toggleSkeleton,
		clearHistory,
		startRecordingReference,
		finishRecordingNow,
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

				{/* Live single-word recognition indicator */}
				{isCameraActive && (
					<div className="absolute right-3 bottom-3 left-3 flex justify-center">
						<ActiveSignBadge activeSign={activeSign} />
					</div>
				)}
			</div>

			{/* Recognition Clarity: what DTW is actually seeing right now */}
			<RecognitionDebugStrip debug={recognitionDebug} />

			{/* When the buffered words will be sent off for translation */}
			<UtteranceCountdown
				wordBuffer={wordBuffer}
				lastConfirmedAt={lastConfirmedSign?.timestamp ?? null}
				isComposing={isComposing}
			/>

			{/* AI Translated Natural Sentence Banner */}
			<SentenceResultBanner composedSentences={composedSentences} isComposing={isComposing} />

			{/* Recognition History Log */}
			<RecentSignsHistory recentSigns={recentSigns} onClear={clearHistory} />

			{/* Custom DTW Word Recording Component */}
			<CustomWordRecorder
				references={references}
				isRecording={isRecordingWord}
				recordingSecond={recordingSecond}
				recordingTotalSeconds={recordingTotalSeconds}
				recordingTotalReps={recordingTotalReps}
				recordingRepIntervalSeconds={recordingRepIntervalSeconds}
				recordingResult={recordingResult}
				onStartRecording={startRecordingReference}
				onFinishNow={finishRecordingNow}
				onCancelRecording={cancelRecordingReference}
				onRemove={removeReference}
			/>

			{/* Supported Gestures Guide Card */}
			{showGuide && <GesturesGuide onClose={() => setShowGuide(false)} />}
		</div>
	);
}
