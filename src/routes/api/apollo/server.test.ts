import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchListsMock } = vi.hoisted(() => ({ fetchListsMock: vi.fn() }));
vi.mock('$lib/server/apollo.js', () => ({ fetchLists: fetchListsMock }));

import { GET } from './+server.js';

function makeEvent(
	session: unknown = { user: { email: 'jane@example.com' } }
): Parameters<typeof GET>[0] {
	return { locals: { auth: async () => session } } as unknown as Parameters<typeof GET>[0];
}

// Deliberately not using mockReset()/mockClear() here: with Vitest 4.1.10,
// calling either before a test that sets an async-throwing mockImplementation
// (consumed by the route's own try/catch) causes a false "unhandled rejection"
// failure. Mutating .mock.calls directly clears call history without
// triggering that bug.
beforeEach(() => {
	fetchListsMock.mock.calls.length = 0;
});

describe('GET /api/apollo', () => {
	it('returns 401 when unauthenticated', async () => {
		const res = await GET(makeEvent(null));
		expect(res.status).toBe(401);
		expect(fetchListsMock).not.toHaveBeenCalled();
	});

	it('returns the Apollo lists on success', async () => {
		fetchListsMock.mockResolvedValue([{ id: 'l1', name: 'Board', count: 5 }]);

		const res = await GET(makeEvent());

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual([{ id: 'l1', name: 'Board', count: 5 }]);
	});

	it('returns 502 with the error message when fetchLists fails', async () => {
		fetchListsMock.mockImplementation(async () => {
			throw new Error('Apollo API error (403): forbidden');
		});

		const res = await GET(makeEvent());

		expect(res.status).toBe(502);
		expect(await res.json()).toEqual({ error: 'Apollo API error (403): forbidden' });
	});
});
