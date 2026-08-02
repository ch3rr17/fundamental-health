import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockEnv, setMockEnv } from './test-helpers/mock-env.js';
import { checkDedup } from './dedup.js';

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

// dedup.ts reads env lazily inside its functions, so a single static import is
// enough — each test just sets the env it needs before calling checkDedup.
describe('checkDedup', () => {
	beforeEach(() => setMockEnv());

	it('returns no match when KLAVIYO_API_KEY is not configured', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		const result = await checkDedup('jane@example.com', 'Jane', 'Doe', 'Acme');

		expect(result.matched).toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('matches on email and resolves the prior talk-track from list membership', async () => {
		setMockEnv({ KLAVIYO_API_KEY: 'test-key', KLAVIYO_LIST_BOARD_PROSPECTS: 'list-board-123' });

		const fetchMock = vi.fn(async (url: string) => {
			if (url.includes('/profiles?')) {
				return new Response(
					JSON.stringify({
						data: [{ id: 'profile-1', attributes: { created: '2025-01-01T00:00:00Z' } }]
					}),
					{ status: 200 }
				);
			}
			if (url.includes('/profiles/profile-1/lists')) {
				return new Response(JSON.stringify({ data: [{ id: 'list-board-123' }] }), { status: 200 });
			}
			throw new Error(`Unexpected fetch to ${url}`);
		});
		vi.stubGlobal('fetch', fetchMock);

		const result = await checkDedup('jane@example.com', 'Jane', 'Doe', 'Acme');

		expect(result).toEqual({
			matched: true,
			matchSource: 'klaviyo',
			matchMethod: 'email',
			priorContactDate: '2025-01-01T00:00:00Z',
			priorTalkTrack: 'board-prospects'
		});
	});

	it('skips list memberships with no configured segment and returns the first one that matches', async () => {
		setMockEnv({ KLAVIYO_API_KEY: 'test-key', KLAVIYO_LIST_BOARD_PROSPECTS: 'list-board-123' });

		const fetchMock = vi.fn(async (url: string) => {
			if (url.includes('/profiles?')) {
				return new Response(
					JSON.stringify({ data: [{ id: 'profile-1', attributes: { created: null } }] }),
					{ status: 200 }
				);
			}
			if (url.includes('/profiles/profile-1/lists')) {
				// The profile belongs to an unmapped list first, then the mapped one —
				// getProfileListInfo should skip the unmapped list rather than stop at it.
				return new Response(
					JSON.stringify({ data: [{ id: 'list-unmapped' }, { id: 'list-board-123' }] }),
					{ status: 200 }
				);
			}
			throw new Error(`Unexpected fetch to ${url}`);
		});
		vi.stubGlobal('fetch', fetchMock);

		const result = await checkDedup('jane@example.com', 'Jane', 'Doe', 'Acme');

		expect(result.priorTalkTrack).toBe('board-prospects');
	});

	it('falls back to name+org match when email is missing', async () => {
		setMockEnv({ KLAVIYO_API_KEY: 'test-key' });

		const fetchMock = vi.fn(async (url: string) => {
			if (url.includes('/profiles?')) {
				return new Response(
					JSON.stringify({ data: [{ id: 'profile-2', attributes: { created: null } }] }),
					{ status: 200 }
				);
			}
			if (url.includes('/lists')) {
				return new Response(JSON.stringify({ data: [] }), { status: 200 });
			}
			throw new Error(`Unexpected fetch to ${url}`);
		});
		vi.stubGlobal('fetch', fetchMock);

		const result = await checkDedup(null, 'Jane', 'Doe', 'Acme');

		expect(result.matched).toBe(true);
		expect(result.matchMethod).toBe('name-org');
		expect(result.priorTalkTrack).toBeNull();
	});

	it('does not attempt name+org fallback when organization is missing', async () => {
		setMockEnv({ KLAVIYO_API_KEY: 'test-key' });
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		const result = await checkDedup(null, 'Jane', 'Doe', null);

		expect(result.matched).toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('returns no match when Klaviyo has no matching profile', async () => {
		setMockEnv({ KLAVIYO_API_KEY: 'test-key' });
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }))
		);

		const result = await checkDedup('jane@example.com', 'Jane', 'Doe', 'Acme');

		expect(result.matched).toBe(false);
	});

	it('returns no match when the Klaviyo request fails', async () => {
		setMockEnv({ KLAVIYO_API_KEY: 'test-key' });
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('server error', { status: 500 }))
		);

		const result = await checkDedup('jane@example.com', 'Jane', 'Doe', 'Acme');

		expect(result.matched).toBe(false);
	});
});
