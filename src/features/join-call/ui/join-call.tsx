import { useNavigate } from "@tanstack/react-router";
import type { CallRole } from "@/entities/call";
import { Button } from "@/shared/ui";

type Status =
	| "idle"
	| "connecting"
	| "ringing"
	| "connected"
	| "reconnecting"
	| "rejected"
	| "error";

interface JoinCallProps {
	status: Status;
	role: CallRole | null;
	onAccept: () => void;
	onReject: () => void;
}

const SIMPLE_LABEL: Partial<Record<Status, string>> = {
	connecting: "통화 연결 중...",
	reconnecting: "연결이 끊겼어요. 다시 연결 중...",
	error: "통화 연결에 실패했어요. 새로고침 후 다시 시도해주세요.",
};

/** Renders the pre-connection lobby: dialing/ringing/incoming-call states, and their actions. */
export function JoinCall({ status, role, onAccept, onReject }: JoinCallProps) {
	const navigate = useNavigate();

	if (status === "ringing" && role === "CALLEE") {
		return (
			<div className="flex flex-col items-center gap-3">
				<p className="text-sm">전화가 왔습니다</p>
				<div className="flex gap-2">
					<Button onClick={onAccept} size="md">
						수락
					</Button>
					<Button onClick={onReject} size="md" variant="outline">
						거절
					</Button>
				</div>
			</div>
		);
	}

	if (status === "ringing") {
		return (
			<div className="flex flex-col items-center gap-3">
				<p className="text-muted-foreground text-sm">상대방에게 전화를 거는 중...</p>
				<Button onClick={onReject} size="md" variant="outline">
					취소
				</Button>
			</div>
		);
	}

	if (status === "rejected") {
		return (
			<div className="flex flex-col items-center gap-3">
				<p className="text-muted-foreground text-sm">상대방이 전화를 받지 않았어요.</p>
				<Button onClick={() => navigate({ to: "/" })} size="md" variant="outline">
					로비로 돌아가기
				</Button>
			</div>
		);
	}

	const label = SIMPLE_LABEL[status];
	return label ? <p className="text-muted-foreground text-sm">{label}</p> : null;
}
