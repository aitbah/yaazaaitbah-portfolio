import { sectionNumber } from './chapter';

/**
 * The biography, on red: the chapter the opening's disc grows into. Every
 * paragraph is set as the statement - large in the serif, one after another -
 * and lit word by word as it is read (`data-lead`).
 */
export function ProfileSection({
  title,
  paragraphs,
}: {
  title: string;
  paragraphs: string[];
}) {
  return (
    <section
      id="about"
      aria-labelledby="about-title"
      data-red-zone
      className="relative z-10 bg-site-red px-[var(--site-pad)] pt-[clamp(56px,10vh,120px)] pb-[clamp(96px,18vh,200px)] text-site-on-red"
    >
      <h2 id="about-title" className="site-label flex items-center gap-3">
        <span aria-hidden>{sectionNumber(1)}</span>
        <span aria-hidden className="h-px w-10 bg-current" />
        {title}
      </h2>
      <div className="mt-[clamp(32px,6vh,72px)] grid max-w-[24ch] gap-[0.9em] text-site-lead">
        {paragraphs.map((paragraph, index) => (
          <p
            key={index}
            data-lead
            className="site-display text-site-lead [&_.word]:opacity-25 [&_.word]:transition-opacity [&_.word]:duration-300 [&_.word[data-lit]]:opacity-100"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}
