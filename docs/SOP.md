# AI Donor Outreach Agent — SOP / Handoff Guide

Standard operating procedure for the tool built out of [issue #5](https://github.com/ch3rr17/fundamental-health/issues/5) (AI Donor Outreach Agent PRD). This doc has two parts: **Part A** is for FundaMental Health staff who will *use* the tool day to day, **Part B** is for whoever picks up engineering work on it next.

**Status as of 2026-08-02:** actively built, not yet deployed anywhere. Core pipeline (import → segment → draft → review/approve → push to Klaviyo) works end to end locally against a Supabase Postgres instance. 170 tests passing across 18 files. 18 GitHub issues still open — see [Open Issues Snapshot](#open-issues-snapshot).

---

## Part A — Using the tool (staff)

### What it does

The tool takes a list of prospective donors, drafts a personalized outreach email for each using AI, and — once a human approves the draft — pushes them into Klaviyo so the existing email-automation flow can send it. It never sends email itself; "push" only creates/updates the Klaviyo profile and adds them to the right talk-track list (see [`docs/CONTEXT.md`](CONTEXT.md) for the exact vocabulary).

### Who can access it

Sign-in is Google OAuth, gated by an explicit email allowlist (`AUTH_ALLOWED_EMAILS`) — only accounts on that list can sign in at all, regardless of domain. ([Issue #16](https://github.com/ch3rr17/fundamental-health/issues/16) proposed also restricting to the `fundamentalhealth.org` domain generally; check its status before assuming that's live.) To add or remove someone's access today, edit the `AUTH_ALLOWED_EMAILS` env var and redeploy — there's no in-app user management yet.

### The workflow, step by step

1. **Import prospects** — `/import` page. Either upload a CSV export (Apollo's export format is recognized automatically) or pull directly from a configured Apollo list. Both paths run dedup automatically.
2. **Prospects land in one of three buckets** on the `/prospects` page (tabs at the top):
   - **Queue** — ready for drafting/review.
   - **Already contacted** — the app found this person already in Klaviyo or Monday.com (see [gap](#known-gaps--stubs) below on Monday.com). Visible, not silently dropped — you can override and move them back to the queue.
   - **Unassigned** — the app couldn't confidently guess a talk-track segment; pick one manually before a draft can be generated.
3. **Open a prospect's detail page** (`/prospects/:id`) to generate their AI draft, read the subject/body/research summary, and hand-edit anything before sending.
4. **Approve and Send** — this single button both approves the draft and pushes it to Klaviyo in one step. This is the human-in-the-loop gate: nothing reaches Klaviyo without an explicit approve click here.
   - If a prospect's imported data was flagged as a possible prompt-injection attempt (see [#21](https://github.com/ch3rr17/fundamental-health/issues/21), closed), you'll get an extra confirmation prompt — read the draft carefully before overriding it.
5. **After push**, status shows as "pushed" (Klaviyo accepted the API call) or "send-confirmed" (Klaviyo confirmed via its events API — may take a moment; see [ADR-0002](adr/0002-confirmed-send-via-polling.md)). Neither status means the recipient has opened or clicked anything — that's outside this tool's visibility.

### What this tool does *not* do yet

- **No Monday.com tracking item is created on push.** The dedup check against Monday.com is wired up as a no-op stub — see [Known Gaps](#known-gaps--stubs). If your team relies on Monday.com as the source of truth for "who has been contacted," it is not yet in sync with this tool.
- **No in-app way to edit the AI's drafting instructions** (tone, rules, signoff) — that's currently hardcoded in code. [Issue #49](https://github.com/ch3rr17/fundamental-health/issues/49) scopes adding this for a small, named set of trusted editors.

### Who to contact

Route bugs and access requests to whoever is holding the engineering handoff (see Part B). File issues on the [GitHub repo](https://github.com/ch3rr17/fundamental-health/issues) and track them on the [project board](https://github.com/users/phaybein/projects/3/views/1).

---

## Part B — Engineering handoff

### Stack

| Layer | Choice |
|---|---|
| Framework | SvelteKit 2 + Svelte 5 (runes mode forced repo-wide, see `vite.config.ts`) |
| Styling | Tailwind CSS v4 |
| DB | Postgres (Supabase-hosted in `.env.example`'s example `DATABASE_URL`) via Drizzle ORM |
| Auth | Auth.js (`@auth/sveltekit`) — Google OAuth provider, email allowlist gate |
| AI drafting | Anthropic Claude (`@anthropic-ai/sdk`) |
| Prospect source | Apollo.io API (list pull) or CSV upload |
| Outbound | Klaviyo API (profile create + list add + send-confirmation polling) |
| Tracking (planned, not built) | Monday.com |
| Package manager | pnpm |
| Deployment adapter | `@sveltejs/adapter-auto`, configured inline in `vite.config.ts` (no separate `svelte.config.js` in this repo) |

### Repo map

```
src/
  auth.ts                  Auth.js config, Google provider, ALLOWED_EMAILS gate
  hooks.server.ts          Wires Auth.js handle into SvelteKit
  lib/
    segments.ts            Talk-track segment definitions
    server/
      draft.ts             buildSystemPrompt() + generateDraft() — the AI drafting core
      dedup.ts              Klaviyo + Monday.com (stub) dedup checks
      segment.ts            Auto-assigns a talk-track segment + confidence to a prospect
      ingest.ts              CSV parsing + import
      apollo.ts              Apollo.io API client
      klaviyo.ts              Klaviyo push + pollSendConfirmation
      talk-tracks.ts          Messaging content per segment
      auth-guard.ts           requireAuth / requireAuthSession — 401 guard used by every API route
      schema.ts               Drizzle schema: prospects, draft_emails
      queries.ts, needs-review.ts, require-session.ts
  routes/
    +page.svelte             Home / dashboard
    import/                  CSV upload + Apollo pull UI
    prospects/                List page (queue / already-contacted / unassigned tabs)
    prospects/[id]/            Detail page — draft, edit, approve & push
    signin/, error/           Auth pages
    api/
      apollo/, prospects/, drafts/, review-queue/    REST endpoints, see docs/api-reference.md
```

`docs/api-reference.md` documents every API route and the full pipeline status-flow contract — read that before touching any route.

### Environment variables

Full list with comments lives in `.env.example` (git-tracked, no real secrets in it — do not add real values to a tracked file). Summary:

- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_TRUST_HOST`, `AUTH_ALLOWED_EMAILS`
- `DATABASE_URL` (Postgres/Supabase)
- `ANTHROPIC_API_KEY`
- `APOLLO_KEY` (optional — only needed for the Apollo pull path, not CSV import)
- `KLAVIYO_API_KEY`, `KLAVIYO_SENT_METRIC_ID`, and one `KLAVIYO_LIST_*` var per talk-track segment
- Monday.com: **no env var exists yet** — `checkMonday()` in `dedup.ts` is a hardcoded no-op pending an API token ("TODO: Wire up when Monday.com API token is available").

Whoever owns credential rotation/handoff should transfer: the Google Cloud OAuth client, the Supabase project, the Anthropic API key, the Apollo.io API key, and the Klaviyo API key + list IDs. [Issue #6](https://github.com/ch3rr17/fundamental-health/issues/6) ("Provision demo credentials, Klaviyo lists, and vendor config") is the tracked, still-open issue for getting this onto real (non-demo) vendor accounts.

### Local dev setup

```sh
pnpm install
cp .env.example .env      # fill in real values, never commit this file
pnpm db:push               # push Drizzle schema to DATABASE_URL
pnpm dev                   # http://localhost:5173
```

Other useful commands: `pnpm test` (vitest, 170 tests), `pnpm lint`, `pnpm check` (svelte-check), `pnpm db:studio` (Drizzle Studio DB browser).

### Deployment status — not yet deployed

There is no hosting target chosen and no CI/CD configured. `adapter-auto` will pick an adapter automatically based on the deploy environment (Vercel/Netlify/Cloudflare/Node), but nobody has run a production build against a real target yet. Before this goes live to real donor data:

- Pick and pin an explicit adapter rather than relying on `adapter-auto`'s guess.
- Set up a real (non-demo) Supabase/Postgres instance, separate from whatever was used for local dev.
- Resolve [#6](https://github.com/ch3rr17/fundamental-health/issues/6) (vendor credentials) and confirm [#16](https://github.com/ch3rr17/fundamental-health/issues/16) (domain-restricted login) before any non-hackathon-team person gets a URL.

### Known gaps / stubs

- **Monday.com integration is entirely stubbed.** `checkMonday()` in `src/lib/server/dedup.ts` always returns "no match." [Issue #15](https://github.com/ch3rr17/fundamental-health/issues/15) (create tracking item on push) is open and unstarted. Until this is built, "already-contacted" dedup only checks Klaviyo, not Monday.com, despite what the UI/docs imply.
- **`pollSendConfirmation` blocks the push request synchronously** ([#23](https://github.com/ch3rr17/fundamental-health/issues/23), open) — it's implemented in `klaviyo.ts` and does work, but runs inline in the request instead of async, so a slow Klaviyo response stalls the push API call.
- **Two issues may already be resolved in code but are still open on the tracker** — worth a quick verify-and-close pass before assuming they're unstarted work:
  - [#20](https://github.com/ch3rr17/fundamental-health/issues/20) "No authentication on prospect/draft API routes" — every route under `src/routes/api/` currently calls `requireAuth`/`requireAuthSession` (`auth-guard.ts`). Looks fixed; issue wasn't linked/closed when the fix landed.
  - [#14](https://github.com/ch3rr17/fundamental-health/issues/14) "Confirm send via Klaviyo Events API polling" — `pollSendConfirmation()` exists and is wired in per ADR-0002. May just need the issue closed, or there's a narrower remaining scope worth re-reading.
- **No in-app prompt editing** — see [#49](https://github.com/ch3rr17/fundamental-health/issues/49), scoped but not built.

### Open issues snapshot (as of 2026-08-02, 18 open)

Full up-to-date list: `gh issue list --state open` or the [project board](https://github.com/users/phaybein/projects/3/views/1).

**`ready-for-agent`** (fully specified, safe to hand to an AFK coding agent as-is): #7, #8, #9, #10, #11, #12, #13, #14, #15, #16, #38.

**`needs-human-input`** (a person must decide something first): #6 (vendor credentials), #49 (prompt-editor allowlist design).

**Unlabeled** (triage first): #5 (PRD epic, stays open as the umbrella), #20, #23, #24, #33.

### Docs map

- [`docs/CONTEXT.md`](CONTEXT.md) — domain vocabulary (prospect, talk-track, push, already-contacted bucket).
- [`docs/agent-plans/ai-donor-outreach-agent-prd.md`](agent-plans/ai-donor-outreach-agent-prd.md) — the scope-of-record PRD (16 user stories).
- [`docs/api-reference.md`](api-reference.md) — every API route, request/response shape, and the pipeline status-flow.
- [`docs/adr/`](adr/) — architecture decisions (why Monday.com sync gates on Klaviyo API success not confirmed send; why confirmed-send uses polling not webhooks).
- [`docs/design.md`](design.md) — color palette / brand tokens.
- [`docs/hackathon-helper-guide.txt`](hackathon-helper-guide.txt) — org background (mission, care models, quick facts) for anyone new to FundaMental Health.

### Handoff checklist

- [ ] Transfer vendor credentials (Google Cloud OAuth client, Supabase project, Anthropic, Apollo.io, Klaviyo) to the incoming owner.
- [ ] Verify and close #20 and #14 if the code already covers them, or narrow their scope if not.
- [ ] Decide a deployment target and pin an explicit adapter (currently `adapter-auto`, unproven against any real host).
- [ ] Resolve #6 (real vendor accounts, not demo) before any non-team person gets a live URL.
- [ ] Decide Monday.com's priority — #15 is unstarted and the "already-contacted" dedup is silently incomplete without it.
- [ ] Confirm who is on `AUTH_ALLOWED_EMAILS` going forward and who owns updating it.
