import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db.js';
import { prospects, draftEmails } from '$lib/server/schema.js';
import { eq, and } from 'drizzle-orm';
import { pushToKlaviyo, pollSendConfirmation } from '$lib/server/klaviyo.js';
import type { TalkTrackSegment } from '$lib/types.js';
import { requireAuth } from '$lib/server/auth-guard.js';

/**
 * Push an approved prospect to Klaviyo.
 * Hard gate: draft must be approved before push is allowed.
 */
export const POST: RequestHandler = async (event) => {
	const denied = await requireAuth(event);
	if (denied) return denied;

	const { params } = event;
	const [prospect] = await db.select().from(prospects).where(eq(prospects.id, params.id));

	if (!prospect) {
		return json({ error: 'Prospect not found' }, { status: 404 });
	}

	// Human-in-the-loop gate: only approved prospects can be pushed
	if (prospect.status !== 'approved') {
		return json(
			{ error: `Prospect status is "${prospect.status}" — must be "approved" before push` },
			{ status: 400 }
		);
	}

	// Verify an approved draft exists
	const [draft] = await db
		.select()
		.from(draftEmails)
		.where(and(eq(draftEmails.prospectId, prospect.id), eq(draftEmails.approved, true)));

	if (!draft) {
		return json({ error: 'No approved draft found for this prospect' }, { status: 400 });
	}

	if (prospect.segment === 'unassigned') {
		return json({ error: 'Cannot push prospect with unassigned segment' }, { status: 400 });
	}

	const segment = prospect.segment as TalkTrackSegment;

	// Push to Klaviyo with draft content as custom profile properties
	const pushResult = await pushToKlaviyo(prospect, segment, {
		subject: draft.subject,
		body: draft.body,
		segment: draft.segment
	});

	if (pushResult.status === 'push-failed') {
		return json({ error: pushResult.error, status: 'push-failed' }, { status: 502 });
	}

	// Update status to pushed
	await db
		.update(prospects)
		.set({ status: 'pushed', updatedAt: new Date().toISOString() })
		.where(eq(prospects.id, prospect.id));

	// Poll for send confirmation (non-blocking timeout)
	const sendResult = await pollSendConfirmation(pushResult.profileId);

	if (sendResult.confirmed) {
		await db
			.update(prospects)
			.set({ status: 'send-confirmed', updatedAt: new Date().toISOString() })
			.where(eq(prospects.id, prospect.id));

		return json({
			status: 'send-confirmed',
			profileId: pushResult.profileId,
			listId: pushResult.listId
		});
	}

	// Timeout — pushed but send unconfirmed
	return json({
		status: 'pushed',
		message: 'Pushed, send unconfirmed — check Klaviyo',
		profileId: pushResult.profileId,
		listId: pushResult.listId
	});
};
