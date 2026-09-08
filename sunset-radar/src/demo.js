// Demo seed. Loads a sample repository and a set of real-shaped vendor
// announcements so a new install has something true to look at before its
// first live poll — useful for evaluation, screenshots and tests.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';
import { nowIso, run, one } from './db.js';
import { makeItem } from './parse/feed.js';
import { getVendorBySlug, addSource } from './store/catalog.js';
import { getAccountByEmail, createAccount, createApiKey } from './store/accounts.js';
import { createProject, listProjects } from './store/projects.js';
import { upsertItem, fanOutItem, countFindings } from './store/findings.js';
import { scanProject } from './pipeline/scan.js';

export const DEMO_EMAIL = 'demo@sunsetradar.dev';
export const DEMO_PASSWORD = 'radar-demo-2026';

export async function seedDemo({ reset = false, repoPath = null } = {}) {
  const announcements = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'announcements.json'), 'utf8'));

  let account = getAccountByEmail(DEMO_EMAIL);
  if (account && reset) {
    run('DELETE FROM accounts WHERE id = ?', account.id);
    account = null;
  }
  if (!account) {
    account = createAccount({ email: DEMO_EMAIL, password: DEMO_PASSWORD, name: 'Demo', plan: 'pro' });
    createApiKey(account.id, 'demo');
  }

  const dir = repoPath || path.join(ROOT, 'test', 'fixtures', 'sample-repo');
  let project = listProjects(account.id)[0];
  if (!project) project = createProject(account.id, { name: 'Acme Checkout', repoPath: dir });
  const { summary } = await scanProject(project.id);

  // Load the announcements as though they had been polled.
  let loaded = 0;
  for (const a of announcements) {
    const vendor = getVendorBySlug(a.vendor);
    if (!vendor) continue;
    // Disabled on purpose: these carry the demo announcements and must never
    // be polled as if they were a real feed for this vendor.
    const source = addSource(vendor.id, { kind: 'html', url: `demo://${a.vendor}/${a.url.split('#')[0]}`, label: 'demo data', enabled: false });
    const parsed = makeItem({ title: a.title, url: a.url, guid: a.url, published: a.published_at, body: a.body });
    const { item } = upsertItem({ ...source, vendor_id: vendor.id }, parsed);
    fanOutItem(item, { projects: [project] });
    loaded++;
  }

  const counts = countFindings({ projectId: project.id });
  return {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    account,
    project,
    summary,
    loaded,
    findings: counts.total,
    bySeverity: { critical: counts.critical, high: counts.high, medium: counts.medium, low: counts.low }
  };
}
