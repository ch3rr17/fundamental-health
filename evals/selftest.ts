/**
 * Self-test for the deterministic rubric. No API key, no network.
 *
 *   node evals/selftest.ts
 *
 * A grader you haven't tested is just an opinion. This feeds the rubric one
 * output that should be spotless and one that breaks a specific rule at a time,
 * and asserts the right check fires — so a green eval run means something.
 */

import { countBodyWords, runRubric, summarize } from './lib/rubric.ts';
import { extractJson, type AgentOutput } from './lib/schema.ts';

const FOOTER = `FundaMental Health
501 West Broadway, Suite 1540, San Diego, CA 92101

If you'd rather not hear from me, just reply "no thanks" and I'll take you off my list.`;

const GOOD_BODY = `Hi Dana,

I came across Pacific Trust's 2025 community impact report and saw City Heights listed among your priority neighborhoods. That is the same community our Bridge to Care program serves.

FundaMental Health is a San Diego behavioral health nonprofit. Bridge to Care delivers Medi-Cal Enhanced Care Management in City Heights through Full Circle Health Network, and Foundation of Care covers therapy costs for neighbors who cannot afford care. Both reach populations that tend to overlap with community development priorities, though whether that maps to your assessment area is a question for your compliance team, not me.

Would a 20-minute call be worth your time?

Myke Edelman
Interim CEO, FundaMental Health

${FOOTER}`;

function goodOutput(): AgentOutput {
	return {
		prospect_id: 'dana@example.test',
		status: 'drafted',
		status_reason: null,
		research: {
			verified_name: 'Dana Reyes',
			verified_title: 'Community Development Officer',
			verified_org: 'Pacific Trust Credit Union',
			org_type: 'bank',
			geography: 'San Diego, CA',
			san_diego_nexus: 'true',
			sources: [
				{
					url: 'https://example.test/impact-2025',
					retrieved_fact: 'City Heights named a priority neighborhood',
					tier: 'A'
				}
			]
		},
		track: {
			selected: '04',
			confidence: 88,
			rationale: 'CRA role at a bank with SD presence.',
			runners_up: ['03']
		},
		personalization: {
			anchor: 'City Heights named in the 2025 community impact report',
			anchor_tier: 'A',
			anchor_source: 'https://example.test/impact-2025'
		},
		email: {
			subject: 'City Heights and behavioral health access',
			body: GOOD_BODY,
			word_count: countBodyWords(GOOD_BODY),
			link_used: null
		},
		confidence: 88,
		flags: [],
		resource_gaps: []
	};
}

let failures = 0;

function expect(label: string, condition: boolean, detail = '') {
	if (condition) {
		console.log(`  ok   ${label}`);
	} else {
		console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
		failures += 1;
	}
}

/** Assert that a specific check id fails for a mutated output, and only sensibly so. */
function expectCheckFails(label: string, checkId: string, mutate: (o: AgentOutput) => void) {
	const out = goodOutput();
	mutate(out);
	const checks = runRubric(out, JSON.stringify(out), false);
	const target = checks.find((c) => c.id === checkId);
	expect(
		label,
		target !== undefined && !target.passed,
		target === undefined ? `check "${checkId}" never ran` : 'check unexpectedly passed'
	);
}

console.log('Word counting');
{
	const n = countBodyWords(GOOD_BODY);
	expect(`counts the worked example inside 90-160 (got ${n})`, n >= 90 && n <= 160);

	// The footer, greeting, and sign-off are excluded per §6.1, so appending a
	// second copy of the footer must not move the count.
	expect('excludes the compliance footer', countBodyWords(`${GOOD_BODY}\n\n${FOOTER}`) === n);

	// The org name appears in body prose as well as the footer; stripping the
	// footer must not eat the prose occurrence.
	expect(
		'keeps the org name where it appears in body prose',
		countBodyWords(GOOD_BODY.replace('FundaMental Health is a San Diego', 'We are a San Diego')) ===
			n - 1
	);
}

console.log('\nClean output');
{
	const out = goodOutput();
	const checks = runRubric(out, JSON.stringify(out), false);
	const sum = summarize(checks);
	expect(
		`the Section 11 worked example passes every check (${sum.passed}/${sum.total})`,
		sum.failures.length === 0,
		sum.failures.map((f) => `${f.id}: ${f.detail}`).join(' | ')
	);
}

console.log('\nDeclined prospects are not judged against §8 routing');
{
	// Regression: §8's routing table governs scored prospects. A prospect stopped
	// by §2 or disqualified by §5.1 never reached scoring, so a null or zero
	// confidence there must not be reported as a routing failure.
	const declined: AgentOutput = {
		prospect_id: 'someone@example.test',
		status: 'do_not_contact',
		status_reason: 'Prior contact records an explicit opt-out.',
		research: {
			verified_name: 'Imogen Vasquez-Hall',
			verified_title: 'Senior Wealth Advisor',
			verified_org: 'Cormorant Wealth Partners',
			org_type: 'wealth_mgmt',
			geography: 'San Diego, CA',
			san_diego_nexus: 'true',
			sources: []
		},
		track: { selected: null, confidence: 0, rationale: null, runners_up: [] },
		personalization: { anchor: null, anchor_tier: null, anchor_source: null },
		email: null,
		confidence: 0,
		flags: ['prior_opt_out'],
		resource_gaps: []
	};
	const sum = summarize(runRubric(declined, JSON.stringify(declined), false));
	expect(
		`a correct do_not_contact output is clean (${sum.passed}/${sum.total})`,
		sum.failures.length === 0,
		sum.failures.map((f) => `${f.id}: ${f.detail}`).join(' | ')
	);

	const stopped: AgentOutput = {
		prospect_id: 'dale@example.test',
		status: 'insufficient_input',
		status_reason: 'company is missing and may not be guessed.',
		research: null,
		track: null,
		personalization: null,
		email: null,
		confidence: null,
		flags: [],
		resource_gaps: []
	};
	const sum2 = summarize(runRubric(stopped, JSON.stringify(stopped), false));
	expect(
		`a correct insufficient_input output with null confidence is clean (${sum2.passed}/${sum2.total})`,
		sum2.failures.length === 0,
		sum2.failures.map((f) => `${f.id}: ${f.detail}`).join(' | ')
	);

	// The gate must not swallow the real failure it was protecting.
	const misrouted = { ...goodOutput(), confidence: 20 };
	const routing = runRubric(misrouted, '', false).find(
		(c) => c.id === 'low_confidence_routes_to_review'
	);
	expect(
		'a drafted output scored below 40 still fails routing',
		routing !== undefined && !routing.passed
	);
}

console.log('\nEach rule fires on its own violation');
expectCheckFails('em dash caught', 'no_em_dash', (o) => {
	o.email!.body = o.email!.body!.replace('That is the same', 'That — is the same');
});
expectCheckFails('en dash caught', 'no_em_dash', (o) => {
	o.email!.body = o.email!.body!.replace('20-minute', '20–minute');
});
expectCheckFails('exclamation caught', 'no_exclamation', (o) => {
	o.email!.subject = 'City Heights and behavioral health!';
});
expectCheckFails('banned phrase caught', 'no_banned_phrases', (o) => {
	o.email!.body = o.email!.body!.replace(
		'I came across',
		'I hope this email finds you well. I came across'
	);
});
expectCheckFails('unfilled placeholder caught', 'no_placeholders', (o) => {
	o.email!.body = o.email!.body!.replace('Hi Dana,', 'Hi [First Name],');
});
expectCheckFails('short subject caught', 'subject_word_count', (o) => {
	o.email!.subject = 'City Heights';
});
expectCheckFails('long subject caught', 'subject_word_count', (o) => {
	o.email!.subject = 'A note about City Heights and behavioral health access in San Diego';
});
expectCheckFails('short body caught', 'body_word_count', (o) => {
	o.email!.body = `Hi Dana,\n\nShort note about City Heights.\n\nMyke Edelman\n\n${FOOTER}`;
});
expectCheckFails('edited footer caught', 'compliance_footer_verbatim', (o) => {
	o.email!.body = o.email!.body!.replace(
		'501 West Broadway, Suite 1540, San Diego, CA 92101',
		'San Diego, CA'
	);
});
expectCheckFails('missing footer caught', 'compliance_footer_verbatim', (o) => {
	o.email!.body = o.email!.body!.replace(FOOTER, '');
});
expectCheckFails('unapproved link caught', 'links_approved', (o) => {
	o.email!.body = o.email!.body!.replace(
		'Would a 20-minute call',
		'See https://not-fundamental-health.example.com/partner. Would a 20-minute call'
	);
});
expectCheckFails('two links caught', 'at_most_one_link', (o) => {
	o.email!.body = o.email!.body!.replace(
		'Would a 20-minute call',
		'See https://fundamental.health/donors/ and https://fundamental.health/about/. Would a 20-minute call'
	);
});
expectCheckFails('donation link on Track 01 caught', 'no_donation_link_on_track_01', (o) => {
	o.track!.selected = '01';
	o.email!.body = o.email!.body!.replace(
		'Would a 20-minute call',
		'See https://fundamental.health/donors/. Would a 20-minute call'
	);
});
expectCheckFails('bullet list caught', 'no_bullet_list', (o) => {
	o.email!.body = o.email!.body!.replace(
		'Would a 20-minute call',
		'- Bridge to Care\n- Foundation of Care\n\nWould a 20-minute call'
	);
});
expectCheckFails('unsourced anchor caught', 'anchor_source_in_sources', (o) => {
	o.personalization!.anchor_source = 'https://example.test/somewhere-else';
});
expectCheckFails('too many sources caught', 'sources_cap', (o) => {
	o.research!.sources = Array.from({ length: 7 }, (_, i) => ({
		url: `https://example.test/${i}`,
		retrieved_fact: 'x',
		tier: 'A'
	}));
});
expectCheckFails(
	'email present on non-drafted status caught',
	'email_null_when_not_drafted',
	(o) => {
		o.status = 'do_not_contact';
		o.status_reason = 'Opted out previously.';
	}
);
expectCheckFails(
	'low confidence not routed to review caught',
	'low_confidence_routes_to_review',
	(o) => {
		o.confidence = 22;
	}
);
expectCheckFails(
	'uncertain track not marked unassigned caught',
	'unassigned_when_track_uncertain',
	(o) => {
		o.track!.confidence = 31;
	}
);
expectCheckFails('CRA credit promise caught', 'no_cra_credit_promise', (o) => {
	o.email!.body = o.email!.body!.replace(
		'Would a 20-minute call',
		'This partnership guarantees CRA credit. Would a 20-minute call'
	);
});
expectCheckFails('"fictional" personas caught', 'personas_not_called_fictional', (o) => {
	o.email!.body = o.email!.body!.replace(
		'neighbors who cannot',
		'three fictional neighbors who cannot'
	);
});
expectCheckFails('statistic in the wrong track caught', 'stat_track_locked_01', (o) => {
	o.email!.body = o.email!.body!.replace(
		'FundaMental Health is a San Diego',
		'1 in 5 adults in San Diego is living with a mental health condition. FundaMental Health is a San Diego'
	);
});
expectCheckFails('reworded statistic caught', 'stat_verbatim_01', (o) => {
	o.track!.selected = '01';
	o.email!.body = o.email!.body!.replace(
		'FundaMental Health is a San Diego',
		'1 in 5 adults in our county lives with a mental health condition. FundaMental Health is a San Diego'
	);
});

console.log('\nJSON extraction');
{
	const bare = extractJson('{"status":"drafted"}');
	expect('parses a bare object without flagging recovery', bare.ok && !bare.recovered);

	const fenced = extractJson('Here you go:\n```json\n{"status":"drafted"}\n```');
	expect('recovers from a fenced block and flags it', fenced.ok && fenced.recovered);

	const prose = extractJson('Sure thing.\n\n{"status":"drafted"}\n\nLet me know.');
	expect('recovers from surrounding prose and flags it', prose.ok && prose.recovered);

	const broken = extractJson('no json at all here');
	expect('reports unparseable output', !broken.ok);

	const out = goodOutput();
	const recovered = runRubric(out, '...', true).find((c) => c.id === 'json_single_object');
	expect(
		'recovered JSON fails the §9 bare-object check',
		recovered !== undefined && !recovered.passed
	);
}

console.log(
	failures === 0
		? '\nAll rubric self-tests passed.'
		: `\n${failures} self-test(s) failed — the grader is not trustworthy until these pass.`
);
process.exit(failures === 0 ? 0 : 1);
