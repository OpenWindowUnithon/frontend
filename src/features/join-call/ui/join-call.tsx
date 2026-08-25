import { Badge } from "@seed-design/react";
import { SeedAvatar as Avatar, IdentityPlaceholder } from "@/shared/ui";

const STATUS_LABEL = {
	idle: "",
	connecting: "통화 연결 중...",
	connected: "",
	ended: "",
	reconnecting: "연결이 끊겼어요. 다시 연결 중...",
	error: "통화 연결에 실패했어요. 새로고침 후 다시 시도해주세요.",
} as const;

/** Shows connection status while `useJoinCall` is connecting/reconnecting — renders nothing once connected. */
export function JoinCall({
	status,
	contactName,
	phone,
}: {
	status: keyof typeof STATUS_LABEL;
	contactName: string;
	phone: string;
}) {
	if (!STATUS_LABEL[status]) return null;
	const failed = status === "error";
	return (
		<section
			className="flex w-full flex-1 flex-col items-center px-6 pt-10 text-center"
			aria-live="polite"
		>
			<Avatar
				className="shadow-[0_0_0_10px_var(--seed-color-bg-layer-fill)]"
				size="108"
				fallback={<IdentityPlaceholder identity="business" />}
			/>
			<h2 className="mt-8 text-3xl font-bold tracking-tight">{contactName}</h2>
			{contactName !== phone && <p className="mt-2 text-lg text-muted-foreground">{phone}</p>}
			{failed ? (
				<>
					<Badge className="mt-10" tone="critical" variant="weak" size="large">
						연결 실패
					</Badge>
					<h3 className="mt-5 text-2xl font-bold text-destructive">연결하지 못했어요</h3>
				</>
			) : (
				<>
					<div className="mt-12 flex h-5 items-center justify-center gap-2" aria-hidden>
						<span className="size-2 animate-pulse rounded-full bg-foreground" />
						<span className="size-2 animate-pulse rounded-full bg-foreground [animation-delay:150ms]" />
						<span className="size-2 animate-pulse rounded-full bg-foreground [animation-delay:300ms]" />
					</div>
					<h3 className="mt-5 text-2xl font-bold">전화 거는 중</h3>
					<p className="mt-3 max-w-xs text-base leading-7 text-muted-foreground">
						상대방이 전화를 받으면 바로 통화가 시작돼요.
					</p>
				</>
			)}
			{failed && (
				<p className="mt-4 max-w-xs rounded-2xl bg-muted p-4 text-sm leading-6">
					네트워크 상태를 확인한 뒤 이전 화면에서 다시 전화해주세요.
				</p>
			)}
		</section>
	);
}
