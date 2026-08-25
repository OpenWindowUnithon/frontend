import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { getDeviceKey, getMyPhone, registerPhone, setMyPhone } from "@/entities/call";
import { ActionButton, Input } from "@/shared/ui";
import { PhoneNav } from "@/widgets/phone-nav";

function formatPhone(value: string) {
	if (value.length <= 3) return value;
	if (value.length <= 7) return `${value.slice(0, 3)} ${value.slice(3)}`;
	return `${value.slice(0, 3)} ${value.slice(3, 7)} ${value.slice(7, 11)}`;
}

export function ProfilePage() {
	const [phone, setPhone] = useState(getMyPhone);
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
			<section className="flex flex-1 flex-col pt-10">
				<h1 className="text-3xl font-bold">나의 정보</h1>
				<p className="mt-2 text-muted-foreground">전화를 받을 내 번호를 등록해 주세요.</p>
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
			</section>
			<PhoneNav current="profile" />
		</main>
	);
}
