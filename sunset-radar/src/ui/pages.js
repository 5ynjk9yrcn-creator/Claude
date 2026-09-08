import { page, esc, severityPill, deadlineCell, timeAgo } from './layout.js';
import { PLANS, config } from '../config.js';
import { daysUntil } from '../notify/format.js';

// --- marketing -----------------------------------------------------------

export function landing() {
  const plans = ['free', 'pro', 'team'].map((k) => {
    const p = PLANS[k];
    return `<div class="card price">
      <h3 style="text-transform:uppercase;letter-spacing:.08em;font-size:11.5px;color:var(--muted)">${esc(p.name)}</h3>
      <div class="amt">$${p.priceMonthly}<span style="font-size:14px;color:var(--muted);font-weight:400">/mo</span></div>
      <ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
      <a class="btn primary mt" href="/signup?plan=${esc(p.id)}" style="width:100%;justify-content:center">Start free</a>
    </div>`;
  }).join('');

  return page({
    title: 'Know before your integrations break',
    body: `
    <section class="hero">
      <h1>Your code depends on 30 APIs. Every one of them is quietly planning to break it.</h1>
      <p>Sunset Radar reads the changelogs, release notes and end-of-life calendars of the vendors your repo actually calls — then tells you which of <em>your</em> files will break, and when.</p>
      <div class="cta">
        <a class="btn primary" href="/scan">Scan a repo free</a>
        <a class="btn" href="/docs">Read the docs</a>
      </div>
      <p class="small faint mt">Self-host it or use the hosted version. No agent in your build. Read-only.</p>
    </section>

    <div class="grid c2 mt">
      <div class="card feature"><h3>1 · It reads your code, not a form</h3><p>Point it at a repo. It finds the SDKs, hostnames, endpoints, pinned API versions and runtime pins you depend on — with file and line numbers as evidence.</p></div>
      <div class="card feature"><h3>2 · It watches the vendors, not a page</h3><p>Changelogs, release feeds, deprecation pages and end-of-life calendars for ${esc(String(49))}+ vendors, polled continuously and de-duplicated.</p></div>
      <div class="card feature"><h3>3 · It maps announcements to your files</h3><p>When Stripe deprecates <code>/v1/charges</code>, you don't get a newsletter. You get: <em>3 files, 6 call sites, deadline in 74 days.</em></p></div>
      <div class="card feature"><h3>4 · It only shouts when it should</h3><p>Every item is scored for real breakage. "No action required" gets filed. A removal that hits your code and expires in three weeks pages you.</p></div>
    </div>

    <div class="card mt"><div class="bd">
      <h2>What a finding looks like</h2>
      <div style="border-left:3px solid var(--critical);padding-left:15px;margin-top:12px">
        <div>${severityPill('critical')} <strong>Stripe</strong> · deadline in 21 days</div>
        <div style="font-weight:600;margin:7px 0 5px">The <code>/v1/charges</code> endpoint will be removed</div>
        <p class="muted small" style="margin:0 0 9px">Charges is deprecated in favour of PaymentIntents. Requests after 2026-10-01 will return 410.</p>
        <div class="filelist"><div>src/billing/checkout.js<span class="ln">:42, 88</span></div><div>src/webhooks/stripe.js<span class="ln">:17</span></div><div>tests/billing.test.js<span class="ln">:120</span></div></div>
      </div>
    </div></div>

    <h2 class="mt" id="pricing" style="margin-top:34px">Pricing</h2>
    <p class="sub">Priced per stack, not per seat. Cancel any time.</p>
    <div class="grid c4">${plans}</div>

    <div class="card mt"><div class="bd">
      <h2>Why nothing else does this</h2>
      <p class="muted" style="margin:0">Dependabot watches your lockfile — it can't see a vendor removing an endpoint. Status pages tell you what is broken now, not what breaks in March. Page-change monitors fire on every marketing tweak and know nothing about your code. Sunset Radar is the join between the two halves: what your code uses, and what your vendors are about to change.</p>
    </div></div>`
  });
}

export function docs() {
  return page({
    title: 'Docs',
    body: `<h1>Docs</h1><p class="sub">Everything you need to run Sunset Radar yourself or drive it from CI.</p>

    <div class="card"><div class="bd">
      <h2>Quick start (self-hosted)</h2>
      <pre class="snippet">git clone &lt;your-fork&gt; sunset-radar &amp;&amp; cd sunset-radar
node bin/sunsetradar.js migrate
node bin/sunsetradar.js account:create you@example.com
node bin/sunsetradar.js project:add "My app" --path /srv/my-app
node bin/sunsetradar.js scan --project prj_...
node bin/sunsetradar.js serve</pre>
      <p class="muted small">Node 22.5+. No dependencies to install. The database is a single SQLite file.</p>
    </div></div>

    <div class="card"><div class="bd">
      <h2>The free scan</h2>
      <p class="muted small">Anyone can scan a public repository at <a href="/scan">/scan</a> without an account. The clone is read-only and deleted as soon as the scan finishes; the report is a shareable link that expires after thirty days.</p>
      <pre class="snippet">node bin/sunsetradar.js scan:public vercel/ai-chatbot
node bin/sunsetradar.js bulk --repos repos.txt --out ./deprecation-report</pre>
      <p class="muted small">The second command scans a list of public repos and writes a publishable report, the raw data, and a CSV of every repository already past a deadline.</p>
    </div></div>

    <div class="card"><div class="bd">
      <h2>API</h2>
      <p class="muted small">Create a key under Settings, then send it as <code>Authorization: Bearer sr_…</code>.</p>
      <pre class="snippet">GET    /api/v1/me
GET    /api/v1/projects
POST   /api/v1/projects            {"name":"My app","repo_path":"/srv/app"}
POST   /api/v1/projects/:id/scan
GET    /api/v1/projects/:id/inventory
GET    /api/v1/findings?status=open&min_severity=high&limit=50
GET    /api/v1/findings/:id
PATCH  /api/v1/findings/:id        {"status":"acknowledged"}
GET    /api/v1/deadlines?days=90
GET    /api/v1/vendors</pre>
    </div></div>

    <div class="card"><div class="bd">
      <h2>Webhooks</h2>
      <p class="muted small">Every webhook body is signed. Verify it before trusting it:</p>
      <pre class="snippet">const expected = crypto.createHmac('sha256', channelSecret)
  .update(rawBody).digest('hex');
if (\`sha256=\${expected}\` !== req.headers['x-sunsetradar-signature']) reject();</pre>
    </div></div>

    <div class="card"><div class="bd">
      <h2>CI gate</h2>
      <p class="muted small">Fail a build when a critical, code-matched change is outstanding:</p>
      <pre class="snippet">curl -sf -H "Authorization: Bearer $SUNSET_KEY" \\
  "$SUNSET_URL/api/v1/findings?status=open&min_severity=critical" \\
  | node -e "process.stdin.on('data',d=>{const n=JSON.parse(d).findings.length;if(n){console.error(n+' critical API changes affect this repo');process.exit(1)}})"</pre>
    </div></div>`
  });
}

export function login({ error = null, next = '/dashboard', email = '' } = {}) {
  return page({
    title: 'Sign in',
    body: `<div style="max-width:390px;margin:44px auto">
      <h1>Sign in</h1><p class="sub">Welcome back.</p>
      ${error ? `<div class="flash err">${esc(error)}</div>` : ''}
      <div class="card"><div class="bd">
        <form method="post" action="/login">
          <input type="hidden" name="next" value="${esc(next)}">
          <div class="field"><label>Email</label><input type="email" name="email" value="${esc(email)}" required autofocus></div>
          <div class="field"><label>Password</label><input type="password" name="password" required></div>
          <button class="btn primary" type="submit" style="width:100%;justify-content:center">Sign in</button>
        </form>
      </div></div>
      <p class="small muted mt" style="text-align:center">No account? <a href="/signup">Create one</a>.</p>
    </div>`
  });
}

export function signup({ error = null, plan = 'free', email = '' } = {}) {
  return page({
    title: 'Create account',
    body: `<div style="max-width:390px;margin:44px auto">
      <h1>Create your account</h1><p class="sub">Scan a repo and see what is coming for it.</p>
      ${error ? `<div class="flash err">${esc(error)}</div>` : ''}
      <div class="card"><div class="bd">
        <form method="post" action="/signup">
          <input type="hidden" name="plan" value="${esc(plan)}">
          <div class="field"><label>Email</label><input type="email" name="email" value="${esc(email)}" required autofocus></div>
          <div class="field"><label>Password</label><input type="password" name="password" minlength="8" required></div>
          <div class="field"><label>First project name</label><input name="project" placeholder="My app" required></div>
          <div class="field"><label>Repo path on this server <span class="faint">(or leave blank and add it later)</span></label><input name="repo_path" placeholder="/srv/my-app"></div>
          <button class="btn primary" type="submit" style="width:100%;justify-content:center">Create account</button>
        </form>
      </div></div>
      <p class="small muted mt" style="text-align:center">Already have one? <a href="/login">Sign in</a>.</p>
    </div>`
  });
}

// --- app -----------------------------------------------------------------

const findingRow = (f) => `
  <tr class="row">
    <td style="width:88px">${severityPill(f.severity)}</td>
    <td>
      <a class="t-title" href="/findings/${esc(f.id)}">${esc(f.title)}</a>
      <span class="t-meta">${esc(f.vendor_name)} · ${esc(f.project_name)}${f.published_at ? ` · ${esc(timeAgo(f.published_at))}` : ''}</span>
    </td>
    <td style="width:120px">${f.matched_files ? `<strong>${f.matched_files}</strong> <span class="small muted">file${f.matched_files === 1 ? '' : 's'}</span>` : '<span class="faint small">no match</span>'}</td>
    <td style="width:170px">${deadlineCell(f.deadline_at)}</td>
  </tr>`;

export function dashboard({ account, counts, findings, projects, lastPoll, watchedVendors, flash }) {
  const stats = `
    <div class="grid c4 mb">
      <div class="stat crit"><div class="n">${counts.critical}</div><div class="l">Critical</div></div>
      <div class="stat high"><div class="n">${counts.high}</div><div class="l">High</div></div>
      <div class="stat"><div class="n">${counts.medium + counts.low}</div><div class="l">Medium &amp; low</div></div>
      <div class="stat ok"><div class="n">${watchedVendors}</div><div class="l">Vendors watched</div></div>
    </div>`;

  const projectCards = projects.map((p) => `
    <tr class="row">
      <td><a class="t-title" href="/projects/${esc(p.id)}">${esc(p.name)}</a>
        <span class="t-meta">${esc(p.repo_path || p.repo_url || 'no repo configured')}</span></td>
      <td class="small muted" style="width:150px">${p.last_scan_at ? `scanned ${esc(timeAgo(p.last_scan_at))}` : 'never scanned'}</td>
      <td style="width:110px"><form method="post" action="/projects/${esc(p.id)}/scan"><button class="btn sm" type="submit">Rescan</button></form></td>
    </tr>`).join('');

  return page({
    title: 'Radar', account, active: 'dashboard', flash,
    body: `<h1>Radar</h1>
    <p class="sub">Open changes across ${projects.length} project${projects.length === 1 ? '' : 's'}. Last poll ${esc(timeAgo(lastPoll))}.</p>
    ${stats}
    <div class="card">
      <div class="hd"><h2>Open findings</h2><span class="pill plain">${counts.total}</span>
        <span style="margin-left:auto" class="small muted">sorted by severity, then deadline</span></div>
      ${findings.length
        ? `<div class="bd tight"><table><thead><tr><th>Severity</th><th>Change</th><th>Your code</th><th>Deadline</th></tr></thead><tbody>${findings.map(findingRow).join('')}</tbody></table></div>`
        : `<div class="empty"><h3>Nothing on the radar</h3><p class="small">Either your vendors have been quiet, or you have not scanned a repo yet.</p></div>`}
    </div>

    <div class="card">
      <div class="hd"><h2>Projects</h2>
        <a class="btn sm primary" href="/projects/new" style="margin-left:auto">Add project</a></div>
      ${projects.length ? `<div class="bd tight"><table><tbody>${projectCards}</tbody></table></div>` : '<div class="empty"><h3>No projects yet</h3><p class="small"><a href="/projects/new">Add one</a> and point it at a repo.</p></div>'}
    </div>`
  });
}

export function newProject({ account, error = null }) {
  return page({
    title: 'Add project', account, active: 'dashboard',
    body: `<h1>Add a project</h1><p class="sub">A project is one repository. Sunset Radar reads it; it never writes to it.</p>
    ${error ? `<div class="flash err">${esc(error)}</div>` : ''}
    <div class="card" style="max-width:560px"><div class="bd">
      <form method="post" action="/projects">
        <div class="field"><label>Name</label><input name="name" required autofocus placeholder="Checkout service"></div>
        <div class="field"><label>Repo path on this server</label><input name="repo_path" placeholder="/srv/checkout"></div>
        <div class="field"><label>…or a public https git URL to clone</label><input name="repo_url" placeholder="https://github.com/acme/checkout"></div>
        <button class="btn primary" type="submit">Create and scan</button>
      </form>
    </div></div>`
  });
}

export function projectPage({ account, project, inventory, watchlist, findings, counts, flash }) {
  const invRows = inventory.map((v) => `
    <tr class="row">
      <td><span class="t-title">${esc(v.name)}</span><span class="t-meta">${esc(v.category || '')} · ${v.evidence} signal${v.evidence === 1 ? '' : 's'} in ${v.files} file${v.files === 1 ? '' : 's'}</span></td>
      <td style="width:120px">${v.watched ? '<span class="pill ok">watching</span>' : '<span class="pill plain">not watched</span>'}</td>
      <td style="width:110px" class="small muted">${v.sources} source${v.sources === 1 ? '' : 's'}</td>
      <td style="width:130px">
        ${v.watched
          ? `<form method="post" action="/projects/${esc(project.id)}/mute"><input type="hidden" name="vendor_id" value="${esc(v.vendor_id)}"><button class="btn sm" type="submit">Mute</button></form>`
          : `<form method="post" action="/projects/${esc(project.id)}/watch"><input type="hidden" name="vendor_id" value="${esc(v.vendor_id)}"><button class="btn sm" type="submit">Watch</button></form>`}
      </td>
    </tr>`).join('');

  const scanStats = project.last_scan_stats || {};
  return page({
    title: project.name, account, active: 'dashboard', flash,
    body: `<h1>${esc(project.name)}</h1>
    <p class="sub">${esc(project.repo_path || project.repo_url || 'no repo')} · ${project.last_scan_at ? `scanned ${esc(timeAgo(project.last_scan_at))}` : 'never scanned'}
      ${scanStats.files ? ` · ${scanStats.files} files, ${scanStats.evidence || 0} signals` : ''}</p>

    <div class="grid c4 mb">
      <div class="stat crit"><div class="n">${counts.critical}</div><div class="l">Critical</div></div>
      <div class="stat high"><div class="n">${counts.high}</div><div class="l">High</div></div>
      <div class="stat"><div class="n">${inventory.length}</div><div class="l">Vendors detected</div></div>
      <div class="stat"><div class="n">${watchlist.filter((w) => !w.muted).length}</div><div class="l">Watched</div></div>
    </div>

    <div class="card"><div class="hd"><h2>Findings</h2>
      <form method="post" action="/projects/${esc(project.id)}/scan" style="margin-left:auto"><button class="btn sm primary" type="submit">Rescan now</button></form></div>
      ${findings.length
        ? `<div class="bd tight"><table><thead><tr><th>Severity</th><th>Change</th><th>Your code</th><th>Deadline</th></tr></thead><tbody>${findings.map(findingRow).join('')}</tbody></table></div>`
        : '<div class="empty"><h3>No open findings</h3><p class="small">Nothing your vendors announced maps to this codebase yet.</p></div>'}
    </div>

    <div class="card"><div class="hd"><h2>Detected integrations</h2><span class="pill plain">${inventory.length}</span></div>
      ${inventory.length
        ? `<div class="bd tight"><table><thead><tr><th>Vendor</th><th>Status</th><th>Feeds</th><th></th></tr></thead><tbody>${invRows}</tbody></table></div>`
        : '<div class="empty"><h3>Nothing detected</h3><p class="small">Run a scan to build the inventory.</p></div>'}
    </div>`
  });
}

export function findingPage({ account, finding, inventory, flash }) {
  const files = finding.impact?.files || [];
  const matches = finding.impact?.matches || [];
  const days = daysUntil(finding.deadline_at);

  const evidence = matches.slice(0, 25).map((m) => `
    <div style="padding:11px 0;border-bottom:1px solid var(--border)">
      <div><span class="pill plain">${esc(m.kind)}</span> <code>${esc(m.value)}</code>
        <span class="small muted">matched ${esc(m.via || 'text')}${m.hint ? ` “${esc(String(m.hint).slice(0, 50))}”` : ''}</span></div>
      <div class="small muted mono" style="margin-top:5px">${esc(m.file || '')}${m.line ? ':' + m.line : ''}</div>
      ${m.snippet ? `<div class="snippet">${esc(m.snippet)}</div>` : ''}
    </div>`).join('');

  return page({
    title: finding.title, account, active: 'dashboard', flash,
    body: `
    <p class="small"><a href="/dashboard">← Radar</a></p>
    <div style="display:flex;gap:11px;align-items:center;flex-wrap:wrap;margin-bottom:7px">
      ${severityPill(finding.severity)}
      <span class="pill plain">${esc(finding.vendor_name)}</span>
      <span class="pill plain">${esc(finding.project_name)}</span>
      ${finding.categories?.length ? finding.categories.map((c) => `<span class="pill plain">${esc(c)}</span>`).join('') : ''}
    </div>
    <h1 style="max-width:820px">${esc(finding.title)}</h1>
    <p class="sub">${finding.published_at ? `Announced ${esc(finding.published_at.slice(0, 10))}` : 'Undated'}${finding.url ? ` · <a href="${esc(finding.url)}" rel="noopener nofollow">read the vendor announcement →</a>` : ''}</p>

    <div class="split">
      <div>
        <div class="card"><div class="bd">
          <h2>What changes</h2>
          <p style="margin:0 0 14px">${esc(finding.summary || finding.title)}</p>
          ${finding.deadline_at
            ? `<div class="flash ${days !== null && days <= 30 ? 'err' : 'ok'}" style="margin:0">
                <strong>Deadline: ${esc(finding.deadline_at.slice(0, 10))}</strong>
                ${days !== null ? (days < 0 ? ` — passed ${Math.abs(days)} days ago` : ` — ${days} days left`) : ''}
              </div>`
            : '<p class="small faint" style="margin:0">No deadline stated in the announcement.</p>'}
        </div></div>

        <div class="card"><div class="hd"><h2>Your affected code</h2>
          ${finding.matched_files ? `<span class="pill critical">${finding.matched_files} file${finding.matched_files === 1 ? '' : 's'}</span>` : '<span class="pill plain">no direct match</span>'}</div>
          <div class="bd">
          ${files.length
            ? `<div class="filelist">${files.map((f) => `<div>${esc(f.file)}<span class="ln">${f.lines?.length ? ':' + f.lines.join(', ') : ''}</span></div>`).join('')}</div>
               <h3 class="mt">Why these matched</h3>${evidence}`
            : `<p class="muted" style="margin:0">Nothing in the scanned code matched the identifiers in this announcement. It is on your radar because this project uses ${esc(finding.vendor_name)} — check by hand if the change touches a code path the scanner cannot see (dynamic URLs, generated clients, infrastructure config).</p>`}
        </div></div>

        ${finding.body ? `<div class="card"><div class="hd"><h2>The announcement</h2></div><div class="bd"><div class="small muted" style="white-space:pre-wrap;max-height:420px;overflow:auto">${esc(finding.body.slice(0, 6000))}</div></div></div>` : ''}
      </div>

      <div>
        <div class="card"><div class="bd">
          <h3>Status</h3>
          <form method="post" action="/findings/${esc(finding.id)}/status">
            <div class="field"><select name="status">
              ${['open', 'acknowledged', 'resolved', 'ignored'].map((s) => `<option value="${s}" ${finding.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select></div>
            <button class="btn primary sm" type="submit" style="width:100%;justify-content:center">Update</button>
          </form>
          <div class="hr"></div>
          <dl class="kv">
            <dt>Risk score</dt><dd>${finding.score}</dd>
            <dt>Vendor</dt><dd>${esc(finding.vendor_name)}</dd>
            <dt>Detected</dt><dd>${esc(timeAgo(finding.created_at))}</dd>
            <dt>Notified</dt><dd>${finding.notified_at ? esc(timeAgo(finding.notified_at)) : 'not sent'}</dd>
          </dl>
        </div></div>

        <div class="card"><div class="bd">
          <h3>How this project uses ${esc(finding.vendor_name)}</h3>
          ${inventory.length
            ? `<div class="filelist wrap" style="max-height:300px;overflow:auto">${inventory.slice(0, 40).map((i) => `<div>${esc(i.kind)}: ${esc(i.value)}<span class="ln"> — ${esc(i.file || '')}${i.line ? ':' + i.line : ''}</span></div>`).join('')}</div>`
            : '<p class="small muted" style="margin:0">No inventory rows recorded.</p>'}
        </div></div>
      </div>
    </div>`
  });
}

export function deadlinesPage({ account, deadlines }) {
  const rows = deadlines.map((f) => {
    const d = daysUntil(f.deadline_at);
    return `<tr class="row">
      <td style="width:170px">${deadlineCell(f.deadline_at)}</td>
      <td style="width:88px">${severityPill(f.severity)}</td>
      <td><a class="t-title" href="/findings/${esc(f.id)}">${esc(f.title)}</a><span class="t-meta">${esc(f.vendor_name)} · ${esc(f.project_name)}</span></td>
      <td style="width:110px">${f.matched_files ? `<strong>${f.matched_files}</strong> <span class="small muted">file${f.matched_files === 1 ? '' : 's'}</span>` : '<span class="faint small">—</span>'}</td>
    </tr>`;
  }).join('');
  return page({
    title: 'Deadlines', account, active: 'deadlines',
    body: `<h1>Deadline calendar</h1><p class="sub">Everything with a date attached, soonest first. This is the list to plan sprints around.</p>
    <div class="card">${deadlines.length
      ? `<div class="bd tight"><table><thead><tr><th>Date</th><th>Severity</th><th>Change</th><th>Your code</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : '<div class="empty"><h3>No dated changes</h3><p class="small">Nothing your vendors announced carries a deadline yet.</p></div>'}</div>`
  });
}

export function inventoryPage({ account, projects, inventories }) {
  const blocks = projects.map((p) => {
    const rows = (inventories[p.id] || []).map((v) => `
      <tr class="row"><td><span class="t-title">${esc(v.name)}</span><span class="t-meta">${esc(v.category || '')}</span></td>
      <td style="width:110px">${v.evidence} signal${v.evidence === 1 ? '' : 's'}</td><td style="width:100px">${v.files} file${v.files === 1 ? '' : 's'}</td>
      <td style="width:120px">${v.watched ? '<span class="pill ok">watching</span>' : '<span class="pill plain">muted</span>'}</td></tr>`).join('');
    return `<div class="card"><div class="hd"><h2>${esc(p.name)}</h2><span class="pill plain">${(inventories[p.id] || []).length} vendors</span>
      <a class="btn sm" style="margin-left:auto" href="/projects/${esc(p.id)}">Open</a></div>
      ${rows ? `<div class="bd tight"><table><tbody>${rows}</tbody></table></div>` : '<div class="empty small">Not scanned yet.</div>'}</div>`;
  }).join('');
  return page({
    title: 'Inventory', account, active: 'inventory',
    body: `<h1>Integration inventory</h1><p class="sub">Every third-party dependency Sunset Radar can see in your code — the ground truth everything else is built on.</p>${blocks || '<div class="card"><div class="empty">No projects yet.</div></div>'}`
  });
}

export function sourcesPage({ account, sources, runs }) {
  const rows = sources.map((s) => {
    const ok = s.failure_count === 0 && s.last_status && String(s.last_status).startsWith('2');
    const never = !s.last_polled_at;
    return `<tr class="row">
      <td><span class="t-title">${esc(s.vendor_name)}</span><span class="t-meta mono">${esc(s.url)}</span></td>
      <td style="width:110px" class="small muted">${esc(s.kind)}</td>
      <td style="width:120px">${never ? '<span class="pill plain">never polled</span>' : ok ? '<span class="pill ok">ok</span>' : `<span class="pill critical">${esc(String(s.last_status || 'error'))}</span>`}</td>
      <td style="width:130px" class="small muted">${esc(timeAgo(s.last_polled_at))}</td>
      <td style="width:70px" class="small muted">${s.failure_count || 0} fails</td>
    </tr>`;
  }).join('');
  const runRows = runs.map((r) => `<tr><td class="small">${esc(r.kind)}</td><td class="small muted">${esc(timeAgo(r.started_at))}</td>
    <td class="small">${r.ok === 1 ? '<span class="pill ok">ok</span>' : r.ok === 0 ? '<span class="pill critical">failed</span>' : '<span class="pill plain">running</span>'}</td>
    <td class="small muted mono">${esc((r.stats || '').slice(0, 120))}${r.error ? esc(' ' + r.error.slice(0, 80)) : ''}</td></tr>`).join('');

  return page({
    title: 'Sources', account, active: 'sources', wide: true,
    body: `<h1>Source health</h1><p class="sub">Every feed being polled, and whether it is answering. A dead source is a blind spot.</p>
    <div class="card"><div class="bd tight"><table><thead><tr><th>Vendor / URL</th><th>Kind</th><th>Status</th><th>Last poll</th><th>Failures</th></tr></thead><tbody>${rows}</tbody></table></div></div>
    <div class="card"><div class="hd"><h2>Recent runs</h2></div><div class="bd tight"><table><tbody>${runRows || '<tr><td class="small muted">No runs yet.</td></tr>'}</tbody></table></div></div>`
  });
}

export function settingsPage({ account, channels, apiKeys, newKey, quota, usage, flash }) {
  const plan = PLANS[account.plan] || PLANS.free;
  const channelRows = channels.map((c) => `
    <tr class="row">
      <td style="width:100px"><span class="pill plain">${esc(c.kind)}</span></td>
      <td><span class="mono small">${esc(c.target.length > 60 ? c.target.slice(0, 57) + '…' : c.target)}</span>
        <span class="t-meta">≥ ${esc(c.min_severity)}${c.digest ? ' · daily digest' : ''}${c.last_error ? ` · <span style="color:var(--critical)">${esc(c.last_error.slice(0, 60))}</span>` : c.last_ok_at ? ` · ok ${esc(timeAgo(c.last_ok_at))}` : ''}</span></td>
      <td style="width:190px">
        <form method="post" action="/settings/channels/${esc(c.id)}/test" style="display:inline"><button class="btn sm" type="submit">Send test</button></form>
        <form method="post" action="/settings/channels/${esc(c.id)}/delete" style="display:inline"><button class="btn sm danger" type="submit">Delete</button></form>
      </td>
    </tr>`).join('');

  const keyRows = apiKeys.map((k) => `
    <tr class="row"><td>${esc(k.name)}<span class="t-meta mono">${esc(k.prefix)}…</span></td>
    <td class="small muted" style="width:140px">${k.last_used_at ? 'used ' + esc(timeAgo(k.last_used_at)) : 'never used'}</td>
    <td style="width:110px">${k.revoked_at ? '<span class="pill plain">revoked</span>' : `<form method="post" action="/settings/keys/${esc(k.id)}/revoke"><button class="btn sm danger" type="submit">Revoke</button></form>`}</td></tr>`).join('');

  return page({
    title: 'Settings', account, active: 'settings', flash,
    body: `<h1>Settings</h1><p class="sub">${esc(account.email)} · ${esc(plan.name)} plan</p>

    ${newKey ? `<div class="flash ok"><strong>New API key — copy it now, it is not shown again:</strong><br><code>${esc(newKey)}</code></div>` : ''}

    <div class="card"><div class="hd"><h2>Alert channels</h2></div>
      ${channels.length ? `<div class="bd tight"><table><tbody>${channelRows}</tbody></table></div>` : '<div class="empty small">No channels yet — alerts are visible in the dashboard only.</div>'}
      <div class="bd" style="border-top:1px solid var(--border)">
        <form method="post" action="/settings/channels" class="row-form">
          <div class="field" style="max-width:130px"><label>Kind</label>
            <select name="kind"><option value="slack">Slack</option><option value="webhook">Webhook</option><option value="email">Email</option></select></div>
          <div class="field" style="min-width:280px"><label>Target (webhook URL or email address)</label><input name="target" required placeholder="https://hooks.slack.com/services/..."></div>
          <div class="field" style="max-width:150px"><label>Minimum severity</label>
            <select name="min_severity"><option value="critical">critical</option><option value="high">high</option><option value="medium" selected>medium</option><option value="low">low</option></select></div>
          <div class="field" style="max-width:130px"><label>Mode</label>
            <select name="digest"><option value="0">Immediate</option><option value="1">Daily digest</option></select></div>
          <button class="btn primary" type="submit">Add channel</button>
        </form>
      </div>
    </div>

    <div class="card"><div class="hd"><h2>API keys</h2></div>
      ${apiKeys.length ? `<div class="bd tight"><table><tbody>${keyRows}</tbody></table></div>` : '<div class="empty small">No keys yet.</div>'}
      <div class="bd" style="border-top:1px solid var(--border)">
        <form method="post" action="/settings/keys" class="row-form">
          <div class="field"><label>Key name</label><input name="name" placeholder="CI" required></div>
          <button class="btn" type="submit">Create key</button>
        </form>
      </div>
    </div>

    <div class="card"><div class="hd"><h2>Plan</h2></div><div class="bd">
      <dl class="kv">
        <dt>Plan</dt><dd>${esc(plan.name)} — $${plan.priceMonthly}/mo</dd>
        <dt>Projects</dt><dd>${quota.projects.used} of ${quota.projects.limit}</dd>
        <dt>Polling</dt><dd>every ${plan.pollMinutes} minutes</dd>
        <dt>This month</dt><dd>${usage?.scans || 0} scans · ${usage?.notifications || 0} alerts sent</dd>
      </dl>
      ${config.stripe.secretKey && account.plan === 'free'
        ? `<form method="post" action="/billing/checkout" class="mt"><input type="hidden" name="plan" value="pro"><button class="btn primary" type="submit">Upgrade to Pro</button></form>`
        : config.stripe.secretKey && account.stripe_customer_id
          ? `<form method="post" action="/billing/portal" class="mt"><button class="btn" type="submit">Manage billing</button></form>`
          : '<p class="small faint mt" style="margin-bottom:0">Billing is not configured on this install.</p>'}
    </div></div>`
  });
}

// --- the free scan ------------------------------------------------------

export function scanForm({ account = null, error = null, value = '' }) {
  return page({
    title: 'Scan a repository', account,
    meta: {
      title: 'What deprecations is your repo already carrying?',
      description: 'Paste a public repository URL. Sunset Radar finds the integrations in it and the vendor changes that already apply to them.'
    },
    body: `<div style="max-width:640px;margin:38px auto 0">
      <p class="eyebrow small muted" style="letter-spacing:.08em;text-transform:uppercase;font-weight:600">Free scan · no account</p>
      <h1>What is your repository already carrying?</h1>
      <p class="sub">Paste a public repository URL. We clone it read-only, find every third-party integration in it, and list the vendor changes that already apply — with the files they hit. The clone is deleted the moment the scan finishes.</p>
      ${error ? `<div class="flash err">${esc(error)}</div>` : ''}
      <div class="card"><div class="bd">
        <form method="post" action="/scan">
          <div class="field">
            <label>Public repository URL</label>
            <input name="repo" value="${esc(value)}" required autofocus placeholder="https://github.com/owner/repo" autocomplete="off">
          </div>
          <button class="btn primary" type="submit" style="width:100%;justify-content:center">Scan it</button>
        </form>
        <p class="small faint" style="margin:14px 0 0">GitHub, GitLab, Bitbucket, Codeberg and sourcehut. Private repositories need an account — or self-host and scan anything.</p>
      </div></div>
      <div class="card"><div class="bd">
        <h3>What you get back</h3>
        <p class="small muted" style="margin:0">An inventory of the SDKs, endpoints, pinned API versions and runtime pins in the code; every published vendor change that maps onto them; and the deadlines, soonest first. Shareable link, no signup.</p>
      </div></div>
    </div>`
  });
}

export function scanPending({ account = null, scan }) {
  return page({
    title: `Scanning ${scan.repo_name}`, account,
    body: `<div style="max-width:560px;margin:70px auto;text-align:center">
      <h1 style="font-size:22px">Scanning ${esc(scan.repo_name)}…</h1>
      <p class="sub">Cloning the repository, reading the manifests and source, then checking it against every vendor calendar we watch. This usually takes a few seconds.</p>
      <div class="card"><div class="bd">
        <div class="progress" aria-hidden="true"><span></span></div>
        <p class="small muted" style="margin:14px 0 0">This page refreshes itself. ${scan.status === 'queued' ? 'Waiting for a scan slot.' : 'Working.'}</p>
      </div></div>
      <p class="small faint">If nothing happens after a minute, <a href="/r/${esc(scan.token)}">reload</a>.</p>
    </div>`,
    head: '<meta http-equiv="refresh" content="3">'
  });
}

const scanFindingRow = (f) => `
  <tr class="row">
    <td style="width:88px">${severityPill(f.severity)}</td>
    <td>
      <span class="t-title">${f.url ? `<a href="${esc(f.url)}" rel="noopener nofollow">${esc(f.title)}</a>` : esc(f.title)}</span>
      <span class="t-meta">${esc(f.vendorName)}${f.publishedAt ? ` · announced ${esc(f.publishedAt.slice(0, 10))}` : ''}</span>
      ${f.matchedFiles
        ? `<div class="filelist" style="margin-top:8px">${f.files.map((x) => `<div>${esc(x.file)}<span class="ln">${x.lines?.length ? ':' + x.lines.slice(0, 4).join(', ') : ''}</span></div>`).join('')}</div>`
        : '<div class="small faint" style="margin-top:6px">No direct code match — flagged because this vendor is in the stack.</div>'}
    </td>
    <td style="width:170px">${deadlineCell(f.deadlineAt)}</td>
  </tr>`;

export function scanReport({ account = null, scan, saved = false }) {
  const r = scan.report;
  if (!r) return scanForm({ account, error: scan.error || 'That scan did not finish.' });
  const s = r.summary;
  const expiredLine = s.expired
    ? `<strong>${s.expired}</strong> deadline${s.expired === 1 ? ' has' : 's have'} already passed`
    : 'nothing past its deadline yet';

  const integrations = r.integrations.map((i) => `
    <tr class="row">
      <td><span class="t-title">${esc(i.name)}</span><span class="t-meta">${esc(i.category || '')} · ${i.files} file${i.files === 1 ? '' : 's'}</span></td>
      <td style="width:180px" class="small mono muted">${esc((i.evidence[0]?.value || '').slice(0, 28))}</td>
      <td style="width:130px">${i.sources ? `<span class="pill ok">watched</span>` : '<span class="pill plain">no feed yet</span>'}</td>
    </tr>`).join('');

  return page({
    title: `${scan.repo_name} · scan report`, account, wide: false,
    meta: {
      title: `${scan.repo_name}: ${s.findings} outstanding API change${s.findings === 1 ? '' : 's'}`,
      description: `${s.integrations} third-party integrations detected, ${s.findings} published vendor changes that apply, ${s.expired} deadline(s) already passed.`,
      url: `${config.baseUrl}/r/${scan.token}`
    },
    body: `
    <p class="small"><a href="/scan">← Scan another repository</a></p>
    <h1 style="font-family:var(--mono, inherit)">${esc(r.repo)}</h1>
    <p class="sub">${s.files} files read · ${esc(r.scannedAt.slice(0, 10))} · <a href="${esc(r.repoUrl)}" rel="noopener nofollow">source</a></p>

    <div class="grid c4 mb">
      <div class="stat"><div class="n">${s.integrations}</div><div class="l">Integrations found</div></div>
      <div class="stat ${s.findings ? 'high' : 'ok'}"><div class="n">${s.findings}</div><div class="l">Changes that apply</div></div>
      <div class="stat ${s.expired ? 'crit' : ''}"><div class="n">${s.expired}</div><div class="l">Deadlines passed</div></div>
      <div class="stat"><div class="n">${s.matched}</div><div class="l">Matched to code</div></div>
    </div>

    <div class="card mb"><div class="bd">
      <p style="margin:0">This repository depends on <strong>${s.integrations}</strong> third-party services we can see, and ${expiredLine}.
      ${s.soonest ? `The next deadline is <strong>${esc(s.soonest.slice(0, 10))}</strong>.` : ''}
      ${s.unmonitored ? `<span class="muted">${s.unmonitored} of those vendors publish no feed we track yet.</span>` : ''}</p>
    </div></div>

    <div class="card">
      <div class="hd"><h2>Outstanding changes</h2><span class="pill plain">${r.findings.length}</span>
        <span class="small muted" style="margin-left:auto">worst first, then by deadline</span></div>
      ${r.findings.length
        ? `<div class="bd tight"><table><thead><tr><th>Severity</th><th>Change &amp; the files it hits</th><th>Deadline</th></tr></thead><tbody>${r.findings.map(scanFindingRow).join('')}</tbody></table></div>`
        : `<div class="empty"><h3>Nothing outstanding</h3><p class="small">Either this repository is unusually current, or its vendors have been quiet. Continuous watching is how you keep it that way.</p></div>`}
    </div>

    <div class="card">
      <div class="hd"><h2>Integrations detected</h2><span class="pill plain">${r.integrations.length}</span></div>
      ${integrations ? `<div class="bd tight"><table><tbody>${integrations}</tbody></table></div>` : '<div class="empty small">No third-party integrations detected.</div>'}
    </div>

    <div class="card"><div class="bd">
      <h2>This is one snapshot. The changes keep coming.</h2>
      <p class="muted">Vendors publish deprecations every week. Watching this repository continuously means the next one arrives in Slack the day it is announced, mapped to the files it breaks.</p>
      ${saved ? '<div class="flash ok">Thanks — we will be in touch.</div>' : `
      <form method="post" action="/r/${esc(scan.token)}/email" class="row-form" style="margin-top:14px">
        <div class="field" style="min-width:240px"><label>Watch this repository</label><input type="email" name="email" required placeholder="you@company.com"></div>
        <button class="btn primary" type="submit">Keep me posted</button>
      </form>`}
      <p class="small faint" style="margin:12px 0 0">Or <a href="/signup?repo=${encodeURIComponent(r.repoUrl)}">create an account</a> and start watching now.</p>
    </div></div>

    <p class="small faint">Static analysis has limits: a URL built at runtime, or a call through a generated client, may not be visible here. A finding marked “no direct code match” means exactly that — check it by hand.</p>`
  });
}
