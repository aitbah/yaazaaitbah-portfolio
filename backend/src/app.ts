import path from 'node:path';

import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import { UPLOADS_ROOT } from './core/storage/storage.service.js';
import {
  ATTACHMENT_CATEGORIES,
  UPLOADS_URL_PREFIX,
} from './core/storage/storage.types.js';
import { authRouter } from './features/auth/auth.routes.js';
import { messageRouter } from './features/message/message.routes.js';
import { optionRouter } from './features/option/option.routes.js';
import { profileRouter } from './features/profile/profile.routes.js';
import { projectRouter } from './features/project/project.routes.js';
import { createCredentialRouter } from './features/credential/credential.routes.js';
import { educationRouter } from './features/education/education.routes.js';
import { languageRouter } from './features/language/language.routes.js';
import { experienceRouter } from './features/experience/experience.routes.js';
import { createExpertiseRouter } from './features/expertise/expertise.routes.js';
import { socialLinkRouter } from './features/social-link/social-link.routes.js';
import { healthRouter } from './core/health/health.routes.js';
import { mailRouter } from './core/mail/mail.routes.js';
import { errorHandler } from './core/middlewares/error-handler.js';
import { notFoundHandler } from './core/middlewares/not-found-handler.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Behind a proxy the client address is a header; `TRUST_PROXY` says how many
  // hops to believe. See `config/env.ts` for why it is a count and not `true`.
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  // The session travels in an HttpOnly cookie, so every route needs it parsed.
  app.use(cookieParser());

  // Uploaded images are read by the frontend on another origin, which helmet's
  // default same-origin resource policy would block. Relaxed here only, and
  // only for files this application wrote itself.
  app.use(
    UPLOADS_URL_PREFIX,
    helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }),
    /**
     * Defence in depth for visitor-supplied bytes: uploads are already
     * signature-checked, and these decide what happens if that ever fails - no
     * MIME sniffing, and a sandbox with no script or origin.
     */
    (_req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; img-src 'self'; sandbox",
      );
      next();
    },
    express.static(UPLOADS_ROOT, {
      index: false,
      dotfiles: 'ignore',
      // Filenames are random and a file is never rewritten in place.
      maxAge: '7d',
      immutable: true,
      /**
       * Some categories are handed over rather than rendered.
       *
       * The headers above already stop a stored file being interpreted as a
       * document *by us*; this stops the browser opening one in its own viewer
       * from our origin at all. A CV is downloaded, which is what the reader
       * wanted, so the safest answer is also the right one.
       */
      setHeaders: (res, filePath) => {
        const category = path.basename(path.dirname(filePath));

        if (ATTACHMENT_CATEGORIES.includes(category as 'resume')) {
          res.setHeader('Content-Disposition', 'attachment');
        }
      },
    }),
  );

  // Infrastructure rather than a feature: it reports on this instance, not
  // on any content the instance holds.
  app.use('/api/health', healthRouter);
  // Also infrastructure: what the transport is, and whether it works.
  app.use('/api/mail', mailRouter);

  // Feature routers mount here, each owned by its feature.
  app.use('/api/auth', authRouter);
  app.use('/api/profile', profileRouter);
  // Three resources, one implementation: see `expertise.routes.ts`.
  app.use('/api/skills', createExpertiseRouter('skill'));
  app.use('/api/technologies', createExpertiseRouter('technology'));
  app.use('/api/tools', createExpertiseRouter('tool'));
  app.use('/api/experience', experienceRouter);
  app.use('/api/education', educationRouter);
  app.use('/api/certifications', createCredentialRouter('certification'));
  app.use('/api/courses', createCredentialRouter('course'));
  app.use('/api/languages', languageRouter);
  app.use('/api/projects', projectRouter);
  app.use('/api/social-links', socialLinkRouter);
  app.use('/api/messages', messageRouter);
  // The lists behind every dropdown, which the owner manages like any content.
  app.use('/api/options', optionRouter);

  // Order matters: unmatched routes first, then the single error exit point.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
