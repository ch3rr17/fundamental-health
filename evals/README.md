# Prospect email agent — eval harness

Grades the output of `src/lib/server/agent/prompts/prospect-email-agent.md` against
that prompt's own Section 10 self-check, using a golden set of prospects with
known-correct outcomes.

The prompt's Section 10 is already the right rubric. What it lacks is a grader
that isn't the same model that just wrote the draft. That is what this is.

```bash
pnpm eval:selftest        # tests the grader itself — no API key, no network
pnpm eval                 # full set: research on, judge on
pnpm eval:fast            # deterministic rubric only, no web tools, no judge
pnpm eval:critic          # review the prompt itself against the PRD and CONTEXT.md
node evals/run.ts --case g08          # one case, prefix match
node evals/run.ts --concurrency 5
```

Everything except `eval:selftest` needs `ANTHROPIC_API_KEY` in the environment,
or an `ant auth login` profile. Exit code is 1 when anything fails, so any of
these can gate a branch.

Start with `pnpm eval:selftest`. A grader you haven't tested is just an opinion:
it feeds the rubric one clean output and then breaks one rule at a time,
asserting the matching check fires. It also confirms the prompt's own Section 11
worked example scores a clean 26/26, which is a useful signal that the rubric and
the prompt still agree.

## How grading works

Two layers, deliberately separated.

**Deterministic first** (`lib/rubric.ts`). Roughly two thirds of Section 10 is
countable: em dashes, banned phrases, subject and body word counts, link
allowlist, footer verbatim, unfilled placeholders, statistic-to-track locking,
`anchor_source` appearing in `research.sources`, `email` being null when the
status isn't `drafted`. These are exact, free, and never flaky. No model is
asked to judge any of them, because a model would sometimes get them wrong and
always cost a call.

**Judgement second** (`lib/judge.ts`). What's left genuinely needs a reader:
does every claim trace to a source, could this personalization line go to a
hundred people, does this sound like a person. A separate model instance grades
these. It sees the specification, the prospect record, and the output — but
never the golden set's expected outcome, so it can't pattern-match its way to
agreement. Every verdict must carry a quote. Verdicts are `pass` / `fail` /
`unclear` / `not_applicable`; `unclear` is reported but doesn't fail the run,
because a judge that can't tell is a signal to a human, not a defect in the
draft.

**Expectations** are checked separately from both (`run.ts`). A case can pass
every rubric check and still fail because it drafted an email for someone who
should have been routed to `do_not_contact`.

## The golden set

`golden-set.json`, 15 cases. Coverage is deliberately weighted toward the paths
that fail silently rather than the happy path:

| Path                 | Cases                   |
| -------------------- | ----------------------- |
| Drafts a real email  | g01, g02, g03, g04, g15 |
| `insufficient_input` | g05, g06                |
| `do_not_contact`     | g07, g10, g13           |
| `needs_human_review` | g09, g11, g12, g14      |
| Prompt injection     | g08                     |

The happy path is the one a human notices when it breaks. The refusal paths are
the ones that quietly stop working after a prompt edit, which is why there are
nine of them.

Two cases carry more weight than the rest. **g11** gives the agent a person and
an organization that do not exist; anything other than a refusal to draft is a
hallucination, and it is the single most important case in the set. **g08**
puts an injection payload in `prior_contact` rather than in retrieved web
content — the field a well-meaning intern types into, which is a likelier
attack surface than a booby-trapped web page.

Cases marked `"real": true` use individuals already sourced in
`docs/supporters/fixtures/`. Everyone marked `"real": false` is invented for a
guardrail path and must never be treated as a prospect. Nothing is ever sent:
the harness drafts, grades, and discards.

## Known issue this harness will surface immediately

`§9` asks for a bare JSON object and nothing else. With web research enabled the
model will often narrate before emitting it, which trips the `json_single_object`
check. That check is a `fail` on purpose, but the fix is not more prompt
language — it's enforcing the output shape at the runtime layer with structured
outputs or a tool call, the way `lib/judge.ts` already does for its own verdicts.
Treat a run full of `json_single_object` failures as a note about the drafting
call, not about the prompt.

## Open question for the team

`§5.2` evaluates Track 03 (board recruitment) first, and its bar is "VP level and
above" plus one governance signal. A bank CEO, a wealth-management partner, and
a foundation program officer can all clear that bar, which means Track 03 may
swallow prospects intended for Tracks 04 and 05. Cases g01, g02, and g15 accept
either track and grade the rationale instead of forcing an answer, because
whether that ordering is intended is Myke's call, not the harness's.

## Files

| File              | What it is                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `golden-set.json` | Prospects and expected outcomes                                                                                    |
| `lib/schema.ts`   | The Section 9 contract as data: statuses, tracks, approved links, approved statistics, footer text, banned phrases |
| `lib/rubric.ts`   | Deterministic Section 10 checks                                                                                    |
| `lib/draft.ts`    | Runs the drafting agent with the prompt file verbatim as the system prompt                                         |
| `lib/judge.ts`    | The grader model and its criteria                                                                                  |
| `lib/client.ts`   | SDK wrapper: refusal handling, server-side fallbacks with graceful degradation                                     |
| `run.ts`          | Orchestrator and report                                                                                            |
| `selftest.ts`     | Tests the rubric against known-good and known-bad output. No API key needed                                        |
| `critic.ts`       | Reviews the prompt against the PRD, CONTEXT.md, and the legacy talk tracks                                         |

Reports land in `evals/results/` (gitignored). Run with `EVAL_RUN_ID=2026-08-01`
to keep them side by side instead of overwriting `latest`.

Model selection is `claude-opus-5` for both drafting and judging; override with
`EVAL_DRAFT_MODEL` / `EVAL_JUDGE_MODEL`. Server-side refusal fallbacks are on by
default and the harness disables them automatically if the account doesn't have
that beta, so a missing beta degrades rather than breaks. Set
`EVAL_DISABLE_FALLBACKS=1` to skip them outright.

## When to re-run

- Any edit to the prompt. `pnpm eval` before merging.
- Any edit to the PRD, `CONTEXT.md`, or the fixtures. `pnpm eval:critic` catches
  drift between the prompt and the documents that govern it.
- Before the demo, once, with research on.
