import { describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { requireAuth } from './auth-guard.js';

function makeEvent(session: unknown): RequestEvent {
	return {
		locals: {
			auth: async () => session
		}
	} as unknown as RequestEvent;
}

describe('requireAuth', () => {
	it('returns a 401 response when there is no session', async () => {
		const res = await requireAuth(makeEvent(null));
		expect(res).not.toBeNull();
		expect(res?.status).toBe(401);
		expect(await res?.json()).toEqual({ error: 'Unauthorized' });
	});

	it('returns a 401 response when the session has no user', async () => {
		const res = await requireAuth(makeEvent({ user: undefined }));
		expect(res?.status).toBe(401);
	});

	it('returns a 401 response when session itself is undefined', async () => {
		const res = await requireAuth(makeEvent(undefined));
		expect(res?.status).toBe(401);
	});

	it('returns null when the session has a user', async () => {
		const res = await requireAuth(makeEvent({ user: { email: 'jane@example.com' } }));
		expect(res).toBeNull();
	});
});
