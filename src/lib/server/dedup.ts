import { env } from '$env/dynamic/private';
import type { DedupResult, TalkTrackSegment } from '$lib/types.js';

const KLAVIYO_BASE_URL = 'https://a.klaviyo.com/api';
const KLAVIYO_REVISION = '2024-10-15';

const NO_MATCH: DedupResult = {
	matched: false,
	matchSource: null,
	matchMethod: null,
	priorContactDate: null,
	priorTalkTrack: null
};

/** List ID → segment reverse mapping, built from env vars. */
function getListSegmentMap(): Record<string, TalkTrackSegment> {
	const map: Record<string, TalkTrackSegment> = {};
	const pairs: [string | undefined, TalkTrackSegment][] = [
		[env.KLAVIYO_LIST_COMMUNITY_DONORS, 'community-donors'],
		[env.KLAVIYO_LIST_NONPROFIT_MARKETING, 'nonprofit-marketing'],
		[env.KLAVIYO_LIST_BOARD_PROSPECTS, 'board-prospects'],
		[env.KLAVIYO_LIST_FINANCIAL_CRA, 'financial-cra'],
		[env.KLAVIYO_LIST_DAF_GIVING_CIRCLES, 'daf-giving-circles']
	];
	for (const [id, segment] of pairs) {
		if (id) map[id] = segment;
	}
	return map;
}

/**
 * Check if a prospect already exists in Klaviyo or Monday.com.
 * Matches on email (primary) or name+org (fallback when email is missing).
 */
export async function checkDedup(
	email: string | null,
	firstName: string,
	lastName: string,
	organization: string | null
): Promise<DedupResult> {
	const klaviyoMatch = await checkKlaviyo(email, firstName, lastName, organization);
	if (klaviyoMatch.matched) return klaviyoMatch;

	const mondayMatch = await checkMonday(email, firstName, lastName, organization);
	if (mondayMatch.matched) return mondayMatch;

	return NO_MATCH;
}

function getKlaviyoHeaders() {
	const apiKey = env.KLAVIYO_API_KEY;
	if (!apiKey) return null;
	return {
		Authorization: `Klaviyo-API-Key ${apiKey}`,
		'Content-Type': 'application/json',
		revision: KLAVIYO_REVISION
	};
}

async function checkKlaviyo(
	email: string | null,
	firstName: string,
	lastName: string,
	organization: string | null
): Promise<DedupResult> {
	const headers = getKlaviyoHeaders();
	if (!headers) return NO_MATCH;

	// Primary match: email
	if (email) {
		const filter = encodeURIComponent(`equals(email,"${email}")`);
		const res = await fetch(`${KLAVIYO_BASE_URL}/profiles?filter=${filter}`, { headers });

		if (res.ok) {
			const data = await res.json();
			if (data.data && data.data.length > 0) {
				const profile = data.data[0];
				const listInfo = await getProfileListInfo(profile.id, headers);
				return {
					matched: true,
					matchSource: 'klaviyo',
					matchMethod: 'email',
					priorContactDate: profile.attributes.created ?? null,
					priorTalkTrack: listInfo
				};
			}
		}
	}

	// Fallback match: name + org (when email is missing)
	if (!email && organization) {
		const filter = encodeURIComponent(
			`and(equals(first_name,"${firstName}"),equals(last_name,"${lastName}"),equals(organization,"${organization}"))`
		);
		const res = await fetch(`${KLAVIYO_BASE_URL}/profiles?filter=${filter}`, { headers });

		if (res.ok) {
			const data = await res.json();
			if (data.data && data.data.length > 0) {
				const profile = data.data[0];
				const listInfo = await getProfileListInfo(profile.id, headers);
				return {
					matched: true,
					matchSource: 'klaviyo',
					matchMethod: 'name-org',
					priorContactDate: profile.attributes.created ?? null,
					priorTalkTrack: listInfo
				};
			}
		}
	}

	return NO_MATCH;
}

/** Check which talk-track list a profile belongs to, if any. */
async function getProfileListInfo(
	profileId: string,
	headers: Record<string, string>
): Promise<TalkTrackSegment | null> {
	const res = await fetch(`${KLAVIYO_BASE_URL}/profiles/${profileId}/lists`, { headers });

	if (!res.ok) return null;

	const data = await res.json();
	if (!data.data || data.data.length === 0) return null;

	const listSegmentMap = getListSegmentMap();
	for (const list of data.data) {
		const segment = listSegmentMap[list.id];
		if (segment) return segment;
	}

	return null;
}

async function checkMonday(
	_email: string | null,
	_firstName: string,
	_lastName: string,
	_organization: string | null
): Promise<DedupResult> {
	// TODO: Wire up when Monday.com API token is available
	return NO_MATCH;
}
