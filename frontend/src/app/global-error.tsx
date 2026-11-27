'use client';

/**
 * The last resort, for a failure in the root layout itself: its own `html` and
 * `body`, untranslated and styled inline, because that machinery is what
 * failed. Everything else is `[locale]/error.tsx`.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          display: 'flex',
          minHeight: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '2rem',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
          Something went wrong
        </h1>
        <p style={{ maxWidth: '40ch', color: '#666' }}>
          This page could not be displayed. Try again, and if it keeps happening
          the problem is on our side.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid #ccc',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
