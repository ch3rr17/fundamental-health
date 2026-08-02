import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

/** Returns a 401 response if the user is not authenticated. Returns null if authenticated. */
export async function requireAuth(event: RequestEvent): Promise<Response | null> {
	const session = await event.locals.auth();
	if (!session?.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	return null;
}
