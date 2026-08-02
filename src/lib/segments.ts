import type { ProspectStatus, TalkTrackSegment } from './types';

export const SEGMENT_LABELS: Record<TalkTrackSegment, string> = {
	'community-donors': 'Community donors',
	'nonprofit-marketing': 'Nonprofit / marketing',
	'board-prospects': 'Board prospects',
	'financial-cra': 'Financial / CRA',
	'daf-giving-circles': 'DAF advisors'
};

export const SEGMENT_ORDER: TalkTrackSegment[] = [
	'community-donors',
	'nonprofit-marketing',
	'board-prospects',
	'financial-cra',
	'daf-giving-circles'
];

export const STATUS_LABELS: Record<ProspectStatus, string> = {
	imported: 'Ready for research',
	'already-contacted': 'Previously Contacted',
	'needs-review': 'Needs review',
	'draft-ready': 'Email drafted',
	approved: 'Approved — ready to push',
	pushed: 'Sent to Klaviyo',
	'send-confirmed': 'Email sent',
	logged: 'Synced to Monday.com'
};

export const QUEUE_STATUSES: ProspectStatus[] = [
	'imported',
	'needs-review',
	'draft-ready',
	'approved',
	'pushed',
	'send-confirmed',
	'logged'
];
