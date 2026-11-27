import { NotFoundMessage } from '@/components/not-found-message';

/** A visitor who follows a broken link is owed a sentence and a way home. */
export default function PublicNotFound() {
  return (
    <main
      id="main"
      className="flex flex-1 flex-col items-center justify-center p-8"
    >
      <NotFoundMessage />
    </main>
  );
}
