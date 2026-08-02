import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chainable } from '$lib/server/test-helpers/db-chain.js';

const { selectMock } = vi.hoisted(() => ({ selectMock: vi.fn() }));
vi.mock('$lib/server/db.js', () => ({ db: { select: selectMock } }));

import { GET } from './+server.js';

function makeEvent(
	session: unknown = { user: { email: 'jane@example.com' } }
): Parameters<typeof GET>[0] {
	return { locals: { auth: async () => session } } as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => selectMock.mockReset());

describe('GET /api/review-queue', () => {
	it('returns 401 when unauthenticated', async () => {
		const res = await GET(makeEvent(null));
		expect(res.status).toBe(401);
		expect(selectMock).not.toHaveBeenCalled();
	});

	it('returns the joined draft+prospect rows for unapproved drafts', async () => {
		const rows = [{ draft: { id: 'draft-1', approved: false }, prospect: { id: 'prospect-1' } }];
		selectMock.mockReturnValue(chainable(rows));

		const res = await GET(makeEvent());

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(rows);
	});
});
