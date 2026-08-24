import path from "node:path";
import { seedDesignPlugin } from "@seed-design/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// tanstackRouter must run before react() — it generates routeTree.gen.ts
// which react's plugin then transforms.
export default defineConfig({
	plugins: [
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
			routesDirectory: "./src/app/routes",
			generatedRouteTree: "./src/app/routeTree.gen.ts",
		}),
		react(),
		tailwindcss(),
		seedDesignPlugin(),
	],
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
		// SEED React components resolve their layered CSS through this condition.
		conditions: ["seed-layered"],
		tsconfigPaths: true,
	},
	server: {
		port: 3000,
	},
});
