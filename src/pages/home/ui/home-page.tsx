import {
	IconBackspacekeyFill,
	IconClockFill,
	IconPersonFill,
	IconPhoneFill,
} from "@karrotmarket/react-monochrome-icon";
import { Icon } from "@seed-design/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
	type CommunicationMode,
	createOutgoingCall,
	getIncomingCall,
	registerPhone,
} from "@/entities/call";
import { setSessionKey } from "@/features/join-call";
import { ActionButton, Input, SegmentedControl, SegmentedControlItem } from "@/shared/ui";

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

function getDeviceKey() {
	const key = "phone-device-key";
	const existing = localStorage.getItem(key);
	if (existing) return existing;
	const created = crypto.randomUUID();
	localStorage.setItem(key, created);
	return created;
}

export function HomePage() {
	const navigate = useNavigate();
	const [deviceKey] = useState(getDeviceKey);
	const [myPhone, setMyPhone] = useState(() => localStorage.getItem("my-phone") ?? "");
	const [digits, setDigits] = useState("");
	const [communication, setCommunication] = useState<CommunicationMode>("TEXT");
	const canCall = digits.length >= 10 && myPhone.length >= 10;
	const phone = formatPhoneNumber(digits);
	const normalizedMyPhone = myPhone.replace(/\D/g, "").slice(0, 11);

	const registration = useMutation({
		mutationFn: () => registerPhone(normalizedMyPhone, deviceKey),
		onSuccess: (registeredPhone) => {
			localStorage.setItem("my-phone", registeredPhone);
			setMyPhone(registeredPhone);
		},
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: restore the persisted identity only on mount
	useEffect(() => {
		if (normalizedMyPhone.length >= 10) registration.mutate();
	}, []);

	const incoming = useQuery({
		queryKey: ["incoming-call", deviceKey],
		queryFn: () => getIncomingCall(deviceKey),
		enabled: normalizedMyPhone.length >= 10 && !registration.isPending,
		refetchInterval: 1_500,
		refetchIntervalInBackground: true,
		staleTime: 0,
		retry: 1,
	});

	useEffect(() => {
		const call = incoming.data;
		if (!call) return;
		setSessionKey("participant", call.roomCode, deviceKey);
		navigate({
			to: "/call",
			search: {
				room: call.roomCode,
				mode: call.callerMode === "DEAF" ? "HEARING" : "DEAF",
				communication,
				contactName: formatPhoneNumber(call.callerPhone),
				phone: formatPhoneNumber(call.callerPhone),
			},
		});
	}, [incoming.data, deviceKey, navigate, communication]);

	const outgoing = useMutation({
		mutationFn: async () => {
			await registerPhone(normalizedMyPhone, deviceKey);
			const creatorKey = crypto.randomUUID();
			const call = await createOutgoingCall(
				normalizedMyPhone,
				digits,
				"DEAF",
				deviceKey,
				creatorKey,
			);
			setSessionKey("creator", call.roomCode, creatorKey);
			setSessionKey("participant", call.roomCode, deviceKey);
			return call;
		},
		onSuccess: (call) => {
			navigate({
				to: "/call",
				search: {
					room: call.roomCode,
					mode: "DEAF",
					communication,
					contactName: phone,
					phone,
				},
			});
		},
	});

	const startCall = () => {
		if (!canCall) return;
		outgoing.mutate();
	};

	return (
		<main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-card px-6 pt-[env(safe-area-inset-top)] pb-[max(1rem,env(safe-area-inset-bottom))]">
			<header className="flex min-h-11 flex-col items-center justify-center gap-2 py-3">
				<h1 className="sr-only">전화 키패드</h1>
				<div className="flex w-full items-center gap-2">
					<Input
						aria-label="내 전화번호"
						placeholder="내 전화번호"
						value={formatPhoneNumber(normalizedMyPhone)}
						onChange={(event) => setMyPhone(event.target.value.replace(/\D/g, "").slice(0, 11))}
					/>
					<ActionButton
						size="small"
						disabled={normalizedMyPhone.length < 10 || registration.isPending}
						onClick={() => registration.mutate()}
					>
						등록
					</ActionButton>
				</div>
				{(registration.isError || outgoing.isError || incoming.isError) && (
					<p className="text-xs text-destructive" role="alert">
						전화번호 등록 또는 연결을 확인해 주세요.
					</p>
				)}
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
						disabled={!canCall || outgoing.isPending}
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
