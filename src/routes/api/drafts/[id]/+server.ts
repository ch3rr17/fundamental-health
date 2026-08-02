import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db.js';
import { draftEmails, prospects } from '$lib/server/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '$lib/server/auth-guard.js';
import { needsReviewMessage } from '$lib/server/needs-review.js';

export const GET: RequestHandler = async (event) => {
	const denied = await requireAuth(event);
	if (denied) return denied;

	const { params } = event;
	const result = await db.select().from(draftEmails).where(eq(draftEmails.id, params.id));

	if (result.length === 0) {
		return json({ error: 'Draft not found' }, { status: 404 });
	}

	return json(result[0]);
};

/** Update a draft — edit subject/body or approve it. */
export const PATCH: RequestHandler = async (event) => {
	const denied = await requireAuth(event);
	if (denied) return denied;

	const { params, request } = event;
	const body = await request.json();

	// Hard gate: a prospect flagged needs-review (e.g. a possible prompt injection
	// attempt in its imported data) can't be approved by the same one-click action as
	// any other draft. The caller must explicitly acknowledge the flag first.
	if (body.approved === true && body.acknowledgeReview !== true) {
		const [row] = await db
			.select({ prospect: prospects })
			.from(draftEmails)
			.innerJoin(prospects, eq(draftEmails.prospectId, prospects.id))
			.where(eq(draftEmails.id, params.id));

		if (row?.prospect.status === 'needs-review') {
			return json(
				{ error: needsReviewMessage('approving'), needsReviewAcknowledgement: true },
				{ status: 409 }
			);
		}
	}

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
