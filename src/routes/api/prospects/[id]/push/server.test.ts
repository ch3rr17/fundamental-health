import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chainable } from '$lib/server/test-helpers/db-chain.js';

const { selectMock, updateMock, pushToKlaviyoMock, pollSendConfirmationMock } = vi.hoisted(() => ({
	selectMock: vi.fn(),
	updateMock: vi.fn(),
	pushToKlaviyoMock: vi.fn(),
	pollSendConfirmationMock: vi.fn()
}));

vi.mock('$lib/server/db.js', () => ({ db: { select: selectMock, update: updateMock } }));
vi.mock('$lib/server/klaviyo.js', () => ({
	pushToKlaviyo: pushToKlaviyoMock,
	pollSendConfirmation: pollSendConfirmationMock
}));

import { prospects, draftEmails } from '$lib/server/schema.js';
import { POST } from './+server.js';

const APPROVED_PROSPECT = {
	id: 'prospect-1',
	status: 'approved',
	segment: 'board-prospects',
	email: 'jane@example.com',
	firstName: 'Jane',
	lastName: 'Doe'
};
const APPROVED_DRAFT = { id: 'draft-1', prospectId: 'prospect-1', approved: true };

function makeEvent(
	session: unknown = { user: { email: 'jane@example.com' } }
): Parameters<typeof POST>[0] {
	return {
		params: { id: 'prospect-1' },
		locals: { auth: async () => session }
	} as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
	selectMock.mockReset();
	updateMock.mockReset().mockReturnValue(chainable(undefined));
	pushToKlaviyoMock.mockReset();
	pollSendConfirmationMock.mockReset();
});

describe('POST /api/prospects/[id]/push', () => {
	it('returns 401 and never touches the database when unauthenticated', async () => {
		const res = await POST(makeEvent(null));

		expect(res.status).toBe(401);
		expect(selectMock).not.toHaveBeenCalled();
	});

	it('returns 404 when the prospect does not exist', async () => {
		selectMock.mockReturnValueOnce(chainable([]));

		const res = await POST(makeEvent());

		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: 'Prospect not found' });
	});

	it('returns 400 when the prospect is not approved', async () => {
		selectMock.mockReturnValueOnce(chainable([{ ...APPROVED_PROSPECT, status: 'imported' }]));

		const res = await POST(makeEvent());

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			error: 'Prospect status is "imported" - must be "approved" before push'
		});
	});

	it('returns 400 when there is no approved draft', async () => {
		selectMock
			.mockReturnValueOnce(chainable([APPROVED_PROSPECT]))
			.mockReturnValueOnce(chainable([]));

		const res = await POST(makeEvent());

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: 'No approved draft found for this prospect' });
	});

	it('returns 400 when the segment is unassigned', async () => {
		selectMock
			.mockReturnValueOnce(chainable([{ ...APPROVED_PROSPECT, segment: 'unassigned' }]))
			.mockReturnValueOnce(chainable([APPROVED_DRAFT]));

		const res = await POST(makeEvent());

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: 'Cannot push prospect with unassigned segment' });
		expect(pushToKlaviyoMock).not.toHaveBeenCalled();
	});

	it('queries the prospect and draft tables with the correct table references', async () => {
		const prospectChain = chainable([APPROVED_PROSPECT]);
		const draftChain = chainable([APPROVED_DRAFT]);
		selectMock.mockReturnValueOnce(prospectChain).mockReturnValueOnce(draftChain);
		pushToKlaviyoMock.mockResolvedValue({ status: 'pushed', profileId: 'p1', listId: 'l1' });
		pollSendConfirmationMock.mockResolvedValue({ confirmed: false });

		await POST(makeEvent());

		expect(prospectChain.from).toHaveBeenCalledWith(prospects);
		expect(draftChain.from).toHaveBeenCalledWith(draftEmails);
	});

	it('returns 502 when the Klaviyo push fails, without updating prospect status', async () => {
		selectMock
			.mockReturnValueOnce(chainable([APPROVED_PROSPECT]))
			.mockReturnValueOnce(chainable([APPROVED_DRAFT]));
		pushToKlaviyoMock.mockResolvedValue({
			status: 'push-failed',
			error: 'Klaviyo profile upsert failed (500): boom',
			profileId: '',
			listId: ''
		});

		const res = await POST(makeEvent());

		expect(res.status).toBe(502);
		expect(await res.json()).toEqual({
			error: 'Klaviyo profile upsert failed (500): boom',
			status: 'push-failed'
		});
		expect(updateMock).not.toHaveBeenCalled();
		expect(pollSendConfirmationMock).not.toHaveBeenCalled();
	});

	it('marks send-confirmed and updates status twice when the send is confirmed', async () => {
		selectMock
			.mockReturnValueOnce(chainable([APPROVED_PROSPECT]))
			.mockReturnValueOnce(chainable([APPROVED_DRAFT]));
		pushToKlaviyoMock.mockResolvedValue({ status: 'pushed', profileId: 'p1', listId: 'l1' });
		pollSendConfirmationMock.mockResolvedValue({ confirmed: true });
		const updateChain = chainable(undefined);
		updateMock.mockReturnValue(updateChain);

		const res = await POST(makeEvent());

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ status: 'send-confirmed', profileId: 'p1', listId: 'l1' });
		expect(updateMock).toHaveBeenCalledTimes(2);
		expect(updateMock).toHaveBeenNthCalledWith(1, prospects);
		expect(updateChain.set).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ status: 'pushed' })
		);
		expect(updateChain.set).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ status: 'send-confirmed' })
		);
	});

	it('leaves status as pushed and reports unconfirmed when the send is not confirmed in time', async () => {
		selectMock
			.mockReturnValueOnce(chainable([APPROVED_PROSPECT]))
			.mockReturnValueOnce(chainable([APPROVED_DRAFT]));
		pushToKlaviyoMock.mockResolvedValue({ status: 'pushed', profileId: 'p1', listId: 'l1' });
		pollSendConfirmationMock.mockResolvedValue({ confirmed: false });
		const updateChain = chainable(undefined);
		updateMock.mockReturnValue(updateChain);

		const res = await POST(makeEvent());

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			status: 'pushed',
			message: 'Pushed, send unconfirmed - check Klaviyo',
			profileId: 'p1',
			listId: 'l1'
		});
		expect(updateMock).toHaveBeenCalledTimes(1);
		expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'pushed' }));
	});
});
