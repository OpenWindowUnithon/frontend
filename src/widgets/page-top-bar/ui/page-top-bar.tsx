import { Box, Text } from "@seed-design/react";

export function PageTopBar({ title }: { title: string }) {
	return (
		<Box
			as="header"
			bg="bg.layerDefault"
			className="z-20 -mx-6 shrink-0 border-b border-border pt-[env(safe-area-inset-top)]"
		>
			<Box height="x14" px="x6" display="flex" alignItems="center">
				<Text as="h1" textStyle="t6Bold">
					{title}
				</Text>
			</Box>
		</Box>
	);
}
