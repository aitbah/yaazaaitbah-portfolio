/**
 * The companion: a vermilion Enter key that keeps the reader company down the
 * page, turning as it scrolls, and takes them to Contact when pressed.
 *
 * It is a pre-rendered turn - 36 frames of a 3D model, one image
 * (`public/site/enter-key.webp`, 6 × 6) - so no 3D library runs on the page;
 * the motion picks the frame. A second way to Contact, the bar's *Let's talk*
 * being the first, so it is kept from assistive technology and the tab order.
 * The motion shows it once the opening has let go, and steps it away wherever
 * it would cover text, a control, an image or red; without the motion it
 * never shows, and its image is never fetched.
 */
export function SiteCompanion({ label }: { label: string }) {
  return (
    <a
      href="#contact"
      data-companion
      data-away
      aria-hidden
      tabIndex={-1}
      title={label}
      className="site-companion group fixed end-[var(--site-pad)] bottom-[clamp(16px,3vh,32px)] z-40 hidden size-16 transition-[opacity,scale] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] data-[away]:pointer-events-none data-[away]:scale-75 data-[away]:opacity-0 data-[on]:block md:size-[104px]"
    >
      <span
        data-companion-key
        className="block size-full bg-[url(/site/enter-key.webp)] bg-[length:600%_600%] bg-no-repeat transition-[translate,scale] duration-300 group-hover:-translate-y-1.5 group-active:translate-y-1 group-active:scale-95"
      />
    </a>
  );
}
