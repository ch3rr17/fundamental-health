import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { Session } from '@auth/sveltekit';

type AuthedSession = Session & { user: NonNullable<Session['user']> };
type AuthSessionResult =
	| { denied: Response; session: null }
	| { denied: null; session: AuthedSession };

/**
 * Returns the session if authenticated, or a 401 `denied` response if not.
 * Use this over `requireAuth` when the route needs data off the session (e.g.
 * the user's name) — it reads `event.locals.auth()` exactly once.
 */
export async function requireAuthSession(event: RequestEvent): Promise<AuthSessionResult> {
	const session = await event.locals.auth();
	const user = session?.user;
	if (!session || !user) {
		return { denied: json({ error: 'Unauthorized' }, { status: 401 }), session: null };
	}
	return { denied: null, session: { ...session, user } };
}

/** Returns a 401 response if the user is not authenticated. Returns null if authenticated. */
export async function requireAuth(event: RequestEvent): Promise<Response | null> {
	const { denied } = await requireAuthSession(event);
	return denied;
}
