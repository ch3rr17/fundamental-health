import { beforeEach, describe, expect, it, vi } from 'vitest';

const { importFromApolloMock } = vi.hoisted(() => ({ importFromApolloMock: vi.fn() }));
vi.mock('$lib/server/apollo.js', () => ({ importFromApollo: importFromApolloMock }));

import { POST } from './+server.js';

function makeEvent(options: { session?: unknown; body: unknown }): Parameters<typeof POST>[0] {
	const { session = { user: { email: 'jane@example.com' } }, body } = options;
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
	importFromApolloMock.mock.calls.length = 0;
});

describe('POST /api/apollo/pull', () => {
	it('returns 401 when unauthenticated', async () => {
		const res = await POST(makeEvent({ session: null, body: { labelId: 'l1' } }));
		expect(res.status).toBe(401);
		expect(importFromApolloMock).not.toHaveBeenCalled();
	});

	it('returns 400 when labelId is missing', async () => {
		const res = await POST(makeEvent({ body: {} }));
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: 'labelId is required' });
		expect(importFromApolloMock).not.toHaveBeenCalled();
	});

	it('returns 502 with the error message when the import fails', async () => {
		importFromApolloMock.mockRejectedValue(new Error('Apollo API error (500): boom'));

		const res = await POST(makeEvent({ body: { labelId: 'l1' } }));

		expect(res.status).toBe(502);
		expect(await res.json()).toEqual({ error: 'Apollo API error (500): boom' });
	});

	it('returns 201 with the import results on success', async () => {
		importFromApolloMock.mockResolvedValue({ imported: 3, alreadyContacted: 1, total: 4 });

		const res = await POST(makeEvent({ body: { labelId: 'l1' } }));

		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({ imported: 3, alreadyContacted: 1, total: 4 });
		expect(importFromApolloMock).toHaveBeenCalledWith('l1');
	});
});
