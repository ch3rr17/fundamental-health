import type { ProspectStatus, TalkTrackSegment } from './types';

export const SEGMENT_LABELS: Record<TalkTrackSegment, string> = {
	'community-donors': 'Community Donors',
	'nonprofit-marketing': 'Nonprofit / Marketing',
	'board-prospects': 'Board Prospects',
	'financial-cra': 'Financial / CRA',
	'daf-giving-circles': 'DAF Advisors'
};

export const SEGMENT_ORDER: TalkTrackSegment[] = [
	'community-donors',
	'nonprofit-marketing',
	'board-prospects',
	'financial-cra',
	'daf-giving-circles'
];

export const STATUS_LABELS: Record<ProspectStatus, string> = {
	imported: 'Ready For Research',
	'already-contacted': 'Previously Contacted',
	'needs-review': 'Needs Review',
	'draft-ready': 'Email Drafted',
	approved: 'Approved - Ready To Push',
	pushed: 'Pushed - Unconfirmed',
	'send-confirmed': 'Send Confirmed',
	logged: 'Synced To Monday.com'
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
