import { describe, expect, it } from 'vitest';
import { TALK_TRACKS } from './talk-tracks.js';
import type { TalkTrackSegment } from '$lib/types.js';

const ALL_SEGMENTS: TalkTrackSegment[] = [
	'community-donors',
	'nonprofit-marketing',
	'board-prospects',
	'financial-cra',
	'daf-giving-circles'
];

describe('TALK_TRACKS', () => {
	it('defines a guide for every talk-track segment', () => {
		expect(Object.keys(TALK_TRACKS).sort()).toEqual([...ALL_SEGMENTS].sort());
	});

	it.each(ALL_SEGMENTS)('has non-empty label, framing, and cta for "%s"', (segment) => {
		const guide = TALK_TRACKS[segment];
		expect(guide.label.length).toBeGreaterThan(0);
		expect(guide.framing.length).toBeGreaterThan(0);
		expect(guide.cta.length).toBeGreaterThan(0);
	});

	it('does not define a guide for the unassigned pseudo-segment', () => {
		expect((TALK_TRACKS as Record<string, unknown>).unassigned).toBeUndefined();
	});
});
