import type { SegmentResult } from '$lib/types.js';

interface ProspectSignals {
	title: string | null;
	organization: string | null;
	location: string | null;
}

const CONFIDENCE_THRESHOLD = 0.6;

/**
 * Rule-based talk-track segment assignment.
 *
 * Matches on title/org keywords. Returns 'unassigned' with the reason
 * "needs manual tag" when confidence is below threshold.
 */
export function assignSegment(signals: ProspectSignals): SegmentResult {
	const title = (signals.title ?? '').toLowerCase();
	const org = (signals.organization ?? '').toLowerCase();
	const combined = `${title} ${org}`;

	// Financial institutions / CRA
	if (matchesAny(combined, ['bank', 'credit union', 'cra', 'community reinvestment', 'cdfi', 'financial institution', 'lending'])) {
		return { segment: 'financial-cra', confidence: 0.85, reason: 'Financial institution or CRA keywords in title/org' };
	}

	// DAF advisors & giving circles
	if (matchesAny(combined, ['donor advised', 'daf', 'giving circle', 'philanthropic advisor', 'wealth advisor', 'financial advisor', 'planned giving'])) {
		return { segment: 'daf-giving-circles', confidence: 0.8, reason: 'DAF or giving circle keywords in title/org' };
	}

	// Board prospects
	if (matchesAny(combined, ['board', 'director', 'trustee', 'governance', 'advisory council'])) {
		return { segment: 'board-prospects', confidence: 0.75, reason: 'Board/governance keywords in title/org' };
	}

	// Nonprofit / marketing professionals
	if (matchesAny(combined, ['nonprofit', 'non-profit', 'ngo', 'marketing', 'communications', 'public relations', 'pr ', 'fundrais', 'development director', 'grant'])) {
		return { segment: 'nonprofit-marketing', confidence: 0.75, reason: 'Nonprofit or marketing keywords in title/org' };
	}

	// Community donors — broadest bucket, lower confidence
	if (matchesAny(combined, ['philanthrop', 'donor', 'volunteer', 'community', 'mental health', 'social work', 'counsel', 'therapist', 'psycholog'])) {
		return { segment: 'community-donors', confidence: 0.65, reason: 'Community/mental health affinity keywords in title/org' };
	}

	// Below threshold — needs manual tag
	return { segment: 'unassigned', confidence: 0.3, reason: 'No strong segment signal found - needs manual tag' };
}

function matchesAny(text: string, keywords: string[]): boolean {
	return keywords.some((kw) => text.includes(kw));
}
