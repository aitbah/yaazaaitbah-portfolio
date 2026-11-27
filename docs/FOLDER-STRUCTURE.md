# Folder & File Organization

The project must stay **well organized** as it grows - this matters more than any specific folder layout.

## Principle

- Organize by **feature/domain**, not by file type. Once a feature exists (auth, contact, etc.), its files (routes, logic, model, tests) should live together and be easy to find - not scattered across generic folders mixed with unrelated features.
- Keep the same logic consistent across `backend/`, `frontend/`, and `tests/` - a feature should be just as easy to locate in each.
- `core/` (backend) and `components/ui/` (frontend) stay for shared infrastructure only - never feature-specific logic.
- When in doubt about where something belongs, prefer clarity and consistency with what already exists in the project over inventing a new pattern.

## Layout

The principle above is applied through this layout:

The repository is an npm workspace of three packages - `shared`, `backend`, `frontend` - with one `package.json` and one `package-lock.json` at the root.

```text
shared/                       # @portfolio/shared - the cross-package contract
├── src/                      # validation rules, Zod-issue-to-field-code mapper
└── tests/                    # mirrors src/

backend/
├── src/
│   ├── features/<feature>/   # routes, controller, service, model - owned by the feature
│   ├── core/                 # shared infrastructure only
│   ├── config/               # boot-time configuration (env validation)
│   ├── app.ts                # composition root - feature routers mount here
│   └── server.ts
└── tests/
    ├── features/<feature>/   # mirrors src/features/
    └── core/...              # infrastructure tests mirror the source tree

frontend/
├── src/
│   ├── features/<feature>/   # components owned by the feature
│   ├── components/ui/        # shared infrastructure only (shadcn/ui)
│   ├── components/providers/ # shared infrastructure (React Query client)
│   ├── components/form/      # shared infrastructure (form fields built on ui/)
│   ├── components/admin/     # shared infrastructure (admin list controls)
│   ├── components/layout/    # shared infrastructure (the page's width and rhythm)
│   ├── lib/                  # shared infrastructure (API client, code mapping)
│   ├── hooks/                # shared infrastructure (shadcn/ui hooks)
│   ├── app/[locale]/         # routing - Next.js convention
│   └── i18n/                 # shared infrastructure
├── messages/                 # translation files - see FRONTEND-RULES.md
├── e2e/                      # Playwright end-to-end specs - drive the whole stack
└── tests/
    ├── features/<feature>/   # mirrors src/features/
    ├── lib/...               # infrastructure tests mirror the source tree
    └── i18n/...              # infrastructure tests mirror the source tree
```

- `shared/` holds **declarations both sides of the wire must agree on**, and nothing else - no runtime behaviour, no framework code, nothing either package could own alone. Anything one package can own belongs to that package.
- `backend/tests/support/` and `frontend/tests/support/` hold test helpers shared by several suites, mirroring the way `core/` works for source. Files there are not themselves tests - the runner only collects `*.test.*`.

- `features/` is a sibling of `core/` (backend) and of the existing top-level folders (frontend).
- A feature never gets a generic type-based folder of its own (`routes/`, `services/`) - its router is mounted directly in `app.ts`. One feature may mount **several** routers when it serves several resources of one shape: `features/expertise/` exports a factory that `app.ts` mounts at `/api/skills`, `/api/technologies` and `/api/tools`.
- A feature is named for what it holds, not for one of the things it holds. `features/skill/` grew to hold technologies and tools as well, and became `features/expertise/` - a folder whose name is a lie is the confusion that the split existed to remove.
- Feature folders are created with the first real feature - no empty placeholders.
- No rigid file template is imposed _inside_ a feature folder: include what the feature actually needs, and stay consistent with features that already exist.
- `components/ui/` holds shadcn/ui primitives, added one at a time as a real screen needs them.
- `components/form/` holds project-owned components assembled from those primitives and shared by several features - shadcn's `field` styles the parts of a form field but wires none of them together, so that wiring lives here rather than in each feature. Like `providers/`, it is shared infrastructure that is not itself a shadcn primitive; a component only moves here once a second feature really needs it. It also owns the **form's rhythm**: `FormLayout` is the element, `FormFields` the section spacing, `FormSection` a real `fieldset`/`legend`, `FieldRow` a pair of short fields, and `FormActions` the footer with the whole-form error and the submit and cancel buttons. Nothing about spacing or the shape of a submit row is decided in a feature - five forms did that once, and they had already drifted into disabling cancel mid-save on one page and not on the other four.
- `components/layout/` holds the page's own rhythm, the way `form/` holds a form's: `Container` is how wide the site is and where its gutters are, and `Section` is one band of a page - the landmark, the distance to the next band, and a variant for one that fills the screen. Neither decides anything else about how a page looks; they are what the public redesign starts from.
- `lib/collection-api.ts` is the list/create/update/delete calls every collection endpoint answers the same way; each feature's `*-api.ts` re-exports them under its own names and keeps what is specific to it. The backend's counterpart is `core/http/collection-controller.ts`, used by the collections with nothing more to do (languages, social links, education, experience).
- `components/show-more.tsx` is how **every list** in the application is shown: a step at a time, with a count and a button for the next step, focus moved to what appeared, and how far each list is open kept by name for the session so a list that unmounts - every admin page swaps its list for the editor - comes back as it was. It takes rendered items, so the public site's server components pass their own markup and only the count reaches the client. `lib/list-steps.ts` is the one table of how many items each list shows. A new list uses both.
- `components/admin/` holds the pieces several admin pages share that are neither form fields nor shadcn primitives: the page header, the reorder buttons, the loading/failure wrapper, the row action menu with its confirmation, the thumbnail with its two kinds of absence, the empty state and the editor panel. `stored-image` and `brand-mark` were here and are not any more - the public site became their second caller, which is the condition for moving one out. Same rule as `form/`: something moves here once a second feature really needs it. These are also what a new section reuses - the eight planned ones are all the same shape as Skills.
- `hooks/` is the alias shadcn/ui installs its own hooks into (`components.json`); it is created by the first component that needs one, and holds shared infrastructure only.
- `app/global-not-found.tsx` is the page for any address no route matches, a whole document of its own because it renders outside every layout; there is no catch-all route under `[locale]`. `components/not-found-message.tsx` is what a missing page says, shared by it and the two `not-found.tsx` boundaries. See `FRONTEND-RULES.md`, *Missing pages*.
- `features/site/` is the public site (see `FRONTEND-RULES.md`, *The public site*):
  - `site-content.ts`: the one place that says what the public site loads. It is composed from the
    admin's own types, so a field added to an entity reaches both halves or neither.
  - `site-sections.ts`: which sections have anything in them, and which the navigation names.
  - `path-timeline.ts` and `expertise-groups.ts`: the pure arithmetic behind two sections.
  - `site-header.tsx`, `site-menu.tsx` and `site-theme-switch.tsx`: the bar, the phone's menu,
    and the switch with its spill.
  - `site-cursor.tsx`: the pointer, on a mouse only.
  - `site-companion.tsx`: the Enter key in the corner, its turn pre-rendered in
    `public/site/enter-key.webp`.
  - `mark-sprite.tsx`: the brand marks a page uses, each drawn once.
  - `loader/`: the first load's cover - `boot-loader.ts` (the inline script that counts, pure and
    unit-tested), `site-loader.tsx` (its markup) and `loader-script.tsx` (the script, for the
    server's HTML only).
  - `sections/`: one server component per section, plus the project gallery and the message form,
    which are client components.
  - `motion/`, the browser-only layer, excluded from unit coverage and driven end to end. Its rules
    are pure and unit-tested beside it:
    - `figure.ts`: reading the portrait;
    - `spill.ts`: the theme change's circle.
  - `motion/home-motion.tsx`: the one client component that moves the page.
- `features/admin/` is the shell itself rather than an entity: the navigation table every other part resolves against, the sidebar and its account footer, the header, the breadcrumb, and the dashboard. It is the one feature folder that reads *other* features' hooks - the counts on the dashboard and the name in the sidebar are the same queries their own pages make, served from the React Query cache rather than fetched again.

## End-to-end tests

`frontend/e2e/`, with `playwright.config.ts` beside `package.json` - decided 2026-08-31.

They live in the frontend package because that is where the browser tooling and its
dependency belong. (The original reasoning also cited avoiding a root `package.json`;
that no longer applies since the workspace added one, but the first reason stands on its
own.) They nonetheless exercise the whole stack, frontend and backend
together, so they are **not** part of `npm test`: `npm test` must stay runnable with
nothing started, while `npm run test:e2e` expects `docker compose up -d`.
