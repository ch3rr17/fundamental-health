import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db.js';
import { draftEmails, prospects } from '$lib/server/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '$lib/server/auth-guard.js';

export const GET: RequestHandler = async (event) => {
	const denied = await requireAuth(event);
	if (denied) return denied;
	const results = await db
		.select({
			draft: draftEmails,
			prospect: prospects
		})
		.from(draftEmails)
		.innerJoin(prospects, eq(draftEmails.prospectId, prospects.id))
		.where(eq(draftEmails.approved, false));

	return json(results);
};
