import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
	type CallPreferences,
	getCallPreferences,
	getDeviceKey,
	getMyPhone,
	registerPhone,
	setCallPreferences,
	setMyPhone,
} from "@/entities/call";
import { ActionButton, Input } from "@/shared/ui";
import { PhoneNav } from "@/widgets/phone-nav";

function formatPhone(value: string) {
	if (value.length <= 3) return value;
	if (value.length <= 7) return `${value.slice(0, 3)} ${value.slice(3)}`;
	return `${value.slice(0, 3)} ${value.slice(3, 7)} ${value.slice(7, 11)}`;
}

export function ProfilePage() {
	const [phone, setPhone] = useState(getMyPhone);
	const [preferences, setPreferencesState] = useState(getCallPreferences);
	const updatePreference = <Key extends keyof CallPreferences>(
		key: Key,
		value: CallPreferences[Key],
	) => {
		setPreferencesState((current) => {
			const next = { ...current, [key]: value };
			setCallPreferences(next);
			return next;
		});
	};
	const normalized = phone.replace(/\D/g, "").slice(0, 11);
	const registration = useMutation({
		mutationFn: () => registerPhone(normalized, getDeviceKey()),
		onSuccess: (registered) => {
			setMyPhone(registered);
			setPhone(registered);
		},
	});
	return (
		<main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-card px-6 pt-[env(safe-area-inset-top)] pb-[max(1rem,env(safe-area-inset-bottom))]">
			<section className="flex flex-1 flex-col overflow-y-auto pt-10 pb-6">
				<h1 className="text-3xl font-bold">나의 정보</h1>
				<p className="mt-2 text-muted-foreground">내 번호와 통화 환경을 설정할 수 있어요.</p>
				<label className="mt-10 text-sm font-semibold" htmlFor="my-phone">
					내 전화번호
				</label>
				<Input
					id="my-phone"
					className="mt-2"
					value={formatPhone(normalized)}
					placeholder="010 1234 5678"
					onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 11))}
				/>
				<ActionButton
					className="mt-4 w-full"
					size="large"
					disabled={!/^01\d{8,9}$/.test(normalized) || registration.isPending}
					onClick={() => registration.mutate()}
				>
					{registration.isPending ? "등록 중…" : "전화번호 저장"}
				</ActionButton>
				{registration.isSuccess && <p className="mt-3 text-sm text-fg-positive">저장했어요.</p>}
				{registration.isError && (
					<p className="mt-3 text-sm text-destructive">저장하지 못했어요.</p>
				)}

				<h2 className="mt-10 text-xl font-bold">통화 설정</h2>
				<div className="mt-4 divide-y divide-border rounded-2xl bg-muted px-4">
					<PreferenceSelect
						label="기본 통화 방식"
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
					<div className="flex min-h-18 items-center justify-between gap-4 py-4">
						<div>
							<p className="font-semibold">자막 자동 스크롤</p>
							<p className="mt-1 text-sm text-muted-foreground">새 대화를 자동으로 따라가요.</p>
						</div>
						<button
							type="button"
							role="switch"
							aria-checked={preferences.captionAutoScroll}
							onClick={() => updatePreference("captionAutoScroll", !preferences.captionAutoScroll)}
							className={`relative h-8 w-14 shrink-0 rounded-full transition-colors focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring ${preferences.captionAutoScroll ? "bg-accent" : "bg-border"}`}
						>
							<span
								className={`absolute top-1 left-1 size-6 rounded-full bg-white shadow-sm transition-transform ${preferences.captionAutoScroll ? "translate-x-6" : "translate-x-0"}`}
							/>
						</button>
					</div>
					<PreferenceSelect
						label="AI 음성 속도"
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
					<PreferenceSelect
						label="AI 음성 종류"
						value={preferences.aiVoice}
						onChange={(value) => updatePreference("aiVoice", value as CallPreferences["aiVoice"])}
						options={[
							["CALM", "차분한 목소리"],
							["BRIGHT", "밝은 목소리"],
							["CLEAR", "또렷한 목소리"],
						]}
					/>
				</div>
			</section>
			<PhoneNav current="profile" />
		</main>
	);
}

function PreferenceSelect({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: string;
	options: ReadonlyArray<readonly [string, string]>;
	onChange: (value: string) => void;
}) {
	return (
		<label className="flex min-h-18 items-center justify-between gap-4 py-4">
			<span className="font-semibold">{label}</span>
			<select
				className="min-h-11 max-w-44 rounded-xl border border-border bg-card px-3 text-right font-medium"
				value={value}
				onChange={(event) => onChange(event.target.value)}
			>
				{options.map(([optionValue, optionLabel]) => (
					<option key={optionValue} value={optionValue}>
						{optionLabel}
					</option>
				))}
			</select>
		</label>
	);
}
