const DEVICE_KEY = "phone-device-key";
const PHONE_KEY = "my-phone";

export function getDeviceKey(): string {
	const existing = localStorage.getItem(DEVICE_KEY);
	if (existing) return existing;
	const created = crypto.randomUUID();
	localStorage.setItem(DEVICE_KEY, created);
	return created;
}

export function getMyPhone(): string {
	return localStorage.getItem(PHONE_KEY) ?? "";
}

export function setMyPhone(phone: string): void {
	localStorage.setItem(PHONE_KEY, phone);
}
