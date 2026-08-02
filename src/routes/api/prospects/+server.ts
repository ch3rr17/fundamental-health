import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db.js';
import { prospects } from '$lib/server/schema.js';
import { eq } from 'drizzle-orm';
import type { ProspectStatus } from '$lib/types.js';
import { requireAuth } from '$lib/server/auth-guard.js';

export const GET: RequestHandler = async (event) => {
	const denied = await requireAuth(event);
	if (denied) return denied;

	const { url } = event;
	const status = url.searchParams.get('status') as ProspectStatus | null;

	let result;
	if (status) {
		result = await db.select().from(prospects).where(eq(prospects.status, status));
	} else {
		result = await db.select().from(prospects);
	}

	return json(result);
};
