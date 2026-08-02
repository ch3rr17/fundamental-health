import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DedupResult, SegmentResult } from '$lib/types.js';
import { prospects } from './schema.js';

const { valuesMock, insertMock, checkDedupMock, assignSegmentMock } = vi.hoisted(() => ({
	valuesMock: vi.fn().mockResolvedValue(undefined),
	insertMock: vi.fn(),
	checkDedupMock: vi.fn(),
	assignSegmentMock: vi.fn()
}));

vi.mock('./db.js', () => ({ db: { insert: insertMock } }));
vi.mock('./dedup.js', () => ({ checkDedup: checkDedupMock }));
vi.mock('./segment.js', () => ({ assignSegment: assignSegmentMock }));

import { importProspects } from './ingest.js';

const NO_MATCH: DedupResult = {
	matched: false,
	matchSource: null,
	matchMethod: null,
	priorContactDate: null,
	priorTalkTrack: null
};

beforeEach(() => {
	insertMock.mockReset().mockImplementation(() => ({ values: valuesMock }));
	valuesMock.mockClear();
	checkDedupMock.mockReset();
	assignSegmentMock.mockReset();
});

describe('importProspects', () => {
	it('assigns a segment and counts an unmatched prospect as imported', async () => {
		checkDedupMock.mockResolvedValue(NO_MATCH);
		const segResult: SegmentResult = {
			segment: 'board-prospects',
			confidence: 0.75,
			reason: 'test'
		};
		assignSegmentMock.mockReturnValue(segResult);

		const rows = [
			{
				first_name: 'Jane',
				last_name: 'Doe',
				email: 'jane@example.com',
				organization: 'Acme',
				title: 'Board Member'
			}
		];
		const results = await importProspects(rows);

		expect(results).toEqual({ imported: 1, alreadyContacted: 0, total: 1 });
		expect(insertMock).toHaveBeenCalledWith(prospects);
		expect(checkDedupMock).toHaveBeenCalledWith('jane@example.com', 'Jane', 'Doe', 'Acme');
		expect(assignSegmentMock).toHaveBeenCalledWith({
			title: 'Board Member',
			organization: 'Acme',
			location: null
		});
		expect(valuesMock).toHaveBeenCalledWith(
			expect.objectContaining({
				firstName: 'Jane',
				lastName: 'Doe',
				source: 'csv',
				segment: 'board-prospects',
				segmentConfidence: 0.75,
				status: 'imported',
				priorContactDate: null,
				priorTalkTrack: null
			})
		);
	});

	it('skips segment assignment and marks a matched prospect as already-contacted', async () => {
		const dedupMatch: DedupResult = {
			matched: true,
			matchSource: 'klaviyo',
			matchMethod: 'email',
			priorContactDate: '2025-01-01T00:00:00Z',
			priorTalkTrack: 'community-donors'
		};
		checkDedupMock.mockResolvedValue(dedupMatch);

		const rows = [{ first_name: 'John', last_name: 'Smith', email: 'john@example.com' }];
		const results = await importProspects(rows);

		expect(results).toEqual({ imported: 0, alreadyContacted: 1, total: 1 });
		expect(insertMock).toHaveBeenCalledWith(prospects);
		expect(checkDedupMock).toHaveBeenCalledWith('john@example.com', 'John', 'Smith', null);
		expect(assignSegmentMock).not.toHaveBeenCalled();
		expect(valuesMock).toHaveBeenCalledWith(
			expect.objectContaining({
				segment: 'unassigned',
				segmentConfidence: null,
				status: 'already-contacted',
				priorContactDate: '2025-01-01T00:00:00Z',
				priorTalkTrack: 'community-donors'
			})
		);
	});

	it('processes each row independently and totals imported vs. already-contacted', async () => {
		checkDedupMock
			.mockResolvedValueOnce(NO_MATCH)
			.mockResolvedValueOnce({ ...NO_MATCH, matched: true });
		assignSegmentMock.mockReturnValue({
			segment: 'unassigned',
			confidence: 0.3,
			reason: 'no signal'
		});

		const rows = [
			{ first_name: 'A', last_name: 'One' },
			{ first_name: 'B', last_name: 'Two' }
		];
		const results = await importProspects(rows);

		expect(results).toEqual({ imported: 1, alreadyContacted: 1, total: 2 });
		expect(valuesMock).toHaveBeenCalledTimes(2);
	});

	it('normalizes empty-string optional fields to null before inserting', async () => {
		checkDedupMock.mockResolvedValue(NO_MATCH);
		assignSegmentMock.mockReturnValue({
			segment: 'unassigned',
			confidence: 0.3,
			reason: 'no signal'
		});

		const rows = [
			{
				first_name: 'Jane',
				last_name: 'Doe',
				email: '',
				organization: '',
				title: '',
				linkedin_url: '',
				location: ''
			}
		];
		await importProspects(rows);

		expect(valuesMock).toHaveBeenCalledWith(
			expect.objectContaining({
				email: null,
				organization: null,
				title: null,
				linkedinUrl: null,
				location: null
			})
		);
	});

	it('returns zero counts for an empty row list without touching dedup or the database', async () => {
		const results = await importProspects([]);

		expect(results).toEqual({ imported: 0, alreadyContacted: 0, total: 0 });
		expect(checkDedupMock).not.toHaveBeenCalled();
		expect(valuesMock).not.toHaveBeenCalled();
	});

	it('aborts the whole batch and loses partial results if a row fails mid-loop', async () => {
		// importProspects has no try/catch around the per-row work, so a rejection
		// on any row propagates out of the function immediately — rows already
		// inserted before the failure are not rolled back, and no partial result
		// summary is returned. This test documents that behavior as intentional
		// rather than an oversight; if the source ever adds per-row error handling,
		// this test should be updated to match.
		checkDedupMock
			.mockResolvedValueOnce(NO_MATCH)
			.mockRejectedValueOnce(new Error('dedup unavailable'));
		assignSegmentMock.mockReturnValue({
			segment: 'unassigned',
			confidence: 0.3,
			reason: 'no signal'
		});

		const rows = [
			{ first_name: 'A', last_name: 'One' },
			{ first_name: 'B', last_name: 'Two' }
		];

		await expect(importProspects(rows)).rejects.toThrow('dedup unavailable');
		expect(valuesMock).toHaveBeenCalledTimes(1);
	});
});
