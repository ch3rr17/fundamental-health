# FundaMental Health Donor Outreach — Context

Domain vocabulary for the AI Donor Outreach Agent (and adjacent supporter-outreach work at FundaMental Health). Single context — one `CONTEXT.md` at the repo root.

## Language

**Prospect**:
A person or organization Apollo's list generation has identified as a potential new *supporter* — not yet a donor, not yet a Klaviyo contact.
_Avoid_: Lead, contact (a prospect becomes a Klaviyo "profile" and/or a Monday.com "item" once pushed — use those terms for the post-push record).

**Talk-track segment**:
One of 5 fixed outreach categories (community donors, nonprofit/marketing professionals, board prospects, financial institutions/CRA, DAF advisors & giving circles) that determines which messaging hook/body/CTA a prospect's draft uses. Assigned by the app, not by Apollo — Apollo's export/API does not tag prospects with a segment.
_Avoid_: Segment (alone — ambiguous with Apollo's or Klaviyo's own generic list/segment features), category.

**Talk track**:
The actual messaging content (hook, body, CTA) associated with a talk-track segment, originally authored for use inside Apollo's own AI sequencing. In this build, talk tracks live only inside the app — Apollo's built-in AI sequencing is switched off for these prospects to avoid duplicate outreach.
_Avoid_: Template (talk tracks are talk-track-segment-specific, not generic).

**Review queue**:
The in-app list of AI-drafted prospect emails awaiting intern edit/approve. No draft leaves the review queue toward Klaviyo without explicit approval.
_Avoid_: Inbox, drafts (alone).

**Push (to Klaviyo)**:
The app's action of creating/updating a Klaviyo profile and adding it to a talk-track-specific Klaviyo list. This is what the app does; it never "sends" — sending/delivery is entirely Klaviyo's list-triggered flow automation, outside the app's control or visibility (see [[docs/adr/0001-monday-sync-gates-on-klaviyo-api-success]]).
_Avoid_: Send (from the app's perspective).

**Already-contacted bucket**:
Where a prospect lands (instead of the review queue) when the app finds their email already present in Klaviyo or on the Monday.com tracking board. Visible and overridable by the intern, not a silent drop — shows the prior contact date/talk-track when known.
_Avoid_: Duplicate, blocked (implies hard/silent rejection, which this isn't).

## Example dialogue

> **Dev**: When does the Monday.com item get created?
> **Domain expert**: Right after we push the prospect to Klaviyo — profile created, added to the right talk-track list. We don't wait to hear back that Klaviyo actually sent anything; we can't reliably check that on our plan anyway.
> **Dev**: And segment — does that come from Apollo?
> **Domain expert**: No, Apollo just gives us the prospect. The app has to figure out which talk-track segment they belong in.
