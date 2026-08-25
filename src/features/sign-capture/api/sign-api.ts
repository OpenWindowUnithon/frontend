import { apiClient } from "@/shared/api";

export interface ConversationTurn {
	speaker: "DEAF" | "HEARING";
	text: string;
}

/**
 * Sends a signed gloss sequence to the backend, which asks an LLM to turn it into one
 * natural sentence. `history` (recent prior turns from both sides of the call) lets the
 * LLM resolve context-dependent phrases (e.g. "그럼 4시로요" only makes sense next to the
 * appointment-time turn that came before it).
 */
export async function composeSignSentence(
	words: string[],
	history: ConversationTurn[] = [],
): Promise<string> {
	const { data } = await apiClient.post<{ sentence: string }>("/api/sign-language/compose", {
		words,
		history,
	});
	return data.sentence;
}
