import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateDraftMock } = vi.hoisted(() => ({ generateDraftMock: vi.fn() }));
vi.mock('$lib/server/draft.js', () => ({ generateDraft: generateDraftMock }));

import { POST } from './+server.js';

function makeEvent(options: { session?: unknown; body: unknown }): Parameters<typeof POST>[0] {
	const { session = { user: { email: 'jane@example.com', name: 'Jane Doe' } }, body } = options;
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
		expect(generateDraftMock).toHaveBeenCalledWith('p1', 'Jane Doe');
	});

	it('passes undefined as the sender name when the session has no name', async () => {
		generateDraftMock.mockResolvedValue({ id: 'draft-1', subject: 'Hello' });

		const res = await POST(
			makeEvent({
				session: { user: { email: 'jane@example.com' } },
				body: { prospectId: 'p1' }
			})
		);

		expect(res.status).toBe(201);
		expect(generateDraftMock).toHaveBeenCalledWith('p1', undefined);
	});
});
