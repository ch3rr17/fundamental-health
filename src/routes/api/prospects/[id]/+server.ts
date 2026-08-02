import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db.js';
import { prospects } from '$lib/server/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '$lib/server/auth-guard.js';
import { needsReviewMessage } from '$lib/server/needs-review.js';

export const GET: RequestHandler = async (event) => {
	const denied = await requireAuth(event);
	if (denied) return denied;

	const { params } = event;
	const result = await db.select().from(prospects).where(eq(prospects.id, params.id));

	if (result.length === 0) {
		return json({ error: 'Prospect not found' }, { status: 404 });
	}

	return json(result[0]);
};

export const PATCH: RequestHandler = async (event) => {
	const denied = await requireAuth(event);
	if (denied) return denied;

	const { params, request } = event;
	const body = await request.json();

	// Guard against silently clearing a needs-review flag (e.g. a possible prompt
	// injection attempt in the imported data) through this general-purpose endpoint -
	// the same explicit acknowledgment required by the drafts approval gate
	// (src/routes/api/drafts/[id]/+server.ts) applies to any status change here too.
	if ('status' in body && body.status !== 'needs-review' && body.acknowledgeReview !== true) {
		const [current] = await db.select().from(prospects).where(eq(prospects.id, params.id));
		if (current?.status === 'needs-review') {
			return json(
				{ error: needsReviewMessage('changing its status'), needsReviewAcknowledgement: true },
				{ status: 409 }
			);
		}
	}

	const allowedFields = ['segment', 'segmentConfidence', 'status', 'priorTalkTrack'] as const;
	const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

	for (const field of allowedFields) {
		if (field in body) {
			updates[field] = body[field];
		}
	}

	const result = await db
		.update(prospects)
		.set(updates)
		.where(eq(prospects.id, params.id))
		.returning();

	if (result.length === 0) {
		return json({ error: 'Prospect not found' }, { status: 404 });
	}

	return json(result[0]);
};
