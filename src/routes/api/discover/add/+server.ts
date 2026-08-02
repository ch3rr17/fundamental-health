import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db.js';
import { prospects } from '$lib/server/schema.js';
import { createLabel, addContactToApollo } from '$lib/server/apollo.js';
import { assignSegment } from '$lib/server/segment.js';
import { checkDedup } from '$lib/server/dedup.js';
import { requireAuth } from '$lib/server/auth-guard.js';

/**
 * POST /api/discover/add
 * Add a discovered prospect to both Apollo and Supabase.
 * Creates an Apollo label named `prospect-{timestamp}` (or reuses one from the same session).
 */
export const POST: RequestHandler = async (event) => {
	const denied = await requireAuth(event);
	if (denied) return denied;

	const body = await event.request.json();
	const { firstName, lastName, email, title, organization, linkedinUrl, location, segment, apolloLabelId, apolloLabelName } = body;

	if (!firstName || !lastName) {
		return json({ error: 'firstName and lastName are required' }, { status: 400 });
	}

	// Create or reuse an Apollo label
	let labelId = apolloLabelId;
	let labelName: string | null = apolloLabelName || null;
	if (!labelId) {
		const now = new Date();
		const mm = String(now.getMonth() + 1).padStart(2, '0');
		const dd = String(now.getDate()).padStart(2, '0');
		const yyyy = now.getFullYear();
		const hh = String(now.getHours()).padStart(2, '0');
		const min = String(now.getMinutes()).padStart(2, '0');
		labelName = `prospect-${mm}-${dd}-${yyyy} ${hh}:${min}`;
		labelId = await createLabel(labelName);
	}

	// Add contact to Apollo
	await addContactToApollo(
		{ firstName, lastName, email: email || null, title: title || null, organization: organization || null, linkedinUrl: linkedinUrl || null, location: location || null },
		labelId
	);

	// Dedup check
	const dedup = await checkDedup(email || null, firstName, lastName, organization || null);

	// Segment assignment
	let assignedSegment = segment || 'unassigned';
	let segmentConfidence: number | null = null;

	if (!dedup.matched && !segment) {
		const segResult = assignSegment({
			title: title || null,
			organization: organization || null,
			location: location || null
		});
		assignedSegment = segResult.segment;
		segmentConfidence = segResult.confidence;
	}

	const status = dedup.matched ? 'already-contacted' : 'imported';

	// Insert into Supabase
	const [inserted] = await db.insert(prospects).values({
		firstName,
		lastName,
		email: email || null,
		organization: organization || null,
		title: title || null,
		linkedinUrl: linkedinUrl || null,
		location: location || null,
		source: 'apollo',
		sourceListId: labelId,
		sourceListName: labelName,
		segment: assignedSegment,
		segmentConfidence,
		status,
		priorContactDate: dedup.priorContactDate ?? null,
		priorTalkTrack: dedup.priorTalkTrack ?? null
	}).returning();

	return json({ id: inserted.id, status, apolloLabelId: labelId, apolloLabelName: labelName }, { status: 201 });
};
