import { IconPhoneFill, IconPhoneXmarkFill } from "@karrotmarket/react-monochrome-icon";
import { Icon } from "@seed-design/react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import type { CallRole } from "@/entities/call";
import { cn, snackbar } from "@/shared/lib";
import { ActionButton, SeedAvatar as Avatar, IdentityPlaceholder } from "@/shared/ui";

type JoinStatus =
	| "idle"
	| "connecting"
	| "ringing"
	| "connected"
	| "reconnecting"
	| "ended"
	| "rejected"
	| "error";

interface JoinCallProps {
	status: JoinStatus;
	role: CallRole | null;
	contactName: string;
	phone: string;
	onAccept: () => Promise<void>;
	onReject: () => Promise<void>;
	onCancel: () => Promise<void>;
	accepting: boolean;
	rejecting: boolean;
	actionError: boolean;
	rejectedBySelf: boolean;
}

function LoadingDots() {
	return (
		<div className="mt-12 flex h-5 items-center justify-center gap-2" aria-hidden>
			<span className="size-2 animate-pulse rounded-full bg-foreground" />
			<span className="size-2 animate-pulse rounded-full bg-foreground [animation-delay:150ms]" />
			<span className="size-2 animate-pulse rounded-full bg-foreground [animation-delay:300ms]" />
		</div>
	);
}

/** Renders the pre-call experience for connecting, ringing, rejection, and failure states. */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: explicit finite-state UI branches
export function JoinCall(props: JoinCallProps) {
	const navigate = useNavigate();
	useEffect(() => {
		if (props.status === "error") {
			snackbar.error("연결하지 못했어요. 네트워크 상태를 확인한 뒤 다시 전화해 주세요.");
		}
	}, [props.status]);
	useEffect(() => {
		if (props.actionError) snackbar.error("요청을 처리하지 못했어요. 다시 시도해 주세요.");
	}, [props.actionError]);
	if (props.status === "connected" || props.status === "ended" || props.status === "idle")
		return null;

	const failed = props.status === "error";
	const rejected = props.status === "rejected";
	const incoming = props.status === "ringing" && props.role === "CALLEE";
	const outgoing = props.status === "ringing" && props.role === "CALLER";
	const busy = props.accepting || props.rejecting;
	const rejectedTitle = props.rejectedBySelf
		? props.role === "CALLEE"
			? "통화를 거절했어요"
			: "통화를 취소했어요"
		: props.role === "CALLER"
			? "상대방이 받지 않았어요"
			: "통화가 취소됐어요";

	if (incoming || outgoing) {
		return (
			<section
				className="fixed inset-0 z-30 mx-auto flex w-full max-w-md flex-col items-center overflow-hidden bg-[radial-gradient(circle_at_50%_30%,#34445f_0%,#172033_42%,#090d14_100%)] px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] text-center text-white"
				aria-label={incoming ? "수신 전화" : "발신 전화"}
			>
				<div className="absolute top-1/4 size-72 rounded-full bg-white/5 blur-3xl" aria-hidden />
				<p className="relative text-base font-medium text-white/70">
					{incoming ? "수신 전화" : "발신 전화"}
				</p>
				<div className="relative mt-16">
					<span
						className="absolute inset-0 animate-ping rounded-full bg-white/10 [animation-duration:2.4s]"
						aria-hidden
					/>
					<Avatar
						className="relative shadow-[0_0_0_10px_rgba(255,255,255,0.08)]"
						size="108"
						fallback={<IdentityPlaceholder identity="person" />}
					/>
				</div>
				<h2 className="relative mt-9 text-3xl font-bold tracking-tight">{props.contactName}</h2>
				{props.contactName !== props.phone && (
					<p className="relative mt-2 text-lg text-white/60">{props.phone}</p>
				)}
				<p className="relative mt-4 text-sm text-white/50">
					{incoming ? "전화가 왔습니다" : "연결 중…"}
				</p>

				<div
					className={cn(
						"relative mt-auto grid w-full max-w-xs pt-16",
						incoming ? "grid-cols-2 gap-16" : "place-items-center",
					)}
				>
					<div className="flex flex-col items-center gap-3">
						<ActionButton
							layout="iconOnly"
							variant="criticalSolid"
							size="large"
							className="size-18 rounded-full"
							loading={props.rejecting}
							disabled={busy}
							onClick={() => void props.onReject()}
							aria-label={incoming ? "전화 거절" : "전화 취소"}
						>
							<Icon svg={<IconPhoneXmarkFill />} />
						</ActionButton>
						<span className="text-sm font-medium">{incoming ? "거절" : "취소"}</span>
					</div>
					{incoming && (
						<div className="flex flex-col items-center gap-3">
							<ActionButton
								layout="iconOnly"
								variant="neutralSolid"
								size="large"
								className="size-18 rounded-full bg-bg-positive-solid !text-white hover:bg-bg-positive-solid-pressed active:bg-bg-positive-solid-pressed"
								loading={props.accepting}
								disabled={busy}
								onClick={() => void props.onAccept()}
								aria-label="전화 수락"
							>
								<Icon svg={<IconPhoneFill className="!text-white" />} />
							</ActionButton>
							<span className="text-sm font-medium">수락</span>
						</div>
					)}
				</div>
			</section>
		);
	}

	return (
		<section
			className="flex w-full flex-1 flex-col items-center px-6 pb-6 pt-10 text-center"
			aria-live="polite"
		>
			<Avatar
				className="shadow-[0_0_0_10px_var(--seed-color-bg-layer-fill)]"
				size="108"
				fallback={<IdentityPlaceholder identity="person" />}
			/>
			<h2 className="mt-8 text-3xl font-bold tracking-tight">{props.contactName}</h2>
			{props.contactName !== props.phone && (
				<p className="mt-2 text-lg text-muted-foreground">{props.phone}</p>
			)}

			{rejected && (
				<>
					<div className="mt-12 grid size-17 place-items-center rounded-full bg-muted text-destructive">
						<IconPhoneXmarkFill className="size-8" aria-hidden />
					</div>
					<h3 className="mt-5 text-2xl font-bold">{rejectedTitle}</h3>
				</>
			)}

			{props.status === "connecting" && (
				<>
					<LoadingDots />
					<h3 className="mt-5 text-2xl font-bold">전화 연결 준비 중...</h3>
				</>
			)}

			{props.status === "reconnecting" && (
				<>
					<LoadingDots />
					<h3 className="mt-5 text-2xl font-bold">다시 연결 중...</h3>
					<p className="mt-3 text-base text-muted-foreground">잠시만 기다려 주세요.</p>
				</>
			)}

			<div className="mt-auto w-full max-w-sm pt-10">
				{(props.status === "connecting" || props.status === "reconnecting") && (
					<ActionButton
						variant="neutralOutline"
						size="large"
						className="w-full text-destructive"
						disabled={busy}
						onClick={() => void props.onCancel()}
					>
						전화 취소
					</ActionButton>
				)}

				{(failed || rejected) && (
					<ActionButton
						variant="neutralSolid"
						size="large"
						className="w-full"
						onClick={() => navigate({ to: "/" })}
					>
						돌아가기
					</ActionButton>
				)}
			</div>
		</section>
	);
}
