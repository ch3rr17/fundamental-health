import { describe, expect, it, vi } from 'vitest';
import { mockEnv, setMockEnv } from './test-helpers/mock-env.js';

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

// klaviyo.ts computes its list-id map at module load time from env, so each
// test needs a fresh module instance with env set beforehand.
async function loadKlaviyo(env: Record<string, string | undefined>) {
	setMockEnv(env);
	vi.resetModules();
	return import('./klaviyo.js');
}

/** Api key plus a list id for the community-donors segment — the happy-path setup. */
const CONFIGURED_ENV = { KLAVIYO_API_KEY: 'key', KLAVIYO_LIST_COMMUNITY_DONORS: 'list-123' };

const prospect = {
	email: 'jane@example.com',
	firstName: 'Jane',
	lastName: 'Doe',
	organization: 'Acme',
	title: 'Director',
	location: 'San Diego'
};

describe('pushToKlaviyo', () => {
	it('fails fast when no list id is configured for the segment', async () => {
		const { pushToKlaviyo } = await loadKlaviyo({ KLAVIYO_API_KEY: 'key' });
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		const result = await pushToKlaviyo(prospect, 'community-donors');

		expect(result.status).toBe('push-failed');
		expect(result.error).toMatch(/No Klaviyo list ID configured/);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('creates a new profile and adds it to the segment list', async () => {
		const { pushToKlaviyo } = await loadKlaviyo(CONFIGURED_ENV);

		const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
			if (url.includes('/lists/list-123/relationships/profiles')) {
				return new Response(null, { status: 204 });
			}
			if (url.endsWith('/profiles') && init.method === 'POST') {
				return new Response(JSON.stringify({ data: { id: 'profile-new' } }), { status: 201 });
			}
			throw new Error(`Unexpected fetch to ${url}`);
		});
		vi.stubGlobal('fetch', fetchMock);

		const result = await pushToKlaviyo(prospect, 'community-donors');

		expect(result).toEqual({ profileId: 'profile-new', listId: 'list-123', status: 'pushed' });
	});

	it('reuses the existing profile id on a 409 duplicate response', async () => {
		const { pushToKlaviyo } = await loadKlaviyo(CONFIGURED_ENV);

		const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
			if (url.includes('/lists/list-123/relationships/profiles')) {
				return new Response(null, { status: 204 });
			}
			if (url.endsWith('/profiles') && init.method === 'POST') {
				return new Response(
					JSON.stringify({ errors: [{ meta: { duplicate_profile_id: 'profile-existing' } }] }),
					{ status: 409 }
				);
			}
			throw new Error(`Unexpected fetch to ${url}`);
		});
		vi.stubGlobal('fetch', fetchMock);

		const result = await pushToKlaviyo(prospect, 'community-donors');

		expect(result).toEqual({ profileId: 'profile-existing', listId: 'list-123', status: 'pushed' });
	});

	it('fails when the prospect has no email', async () => {
		const { pushToKlaviyo } = await loadKlaviyo(CONFIGURED_ENV);
		vi.stubGlobal('fetch', vi.fn());

		const result = await pushToKlaviyo({ ...prospect, email: null }, 'community-donors');

		expect(result.status).toBe('push-failed');
		expect(result.error).toMatch(/without an email address/);
	});

	it('fails when KLAVIYO_API_KEY is not configured', async () => {
		const { pushToKlaviyo } = await loadKlaviyo({ KLAVIYO_LIST_COMMUNITY_DONORS: 'list-123' });
		vi.stubGlobal('fetch', vi.fn());

		const result = await pushToKlaviyo(prospect, 'community-donors');

		expect(result.status).toBe('push-failed');
		expect(result.error).toMatch(/KLAVIYO_API_KEY/);
	});

	it('fails with the upstream error when a 409 duplicate response has no duplicate_profile_id', async () => {
		const { pushToKlaviyo } = await loadKlaviyo(CONFIGURED_ENV);

		const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
			if (url.endsWith('/profiles') && init.method === 'POST') {
				return new Response(JSON.stringify({ errors: [{ detail: 'conflict' }] }), { status: 409 });
			}
			throw new Error(`Unexpected fetch to ${url}`);
		});
		vi.stubGlobal('fetch', fetchMock);

		const result = await pushToKlaviyo(prospect, 'community-donors');

		expect(result.status).toBe('push-failed');
		expect(result.error).toMatch(/Klaviyo profile upsert failed \(409\)/);
	});

	it('fails with the upstream error on a non-201/409 profile creation response', async () => {
		const { pushToKlaviyo } = await loadKlaviyo(CONFIGURED_ENV);

		const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
			if (url.endsWith('/profiles') && init.method === 'POST') {
				return new Response('internal error', { status: 500 });
			}
			throw new Error(`Unexpected fetch to ${url}`);
		});
		vi.stubGlobal('fetch', fetchMock);

		const result = await pushToKlaviyo(prospect, 'community-donors');

		expect(result.status).toBe('push-failed');
		expect(result.error).toMatch(/Klaviyo profile upsert failed \(500\): internal error/);
	});

	it('fails when adding to the list is rejected', async () => {
		const { pushToKlaviyo } = await loadKlaviyo(CONFIGURED_ENV);

		const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
			if (url.includes('/lists/list-123/relationships/profiles')) {
				return new Response('forbidden', { status: 403 });
			}
			if (url.endsWith('/profiles') && init.method === 'POST') {
				return new Response(JSON.stringify({ data: { id: 'profile-new' } }), { status: 201 });
			}
			throw new Error(`Unexpected fetch to ${url}`);
		});
		vi.stubGlobal('fetch', fetchMock);

		const result = await pushToKlaviyo(prospect, 'community-donors');

		expect(result.status).toBe('push-failed');
		expect(result.error).toMatch(/add-to-list failed \(403\)/);
	});
});

describe('pollSendConfirmation', () => {
	it('returns unconfirmed immediately when no sent-metric id is configured', async () => {
		const { pollSendConfirmation } = await loadKlaviyo({ KLAVIYO_API_KEY: 'key' });
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		const result = await pollSendConfirmation('profile-1');

		expect(result).toEqual({ confirmed: false });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('confirms as soon as a matching event is found', async () => {
		const { pollSendConfirmation } = await loadKlaviyo({
			KLAVIYO_API_KEY: 'key',
			KLAVIYO_SENT_METRIC_ID: 'metric-1'
		});
		const fetchMock = vi.fn(
			async () => new Response(JSON.stringify({ data: [{ id: 'evt-1' }] }), { status: 200 })
		);
		vi.stubGlobal('fetch', fetchMock);

		const result = await pollSendConfirmation('profile-1', 5000, 1000);

		expect(result).toEqual({ confirmed: true });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('gives up and returns unconfirmed after the timeout elapses', async () => {
		vi.useFakeTimers();
		try {
			const { pollSendConfirmation } = await loadKlaviyo({
				KLAVIYO_API_KEY: 'key',
				KLAVIYO_SENT_METRIC_ID: 'metric-1'
			});
			vi.stubGlobal(
				'fetch',
				vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }))
			);

			const resultPromise = pollSendConfirmation('profile-1', 20, 5);
			await vi.advanceTimersByTimeAsync(25);

			expect(await resultPromise).toEqual({ confirmed: false });
		} finally {
			vi.useRealTimers();
		}
	});
});
