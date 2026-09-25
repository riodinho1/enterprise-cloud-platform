# Design direction

The visual direction for the frontend, fixed before any screen is built in Phase 6. Every UI decision is checked against this list. Recorded on 2026-09-25 from the owner's brief.

## Direction in one line

Futuristic and luxurious, but restrained: a dark, quiet interface where the content is the focus and one accent colour does all the pointing.

## Rules

| # | Rule | What it means in practice |
|---|---|---|
| 1 | Dark by default | The default theme is dark. A light theme may follow later; it is not required. Backgrounds are deep, near-black neutrals with slight warmth or coolness, never pure #000. Surfaces step up in lightness to show elevation instead of heavy shadows. |
| 2 | One restrained accent | Exactly one accent colour for primary actions, focus rings, active states and key data. Everything else is neutral. Semantic colours (success, warning, danger) exist but are muted and used only for status, never for decoration. |
| 3 | Free fonts only | Fonts must be free to use and self-hosted or loaded from a free source. No paid or licence-restricted typefaces. Candidates: Inter or Geist for UI text, JetBrains Mono or IBM Plex Mono for code, IDs and hashes. Final pick is made in Phase 6 and recorded here. |
| 4 | Subtle motion | Transitions are short (150 to 250 ms), eased, and only on state changes: hover, focus, open, close, loading. No decorative animation, no parallax, no auto-playing motion. `prefers-reduced-motion` is respected and removes non-essential motion. |
| 5 | WCAG AA | Text contrast at least 4.5:1 (3:1 for large text). Every interactive element has a visible focus state. Everything is keyboard-operable. Colour is never the only signal for a status; an icon or label accompanies it. Form errors are announced and tied to their fields. |
| 6 | Lightweight | No component library that ships a design system. Tailwind utilities plus a small set of project components. No icon font; inline SVG for the few icons used. The initial JS bundle stays small; charts and heavy views load lazily. Target: the main bundle under 250 kB gzipped. Measured and recorded in Phase 6. |

## Tone

- Confident and calm. Generous spacing, clear hierarchy, few borders.
- Luxurious comes from precision: aligned grids, consistent radii, careful type scale. Not from gradients, glow or gloss.
- Futuristic comes from restraint and clarity, and from a monospace touch on technical values (IDs, checksums, timestamps), not from sci-fi styling.

## Tokens (to be finalised in Phase 6)

Defined once as CSS variables under `:root` and consumed by Tailwind, so the accent or the neutrals can change in one place.

- Neutral scale: background, surface, surface-raised, border, text-muted, text.
- Accent: one hue with a hover and a subtle tint variant.
- Semantic: success, warning, danger, each muted.
- Radius: one small and one medium value.
- Type scale: five sizes at most.

## What this rules out

- Multiple accent colours, rainbow status badges, gradient buttons.
- Large hero illustrations, stock imagery, background videos.
- Paid fonts, icon fonts, heavyweight UI kits.
- Animations that play without user action.
- Any contrast below AA to make something "look sleek".

## Screens this applies to

Login and register, dashboard, document list with search and filters, upload with progress and validation, document metadata view, admin users and audit log pages, and every loading, error and empty state.
