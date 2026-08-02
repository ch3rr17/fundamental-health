import { describe, expect, it, vi } from 'vitest';
import { parseCsv } from './ingest.js';

// ingest.ts imports db.ts at module scope, which throws without a real
// DATABASE_URL. parseCsv itself never touches the database, so stub it out.
// (vi.mock is hoisted above the imports above, so this applies to them.)
vi.mock('./db.js', () => ({ db: {} }));

describe('parseCsv', () => {
	it('parses a basic CSV into row objects', () => {
		const csv = 'first_name,last_name,email\nJane,Doe,jane@example.com';
		const rows = parseCsv(csv);
		expect(rows).toEqual([{ first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' }]);
	});

	it('parses multiple rows', () => {
		const csv = 'first_name,last_name\nJane,Doe\nJohn,Smith';
		const rows = parseCsv(csv);
		expect(rows).toHaveLength(2);
		expect(rows[1]).toMatchObject({ first_name: 'John', last_name: 'Smith' });
	});

	it('returns an empty array for header-only input', () => {
		expect(parseCsv('first_name,last_name')).toEqual([]);
	});

	it('returns an empty array for empty input', () => {
		expect(parseCsv('')).toEqual([]);
	});

	it('normalizes header casing and whitespace to snake_case', () => {
		const csv = 'First Name,Last Name\nJane,Doe';
		const rows = parseCsv(csv);
		expect(rows[0]).toMatchObject({ first_name: 'Jane', last_name: 'Doe' });
	});

	it.each([
		['company_name', 'organization'],
		['company', 'organization'],
		['person_linkedin_url', 'linkedin_url'],
		['linkedin', 'linkedin_url'],
		['city', 'location']
	])('maps header alias "%s" to "%s"', (alias, canonical) => {
		const csv = `first_name,last_name,${alias}\nJane,Doe,Acme`;
		const rows = parseCsv(csv);
		expect(rows[0]).toMatchObject({ [canonical]: 'Acme' });
	});

	it('handles quoted fields containing commas', () => {
		const csv = 'first_name,last_name,organization\nJane,Doe,"Acme, Inc."';
		const rows = parseCsv(csv);
		expect(rows[0].organization).toBe('Acme, Inc.');
	});

	it('handles escaped double quotes inside quoted fields', () => {
		const csv = 'first_name,last_name,title\nJane,Doe,"VP of ""Growth"""';
		const rows = parseCsv(csv);
		expect(rows[0].title).toBe('VP of "Growth"');
	});

	it('skips rows missing first_name or last_name', () => {
		const csv =
			'first_name,last_name,email\n,Doe,jane@example.com\nJohn,,john@example.com\nValid,Row,valid@example.com';
		const rows = parseCsv(csv);
		expect(rows).toHaveLength(1);
		expect(rows[0].first_name).toBe('Valid');
	});

	it('trims whitespace around values', () => {
		const csv = 'first_name,last_name\n  Jane  ,  Doe  ';
		const rows = parseCsv(csv);
		expect(rows[0]).toMatchObject({ first_name: 'Jane', last_name: 'Doe' });
	});

	it('leaves optional fields undefined when column is absent', () => {
		const csv = 'first_name,last_name\nJane,Doe';
		const rows = parseCsv(csv);
		expect(rows[0].email).toBeUndefined();
		expect(rows[0].organization).toBeUndefined();
	});
});
