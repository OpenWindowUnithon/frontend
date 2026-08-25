import { IconClockFill, IconPersonFill } from "@karrotmarket/react-monochrome-icon";
import { Link } from "@tanstack/react-router";

export function PhoneNav({ current }: { current: "recent" | "keypad" | "profile" }) {
	const itemClass = (active: boolean) =>
		`flex flex-col items-center gap-1 py-2 text-xs ${active ? "font-semibold text-fg-informative" : "text-muted-foreground"}`;
	return (
		<nav className="grid grid-cols-3 border-t pt-2" aria-label="전화 메뉴">
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
