import { describe, expect, it } from 'vitest';
import type { SegmentResult } from '$lib/types.js';
import { assignSegment } from './segment.js';

/** assignSegment only reads title and organization, so location is always null here. */
function classify(title: string | null, organization: string | null = null): SegmentResult {
	return assignSegment({ title, organization, location: null });
}

describe('assignSegment', () => {
	it('matches financial institutions / CRA keywords', () => {
		const result = classify('VP of Lending', 'First Community Bank');
		expect(result.segment).toBe('financial-cra');
		expect(result.confidence).toBe(0.85);
	});

	it('matches CDFI in organization name', () => {
		expect(classify(null, 'Neighborhood CDFI Fund').segment).toBe('financial-cra');
	});

	it('matches DAF / giving circle keywords', () => {
		const result = classify('Donor Advised Fund Manager');
		expect(result.segment).toBe('daf-giving-circles');
		expect(result.confidence).toBe(0.8);
	});

	it('matches wealth advisor as DAF segment', () => {
		expect(classify('Senior Wealth Advisor').segment).toBe('daf-giving-circles');
	});

	it('matches board / governance keywords', () => {
		const result = classify('Board Trustee');
		expect(result.segment).toBe('board-prospects');
		expect(result.confidence).toBe(0.75);
	});

	it('matches nonprofit / marketing keywords', () => {
		const result = classify('Marketing Manager', 'Local Nonprofit');
		expect(result.segment).toBe('nonprofit-marketing');
		expect(result.confidence).toBe(0.75);
	});

	it('prioritizes board-prospects over nonprofit-marketing when title says "director"', () => {
		// "director" alone matches the board bucket (checked first), even for a
		// nonprofit communications role — documents the rule engine's priority order.
		expect(classify('Director of Communications', 'Local Nonprofit').segment).toBe(
			'board-prospects'
		);
	});

	it('matches grant-related titles as nonprofit-marketing', () => {
		expect(classify('Grant Writer').segment).toBe('nonprofit-marketing');
	});

	it('matches community donor / mental health affinity keywords', () => {
		const result = classify('Licensed Therapist');
		expect(result.segment).toBe('community-donors');
		expect(result.confidence).toBe(0.65);
	});

	it('matches philanthropist as community-donors', () => {
		expect(classify(null, 'Philanthropic Circle').segment).toBe('community-donors');
	});

	it('falls back to unassigned when no keyword matches', () => {
		const result = assignSegment({
			title: 'Software Engineer',
			organization: 'Acme Corp',
			location: 'Remote'
		});
		expect(result.segment).toBe('unassigned');
		expect(result.confidence).toBe(0.3);
		expect(result.reason).toMatch(/needs manual tag/i);
	});

	it('treats null title and organization as empty strings without throwing', () => {
		expect(classify(null, null).segment).toBe('unassigned');
	});

	it('is case-insensitive', () => {
		expect(classify('BOARD MEMBER').segment).toBe('board-prospects');
	});

	it('checks higher-priority segments before lower-priority ones', () => {
		// A "board member" at a "bank" should match financial-cra first (checked before board-prospects).
		expect(classify('Board Member', 'Community Bank').segment).toBe('financial-cra');
	});
});
