import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { parseCsv, importProspects } from '$lib/server/ingest.js';

export const POST: RequestHandler = async ({ request }) => {
	const contentType = request.headers.get('content-type') ?? '';

	let csvText: string;

	if (contentType.includes('multipart/form-data')) {
		const formData = await request.formData();
		const file = formData.get('file');
		if (!(file instanceof File)) {
			return json({ error: 'No file provided' }, { status: 400 });
		}
		csvText = await file.text();
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

	const results = await importProspects(rows);
	return json(results, { status: 201 });
};
