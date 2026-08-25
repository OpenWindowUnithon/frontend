import type { CommunicationMode } from "./types";

export type AiVoiceSpeed = "SLOW" | "NORMAL" | "FAST";
export type AiVoice = "CALM" | "BRIGHT" | "CLEAR";

export interface CallPreferences {
	defaultCommunication: CommunicationMode;
	captionAutoScroll: boolean;
	aiVoiceSpeed: AiVoiceSpeed;
	aiVoice: AiVoice;
}

const STORAGE_KEY = "openwindow.call-preferences.v1";

export const DEFAULT_CALL_PREFERENCES: CallPreferences = {
	defaultCommunication: "TEXT",
	captionAutoScroll: true,
	aiVoiceSpeed: "NORMAL",
	aiVoice: "CALM",
};

export function getCallPreferences(): CallPreferences {
	try {
		const saved = JSON.parse(
			localStorage.getItem(STORAGE_KEY) ?? "null",
		) as Partial<CallPreferences> | null;
		if (!saved) return DEFAULT_CALL_PREFERENCES;
		return {
			defaultCommunication:
				saved.defaultCommunication === "SIGN"
					? "SIGN"
					: DEFAULT_CALL_PREFERENCES.defaultCommunication,
			captionAutoScroll:
				typeof saved.captionAutoScroll === "boolean"
					? saved.captionAutoScroll
					: DEFAULT_CALL_PREFERENCES.captionAutoScroll,
			aiVoiceSpeed: ["SLOW", "NORMAL", "FAST"].includes(saved.aiVoiceSpeed ?? "")
				? (saved.aiVoiceSpeed as AiVoiceSpeed)
				: DEFAULT_CALL_PREFERENCES.aiVoiceSpeed,
			aiVoice: ["CALM", "BRIGHT", "CLEAR"].includes(saved.aiVoice ?? "")
				? (saved.aiVoice as AiVoice)
				: DEFAULT_CALL_PREFERENCES.aiVoice,
		};
	} catch {
		return DEFAULT_CALL_PREFERENCES;
	}
}

export function setCallPreferences(preferences: CallPreferences) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}
