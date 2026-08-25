import {
	IconHandWaveLine,
	IconSpeakerWave2Line,
	IconSpeedometerLine,
	IconTextAlignleftLine,
} from "@karrotmarket/react-monochrome-icon";
import { Icon, Text } from "@seed-design/react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { type ReactNode, useState } from "react";
import {
	type CallPreferences,
	getCallPreferences,
	getDeviceKey,
	getMyPhone,
	registerPhone,
	setCallPreferences,
	setMyPhone,
} from "@/entities/call";
import { SignCaptureView } from "@/features/sign-capture";
import { snackbar } from "@/shared/lib";
import {
	ActionButton,
	List,
	ListDivider,
	ListHeader,
	ListItem,
	ListSwitchItem,
	SeedSelectContent,
	SeedSelectItem,
	SeedSelectRoot,
	SeedSelectTrigger,
	Switchmark,
	TextField,
	TextFieldInput,
} from "@/shared/ui";
import { PageTopBar, useCompactTopBar } from "@/widgets/page-top-bar";
import { PhoneNav } from "@/widgets/phone-nav";

function formatPhone(value: string) {
	if (value.length <= 3) return value;
	if (value.length <= 7) return `${value.slice(0, 3)} ${value.slice(3)}`;
	return `${value.slice(0, 3)} ${value.slice(3, 7)} ${value.slice(7, 11)}`;
}

function registrationErrorMessage(error: unknown) {
	if (axios.isAxiosError<{ message?: string }>(error)) {
		return error.response?.data?.message ?? "서버 연결을 확인해 주세요.";
	}
	return "전화번호를 저장하지 못했어요.";
}

function isPhoneOwnershipConflict(error: unknown) {
	return axios.isAxiosError(error) && error.response?.status === 409;
}

export function ProfilePage() {
	const topBar = useCompactTopBar();
	const [phone, setPhone] = useState(getMyPhone);
	const [preferences, setPreferencesState] = useState(getCallPreferences);
	const [showSignTraining, setShowSignTraining] = useState(false);
	const updatePreference = <Key extends keyof CallPreferences>(
		key: Key,
		value: CallPreferences[Key],
	) => {
		setPreferencesState((current) => {
			const next = { ...current, [key]: value };
			setCallPreferences(next);
			snackbar.success("통화 설정을 저장했어요.");
			return next;
		});
	};
	const normalized = phone.replace(/\D/g, "").slice(0, 11);
	const registration = useMutation({
		mutationFn: () => registerPhone(normalized, getDeviceKey()),
		onSuccess: (registered) => {
			setMyPhone(registered);
			setPhone(registered);
			snackbar.success("전화번호를 저장했어요.");
		},
		onError: (error) => {
			if (isPhoneOwnershipConflict(error)) {
				setMyPhone("");
				setPhone("");
				snackbar.error("이 전화번호가 다른 기기에 등록되어 입력값을 초기화했어요.");
				return;
			}
			snackbar.error(registrationErrorMessage(error));
		},
	});
	return (
		<main className="relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-card">
			<PageTopBar title="나의 정보" visible={topBar.visible} />
			<section
				className="flex min-h-0 flex-1 touch-pan-y flex-col overflow-y-auto overscroll-y-contain pt-[calc(2.5rem+env(safe-area-inset-top))] pb-6 [&>*]:shrink-0"
				onScroll={topBar.onScroll}
			>
				<div className="px-6">
					<Text as="h1" textStyle="screenTitle">
						나의 정보
					</Text>
					<TextField
						className="mt-10"
						description="내 전화번호"
						size="large"
						value={formatPhone(normalized)}
						onValueChange={({ value }) => setPhone(value.replace(/\D/g, "").slice(0, 11))}
					>
						<TextFieldInput id="my-phone" inputMode="tel" aria-label="내 전화번호" />
					</TextField>
					<ActionButton
						className="mt-4 w-full"
						size="large"
						disabled={!/^01\d{8,9}$/.test(normalized) || registration.isPending}
						onClick={() => registration.mutate()}
					>
						{registration.isPending ? "등록 중…" : "전화번호 저장"}
					</ActionButton>
				</div>
				<div className="mt-10 px-4">
					<ListHeader as="h2" variant="boldSolid">
						통화 설정
					</ListHeader>
					<List>
						<PreferenceSelect
							label="기본 통화 방식"
							icon={<Icon svg={<IconHandWaveLine />} />}
							value={preferences.defaultCommunication}
							onChange={(value) =>
								updatePreference(
									"defaultCommunication",
									value as CallPreferences["defaultCommunication"],
								)
							}
							options={[
								["TEXT", "텍스트"],
								["SIGN", "수어"],
							]}
						/>
						<ListDivider />
						<ListSwitchItem
							title="자막 자동 스크롤"
							detail="새 대화를 자동으로 따라가요."
							prefix={<Icon svg={<IconTextAlignleftLine />} />}
							suffix={<Switchmark tone="neutral" />}
							checked={preferences.captionAutoScroll}
							onCheckedChange={(checked) => updatePreference("captionAutoScroll", checked)}
						/>
						<ListDivider />
						<PreferenceSelect
							label="AI 음성 속도"
							icon={<Icon svg={<IconSpeedometerLine />} />}
							value={preferences.aiVoiceSpeed}
							onChange={(value) =>
								updatePreference("aiVoiceSpeed", value as CallPreferences["aiVoiceSpeed"])
							}
							options={[
								["SLOW", "느리게"],
								["NORMAL", "보통"],
								["FAST", "빠르게"],
							]}
						/>
						<ListDivider />
						<PreferenceSelect
							label="AI 음성 종류"
							icon={<Icon svg={<IconSpeakerWave2Line />} />}
							value={preferences.aiVoice}
							onChange={(value) => updatePreference("aiVoice", value as CallPreferences["aiVoice"])}
							options={[
								["CALM", "차분한 목소리"],
								["BRIGHT", "밝은 목소리"],
								["CLEAR", "또렷한 목소리"],
							]}
						/>
					</List>
				</div>
				<div className="mt-10 px-4">
					<ListHeader as="h2" variant="boldSolid">
						수어 단어 학습
					</ListHeader>
					<p className="mt-1 text-muted-foreground text-sm">
						모델에 없는 수어 단어를 카메라로 직접 녹화해서 등록할 수 있어요. 등록한 단어는 모든
						사용자에게 공유돼요.
					</p>
					<ActionButton
						className="mt-4 w-full"
						size="large"
						variant="neutralOutline"
						onClick={() => setShowSignTraining((prev) => !prev)}
					>
						{showSignTraining ? "카메라 닫기" : "카메라로 단어 학습하기"}
					</ActionButton>
					{showSignTraining && (
						<div className="mt-4 flex justify-center">
							<SignCaptureView room={null} />
						</div>
					)}
				</div>
			</section>
			<PhoneNav current="profile" />
		</main>
	);
}

function PreferenceSelect({
	label,
	icon,
	value,
	options,
	onChange,
}: {
	label: string;
	icon: ReactNode;
	value: string;
	options: ReadonlyArray<readonly [string, string]>;
	onChange: (value: string) => void;
}) {
	return (
		<ListItem
			prefix={icon}
			title={label}
			suffix={
				<SeedSelectRoot
					label={<span className="sr-only">{label}</span>}
					size="medium"
					value={[value]}
					onValueChange={([next]) => {
						if (next) onChange(next);
					}}
				>
					<SeedSelectTrigger className="min-w-36" />
					<SeedSelectContent>
						{options.map(([optionValue, optionLabel]) => (
							<SeedSelectItem key={optionValue} value={optionValue} label={optionLabel} />
						))}
					</SeedSelectContent>
				</SeedSelectRoot>
			}
		/>
	);
}
