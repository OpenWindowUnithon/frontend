import { createFileRoute } from "@tanstack/react-router";
import { callParamsSchema } from "@/entities/call";
import { CallPage } from "@/pages/call";

export const Route = createFileRoute("/call")({
	validateSearch: (search) => callParamsSchema.parse(search),
	component: CallPage,
});
