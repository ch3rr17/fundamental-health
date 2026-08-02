import { beforeEach, describe, expect, it, vi } from 'vitest';

const { parseCsvMock, importProspectsMock } = vi.hoisted(() => ({
	parseCsvMock: vi.fn(),
	importProspectsMock: vi.fn()
}));
vi.mock('$lib/server/ingest.js', () => ({
	parseCsv: parseCsvMock,
	importProspects: importProspectsMock
}));

import { POST } from './+server.js';

function makeEvent(options: { session?: unknown; request: unknown }): Parameters<typeof POST>[0] {
	const { session = { user: { email: 'jane@example.com' } }, request } = options;
	return { locals: { auth: async () => session }, request } as unknown as Parameters<
		typeof POST
	>[0];
}

function rawTextRequest(text: string) {
	return {
		headers: { get: () => 'text/csv' },
		text: async () => text
	};
}

function multipartRequest(file: unknown) {
	return {
		headers: { get: () => 'multipart/form-data; boundary=xyz' },
		formData: async () => ({ get: (key: string) => (key === 'file' ? file : null) })
	};
}

beforeEach(() => {
	parseCsvMock.mockReset();
	importProspectsMock.mockReset();
});

describe('POST /api/prospects/import', () => {
	it('returns 401 when unauthenticated', async () => {
		const res = await POST(makeEvent({ session: null, request: rawTextRequest('x') }));
		expect(res.status).toBe(401);
		expect(parseCsvMock).not.toHaveBeenCalled();
	});

	it('reads raw text bodies directly', async () => {
		parseCsvMock.mockReturnValue([{ first_name: 'Jane', last_name: 'Doe' }]);
		importProspectsMock.mockResolvedValue({ imported: 1, alreadyContacted: 0, total: 1 });

		const res = await POST(
			makeEvent({ request: rawTextRequest('first_name,last_name\nJane,Doe') })
		);

		expect(res.status).toBe(201);
		expect(parseCsvMock).toHaveBeenCalledWith('first_name,last_name\nJane,Doe');
		expect(await res.json()).toEqual({ imported: 1, alreadyContacted: 0, total: 1 });
	});

	it('returns 400 when a multipart request has no file field', async () => {
		const res = await POST(makeEvent({ request: multipartRequest(null) }));
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: 'No file provided' });
		expect(parseCsvMock).not.toHaveBeenCalled();
	});

	it('reads the uploaded file text for multipart requests', async () => {
		const file = new File(['first_name,last_name\nJane,Doe'], 'contacts.csv', { type: 'text/csv' });
		parseCsvMock.mockReturnValue([{ first_name: 'Jane', last_name: 'Doe' }]);
		importProspectsMock.mockResolvedValue({ imported: 1, alreadyContacted: 0, total: 1 });

		const res = await POST(makeEvent({ request: multipartRequest(file) }));

		expect(res.status).toBe(201);
		expect(parseCsvMock).toHaveBeenCalledWith('first_name,last_name\nJane,Doe');
	});

	it('returns 400 for an empty (whitespace-only) body', async () => {
		const res = await POST(makeEvent({ request: rawTextRequest('   \n  ') }));
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: 'Empty CSV' });
		expect(parseCsvMock).not.toHaveBeenCalled();
	});

	it('returns 400 when parseCsv finds no valid rows', async () => {
		parseCsvMock.mockReturnValue([]);
		const res = await POST(makeEvent({ request: rawTextRequest('not,a,valid,header') }));
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			error: 'No valid rows found in CSV. Required columns: first_name, last_name'
		});
		expect(importProspectsMock).not.toHaveBeenCalled();
	});
});
