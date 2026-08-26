import { IconBackspacekeyFill, IconPhoneFill } from "@karrotmarket/react-monochrome-icon";
import { Icon } from "@seed-design/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import axios from "axios";
import { hapticTrigger } from "ios-haptics";
import { useEffect, useState } from "react";
import {
	createOutgoingCall,
	getCallPreferences,
	getDeviceKey,
	getIncomingCall,
	getMyPhone,
	registerPhone,
	setMyPhone,
} from "@/entities/call";
import { setSessionKey } from "@/features/join-call";
import { snackbar } from "@/shared/lib";
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

const DTMF_FREQUENCIES: Record<(typeof KEYS)[number][0], readonly [number, number]> = {
	"1": [697, 1209],
	"2": [697, 1336],
	"3": [697, 1477],
	"4": [770, 1209],
	"5": [770, 1336],
	"6": [770, 1477],
	"7": [852, 1209],
	"8": [852, 1336],
	"9": [852, 1477],
	"*": [941, 1209],
	"0": [941, 1336],
	"#": [941, 1477],
};

let keypadAudioContext: AudioContext | undefined;

async function playKeypadTone(key: (typeof KEYS)[number][0]) {
	try {
		keypadAudioContext ??= new AudioContext();
		if (keypadAudioContext.state === "suspended") await keypadAudioContext.resume();

		const startedAt = keypadAudioContext.currentTime;
		const gain = keypadAudioContext.createGain();
		gain.gain.setValueAtTime(0.0001, startedAt);
		gain.gain.exponentialRampToValueAtTime(0.08, startedAt + 0.01);
		gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.18);
		gain.connect(keypadAudioContext.destination);

		for (const frequency of DTMF_FREQUENCIES[key]) {
			const oscillator = keypadAudioContext.createOscillator();
			oscillator.frequency.value = frequency;
			oscillator.connect(gain);
			oscillator.start(startedAt);
			oscillator.stop(startedAt + 0.18);
		}
	} catch {
		// Audio feedback is optional and must never block keypad input.
	}
}

function formatPhoneNumber(value: string) {
	if (value.length <= 3) return value;
	if (value.length <= 7) return `${value.slice(0, 3)} ${value.slice(3)}`;
	return `${value.slice(0, 3)} ${value.slice(3, 7)} ${value.slice(7, 11)}`;
}

function isPhoneOwnershipConflict(error: unknown) {
	return axios.isAxiosError(error) && error.response?.status === 409;
}

export function HomePage() {
	const navigate = useNavigate();
	const [deviceKey] = useState(getDeviceKey);
	const [myPhone, setStoredPhone] = useState(getMyPhone);
	const [digits, setDigits] = useState("");
	const [communication] = useState(() => getCallPreferences().defaultCommunication);
	const phone = formatPhoneNumber(digits);
	const normalizedMyPhone = myPhone.replace(/\D/g, "").slice(0, 11);
	const normalizedCalleePhone = /^01\d{8,9}$/.test(digits) ? digits : null;
	const canCall = normalizedCalleePhone !== null;

	const registration = useMutation({
		mutationFn: () => registerPhone(normalizedMyPhone, deviceKey),
		onError: (error) => {
			if (isPhoneOwnershipConflict(error)) {
				setMyPhone("");
				setStoredPhone("");
				snackbar.error("저장된 전화번호가 다른 기기에 등록되어 초기화했어요.");
				return;
			}
			snackbar.error("전화번호를 등록하지 못했어요.");
		},
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
		if (incoming.isError) snackbar.error("수신 전화를 확인하지 못했어요.");
	}, [incoming.isError]);

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
		onError: (error) => {
			if (isPhoneOwnershipConflict(error)) {
				setMyPhone("");
				setStoredPhone("");
				snackbar.error("저장된 전화번호가 다른 기기에 등록되어 초기화했어요.");
				return;
			}
			snackbar.error("전화를 걸지 못했어요. 잠시 후 다시 시도해 주세요.");
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

	const pressKey = (number: (typeof KEYS)[number][0]) => {
		void playKeypadTone(number);
		if (number === "*" || number === "#") return;
		setDigits((current) => `${current}${number}`.slice(0, 11));
	};

	return (
		<main className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-card px-6">
			<header className="flex min-h-14 shrink-0 items-center pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3">
				<h1 className="sr-only">전화 키패드</h1>
			</header>

			<section className="flex min-h-0 flex-1 flex-col items-center justify-end overflow-y-auto pb-5">
				<div
					className="mt-4 flex min-h-24 w-full flex-col items-center justify-center"
					aria-live="polite"
				>
					<p className="min-h-11 text-center text-4xl leading-11 font-light tracking-tight tabular-nums">
						{phone}
					</p>
				</div>

				<div className="mt-1 grid w-full max-w-[296px] grid-cols-3 gap-x-7 gap-y-3">
					{KEYS.map(([number, letters]) => (
						<button
							key={number}
							ref={hapticTrigger}
							type="button"
							className="mx-auto grid size-[68px] touch-manipulation appearance-none grid-rows-[38px_12px] content-center place-items-center rounded-full border-0 bg-secondary p-0 text-foreground shadow-none transition select-none active:scale-95 active:bg-bg-neutral-weak-pressed"
							onClick={() => pressKey(number)}
							aria-label={number}
						>
							<span
								className={`flex items-center justify-center text-[1.9rem] leading-none font-normal tabular-nums ${number === "*" || number === "#" ? "row-span-2 h-full" : "h-[38px]"}`}
							>
								{number}
							</span>
							{number !== "*" && number !== "#" && (
								<span className="h-3 whitespace-nowrap text-[0.58rem] leading-3 font-semibold tracking-[0.14em]">
									{letters}
								</span>
							)}
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
