/** The 5 fixed talk-track segments assigned by the app (not by Apollo). */
export type TalkTrackSegment =
	| 'community-donors'
	| 'nonprofit-marketing'
	| 'board-prospects'
	| 'financial-cra'
	| 'daf-giving-circles';

/** Explicit "unassigned" state for low-confidence segment assignment. */
export type SegmentAssignment = TalkTrackSegment | 'unassigned';

/** Pipeline status a prospect moves through. */
export type ProspectStatus =
	| 'imported'
	| 'already-contacted'
	| 'needs-review'
	| 'draft-ready'
	| 'approved'
	| 'pushed'
	| 'send-confirmed'
	| 'logged';

/** A prospect as ingested from Apollo API or CSV import. */
export interface Prospect {
	id: string;
	firstName: string;
	lastName: string;
	email: string | null;
	organization: string | null;
	title: string | null;
	linkedinUrl: string | null;
	location: string | null;
	source: 'apollo' | 'csv';
	sourceListId: string | null;
	sourceListName: string | null;
	segment: SegmentAssignment;
	segmentConfidence: number | null;
	status: ProspectStatus;
	priorContactDate: string | null;
	priorTalkTrack: TalkTrackSegment | null;
	createdAt: string;
	updatedAt: string;
}

/** An AI-generated draft email sitting in the review queue. */
export interface DraftEmail {
	id: string;
	prospectId: string;
	segment: TalkTrackSegment;
	subject: string;
	body: string;
	researchSummary: string | null;
	researchConfidence: number | null;
	approved: boolean;
	createdAt: string;
	updatedAt: string;
}

/** Result of a dedup check against Klaviyo / Monday.com. */
export interface DedupResult {
	matched: boolean;
	matchSource: 'klaviyo' | 'monday' | null;
	matchMethod: 'email' | 'name-org' | null;
	priorContactDate: string | null;
	priorTalkTrack: TalkTrackSegment | null;
}

/** Segment assignment result from the rule engine / AI. */
export interface SegmentResult {
	segment: SegmentAssignment;
	confidence: number;
	reason: string;
}
