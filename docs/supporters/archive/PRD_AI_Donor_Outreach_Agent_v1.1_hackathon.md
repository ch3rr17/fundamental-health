# PRD: AI Donor Outreach Agent — Hackathon Build Spec (v1.1)

**Status:** Draft for discussion
**Supersedes/extends:** `PRD_AI_Donor_Outreach_Agent.docx` (original spec)
**Context:** AI Trailblazer San Diego hackathon, 2026-08-01. Built with/for Mychal.

## What's new in this version

The original PRD described the workflow abstractly ("configured platform," generic Apollo connect). This version locks in the actual hackathon build decisions:

| Original PRD said | This version specifies |
|---|---|
| "Connect Apollo account" | A **test Apollo account** — list generation and segmentation happen in Apollo, not in our tool. Our tool consumes Apollo's output. |
| "Send through configured platform" | **Klaviyo** is the sending/contact platform. Our tool prepares the draft; Klaviyo (or the intern via Klaviyo) handles delivery and contact record-keeping. |
| No delivery format specified | **Local web app** — a review-queue UI the intern runs locally, not a CLI or static export. |

Everything else below inherits from the original PRD unless marked "(updated)."

---

## Problem Statement

*(unchanged from original)* The organization's donor outreach process is constrained by the manual effort required to research each prospect and draft personalized introductory emails. Staff spend significant time reviewing donor profiles, identifying relevant background information, and composing outreach messages before communication is sent.

As a result:
- Outreach volume is limited.
- High-value prospects wait longer.
- Staff spend time on repetitive administrative work.
- Scaling requires additional personnel.

The organization needs an AI-powered assistant that automates research and first-draft generation while keeping humans in control of final approval.

## Goal

Increase the number of qualified donor prospects contacted each week by automating research and initial email drafting while maintaining quality and human oversight.

## Success Metrics

*(unchanged)*
- Reduce average research time per prospect.
- Generate first-draft emails for 95%+ of imported prospects.
- Enable one staff member or intern to process 200+ prospects per week.
- Maintain human approval before every outbound email.
- Increase outreach volume by at least 3× without increasing staffing.

## Target Users

Primary: Development Associate / Fundraising Intern
Secondary: Director of Development, Executive Director, Major Gifts Officer

## User Story

As a fundraising coordinator, I want AI to research each donor and draft a personalized introductory email so that I can approve and send high-quality outreach in minutes instead of spending time on repetitive research and writing.

## User Workflow (updated)

1. Apollo (test account) generates a segmented prospect list — "next best 50 supporters" across the 5 talk-track segments (Community Donors, Nonprofit/Marketing Professionals, Board Prospects, Financial Institutions/CRA, DAF Advisors & Giving Circles).
2. Intern exports/syncs that list into the local web app.
3. App matches each prospect to a segment and its corresponding Apollo talk track (context block).
4. AI researches each prospect using approved public sources.
5. AI summarizes findings, with a confidence indicator.
6. AI drafts an email using the matched talk track's hook/body/CTA, personalized with verified research.
7. Draft enters the review queue in the local web app.
8. Intern edits if needed.
9. Intern approves.
10. Approved draft is handed off to **Klaviyo** for sending (manual copy-in or API push — see Open Question below).
11. Activity is logged in the app (processed / drafted / approved / sent status per prospect).

## Functional Requirements (updated)

**Prospect Import**
- Import a prospect list (CSV export from Apollo test account, minimum: name, title, organization, segment/track).
- Detect duplicates against previously processed prospects.
- Tag each prospect with its matching talk track (01–05).

**AI Research**
- Identify organization and role, philanthropic interests, nonprofit affiliations, public profiles.
- Summarize relevant background.
- Identify connection points (e.g., existing referral-partner overlap, shared civic affiliations).
- Provide a confidence score per finding.
- Never fabricate — omit rather than speculate (see AI Behavior Spec below).

**Email Drafting**
- Generate subject line, opening hook, personalized body, organization overview, CTA, closing — pulled from the matched talk track and the AI research findings.
- Use talk-track-specific framing (e.g., peer-to-peer for nonprofit/marketing segment, CRA-specific language for financial institutions).

**Human Review**
- Draft queue view (all prospects, status: new / researched / drafted / approved / sent).
- Edit / regenerate / reject actions per draft.
- Approval required before any handoff to Klaviyo — no auto-send.

**Sending (updated)**
- V1: approved draft is formatted for manual copy/paste or CSV export into Klaviyo.
- Stretch goal (if time allows): direct Klaviyo API push to create the contact + draft campaign/flow entry.

**Reporting**
- Dashboard: prospects processed, drafts generated, approvals, sends, edit time, response rate (once Klaviyo tracking is wired up).

## Non-Functional Requirements

*(unchanged)* Security, role-based access, audit logging, compliance, performance, scalability, reliability. For the hackathon build, scope this down to: local-only auth (single intern user), basic audit log (who approved what, when), no scalability requirements beyond a few hundred prospects.

## Out of Scope (V1 / Hackathon)

- Automatic sending without approval.
- Follow-up sequences.
- Phone calls.
- Donation negotiations.
- Advanced CRM automation.
- Grant proposal generation (separate PRD/track).
- Live Apollo API integration (test account + manual export is sufficient for the demo).

## Acceptance Criteria

- Prospect CSV (Apollo test-account export) imports successfully.
- AI generates a research summary and a personalized, talk-track-matched draft email for each imported prospect.
- Intern can edit, regenerate, and approve/reject each draft.
- No email is sent (or handed to Klaviyo) without explicit approval.
- Activity is logged per prospect.

## Future Enhancements

Follow-up sequences, donor scoring, CRM integration, calendar scheduling, multi-channel outreach, A/B testing, predictive donor insights, direct Klaviyo API integration, direct Apollo API integration.

---

## AI Behavior Specification

*(unchanged from original — carried forward as-is, since it governs the core research/drafting behavior regardless of which platforms sit on either end)*

**Purpose:** The AI acts as a research and drafting assistant, not an autonomous fundraising representative.

**Core Principles**
- Human-in-the-loop: Never send communications without explicit human approval.
- Accuracy first: Only use verifiable information from approved sources.
- Transparency: Flag uncertainty and provide confidence indicators.
- Privacy: Respect organizational data governance and applicable privacy laws.
- Consistency: Maintain the organization's approved brand voice.

**Approved Data Sources**
- Apollo prospect records (test account)
- Public professional profiles
- Organization websites
- Public news and nonprofit affiliations
- Approved CRM data (future)

**Behavior Requirements**
- Research each prospect and produce a concise summary.
- Personalize messages only with verified facts.
- Avoid assumptions or fabricated details.
- Generate concise, professional first-touch emails.
- Suggest, but never invent, relationship connections.

**Hallucination Prevention**
- Do not fabricate donor interests, giving history, relationships, or affiliations.
- If information cannot be verified, explicitly state that it could not be confirmed.
- Prefer omission over speculation.

**Human Review Requirements**
- Every draft requires approval before sending.
- Users may edit, regenerate, or reject drafts.
- All approvals and edits should be logged.

**Tone & Style:** Professional, warm, concise, respectful, mission-focused. Avoid pressure tactics, exaggerated claims, or overly familiar language.

**Safety & Compliance**
- Comply with applicable email regulations (e.g., CAN-SPAM).
- Never expose confidential donor information.
- Respect opt-out requests and organizational communication policies.

---

## Open Questions (from team notes, unresolved — flagging rather than deciding)

1. **"Why have an intern review and approve?"** — noted as an open question in team notes. This PRD keeps human-in-the-loop review as a hard requirement (per the AI Behavior Spec and CAN-SPAM/compliance norms), consistent with the original PRD. Flagging in case the team wants to explicitly revisit or affirm this with Mychal.
2. **Klaviyo handoff mechanism** — is a manual copy/CSV handoff acceptable for the hackathon demo, or is a live Klaviyo API push (contact creation + campaign entry) worth attempting as a stretch goal? Affects whether we need Klaviyo API credentials during the build window.
3. **Apollo test account access** — do we have credentials/export access yet, or should the local web app be built against a mock CSV shaped like Apollo's export in the meantime?

## Reference: Validated Segment Data

Real, sourced (non-fabricated) prospect research was completed for all 5 talk-track segments as a proof-of-concept for what Apollo's own list generation should be capable of surfacing, and as sample/test data for the local web app build:

- Community Donors (Track 01): 5 named individuals + 4 proxy channels — `scratchpad/segment-01-community-donors.md`
- Nonprofit/Marketing Professionals (Track 02): 37 named prospects — `scratchpad/segment-02-nonprofit-marketing.md`
- Board Prospects (Track 03): 41 named prospects — `scratchpad/segment-03-board-prospects.md`
- Financial Institutions/CRA (Track 04): 12 named prospects — `scratchpad/segment-04-financial-cra.md`
- DAF Advisors & Giving Circles (Track 05): 28 named prospects — `scratchpad/segment-05-daf-giving-circles.md`

Notable finding: CRA officer contacts and individual community-donor identification are inherently public-search-resistant (banks don't publish CRA officer directories; private donor income/affinity isn't public data). This means Apollo's own enrichment/data licensing is likely doing real work for those two segments specifically — worth confirming Apollo's test account actually returns usable volume there before the demo.
