import type { HandLandmarkerResult, PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import { debounce } from "es-toolkit";
import type { Room } from "livekit-client";
import { useEffect, useMemo, useRef, useState } from "react";
import { sendChatText } from "@/entities/call";
import { useHandLandmarker, usePoseLandmarker } from "@/shared/lib";
import { composeSignSentence } from "../api/sign-api";
import {
	extractFeatures,
	latestPoseLandmarks,
	RollingWindow,
	splitHandsByHandedness,
} from "./landmarks";
import { CONFIDENCE_THRESHOLD, predictSign } from "./sign-model";

const CONSECUTIVE_REQUIRED = 3;
const NO_SIGN_STREAK_TO_RESET = 5;
// How long to wait after the last recognized word before treating the
// buffered words as one finished utterance and asking the LLM to compose it.
const UTTERANCE_IDLE_MS = 1800;

/** Captures the local camera, runs Hand+Pose Landmarker on it, and sends recognized text as chat. */
export function useSignCapture(room: Room | null) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [recognizedText, setRecognizedText] = useState<string | null>(null);
	const [cameraError, setCameraError] = useState(false);

	const windowRef = useRef(new RollingWindow());
	const latestPoseRef = useRef<PoseLandmarkerResult | null>(null);
	const lastCandidateRef = useRef<string | null>(null);
	const candidateStreakRef = useRef(0);
	const insertedForSegmentRef = useRef(false);
	const predictingRef = useRef(false);
	const roomRef = useRef(room);
	roomRef.current = room;
	const wordBufferRef = useRef<string[]>([]);

	// Fires once the signer pauses for UTTERANCE_IDLE_MS: sends the buffered
	// gloss words to the backend LLM and speaks/sends whatever sentence comes
	// back (or the raw words, if the compose call itself fails).
	const flushUtterance = useMemo(
		() =>
			debounce(() => {
				const words = wordBufferRef.current;
				wordBufferRef.current = [];
				const currentRoom = roomRef.current;
				if (words.length === 0 || !currentRoom) return;

				composeSignSentence(words)
					.then((sentence) => {
						setRecognizedText(sentence);
						sendChatText(currentRoom, sentence);
					})
					.catch(() => {
						const fallback = words.join(" ");
						setRecognizedText(fallback);
						sendChatText(currentRoom, fallback);
					});
			}, UTTERANCE_IDLE_MS),
		[],
	);
	useEffect(() => () => flushUtterance.cancel(), [flushUtterance]);

	useEffect(() => {
		let cancelled = false;
		let stream: MediaStream | undefined;
		navigator.mediaDevices
			.getUserMedia({ video: true })
			.then((s) => {
				if (cancelled) {
					for (const track of s.getTracks()) track.stop();
					return;
				}
				stream = s;
				if (videoRef.current) videoRef.current.srcObject = s;
			})
			.catch(() => setCameraError(true));
		return () => {
			cancelled = true;
			for (const track of stream?.getTracks() ?? []) track.stop();
		};
	}, []);

	usePoseLandmarker(videoRef, room !== null, (result: PoseLandmarkerResult) => {
		latestPoseRef.current = result;
	});

	useHandLandmarker(videoRef, room !== null, (handResult: HandLandmarkerResult) => {
		const { leftHandLandmarks, rightHandLandmarks } = splitHandsByHandedness(handResult);
		const poseLandmarks = latestPoseLandmarks(latestPoseRef.current);
		windowRef.current.push(
			extractFeatures({ poseLandmarks, leftHandLandmarks, rightHandLandmarks }),
		);

		const frames = windowRef.current.toArray();
		if (!frames || predictingRef.current) return;

		predictingRef.current = true;
		predictSign(frames)
			.then(({ label, confidence }) => {
				const candidate = label && confidence >= CONFIDENCE_THRESHOLD ? label : null;

				if (candidate === lastCandidateRef.current) {
					candidateStreakRef.current += 1;
				} else {
					lastCandidateRef.current = candidate;
					candidateStreakRef.current = 1;
				}

				if (candidate === null && candidateStreakRef.current >= NO_SIGN_STREAK_TO_RESET) {
					insertedForSegmentRef.current = false;
				}

				if (
					candidate &&
					candidateStreakRef.current >= CONSECUTIVE_REQUIRED &&
					!insertedForSegmentRef.current
				) {
					insertedForSegmentRef.current = true;
					wordBufferRef.current = [...wordBufferRef.current, candidate];
					setRecognizedText(wordBufferRef.current.join(" "));
					flushUtterance();
				}
			})
			.finally(() => {
				predictingRef.current = false;
			});
	});

	return { videoRef, recognizedText, cameraError };
}
