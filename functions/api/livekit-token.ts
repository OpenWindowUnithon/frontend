import { AccessToken } from "livekit-server-sdk";

interface Env {
	LIVEKIT_API_KEY: string;
	LIVEKIT_API_SECRET: string;
}

interface TokenRequestBody {
	room: string;
	identity: string;
}

/**
 * No auth system exists yet (see src/pages/lobby), so this endpoint is
 * otherwise open to anyone — allowlisting room names is the minimum guard
 * against minting tokens for arbitrary LiveKit rooms. Keep in sync with
 * DEMO_ROOM in src/pages/lobby/ui/lobby-page.tsx.
 */
const ALLOWED_ROOMS = ["demo"];

export const onRequestPost: PagesFunction<Env> = async (context) => {
	const { room, identity } = (await context.request.json()) as TokenRequestBody;

	if (!room || !identity) {
		return Response.json({ error: "room and identity are required" }, { status: 400 });
	}
	if (!ALLOWED_ROOMS.includes(room)) {
		return Response.json({ error: "invalid room" }, { status: 403 });
	}

	const token = new AccessToken(context.env.LIVEKIT_API_KEY, context.env.LIVEKIT_API_SECRET, {
		identity,
	});
	token.addGrant({ room, roomJoin: true, canPublishData: true, canPublish: false });

	return Response.json({ token: await token.toJwt() });
};
