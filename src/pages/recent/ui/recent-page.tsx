import { Skeleton, Text } from "@seed-design/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	createOutgoingCall,
	getCallPreferences,
	getDeviceKey,
	getMyPhone,
	getRecentCalls,
	type RecentCall,
	registerPhone,
} from "@/entities/call";
import { setSessionKey } from "@/features/join-call";
import { snackbar } from "@/shared/lib";
import { IdentityPlaceholder, List, ListButtonItem, ListDivider, SeedAvatar } from "@/shared/ui";
import { PageTopBar, useCompactTopBar } from "@/widgets/page-top-bar";
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

const SKELETON_ROWS = ["first", "second", "third"] as const;

export function RecentPage() {
	const topBar = useCompactTopBar();
	const navigate = useNavigate();
	const deviceKey = getDeviceKey();
	const myPhone = getMyPhone().replace(/\D/g, "");
	const registered = /^01\d{8,9}$/.test(myPhone);
	const recent = useQuery({
		queryKey: ["recent-calls", deviceKey],
		queryFn: () => getRecentCalls(deviceKey),
		enabled: registered,
	});
	const outgoing = useMutation({
		mutationFn: async (peerPhone: string) => {
			const calleePhone = peerPhone.replace(/\D/g, "");
			await registerPhone(myPhone, deviceKey);
			const creatorKey = crypto.randomUUID();
			const call = await createOutgoingCall(myPhone, calleePhone, "DEAF", deviceKey, creatorKey);
			setSessionKey("creator", call.roomCode, creatorKey);
			setSessionKey("participant", call.roomCode, deviceKey);
			return { call, peerPhone: calleePhone };
		},
		onSuccess: ({ call, peerPhone }) => {
			navigate({
				to: "/call",
				search: {
					room: call.roomCode,
					mode: "DEAF",
					communication: getCallPreferences().defaultCommunication,
					contactName: formatPhone(peerPhone),
					phone: formatPhone(peerPhone),
				},
			});
		},
		onError: () => snackbar.error("전화를 걸지 못했어요. 잠시 후 다시 시도해 주세요."),
	});
	return (
		<main className="relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-card px-6">
			<PageTopBar title="최근 통화" visible={topBar.visible} />
			<section
				className="min-h-0 flex-1 overflow-y-auto pt-[calc(2.5rem+env(safe-area-inset-top))] pb-6 scrollbar-none"
				onScroll={topBar.onScroll}
			>
				<Text as="h1" textStyle="screenTitle">
					최근 통화
				</Text>
				{!registered && (
					<p className="mt-8 text-muted-foreground">나의 정보에서 전화번호를 먼저 등록해 주세요.</p>
				)}
				{recent.isLoading && <RecentCallsSkeleton />}
				{recent.data?.length === 0 && (
					<p className="mt-8 text-muted-foreground">최근 통화가 없어요.</p>
				)}
				<List className="mt-6">
					{recent.data?.map((call, index) => (
						<RecentCallItem
							key={call.callId}
							call={call}
							showDivider={index < recent.data.length - 1}
							disabled={outgoing.isPending}
							onCall={() => outgoing.mutate(call.peerPhone)}
						/>
					))}
				</List>
			</section>
			<PhoneNav current="recent" />
		</main>
	);
}

function RecentCallsSkeleton() {
	return (
		<>
			<p className="sr-only" role="status">
				최근 통화를 불러오는 중
			</p>
			<div className="mt-6 space-y-1 px-4" aria-hidden>
				{SKELETON_ROWS.map((row) => (
					<div className="flex items-center gap-3 py-3" key={row}>
						<SeedAvatar size="48" fallback={<IdentityPlaceholder />} />
						<div className="min-w-0 flex-1 space-y-2">
							<Skeleton radius="8" width="128px" height="20px" />
							<Skeleton radius="8" width="88px" height="16px" />
						</div>
						<div className="flex flex-col items-end gap-2">
							<Skeleton radius="8" width="72px" height="16px" />
							<Skeleton radius="8" width="48px" height="14px" />
						</div>
					</div>
				))}
			</div>
		</>
	);
}

function RecentCallItem({
	call,
	showDivider,
	disabled,
	onCall,
}: {
	call: RecentCall;
	showDivider: boolean;
	disabled: boolean;
	onCall: () => void;
}) {
	const time = call.startedAt
		? new Date(call.startedAt).toLocaleString("ko-KR", {
				month: "numeric",
				day: "numeric",
				hour: "numeric",
				minute: "2-digit",
			})
		: "-";
	const duration =
		call.status === "REJECTED" || call.durationSeconds == null
			? null
			: `${Math.floor(call.durationSeconds / 60)}분 ${call.durationSeconds % 60}초`;

	return (
		<>
			<ListButtonItem
				prefix={<SeedAvatar size="48" fallback={<IdentityPlaceholder />} />}
				title={formatPhone(call.peerPhone)}
				detail={`${call.direction === "OUTGOING" ? "발신" : "수신"} · ${STATUS_LABEL[call.status]}`}
				disabled={disabled}
				onClick={onCall}
				aria-label={`${formatPhone(call.peerPhone)}에게 전화 걸기`}
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
