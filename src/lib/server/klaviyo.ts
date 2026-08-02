import { env } from '$env/dynamic/private';
import type { TalkTrackSegment } from '$lib/types.js';

const BASE_URL = 'https://a.klaviyo.com/api';
const API_REVISION = '2024-10-15';

function getHeaders() {
	const apiKey = env.KLAVIYO_API_KEY;
	if (!apiKey) {
		throw new Error('KLAVIYO_API_KEY environment variable is required');
	}
	return {
		Authorization: `Klaviyo-API-Key ${apiKey}`,
		'Content-Type': 'application/json',
		revision: API_REVISION
	};
}

/**
 * Talk-track segment → Klaviyo list ID mapping.
 * These list IDs must be created in Klaviyo and set here before push works.
 * Each list should have a flow trigger configured for its talk-track sequence.
 */
const SEGMENT_LIST_IDS: Record<TalkTrackSegment, string> = {
	'community-donors': env.KLAVIYO_LIST_COMMUNITY_DONORS ?? '',
	'nonprofit-marketing': env.KLAVIYO_LIST_NONPROFIT_MARKETING ?? '',
	'board-prospects': env.KLAVIYO_LIST_BOARD_PROSPECTS ?? '',
	'financial-cra': env.KLAVIYO_LIST_FINANCIAL_CRA ?? '',
	'daf-giving-circles': env.KLAVIYO_LIST_DAF_GIVING_CIRCLES ?? ''
};

interface PushResult {
	profileId: string;
	listId: string;
	status: 'pushed' | 'push-failed';
	error?: string;
}

/** Create or update a Klaviyo profile. Returns the profile ID. */
async function upsertProfile(
	prospect: {
		email: string | null;
		firstName: string;
		lastName: string;
		organization: string | null;
		title: string | null;
		location: string | null;
	},
	draft?: {
		subject: string;
		body: string;
		segment: string;
	}
): Promise<string> {
	if (!prospect.email) {
		throw new Error('Cannot push to Klaviyo without an email address');
	}

	const attributes: Record<string, unknown> = {
		email: prospect.email,
		first_name: prospect.firstName,
		last_name: prospect.lastName
	};
	if (prospect.organization) attributes.organization = prospect.organization;
	if (prospect.title) attributes.title = prospect.title;
	if (prospect.location) attributes.location = { city: prospect.location };

	if (draft) {
		attributes.properties = {
			draft_subject: draft.subject,
			draft_body: draft.body,
			talk_track_segment: draft.segment
		};
	}

	const res = await fetch(`${BASE_URL}/profiles`, {
		method: 'POST',
		headers: getHeaders(),
		body: JSON.stringify({
			data: {
				type: 'profile',
				attributes
			}
		})
	});

	if (res.status === 201) {
		const data = await res.json();
		return data.data.id;
	}

	// 409 = profile already exists, use the returned profile ID
	if (res.status === 409) {
		const data = await res.json();
		const existingId = data.errors?.[0]?.meta?.duplicate_profile_id;
		if (existingId) return existingId;
	}

	const errorBody = await res.text();
	throw new Error(`Klaviyo profile upsert failed (${res.status}): ${errorBody}`);
}

/** Add a profile to a talk-track-specific Klaviyo list. */
async function addToList(profileId: string, listId: string): Promise<void> {
	const res = await fetch(`${BASE_URL}/lists/${listId}/relationships/profiles`, {
		method: 'POST',
		headers: getHeaders(),
		body: JSON.stringify({
			data: [{ type: 'profile', id: profileId }]
		})
	});

	if (res.status !== 204) {
		const errorBody = await res.text();
		throw new Error(`Klaviyo add-to-list failed (${res.status}): ${errorBody}`);
	}
}

/** Push a prospect to Klaviyo: create/update profile with draft content + add to segment list. */
export async function pushToKlaviyo(
	prospect: {
		email: string | null;
		firstName: string;
		lastName: string;
		organization: string | null;
		title: string | null;
		location: string | null;
	},
	segment: TalkTrackSegment,
	draft?: {
		subject: string;
		body: string;
		segment: string;
	}
): Promise<PushResult> {
	const listId = SEGMENT_LIST_IDS[segment];
	if (!listId) {
		return {
			profileId: '',
			listId: '',
			status: 'push-failed',
			error: `No Klaviyo list ID configured for segment "${segment}". Set KLAVIYO_LIST_* env vars.`
		};
	}

	try {
		const profileId = await upsertProfile(prospect, draft);
		await addToList(profileId, listId);
		return { profileId, listId, status: 'pushed' };
	} catch (e) {
		return {
			profileId: '',
			listId,
			status: 'push-failed',
			error: e instanceof Error ? e.message : 'Unknown error'
		};
	}
}

/**
 * Poll Klaviyo Events API for send confirmation.
 * Checks for a "sent" or "received" event for the given profile.
 * Returns after confirmation or timeout.
 */
export async function pollSendConfirmation(
	profileId: string,
	timeoutMs: number = 30000,
	intervalMs: number = 5000
): Promise<{ confirmed: boolean }> {
	const metricId = env.KLAVIYO_SENT_METRIC_ID;
	if (!metricId) {
		return { confirmed: false };
	}

	const start = Date.now();

	while (Date.now() - start < timeoutMs) {
		const filterParam = encodeURIComponent(
			`equals(profile_id,"${profileId}"),equals(metric_id,"${metricId}")`
		);
		const res = await fetch(`${BASE_URL}/events?filter=${filterParam}`, {
			headers: getHeaders()
		});

		if (res.ok) {
			const data = await res.json();
			if (data.data && data.data.length > 0) {
				return { confirmed: true };
			}
		}

		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}

	return { confirmed: false };
}
