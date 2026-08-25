import {
	IconGridDot5Fill,
	IconPaperplaneFill,
	IconPhoneXmarkFill,
	IconSpeakerWave2Fill,
	IconSpeakerWave2SlashFill,
} from "@karrotmarket/react-monochrome-icon";
import { PrefixIcon } from "@seed-design/react";
import { useNavigate } from "@tanstack/react-router";
import type { Room } from "livekit-client";
import {
	type Dispatch,
	type ReactNode,
	type SetStateAction,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	type CallMode,
	type CommunicationMode,
	getCallPreferences,
	sendChatText,
} from "@/entities/call";
import { Caption } from "@/entities/caption";
import { AgentAudioPlayer } from "@/features/play-agent-audio";
import { CaptionList, useReceiveCaptions } from "@/features/receive-captions";
import { SignCaptureView } from "@/features/sign-capture";
import { MicToggleButton } from "@/features/toggle-mic";
import { ActionButton, TextField, TextFieldTextarea } from "@/shared/ui";

interface CallRoomProps {
	room: Room;
	mode: CallMode;
	communication: CommunicationMode;
	contactName: string;
	phone: string;
	seconds: number;
	onEnd: () => Promise<void>;
	endedExternally: boolean;
}

type TextMessage = {
	id: number;
	text: string;
	state: "sending" | "sent" | "failed";
};

function formatDuration(seconds: number) {
	return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function CallHeader({
	contactName,
	seconds,
	onEnd,
	ending,
}: Pick<CallRoomProps, "contactName" | "seconds"> & { onEnd: () => void; ending: boolean }) {
	return (
		<header className="flex items-center gap-4 px-5 pb-4 pt-6">
			<div className="min-w-0 flex-1">
				<h1 className="truncate text-xl font-bold tracking-tight">{contactName}</h1>
				<p className="mt-0.5 text-base tabular-nums text-muted-foreground">
					<span className="sr-only">통화 시간 </span>
					{formatDuration(seconds)}
				</p>
			</div>
			<button
				type="button"
				onClick={onEnd}
				disabled={ending}
				className="min-h-12 shrink-0 rounded-full bg-destructive px-5 text-base font-bold text-white transition-colors focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
			>
				{ending ? "종료 중…" : "종료"}
			</button>
		</header>
	);
}

function TextCallHeader({ contactName, seconds }: Pick<CallRoomProps, "contactName" | "seconds">) {
	return (
		<header className="px-6 pb-4 pt-7 text-center">
			<p className="text-sm font-medium tabular-nums text-muted-foreground">
				<span className="sr-only">통화 시간 </span>
				{formatDuration(seconds)}
			</p>
			<h1 className="mt-1 truncate text-2xl font-bold tracking-tight">{contactName}</h1>
		</header>
	);
}

function TextCall({
	room,
	captions,
	renderControls,
	draft,
	setDraft,
	messages,
	setMessages,
}: {
	room: Room;
	captions: ReturnType<typeof useReceiveCaptions>;
	renderControls: (focusInput: () => void) => ReactNode;
	draft: string;
	setDraft: Dispatch<SetStateAction<string>>;
	messages: TextMessage[];
	setMessages: Dispatch<SetStateAction<TextMessage[]>>;
}) {
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const bottomRef = useRef<HTMLDivElement>(null);
	const autoScroll = useRef(getCallPreferences().captionAutoScroll);
	const captionTimes = useRef(new Map<string, number>());
	for (const caption of captions) {
		if (!captionTimes.current.has(caption.id)) captionTimes.current.set(caption.id, Date.now());
	}
	const timeline = [
		...captions.map((caption) => ({
			kind: "caption" as const,
			at: captionTimes.current.get(caption.id) ?? 0,
			caption,
		})),
		...messages.map((message) => ({ kind: "message" as const, at: message.id, message })),
	].sort((left, right) => left.at - right.at);
	const timelineVersion = `${timeline.length}:${captions.at(-1)?.text ?? ""}`;

	useEffect(() => {
		if (timelineVersion && autoScroll.current) {
			bottomRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [timelineVersion]);

	const deliver = async (text: string, existingId?: number) => {
		const clean = text.trim();
		if (!clean) return;
		const id = existingId ?? Date.now();
		setMessages((items) =>
			existingId
				? items.map((item) => (item.id === id ? { ...item, state: "sending" } : item))
				: [...items, { id, text: clean, state: "sending" }],
		);
		if (!existingId) setDraft("");
		try {
			await sendChatText(room, clean);
			setMessages((items) =>
				items.map((item) => (item.id === id ? { ...item, state: "sent" } : item)),
			);
		} catch {
			setMessages((items) =>
				items.map((item) => (item.id === id ? { ...item, state: "failed" } : item)),
			);
		}
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div
				className="min-h-40 flex-1 space-y-3 overflow-y-auto px-5 pb-4 pt-6"
				aria-label="통화 대화"
				aria-live="polite"
				role="log"
			>
				{timeline.length === 0 && (
					<p className="text-muted-foreground">상대방이 말하면 이곳에 실시간으로 표시돼요.</p>
				)}
				{timeline.map((item) =>
					item.kind === "caption" ? (
						<Caption caption={item.caption} key={`caption-${item.caption.id}`} />
					) : (
						<div className="flex justify-end" key={`message-${item.message.id}`}>
							<div
								className={`w-fit max-w-[85%] rounded-3xl rounded-tr-lg bg-accent px-5 py-3.5 text-accent-foreground ${item.message.state === "failed" ? "outline-2 outline-dashed outline-destructive" : ""}`}
							>
								<p className="whitespace-pre-wrap break-words text-lg font-medium leading-7">
									{item.message.text}
								</p>
								{item.message.state === "failed" && (
									<div className="mt-3 border-t border-background/30 pt-3">
										<p className="mb-2 text-sm text-background/80">전달하지 못했어요</p>
										<ActionButton
											variant="neutralOutline"
											size="large"
											className="h-11 w-full border-background/60 text-background hover:text-foreground"
											onClick={() => deliver(item.message.text, item.message.id)}
										>
											다시 전달
										</ActionButton>
									</div>
								)}
							</div>
						</div>
					),
				)}
				<div ref={bottomRef} />
			</div>
			<div className="sticky bottom-0 bg-card pt-2">
				<div className="px-5 pb-3">{renderControls(() => inputRef.current?.focus())}</div>
				<form
					className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
					onSubmit={(event) => {
						event.preventDefault();
						void deliver(draft);
					}}
				>
					<div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
						<TextField value={draft} onValueChange={({ value }) => setDraft(value)} size="large">
							<TextFieldTextarea
								ref={inputRef}
								aria-label="상대방에게 전달할 내용"
								placeholder="메시지 입력"
								style={{ minHeight: 56, maxHeight: 120 }}
							/>
						</TextField>
						<ActionButton
							variant="neutralSolid"
							size="large"
							className="h-14 shrink-0 rounded-full px-4"
							disabled={!draft.trim()}
							type="submit"
							aria-label="AI 음성으로 전달"
						>
							<PrefixIcon svg={<IconPaperplaneFill />} /> 전달
						</ActionButton>
					</div>
				</form>
			</div>
		</div>
	);
}

function TextCallControls({
	onEnd,
	ending,
	onFocusInput,
}: {
	onEnd: () => void;
	ending: boolean;
	onFocusInput: () => void;
}) {
	const [speakerOff, setSpeakerOff] = useState(false);
	const toggleSpeaker = () => {
		const next = !speakerOff;
		setSpeakerOff(next);
		for (const audio of document.querySelectorAll("audio")) audio.muted = next;
	};
	const controls = [
		{
			label: speakerOff ? "스피커 켜기" : "스피커 끄기",
			icon: speakerOff ? IconSpeakerWave2SlashFill : IconSpeakerWave2Fill,
			onClick: toggleSpeaker,
			active: speakerOff,
		},
		{
			label: ending ? "종료 중" : "종료",
			icon: IconPhoneXmarkFill,
			onClick: onEnd,
			active: false,
			destructive: true,
			disabled: ending,
		},
		{
			label: "입력",
			icon: IconGridDot5Fill,
			onClick: onFocusInput,
			active: false,
		},
	];

	return (
		<fieldset className="grid grid-cols-3 gap-2" aria-label="통화 제어">
			<legend className="sr-only">통화 제어</legend>
			{controls.map((control) => {
				const Icon = control.icon;
				return (
					<button
						key={control.label}
						type="button"
						onClick={control.onClick}
						disabled={control.disabled}
						aria-pressed={control.active}
						className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl text-xs font-semibold focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
					>
						<span
							className={`grid size-13 place-items-center rounded-full ${control.destructive ? "bg-destructive text-white" : control.active ? "bg-foreground text-background" : "bg-muted text-foreground"}`}
						>
							<Icon className="size-6" aria-hidden />
						</span>
						{control.label}
					</button>
				);
			})}
		</fieldset>
	);
}

function EndedCall({ contactName, seconds }: Omit<CallRoomProps, "room" | "mode" | "onEnd">) {
	const navigate = useNavigate();
	return (
		<main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-card px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-10 text-center">
			<div className="flex flex-1 flex-col items-center justify-center">
				<h1 className="text-2xl font-bold">통화가 종료되었습니다</h1>
				<p className="mt-6 text-2xl font-bold">{contactName}</p>
				<p className="mt-2 text-base tabular-nums text-muted-foreground">
					<span className="sr-only">통화 시간 </span>
					{formatDuration(seconds)}
				</p>
			</div>
			<ActionButton
				variant="neutralSolid"
				size="large"
				className="w-full"
				onClick={() => navigate({ to: "/" })}
			>
				완료
			</ActionButton>
		</main>
	);
}

function HearingRoom({ room }: { room: Room }) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-8">
			<MicToggleButton room={room} />
			<AgentAudioPlayer room={room} />
		</div>
	);
}

export function CallRoom(props: CallRoomProps) {
	const [ended, setEnded] = useState(false);
	const [ending, setEnding] = useState(false);
	const [endError, setEndError] = useState(false);
	const communication = props.communication;
	const [textDraft, setTextDraft] = useState("");
	const [textMessages, setTextMessages] = useState<TextMessage[]>([]);
	const captions = useReceiveCaptions(props.room);
	const endCall = async () => {
		setEnding(true);
		setEndError(false);
		try {
			await props.onEnd();
			setEnded(true);
		} catch {
			setEndError(true);
		} finally {
			setEnding(false);
		}
	};
	if (ended || props.endedExternally) return <EndedCall {...props} communication={communication} />;
	if (props.mode === "HEARING") {
		return (
			<main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-card">
				<section className="mx-4 mt-4 rounded-3xl bg-muted" aria-label="통화 정보와 제어">
					<CallHeader
						contactName={props.contactName}
						seconds={props.seconds}
						onEnd={() => void endCall()}
						ending={ending}
					/>
				</section>
				{endError && (
					<p className="px-5 py-2 text-center text-sm text-destructive" role="alert">
						통화를 종료하지 못했어요. 다시 시도해 주세요.
					</p>
				)}
				<HearingRoom room={props.room} />
			</main>
		);
	}

	return (
		<main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-card">
			{communication === "TEXT" ? (
				<section aria-label="통화 정보">
					<TextCallHeader contactName={props.contactName} seconds={props.seconds} />
				</section>
			) : (
				<section className="mx-4 mt-4 rounded-3xl bg-muted" aria-label="통화 정보와 제어">
					<CallHeader
						contactName={props.contactName}
						seconds={props.seconds}
						onEnd={() => void endCall()}
						ending={ending}
					/>
				</section>
			)}
			{endError && (
				<p className="px-5 py-2 text-center text-sm text-destructive" role="alert">
					통화를 종료하지 못했어요. 다시 시도해 주세요.
				</p>
			)}
			{communication === "TEXT" ? (
				<TextCall
					room={props.room}
					captions={captions}
					draft={textDraft}
					setDraft={setTextDraft}
					messages={textMessages}
					setMessages={setTextMessages}
					renderControls={(focusInput) => (
						<TextCallControls
							onEnd={() => void endCall()}
							ending={ending}
							onFocusInput={focusInput}
						/>
					)}
				/>
			) : (
				<div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
					<section className="rounded-2xl bg-muted px-4 py-3" aria-label="상대방 음성 자막">
						<CaptionList captions={captions} />
					</section>
					<SignCaptureView room={props.room} captions={captions} />
				</div>
			)}
		</main>
	);
}
