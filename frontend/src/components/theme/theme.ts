/**
 * The theme switch. The class goes on `<html>`, where the `dark` variant and
 * the token block resolve, and it must be there before the first paint.
 */
export const THEMES = ['light', 'dark'] as const;

/** What is on screen. */
export type Theme = (typeof THEMES)[number];

/**
 * What the reader asked for. `system` is not a third palette: it is the
 * absence of a choice, offered as one so that a choice can be taken back.
 */
export const THEME_CHOICES = ['system', ...THEMES] as const;

export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** Namespaced, because a browser holds one `localStorage` per origin. */
export const THEME_STORAGE_KEY = 'portfolio-theme';

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

function isTheme(value: string | null): value is Theme {
  return value !== null && (THEMES as readonly string[]).includes(value);
}

/**
 * The last choice, while storage refuses to keep it - so that choosing a theme
 * still works, for as long as the page is open, when it cannot be remembered.
 * `undefined` while storage is keeping choices.
 */
let unremembered: ThemeChoice | undefined;

/**
 * The choice that was made, or `null` for someone who has not made one - which
 * is not the same as choosing light. Nothing is stored until the toggle is
 * used, so until then the operating system keeps deciding.
 */
export function storedTheme(): Theme | null {
  if (unremembered !== undefined) {
    return unremembered === 'system' ? null : unremembered;
  }

  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);

    return isTheme(stored) ? stored : null;
  } catch {
    // Storage can be unavailable outright - a browser set to block site data,
    // or a private window. The theme still works, it just is not remembered.
    return null;
  }
}

/** `system` is remembered by forgetting: nothing stored means the system decides. */
export function rememberTheme(choice: ThemeChoice): void {
  try {
    if (choice === 'system') {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, choice);
    }
    unremembered = undefined;
  } catch {
    // As above: worth doing, never worth failing over.
    unremembered = choice;
  }
}

/** What should be on screen: the stored choice, else the system's answer. */
export function resolvedTheme(): Theme {
  return storedTheme() ?? (prefersDark() ? 'dark' : 'light');
}

export function prefersDark(): boolean {
  return window.matchMedia(DARK_SCHEME_QUERY).matches;
}

export function watchSystemTheme(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_SCHEME_QUERY);

  media.addEventListener('change', onChange);

  return () => media.removeEventListener('change', onChange);
}

/** The one place the class and the `color-scheme` are written. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;

  root.classList.toggle('dark', theme === 'dark');
  // Tells the browser which way to paint the things CSS does not own: form
  // controls, scrollbars, and the canvas behind an over-scrolled page.
  root.style.colorScheme = theme;
}

/**
 * The same decision again, as a string, to run before anything is painted.
 *
 * It cannot import the functions above - it has to execute before React exists -
 * so it is built from the same constants rather than written out twice. The
 * only values interpolated are the constants in this file; nothing from a user,
 * a request or the database reaches it.
 */
export const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var d=s==="dark"||(s!=="light"&&window.matchMedia(${JSON.stringify(
  DARK_SCHEME_QUERY,
)}).matches);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light";}catch(_){}})();`;
