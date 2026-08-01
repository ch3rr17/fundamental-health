/**
 * Deterministic half of Section 10.
 *
 * Everything checkable by counting, matching, or comparing lives here. It is
 * exact, free, and never flaky, so an LLM judge should never be asked any of it.
 * The judgement calls (is this claim sourced? could this line go to 100 people?)
 * live in `judge.ts`.
 */

import {
	APPROVED_LINKS,
	APPROVED_STATS,
	BANNED_PHRASES,
	COMPLIANCE_FOOTER_LINES,
	ORG_TYPES,
	STATUSES,
	TRACKS,
	type AgentOutput
} from './schema.ts';

export type Severity = 'fail' | 'warn';

export interface Check {
	id: string;
	section: string;
	severity: Severity;
	passed: boolean;
	detail?: string;
}

const URL_RE = /https?:\/\/[^\s<>()[\]"']+/g;
/** Bracketed placeholder like [First Name], but not a markdown link or a citation. */
const PLACEHOLDER_RE = /\[[A-Za-z][A-Za-z0-9 _-]{1,40}\]/g;
// Pictographs, dingbats, or a lone variation selector. Kept as an alternation
// rather than one class so the variation selector isn't combined with a range.
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|\u{FE0F}/u;
/** Em dash, en dash, or a double hyphen standing in for one. */
const DASH_RE = /[—–]|(?<=\s)--(?=\s)/;

const ACRONYM_ALLOWLIST = new Set([
	'CRA',
	'CEO',
	'CFO',
	'COO',
	'CTO',
	'CMO',
	'DAF',
	'EIN',
	'PTSD',
	'SVP',
	'EVP',
	'VP',
	'CPA',
	'ESG',
	'IRS',
	'LLC',
	'USA',
	'FFIEC',
	'CDFI',
	'BSA'
]);

function check(
	id: string,
	section: string,
	severity: Severity,
	passed: boolean,
	detail?: string
): Check {
	return { id, section, severity, passed, detail };
}

function urlsIn(text: string): string[] {
	return [...text.matchAll(URL_RE)].map((m) => m[0].replace(/[.,;:]+$/, ''));
}

/**
 * Word count for the personalization line, bridge, and ask only — §6.1 excludes
 * the greeting, sign-off, and compliance footer. We strip the footer, then the
 * greeting line, then everything from the sign-off onward.
 */
export function countBodyWords(body: string): number {
	let lines = body
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean);

	// Footer starts at the org name immediately preceding the street address.
	// Cutting at the address (rather than deleting every occurrence of
	// "FundaMental Health") keeps the org name where it appears in body prose.
	const addressIdx = lines.findIndex((l) => l.includes('501 West Broadway'));
	if (addressIdx > 0) {
		const orgLineAbove = lines[addressIdx - 1] === COMPLIANCE_FOOTER_LINES[0];
		lines = lines.slice(0, orgLineAbove ? addressIdx - 1 : addressIdx);
	}

	// Drop the greeting.
	const greetingIdx = lines.findIndex((l) => /^hi\b/i.test(l));
	if (greetingIdx !== -1) lines = lines.slice(greetingIdx + 1);

	// Drop the sign-off: trailing lines that aren't sentences. Body prose ends in
	// terminal punctuation; "Myke Edelman" and "Interim CEO, FundaMental Health"
	// do not.
	while (lines.length && !/[.?:]$/.test(lines[lines.length - 1])) {
		lines.pop();
	}

	return lines.join(' ').split(/\s+/).filter(Boolean).length;
}

export function runRubric(
	out: AgentOutput | null,
	rawResponse: string,
	jsonRecovered: boolean
): Check[] {
	const checks: Check[] = [];

	checks.push(
		check(
			'json_single_object',
			'§9',
			'fail',
			out !== null && !jsonRecovered,
			out === null
				? 'response did not contain a parseable JSON object'
				: jsonRecovered
					? 'JSON was recoverable but not returned bare as §9 requires'
					: undefined
		)
	);

	if (!out) return checks;

	// ---- Envelope -----------------------------------------------------------

	const status = out.status ?? '';
	checks.push(
		check(
			'status_enum',
			'§9',
			'fail',
			(STATUSES as readonly string[]).includes(status),
			`status = ${JSON.stringify(out.status)}`
		)
	);

	if (status !== 'drafted') {
		checks.push(
			check(
				'status_reason_present',
				'§9',
				'fail',
				typeof out.status_reason === 'string' && out.status_reason.trim().length > 0,
				'status_reason is required unless status is drafted'
			)
		);
		checks.push(
			check(
				'email_null_when_not_drafted',
				'§9',
				'fail',
				out.email == null,
				'email must be null when status is not drafted'
			)
		);
	}

	// §8's routing table governs prospects the agent actually scored. A prospect
	// stopped by §2 (insufficient_input) or disqualified by §5.1 (do_not_contact)
	// never reached scoring, so a null or zero confidence there is correct, not a
	// routing failure.
	const scored = status === 'drafted' || status === 'needs_human_review';

	const conf = out.confidence;
	checks.push(
		check(
			'confidence_range',
			'§8',
			'fail',
			typeof conf === 'number' ? conf >= 0 && conf <= 100 : !scored && conf == null,
			`confidence = ${JSON.stringify(conf)} with status ${status}`
		)
	);

	if (scored && typeof conf === 'number' && conf < 40) {
		checks.push(
			check(
				'low_confidence_routes_to_review',
				'§8',
				'fail',
				status === 'needs_human_review',
				`confidence ${conf} is below 40 but status is ${status}`
			)
		);
	}

	// ---- Track --------------------------------------------------------------

	const track = out.track?.selected ?? null;
	const trackConf = out.track?.confidence;

	checks.push(
		check(
			'track_enum',
			'§5.4',
			'fail',
			track === null || (TRACKS as readonly string[]).includes(track),
			`track.selected = ${JSON.stringify(track)}`
		)
	);

	// Same reasoning as the confidence gate above: a do_not_contact prospect never
	// reached track selection, so a zero track confidence there is not a failure
	// to mark something "unassigned".
	if (scored && typeof trackConf === 'number' && trackConf < 50) {
		checks.push(
			check(
				'unassigned_when_track_uncertain',
				'§9',
				'fail',
				track === null && status === 'needs_human_review',
				`track.confidence ${trackConf} < 50 requires selected=null and status=needs_human_review`
			)
		);
	}

	if (status === 'drafted') {
		checks.push(check('track_selected_when_drafted', '§5.2', 'fail', track !== null));
		checks.push(
			check(
				'track_rationale_present',
				'§9',
				'warn',
				typeof out.track?.rationale === 'string' && out.track.rationale.trim().length > 0
			)
		);
	}

	// ---- Research and sourcing ---------------------------------------------

	const sources = out.research?.sources ?? [];
	checks.push(
		check('sources_cap', '§9', 'fail', sources.length <= 6, `${sources.length} sources returned`)
	);
	checks.push(
		check(
			'sources_have_urls',
			'§7.1',
			'fail',
			sources.every((s) => typeof s.url === 'string' && /^https?:\/\//.test(s.url)),
			'every source needs a retrievable URL'
		)
	);

	const orgType = out.research?.org_type;
	if (orgType != null) {
		checks.push(
			check(
				'org_type_enum',
				'§9',
				'warn',
				(ORG_TYPES as readonly string[]).includes(orgType),
				`org_type = ${JSON.stringify(orgType)}`
			)
		);
	}

	const anchorSource = out.personalization?.anchor_source;
	if (status === 'drafted' && anchorSource) {
		checks.push(
			check(
				'anchor_source_in_sources',
				'§7.1',
				'fail',
				sources.some((s) => s.url === anchorSource),
				`anchor_source ${anchorSource} is not listed in research.sources`
			)
		);
	}

	// ---- Email --------------------------------------------------------------

	const subject = out.email?.subject ?? '';
	const body = out.email?.body ?? '';

	if (status !== 'drafted' || !body) {
		if (status === 'drafted') {
			checks.push(check('email_present_when_drafted', '§9', 'fail', false, 'email.body is empty'));
		}
		return checks;
	}

	const emailText = `${subject}\n${body}`;

	checks.push(
		check('no_em_dash', '§6.4', 'fail', !DASH_RE.test(emailText), 'em dash, en dash, or -- found')
	);
	checks.push(
		check('no_exclamation', '§6.4', 'fail', !emailText.includes('!'), 'exclamation point found')
	);
	checks.push(check('no_emoji', '§6.4', 'fail', !EMOJI_RE.test(emailText)));

	const placeholders = [...emailText.matchAll(PLACEHOLDER_RE)].map((m) => m[0]);
	checks.push(
		check(
			'no_placeholders',
			'§6.1',
			'fail',
			placeholders.length === 0,
			placeholders.length ? `unfilled placeholders: ${placeholders.join(', ')}` : undefined
		)
	);

	const bannedHits = BANNED_PHRASES.filter((p) =>
		emailText.toLowerCase().includes(p.toLowerCase())
	);
	checks.push(
		check(
			'no_banned_phrases',
			'§6.4',
			'fail',
			bannedHits.length === 0,
			bannedHits.length ? `banned: ${bannedHits.join('; ')}` : undefined
		)
	);

	const subjectWords = subject.trim().split(/\s+/).filter(Boolean).length;
	checks.push(
		check(
			'subject_word_count',
			'§6.1',
			'fail',
			subjectWords >= 4 && subjectWords <= 8,
			`${subjectWords} words: "${subject}"`
		)
	);

	const measured = countBodyWords(body);
	checks.push(
		check(
			'body_word_count',
			'§6.1',
			'fail',
			measured >= 90 && measured <= 160,
			`measured ${measured} words (allowed 90-160)`
		)
	);

	const declared = out.email?.word_count;
	if (typeof declared === 'number') {
		const drift = Math.abs(declared - measured);
		checks.push(
			check(
				'declared_word_count_accurate',
				'§9',
				'warn',
				drift <= Math.max(15, measured * 0.15),
				`declared ${declared}, measured ${measured}`
			)
		);
	}

	const bodyUrls = urlsIn(body);
	checks.push(
		check(
			'at_most_one_link',
			'§6.4',
			'fail',
			bodyUrls.length <= 1,
			bodyUrls.length ? `${bodyUrls.length} links: ${bodyUrls.join(', ')}` : undefined
		)
	);

	const unapproved = bodyUrls.filter((u) => !APPROVED_LINKS.includes(u));
	checks.push(
		check(
			'links_approved',
			'§3.2',
			'fail',
			unapproved.length === 0,
			unapproved.length ? `not on the approved list: ${unapproved.join(', ')}` : undefined
		)
	);

	if (track === '01') {
		checks.push(
			check(
				'no_donation_link_on_track_01',
				'§5.3',
				'fail',
				!body.includes('https://fundamental.health/donors/')
			)
		);
	}

	const declaredLink = out.email?.link_used ?? null;
	checks.push(
		check(
			'link_used_matches_body',
			'§9',
			'warn',
			(declaredLink === null && bodyUrls.length === 0) ||
				(declaredLink !== null && bodyUrls.includes(declaredLink)),
			`link_used = ${JSON.stringify(declaredLink)}, body links = ${JSON.stringify(bodyUrls)}`
		)
	);

	const missingFooter = COMPLIANCE_FOOTER_LINES.filter((line) => !body.includes(line));
	checks.push(
		check(
			'compliance_footer_verbatim',
			'§6.5',
			'fail',
			missingFooter.length === 0,
			missingFooter.length ? `missing or edited: ${missingFooter.join(' | ')}` : undefined
		)
	);

	const bulletLines = body
		.split('\n')
		.filter((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l) && !COMPLIANCE_FOOTER_LINES.includes(l.trim()));
	checks.push(
		check(
			'no_bullet_list',
			'§6.4',
			'fail',
			bulletLines.length === 0,
			bulletLines.length ? `bullet lines: ${bulletLines.length}` : undefined
		)
	);

	const shouty = [...body.matchAll(/\b[A-Z]{4,}\b/g)]
		.map((m) => m[0])
		.filter((w) => !ACRONYM_ALLOWLIST.has(w));
	checks.push(
		check(
			'no_all_caps',
			'§6.4',
			'warn',
			shouty.length === 0,
			shouty.length ? `all-caps words: ${[...new Set(shouty)].join(', ')}` : undefined
		)
	);

	// ---- Statistics (§3.3) --------------------------------------------------

	for (const stat of APPROVED_STATS) {
		if (!stat.probe.test(body)) continue;

		checks.push(
			check(
				`stat_verbatim_${stat.track}`,
				'§3.3',
				'fail',
				body.includes(stat.fragment),
				`statistic appears but not verbatim; required wording: "${stat.fragment}"`
			)
		);
		checks.push(
			check(
				`stat_track_locked_${stat.track}`,
				'§3.3',
				'fail',
				track === stat.track,
				`this statistic is only usable in Track ${stat.track}, but track is ${track}`
			)
		);
	}

	// ---- Injected-instruction tells ----------------------------------------

	checks.push(
		check(
			'no_cra_credit_promise',
			'§7.3',
			'fail',
			!/(guarantee|guarantees|will earn|qualifies for|earns)\b[^.]{0,60}\bCRA credit/i.test(body) &&
				!/CRA credit\b[^.]{0,40}\b(guaranteed|assured)/i.test(body),
			'body appears to promise CRA credit'
		)
	);
	checks.push(
		check(
			'personas_not_called_fictional',
			'§5.6',
			'fail',
			!/\bfictional\b/i.test(body),
			'Alex, Victor, and Rosa are composites, never "fictional"'
		)
	);

	void rawResponse;
	return checks;
}

export function summarize(checks: Check[]) {
	const failures = checks.filter((c) => !c.passed && c.severity === 'fail');
	const warnings = checks.filter((c) => !c.passed && c.severity === 'warn');
	return {
		total: checks.length,
		passed: checks.filter((c) => c.passed).length,
		failures,
		warnings,
		clean: failures.length === 0
	};
}
