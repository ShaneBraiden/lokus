import pino from 'pino';
import { createApp } from './app';
import { loadConfig } from './config';
import { openDatabase } from './db/client';
import { seedAdmin, seedDemo, seedPlatform } from './db/seed';
import { systemClock } from './lib/clock';
import { loadEnvFile } from './lib/env';
import { ConsoleMailer, ResendMailer } from './lib/mailer';

loadEnvFile();

// `--port=N` (used by `npm run dev`) wins over PORT, which dev tooling may set for the web server it launches.
const portArg = process.argv.find((a) => a.startsWith('--port='));
const config = loadConfig(portArg ? { ...process.env, PORT: portArg.slice('--port='.length) } : process.env);
const log = pino({ level: config.logLevel });

async function main() {
  const handle = await openDatabase(config, { onError: (err) => log.error({ err }, 'idle database connection failed') });
  await handle.migrate();
  const deps = {
    config,
    db: handle.db,
    clock: systemClock,
    mailer: config.resendApiKey ? new ResendMailer(config.resendApiKey, config.emailFrom) : new ConsoleMailer(log),
    log,
  };
  await seedPlatform(deps);
  if (config.seedAdminEmail && config.seedAdminPassword) await seedAdmin(deps, config.seedAdminEmail, config.seedAdminPassword);
  if (config.seedDemo && config.env !== 'production') await seedDemo(deps);

  const app = createApp(deps);
  const server = app.listen(config.port, () => {
    log.info(`Lokus API listening on http://localhost:${config.port} (${config.env}, database: ${handle.driver})`);
  });
  const shutdown = () => {
    server.close(() => {
      void handle.close().finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  log.fatal({ err }, 'failed to start');
  process.exit(1);
});
