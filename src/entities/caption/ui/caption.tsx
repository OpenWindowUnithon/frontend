import { cn } from "@/shared/lib";
import type { CaptionType } from "../model/types";

/** Renders one caption bubble — dimmed while interim, solid once the agent marks it final. */
export function Caption({ caption }: { caption: CaptionType }) {
	return (
		<p
			className={cn(
				"w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-3xl rounded-tl-lg bg-muted px-5 py-3.5 text-lg font-medium leading-7 transition-opacity",
				!caption.final && "opacity-60",
			)}
		>
			{caption.text}
		</p>
	);
}
