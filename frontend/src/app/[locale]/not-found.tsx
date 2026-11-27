import { NotFoundMessage } from '@/components/not-found-message';

/**
 * A `notFound()` raised above the public and admin trees - the root layout
 * refusing a locale it does not know.
 *
 * Like every `notFound()` thrown while rendering, it arrives as Next's bare
 * error shell and is built in the browser. Addresses a reader can type are
 * answered as real HTML instead, by `global-not-found.tsx`.
 */
export default function LocaleNotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center p-8">
      <NotFoundMessage />
    </main>
  );
}
