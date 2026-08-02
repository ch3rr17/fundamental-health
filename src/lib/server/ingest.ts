import { db } from './db.js';
import { prospects } from './schema.js';
import type { SegmentAssignment } from '$lib/types.js';
import { assignSegment } from './segment.js';
import { checkDedup } from './dedup.js';

interface CsvRow {
	first_name: string;
	last_name: string;
	email?: string;
	organization?: string;
	title?: string;
	linkedin_url?: string;
	location?: string;
}

/** Parse raw CSV text into rows. Handles quoted fields with commas. */
export function parseCsv(raw: string): CsvRow[] {
	const lines = raw.trim().split('\n');
	if (lines.length < 2) return [];

	const HEADER_ALIASES: Record<string, string> = {
		company_name: 'organization',
		company: 'organization',
		person_linkedin_url: 'linkedin_url',
		linkedin: 'linkedin_url',
		city: 'location'
	};
	const headers = parseCsvLine(lines[0]).map((h) => {
		const normalized = h.trim().toLowerCase().replace(/\s+/g, '_');
		return HEADER_ALIASES[normalized] ?? normalized;
	});
	const rows: CsvRow[] = [];

	for (let i = 1; i < lines.length; i++) {
		const values = parseCsvLine(lines[i]);
		const row: Record<string, string> = {};
		for (let j = 0; j < headers.length; j++) {
			row[headers[j]] = values[j]?.trim() ?? '';
		}
		if (row.first_name && row.last_name) {
			rows.push(row as unknown as CsvRow);
		}
	}
	return rows;
}

function parseCsvLine(line: string): string[] {
	const fields: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQuotes) {
			if (ch === '"' && line[i + 1] === '"') {
				current += '"';
				i++;
			} else if (ch === '"') {
				inQuotes = false;
			} else {
				current += ch;
			}
		} else if (ch === '"') {
			inQuotes = true;
		} else if (ch === ',') {
			fields.push(current);
			current = '';
		} else {
			current += ch;
		}
	}
	fields.push(current);
	return fields;
}

/** Import parsed CSV rows: dedup check, segment assignment, insert into DB. */
export async function importProspects(rows: CsvRow[]) {
	const results = { imported: 0, alreadyContacted: 0, total: rows.length };

	for (const row of rows) {
		const dedup = await checkDedup(row.email ?? null, row.first_name, row.last_name, row.organization ?? null);

		let segment: SegmentAssignment = 'unassigned';
		let segmentConfidence: number | null = null;

		if (!dedup.matched) {
			const segResult = assignSegment({
				title: row.title ?? null,
				organization: row.organization ?? null,
				location: row.location ?? null
			});
			segment = segResult.segment;
			segmentConfidence = segResult.confidence;
		}

		const status = dedup.matched ? 'already-contacted' : 'imported';

		await db.insert(prospects).values({
			firstName: row.first_name,
			lastName: row.last_name,
			email: row.email || null,
			organization: row.organization || null,
			title: row.title || null,
			linkedinUrl: row.linkedin_url || null,
			location: row.location || null,
			source: 'csv',
			segment,
			segmentConfidence,
			status,
			priorContactDate: dedup.priorContactDate ?? null,
			priorTalkTrack: dedup.priorTalkTrack ?? null
		});

		if (dedup.matched) {
			results.alreadyContacted++;
		} else {
			results.imported++;
		}
	}

	return results;
}
