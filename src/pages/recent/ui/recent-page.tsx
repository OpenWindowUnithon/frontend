import { useQuery } from "@tanstack/react-query";
import { getDeviceKey, getMyPhone, getRecentCalls, type RecentCall } from "@/entities/call";
import { IdentityPlaceholder, List, ListDivider, ListItem, SeedAvatar } from "@/shared/ui";
import { PhoneNav } from "@/widgets/phone-nav";

function formatPhone(value: string) {
	return value.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1 $2 $3");
}

const STATUS_LABEL = {
	CREATED: "연결 준비",
	RINGING: "연결 중",
	ACTIVE: "통화 연결",
	REJECTED: "응답 없음",
	ENDED: "통화 종료",
} as const;

export function RecentPage() {
	const registered = /^01\d{8,9}$/.test(getMyPhone());
	const recent = useQuery({
		queryKey: ["recent-calls", getDeviceKey()],
		queryFn: () => getRecentCalls(getDeviceKey()),
		enabled: registered,
	});
	return (
		<main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-card px-6 pt-[env(safe-area-inset-top)] pb-[max(1rem,env(safe-area-inset-bottom))]">
			<section className="min-h-0 flex-1 overflow-y-auto pt-10">
				<h1 className="text-3xl font-bold">최근 통화</h1>
				{!registered && (
					<p className="mt-8 text-muted-foreground">나의 정보에서 전화번호를 먼저 등록해 주세요.</p>
				)}
				{recent.isLoading && <p className="mt-8 text-muted-foreground">불러오는 중…</p>}
				{recent.data?.length === 0 && (
					<p className="mt-8 text-muted-foreground">최근 통화가 없어요.</p>
				)}
				<List className="mt-6">
					{recent.data?.map((call, index) => (
						<RecentCallItem
							key={call.callId}
							call={call}
							showDivider={index < recent.data.length - 1}
						/>
					))}
				</List>
			</section>
			<PhoneNav current="recent" />
		</main>
	);
}

function RecentCallItem({ call, showDivider }: { call: RecentCall; showDivider: boolean }) {
	const time = call.startedAt
		? new Date(call.startedAt).toLocaleString("ko-KR", {
				month: "numeric",
				day: "numeric",
				hour: "numeric",
				minute: "2-digit",
			})
		: "-";
	const duration =
		call.durationSeconds == null
			? null
			: `${Math.floor(call.durationSeconds / 60)}분 ${call.durationSeconds % 60}초`;

	return (
		<>
			<ListItem
				prefix={<SeedAvatar size="48" fallback={<IdentityPlaceholder />} />}
				title={formatPhone(call.peerPhone)}
				detail={`${call.direction === "OUTGOING" ? "발신" : "수신"} · ${STATUS_LABEL[call.status]}`}
				suffix={
					<div className="text-right text-sm text-muted-foreground">
						<p>{time}</p>
						{duration && <p className="mt-1">{duration}</p>}
					</div>
				}
			/>
			{showDivider && <ListDivider />}
		</>
	);
}
