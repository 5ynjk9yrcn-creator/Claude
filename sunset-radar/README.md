# Sunset Radar

**Know before your integrations break.**

Your application calls twenty or thirty third-party APIs. Every one of those vendors is quietly
planning to remove an endpoint, retire an API version, drop a runtime, tighten a rate limit or
raise a price — and each announces it in a changelog nobody on your team reads. You find out at
3am, or on the invoice.

Sunset Radar closes that loop automatically:

1. **Scans your repository** and builds an inventory of the integrations you actually use — SDK
   packages, API hostnames, endpoint paths, pinned API versions, runtime pins, CI action pins —
   each with file and line evidence.
2. **Watches those vendors** continuously: changelogs, release feeds, deprecation pages and
   end-of-life calendars. 49 vendors ship in the catalog; adding more is a data change.
3. **Scores every announcement** for real breakage, extracts the date it takes effect, and
   discards the "no action required" noise.
4. **Maps the announcement back to your code** — the part nothing else does. Not "Stripe posted
   something", but *"`/v1/charges` is removed on 2027-03-01; you call it in `src/billing.js:9`
   and pin `2024-06-20` in `src/billing.js:4`."*
5. **Tells you**, in Slack, email, a signed webhook, the dashboard, or your CI gate.

It runs unattended. One process, one SQLite file, an internal scheduler, and **zero runtime
dependencies** — no npm install, no framework, no supply chain.

---

## Quick start

Requires Node 22.5 or newer. Nothing to install.

```bash
node bin/sunsetradar.js migrate                       # create the database, load the catalog
node bin/sunsetradar.js demo                          # seed a demo account + sample repo
node bin/sunsetradar.js serve                         # http://localhost:8080
```

Sign in with the credentials the demo command prints. You will see a radar with real findings
mapped to real files in the bundled sample repository.

For your own code:

```bash
node bin/sunsetradar.js account:create you@example.com
node bin/sunsetradar.js project:add "My app" --path /srv/my-app
node bin/sunsetradar.js scan
node bin/sunsetradar.js poll          # fetch the vendor feeds now
node bin/sunsetradar.js findings      # what it found
node bin/sunsetradar.js serve         # or just run the server; the scheduler does all of this
```

### Docker

```bash
cp .env.example .env && $EDITOR .env
docker compose up -d
docker compose exec sunsetradar node bin/sunsetradar.js account:create you@example.com
```

Mount the repositories you want watched read-only (see the commented volume in
`docker-compose.yml`), or give a project a public `https` git URL and it will clone and refresh
the repo itself.

---

## How it works

```
     repo ──▶ scanner ──▶ inventory (vendor, kind, value, file:line)
                                │
 vendor feeds ──▶ fetch ──▶ parse ──▶ item ──▶ risk score + deadline
   (rss/atom/       (etag,     (rss,             │
    html/eol/       304,        atom,            ▼
    releases)       hash)       html,     impact mapping ── inventory ∩ announcement
                                json)            │
                                                 ▼
                                          finding (severity, files, deadline)
                                                 │
                                    ┌────────────┼────────────┐
                                 Slack        webhook       email / digest
                                              dashboard · JSON API · CI gate
```

Sources are fetched **once globally** and fanned out per project. That is what makes the hosted
version cheap: a thousand customers watching Stripe cost one HTTP request an hour, not a thousand.

**Severity** blends three inputs: how breaking the language is, whether the announcement maps to
code you actually have, and how close the deadline is. `critical` is reserved for changes tied to
your codebase or expiring within six weeks — so when it fires, it means it.

Three rules exist purely to keep alerts trustworthy:

- The same announcement carried by two feeds raises **one** finding, not two.
- An announcement over a year old only becomes a finding if it still matches your code.
- A newly added channel does **not** replay the backlog — it reports what is found from the moment
  it exists. The dashboard keeps the history.

---

## Configuration

Everything is environment driven; see `.env.example` for the full list.

| Variable | Default | Purpose |
|---|---|---|
| `PORT`, `BASE_URL` | `8080`, `http://localhost:8080` | Where it listens and how it links to itself |
| `DATABASE_PATH` | `./data/sunsetradar.db` | SQLite file |
| `SINGLE_TENANT` | `false` | Self-hosted mode: no signup, every visitor is the owner |
| `SCHEDULER_ENABLED` | `true` | The autopilot (poll, alert, rescan, digest, housekeeping) |
| `ANTHROPIC_API_KEY` | — | Optional. Sharpens summaries and severity on high-scoring items only |
| `EMAIL_PROVIDER` | — | `resend`, `postmark` or `smtp` |
| `STRIPE_SECRET_KEY` | — | Only needed if you sell subscriptions |

Without an LLM key the product is fully functional: the heuristics do the triage. The key buys
better prose and a second opinion, and it can only *raise* severity — a bad completion can never
silence an alert.

---

## CLI

```
serve                            Web app, API and scheduler
migrate                          Create/upgrade the database and sync the vendor catalog
account:create <email>           Create an account (prints password + API key)
account:list / account:plan      Manage accounts and plans
project:add "<name>" --path DIR  Add a project and scan it (or --url https://github.com/…)
project:list                     List projects with open finding counts
scan [--project ID]              Rescan repositories now
poll [--limit N] [--all]         Fetch due vendor sources now
tick                             One full scheduler cycle
dispatch [--dry-run]             Send queued alerts
digest [--hours 24]              Send digests now
findings [--min-severity high]   List open findings
sources:list / sources:check     List feeds / verify every feed URL is alive
status                           One-screen health summary
demo [--reset]                   Seed the demo account
site:build [--out DIR] [--app-url URL]   Export the marketing page as static HTML
```

---

## API

Create a key in **Settings**, then:

```bash
curl -H "Authorization: Bearer sr_…" https://radar.example.com/api/v1/findings?min_severity=high
```

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/me` | Account, plan limits, usage, counts |
| `GET`/`POST` | `/api/v1/projects` | List / create projects |
| `POST` | `/api/v1/projects/:id/scan` | Rescan now |
| `GET` | `/api/v1/projects/:id/inventory` | Full inventory with evidence |
| `GET` | `/api/v1/findings` | Filter by `status`, `min_severity`, `project_id`, `with_deadline` |
| `GET`/`PATCH` | `/api/v1/findings/:id` | Detail / change status |
| `GET` | `/api/v1/deadlines?days=90` | The deadline calendar |
| `GET` | `/api/v1/vendors` | Catalog and per-source health |
| `GET`/`POST`/`DELETE` | `/api/v1/channels` | Alert routing |
| `GET` | `/healthz` | Unauthenticated liveness and state |

### CI gate

Fail a build when something critical is outstanding:

```bash
curl -sf -H "Authorization: Bearer $SUNSET_KEY" \
  "$SUNSET_URL/api/v1/findings?status=open&min_severity=critical" \
| node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
    const f=JSON.parse(d).findings; if(f.length){console.error(f.map(x=>x.title).join('\n'));process.exit(1)}})"
```

### Webhooks

Every webhook body is signed with the channel secret:

```js
const expected = crypto.createHmac('sha256', channelSecret).update(rawBody).digest('hex');
if (`sha256=${expected}` !== req.headers['x-sunsetradar-signature']) return reject();
```

---

## Extending the catalog

`src/catalog/vendors.js` is plain data. A vendor entry says how to recognise the vendor in code
and where it announces changes:

```js
{
  slug: 'acme', name: 'Acme', category: 'payments',
  detect: {
    packages: { npm: ['acme-sdk'], pypi: ['acme'] },
    hosts: ['api.acme.com'],
    envVars: ['ACME_API_KEY'],
    versionPins: ['Acme-Version'],
    symbols: ['acme\\.(?:charges|refunds)\\.[a-zA-Z]+']
  },
  sources: [{ kind: 'html', url: 'https://docs.acme.com/changelog', label: 'Changelog' }]
}
```

`kind` is one of `rss`, `atom`, `json`, `html`, `github_releases` (use
`https://github.com/OWNER/REPO/releases.atom`), or `eol` (an
[endoflife.date](https://endoflife.date) product JSON — the richest deadline source there is).

Run `node bin/sunsetradar.js migrate` to sync additions, and `sources:check` to confirm every URL
answers. Operators can also add sources per install without touching code, through the database.

---

## Security

- Passwords: scrypt with per-password salts and parameters stored in the hash.
- Sessions: random 256-bit tokens, stored hashed, HttpOnly + SameSite cookies, server-side expiry.
- API keys: shown once, stored as SHA-256, compared in constant time, revocable.
- Webhooks out: HMAC-SHA256 signed. Stripe webhooks in: signature and timestamp verified.
- Tenant isolation is enforced in every query; there is a test that proves one account cannot read
  another's data.
- Rate limits on login, API and write endpoints.
- The scanner only ever **reads** your code, and only stores short snippets as evidence. Nothing
  is sent to a third party unless you enable LLM enrichment.

---

## Known limits

Worth knowing before you rely on it:

- **Catalog URLs drift.** Vendors move their changelogs. `sources:check` reports dead ones; that
  report is the maintenance loop for the catalog, and the product is built to expect it.
- **HTML changelogs are parsed heuristically.** Pages that render entirely in client-side
  JavaScript will not parse — prefer an RSS/Atom or GitHub-releases source for those vendors.
- **The scanner is static.** Endpoints built at runtime from variables, or calls made through a
  generated client, may not be seen. That is why a watched vendor still raises findings when
  nothing matched: "no direct match" is a stated outcome, not a silent gap.
- **Deadline extraction is conservative.** It only trusts a date next to a deadline word, so it
  misses vaguer phrasing rather than inventing dates.
- **One process.** SQLite and in-process rate limiting mean one node. That comfortably handles
  thousands of projects; horizontal scale would need Postgres and a shared limiter.

---

## Tests

```bash
npm test      # 68 tests: scanner, parsers, risk, impact, pipeline, notifications, HTTP, auth
```

The suite runs entirely offline against fixtures — no network, no mocking library. `HTTP_OFFLINE=true`
makes every outbound fetch fail fast, which is what keeps it hermetic (and is useful in a sandbox).

---

## Repository layout

```
bin/sunsetradar.js     the CLI (every operation lives here)
src/catalog/           the vendor catalogue — detection signals + feed URLs (plain data)
src/scan/              repository scanner
src/parse/             RSS/Atom, JSON, HTML changelog and end-of-life parsers
src/analyze/           risk scoring, deadline extraction, impact mapping, optional LLM
src/pipeline/          poll and scan orchestration
src/notify/            formatting and delivery (Slack, webhook, email, digests)
src/store/             data access, one module per aggregate
src/http/, src/routes/, src/ui/   server, routes, server-rendered pages
test/                  68 hermetic tests + fixtures (including a sample repo)
www/                   static marketing export, regenerate with `site:build`
```

## Licence

See [LICENSE](./LICENSE). Commercial terms and pricing rationale are in [BUSINESS.md](./BUSINESS.md).
