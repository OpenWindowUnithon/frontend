import { createFileRoute } from "@tanstack/react-router";
import { RecentPage } from "@/pages/recent";

export const Route = createFileRoute("/recent")({ component: RecentPage });
