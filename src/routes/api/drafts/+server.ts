import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { generateDraft } from '$lib/server/draft.js';
import { requireAuth } from '$lib/server/auth-guard.js';

/** Generate an AI draft for a prospect. */
export const POST: RequestHandler = async (event) => {
	const denied = await requireAuth(event);
	if (denied) return denied;

	const { request } = event;
	const { prospectId } = await request.json();

	if (!prospectId) {
		return json({ error: 'prospectId is required' }, { status: 400 });
	}

	try {
		const draft = await generateDraft(prospectId);
		return json(draft, { status: 201 });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Failed to generate draft';
		return json({ error: message }, { status: 400 });
	}
};
