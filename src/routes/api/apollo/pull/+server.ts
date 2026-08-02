import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { importFromApollo } from '$lib/server/apollo.js';
import { requireAuth } from '$lib/server/auth-guard.js';

/** POST /api/apollo/pull — pull contacts from an Apollo list into the app. */
export const POST: RequestHandler = async (event) => {
	const denied = await requireAuth(event);
	if (denied) return denied;

	const { labelId, labelName } = await event.request.json();

	if (!labelId) {
		return json({ error: 'labelId is required' }, { status: 400 });
	}

	try {
		const results = await importFromApollo(labelId, labelName);
		return json(results, { status: 201 });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Failed to import from Apollo';
		return json({ error: message }, { status: 502 });
	}
};
