import {
	IconCheckmarkFill,
	IconLockLine,
	IconPaperplaneFill,
	IconPhoneXmarkFill,
} from "@karrotmarket/react-monochrome-icon";
import { PrefixIcon } from "@seed-design/react";
import { useNavigate } from "@tanstack/react-router";
import type { Room } from "livekit-client";
import { useState } from "react";
import { type CallMode, type CommunicationMode, sendChatText } from "@/entities/call";
import { AgentAudioPlayer } from "@/features/play-agent-audio";
import { CaptionList } from "@/features/receive-captions";
import { SignCaptureView } from "@/features/sign-capture";
import { MicToggleButton } from "@/features/toggle-mic";
import { ActionButton } from "@/shared/ui/seed-design/ui/action-button";
import { TextField, TextFieldTextarea } from "@/shared/ui/seed-design/ui/text-field";

interface CallRoomProps {
	room: Room;
	mode: CallMode;
	communication: CommunicationMode;
	contactName: string;
	phone: string;
	seconds: number;
}

function formatDuration(seconds: number) {
	return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function CallHeader({
	contactName,
	seconds,
	onEnd,
	onSwitch,
	communication,
}: Omit<CallRoomProps, "room" | "mode" | "phone"> & { onEnd: () => void; onSwitch: () => void }) {
	return (
		<header className="grid grid-cols-[72px_1fr_72px] items-center border-b px-5 py-4">
			<ActionButton variant="ghost" color="fg.critical" onClick={onEnd}>
				<PrefixIcon svg={<IconPhoneXmarkFill />} /> 종료
			</ActionButton>
			<h1 className="text-center text-lg font-bold">
				{contactName} · {formatDuration(seconds)}
			</h1>
			<ActionButton variant="ghost" onClick={onSwitch}>
				{communication === "SIGN" ? "텍스트" : "수어"}
			</ActionButton>
		</header>
	);
}

function TextCall({ room }: { room: Room }) {
	const [draft, setDraft] = useState("");
	const [messages, setMessages] = useState<
		Array<{ id: number; text: string; state: "sending" | "sent" | "failed" }>
	>([]);

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
			<div className="flex-1 space-y-4 overflow-y-auto px-5 py-6" aria-live="polite">
				<div className="rounded-2xl bg-muted p-4">
					<p className="mb-1 text-xs font-medium text-muted-foreground">상대방 · 음성 → 텍스트</p>
					<CaptionList room={room} />
				</div>
				{messages.map((message) => (
					<div className="ml-auto max-w-[86%]" key={message.id}>
						<div
							className={`rounded-2xl rounded-br-md bg-foreground p-4 text-background ${message.state === "failed" ? "outline-2 outline-dashed outline-destructive" : ""}`}
						>
							<p className="mb-1 text-xs opacity-70">나 · AI 음성</p>
							<p className="text-lg font-medium">{message.text}</p>
							{message.state === "failed" && (
								<ActionButton
									variant="neutralOutline"
									size="large"
									className="mt-3 h-12 w-full border-background/60 text-background hover:text-foreground"
									onClick={() => deliver(message.text, message.id)}
								>
									다시 전달
								</ActionButton>
							)}
						</div>
						<p
							className={`mt-1 text-right text-sm ${message.state === "failed" ? "text-destructive" : "text-muted-foreground"}`}
						>
							{message.state === "sending"
								? "전달 중…"
								: message.state === "sent"
									? "전달됨"
									: "전달 실패 · 원문은 유지됐어요"}
						</p>
					</div>
				))}
				<p className="text-sm text-muted-foreground">
					상대방의 새 발화는 이 영역의 가장 아래에서 실시간으로 갱신돼요.
				</p>
			</div>
			<form
				className="border-t p-5"
				onSubmit={(event) => {
					event.preventDefault();
					void deliver(draft);
				}}
			>
				<TextField
					value={draft}
					onValueChange={({ value }) => setDraft(value)}
					description="입력한 문장을 확인한 뒤 AI 음성으로 전달해요."
					size="large"
				>
					<TextFieldTextarea
						aria-label="상대방에게 전달할 내용"
						placeholder="상대방에게 전달할 내용을 입력하세요"
						style={{ minHeight: 96, maxHeight: 180 }}
					/>
				</TextField>
				<ActionButton
					variant="neutralSolid"
					size="large"
					className="mt-3 w-full"
					disabled={!draft.trim()}
					type="submit"
				>
					<PrefixIcon svg={<IconPaperplaneFill />} /> AI 음성으로 전달
				</ActionButton>
			</form>
		</div>
	);
}

function EndedCall({
	contactName,
	phone,
	seconds,
	communication,
}: Omit<CallRoomProps, "room" | "mode">) {
	const navigate = useNavigate();
	const maskedPhone = phone.replace(/(\d{3})-?\d{4}-(\d{4})/, "$1-****-$2");
	return (
		<main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-card px-6 py-10 text-center">
			<div className="flex flex-1 flex-col items-center justify-center">
				<div className="grid size-24 place-items-center rounded-full bg-foreground text-background">
					<IconCheckmarkFill className="size-12" aria-hidden />
				</div>
				<h1 className="mt-8 text-3xl font-bold">통화가 종료되었습니다</h1>
				<p className="mt-5 text-2xl font-bold">{contactName}</p>
				<p className="mt-1 text-muted-foreground">{maskedPhone}</p>
				<div className="mt-10 grid w-full grid-cols-2 border-y py-5">
					<div>
						<p className="text-sm text-muted-foreground">통화 시간</p>
						<strong>{formatDuration(seconds)}</strong>
					</div>
					<div className="border-l">
						<p className="text-sm text-muted-foreground">통화 방식</p>
						<strong>{communication === "SIGN" ? "수어" : "텍스트"}</strong>
					</div>
				</div>
				<div className="mt-7 w-full rounded-2xl bg-muted p-5 text-left">
					<IconLockLine className="mb-3 size-7" aria-hidden />
					<strong className="block text-lg">통화 내용은 이 기기에 저장되지 않았어요</strong>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						필요한 문장만 직접 선택해 메모로 남길 수 있어요.
					</p>
					<ActionButton variant="neutralOutline" size="large" className="mt-4 w-full">
						선택한 문장을 메모로 남기기
					</ActionButton>
				</div>
			</div>
			<ActionButton
				variant="neutralSolid"
				size="large"
				className="w-full"
				onClick={() => navigate({ to: "/" })}
			>
				완료
			</ActionButton>
			<ActionButton variant="ghost" className="mt-2" onClick={() => navigate({ to: "/" })}>
				다시 전화
			</ActionButton>
		</main>
	);
}

function HearingRoom({ room }: { room: Room }) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
			<MicToggleButton room={room} />
			<AgentAudioPlayer room={room} />
		</div>
	);
}

export function CallRoom(props: CallRoomProps) {
	const [ended, setEnded] = useState(false);
	const [communication, setCommunication] = useState(props.communication);
	if (ended) return <EndedCall {...props} communication={communication} />;
	if (props.mode === "HEARING") return <HearingRoom room={props.room} />;

	return (
		<main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-card">
			<CallHeader
				{...props}
				communication={communication}
				onEnd={() => setEnded(true)}
				onSwitch={() => setCommunication((value) => (value === "SIGN" ? "TEXT" : "SIGN"))}
			/>
			{communication === "TEXT" ? (
				<TextCall room={props.room} />
			) : (
				<div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
					<div className="rounded-2xl bg-muted p-4">
						<p className="mb-2 text-xs font-medium text-muted-foreground">상대방 · 음성 → 텍스트</p>
						<CaptionList room={props.room} />
					</div>
					<SignCaptureView room={props.room} />
				</div>
			)}
		</main>
	);
}
