---
status: draft
stage: grilled
source: engineering-interview-me
---

# AI Donor Outreach Agent

## Original Ask

We're finding new supporters for FundaMental Health. Apollo generates the segmented prospect list (5 talk-track segments), and Klaviyo runs the touchpoints/sequences after that. The team needs a system an intern can run to bridge the two: research each Apollo-generated prospect and personalize outreach before it goes into Klaviyo. Live API integration with both Apollo and Klaviyo is required for the hackathon demo, and the team is standing up demo/test accounts for both.

## Confirmed Intent

- **Outcome**: A local web app for the AI Donor Outreach Agent: pulls the Apollo-generated, segmented prospect list via live API (with a CSV-import fallback — see Resolved Decisions), has AI research each prospect and draft a personalized talk-track-matched email, puts it in an intern review queue for edit/approve, then pushes the approved contact/draft into Klaviyo via live API to run the touchpoint sequence, and on a successful Klaviyo push logs the prospect into an existing Monday.com tracking board.
- **User / actor**: Development Associate / Fundraising Intern (primary); Director of Development, Executive Director, Major Gifts Officer (secondary).
- **Problem**: Someone currently has to manually research each Apollo-generated prospect and hand-pick/personalize the right talk track before anything goes into Klaviyo -- that manual step is the bottleneck this removes.
- **Why now**: AI Trailblazer San Diego hackathon (2026-08-01) -- judging rewards real shipped artifacts and real outreach in motion, not a spec document.
- **Success**: A live demo where a judge watches the app pull a handful of real prospects (2-3+, not the full ~50) from Apollo (or the CSV fallback), generate research + a draft, get approved, land as a real contact/touchpoint in Klaviyo, and appear as a tracked item in Monday.com -- a working closed loop across all three platforms. Prospects already contacted (per Klaviyo/Monday.com dedup check) are visibly separated out, not silently reprocessed.
- **Constraint**: Must use live Apollo + Klaviyo + Monday.com API integration (not manual/CSV handoff for the primary path) against demo/test accounts. Risk profile per platform:
  - **Apollo**: real risk. Advanced API access appears gated to the Organization tier ($119/mo, 3-seat minimum) on some sources, and exports consume credits (Free tier only 10/month) -- a Free Apollo account is likely to block the live-pull half of the integration. Mitigated by the CSV-import fallback (see Resolved Decisions).
  - **Klaviyo**: low risk for profile/list writes (private API key auth, no plan-tier gating found). Real-time webhooks for send confirmation are gated to Advanced KDP/partner tiers and unavailable on a demo account -- confirmed-send is achieved instead via Events API polling, which requires identifying the correct metric ID on the live demo account before build (blocking prerequisite) -- see [[docs/adr/0002-confirmed-send-via-polling]].
  - **Monday.com**: low risk, with one open item. Personal API token auth, GraphQL API, most sources say API access is included on the Free plan; one unconfirmed ambiguity (does "no automations/integrations" on the free tier affect the raw developer API?) needs a 2-minute live test before build -- see Open Questions.
- **Out of scope**: Auto-send without approval, follow-up sequences, phone calls, donation negotiation, advanced CRM automation, grant-proposal generation (separate Grant Scoping Tool track). See also `## Out of Scope` below for items excluded during grilling.

## Current System Understanding

- **No existing app/repo yet.** This is a greenfield build for the hackathon; there is no code to reference, only planning docs and research notes.
- **The current real-world process is entirely manual.** `docs/supporters/Apollo_Donor Talk Tracks.txt` (talk-track content + an "Email Segment Tracker") shows staff (Amelia Motyka, Sriya Amati) manually sending emails per segment today. Klaviyo and Monday.com are not yet part of this pipeline in practice -- they're the target-state platforms this build wires together for the first time.
- **Talk tracks were originally designed to be pasted into Apollo's own AI email sequencing** as "context blocks" so Apollo could personalize subject lines/openers/CTAs itself. This build supersedes that: talk tracks live only in the app, and Apollo's own AI sequencing must be switched off for these prospects (see Resolved Decisions) to avoid duplicate outreach to the same prospect.
- **Klaviyo API** (confirmed via direct doc research): private API key auth (`Authorization: Klaviyo-API-Key`). Profile create/update: `POST /api/profiles` -> `201 Created`. List add: `POST /api/lists/{id}/relationships/profiles` -> `204 No Content`. No plan-tier gating found for these calls. No partial-failure ambiguity for single-record writes (that only exists on the bulk-import path, which doesn't apply here). Real-time send/delivery confirmation via webhooks (delivered/opened/clicked events) is restricted to Advanced KDP customers and Klaviyo app partners -- not available on a demo account. Confirmed send is achieved instead via polling `GET /api/events` for a "sent"/"received" metric on the profile (available on standard plans, no gating found), at the cost of real latency and needing the metric ID identified on the live account beforehand -- see [[docs/adr/0002-confirmed-send-via-polling]].
- **Apollo API**: `x-api-key` header auth, key created in Settings > Integrations. Sources conflict on Free-tier API access; "advanced API access" is explicitly an Organization-tier feature; exports consume credits (Free tier = 10/month). Apollo's data model does not tag prospects with a talk-track segment -- that's a FundaMental Health-specific category the app must assign itself.
- **Monday.com API**: personal API token auth (Avatar > Administration > Connections), GraphQL at `api.monday.com/v2`. Composio ships pre-built Monday actions (`MONDAY_CREATE_ITEM`, `MONDAY_ADD_USERS_TO_BOARD`, etc.) but no real credentials exist locally. Rate limit ~10,000 complexity points/minute (~160 item-creates/minute in practice) -- a non-issue at demo volume. Most sources say the Free plan (2 seats, 3 boards) includes API access; the "no automations/integrations" language on free-tier pages likely refers to Monday's no-code integration recipes, not the raw developer API, but this wasn't confirmed from an authoritative source.
- **No real credentials found locally for any of the three platforms.** Only generic Composio app-catalog cache stubs (`~/.composio/apps/APOLLO`, `~/.composio/apps/KLAVIYO`, `~/.composio/apps/MONDAY`) -- registry metadata, not auth tokens. The `composio` CLI itself isn't installed.
- **123 real, sourced (non-fabricated) sample prospects** across all 5 talk-track segments now live at `docs/supporters/fixtures/segment-0{1-5}-*.md` (moved this session from an ephemeral session-scratch directory that wasn't guaranteed to persist). These are the seed data for the CSV-import fallback.

## Resolved Decisions

- **CSV-import is a first-class fallback, not an afterthought.** Built into the architecture from day one alongside live Apollo pull, seeded by the 123-prospect fixtures. Rejected: treating live Apollo API as a hard blocker with no fallback -- the Organization-tier cost/timing risk is real enough this close to the demo that a purely external blocker (a paid-tier signup) shouldn't be able to sink the whole demo.
- **Segment assignment is an explicit app-side step.** Confirmed Apollo does not tag prospects with a talk-track segment. The app must assign it (rule-based and/or AI-inferred with a confidence indicator), with an "unassigned -- needs manual tag" fallback state visible in the review queue. This also survives the CSV path, since a CSV export won't carry a segment tag either.
- **Apollo's own built-in AI email sequencing is switched off for these prospects.** Talk tracks live only inside the app. Rejected: leaving Apollo's sequencing on in parallel -- risks duplicate/conflicting outreach to the same prospect from two systems, undermining the "closed loop" demo story.
- **Integration approach: direct REST/GraphQL calls to Apollo, Klaviyo, and Monday.com.** Rejected: Composio's pre-built actions -- despite having all three apps in the local Composio catalog, going through Composio would add its own CLI install + auth-connection setup on top of native credentials, with no benefit at just three well-documented platforms.
- **Klaviyo push = profile create/update + add to a talk-track-specific list** (5 lists, one per talk track), relying on Klaviyo's native list-triggered flow automation rather than the app explicitly triggering a flow by ID. Rejected: explicit per-talk-track flow-ID triggering -- adds a 5-flow-ID mapping/testing step under time pressure with no functional benefit over list-triggered automation, which is Klaviyo's standard pattern.
- **Monday.com sync is a required live-demo integration**, not a stretch goal, and gates on **confirmed send from Klaviyo**, not just the push API calls succeeding. Real-time webhooks aren't available on a demo account, so confirmation is via polling `GET /api/events` for the send/received metric, with a bounded timeout (e.g. 30-60s) and a clear fallback UI state if it times out ("pushed, send unconfirmed -- check Klaviyo"). This supersedes the original API-call-success-only gate -- see [[docs/adr/0001-monday-sync-gates-on-klaviyo-api-success]] (superseded) and [[docs/adr/0002-confirmed-send-via-polling]] (current). Item is created on the team's existing Monday.com board (board ID + column mapping still needed -- see Open Questions).
- **Human-in-the-loop review stays hard-required for the hackathon build, but is intentionally designed as a single, clean approval checkpoint** (e.g. one `draft.approved == true` gate before the Klaviyo-push function runs) rather than baked deep into business logic -- so that toggling it off later (letting AI push without intern approval) doesn't require re-architecting. The toggle itself is not built now; this is scope for a future release once the team decides to flip it. Resolves the "why intern review" open question: it's not being revisited now, it's deliberately deferred with the door left open.
- **Duplicate-contact check against both Klaviyo and Monday.com, matched on email address** (name+org as a weaker fallback when email is missing). Runs at import time -- before AI research/drafting starts, to avoid spending AI research effort on someone who shouldn't be re-approached -- and again as a cheap final guard immediately before the Klaviyo push, to catch races (e.g. two people running the app, or a prospect processed in a prior session). On a match, the prospect is routed to a visible "already contacted" bucket (showing prior contact date/talk-track pulled from Klaviyo/Monday.com) rather than the main review queue or a silent drop -- the intern can still consciously override and re-approach. Default behavior is skip, not "ask every time."
- **AI Behavior Spec carried forward as a build requirement** (originally captured in Discovery Notes from the team's existing informal PRD, confirmed as still governing regardless of the PRD document's own authority): human-in-the-loop required before any Klaviyo push, no fabrication (omit rather than speculate), confidence indicators on research findings, approved-sources-only (Apollo prospect records, public professional profiles, org websites, public news/nonprofit affiliations).

## Terminology Touched

- [[CONTEXT.md]] created this session (no context file existed before). Defines: Prospect, Talk-track segment, Talk track, Review queue, Push (to Klaviyo) -- the core vocabulary clarified during grilling, including the app-vs-Apollo distinction for where talk tracks live and the push-vs-send distinction for Klaviyo.

## ADRs Created

- [[docs/adr/0001-monday-sync-gates-on-klaviyo-api-success]] -- (superseded) originally gated Monday.com item creation on the Klaviyo API call succeeding alone, since real send-confirmation appeared blocked by webhook tier gating on demo accounts.
- [[docs/adr/0002-confirmed-send-via-polling]] -- current approach: confirmed-send verification via polling the Events API (webhooks unavailable on demo tier), with a bounded timeout and fallback UI state. Requires identifying the live account's "sent" metric ID before build.

## Open Questions

- **Monday.com board identity.** Team confirmed an existing board will be used, but the specific board ID and its column schema (name/org/segment/status mapping) aren't captured yet. Needs a quick board-columns lookup once real Monday.com credentials exist, before the write step can be built correctly.
- **Klaviyo "sent"/"received" metric ID.** Needed for the Events API polling in ADR-0002. Requires live access to the demo Klaviyo account to identify before build -- blocking prerequisite, not just a nice-to-have.
- **Monday.com free-tier API gating ambiguity.** Whether "no automations/integrations" on the free plan affects the raw developer API (vs. just Monday's no-code integration recipes) wasn't confirmed from an authoritative source. Resolve with a 2-minute live test: generate a personal API token and fire one test `create_item` mutation.
- **Review-queue UI shape** -- single list view vs. per-prospect detail view, inline edit vs. regenerate button, keyboard shortcuts for speed. Not yet specified by the team; low risk to defer to `to-prd`/build, but needs an answer before UI implementation starts.
- **"Compile combined prospect list for Apollo seed"** (open item on the working task list) -- purpose and status unclear relative to the CSV-import fallback now being first-class. Worth the team clarifying whether this is still needed (e.g. to seed the demo Apollo account itself) or superseded by the fixtures move.

## Out of Scope

- Apollo's own built-in AI email sequencing/context-block usage (explicitly switched off, not used by this build).
- Real-time send/delivery confirmation via Klaviyo webhooks -- blocked by Advanced KDP/partner tier gating on demo accounts; confirmed send is achieved via Events API polling instead (in scope, see ADR-0002), not via webhooks.
- Composio as the integration layer for Apollo/Klaviyo/Monday.com.
- Explicit per-talk-track Klaviyo flow-ID triggering by the app (relying on list-triggered flow automation instead).
- An actual settings toggle for turning off human-in-the-loop review -- the approval gate stays hard-required and hardcoded "on" for this build; only the *design* (single clean checkpoint) anticipates the toggle, the toggle itself is a future release.
- Everything already listed under Confirmed Intent > Out of scope (auto-send without approval, follow-up sequences, phone calls, donation negotiation, advanced CRM automation, grant-proposal generation).

## Handoff Notes

- **Operational setup needed before/during build** (non-engineering, but blocking): real API credentials for Apollo (or accept CSV-only for the demo), Klaviyo (private API key), and Monday.com (personal API token) -- none exist locally yet, only Composio catalog stubs. Disable Apollo's own AI sequencing for these prospect lists. Create 5 Klaviyo lists (one per talk track) with flow-trigger automation configured per list in the demo Klaviyo account. Identify the existing Monday.com board ID and column schema. Identify the Klaviyo "sent"/"received" metric ID on the live demo account for Events API polling (ADR-0002) -- needs live account access, can't be determined from docs alone.
- **Fixture data**: the 123-prospect sample set now lives at `docs/supporters/fixtures/segment-0{1-5}-*.md` -- use as CSV-import seed/test data. The raw intent-discovery input and API-investigation notes were also moved from an ephemeral scratchpad to `docs/agent-plans/ai-donor-outreach-agent-plan-input.json` and `notes/apollo-klaviyo-api-investigation-2026-08-01.md` respectively, for durability.
- **Neither `PRD_AI_Donor_Outreach_Agent.docx` nor `PRD_AI_Donor_Outreach_Agent_v1.1_hackathon.md` should be treated as authoritative** for scope decisions -- confirmed by the team that this plan file (and today's confirmed intent) is the real source of truth. The AI Behavior Spec content was the one exception explicitly carried forward as a standing requirement (see Resolved Decisions).

## Handoff

Next skill: `to-prd`.
