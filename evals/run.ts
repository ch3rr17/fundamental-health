/**
 * Eval runner for the prospect email agent.
 *
 *   node evals/run.ts                    # full set, research on, judge on
 *   node evals/run.ts --case g08         # one case (prefix match)
 *   node evals/run.ts --no-judge         # deterministic rubric only, no judge calls
 *   node evals/run.ts --no-research      # no web tools; guardrail cases only, faster
 *   node evals/run.ts --concurrency 2
 *
 * Exit code is 1 if any case has a rubric failure, a judge fail, or an
 * expectation mismatch, so it can gate a branch.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { draftForProspect } from './lib/draft.ts';
import { judgeDraft, type Verdict } from './lib/judge.ts';
import { runRubric, summarize, type Check } from './lib/rubric.ts';
import { DRAFT_MODEL, JUDGE_MODEL } from './lib/client.ts';

interface GoldenCase {
	id: string;
	real: boolean;
	exercises: string;
	input: Record<string, unknown>;
	expect: {
		required_status?: string;
		allowed_statuses?: string[];
		required_track?: string | null;
		allowed_tracks?: string[];
		preferred_track?: string;
		must_flag?: string[];
		must_mention_in_status_reason?: string[];
		notes?: string;
	};
}

interface CaseResult {
	id: string;
	exercises: string;
	status: string | null;
	track: string | null;
	confidence: number | null;
	expectationErrors: string[];
	checks: Check[];
	verdicts: Verdict[];
	judgeNote: string;
	judgeError?: string;
	runError?: string;
	usage: { input: number; output: number };
	raw: string;
}

function arg(name: string, fallback?: string): string | undefined {
	const i = process.argv.indexOf(`--${name}`);
	if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
		return process.argv[i + 1];
	}
	return fallback;
}

const flag = (name: string) => process.argv.includes(`--${name}`);

function checkExpectations(
	c: GoldenCase,
	status: string | null,
	track: string | null,
	flags: string[],
	statusReason: string
): string[] {
	const errs: string[] = [];
	const e = c.expect;

	if (e.required_status && status !== e.required_status) {
		errs.push(`status: expected ${e.required_status}, got ${status}`);
	}
	if (e.allowed_statuses && status && !e.allowed_statuses.includes(status)) {
		errs.push(`status: expected one of [${e.allowed_statuses.join(', ')}], got ${status}`);
	}
	if ('required_track' in e && track !== (e.required_track ?? null)) {
		errs.push(
			`track: expected ${JSON.stringify(e.required_track ?? null)}, got ${JSON.stringify(track)}`
		);
	}
	if (e.allowed_tracks && track && !e.allowed_tracks.includes(track)) {
		errs.push(`track: expected one of [${e.allowed_tracks.join(', ')}], got ${track}`);
	}
	for (const f of e.must_flag ?? []) {
		if (!flags.some((x) => x.toLowerCase().includes(f.toLowerCase()))) {
			errs.push(`flags: expected one containing "${f}", got [${flags.join(', ')}]`);
		}
	}
	for (const needle of e.must_mention_in_status_reason ?? []) {
		if (!statusReason.toLowerCase().includes(needle.toLowerCase())) {
			errs.push(`status_reason: expected to mention "${needle}", got "${statusReason}"`);
		}
	}
	return errs;
}

async function runCase(
	c: GoldenCase,
	opts: { research: boolean; judge: boolean }
): Promise<CaseResult> {
	const base: CaseResult = {
		id: c.id,
		exercises: c.exercises,
		status: null,
		track: null,
		confidence: null,
		expectationErrors: [],
		checks: [],
		verdicts: [],
		judgeNote: '',
		usage: { input: 0, output: 0 },
		raw: ''
	};

	let draft;
	try {
		draft = await draftForProspect(c.input, { research: opts.research });
	} catch (err) {
		return { ...base, runError: err instanceof Error ? err.message : String(err) };
	}

	const out = draft.output;
	const status = out?.status ?? null;
	const track = out?.track?.selected ?? null;
	const flags = out?.flags ?? [];
	const statusReason = out?.status_reason ?? '';

	const result: CaseResult = {
		...base,
		status,
		track,
		confidence: out?.confidence ?? null,
		checks: runRubric(out, draft.raw, draft.jsonRecovered),
		expectationErrors: checkExpectations(c, status, track, flags, statusReason),
		usage: draft.model.usage,
		raw: draft.raw
	};

	if (draft.model.refused) {
		result.runError = `model refused (category: ${draft.model.refusalCategory ?? 'unknown'})`;
		return result;
	}

	if (opts.judge) {
		const judged = await judgeDraft(c.input, draft.raw);
		result.verdicts = judged.verdicts;
		result.judgeNote = judged.overallNote;
		result.judgeError = judged.error;
	}

	return result;
}

/** Run tasks with a bounded number in flight, preserving input order in the output. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	const results = new Array<R>(items.length);
	let next = 0;
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (next < items.length) {
			const i = next++;
			results[i] = await fn(items[i]);
		}
	});
	await Promise.all(workers);
	return results;
}

function renderReport(results: CaseResult[], opts: { research: boolean; judge: boolean }): string {
	const lines: string[] = [];
	const isBad = (r: CaseResult) =>
		r.runError ||
		r.expectationErrors.length > 0 ||
		summarize(r.checks).failures.length > 0 ||
		r.verdicts.some((v) => v.verdict === 'fail');

	const failed = results.filter(isBad);
	const totalIn = results.reduce((a, r) => a + r.usage.input, 0);
	const totalOut = results.reduce((a, r) => a + r.usage.output, 0);

	lines.push('# Prospect email agent — eval report');
	lines.push('');
	lines.push(
		`- Cases: ${results.length}, clean: ${results.length - failed.length}, needing attention: ${failed.length}`
	);
	lines.push(
		`- Draft model: \`${DRAFT_MODEL}\`${opts.judge ? `, judge model: \`${JUDGE_MODEL}\`` : ', judge: skipped'}`
	);
	lines.push(`- Web research: ${opts.research ? 'on' : 'off'}`);
	lines.push(`- Drafting tokens: ${totalIn.toLocaleString()} in, ${totalOut.toLocaleString()} out`);
	lines.push('');

	for (const r of results) {
		const sum = summarize(r.checks);
		const judgeFails = r.verdicts.filter((v) => v.verdict === 'fail');
		const judgeUnclear = r.verdicts.filter((v) => v.verdict === 'unclear');
		const mark = isBad(r) ? 'FAIL' : 'ok';

		lines.push(`## ${mark} — ${r.id}`);
		lines.push('');
		lines.push(`_${r.exercises}_`);
		lines.push('');
		lines.push(
			`status \`${r.status}\` · track \`${r.track}\` · confidence \`${r.confidence}\` · rubric ${sum.passed}/${sum.total}`
		);
		lines.push('');

		if (r.runError) lines.push(`- **run error:** ${r.runError}`);
		for (const e of r.expectationErrors) lines.push(`- **expectation:** ${e}`);
		for (const c of sum.failures)
			lines.push(`- **rubric ${c.section} ${c.id}:** ${c.detail ?? 'failed'}`);
		for (const v of judgeFails) lines.push(`- **judge ${v.id}:** ${v.evidence}`);
		for (const c of sum.warnings)
			lines.push(`- _warn ${c.section} ${c.id}:_ ${c.detail ?? 'failed'}`);
		for (const v of judgeUnclear) lines.push(`- _judge unclear ${v.id}:_ ${v.evidence}`);
		if (r.judgeError) lines.push(`- _judge error:_ ${r.judgeError}`);
		if (r.judgeNote) lines.push(`- _judge note:_ ${r.judgeNote}`);
		if (!r.runError && !r.expectationErrors.length && !sum.failures.length && !judgeFails.length) {
			lines.push('- no failures');
		}
		lines.push('');
	}

	return lines.join('\n');
}

async function main() {
	const research = !flag('no-research');
	const judge = !flag('no-judge');
	const concurrency = Number(arg('concurrency', '3'));
	const only = arg('case');

	const setPath = fileURLToPath(new URL('./golden-set.json', import.meta.url));
	const golden = JSON.parse(await readFile(setPath, 'utf8')) as { cases: GoldenCase[] };

	const cases = only ? golden.cases.filter((c) => c.id.startsWith(only)) : golden.cases;
	if (cases.length === 0) {
		console.error(`No cases matched --case ${only}`);
		process.exit(2);
	}

	console.log(
		`Running ${cases.length} case(s) against ${DRAFT_MODEL} (research: ${research}, judge: ${judge})\n`
	);

	let done = 0;
	const results = await pool(cases, concurrency, async (c) => {
		const r = await runCase(c, { research, judge });
		done += 1;
		const sum = summarize(r.checks);
		const bad =
			r.runError ||
			r.expectationErrors.length ||
			sum.failures.length ||
			r.verdicts.some((v) => v.verdict === 'fail');
		console.log(
			`  [${done}/${cases.length}] ${bad ? 'FAIL' : 'ok  '} ${c.id} — status ${r.status}, track ${r.track}`
		);
		return r;
	});

	const report = renderReport(results, { research, judge });
	const stamp = arg('out') ?? `evals/results/${process.env.EVAL_RUN_ID ?? 'latest'}`;
	await mkdir(fileURLToPath(new URL('./results', import.meta.url)), { recursive: true });
	await writeFile(`${stamp}.md`, report, 'utf8');
	await writeFile(`${stamp}.json`, JSON.stringify(results, null, 2), 'utf8');

	console.log(`\n${report}`);
	console.log(`Written to ${stamp}.md and ${stamp}.json`);

	const anyBad = results.some(
		(r) =>
			r.runError ||
			r.expectationErrors.length > 0 ||
			summarize(r.checks).failures.length > 0 ||
			r.verdicts.some((v) => v.verdict === 'fail')
	);
	process.exit(anyBad ? 1 : 0);
}

main().catch((err) => {
	console.error(err);
	process.exit(2);
});
