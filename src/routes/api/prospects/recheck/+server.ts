import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db.js';
import { prospects } from '$lib/server/schema.js';
import { eq } from 'drizzle-orm';
import { checkDedup } from '$lib/server/dedup.js';
import { assignSegment } from '$lib/server/segment.js';
import { requireAuth } from '$lib/server/auth-guard.js';

/**
 * POST /api/prospects/recheck
 * Re-runs dedup on all "already-contacted" prospects.
 * Any that are no longer found in Klaviyo get moved back to "imported"
 * with a fresh segment assignment.
 */
export const POST: RequestHandler = async (event) => {
	const denied = await requireAuth(event);
	if (denied) return denied;

	const alreadyContacted = await db
		.select()
		.from(prospects)
		.where(eq(prospects.status, 'already-contacted'));

	let cleared = 0;

	for (const prospect of alreadyContacted) {
		const dedup = await checkDedup(
			prospect.email ?? null,
			prospect.firstName,
			prospect.lastName,
			prospect.organization ?? null
		);

		if (!dedup.matched) {
			const segResult = assignSegment({
				title: prospect.title ?? null,
				organization: prospect.organization ?? null,
				location: prospect.location ?? null
			});

			await db
				.update(prospects)
				.set({
					status: 'imported',
					segment: segResult.segment,
					segmentConfidence: segResult.confidence,
					priorContactDate: null,
					priorTalkTrack: null,
					updatedAt: new Date().toISOString()
				})
				.where(eq(prospects.id, prospect.id));

			cleared++;
		}
	}

	return json({
		checked: alreadyContacted.length,
		cleared,
		stillContacted: alreadyContacted.length - cleared
	});
};
