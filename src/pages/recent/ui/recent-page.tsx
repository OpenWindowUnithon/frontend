import { useQuery } from "@tanstack/react-query";
import { getDeviceKey, getMyPhone, getRecentCalls } from "@/entities/call";
import { PhoneNav } from "@/widgets/phone-nav";

function formatPhone(value: string) {
	return value.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1 $2 $3");
}

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
				<ul className="mt-6 divide-y">
					{recent.data?.map((call) => (
						<li className="flex items-center justify-between py-4" key={call.callId}>
							<div>
								<p className="text-lg font-semibold">{formatPhone(call.peerPhone)}</p>
								<p className="mt-1 text-sm text-muted-foreground">
									{call.direction === "OUTGOING" ? "발신" : "수신"} · {call.status}
								</p>
							</div>
							<div className="text-right text-sm text-muted-foreground">
								<p>
									{call.startedAt
										? new Date(call.startedAt).toLocaleString("ko-KR", {
												month: "numeric",
												day: "numeric",
												hour: "numeric",
												minute: "2-digit",
											})
										: "-"}
								</p>
								{call.durationSeconds != null && (
									<p className="mt-1">
										{Math.floor(call.durationSeconds / 60)}분 {call.durationSeconds % 60}초
									</p>
								)}
							</div>
						</li>
					))}
				</ul>
			</section>
			<PhoneNav current="recent" />
		</main>
	);
}
