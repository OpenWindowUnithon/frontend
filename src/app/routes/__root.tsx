import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { AppProviders } from "@/app/providers";
import "@/app/styles/index.css";

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
	return (
		<AppProviders>
			<Outlet />
			{import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
		</AppProviders>
	);
}
