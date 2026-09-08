#!/usr/bin/env node
// One binary for everything: migrations, accounts, scans, polling, the server.
import { config, PLANS } from '../src/config.js';
import { log } from '../src/log.js';
import { migrate, all, one, kvGet, nowIso } from '../src/db.js';
import { bootstrap, start } from '../src/app.js';
import { syncCatalog, listSources, listVendors } from '../src/store/catalog.js';
import { createAccount, getAccountByEmail, listAccounts, createApiKey, updateAccount } from '../src/store/accounts.js';
import { createProject, listProjects, listAllProjects, getProject, inventorySummary } from '../src/store/projects.js';
import { scanProject } from '../src/pipeline/scan.js';
import { pollCycle, checkSources } from '../src/pipeline/poll.js';
import { dispatchPending, sendDigests } from '../src/notify/dispatch.js';
import { listFindings, countFindings } from '../src/store/findings.js';
import { seedDemo } from '../src/demo.js';
import { tick } from '../src/scheduler.js';

const args = process.argv.slice(2);
const command = args[0] || 'help';
const flag = (name, dflt = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return dflt;
  const next = args[i + 1];
  return !next || next.startsWith('--') ? true : next;
};
const positional = args.slice(1).filter((a) => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') !== true);

const table = (rows, columns) => {
  if (!rows.length) { console.log('  (none)'); return; }
  const widths = columns.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length)));
  console.log('  ' + columns.map((c, i) => c.toUpperCase().padEnd(widths[i])).join('  '));
  for (const r of rows) console.log('  ' + columns.map((c, i) => String(r[c] ?? '').padEnd(widths[i])).join('  '));
};

const die = (message) => { console.error(`error: ${message}`); process.exit(1); };

async function main() {
  switch (command) {
    case 'serve':
      await start();
      break;

    case 'migrate': {
      const applied = migrate();
      const catalog = syncCatalog();
      console.log(`migrations applied: ${applied}`);
      console.log(`vendors: +${catalog.added} updated ${catalog.updated}, sources: +${catalog.sourcesAdded} (catalog ${catalog.catalogVersion})`);
      break;
    }

    case 'account:create': {
      bootstrap();
      const email = positional[0] || flag('email');
      if (!email) die('usage: sunsetradar account:create <email> [--password pw] [--plan pro]');
      if (getAccountByEmail(email)) die(`account already exists: ${email}`);
      const password = flag('password') || Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2, 6);
      const account = createAccount({ email, password, plan: PLANS[flag('plan')] ? flag('plan') : 'free' });
      const key = createApiKey(account.id, 'cli');
      console.log(`account:  ${account.id}`);
      console.log(`email:    ${account.email}`);
      console.log(`password: ${password}`);
      console.log(`api key:  ${key.secret}`);
      console.log('\nSign in at ' + config.baseUrl + '/login');
      break;
    }

    case 'account:list':
      bootstrap();
      table(listAccounts().map((a) => ({ id: a.id, email: a.email, plan: a.plan, status: a.status, created: a.created_at.slice(0, 10) })), ['id', 'email', 'plan', 'status', 'created']);
      break;

    case 'account:plan': {
      bootstrap();
      const account = getAccountByEmail(positional[0] || '');
      if (!account) die('no such account');
      const plan = flag('plan');
      if (!PLANS[plan]) die(`unknown plan (${Object.keys(PLANS).join(', ')})`);
      updateAccount(account.id, { plan });
      console.log(`${account.email} → ${plan}`);
      break;
    }

    case 'key:create': {
      bootstrap();
      const account = getAccountByEmail(positional[0] || flag('account') || '');
      if (!account) die('usage: sunsetradar key:create <email> [--name ci]');
      const key = createApiKey(account.id, flag('name') || 'cli');
      console.log(key.secret);
      break;
    }

    case 'project:add': {
      bootstrap();
      const name = positional[0];
      const path = flag('path');
      const url = flag('url');
      const email = flag('account');
      if (!name) die('usage: sunsetradar project:add "<name>" --path /srv/app [--account you@example.com]');
      const account = email ? getAccountByEmail(email) : listAccounts()[0];
      if (!account) die('no account yet — run: sunsetradar account:create <email>');
      const project = createProject(account.id, { name, repoPath: path === true ? null : path, repoUrl: url === true ? null : url });
      console.log(`created ${project.id} for ${account.email}`);
      if (project.repo_path || project.repo_url) {
        const { summary } = await scanProject(project.id);
        console.log(`scanned: ${summary.vendors} vendors, ${summary.evidence} signals, watching ${summary.watched}`);
      }
      break;
    }

    case 'project:list':
      bootstrap();
      table(listAllProjects().map((p) => ({
        id: p.id, name: p.name, repo: p.repo_path || p.repo_url || '—',
        scanned: p.last_scan_at ? p.last_scan_at.slice(0, 16).replace('T', ' ') : 'never',
        open: countFindings({ projectId: p.id }).total
      })), ['id', 'name', 'repo', 'scanned', 'open']);
      break;

    case 'scan': {
      bootstrap();
      const target = flag('project');
      const projects = target && target !== true ? [getProject(target)].filter(Boolean) : listAllProjects();
      if (!projects.length) die('no projects to scan');
      for (const project of projects) {
        try {
          const { summary, stats } = await scanProject(project.id);
          console.log(`${project.name}: ${summary.vendors} vendors, ${summary.evidence} signals, ${summary.watched} new watches, ${stats.files} files in ${stats.durationMs}ms`);
          table(inventorySummary(project.id).map((v) => ({ vendor: v.name, signals: v.evidence, files: v.files, watched: v.watched ? 'yes' : 'no', feeds: v.sources })), ['vendor', 'signals', 'files', 'watched', 'feeds']);
        } catch (err) {
          console.error(`${project.name}: scan failed — ${err.message}`);
        }
      }
      break;
    }

    case 'poll': {
      bootstrap();
      const stats = await pollCycle({ limit: parseInt(flag('limit'), 10) || 30, onlyWatched: flag('all') ? false : true });
      console.log(JSON.stringify(stats, null, 2));
      break;
    }

    case 'tick': {
      bootstrap();
      console.log(JSON.stringify(await tick(), null, 2));
      break;
    }

    case 'dispatch':
      bootstrap();
      console.log(JSON.stringify(await dispatchPending({ dryRun: Boolean(flag('dry-run')) }), null, 2));
      break;

    case 'digest':
      bootstrap();
      console.log(JSON.stringify(await sendDigests({ hours: parseInt(flag('hours'), 10) || 24, dryRun: Boolean(flag('dry-run')) }), null, 2));
      break;

    case 'findings': {
      bootstrap();
      const rows = listFindings({ status: flag('status') === true ? null : (flag('status') || 'open'), minSeverity: flag('min-severity') || null, limit: parseInt(flag('limit'), 10) || 30 });
      table(rows.map((f) => ({
        severity: f.severity, vendor: f.vendor_name,
        title: f.title.slice(0, 58), files: f.matched_files,
        deadline: f.deadline_at ? f.deadline_at.slice(0, 10) : '—'
      })), ['severity', 'vendor', 'title', 'files', 'deadline']);
      break;
    }

    case 'sources:check': {
      bootstrap();
      const report = await checkSources({});
      table(report.map((r) => ({ vendor: r.vendor, status: r.ok ? 'ok' : (r.status || 'err'), url: r.url.slice(0, 70) })), ['vendor', 'status', 'url']);
      const bad = report.filter((r) => !r.ok);
      console.log(`\n${report.length - bad.length}/${report.length} sources reachable`);
      if (bad.length) process.exitCode = 1;
      break;
    }

    case 'sources:list':
      bootstrap();
      table(listSources().map((s) => ({ vendor: s.vendor_name, kind: s.kind, url: s.url.slice(0, 70), polled: s.last_polled_at ? s.last_polled_at.slice(0, 16).replace('T', ' ') : 'never', fails: s.failure_count })), ['vendor', 'kind', 'url', 'polled', 'fails']);
      break;

    case 'demo': {
      bootstrap();
      const out = await seedDemo({ reset: Boolean(flag('reset')) });
      console.log(`demo account: ${out.email} / ${out.password}`);
      console.log(`project:      ${out.project.name} (${out.project.id})`);
      console.log(`inventory:    ${out.summary.vendors} vendors, ${out.summary.evidence} signals`);
      console.log(`findings:     ${out.findings} (${Object.entries(out.bySeverity).map(([k, v]) => `${v} ${k}`).join(', ') || 'none'})`);
      console.log(`\nStart the server and sign in:\n  node bin/sunsetradar.js serve\n  open ${config.baseUrl}/login`);
      break;
    }

    case 'status': {
      bootstrap();
      console.log(`database:   ${config.dbPath}`);
      console.log(`accounts:   ${listAccounts().length}`);
      console.log(`projects:   ${listAllProjects().length}`);
      console.log(`vendors:    ${listVendors().length}`);
      console.log(`sources:    ${listSources().length}`);
      console.log(`last poll:  ${kvGet('last_poll_at') || 'never'}`);
      const counts = countFindings({});
      console.log(`findings:   ${counts.total} open (${counts.critical} critical, ${counts.high} high, ${counts.medium} medium)`);
      const failing = all('SELECT vendor_id, url, last_status, failure_count FROM sources WHERE failure_count > 2 LIMIT 10');
      if (failing.length) console.log(`\n${failing.length} source(s) failing — run: sunsetradar sources:check`);
      break;
    }

    case 'site:build': {
      // Export the marketing page and docs as static HTML, for hosting the
      // front of the funnel separately from the app.
      const fs = await import('node:fs');
      const path = await import('node:path');
      const { landing, docs } = await import('../src/ui/pages.js');
      const { ROOT } = await import('../src/config.js');
      const out = flag('out') && flag('out') !== true ? flag('out') : path.default.join(ROOT, 'www');
      // On a static host the app lives elsewhere; point the buttons at it.
      const appUrl = flag('app-url') && flag('app-url') !== true ? String(flag('app-url')).replace(/\/$/, '') : '';
      const rewrite = (html) => (appUrl ? html.replace(/href="\/(signup|login|dashboard|docs)([^"]*)"/g, `href="${appUrl}/$1$2"`) : html);
      fs.default.mkdirSync(out, { recursive: true });
      fs.default.writeFileSync(path.default.join(out, 'index.html'), rewrite(landing()));
      fs.default.writeFileSync(path.default.join(out, 'docs.html'), rewrite(docs()));
      console.log(`wrote ${path.default.join(out, 'index.html')} and docs.html${appUrl ? ` (links → ${appUrl})` : ''}`);
      break;
    }

    case 'version':
      console.log('sunset-radar 1.0.0');
      break;

    default:
      console.log(`Sunset Radar — know before your integrations break.

USAGE
  sunsetradar <command> [options]

SETUP
  migrate                          Create/upgrade the database and sync the vendor catalog
  account:create <email>           Create an account (prints password + API key)
  project:add "<name>" --path DIR  Add a project and scan it (or --url https://github.com/…)
  demo                             Seed a demo account with a sample repo and findings
  site:build [--out DIR]           Export the marketing page and docs as static HTML

RUN
  serve                            Start the web app, API and scheduler
  scan [--project ID]              Rescan repositories now
  poll [--limit N] [--all]         Fetch due vendor sources now
  tick                             Run one full scheduler cycle (poll + alert + rescan)
  dispatch [--dry-run]             Send queued alerts
  digest [--hours 24]              Send digests now

INSPECT
  status                           One-screen health summary
  findings [--min-severity high]   List open findings
  project:list / account:list      List projects / accounts
  sources:list / sources:check     List feeds / verify every feed URL is alive

Docs: ${config.baseUrl}/docs`);
  }
}

main().catch((err) => {
  log.error('cli failed', { command, error: err.message });
  console.error(err.stack);
  process.exit(1);
});
