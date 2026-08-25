import { createFileRoute } from "@tanstack/react-router";
import { TestCameraPage } from "@/pages/test-camera";

export const Route = createFileRoute("/test-camera")({
	component: TestCameraPage,
});
