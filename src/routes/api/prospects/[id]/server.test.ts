import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chainable } from '$lib/server/test-helpers/db-chain.js';

const { selectMock, updateMock } = vi.hoisted(() => ({ selectMock: vi.fn(), updateMock: vi.fn() }));
vi.mock('$lib/server/db.js', () => ({ db: { select: selectMock, update: updateMock } }));

import { prospects } from '$lib/server/schema.js';
import { GET, PATCH } from './+server.js';

function makeEvent(options: {
	session?: unknown;
	id?: string;
	body?: unknown;
}): Parameters<typeof GET>[0] {
	const { session = { user: { email: 'jane@example.com' } }, id = 'prospect-1', body } = options;
	return {
		params: { id },
		locals: { auth: async () => session },
		request: { json: async () => body }
	} as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
	selectMock.mockReset();
	updateMock.mockReset();
});

describe('GET /api/prospects/[id]', () => {
	it('returns 401 when unauthenticated', async () => {
		const res = await GET(makeEvent({ session: null }));
		expect(res.status).toBe(401);
		expect(selectMock).not.toHaveBeenCalled();
	});

	it('returns 404 when the prospect does not exist', async () => {
		selectMock.mockReturnValue(chainable([]));
		const res = await GET(makeEvent({}));
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: 'Prospect not found' });
	});

	it('returns the prospect when found', async () => {
		const chain = chainable([{ id: 'prospect-1', firstName: 'Jane' }]);
		selectMock.mockReturnValue(chain);
		const res = await GET(makeEvent({}));
		expect(await res.json()).toEqual({ id: 'prospect-1', firstName: 'Jane' });
		expect(chain.from).toHaveBeenCalledWith(prospects);
	});
});

describe('PATCH /api/prospects/[id]', () => {
	it('returns 401 when unauthenticated', async () => {
		const res = await PATCH(makeEvent({ session: null, body: {} }));
		expect(res.status).toBe(401);
		expect(updateMock).not.toHaveBeenCalled();
	});

	it('returns 404 when the prospect does not exist', async () => {
		selectMock.mockReturnValue(chainable([]));
		updateMock.mockReturnValue(chainable([]));
		const res = await PATCH(makeEvent({ body: { status: 'approved' } }));
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: 'Prospect not found' });
	});

	it('only applies allowed fields and ignores unknown ones', async () => {
		selectMock.mockReturnValue(chainable([{ id: 'prospect-1', status: 'draft-ready' }]));
		const chain = chainable([{ id: 'prospect-1', status: 'approved' }]);
		updateMock.mockReturnValue(chain);

		const res = await PATCH(
			makeEvent({
				body: { status: 'approved', segment: 'board-prospects', firstName: 'Hacked' }
			})
		);

		expect(res.status).toBe(200);
		expect(updateMock).toHaveBeenCalledWith(prospects);
		expect(chain.set).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'approved', segment: 'board-prospects' })
		);
		expect(chain.set).toHaveBeenCalledWith(
			expect.not.objectContaining({ firstName: expect.anything() })
		);
	});

	it('does not require a status check when the body has no status field', async () => {
		const chain = chainable([{ id: 'prospect-1', segment: 'board-prospects' }]);
		updateMock.mockReturnValue(chain);

		const res = await PATCH(makeEvent({ body: { segment: 'board-prospects' } }));

		expect(res.status).toBe(200);
		expect(selectMock).not.toHaveBeenCalled();
	});

	it('rejects a status change with 409 when the prospect is flagged needs-review and not acknowledged', async () => {
		selectMock.mockReturnValue(chainable([{ id: 'prospect-1', status: 'needs-review' }]));

		const res = await PATCH(makeEvent({ body: { status: 'draft-ready' } }));

		expect(res.status).toBe(409);
		expect(await res.json()).toEqual(expect.objectContaining({ needsReviewAcknowledgement: true }));
		expect(updateMock).not.toHaveBeenCalled();
	});

	it('allows a status change away from needs-review when the review is explicitly acknowledged', async () => {
		selectMock.mockReturnValue(chainable([{ id: 'prospect-1', status: 'needs-review' }]));
		const chain = chainable([{ id: 'prospect-1', status: 'approved' }]);
		updateMock.mockReturnValue(chain);

		const res = await PATCH(makeEvent({ body: { status: 'approved', acknowledgeReview: true } }));

		expect(res.status).toBe(200);
		expect(updateMock).toHaveBeenCalledWith(prospects);
	});

	it('allows re-setting status to needs-review itself without acknowledgment', async () => {
		const chain = chainable([{ id: 'prospect-1', status: 'needs-review' }]);
		updateMock.mockReturnValue(chain);

		const res = await PATCH(makeEvent({ body: { status: 'needs-review' } }));

		expect(res.status).toBe(200);
		expect(selectMock).not.toHaveBeenCalled();
	});
});
