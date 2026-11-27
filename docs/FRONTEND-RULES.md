# Frontend Rules

## Internationalization

**Three locales, and an architecture that does not care how many**: `en`, `fr` and `ar` are delivered. English is the **default** locale, a structural role rather than a preference - [`DATABASE.md`](DATABASE.md#the-default-locale) says why, and `DEFAULT_LOCALE` in `shared` declares it once.

Adding French proved the claim this section had made since the first commit, and found four things it had not covered. They are worth stating as rules, because each was a place the architecture was ready and the code was not:

- **A view renders the reader's locale and falls back to the default.** Never `values[defaultLocale]`: that is correct with one locale and silently wrong with two. `localizedValue()` is the only way to read localized text.
- **A locale is named, never spelled.** "Titre (fr)" is a subtag on a screen. `languageName()` gives the language's name in the reader's own language.
- **Only the default locale is required**, so a form must never make another one mandatory.
- **No component names a locale.** `LocalizedField` reads `routing.locales` itself; a caller that passed the list was a caller that could pass it wrongly.
- **One editing language per form, not per field.** A localized field shows one language and a control to change it, and that choice belongs to the form: per-field tabs let the biography sit in French while the headline sits in English, and then nothing on screen says which language the form is in. `FormLayout` provides it, so every admin form has one by construction.
- **A language you cannot see must still be able to refuse a save.** Showing one language at a time means a value that fails validation in another one would refuse the save with nothing on screen to explain it. Two things prevent that, and neither is optional: a failed submit switches to the first language carrying an error, and a field marks the languages it is invalid in - by shape and by word, never by colour alone.
- **Two controls that do different things must look different.** The interface switcher in the header and the content tabs on a field are the same segmented control, and naming them apart - "Interface language" and "Content language" - settles it only for a screen reader. The header one carries a globe, because it has nothing beside it to take its meaning from; the tabs sit next to the field they belong to. A name only assistive tech hears is not a distinction for the person looking at the screen.
- **The language is in the name, not on the screen.** A control that already shows `EN | FR | AR` does not need "(English)" printed on the label beside it, but a screen reader still has to know which translation the input holds. Every localized label carries it in a visually hidden span, so the accessible name stays "Bio (English)" while the page reads "Bio".

- `next-intl`, with every locale prefixed (`/en/...`, `/fr/...`, `/ar/...`). The prefix is on the default too, so adding a locale never turns an existing URL into a redirect.
- One folder per locale (`messages/en/`, `messages/fr/`, `messages/ar/`), one file per namespace, each named after the root key it contains. `locale-parity.test.ts` holds every locale to the default's key set, its placeholders, and its namespace files - a missing translation fails a test rather than rendering its own dotted path on a page nobody reads in that language.
- No hardcoded UI text in the code - everything goes through translation keys from day one.
- The backend remains language-independent (returns codes, never translated text) - see `API-RULES.md`.
- External translation APIs will serve as administrative assistance later, not as a systematic call for visitors.

### Reading direction

`<html>` carries `dir` as well as `lang`, from `localeDirection()` in `src/i18n/routing.ts`,
and `RTL_LOCALES` there lists the tags that read right to left.

The UI is written entirely in logical properties - `ps-`, `me-`, `border-s`, `text-start` -
and `components.json` sets `rtl: true`, but every one of those resolves against the
document's direction. Without `dir`, a right-to-left locale translates every word and leaves
the whole layout mirrored the wrong way, silently.

**That attribute is necessary and it is not sufficient.** Arabic is what turned the section
above from a claim into a fact, and these are the four things it found - all of them in
places CSS cannot reach on its own. Each is a rule rather than a fix, because each will be
true again of the next component vendored in from upstream:

- **Tell the component library the direction as well as the document.** Radix reads it from
  its own `DirectionProvider` and nowhere else; with no provider above them the primitives
  compute `ltr` no matter what `<html>` says. That is not styling - it decides which way
  `ArrowRight` moves the roving focus, which edge `align="end"` lands on, and which side a
  popper flips to. `DirectionProvider` in the locale layout is fed from the same
  `localeDirection()` call as the attribute, so the two cannot drift.
- **A fixed or absolute element is positioned logically, never with `left`/`right`.** The
  vendored sidebar pinned its fixed panel with `left-0` inside a flex row that did honour
  the direction: Arabic put the gap on one side and the panel on the other, on top of its own
  content. Markup identical in both languages, pixels not.
- **`transform` is not a substitute for size.** The progress bar filled itself by sliding a
  full-width indicator out of view with `translateX(-N%)`. Transforms have no notion of the
  inline axis, so the meter drained towards the wrong end. Sized with `inline-size` instead.
- **An icon that points somewhere carries `rtl:rotate-180`.** Back arrows, chevrons,
  "continue" arrows. The ones that do not point - a globe, a trash can - do not.
- **Stored text carries `dir="auto"`; the interface around it does not.** Content is written
  in whatever language the owner typed it in, and only the default locale is ever required -
  so most rows are English on an Arabic page and stay that way until somebody translates them.
  Inheriting `rtl` does not merely misalign that text: the bidirectional algorithm moves the
  neutral characters at the end of a run to the other end, and an English sentence renders with
  its full stop in front of the first word. `dir="auto"` lets the browser direct each element
  by its own first strong character. It goes on the element that prints the value - a name, a
  headline, a description, a message subject - and never on a container that also holds
  translated chrome, which would turn a badge or a date around with it. A string that is
  *always* left to right whatever the page - a URL, a mail server - takes `dir="ltr"` instead,
  so it truncates at its meaningless end rather than losing its scheme and host.

Because none of this is visible in the markup, it is asserted where it is visible. The
`the admin in Arabic` block in `e2e/admin.spec.ts` measures bounding boxes rather than reading
classes, and checks the page does not scroll sideways - the loudest symptom of one element
still pinned to the wrong edge.

**Numbers are written in Western digits.** `Intl` decides this and current CLDR already gives
plain `ar` Latin digits, so it costs no code - but it is a decision rather than a default, and
it is asserted: the rows beside these numbers carry Latin IDs, dates and version strings, and
the Maghreb writes its numerals this way. A locale that should use Arabic-Indic digits
(`ar-EG`) would be a different tag, and the assertion is what would notice.

**Content is not translation.** Adding a locale grows every localized field by one input. It
does not translate a single row: the default locale is the only one ever required, so every
row written before the language existed stays valid and falls back until somebody fills it in.

## Accessibility

- `prefers-reduced-motion` is honoured globally in `globals.css`: animations and transitions
  drop to a single frame rather than being removed, because Radix unmounts a closing dialog
  on `animationend` and an animation that never fires never sends it.
- Every control names what it acts on. "Delete" repeated down a list, or three fields all
  labelled "Description", is a list a screen reader cannot navigate.
- Destructive actions confirm in a real dialog, never `window.confirm` - the native one is
  invisible to the accessibility tree of the page it interrupts.

## Unsaved work

Nothing leaves an edited form without asking. `FormLayout` reports `form.formState.isDirty` - a **required** prop, because a guard that only protects the forms that remembered to ask for it is not a guard - and every way out of the admin checks it: the language switch, the sidebar, the account menu, the breadcrumb, and the tab.

- One dialog for the whole admin, in `UnsavedChangesProvider`. The question is always the same question, and a copy per control is a chance to word it differently.
- Staying is the safe answer, so it is the one Escape gives you.
- A guard that asks when there is nothing to lose is one people learn to click through, so a clean form and a modified click - ⌘-click, middle-click, anything opening another tab - are never interrupted.
- `beforeunload` is the single exception to the ban on native dialogs below: closing a tab is the browser's decision, and its own prompt is the only mechanism there is.

## Where an editor lives

**An admin editor is a location, not a piece of state.** `useEditorKey` / `useRowEditor` keep it in one search parameter - `?edit=new`, `?edit=<id>`, `?edit=profile` - so the Back button closes the editor and stays on the list, Forward reopens it, and a reload keeps it open.

- It was component state until the Back button was reported as leaving the page. Opening an editor pushed no history entry, so Back had only the page visited *before* the list to go to - the Dashboard when that was how you arrived, and something else when it was not.
- The address is changed with `history.pushState`, not the router: the pathname does not change and nothing on the server reads the parameter, so a route request per click of Add and Cancel would buy nothing.
- It is read back with `useSearchParams`, which has to be the router's answer rather than `window.location` read directly. Measured: reading the address bar through a `useSyncExternalStore` survives Back, Forward and a reload, and then fails when the sidebar link for the page you are already on changes the URL through the router - no `popstate`, nothing to hear it, and an editor left on screen over an address saying list.
- A key naming a row that is not in the list shows the list. That is a link to something since deleted, and the list is the answer the reader can act on.
- A page that closes an editor *itself* - the options chooser moving to another list - closes it with `closeWithoutHistory`, or Back would reopen an editor for a row no longer on screen.
- **Back does not ask before closing an edited form**, and this is deliberate. A `popstate` has already happened by the time anything can hear it; simulating a cancelled one means pushing entries the reader never created and unwinding them through save, cancel and unmount, and a history that lies is worse than the loss it prevents. Every deliberate exit is still guarded, and Back now costs a panel rather than the page.

## Theme

System, light or dark, chosen in the public navbar and the admin header. Light and dark are kept in `localStorage`; **System is kept by storing nothing**, so a first visit and a reader who chose System are the same case - the device decides, including when it switches while the page is open.

- The toggle marks the stored *choice*, not the class on `<html>`: System and the theme it resolves to look identical on screen. Storage raises no event in the tab that wrote to it, so `useTheme` notifies its own subscribers; where storage refuses a write, the choice is held in memory for as long as the page is open.

- The class goes on `<html>`, because that is what the `dark` variant and the token block in `globals.css` both resolve against.
- It is applied by a **blocking inline script before the first paint**, generated from the same constants the runtime uses. Applying it in an effect renders every page light, hydrates, and flips - a white flash on every load for anyone who chose dark.
- That script lives in the **root** `[locale]` layout, rendered once by `ThemeScript`, so every page under it has the reader's theme - including not-found and error pages, which render under the root layout alone and were painted white for a reader who chose dark while the script sat in the public and admin layouts.
- The admin's CSP admits it by its **SHA-256 hash**, computed in `proxy.ts` from the same constant that is rendered. A nonce would mean reading a request header in the root layout, which renders every public page per request. A script the policy does not admit does not run and does not report that it did not - the theme was once applied to nothing at all in the admin for exactly that reason, which is why the end-to-end suite checks the hash against the script actually rendered.
- `ThemeScript` renders the script for the server's HTML and while hydrating it, and nothing once the page is live. React refuses to create a `<script>` on the client, and says so; the class the script wrote is already on `<html>` by then.
- It also applies the theme in a layout effect whenever it mounts in the browser, before that tree is painted. Where the script already ran it writes the same class again; where the page was built in the browser - a `notFound()` thrown while rendering, below - it is what gives that page the reader's theme.

## Missing pages

A reader who types an address that does not exist must get a real HTML page, in their language and their theme, from the first frame.

- **A `notFound()` thrown while a page renders cannot be caught on the server.** Next's not-found boundary is a client error boundary, and React does not use those on the server, so Next sends its bare error shell - `<html id="__next_error__">`, no stylesheet, no script - and builds the page in the browser. The browser paints that empty document white first: a reader who chose dark saw a white flash.
- **So missing pages are decided before rendering.** An address no route matches gets `app/global-not-found.tsx` (the experimental `globalNotFound` flag), a complete document with the stylesheet, the theme script, `lang`, `dir` and the translated message. It is the case Next's own documentation names: a root layout under a top-level dynamic segment, which `[locale]` is. There is deliberately **no catch-all route** under `[locale]` - one would match every unknown address and throw exactly the `notFound()` that ends in the shell.
- **A project that does not exist** is a route that does match, so `proxy.ts` checks the slug against the API and rewrites the request to an address no route matches, carrying the locale. If the API cannot be read it does nothing, and the page decides as before.
- `not-found.tsx` at `[locale]` and in `(public)` remain for a page that finds its content missing at render time; those arrive through the shell, and `ThemeScript`'s layout effect themes them.
- Nothing is stored until the toggle is used, which is not the same as choosing light: until then the operating system decides, and it keeps deciding.
- The control reads the class rather than holding state of its own, so the toggle and the page can never disagree.
- **Anything that changes `[locale]` loads the document rather than navigating within it.** The locale segment sits above everything, so changing it re-renders the root layout on the client - and React then writes `<html>`'s attributes from JSX that carries no class, wiping the one the script put there. Switching language turned a dark admin white, and the only clue was a console warning about a script tag. A locale change *is* a different document - different `lang`, different `dir`, different messages, different tree - so loading it is the right thing as well as the working one.

## The public site

**Signal**: warm ink, bone paper and one vermilion red that carries the
identity. Each section is a server
component in `features/site/sections/`, rendered from `readSiteContent`, and only when it has
content (`visibleSections`). In order:

1. **The opening.**
   - The owner, the photograph whole, before a red disc centred behind the head.
   - The name large in the serif, its second half in italic.
   - The headline, a red action to the work and a link to write; where the owner is and whether
     they are available.
   - A ring of words (the headline and the place) inside the disc's rim, turning, faster with the
     scroll; fitted by word spacing, so Arabic's letters stay joined.
   - The name's letters grow heavier near a mouse pointer.
   - On scroll the stage is held while the disc grows until red fills the screen; the letters
     scatter, the portrait sinks below the screen's edge, solid, and About rises red on red.
2. **About** (on red). Every paragraph set as the statement, large in the serif, lit word by word.
3. **Work.** Featured projects as cards that pin and stack as the next arrives (wide screens), each
   leading to its page; the rest in a rail that pins and travels sideways on every width, with a
   rest at each end, cards settling in and a progress line.
4. **Expertise.** Lines of names moved by the scroll, leaning with its speed (decoration, hidden
   from assistive technology), then a grid of tiles under each kind, related ones together. A
   technology or a tool is its logo in a red ring filled to its level; a skill, which has no
   logo, a wider tile with the level in its ring and its name beside it. The level is said in
   words, with its category.
5. **Experience** (`#path`). A timeline whose red line draws as it is read; each stop fills as the
   line reaches it. Experience, then education, most recent first, with its length.
6. **Credentials** (`#record`). Certifications and courses, numbered in red; the languages on the
   option list's scale.
7. **Contact.** The email set large, the CV as the section's one red button (PDF, its language),
   the facts, the profiles elsewhere, the form.
8. **Footer** (on red). An invitation to write with the email and the CV; the sections, the
   profiles elsewhere, where the owner is and their availability; the legal line with the last
   update and the way back up; the name as wide as the page.

The bar's one action is *Let's talk* (to Contact), beside the sections; the phone's menu offers the
CV. A vermilion Enter key keeps the reader company in the corner (`site-companion.tsx`): a 3D
model pre-rendered as a 36-frame turn (`public/site/enter-key.webp`, 100 kB, no 3D library at run
time), turned by the scroll, shown only where it covers no text, control, image or red, and
leading to Contact. Decoration and a second way to Contact, so it is kept from assistive technology
and the tab order; without the motion it never shows.

Section heads are `SectionHead` (`chapter.tsx`): a red number and the name large in the serif.

A project's own page (`/[locale]/projects/[slug]`) uses the same parts. The routes, metadata, share
cards, `Person` structured data, sitemap, `robots.txt` and the 404 for an unknown slug are as
before.

**The page is complete without script.** The motion layer (`motion/home-motion.tsx`) only moves
what the server already rendered:
- It reads the page by `data-` attributes.
- It adds nothing the page needs.
- Without it every section reads, and the rail scrolls sideways by hand.
- What only the motion can place carries an attribute it sets, so a page without it is laid out
  plainly: `data-staged` (the opening held by `sticky`), `data-pinned` (the rail),
  `data-on` (the companion).
- `e2e/public.spec.ts` checks the page with script off.

**One motion system.**
- GSAP, ScrollTrigger and SplitText drive the choreography. Lenis is the only smooth-scroll engine.
- **The opening is held by `sticky`, not pinned.** A pin keeps the height it measured; on a real
  phone the browser's toolbar slid away and left a band of page under the portrait, which neither
  `dvh` nor the window's height reliably caught. The section is given the room as its *height*
  (a sticky element travels only within its parent's content, never into padding); the stage
  stands as tall as the screen can grow (`lvh`); the portrait and the disc are fixed to the
  screen's own foot, which the browser keeps at the visible edge, and step out once About covers
  the screen.
- **Two pins:** the featured cards (wide screens) and the rail (every width), each stating
  `pinSpacing` outright, since `<main>`'s wrapper is a flex container.
- **Pins are measured first, top to bottom** (`refreshPriority`, `PIN_ORDER`), and everything
  else after them. A trigger measured before a pin above it added its room starts early by that
  room: the timeline ran a screen ahead at laptop sizes, and was right only zoomed out, where the
  rail is shorter.
- The opening hands over to About without a screen of empty red: About is drawn up beneath it
  (a negative margin set by the motion only), and once red covers the screen the opening drops
  behind it (`data-behind`).
- **An entrance and the scroll never animate the same property on the same element.** The
  opening's way in moves the photograph inside the figure, the letters inside the name's masks
  and the parts inside the details, while the scroll moves the figure, the masks and the details
  themselves; a tween sharing a property hands the other its hidden state as the place to return
  to (the opening's actions once stayed hidden after a scroll down and back).
- **Entrances are tied to the scroll**, both ways: titles rise letter by letter (word by word in
  Arabic), blocks (`data-reveal`) and images (`data-clip`) come in as they come up the screen and
  go back with it, a language's level fills mark by mark, the email arrives letter by letter.
- **The expertise tiles come in one by one, with the scroll:** each rises and then fills its ring
  as it comes up the screen, the next in its row a little further up (by its place in the reading
  order), so a row arrives tile by tile, and going back up takes them away again in turn. A whole
  grid at once was tiring to watch; one by one on a clock felt detached from the scroll.
- The bar takes a scrim once the opening has let go, turns to the page's ink over red
  (`data-on-red`), marks the section in view and steps away while reading down. All but the
  stepping away hold under reduced motion too.
- With reduced motion nothing moves: no smooth scroll, no pins, no entrances. The opening is still
  composed. Transitions are `0s`, not near-zero: `transition-property` is `all` by default, so a
  near-zero duration made every style change a transition, and code that sets a size and measures
  it read the old one.
- `?capture` turns smooth scrolling off, so a recording can drive the scroll frame by frame.

**The first load** (`features/site/loader/`).
- The whole screen red from the first paint until the opening is composed: the count large in ink
  at its centre, the name, the headline, and a line along its foot filling with the progress. At
  100 the red draws in, a shrinking circle, to the opening's own disc, which lies beneath it in
  the same red, and becomes it; the portrait rises from below the edge in front of it, the name's
  letters come up, then the details. A return inside the site is covered in the page's colour,
  without the count.
- The progress is real. An inline script counts the page's scripts (Resource Timing), the
  opening's faces, the portrait, then the motion's milestones (`reach('running')`,
  `reach('measured')`, `ready()`).
  - It moves at no more than a step per frame, so a frame the page could not draw is resumed from,
    never leapt over.
  - It creeps only into work under way.
  - Its variables are written on the contained cover, never on `<html>`: one set there restyled
    the whole page every frame and held up the scripts it counts.
  - A face is counted by its variable and descriptor, since roman and italic share a variable.
- Shown only once that script has run, so a page without script is never covered. It gives way by
  itself if the motion never reports. A return to the page inside the site gets the cover without
  the count. The scroll is held while it covers.
- The public site has no script policy. If one is added, the loader's script must be nonced or
  hashed, like the theme script.

**The pointer** (`site-cursor.tsx`), on a mouse only and never under reduced motion.
- A red dot that stretches along the way it moves, and a ring trailing it that wraps a button, a
  link or a tab in its own shape (larger ones are circled). A press sends a pulse out.
- Over red - a red chapter, a red button, the menu, the opening's disc - the dot and the ring are
  ink.
- A red labelled disc over an image that opens (`data-cursor="view"`).
- Controls marked `data-magnetic` lean toward it.
- The system pointer returns over fields, an open dialog and the theme change.
- **One hover language:**
  - links draw a red line (`link-line`, `link-redraw`);
  - arrows pass through (`arrow-pass`);
  - images settle closer;
  - the email's red line grows to its full width.

**Red is the accent and the ground, never decoration.** It marks the actions, the numbers, the
levels, the timeline and the cursor, and it is the ground of About, the menu and the footer. On red
the type is ink (`--site-on-red`) in both themes. Space, grouping and type set things apart; form
fields are filled, not outlined.

**The photograph.** `profile.photoUrl` is the only source; the repository holds no photograph.
- It is shown whole, at its own proportions: never cropped, masked or faded at its foot. Its
  straight foot stands on the screen's lower edge; on scroll it sinks below that edge, solid.
- A transparent background (a cutout uploaded in the admin as WebP or PNG) stands before the disc
  with no frame. An opaque photograph falls away at its edges (`figure-soft`).
- `motion/figure.ts` reads the image in the browser, so a new upload needs nothing else:
  - whether it is cut out;
  - where the head is, which places the disc (`--hero-head`) and centres the figure on it.
- Uploads are same-origin through the `/uploads` rewrite, which is what lets the canvas read them.

**Two themes, one set of tokens.**
- The `--site-*` tokens in `globals.css` are redefined under `.dark`; the red is the same in both.
  The project's theme system (`components/theme`) sets the class.
- The public switch (`site-theme-switch.tsx`) picks light or dark in one press, or `T`.
- With View Transitions, the new theme's snapshot is clipped to a circle growing from the switch
  that was pressed until it covers the page (`motion/spill.ts`), both ways.
- The effects a utility cannot spell are `@utility` definitions beside the tokens: `site-label`,
  `site-display`, `figure-soft`, `clip-reveal`, `link-line`, `link-redraw`, `arrow-pass`.

**Type.** Fraunces for display (roman and italic), Inter for text; Amiri for Arabic display and
Tajawal for Arabic text. Geist Mono stays for the admin. The sizes are tokens (`text-site-hero`,
`-title`, `-lead`, `-heading`, `-body`, `-label`).

**Right to left.**
- The opening is mirrored: the name on the right, the disc and figure on the left.
- The rail travels the other way, and the lines of names turn the other way.
- The ring of words runs one way along its path in every language, the Arabic words still reading
  right to left along it; it is fitted by the space between words, which never pulls joined
  letters apart.
- Arabic is split into words, never letters, because its letters join.
- Arabic display lines are taller (`site-display`, line-height 1.3); what is placed below the name
  reads `--display-leading`, and the name is a step smaller.
- A face that loads on demand (Arabic's) is loaded before the name is measured.
- Horizontal overflow is clipped at the page, since in RTL any overflow shifts the whole view.

The data layer is `features/site/`:
- `site-content.ts`: what the public site loads.
- `site-sections.ts`: which sections have anything in them, and which the navigation names.
- `path-timeline.ts` and `expertise-groups.ts`: the pure arithmetic behind two sections - the
  stints most recent first with their lengths, the expertise grouped by category.
- `mark-sprite.tsx`: each brand mark a page uses, drawn once and referenced wherever it appears.

The contact endpoint, its schema and its validation live in `features/message/`.

- **Rendered per request, never at build.** `readSiteContent` calls `connection()`, and the
  sitemap is `force-dynamic`. A build has no API to read, and a page prerendered then served
  an empty portfolio until something revalidated it. The API reads stay cached for
  `PUBLIC_REVALIDATE_SECONDS` (five minutes in production, none in development).
- **A stored file is offered only when it answers.** The CV link is checked with
  `storedFileExists`. A reference can outlive its file.
- **One notification per outcome.** Every action reports how it went once, as a toast:
  success when it worked, an error when it did not, and nowhere else. Field errors stay on their
  fields; content that could not be *loaded* says so in its place (`ErrorText`). The public
  message form says its outcome in place.
  - An admin create, save or delete names its outcome (`'created' | 'saved' | 'deleted'`, as
    `MutationNotice`), and `MutationNotices` raises the toast when it succeeds. A new editor gets
    it by declaring it.
  - A failure goes through `ErrorToast`, which takes the message the caller may or may not have,
    as `ErrorText` does, so each place keeps its own wording.
  - Actions that report success themselves (the account's password, address, sessions and test
    mail) raise their own toast.
- **React Query is the admin's.** Its provider sits in the admin layout; the public site renders
  on the server and ships no query cache.

## SEO

- Metadata, sitemap, `robots.txt`, `hreflang`, structured data, clean URLs, server-side indexable rendering.
- No separate SEO database model without a real need.

## Performance

Use Server Components when appropriate; caching only when there is demonstrated real value; optimize based on real bottlenecks, not anticipation.

### Images

**Every stored image is rendered through `next/image`**, via `StoredImage` or - where a
third-party component owns the `<img>` - `getImageProps`. Never a bare `<img src>` for an
upload.

Uploads are served from this origin, proxied to the backend by the rewrite in
`next.config.ts`. That is what makes the optimizer able to fetch them at all: it fetches by
URL from the *server*, where the browser's `localhost:5000` is the frontend's own container.
`remotePatterns` stays empty, and an external URL - which the contract still permits - is
rendered `unoptimized`, because no pattern could safely cover an arbitrary host.

**`sizes` is required on every one of them**, and `StoredImage` makes it a required prop for
that reason. Without it the browser assumes the image fills the viewport and picks a
candidate many times larger than the box it lands in - which is the one way this looks
finished and saves nothing.

This was measured before it was built, per the rule above. The admin's projects page, with a
cover the size this application permits: **1,626,937 bytes before, 37,758 after**, in the
same browser.
