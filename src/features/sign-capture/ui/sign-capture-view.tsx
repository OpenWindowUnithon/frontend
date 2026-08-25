import type { Room } from "livekit-client";
import {
	Activity,
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
import { useState } from "react";
import { Button, Input } from "@/shared/ui";
import type { RecognizedSign } from "../model/sign-recognizer";
import { useSignCapture } from "../model/use-sign-capture";

const SUPPORTED_SIGNS = [
	{ label: "안녕하세요", icon: "👋", desc: "손과 팔을 들어 인사하거나 정중히 모으기 (KSL)" },
	{ label: "감사합니다", icon: "🙏", desc: "왼손 등 위에 오른손을 얹어 톡톡 두드리기 (KSL)" },
	{ label: "식사 / 밥", icon: "🍚", desc: "손을 입/턱 쪽으로 가져가 식사 표현 (KSL)" },
	{ label: "만나다", icon: "👥", desc: "양손을 가슴 중앙으로 모아 만남 표현 (KSL)" },
	{ label: "사랑합니다", icon: "🤟", desc: "엄지, 검지, 새끼를 편 사랑의 수어 (I Love You)" },
	{ label: "나 / 저", icon: "🙋", desc: "검지손가락으로 자신의 가슴 중앙 가리키기" },
	{ label: "최고예요 / 좋아요", icon: "👍", desc: "엄지손가락을 세워 긍정과 칭찬 표현" },
	{ label: "확인 / OK", icon: "👌", desc: "엄지와 검지로 동그란 원 만들기" },
	{ label: "승리 / 화이팅", icon: "✌️", desc: "V자 손가락 펼치기 (숫자 2)" },
	{ label: "부탁 / 죄송", icon: "🙇‍♂️", desc: "가슴 앞에서 두 손 모으기" },
	{ label: "1, 3, 4 (지화 숫자)", icon: "☝️", desc: "손가락 개수로 숫자 표현" },
	{ label: "지화 'ㄴ' / 'ㅁ'", icon: "🔤", desc: "한글 지화 L자형 / 주먹" },
];

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
					AI 활성
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
						{isArmDetected ? "팔/상체 감지됨" : "팔 대기"}
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

function ActiveSignOverlay({
	activeSign,
	recognizedText,
	composedSentence,
}: {
	activeSign: RecognizedSign | null;
	recognizedText: string | null;
	composedSentence: string | null;
}) {
	if (activeSign) {
		return (
			<div className="flex w-full items-center justify-between rounded-xl border border-blue-500/40 bg-black/80 px-4 py-2 text-white shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95">
				<div className="flex items-center gap-3">
					<span className="text-2xl">{activeSign.icon}</span>
					<div className="text-left">
						<div className="flex items-center gap-2">
							<span className="font-bold text-base text-white">{activeSign.label}</span>
							<span className="rounded border border-blue-400/30 bg-blue-500/20 px-1.5 py-0.5 font-semibold text-[10px] text-blue-300">
								{Math.round(activeSign.confidence * 100)}%
							</span>
						</div>
						<p className="text-neutral-400 text-xs">{activeSign.description}</p>
					</div>
				</div>
				<div className="flex items-center gap-1 font-medium text-emerald-400 text-xs">
					<CheckCircle2 className="h-4 w-4" />
					<span>인식 중</span>
				</div>
			</div>
		);
	}

	return (
		<div className="flex max-w-full flex-col items-center gap-1">
			{composedSentence && (
				<div className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-black/80 px-4 py-1 text-emerald-300 text-xs shadow-lg backdrop-blur-md animate-in fade-in">
					<Sparkles className="h-3.5 w-3.5" />
					<span className="font-medium">번역: "{composedSentence}"</span>
				</div>
			)}
			<div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-4 py-1.5 text-neutral-300 text-xs backdrop-blur-md">
				<Hand className="h-3.5 w-3.5 text-neutral-400" />
				<span className="truncate">
					{recognizedText
						? `인식 단어: ${recognizedText}`
						: "팔과 손을 움직여 '안녕하세요', '감사합니다' 등 수어를 표현해보세요"}
				</span>
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
					기록:
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
				지우기
			</button>
		</div>
	);
}

function CustomWordRecorder({
	references,
	onRecord,
	onRemove,
}: {
	references: Record<string, number>;
	onRecord: (word: string) => boolean;
	onRemove: (word: string) => void;
}) {
	const [newWord, setNewWord] = useState("");
	const [recordHint, setRecordHint] = useState<string | null>(null);

	const handleRecord = () => {
		const word = newWord.trim();
		if (!word) return;
		const ok = onRecord(word);
		if (ok) {
			setRecordHint(`'${word}' 동작 샘플을 저장했습니다.`);
			setNewWord("");
		} else {
			setRecordHint("카메라 프레임이 충분히 모이지 않았습니다. 잠시 후 다시 눌러주세요.");
		}
	};

	return (
		<details className="w-full rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 text-neutral-200 text-sm backdrop-blur-sm">
			<summary className="flex cursor-pointer items-center justify-between font-medium text-neutral-300 text-xs hover:text-white">
				<span>고급: 모델에 없는 나만의 수어 단어 등록 (DTW)</span>
				<ChevronDown className="h-4 w-4 text-neutral-400" />
			</summary>
			<div className="flex flex-col gap-2.5 pt-3">
				<p className="text-neutral-400 text-xs leading-relaxed">
					모델에 없는 단어(예: 병원, 예약, 도움)를 카메라 앞에서 수어로 표현한 뒤 "이 동작 저장"을
					누르면, 브라우저가 기억하여 다음부터 인식합니다.
				</p>
				<div className="flex gap-2">
					<Input
						placeholder="단어 이름 (예: 병원)"
						value={newWord}
						onChange={(e) => setNewWord(e.target.value)}
						className="h-9 border-neutral-700 bg-neutral-800/80 text-xs text-white"
					/>
					<Button
						size="sm"
						disabled={!newWord.trim()}
						onClick={handleRecord}
						className="shrink-0 gap-1 bg-blue-600 hover:bg-blue-500"
					>
						<Plus className="h-3.5 w-3.5" />
						동작 저장
					</Button>
				</div>
				{recordHint && <p className="font-medium text-amber-300 text-xs">{recordHint}</p>}
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
									className="flex items-center gap-1 text-red-400 hover:text-red-300"
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
					<Sparkles className="h-4 w-4 text-blue-400" />팔 & 손 한국 수어(KSL) 인식 동작 가이드
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
				{SUPPORTED_SIGNS.map((sign) => (
					<div
						key={sign.label}
						className="flex items-start gap-2.5 rounded-lg border border-neutral-700/50 bg-neutral-800/70 p-2.5"
					>
						<span className="text-xl">{sign.icon}</span>
						<div className="min-w-0 flex-1">
							<div className="truncate font-semibold text-white text-xs">{sign.label}</div>
							<div className="mt-0.5 text-[11px] text-neutral-400 leading-tight">{sign.desc}</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

/** Camera preview for the signer — runs Hand & Pose Landmarker locally and tracks full arm signs. */
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
		isArmDetected,
		activeSign,
		recentSigns,
		recognizedText,
		composedSentence,
		references,
		toggleCamera,
		toggleSkeleton,
		clearHistory,
		recordReference,
		removeReference,
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

				{/* Bottom Active Recognized Sign HUD */}
				{isCameraActive && (
					<div className="absolute right-3 bottom-3 left-3 flex flex-col items-center">
						<ActiveSignOverlay
							activeSign={activeSign}
							recognizedText={recognizedText}
							composedSentence={composedSentence}
						/>
					</div>
				)}
			</div>

			{/* Recognition History Log */}
			<RecentSignsHistory recentSigns={recentSigns} onClear={clearHistory} />

			{/* Custom DTW Word Recording Component */}
			<CustomWordRecorder
				references={references}
				onRecord={recordReference}
				onRemove={removeReference}
			/>

			{/* Supported Gestures Guide Card */}
			{showGuide && <GesturesGuide onClose={() => setShowGuide(false)} />}
		</div>
	);
}
