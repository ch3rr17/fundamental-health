import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { parseCsv, importProspects } from '$lib/server/ingest.js';
import { requireAuth } from '$lib/server/auth-guard.js';

export const POST: RequestHandler = async (event) => {
	const denied = await requireAuth(event);
	if (denied) return denied;

	const { request } = event;
	const contentType = request.headers.get('content-type') ?? '';

	let csvText: string;
	let listName: string | null = null;

	if (contentType.includes('multipart/form-data')) {
		const formData = await request.formData();
		const file = formData.get('file');
		if (!(file instanceof File)) {
			return json({ error: 'No file provided' }, { status: 400 });
		}
		csvText = await file.text();
		listName = file.name.replace(/\.csv$/i, '') || null;
	} else {
		csvText = await request.text();
	}

	if (!csvText.trim()) {
		return json({ error: 'Empty CSV' }, { status: 400 });
	}

	const rows = parseCsv(csvText);
	if (rows.length === 0) {
		return json({ error: 'No valid rows found in CSV. Required columns: first_name, last_name' }, { status: 400 });
	}

	const results = await importProspects(rows, listName);
	return json(results, { status: 201 });
};
