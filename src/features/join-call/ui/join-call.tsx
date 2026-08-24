const STATUS_LABEL = {
	idle: "",
	connecting: "통화 연결 중...",
	connected: "",
	error: "통화 연결에 실패했어요. 새로고침 후 다시 시도해주세요.",
} as const;

/** Shows connection status while `useJoinCall` is connecting — renders nothing once connected. */
export function JoinCall({ status }: { status: keyof typeof STATUS_LABEL }) {
	if (!STATUS_LABEL[status]) return null;
	return <p className="text-muted-foreground text-sm">{STATUS_LABEL[status]}</p>;
}
