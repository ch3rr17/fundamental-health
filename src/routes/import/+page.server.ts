import type { PageServerLoad } from './$types';
import { requireSession } from '$lib/server/require-session.js';

export const load: PageServerLoad = async (event) => {
	await requireSession(event);
};
