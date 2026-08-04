# fundamental-health web app

SvelteKit + Tailwind v4 project for fundamental.health.

## Docs

See [docs/](docs/) for project documentation:

- [docs/SOP.md](docs/SOP.md) — handoff guide: how staff use the tool, and
  what an incoming engineer needs to know (stack, env vars, deployment
  status, known gaps, open-issue snapshot).
- [docs/design.md](docs/design.md) — color palette / brand tokens.
- [docs/CONTEXT.md](docs/CONTEXT.md) — domain vocabulary for the AI Donor
  Outreach Agent and adjacent supporter-outreach work.
- [docs/agent-plans/](docs/agent-plans/) — the AI Donor Outreach Agent plan
  and PRD. `ai-donor-outreach-agent-prd.md` is the current source of truth
  for scope.
- [docs/adr/](docs/adr/) — architecture decision records (Klaviyo/Monday.com
  integration decisions).
- [docs/supporters/](docs/supporters/) — talk-track content, CSV-import
  fixture data (`fixtures/`), and prior PRD drafts that are **not**
  authoritative for scope (`archive/`).
- [docs/grants/](docs/grants/) — Grant Scoping Tool PRD (separate track).
- [docs/hackathon-helper-guide.txt](docs/hackathon-helper-guide.txt) — quick
  orientation to FundaMental Health for hackathon teammates.

## Agent prompts

Prompts that get sent to a model at runtime live under
`src/lib/server/agent/prompts/`, not in `docs/`. They are code inputs, not
documentation: editing one changes production behavior, and `$lib/server`
keeps them out of the client bundle. Load them with Vite's `?raw` import.

- [src/lib/server/agent/prompts/prospect-email-agent.md](src/lib/server/agent/prompts/prospect-email-agent.md)
  — system prompt for the research + draft step of the AI Donor Outreach
  Agent. Its Sections 3 (approved facts/links), 5.4 (track → talk-track
  segment mapping) and 9 (output JSON) are structural: the app depends on
  them, so changes there are code changes, not copy edits.
