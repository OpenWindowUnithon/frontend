import type { Caption as CaptionType } from "../model/types";

/** Renders one caption bubble — given a Caption, display it. No fetching, no state. */
export function Caption({ caption }: { caption: CaptionType }) {
	return <p className="rounded-lg bg-muted px-4 py-2 text-lg">{caption.text}</p>;
}
