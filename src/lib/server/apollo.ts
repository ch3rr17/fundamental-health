import { env } from '$env/dynamic/private';
import { db } from './db.js';
import { prospects } from './schema.js';
import { assignSegment } from './segment.js';
import { checkDedup } from './dedup.js';
import type { SegmentAssignment } from '$lib/types.js';

const BASE_URL = 'https://api.apollo.io/api/v1';

function getApiKey() {
	const key = env.APOLLO_KEY;
	if (!key) {
		throw new Error('APOLLO_KEY environment variable is required');
	}
	return key;
}

interface ApolloContact {
	first_name: string;
	last_name: string;
	email: string | null;
	title: string | null;
	organization_name: string | null;
	linkedin_url: string | null;
	city: string | null;
	state: string | null;
}

/** Fetch all contacts from an Apollo list (label) by ID, handling pagination. */
async function fetchListContacts(labelId: string): Promise<ApolloContact[]> {
	const apiKey = getApiKey();
	const allContacts: ApolloContact[] = [];
	let page = 1;

	while (true) {
		const res = await fetch(`${BASE_URL}/contacts/search`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Api-Key': apiKey
			},
			body: JSON.stringify({
				label_ids: [labelId],
				per_page: 100,
				page
			})
		});

		if (!res.ok) {
			const errorBody = await res.text();
			throw new Error(`Apollo API error (${res.status}): ${errorBody}`);
		}

		const data = await res.json();
		const contacts = data.contacts ?? [];
		allContacts.push(...contacts);

		if (contacts.length < 100 || page >= (data.pagination?.total_pages ?? 1)) {
			break;
		}
		page++;
	}

	return allContacts;
}

/** Fetch available Apollo lists (labels). */
export async function fetchLists() {
	const apiKey = getApiKey();

	const res = await fetch(`${BASE_URL}/labels`, {
		headers: {
			'Content-Type': 'application/json',
			'X-Api-Key': apiKey
		}
	});

	if (!res.ok) {
		const errorBody = await res.text();
		throw new Error(`Apollo API error (${res.status}): ${errorBody}`);
	}

	const data = await res.json();
	return (data.labels ?? data).map((l: { id: string; name: string; cached_count: number }) => ({
		id: l.id,
		name: l.name,
		count: l.cached_count
	}));
}

/** Pull contacts from an Apollo list and import them into the database. */
export async function importFromApollo(labelId: string) {
	const contacts = await fetchListContacts(labelId);
	const results = { imported: 0, alreadyContacted: 0, total: contacts.length };

	for (const contact of contacts) {
		if (!contact.first_name || !contact.last_name) continue;

		const location = [contact.city, contact.state].filter(Boolean).join(', ') || null;

		const dedup = await checkDedup(
			contact.email ?? null,
			contact.first_name,
			contact.last_name,
			contact.organization_name ?? null
		);

		let segment: SegmentAssignment = 'unassigned';
		let segmentConfidence: number | null = null;

		if (!dedup.matched) {
			const segResult = assignSegment({
				title: contact.title ?? null,
				organization: contact.organization_name ?? null,
				location
			});
			segment = segResult.segment;
			segmentConfidence = segResult.confidence;
		}

		const status = dedup.matched ? 'already-contacted' : 'imported';

		await db.insert(prospects).values({
			firstName: contact.first_name,
			lastName: contact.last_name,
			email: contact.email || null,
			organization: contact.organization_name || null,
			title: contact.title || null,
			linkedinUrl: contact.linkedin_url || null,
			location,
			source: 'apollo',
			segment,
			segmentConfidence,
			status,
			priorContactDate: dedup.priorContactDate ?? null,
			priorTalkTrack: dedup.priorTalkTrack ?? null
		});

		if (dedup.matched) {
			results.alreadyContacted++;
		} else {
			results.imported++;
		}
	}

	return results;
}
