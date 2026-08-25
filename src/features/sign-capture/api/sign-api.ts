import { apiClient } from "@/shared/api";

/** Sends a signed gloss sequence to the backend, which asks an LLM to turn it into one natural sentence. */
export async function composeSignSentence(words: string[]): Promise<string> {
	const { data } = await apiClient.post<{ sentence: string }>("/api/sign-language/compose", {
		words,
	});
	return data.sentence;
}
