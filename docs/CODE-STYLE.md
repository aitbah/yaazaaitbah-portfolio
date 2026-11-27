# Code Style & Quality

## Mandatory Sequence

Before considering a feature complete:

```text
Implement → Test → Lint → Type-check → Build → Done
```

## Tests

- Automated and mandatory (backend + frontend): unit, integration/API, end-to-end (Playwright).
- Written and run **during development**, executed locally for now.
- Tooling: TypeScript, ESLint, Prettier, Vitest, Playwright.
- Priorities: authentication, API endpoints, validation, error handling, forms, language switching, critical user flows.
- Postman allowed for manual development testing.
- Test file organization (feature-based folders under `tests/`) → see `FOLDER-STRUCTURE.md`.

Tests run locally, each gate as its own command reading its real exit code, and the same gates are declared in `.github/workflows/ci.yml` - see `CI-CD.md`.

**ESLint stays on 9 for now.** `eslint-config-next` bundles `eslint-plugin-react`, `eslint-plugin-jsx-a11y` and `eslint-plugin-import`, none of which declares ESLint 10 support yet; upgrading before they do means forcing peer conflicts.

`npm test` runs **with coverage**, so the thresholds in each `vitest.config.mts` are a gate rather than a comment. They were not, for a while: the numbers were declared and the command never passed `--coverage`, so the backend sat at 74% against its own 85% and nothing said so. A threshold nobody runs is documentation, not a gate.

One-off scripts are excluded from coverage - a process entry point, `create-admin`, `prune-uploads`, the seeder. Being a script is not by itself a reason: `placeholder-image.ts` lives beside the seeder and is a hand-written PNG encoder, so it is tested rather than excluded.

## Logging

- Structured and centralized logging (`info`/`warn`/`error` levels) - no arbitrary `console.log`.
- Never log sensitive data (see `SECURITY.md`).

## Code Comments

- Short and useful - never long comment blocks.
- Do not comment obvious code.
- Comment only what is important or non-obvious.
- Explain **why**, not the **what** the code already shows.
- Keep it simple, precise, and easy to understand.

## UI Styling - Tailwind & shadcn/ui

- Use Tailwind utility classes directly; avoid custom CSS files unless Tailwind really can't express something.
- Use `shadcn/ui` components as the base building blocks for UI - don't rebuild a component from scratch if an equivalent already exists in shadcn/ui.

  Adding one: `npx shadcn add <name> --yes < /dev/null` from `frontend/` (without the redirect it waits on a prompt and appears to hang). **Check the diff afterwards.** The CLI as of v4.19 writes `import { cn } from "cn"` - a real, unrelated package on npm, which it then installs - instead of resolving the `utils` alias, and it rewrites any component it touches into its own quote style. Fix the import to `@/lib/utils`, revert anything it changed that you did not ask it to, and drop the `cn` dependency it added.

- Keep styling consistent across pages: same spacing scale, same color tokens, same component variants.
- **The components are stock.** Every file in `components/ui/` that came from the registry matches what `npx shadcn add <name>` writes for this project (`radix-nova`, `rtl: true`), and the theme in `globals.css` is shadcn's neutral one. The exceptions are fixes, not styling: `progress` fills by `inline-size` and `sheet` and `sidebar` position and slide by the reading direction, so all three work in Arabic; `field` carries `min-w-0` against overflow; the sidebar translates its sheet titles, hides its decorative rail from screen readers, renders `SidebarInset` as a `div` because the page supplies `<main>`, and stops collapsed group labels taking clicks. Check a component against the registry without writing anything: `npx shadcn add <name> --dry-run --diff src/components/ui/<name>.tsx`. `toast` and `segmented-control` are the project's own; they use the same tokens, and the segmented control borrows Toggle's look.
- No inline `style={{ ... }}` unless dynamic values really require it.

### Centralized design - single source of truth

The whole visual identity (colors, spacing, radius, typography) must be defined **once**, centrally, not re-invented per component:

- `frontend/src/app/globals.css` is the **only** place where design tokens are defined. Tailwind v4 is CSS-first, so there is no `tailwind.config.ts`: raw values live in `:root` / `.dark`, and the `@theme` block exposes them to the utility classes.
- Components consume these tokens (`bg-primary`, `text-muted-foreground`, `rounded-lg`, etc.) - they never hardcode a raw color (`#3b82f6`), an arbitrary spacing value, or a one-off font size.
- If a new token is needed (a new color, a new spacing step), add it to `globals.css` first, then use it - don't invent it locally inside a component.
- Goal: every page/component looks like it belongs to the same product, because they all draw from the same theme, not from scattered ad hoc styles.

### The admin's spacing scale

Written down because it was being chosen per form, and five forms had drifted apart:

| Distance | Step | Where |
| --- | --- | --- |
| inside one field (label → input → error) | `gap-2` | `Field`, vendored |
| between fields | `gap-4` | `FormSection`, `FieldRow` |
| between sections | `gap-8` | `FormFields` |
| between the page's own blocks | `gap-8` | the page's root, `main` |

One step apart each time, which is what makes a grouping visible without drawing a box
around it. A form never sets its own: `FormFields` owns the section spacing and
`FormActions` owns the footer, so "how far apart are two sections" has exactly one answer.

Three registers of heading, and they must stay distinguishable:

- a **section legend** - `text-xs`, uppercase, tracked, muted;
- a **field label** - `text-sm`, medium, foreground;
- a **group inside one field** - `text-xs`, medium, muted, **not** uppercase.

A sub-group rendered in the legend's register flattens the hierarchy it belongs to: the
project form's "Technologies"/"Tools" headings read as sections until they stopped being
uppercase.

### Heights use `svh`

`svh` rather than `dvh`, in the admin and anywhere else: the small viewport is the one that is
always there, so nothing resizes under the reader when a mobile address bar retracts.

### The admin shell is a fixed frame

The vendored `SidebarProvider` is `min-h-svh`, so the shell grows with its content and
every height inside it is indefinite - `flex-1` can only mean "grow", and no child can ask
to be as tall as the screen. The layout pins it (`h-svh`) and makes the **content column**
the scroll container instead.

That is what lets a page choose: an ordinary page scrolls in the column, and a page that
fills the height - the inbox - scrolls inside its own panes. It also fixes the header in
place for free. Anything that wants to fill the height needs `min-h-0` at every step down
from `main`, because a flex child's default minimum is its own content.

Specific conventions (folder structure for components, naming, theming) will be expanded here once real patterns emerge from implementation.
