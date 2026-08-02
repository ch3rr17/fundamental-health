import type { PageServerLoad } from './$types';
import { listProspects } from '$lib/server/queries.js';
import { requireSession } from '$lib/server/require-session.js';

export const load: PageServerLoad = async (event) => {
	await requireSession(event);
	return { prospects: await listProspects() };
};
