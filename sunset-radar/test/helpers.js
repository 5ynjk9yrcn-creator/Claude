// Every test file gets its own in-memory database and a fresh catalog.
process.env.DATABASE_PATH = ':memory:';
process.env.LOG_LEVEL = 'silent';
process.env.BASE_URL = 'http://localhost:8080';
process.env.SCHEDULER_ENABLED = 'false';
// The suite is hermetic: nothing here may touch the network.
process.env.HTTP_OFFLINE = 'true';

export async function freshDb() {
  const db = await import('../src/db.js');
  db.migrate();
  const { syncCatalog } = await import('../src/store/catalog.js');
  syncCatalog();
  return db;
}

export const fixture = (name) => new URL(`./fixtures/${name}`, import.meta.url).pathname;
