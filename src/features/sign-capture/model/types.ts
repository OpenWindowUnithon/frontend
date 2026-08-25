/** One sign confirmed by the sequence recognizer (LSTM or DTW), for display purposes. */
export interface RecognizedSign {
	id: string;
	label: string;
	description: string;
	icon: string;
	confidence: number;
	category: "action";
	timestamp: number;
}
