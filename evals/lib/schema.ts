/**
 * The Section 9 output contract, as data.
 *
 * This file is the machine-readable twin of Section 9 in
 * `src/lib/server/agent/prompts/prospect-email-agent.md`. If Section 9 changes,
 * this changes with it — that is the point of the eval catching drift.
 */

export const STATUSES = [
	'drafted',
	'needs_human_review',
	'do_not_contact',
	'insufficient_input'
] as const;

export const TRACKS = ['01', '02', '03', '04', '05'] as const;

export const ORG_TYPES = [
	'bank',
	'foundation',
	'wealth_mgmt',
	'healthcare',
	'nonprofit',
	'agency',
	'operating_co',
	'other'
] as const;

export type Status = (typeof STATUSES)[number];
export type Track = (typeof TRACKS)[number];

export interface AgentSource {
	url?: string;
	retrieved_fact?: string;
	tier?: string;
}

export interface AgentOutput {
	prospect_id?: string;
	status?: string;
	status_reason?: string | null;
	research?: {
		verified_name?: string | null;
		verified_title?: string | null;
		verified_org?: string | null;
		org_type?: string | null;
		geography?: string | null;
		san_diego_nexus?: string | boolean | null;
		sources?: AgentSource[] | null;
	} | null;
	track?: {
		selected?: string | null;
		confidence?: number | null;
		rationale?: string | null;
		runners_up?: string[] | null;
	} | null;
	personalization?: {
		anchor?: string | null;
		anchor_tier?: string | null;
		anchor_source?: string | null;
	} | null;
	email?: {
		subject?: string | null;
		body?: string | null;
		word_count?: number | null;
		link_used?: string | null;
	} | null;
	confidence?: number | null;
	flags?: string[] | null;
	resource_gaps?: string[] | null;
}

/** Section 3.2. The only URLs an email body may contain. */
export const APPROVED_LINKS = [
	'https://fundamental.health/news/inside-neighbors-in-need-a-more-human-way-to-tell-impact-stories/',
	'https://fundamental.health/donors/',
	'https://fundamental.health/bridge-to-care/',
	'https://fundamental.health/foundation-of-care/',
	'https://fundamental.health/about/'
];

/** Section 3.3. Each statistic and the single track it may appear in. */
export const APPROVED_STATS = [
	{
		track: '01',
		fragment: '1 in 5 adults in San Diego is living with a mental health condition',
		probe: /1 in 5 adults/i
	},
	{
		track: '05',
		fragment: 'mental health receives just 7% of healthcare philanthropic dollars',
		probe: /7%\s*of\s*healthcare philanthropic/i
	}
];

/** Section 6.5. Must appear verbatim. */
export const COMPLIANCE_FOOTER_LINES = [
	'FundaMental Health',
	'501 West Broadway, Suite 1540, San Diego, CA 92101',
	`If you'd rather not hear from me, just reply "no thanks" and I'll take you off my list.`
];

/** Section 6.4. Phrases that must never appear in an email. */
export const BANNED_PHRASES = [
	'I hope this email finds you well',
	'I wanted to reach out',
	'circling back',
	'touch base',
	'synergy',
	'leverage',
	'at the intersection of',
	'in today’s landscape',
	"in today's landscape",
	'now more than ever',
	'game-changer',
	'excited to share',
	'your incredible work',
	'your inspiring leadership'
];

/**
 * Extract the agent's JSON object from a raw model response.
 *
 * Section 9 asks for a bare JSON object and nothing else, so a response needing
 * recovery is itself a rubric failure — `recovered` records that for the report
 * rather than hiding it.
 */
export function extractJson(raw: string): {
	ok: boolean;
	value: AgentOutput | null;
	recovered: boolean;
	error?: string;
} {
	const trimmed = raw.trim();

	try {
		return { ok: true, value: JSON.parse(trimmed) as AgentOutput, recovered: false };
	} catch {
		// fall through to recovery
	}

	// Recovery 1: a fenced code block.
	const fenced = trimmed.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
	if (fenced) {
		try {
			return { ok: true, value: JSON.parse(fenced[1]) as AgentOutput, recovered: true };
		} catch {
			// keep trying
		}
	}

	// Recovery 2: the outermost brace pair.
	const first = trimmed.indexOf('{');
	const last = trimmed.lastIndexOf('}');
	if (first !== -1 && last > first) {
		try {
			return {
				ok: true,
				value: JSON.parse(trimmed.slice(first, last + 1)) as AgentOutput,
				recovered: true
			};
		} catch (err) {
			return { ok: false, value: null, recovered: true, error: String(err) };
		}
	}

	return { ok: false, value: null, recovered: true, error: 'no JSON object found in response' };
}
