import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

/**
 * Security headers for every response: no framing (the admin's session would
 * ride along in a frame), no MIME sniffing, a strict referrer policy and no
 * hardware permissions. The script policy needs a per-request nonce, so it is
 * set in `proxy.ts`, for the admin.
 */
const SECURITY_HEADERS = [
  /**
   * HSTS, in production only.
   *
   * It is a promise the browser holds for two years, so serving it from a
   * development server on plain HTTP would pin `localhost` to a scheme nothing
   * there speaks. `includeSubDomains` and `preload` are deliberate: this is one
   * host with one certificate.
   */
  ...(process.env.NODE_ENV === 'production'
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ]
    : []),
  // The modern control, and the one that also covers nested frames.
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  // The same rule for browsers that never implemented `frame-ancestors`.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // The full URL of an admin page is not something a third party needs.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Nothing here asks for hardware; saying so stops an embedded document from
  // asking on our behalf.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

/**
 * Where this server reaches the backend, which is not where the browser does:
 * inside a container `localhost` is this container. Read at build time -
 * `output: 'standalone'` freezes `rewrites()` - which is why it is a build
 * argument in `frontend/Dockerfile.prod`.
 */
const INTERNAL_API_URL =
  process.env.INTERNAL_API_URL ?? 'http://localhost:5000';

const nextConfig: NextConfig = {
  // Naming the framework and its version only helps someone matching a CVE.
  poweredByHeader: false,
  // A self-contained server plus the files it needs, so the runtime image can
  // carry no `node_modules` and no source.
  output: 'standalone',
  // The development badge sits over the admin sidebar's account menu and takes
  // its clicks; build errors still show without it.
  devIndicators: false,
  /**
   * Development only: the hosts besides `localhost` that may load the dev
   * server's own scripts. Next blocks them for any other origin, and the page
   * then renders with no script - black, where the 3D world never starts.
   * `127.0.0.1` always; `DEV_HOSTS` adds more, comma-separated - the machine's
   * address on the home network, to open the site from a phone.
   */
  allowedDevOrigins: [
    '127.0.0.1',
    ...(process.env.DEV_HOSTS ?? '')
      .split(',')
      .map((host) => host.trim())
      .filter(Boolean),
  ],
  experimental: {
    /**
     * A URL that matches no route gets `app/global-not-found.tsx`, a complete
     * HTML document. Without it, the root layout sits under `[locale]`, and a
     * missing page came back as Next's bare error shell - no stylesheet, no
     * script - which the browser painted white before anything could style it.
     * The docs name a top-level dynamic root layout as the case for this.
     */
    globalNotFound: true,
  },
  headers: () =>
    Promise.resolve([{ source: '/:path*', headers: SECURITY_HEADERS }]),
  /**
   * Uploads are served from this origin, which is what lets `next/image`
   * optimize them: the optimizer fetches by URL from the server, where the
   * browser's backend address points at the wrong container. `remotePatterns`
   * stays empty.
   */
  rewrites: () =>
    Promise.resolve([
      {
        source: '/uploads/:path*',
        destination: `${INTERNAL_API_URL}/uploads/:path*`,
      },
    ]),
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
