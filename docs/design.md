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
| `periwinkle`      | `#7993c6` | Mid-blue accent                         |
| `periwinkle-dark` | `#7783bf` | Mid-blue accent (links, hover)          |
| `navy`            | `#0a3e60` | Headings / dark contrast                |

Use as standard Tailwind classes, e.g. `bg-cream`, `text-navy`,
`bg-gradient-to-r from-coral to-amber`.

**Gotcha:** `#1863dc` / `#0056a7` appear in fundamental.health's raw HTML
but belong to the cookie-consent plugin's default styling, not the
brand — don't pull colors from raw page source without checking the
theme CSS.
