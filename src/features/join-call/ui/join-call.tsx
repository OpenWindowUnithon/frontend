import { IconPhoneFill, IconPhoneXmarkFill } from "@karrotmarket/react-monochrome-icon";
import { Badge, PrefixIcon } from "@seed-design/react";
import { useNavigate } from "@tanstack/react-router";
import type { CallRole } from "@/entities/call";
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

	return (
		<section
			className="flex w-full flex-1 flex-col items-center px-6 pb-6 pt-10 text-center"
			aria-live="polite"
		>
			<Avatar
				className="shadow-[0_0_0_10px_var(--seed-color-bg-layer-fill)]"
				size="108"
				fallback={<IdentityPlaceholder identity="business" />}
			/>
			<h2 className="mt-8 text-3xl font-bold tracking-tight">{props.contactName}</h2>
			{props.contactName !== props.phone && (
				<p className="mt-2 text-lg text-muted-foreground">{props.phone}</p>
			)}

			{failed && (
				<>
					<Badge className="mt-10" tone="critical" variant="weak" size="large">
						연결 실패
					</Badge>
					<h3 className="mt-5 text-2xl font-bold text-destructive">연결하지 못했어요</h3>
					<p className="mt-4 max-w-xs rounded-2xl bg-muted p-4 text-sm leading-6">
						네트워크 상태를 확인한 뒤 다시 전화해 주세요.
					</p>
				</>
			)}

			{rejected && (
				<>
					<div className="mt-12 grid size-17 place-items-center rounded-full bg-muted text-destructive">
						<IconPhoneXmarkFill className="size-8" aria-hidden />
					</div>
					<h3 className="mt-5 text-2xl font-bold">{rejectedTitle}</h3>
				</>
			)}

			{incoming && (
				<>
					<p className="mt-12 text-base font-semibold text-muted-foreground">전화가 왔습니다</p>
					<h3 className="mt-3 text-2xl font-bold">통화하시겠어요?</h3>
				</>
			)}

			{outgoing && (
				<>
					<LoadingDots />
					<h3 className="mt-5 text-2xl font-bold">상대방에게 전화를 거는 중...</h3>
					<p className="mt-3 text-base text-muted-foreground">상대방의 응답을 기다리고 있어요.</p>
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
				{props.actionError && (
					<p className="mb-3 text-sm font-medium text-destructive" role="alert">
						요청을 처리하지 못했어요. 다시 시도해 주세요.
					</p>
				)}
				{incoming && (
					<div className="grid grid-cols-2 gap-3">
						<ActionButton
							variant="neutralOutline"
							size="large"
							disabled={busy}
							onClick={() => void props.onReject()}
						>
							거절
						</ActionButton>
						<ActionButton
							variant="neutralSolid"
							size="large"
							className="bg-bg-positive-solid hover:bg-bg-positive-solid-pressed"
							loading={props.accepting}
							disabled={busy}
							onClick={() => void props.onAccept()}
						>
							<PrefixIcon svg={<IconPhoneFill />} /> 수락
						</ActionButton>
					</div>
				)}

				{outgoing && (
					<ActionButton
						variant="neutralOutline"
						size="large"
						className="w-full text-destructive"
						loading={props.rejecting}
						disabled={busy}
						onClick={() => void props.onReject()}
					>
						통화 취소
					</ActionButton>
				)}

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
