import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { generateDraft } from '$lib/server/draft.js';
import { requireAuthSession } from '$lib/server/auth-guard.js';

/** Generate an AI draft for a prospect. */
export const POST: RequestHandler = async (event) => {
	const auth = await requireAuthSession(event);
	if (auth.denied) return auth.denied;

	const { request } = event;
	const { prospectId } = await request.json();

	if (!prospectId) {
		return json({ error: 'prospectId is required' }, { status: 400 });
	}

	const senderName = auth.session.user.name ?? undefined;

	try {
		const draft = await generateDraft(prospectId, senderName);
		return json(draft, { status: 201 });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Failed to generate draft';
		return json({ error: message }, { status: 400 });
	}
};
