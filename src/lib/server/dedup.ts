import type { DedupResult } from '$lib/types.js';

/**
 * Check if a prospect already exists in Klaviyo or Monday.com.
 *
 * Matches on email (primary) or name+org (fallback when email is missing).
 * Currently stubbed — returns no match. Wire up Klaviyo and Monday.com
 * API calls once credentials are available.
 */
export async function checkDedup(
	email: string | null,
	firstName: string,
	lastName: string,
	organization: string | null
): Promise<DedupResult> {
	// TODO: Check Klaviyo profiles via GET /api/profiles?filter=equals(email,"...")
	// TODO: Check Monday.com board items via GraphQL query

	const klaviyoMatch = await checkKlaviyo(email, firstName, lastName, organization);
	if (klaviyoMatch.matched) return klaviyoMatch;

	const mondayMatch = await checkMonday(email, firstName, lastName, organization);
	if (mondayMatch.matched) return mondayMatch;

	return { matched: false, matchSource: null, matchMethod: null, priorContactDate: null, priorTalkTrack: null };
}

async function checkKlaviyo(
	_email: string | null,
	_firstName: string,
	_lastName: string,
	_organization: string | null
): Promise<DedupResult> {
	// Stub: will call Klaviyo API once credentials exist
	return { matched: false, matchSource: null, matchMethod: null, priorContactDate: null, priorTalkTrack: null };
}

async function checkMonday(
	_email: string | null,
	_firstName: string,
	_lastName: string,
	_organization: string | null
): Promise<DedupResult> {
	// Stub: will call Monday.com GraphQL API once credentials exist
	return { matched: false, matchSource: null, matchMethod: null, priorContactDate: null, priorTalkTrack: null };
}
