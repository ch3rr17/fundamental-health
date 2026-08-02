import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db.js';
import { draftEmails, prospects } from '$lib/server/schema.js';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const result = await db.select().from(draftEmails).where(eq(draftEmails.id, params.id));

	if (result.length === 0) {
		return json({ error: 'Draft not found' }, { status: 404 });
	}

	return json(result[0]);
};

/** Update a draft — edit subject/body or approve it. */
export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await request.json();

	const allowedFields = ['subject', 'body', 'approved'] as const;
	const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

	for (const field of allowedFields) {
		if (field in body) {
			updates[field] = body[field];
		}
	}

	const [draft] = await db
		.update(draftEmails)
		.set(updates)
		.where(eq(draftEmails.id, params.id))
		.returning();

	if (!draft) {
		return json({ error: 'Draft not found' }, { status: 404 });
	}

	// If approved, update prospect status
	if (body.approved === true) {
		await db
			.update(prospects)
			.set({ status: 'approved', updatedAt: new Date().toISOString() })
			.where(eq(prospects.id, draft.prospectId));
	}

	return json(draft);
};
