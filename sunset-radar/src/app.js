// Bootstrap: migrate, sync the vendor catalog, register routes, listen, and
// start the autopilot.
import { config } from './config.js';
import { log } from './log.js';
import { migrate, closeDb } from './db.js';
import { syncCatalog } from './store/catalog.js';
import { createServer } from './http/server.js';
import { startScheduler, stopScheduler } from './scheduler.js';

// Importing these registers their routes on the shared router.
import './routes/ui.js';
import './routes/api.js';
import './routes/billing.js';

export function bootstrap() {
  const applied = migrate();
  const catalog = syncCatalog();
  log.info('bootstrap', { migrations: applied, vendors_added: catalog.added, sources_added: catalog.sourcesAdded, catalog: catalog.catalogVersion });
  return { applied, catalog };
}

export async function start() {
  bootstrap();
  const server = createServer();
  await new Promise((resolve) => server.listen(config.port, config.host, resolve));
  log.info('listening', { url: config.baseUrl, host: config.host, port: config.port, single_tenant: config.singleTenant });
  startScheduler();

  const shutdown = (signal) => {
    log.info('shutting down', { signal });
    stopScheduler();
    server.close(() => { closeDb(); process.exit(0); });
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  return server;
}
