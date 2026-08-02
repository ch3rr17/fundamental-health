import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getProspectWithDraft } from '$lib/server/queries.js';
import { requireSession } from '$lib/server/require-session.js';

export const load: PageServerLoad = async (event) => {
	await requireSession(event);
	const result = await getProspectWithDraft(event.params.id);
	if (!result) error(404, 'Prospect not found');
	return result;
};
