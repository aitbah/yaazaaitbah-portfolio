import { loaderScript, type LoaderConfig } from './boot-loader';
import { LoaderScript } from './loader-script';

/**
 * The first load's cover: the whole screen red, the count large in ink at its
 * centre, the name above, the headline below and a line along the foot that
 * fills with the real progress. When the opening is composed the red draws in
 * to the opening's own disc and becomes it, and the opening comes in around
 * it. The motion opens it; the inline script counts.
 *
 * Hidden unless the script has run (`html[data-loader]`, in `globals.css`),
 * so the page read without scripts is never covered. Decorative to assistive
 * technology: the page beneath is already there.
 */
export function SiteLoader({
  name,
  headline,
  portrait,
}: {
  name: string;
  headline: string;
  portrait: boolean;
}) {
  const config: LoaderConfig = {
    image: portrait ? '[data-hero-figure] img' : null,
    sample: name,
    // The name's face, the labels' and the text's, as the page resolves them for its language.
    fonts: [
      ['--font-display', '400 1em'],
      ['--font-display', 'italic 400 1em'],
      ['--font-sans', '400 1em'],
    ],
    pace: 1000,
    stall: 8000,
    max: 25000,
  };

  return (
    <>
      {/* The inline script writes the count's variables on this element, before hydration. */}
      <div data-site-loader aria-hidden suppressHydrationWarning>
        <div data-loader-ground className="absolute inset-0 bg-site-red" />
        {/* What a return inside the site does without (`quick`). */}
        <div data-loader-mark className="absolute inset-0 text-site-on-red">
          <p
            data-loader-label
            className="site-display absolute start-[var(--site-pad)] top-[clamp(20px,4vh,40px)] text-[clamp(1.25rem,1rem+1vw,1.75rem)] italic"
          >
            {name}
          </p>
          <p
            data-loader-label
            className="loader-count site-display absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[clamp(7rem,32vw,22rem)] leading-none [font-feature-settings:'tnum']"
          />
          {headline ? (
            <p
              data-loader-label
              className="site-label absolute start-[var(--site-pad)] bottom-[clamp(24px,5vh,48px)] max-w-[70%] truncate opacity-80"
            >
              {headline}
            </p>
          ) : null}
          <span
            data-loader-label
            className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-[var(--loader-p,0)] bg-site-on-red rtl:origin-right"
          />
        </div>
      </div>
      <LoaderScript code={loaderScript(config)} />
    </>
  );
}
