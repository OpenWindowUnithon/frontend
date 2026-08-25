/**
 * Returns true if running in local development (vite dev) or preview deployment (Cloudflare pages.dev / PR preview).
 */
export function isLocalOrPreview(): boolean {
	if (import.meta.env.DEV) return true;
	if (typeof window !== "undefined") {
		const host = window.location.hostname;
		return (
			host === "localhost" ||
			host === "127.0.0.1" ||
			host.includes("pages.dev") ||
			host.includes("preview") ||
			window.location.search.includes("preview=true")
		);
	}
	return false;
}
