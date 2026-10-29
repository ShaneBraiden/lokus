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
import { adminRouter } from './modules/admin';
import { candidateRouter } from './modules/candidate';
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
  app.use('/api/candidate', requireCandidate, candidateRouter(deps));
  app.use('/api/attempts/:attemptId', requireCandidate, playerRouter(deps));
  app.use('/api/org/invitations', requireEmployer, employerInvitationsRouter(deps));
  app.use('/api/org', requireEmployer, teamRouter(deps));
  app.use('/api/admin', requireStaff(deps, ['admin']), adminRouter(deps));
  app.use('/api', apiNotFound);

  // Production: serve the built SPA (never the Vite dev server, never source maps).
  if (deps.config.env === 'production' && existsSync(deps.config.webDistDir)) {
    app.use(express.static(deps.config.webDistDir, { index: false, maxAge: '1h', setHeaders: (res, file) => file.includes(`${path.sep}assets${path.sep}`) && res.set('Cache-Control', 'public, max-age=31536000, immutable') }));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(deps.config.webDistDir, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
