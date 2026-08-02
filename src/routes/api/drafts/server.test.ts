import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateDraftMock } = vi.hoisted(() => ({ generateDraftMock: vi.fn() }));
// A standalone stand-in class, not the real db-backed module - importing the real
// draft.js here would pull in db.js, which throws without a configured DATABASE_URL.
vi.mock('$lib/server/draft.js', () => {
	class NeedsReviewAcknowledgementError extends Error {}
	return { generateDraft: generateDraftMock, NeedsReviewAcknowledgementError };
});

import { POST } from './+server.js';
import { NeedsReviewAcknowledgementError } from '$lib/server/draft.js';

function makeEvent(options: { session?: unknown; body: unknown }): Parameters<typeof POST>[0] {
	const {
		session = {
			user: { email: 'jane@example.com', name: 'Jane Doe', givenName: 'Jane', familyName: 'Doe' }
		},
		body
	} = options;
	return {
		locals: { auth: async () => session },
		request: { json: async () => body }
	} as unknown as Parameters<typeof POST>[0];
}

// Deliberately not using mockReset()/mockClear() here: with Vitest 4.1.10,
// calling either before a test that sets an async-throwing mockImplementation
// (consumed by the route's own try/catch) causes a false "unhandled rejection"
// failure. Mutating .mock.calls directly clears call history without
// triggering that bug.
beforeEach(() => {
	generateDraftMock.mock.calls.length = 0;
});

describe('POST /api/drafts', () => {
	it('returns 401 when unauthenticated', async () => {
		const res = await POST(makeEvent({ session: null, body: { prospectId: 'p1' } }));
		expect(res.status).toBe(401);
		expect(generateDraftMock).not.toHaveBeenCalled();
	});

	it('returns 400 when prospectId is missing', async () => {
		const res = await POST(makeEvent({ body: {} }));
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: 'prospectId is required' });
		expect(generateDraftMock).not.toHaveBeenCalled();
	});

	it('returns 400 with the error message when draft generation fails', async () => {
		generateDraftMock.mockRejectedValue(new Error('Prospect not found'));

		const res = await POST(makeEvent({ body: { prospectId: 'p1' } }));

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: 'Prospect not found' });
	});

	it('returns 201 with the generated draft on success', async () => {
		generateDraftMock.mockResolvedValue({ id: 'draft-1', subject: 'Hello' });

		const res = await POST(makeEvent({ body: { prospectId: 'p1' } }));

		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({ id: 'draft-1', subject: 'Hello' });
		expect(generateDraftMock).toHaveBeenCalledWith('p1', 'Jane Doe', undefined, {
			acknowledgeReview: undefined
		});
	});

	it('prefers given/family name over the combined name field', async () => {
		generateDraftMock.mockResolvedValue({ id: 'draft-1', subject: 'Hello' });

		const res = await POST(
			makeEvent({
				session: {
					user: {
						email: 'jane@example.com',
						name: 'Jane D. (FundaMental Health)',
						givenName: 'Jane',
						familyName: 'Doe'
					}
				},
				body: { prospectId: 'p1' }
			})
		);

		expect(res.status).toBe(201);
		expect(generateDraftMock).toHaveBeenCalledWith('p1', 'Jane Doe', undefined, {
			acknowledgeReview: undefined
		});
	});

	it('uses just the given name when there is no family name', async () => {
		generateDraftMock.mockResolvedValue({ id: 'draft-1', subject: 'Hello' });

		const res = await POST(
			makeEvent({
				session: { user: { email: 'jane@example.com', name: 'Jane Doe', givenName: 'Jane' } },
				body: { prospectId: 'p1' }
			})
		);

		expect(res.status).toBe(201);
		expect(generateDraftMock).toHaveBeenCalledWith('p1', 'Jane', undefined, {
			acknowledgeReview: undefined
		});
	});

	it('falls back to the combined name field when given/family name are absent', async () => {
		generateDraftMock.mockResolvedValue({ id: 'draft-1', subject: 'Hello' });

		const res = await POST(
			makeEvent({
				session: { user: { email: 'jane@example.com', name: 'Jane Doe' } },
				body: { prospectId: 'p1' }
			})
		);

		expect(res.status).toBe(201);
		expect(generateDraftMock).toHaveBeenCalledWith('p1', 'Jane Doe', undefined, {
			acknowledgeReview: undefined
		});
	});

	it('passes undefined as the sender name when the session has no name at all', async () => {
		generateDraftMock.mockResolvedValue({ id: 'draft-1', subject: 'Hello' });

		const res = await POST(
			makeEvent({
				session: { user: { email: 'jane@example.com' } },
				body: { prospectId: 'p1' }
			})
		);

		expect(res.status).toBe(201);
		expect(generateDraftMock).toHaveBeenCalledWith('p1', undefined, undefined, {
			acknowledgeReview: undefined
		});
	});

	it('passes acknowledgeReview through to generateDraft', async () => {
		generateDraftMock.mockResolvedValue({ id: 'draft-2', subject: 'Hello' });

		await POST(makeEvent({ body: { prospectId: 'p1', acknowledgeReview: true } }));

		expect(generateDraftMock).toHaveBeenCalledWith('p1', 'Jane Doe', undefined, {
			acknowledgeReview: true
		});
	});

	it('returns 409 when the prospect is flagged needs-review and not acknowledged', async () => {
		generateDraftMock.mockRejectedValue(new NeedsReviewAcknowledgementError());

		const res = await POST(makeEvent({ body: { prospectId: 'p1' } }));

		expect(res.status).toBe(409);
		expect(await res.json()).toEqual(expect.objectContaining({ needsReviewAcknowledgement: true }));
	});
});
