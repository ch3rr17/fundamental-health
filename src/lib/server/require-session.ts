import { redirect } from '@sveltejs/kit';
import type { ServerLoadEvent } from '@sveltejs/kit';

/** Redirects to /signin if there's no session. Call from a +page.server.ts load. */
export async function requireSession(event: ServerLoadEvent) {
	const { session } = await event.parent();
	if (!session) {
		redirect(307, '/signin');
	}
	return session;
}
