import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

export default defineConfig([
	...fsd.configs.recommended,
	{
		rules: {
			"fsd/insignificant-slice": "off",
		},
	},
	{
		files: ["./src/app/**"],
		rules: {
			"fsd/segments-by-purpose": "off",
		},
	},
	{
		files: ["./src/shared/ui/seed-design/**"],
		rules: {
			"fsd/no-reserved-folder-names": "off",
		},
	},
]);
