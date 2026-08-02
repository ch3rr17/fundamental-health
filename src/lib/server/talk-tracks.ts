import type { TalkTrackSegment } from '$lib/types.js';

interface TalkTrackGuide {
	label: string;
	framing: string;
	cta: string;
}

/** Talk-track messaging guides per segment. The AI uses these to match tone and CTA. */
export const TALK_TRACKS: Record<TalkTrackSegment, TalkTrackGuide> = {
	'community-donors': {
		label: 'Community Donors (Mental Health Affinity)',
		framing:
			'Frame around shared passion for mental health in San Diego. Emphasize local impact, the Neighbors in Need program, and how their support directly funds underserved community members accessing mental health services. Warm, personal, community-first tone.',
		cta: 'Invite to learn more about FundaMental Health\'s mission and explore ways to support — a brief call, an event, or a visit.'
	},
	'nonprofit-marketing': {
		label: 'Nonprofit / Marketing Professionals',
		framing:
			'Frame as a peer-to-peer knowledge share, NOT a donation ask. Lead with the Neighbors in Need case study — what worked, what the data showed, lessons learned. Position FundaMental Health as a peer worth learning from, not a charity asking for money.',
		cta: 'Invite to a brief conversation to exchange notes on community impact strategy, or share the case study directly.'
	},
	'board-prospects': {
		label: 'Board Prospects',
		framing:
			'Frame around governance and strategic leadership opportunity. Highlight the board\'s role in shaping FundaMental Health\'s growth, the organization\'s trajectory, and what expertise the prospect would bring. Professional, strategic tone.',
		cta: 'Invite to a conversation about board service and what the organization is building.'
	},
	'financial-cra': {
		label: 'Financial Institutions / CRA',
		framing:
			'Frame around CRA (Community Reinvestment Act) alignment. FundaMental Health serves low-to-moderate income and underserved communities in San Diego — a direct CRA-qualifying investment. Emphasize community development, measurable impact, and partnership structure.',
		cta: 'Invite to discuss how a partnership or grant could align with their CRA goals and community investment strategy.'
	},
	'daf-giving-circles': {
		label: 'DAF Advisors & Giving Circles',
		framing:
			'Frame around donor-advised fund grant recommendations and giving circle alignment. Position FundaMental Health as a vetted, impactful grantee for DAF holders and giving circles focused on mental health, homelessness, or San Diego community wellbeing.',
		cta: 'Invite to learn more about FundaMental Health as a recommended grantee for their DAF clients or giving circle members.'
	}
};
