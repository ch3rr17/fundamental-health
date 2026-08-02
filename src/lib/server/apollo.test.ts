import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockEnv, setMockEnv } from './test-helpers/mock-env.js';
import type { DedupResult, SegmentResult } from '$lib/types.js';

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

const { valuesMock, insertMock, checkDedupMock, assignSegmentMock } = vi.hoisted(() => ({
	valuesMock: vi.fn().mockResolvedValue(undefined),
	insertMock: vi.fn(),
	checkDedupMock: vi.fn(),
	assignSegmentMock: vi.fn()
}));

vi.mock('./db.js', () => ({ db: { insert: insertMock } }));
vi.mock('./dedup.js', () => ({ checkDedup: checkDedupMock }));
vi.mock('./segment.js', () => ({ assignSegment: assignSegmentMock }));

import { prospects } from './schema.js';
import { fetchLists, importFromApollo } from './apollo.js';

const NO_MATCH: DedupResult = {
	matched: false,
	matchSource: null,
	matchMethod: null,
	priorContactDate: null,
	priorTalkTrack: null
};

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
	setMockEnv();
	insertMock.mockReset().mockImplementation(() => ({ values: valuesMock }));
	valuesMock.mockClear();
	checkDedupMock.mockReset();
	assignSegmentMock.mockReset();
	vi.unstubAllGlobals();
});

describe('fetchLists', () => {
	it('throws when APOLLO_KEY is not configured', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		await expect(fetchLists()).rejects.toThrow('APOLLO_KEY');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('maps data.labels entries to {id, name, count}', async () => {
		setMockEnv({ APOLLO_KEY: 'key' });
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				jsonResponse({ labels: [{ id: 'l1', name: 'Board Prospects', cached_count: 42 }] })
			)
		);

		const lists = await fetchLists();

		expect(lists).toEqual([{ id: 'l1', name: 'Board Prospects', count: 42 }]);
	});

	it('falls back to a bare array response when data.labels is absent', async () => {
		setMockEnv({ APOLLO_KEY: 'key' });
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => jsonResponse([{ id: 'l2', name: 'Donors', cached_count: 7 }]))
		);

		const lists = await fetchLists();

		expect(lists).toEqual([{ id: 'l2', name: 'Donors', count: 7 }]);
	});

	it('throws with the upstream status and body on a failed request', async () => {
		setMockEnv({ APOLLO_KEY: 'key' });
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('forbidden', { status: 403 }))
		);

		await expect(fetchLists()).rejects.toThrow('Apollo API error (403): forbidden');
	});
});

describe('importFromApollo', () => {
	beforeEach(() => setMockEnv({ APOLLO_KEY: 'key' }));

	it('throws when APOLLO_KEY is not configured, without touching the database', async () => {
		setMockEnv();
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		await expect(importFromApollo('label-1')).rejects.toThrow('APOLLO_KEY');
		expect(fetchMock).not.toHaveBeenCalled();
		expect(insertMock).not.toHaveBeenCalled();
	});

	it('propagates an Apollo API error without inserting anything', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('server error', { status: 500 }))
		);

		await expect(importFromApollo('label-1')).rejects.toThrow('Apollo API error (500)');
		expect(insertMock).not.toHaveBeenCalled();
	});

	it('paginates through Apollo results until a short page is returned', async () => {
		const fullPage = Array.from({ length: 100 }, (_, i) => ({
			first_name: 'A',
			last_name: `${i}`,
			email: null,
			title: null,
			organization_name: null,
			linkedin_url: null,
			city: null,
			state: null
		}));
		const lastPage = [
			{
				first_name: 'Last',
				last_name: 'One',
				email: null,
				title: null,
				organization_name: null,
				linkedin_url: null,
				city: null,
				state: null
			}
		];
		const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
			const body = JSON.parse(init.body as string);
			if (body.page === 1) {
				return jsonResponse({ contacts: fullPage, pagination: { total_pages: 2 } });
			}
			if (body.page === 2) {
				return jsonResponse({ contacts: lastPage, pagination: { total_pages: 2 } });
			}
			throw new Error(`Unexpected page ${body.page}`);
		});
		vi.stubGlobal('fetch', fetchMock);
		checkDedupMock.mockResolvedValue(NO_MATCH);
		assignSegmentMock.mockReturnValue({ segment: 'unassigned', confidence: 0.3, reason: 'x' });

		const results = await importFromApollo('label-1');

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(results.total).toBe(101);
		expect(results.imported).toBe(101);
	});

	it('skips contacts missing a first or last name without counting them as imported', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				jsonResponse({
					contacts: [
						{
							first_name: '',
							last_name: 'NoFirst',
							email: null,
							title: null,
							organization_name: null,
							linkedin_url: null,
							city: null,
							state: null
						},
						{
							first_name: 'NoLast',
							last_name: '',
							email: null,
							title: null,
							organization_name: null,
							linkedin_url: null,
							city: null,
							state: null
						},
						{
							first_name: 'Valid',
							last_name: 'Row',
							email: null,
							title: null,
							organization_name: null,
							linkedin_url: null,
							city: null,
							state: null
						}
					],
					pagination: { total_pages: 1 }
				})
			)
		);
		checkDedupMock.mockResolvedValue(NO_MATCH);
		assignSegmentMock.mockReturnValue({ segment: 'unassigned', confidence: 0.3, reason: 'x' });

		const results = await importFromApollo('label-1');

		expect(results).toEqual({ imported: 1, alreadyContacted: 0, total: 3 });
		expect(insertMock).toHaveBeenCalledTimes(1);
	});

	it('joins city and state into a single location, and assigns a segment for unmatched contacts', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				jsonResponse({
					contacts: [
						{
							first_name: 'Jane',
							last_name: 'Doe',
							email: 'jane@example.com',
							title: 'Board Member',
							organization_name: 'Acme',
							linkedin_url: 'https://linkedin.com/in/jane',
							city: 'San Diego',
							state: 'CA'
						}
					],
					pagination: { total_pages: 1 }
				})
			)
		);
		checkDedupMock.mockResolvedValue(NO_MATCH);
		const segResult: SegmentResult = {
			segment: 'board-prospects',
			confidence: 0.75,
			reason: 'test'
		};
		assignSegmentMock.mockReturnValue(segResult);

		const results = await importFromApollo('label-1');

		expect(results).toEqual({ imported: 1, alreadyContacted: 0, total: 1 });
		expect(insertMock).toHaveBeenCalledWith(prospects);
		expect(checkDedupMock).toHaveBeenCalledWith('jane@example.com', 'Jane', 'Doe', 'Acme');
		expect(assignSegmentMock).toHaveBeenCalledWith({
			title: 'Board Member',
			organization: 'Acme',
			location: 'San Diego, CA'
		});
		expect(valuesMock).toHaveBeenCalledWith(
			expect.objectContaining({
				firstName: 'Jane',
				lastName: 'Doe',
				source: 'apollo',
				location: 'San Diego, CA',
				segment: 'board-prospects',
				status: 'imported'
			})
		);
	});

	it('leaves location null when both city and state are missing', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				jsonResponse({
					contacts: [
						{
							first_name: 'Jane',
							last_name: 'Doe',
							email: null,
							title: null,
							organization_name: null,
							linkedin_url: null,
							city: null,
							state: null
						}
					],
					pagination: { total_pages: 1 }
				})
			)
		);
		checkDedupMock.mockResolvedValue(NO_MATCH);
		assignSegmentMock.mockReturnValue({ segment: 'unassigned', confidence: 0.3, reason: 'x' });

		await importFromApollo('label-1');

		expect(assignSegmentMock).toHaveBeenCalledWith(expect.objectContaining({ location: null }));
	});

	it('skips segment assignment and counts as already-contacted on a dedup match', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				jsonResponse({
					contacts: [
						{
							first_name: 'Jane',
							last_name: 'Doe',
							email: 'jane@example.com',
							title: null,
							organization_name: null,
							linkedin_url: null,
							city: null,
							state: null
						}
					],
					pagination: { total_pages: 1 }
				})
			)
		);
		checkDedupMock.mockResolvedValue({
			matched: true,
			matchSource: 'klaviyo',
			matchMethod: 'email',
			priorContactDate: '2025-01-01T00:00:00Z',
			priorTalkTrack: 'community-donors'
		});

		const results = await importFromApollo('label-1');

		expect(results).toEqual({ imported: 0, alreadyContacted: 1, total: 1 });
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
});
