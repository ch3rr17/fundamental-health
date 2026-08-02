import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chainable } from '$lib/server/test-helpers/db-chain.js';

const { selectMock } = vi.hoisted(() => ({ selectMock: vi.fn() }));
vi.mock('$lib/server/db.js', () => ({ db: { select: selectMock } }));

import { prospects } from '$lib/server/schema.js';
import { GET } from './+server.js';

function makeEvent(options: {
	session?: unknown;
	searchParams?: Record<string, string>;
}): Parameters<typeof GET>[0] {
	const { session = { user: { email: 'jane@example.com' } }, searchParams = {} } = options;
	return {
		locals: { auth: async () => session },
		url: { searchParams: new URLSearchParams(searchParams) }
	} as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => selectMock.mockReset());

describe('GET /api/prospects', () => {
	it('returns 401 when unauthenticated', async () => {
		const res = await GET(makeEvent({ session: null }));
		expect(res.status).toBe(401);
		expect(selectMock).not.toHaveBeenCalled();
	});

	it('returns all prospects when no status filter is given', async () => {
		const chain = chainable([{ id: 'p1' }, { id: 'p2' }]);
		selectMock.mockReturnValue(chain);

		const res = await GET(makeEvent({}));

		expect(await res.json()).toEqual([{ id: 'p1' }, { id: 'p2' }]);
		expect(chain.from).toHaveBeenCalledWith(prospects);
		expect(chain.where).not.toHaveBeenCalled();
	});

	it('filters by status when the query param is present', async () => {
		const chain = chainable([{ id: 'p1', status: 'approved' }]);
		selectMock.mockReturnValue(chain);

		const res = await GET(makeEvent({ searchParams: { status: 'approved' } }));

		expect(await res.json()).toEqual([{ id: 'p1', status: 'approved' }]);
		expect(chain.where).toHaveBeenCalledTimes(1);
	});
});
