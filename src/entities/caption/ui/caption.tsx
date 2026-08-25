import { cn } from "@/shared/lib";
import type { CaptionType } from "../model/types";

/** Renders one caption bubble — dimmed while interim, solid once the agent marks it final. */
export function Caption({ caption }: { caption: CaptionType }) {
	return (
		<p
			className={cn(
				"rounded-lg bg-muted px-4 py-2 text-lg transition-opacity",
				!caption.final && "opacity-60",
			)}
		>
			{caption.text}
		</p>
	);
}
