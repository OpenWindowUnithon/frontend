import { useEffect } from "react";
import { Snackbar, type SnackbarProps, useSnackbarAdapter } from "@/shared/ui";

type SnackbarAdapter = ReturnType<typeof useSnackbarAdapter>;
type SnackbarVariant = NonNullable<SnackbarProps["variant"]>;

let adapter: SnackbarAdapter | null = null;
const pending: Array<(currentAdapter: SnackbarAdapter) => void> = [];

function show(message: string, variant: SnackbarVariant = "default") {
	const create = (currentAdapter: SnackbarAdapter) => {
		currentAdapter.create({
			render: () => (
				<Snackbar
					message={message}
					variant={variant}
					actionLabel="닫기"
					onAction={() => currentAdapter.dismiss()}
				/>
			),
		});
	};

	if (adapter) {
		create(adapter);
		return;
	}

	pending.push(create);
}

/**
 * Mount once under SnackbarProvider to make the context adapter available to
 * non-React callers such as API interceptors.
 */
export function SnackbarBridge() {
	const currentAdapter = useSnackbarAdapter();

	useEffect(() => {
		adapter = currentAdapter;

		for (const create of pending.splice(0)) {
			create(currentAdapter);
		}

		return () => {
			if (adapter === currentAdapter) {
				adapter = null;
			}
		};
	}, [currentAdapter]);

	return null;
}

export const snackbar = {
	show,
	success: (message: string) => show(message, "positive"),
	error: (message: string) => show(message, "critical"),
	warning: (message: string) => show(message),
	info: (message: string) => show(message),
	dismiss: () => adapter?.dismiss(),
};
