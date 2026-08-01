# Monday.com sync gates on Klaviyo API-call success, not confirmed send

The app creates a Monday.com tracking item immediately after Klaviyo's profile-create (`POST /api/profiles` → 201) and list-add (`POST /api/lists/{id}/relationships/profiles` → 204) calls succeed. It does not wait for confirmation that Klaviyo actually sent/delivered the email.

We decided this because real send-confirmation isn't practically available: Klaviyo's webhooks API (which would report delivered/opened/clicked events) is restricted to Advanced KDP customers and Klaviyo app partners, not available on a standard/free demo account. The fallback — polling `GET /api/events` for a "Received Email" metric — requires knowing a metric ID upfront and tolerating flow-trigger/send latency that won't resolve immediately, adding real complexity for a same-day hackathon build with no functional benefit visible to a demo audience.

**Status:** superseded by [[docs/adr/0002-confirmed-send-via-polling]]

**Consequence:** "Success" in this system means the API call succeeded, not that a human received an email. If the team later upgrades Klaviyo tiers or wants stronger guarantees, add a webhook receiver and revisit this gate — it does not require re-architecting the push step itself.

**Update:** the team decided confirmed-send verification is actually required (not optional), even without webhooks. See ADR-0002 for the polling-based approach that replaces the gate described here.
