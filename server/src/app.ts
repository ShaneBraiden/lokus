import { existsSync } from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { attachAuth, originCheck, requireCandidate, requireEmployer, requireStaff } from './auth/middleware';
import { authRouter } from './auth/routes';
import type { AppDeps } from './context';
import { apiNotFound, errorHandler } from './lib/errors';
import { ConsoleMailer } from './lib/mailer';
import { adminAccessRequestsRouter, publicAccessRequestsRouter } from './modules/accessRequests';
import { adminRouter } from './modules/admin';
import { reviewRouter } from './modules/review';
import { candidateRouter } from './modules/candidate';
import { employerRouter } from './modules/employer';
import { employerInvitationsRouter, publicInvitesRouter } from './modules/invitations';
import { playerRouter } from './modules/player';
import { publicTeamInvitesRouter, teamRouter } from './modules/team';

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  app.set('trust proxy', deps.config.trustProxy);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'img-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          'frame-ancestors': ["'none'"],
          'object-src': ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    pinoHttp({
      logger: deps.log,
      redact: ['req.headers.cookie', 'res.headers["set-cookie"]'],
      autoLogging: { ignore: (req) => req.url === '/api/health' },
    }),
  );
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(originCheck(deps));
  app.use(attachAuth(deps));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: deps.clock.now().toISOString() });
  });
  app.use('/api/auth', authRouter(deps));
  app.use('/api/invites', publicInvitesRouter(deps));
  app.use('/api/team-invites', publicTeamInvitesRouter(deps));
  app.use('/api/access-requests', publicAccessRequestsRouter(deps));
  app.use('/api/candidate', requireCandidate, candidateRouter(deps));
  app.use('/api/attempts/:attemptId', requireCandidate, playerRouter(deps));
  app.use('/api/org/invitations', requireEmployer, employerInvitationsRouter(deps));
  app.use('/api/org', requireEmployer, employerRouter(deps));
  app.use('/api/org', requireEmployer, teamRouter(deps));
  app.use('/api/review', requireStaff(deps, ['admin', 'assessor']), reviewRouter(deps));
  app.use('/api/admin', requireStaff(deps, ['admin']), adminRouter(deps));
  app.use('/api/admin', requireStaff(deps, ['admin']), adminAccessRequestsRouter(deps));
  // Development only: the emails the console mailer would have sent (links included), newest first.
  if (deps.config.env === 'development' && deps.mailer instanceof ConsoleMailer) {
    const mailer = deps.mailer;
    app.get('/api/dev/outbox', (req, res) => {
      const to = typeof req.query.to === 'string' ? req.query.to.toLowerCase() : null;
      res.json({ emails: mailer.recent.filter((m) => !to || m.to === to).map(({ to: t, subject, text, template, at }) => ({ to: t, subject, text, template, at })) });
    });
  }
  app.use('/api', apiNotFound);

  // Production: serve the built SPA (never the Vite dev server, never source maps).
  if (deps.config.env === 'production' && existsSync(deps.config.webDistDir)) {
    app.use(express.static(deps.config.webDistDir, { index: false, maxAge: '1h', setHeaders: (res, file) => file.includes(`${path.sep}assets${path.sep}`) && res.set('Cache-Control', 'public, max-age=31536000, immutable') }));
    app.get(/^(?!\/api\/).*/, (req, res, next) => {
      // A missing file (an old chunk after a deploy, a source map) is a 404, not the app shell.
      if (req.path.startsWith('/assets/') || /\.[a-z0-9]{1,8}$/i.test(req.path)) return next();
      res.sendFile(path.join(deps.config.webDistDir, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
