import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { session } = await event.parent();
	redirect(307, session ? '/prospects' : '/signin');
};
