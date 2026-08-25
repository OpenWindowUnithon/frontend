import {
	IconBackspacekeyFill,
	IconClockFill,
	IconPersonFill,
	IconPhoneFill,
} from "@karrotmarket/react-monochrome-icon";
import { Icon } from "@seed-design/react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { CommunicationMode } from "@/entities/call";
import { ActionButton, SegmentedControl, SegmentedControlItem } from "@/shared/ui";

const KEYS = [
	["1", ""],
	["2", "ABC"],
	["3", "DEF"],
	["4", "GHI"],
	["5", "JKL"],
	["6", "MNO"],
	["7", "PQRS"],
	["8", "TUV"],
	["9", "WXYZ"],
	["*", ""],
	["0", "+"],
	["#", ""],
] as const;

function formatPhoneNumber(value: string) {
	if (value.length <= 3) return value;
	if (value.length <= 7) return `${value.slice(0, 3)} ${value.slice(3)}`;
	return `${value.slice(0, 3)} ${value.slice(3, 7)} ${value.slice(7, 11)}`;
}

function createRoomCode(digits: string) {
	const time = Date.now().toString(36);
	const nonce = crypto.randomUUID().slice(0, 8);
	return `call-${digits}-${time}-${nonce}`;
}

export function HomePage() {
	const navigate = useNavigate();
	const [digits, setDigits] = useState("");
	const [communication, setCommunication] = useState<CommunicationMode>("TEXT");
	const canCall = digits.length >= 8;
	const phone = formatPhoneNumber(digits);

	const startCall = () => {
		if (!canCall) return;
		navigate({
			to: "/call",
			search: {
				room: createRoomCode(digits),
				mode: "DEAF",
				communication,
				contactName: phone,
				phone,
			},
		});
	};

	return (
		<main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-card px-6 pt-[env(safe-area-inset-top)] pb-[max(1rem,env(safe-area-inset-bottom))]">
			<header className="flex h-11 items-center justify-center">
				<h1 className="sr-only">전화 키패드</h1>
			</header>

			<section className="flex flex-1 flex-col items-center justify-end pb-5">
				<SegmentedControl
					style={{ width: 224 }}
					aria-label="통화 방식"
					value={communication}
					onValueChange={(value) => setCommunication(value as CommunicationMode)}
				>
					<SegmentedControlItem value="TEXT">
						<span className="whitespace-nowrap">텍스트</span>
					</SegmentedControlItem>
					<SegmentedControlItem value="SIGN">
						<span className="whitespace-nowrap">수어</span>
					</SegmentedControlItem>
				</SegmentedControl>

				<div
					className="mt-4 flex min-h-24 w-full flex-col items-center justify-center"
					aria-live="polite"
				>
					<p className="min-h-11 text-center text-4xl leading-11 font-light tracking-tight tabular-nums">
						{phone || "전화번호 입력"}
					</p>
					{digits && (
						<button type="button" className="mt-1 text-sm font-medium text-fg-informative">
							새로운 연락처에 추가
						</button>
					)}
				</div>

				<div className="mt-1 grid w-full max-w-[296px] grid-cols-3 gap-x-7 gap-y-3">
					{KEYS.map(([number, letters]) => (
						<button
							key={number}
							type="button"
							className="mx-auto grid size-[68px] touch-manipulation appearance-none grid-rows-[38px_12px] content-center place-items-center rounded-full border-0 bg-secondary p-0 text-foreground shadow-none transition select-none active:scale-95 active:bg-bg-neutral-weak-pressed"
							onClick={() => setDigits((current) => `${current}${number}`.slice(0, 11))}
							aria-label={number}
						>
							<span
								className={`flex h-[38px] items-center justify-center text-[1.9rem] leading-none font-normal tabular-nums ${number === "*" ? "translate-y-1" : ""}`}
							>
								{number}
							</span>
							<span className="h-3 whitespace-nowrap text-[0.58rem] leading-3 font-semibold tracking-[0.14em]">
								{letters}
							</span>
						</button>
					))}
				</div>

				<div className="mt-5 grid w-full max-w-[310px] grid-cols-3 items-center">
					<div />
					<ActionButton
						layout="iconOnly"
						size="large"
						className="mx-auto size-16 rounded-full bg-bg-positive-solid text-primary-foreground hover:bg-bg-positive-solid-pressed active:bg-bg-positive-solid-pressed"
						disabled={!canCall}
						onClick={startCall}
						aria-label="전화 걸기"
					>
						<Icon svg={<IconPhoneFill />} />
					</ActionButton>
					{digits ? (
						<ActionButton
							layout="iconOnly"
							variant="ghost"
							size="large"
							className="mx-auto"
							onClick={() => setDigits((current) => current.slice(0, -1))}
							aria-label="마지막 숫자 지우기"
						>
							<Icon svg={<IconBackspacekeyFill />} />
						</ActionButton>
					) : (
						<div />
					)}
				</div>
			</section>

			<nav className="grid grid-cols-3 border-t pt-2" aria-label="전화 메뉴">
				<button
					type="button"
					className="flex flex-col items-center gap-1 py-2 text-muted-foreground"
				>
					<IconClockFill className="size-6" aria-hidden />
					<span className="text-xs">최근 통화</span>
				</button>
				<button
					type="button"
					className="flex flex-col items-center gap-1 py-2 text-muted-foreground"
				>
					<IconPersonFill className="size-6" aria-hidden />
					<span className="text-xs">연락처</span>
				</button>
				<button type="button" className="flex flex-col items-center gap-1 py-2 text-fg-informative">
					<span className="grid size-6 grid-cols-3 place-items-center text-[0.6rem] font-bold">
						•••
					</span>
					<span className="text-xs font-medium">키패드</span>
				</button>
			</nav>
		</main>
	);
}
