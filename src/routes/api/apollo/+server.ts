import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { fetchLists } from '$lib/server/apollo.js';
import { requireAuth } from '$lib/server/auth-guard.js';

/** GET /api/apollo — list available Apollo lists. */
export const GET: RequestHandler = async (event) => {
	const denied = await requireAuth(event);
	if (denied) return denied;

	try {
		const lists = await fetchLists();
		return json(lists);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Failed to fetch Apollo lists';
		return json({ error: message }, { status: 502 });
	}
};
