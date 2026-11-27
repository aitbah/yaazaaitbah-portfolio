import { Amiri, Fraunces, Geist_Mono, Inter, Tajawal } from 'next/font/google';

/**
 * A text face per script; `globals.css` picks one by `lang`. Only Latin is
 * preloaded: Arabic pages still draw numbers, brand names and untranslated rows
 * in it.
 */
export const textFont = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-text-latin',
});

export const textFontArabic = Tajawal({
  subsets: ['arabic'],
  // Not variable, so the weights are named.
  weight: ['400', '500', '700'],
  display: 'swap',
  preload: false,
  variable: '--font-text-arabic',
});

/**
 * The public site's display face: Fraunces, a high-contrast variable serif,
 * roman and italic, with its optical-size axis so the largest settings draw
 * their finest contrast.
 */
export const displayFont = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  display: 'swap',
  variable: '--font-display-latin',
});

/** Arabic's display face: Amiri, a naskh with the same contrast. Loaded on demand. */
export const displayFontArabic = Amiri({
  subsets: ['arabic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
  variable: '--font-display-arabic',
});

/** Figures and codes in the admin. */
export const monoFont = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono-latin',
});

export const fontVariables = [
  textFont.variable,
  textFontArabic.variable,
  displayFont.variable,
  displayFontArabic.variable,
  monoFont.variable,
].join(' ');
