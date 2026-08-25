import { IconBackspacekeyFill, IconPhoneFill } from "@karrotmarket/react-monochrome-icon";
import { Icon } from "@seed-design/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Camera } from "lucide-react";
import { useEffect, useState } from "react";
import {
	createOutgoingCall,
	getCallPreferences,
	getDeviceKey,
	getIncomingCall,
	getMyPhone,
	registerPhone,
} from "@/entities/call";
import { setSessionKey } from "@/features/join-call";
import { isLocalOrPreview } from "@/shared/lib";
import { ActionButton } from "@/shared/ui";
import { PhoneNav } from "@/widgets/phone-nav";

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

export function HomePage() {
	const navigate = useNavigate();
	const [deviceKey] = useState(getDeviceKey);
	const [myPhone] = useState(getMyPhone);
	const [digits, setDigits] = useState("");
	const [communication] = useState(() => getCallPreferences().defaultCommunication);
	const phone = formatPhoneNumber(digits);
	const normalizedMyPhone = myPhone.replace(/\D/g, "").slice(0, 11);
	const normalizedCalleePhone = /^01\d{8,9}$/.test(digits) ? digits : null;
	const canCall = normalizedCalleePhone !== null;

	const registration = useMutation({
		mutationFn: () => registerPhone(normalizedMyPhone, deviceKey),
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: restore the persisted identity only on mount
	useEffect(() => {
		if (normalizedMyPhone.length >= 10) registration.mutate();
	}, []);

	const incoming = useQuery({
		queryKey: ["incoming-call", deviceKey, normalizedMyPhone],
		queryFn: () => getIncomingCall(deviceKey),
		enabled: normalizedMyPhone.length >= 10 && !registration.isPending,
		refetchInterval: 1_500,
		refetchIntervalInBackground: true,
		staleTime: 0,
		retry: 1,
	});

	useEffect(() => {
		const call = incoming.data;
		if (!incoming.isFetchedAfterMount || !call) return;
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
	}, [incoming.data, incoming.isFetchedAfterMount, deviceKey, navigate, communication]);

	const outgoing = useMutation({
		mutationFn: async () => {
			if (!normalizedCalleePhone) throw new Error("올바른 전화번호를 입력해 주세요.");
			await registerPhone(normalizedMyPhone, deviceKey);
			const creatorKey = crypto.randomUUID();
			const call = await createOutgoingCall(
				normalizedMyPhone,
				normalizedCalleePhone,
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
		if (!/^01\d{8,9}$/.test(normalizedMyPhone)) {
			navigate({ to: "/my" });
			return;
		}
		if (!canCall) return;
		outgoing.mutate();
	};

	return (
		<main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-card px-6 pt-[env(safe-area-inset-top)] pb-[max(1rem,env(safe-area-inset-bottom))]">
			<header className="flex min-h-14 items-center justify-between py-3">
				<h1 className="sr-only">전화 키패드</h1>
				{isLocalOrPreview() ? (
					<button
						type="button"
						onClick={() => navigate({ to: "/test-camera" })}
						className="flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 font-semibold text-blue-400 text-xs transition-all hover:bg-blue-500/20 active:scale-95"
					>
						<Camera className="size-3.5" />
						<span>카메라 테스트</span>
					</button>
				) : (
					<div />
				)}
				{(registration.isError || outgoing.isError || incoming.isError) && (
					<p className="text-xs text-destructive" role="alert">
						전화번호 등록 또는 연결을 확인해 주세요.
					</p>
				)}
			</header>

			<section className="flex flex-1 flex-col items-center justify-end pb-5">
				<div className="mt-4 grid w-full max-w-[296px] grid-cols-3 gap-x-7 gap-y-3">
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

			<PhoneNav current="keypad" />
		</main>
	);
}
