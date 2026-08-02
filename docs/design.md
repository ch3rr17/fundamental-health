# Design

## Color palette

The app's colors match [fundamental.health](https://fundamental.health/),
sourced from that site's live theme CSS
(`wp-content/themes/newfundamental/style.css`) rather than guessed from
the rendered page.

Defined as Tailwind v4 `@theme` tokens in
[../src/routes/layout.css](../src/routes/layout.css):

| Token             | Hex       | Use                                    |
| ----------------- | --------- | --------------------------------------- |
| `cream`           | `#fffbf4` | Page background                         |
| `cream-soft`      | `#f1ece3` | Secondary background                    |
| `cream-dim`       | `#dcd4cb` | Borders / muted background              |
| `ink`             | `#333333` | Body text                               |
| `coral`           | `#e33158` | Primary CTA gradient start              |
| `amber`           | `#f39a3a` | Primary CTA gradient end                |
| `sky`             | `#e9eff8` | Light blue background (footer, cards)   |
| `sky-deep`        | `#c7d7f0` | Deeper blue band (footer disclaimer)    |
| `periwinkle`      | `#7993c6` | Mid-blue accent                         |
| `periwinkle-dark` | `#7783bf` | Mid-blue accent (links, hover)          |
| `navy`            | `#0a3e60` | Headings / dark contrast                |

Use as standard Tailwind classes, e.g. `bg-cream`, `text-navy`,
`bg-linear-to-r from-coral to-amber`.

## Components

[src/lib/components/header.svelte](../src/lib/components/header.svelte) —
logo far left, sign-in/sign-out button far right (session-aware, see
Authentication below).

[footer.svelte](../src/lib/components/footer.svelte) — just the
copyright line, `bg-sky`, pinned to the bottom of the viewport via the
flex layout in [+layout.svelte](../src/routes/+layout.svelte) (`main`
gets `flex-1`), so it stays at the bottom on short pages and gets
pushed down on long ones.

Internal links use SvelteKit's `resolve()` from `$app/paths`, so their
target routes must exist — several stub pages under `src/routes/` were
scaffolded for this and are currently unused now that nav/footer links
were trimmed down (safe to delete or flesh out as real pages get built).

**Gotcha:** `#1863dc` / `#0056a7` appear in fundamental.health's raw HTML
but belong to the cookie-consent plugin's default styling, not the
brand — don't pull colors from raw page source without checking the
theme CSS.

## Authentication

Google sign-in via [Auth.js](https://authjs.dev) (`@auth/sveltekit`):

- [src/auth.ts](../src/auth.ts) — config, Google provider.
- [src/hooks.server.ts](../src/hooks.server.ts) — wires up the auth handle.
- [src/routes/+layout.server.ts](../src/routes/+layout.server.ts) — loads
  the session into `page.data.session` for every route.
- [src/routes/signin/+page.svelte](../src/routes/signin/+page.svelte) —
  the sign-in screen.

**Setup required:** copy `.env.example` to `.env` (already done locally
with a generated `AUTH_SECRET`) and fill in `AUTH_GOOGLE_ID` /
`AUTH_GOOGLE_SECRET` from a Google Cloud OAuth client
([console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)),
type "Web application", with an authorized redirect URI of
`http://localhost:5173/auth/callback/google` for local dev (swap the
origin for your production domain when deploying).
