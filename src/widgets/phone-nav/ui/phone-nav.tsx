import { IconClockFill, IconPersonFill } from "@karrotmarket/react-monochrome-icon";
import { Link } from "@tanstack/react-router";

export function PhoneNav({ current }: { current: "recent" | "keypad" | "profile" }) {
	const itemClass = (active: boolean) =>
		`flex h-14 flex-col items-center justify-center gap-1 text-xs font-semibold ${active ? "text-fg-informative" : "text-muted-foreground"}`;
	return (
		<nav
			className="sticky bottom-0 z-20 grid h-[calc(68px+env(safe-area-inset-bottom))] w-[calc(100vw-3rem)] max-w-[25rem] shrink-0 self-center grid-cols-3 border-t bg-card pt-1 pb-[calc(8px+env(safe-area-inset-bottom))]"
			aria-label="전화 메뉴"
		>
			<Link to="/recent" className={itemClass(current === "recent")}>
				<IconClockFill className="size-6" aria-hidden />
				최근 통화
			</Link>
			<Link to="/" className={itemClass(current === "keypad")}>
				<span className="grid size-6 place-items-center text-base font-bold" aria-hidden>
					•••
				</span>
				키패드
			</Link>
			<Link to="/my" className={itemClass(current === "profile")}>
				<IconPersonFill className="size-6" aria-hidden />
				나의 정보
			</Link>
		</nav>
	);
}
