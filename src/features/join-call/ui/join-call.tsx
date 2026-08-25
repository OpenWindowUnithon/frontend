import { IconCheckmarkFill } from "@karrotmarket/react-monochrome-icon";
import { Badge } from "@seed-design/react";
import { Avatar } from "@/shared/ui/seed-design/ui/avatar";
import { IdentityPlaceholder } from "@/shared/ui/seed-design/ui/identity-placeholder";

const STATUS_LABEL = {
	idle: "",
	connecting: "통화 연결 중...",
	connected: "",
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
			className="flex w-full flex-1 flex-col items-center px-6 pt-20 text-center"
			aria-live="polite"
		>
			<Badge tone={failed ? "critical" : "informative"} variant="weak" size="large">
				{failed ? "연결 실패" : "상대방 응답 대기"}
			</Badge>
			<Avatar className="mt-6" size="108" fallback={<IdentityPlaceholder identity="business" />} />
			<h2 className="mt-6 text-3xl font-bold">{contactName}</h2>
			<p className="mt-2 text-lg text-muted-foreground">{phone}</p>
			<fieldset className="mt-12 flex w-full items-start justify-center">
				<legend className="sr-only">통화 연결 단계</legend>
				{["전화 요청", "상대방 응답 대기", "통화 시작"].map((label, index) => (
					<div className="flex items-center" key={label}>
						<div className="flex w-20 flex-col items-center gap-2">
							<span
								className={`grid size-8 place-items-center rounded-full border text-sm font-bold ${index === 0 ? "bg-foreground text-background" : index === 1 && !failed ? "border-foreground" : "text-muted-foreground"}`}
							>
								{index === 0 ? <IconCheckmarkFill className="size-4" aria-hidden /> : index + 1}
							</span>
							<span className="text-xs">{label}</span>
						</div>
						{index < 2 && <span className="mt-4 h-px w-7 bg-border" />}
					</div>
				))}
			</fieldset>
			<h3 className={`mt-12 text-2xl font-bold ${failed ? "text-destructive" : ""}`}>
				{failed ? "연결하지 못했어요" : "상대방의 응답을 기다리고 있어요"}
			</h3>
			<p className="mt-3 max-w-xs text-muted-foreground">{STATUS_LABEL[status]}</p>
			{failed && (
				<p className="mt-4 rounded-xl bg-muted p-4 text-sm">
					네트워크 상태를 확인한 뒤 이전 화면에서 다시 전화해주세요.
				</p>
			)}
		</section>
	);
}
