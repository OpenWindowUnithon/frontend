import { cn } from "@/shared/lib";
import type { CaptionType } from "../model/types";

/**
 * Renders one caption bubble — dimmed while interim, solid once the agent marks it final.
 * `align` flips it to the "own speech" side (right, accent-colored) for a screen showing its
 * own participant's captions rather than the other side's -- e.g. the HEARING participant's
 * own live transcript, alongside the other side's messages on the left.
 */
export function Caption({
	caption,
	align = "start",
}: {
	caption: CaptionType;
	align?: "start" | "end";
}) {
	return (
		<div className={cn("flex", align === "end" && "justify-end")}>
			<p
				className={cn(
					"w-fit max-w-[85%] whitespace-pre-wrap break-words px-5 py-3.5 text-lg font-medium leading-7 transition-opacity",
					align === "end"
						? "rounded-3xl rounded-tr-lg bg-accent text-accent-foreground"
						: "rounded-3xl rounded-tl-lg bg-muted",
					!caption.final && "opacity-60",
				)}
			>
				{caption.text}
			</p>
		</div>
	);
}
