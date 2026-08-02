import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db.js';
import { prospects } from '$lib/server/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '$lib/server/auth-guard.js';

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
