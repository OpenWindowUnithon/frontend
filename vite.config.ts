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
		seedDesignPlugin(),
		// SEED component styles are emitted as route-level CSS chunks. Declare the
		// cascade order before every stylesheet so those chunks always land in the
		// intended layer, regardless of navigation/load order.
		{
			name: "inject-seed-layer-order",
			transformIndexHtml() {
				return [
					{
						tag: "style",
						children:
							"@layer theme, base, seed-base, components, seed-components, utilities;",
						injectTo: "head-prepend",
					},
				];
			},
		},
		tailwindcss(),
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
		// Backend has no CORS config yet — proxying same-origin sidesteps that for
		// local dev. Leave VITE_API_BASE_URL empty locally to use this; set it to
		// the real deployed backend URL for prod (which still needs CORS fixed
		// there, since this proxy only exists in `vite dev`).
		// Swap the target to http://localhost:8080 if you're running the Spring
		// backend locally instead (./gradlew bootRun).
		proxy: {
			"/api": {
				target: "https://naru-backend.perasite.dev",
				changeOrigin: true,
			},
		},
	},
});
