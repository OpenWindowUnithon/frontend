import { Caption, type CaptionType } from "@/entities/caption";

export function CaptionList({ captions }: { captions: CaptionType[] }) {
	return (
		<div className="flex w-full max-w-md flex-col gap-2 overflow-y-auto">
			{captions.map((caption) => (
				<Caption caption={caption} key={caption.id} />
			))}
		</div>
	);
}
