# Confirmed-send verification via Events API polling, not webhooks

The app needs real confirmation that Klaviyo actually sent an email before syncing the prospect to Monday.com — not just that the profile-create/list-add API calls succeeded (superseding [[docs/adr/0001-monday-sync-gates-on-klaviyo-api-success]]).

Real-time webhooks (delivered/opened/clicked events) are gated to Klaviyo's Advanced KDP tier and registered app partners — not available on a standard/demo account, and not worth chasing on hackathon timelines (Advanced KDP is a sales conversation; app-partner registration is a multi-step process). The alternative, polling `GET /api/events` filtered by `profile_id` and a "sent"/"received" metric, is available on standard plans with no gating found, so we're using that instead.

**Status:** accepted

**Considered options:**
- Webhooks (rejected — tier-gated, not accessible on demo account).
- API-call success only, no send confirmation (the original ADR-0001 approach — rejected once the team confirmed real send-confirmation is a hard requirement, not optional).
- Events API polling (chosen).

**Consequences:**
- Someone needs live Klaviyo demo-account access before build to identify the actual metric ID for a "sent"/"received" event on that account — this is a blocking prerequisite, not a nice-to-have (see plan Handoff Notes).
- Polling means real latency: the Monday.com item will not appear the instant the Klaviyo push succeeds. Use a bounded timeout (e.g. 30-60s). On timeout, surface a clear fallback state ("pushed, send unconfirmed — check Klaviyo") rather than blocking the UI indefinitely.
- The review-queue/push UI needs a visible "confirming send…" state between push and Monday.com sync, so the demo doesn't look stalled or broken while polling runs.
