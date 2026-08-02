import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chainable } from '$lib/server/test-helpers/db-chain.js';

const { selectMock, updateMock } = vi.hoisted(() => ({ selectMock: vi.fn(), updateMock: vi.fn() }));
vi.mock('$lib/server/db.js', () => ({ db: { select: selectMock, update: updateMock } }));

import { draftEmails, prospects } from '$lib/server/schema.js';
import { GET, PATCH } from './+server.js';

function makeEvent(options: {
	session?: unknown;
	id?: string;
	body?: unknown;
}): Parameters<typeof GET>[0] {
	const { session = { user: { email: 'jane@example.com' } }, id = 'draft-1', body } = options;
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

describe('GET /api/drafts/[id]', () => {
	it('returns 401 when unauthenticated', async () => {
		const res = await GET(makeEvent({ session: null }));
		expect(res.status).toBe(401);
		expect(selectMock).not.toHaveBeenCalled();
	});

	it('returns 404 when the draft does not exist', async () => {
		selectMock.mockReturnValue(chainable([]));
		const res = await GET(makeEvent({}));
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: 'Draft not found' });
	});

	it('returns the draft when found', async () => {
		const chain = chainable([{ id: 'draft-1', subject: 'Hi' }]);
		selectMock.mockReturnValue(chain);
		const res = await GET(makeEvent({}));
		expect(await res.json()).toEqual({ id: 'draft-1', subject: 'Hi' });
		expect(chain.from).toHaveBeenCalledWith(draftEmails);
	});
});

describe('PATCH /api/drafts/[id]', () => {
	it('returns 401 when unauthenticated', async () => {
		const res = await PATCH(makeEvent({ session: null, body: {} }));
		expect(res.status).toBe(401);
		expect(updateMock).not.toHaveBeenCalled();
	});

	it('returns 404 when the draft does not exist', async () => {
		updateMock.mockReturnValue(chainable([]));
		const res = await PATCH(makeEvent({ body: { subject: 'New' } }));
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: 'Draft not found' });
	});

	it('only applies allowed fields and ignores unknown ones', async () => {
		const draftChain = chainable([{ id: 'draft-1', prospectId: 'prospect-1', subject: 'New' }]);
		updateMock.mockReturnValueOnce(draftChain);

		const res = await PATCH(
			makeEvent({ body: { subject: 'New', notAllowed: 'x', approved: false } })
		);

		expect(res.status).toBe(200);
		expect(updateMock).toHaveBeenCalledWith(draftEmails);
		expect(draftChain.set).toHaveBeenCalledWith(
			expect.objectContaining({ subject: 'New', approved: false })
		);
		expect(draftChain.set).toHaveBeenCalledWith(
			expect.not.objectContaining({ notAllowed: expect.anything() })
		);
		// approved is not true, so no cascading update to prospects
		expect(updateMock).toHaveBeenCalledTimes(1);
	});

	it('cascades an approval to the prospect when approved is set to true', async () => {
		const draftChain = chainable([{ id: 'draft-1', prospectId: 'prospect-1', approved: true }]);
		const prospectChain = chainable(undefined);
		updateMock.mockReturnValueOnce(draftChain).mockReturnValueOnce(prospectChain);

		const res = await PATCH(makeEvent({ body: { approved: true } }));

		expect(res.status).toBe(200);
		expect(updateMock).toHaveBeenCalledTimes(2);
		expect(updateMock).toHaveBeenNthCalledWith(2, prospects);
		expect(prospectChain.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }));
	});
});
