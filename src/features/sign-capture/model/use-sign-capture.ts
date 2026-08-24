import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { sample } from "es-toolkit";
import type { Room } from "livekit-client";
import { useEffect, useRef, useState } from "react";
import { publishCaption } from "@/entities/caption";
import { useHandLandmarker } from "@/shared/lib";

const MOCK_PHRASES = [
	"안녕하세요",
	"만나서 반갑습니다",
	"도와주세요",
	"감사합니다",
	"네, 알겠습니다",
];
const EMIT_INTERVAL_MS = 2500;

/**
 * Mock sign inference: no trained model yet, so this just samples a fixed
 * phrase whenever a hand has been in frame long enough. Swap the body for a
 * real "landmarks in, text out" model call later — the call site doesn't change.
 */
function mockInferSign(): string {
	return sample(MOCK_PHRASES);
}

/** Captures the local camera, runs Hand Landmarker on it, and publishes recognized text as captions. */
export function useSignCapture(room: Room | null) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [recognizedText, setRecognizedText] = useState<string | null>(null);
	const [cameraError, setCameraError] = useState(false);
	const lastEmitRef = useRef(0);

	useEffect(() => {
		let stream: MediaStream | undefined;
		navigator.mediaDevices
			.getUserMedia({ video: true })
			.then((s) => {
				stream = s;
				if (videoRef.current) videoRef.current.srcObject = s;
			})
			.catch(() => setCameraError(true));
		return () => {
			for (const track of stream?.getTracks() ?? []) track.stop();
		};
	}, []);

	useHandLandmarker(videoRef, room !== null, (result: HandLandmarkerResult) => {
		if (!room || result.landmarks.length === 0) return;
		const now = performance.now();
		if (now - lastEmitRef.current < EMIT_INTERVAL_MS) return;
		lastEmitRef.current = now;

		const text = mockInferSign();
		setRecognizedText(text);
		publishCaption(room, {
			id: crypto.randomUUID(),
			text,
			sourceRole: "signer",
			timestamp: Date.now(),
		});
	});

	return { videoRef, recognizedText, cameraError };
}
