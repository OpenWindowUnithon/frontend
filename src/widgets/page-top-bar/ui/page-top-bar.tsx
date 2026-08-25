import { Box, Text } from "@seed-design/react";
import { type UIEvent, useCallback, useState } from "react";

export function useCompactTopBar(threshold = 48) {
	const [visible, setVisible] = useState(false);
	const onScroll = useCallback(
		(event: UIEvent<HTMLElement>) => {
			setVisible(event.currentTarget.scrollTop > threshold);
		},
		[threshold],
	);
	return { visible, onScroll };
}

export function PageTopBar({ title, visible }: { title: string; visible: boolean }) {
	return (
		<Box
			as="header"
			bg="bg.layerDefault"
			aria-hidden={!visible}
			className={`absolute top-0 right-0 left-0 z-30 border-b border-border pt-[env(safe-area-inset-top)] shadow-sm transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none ${visible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0"}`}
		>
			<Box height="x14" px="x6" display="flex" alignItems="center">
				<Text as="strong" textStyle="t6Bold">
					{title}
				</Text>
			</Box>
		</Box>
	);
}
