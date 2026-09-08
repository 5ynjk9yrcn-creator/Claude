# Sunset Radar — the business

A one-page argument for why this sells, who buys it, what it costs to run, and what to do in the
first ninety days.

---

## The problem, in money

A mid-size product company integrates 20–40 third-party APIs. Each vendor ships breaking changes,
deprecations, forced migrations and price rises on its own schedule, announced in a changelog with
no distribution. The failure modes are all expensive:

| Failure | What it costs |
|---|---|
| An endpoint is removed and production breaks | An incident, plus an emergency migration at the worst possible time |
| An API version is force-upgraded | Days of unplanned work in the middle of a sprint |
| A runtime hits end of life | A compliance finding, or a CVE with no patch available |
| A price change lands silently | Margin, discovered a month later on the invoice |

Everyone handles this the same way today: hope that someone happens to read the right changelog.

## Why nothing already covers it

| Tool | What it sees | What it misses |
|---|---|---|
| Dependabot / Renovate | Versions in your lockfile | Anything the *vendor* changes server-side |
| Status pages | What is broken right now | What breaks in March |
| Page-change monitors | That a page changed | Whether it matters, and whether it touches your code |
| Vendor emails | Whatever marketing sends | The engineer who needs it never sees it |

Sunset Radar is the join nobody has built: **what your code uses × what your vendors are about to
change**. Both halves are cheap on their own. The value is entirely in the join — and the join is
what makes the alert specific enough to act on.

## Who buys

**Primary ICP.** Series A–C SaaS companies, 10–150 engineers, heavy integration surface
(fintech, e-commerce, health tech, martech, anything with payments + messaging + auth + AI).
Buyer: VP Engineering, Head of Platform, or the staff engineer who owns "integrations".

**Secondary.** Agencies and dev shops maintaining 10–50 client codebases — they carry the risk
without the context. Priced per project, they are the highest-value seat.

**Tertiary.** Regulated teams who need to *evidence* that third-party lifecycle risk is tracked.
The deadline calendar and audit log are an artefact you can hand an auditor.

## Pricing

| Plan | Price | Limits | Who it is for |
|---|---|---|---|
| Free | $0 | 1 project, 5 vendors, daily polling | The scan that shows the backlog and sells the product |
| Pro | $29/mo | 5 projects, 40 vendors, hourly polling, all channels, API | One team |
| Team | $99/mo | 25 projects, 15-minute polling, per-project routing | A platform group or an agency |
| Enterprise | from $500/mo | Self-hosted or dedicated, custom sources, SSO, SLA | Regulated, or 25+ repos |

Priced per stack, not per seat — seats punish exactly the behaviour you want (everyone reading the
alerts). The free tier is the demo: the first scan lists the deprecations already outstanding in
their repo, which is the strongest sales argument the product can make, and it makes itself.

**Why the price holds.** One prevented 3am incident is worth more than a year of Pro. The
comparison is not other tools; it is the engineer-hours of an unplanned migration.

## Unit economics

The architecture is the moat on cost: **sources are polled once globally and fanned out per
project.** A thousand customers watching Stripe cost one request an hour, not a thousand.

- Marginal infrastructure cost per paying customer: **cents per month.** One small VPS runs
  hundreds of tenants; storage is a SQLite file.
- LLM enrichment is optional, applies only to items already scoring above a threshold, and is
  capped per run. Even with it on, expect single-digit dollars a month at a hundred customers.
- No sales engineer, no onboarding call, no agent to install. Signup → scan → value in minutes.
- Gross margin at any scale that matters: **>95%.**

The real cost is not compute, it is **catalog maintenance** — vendors move their changelogs. That
is one focused hour a week (`sources:check` reports every dead URL), and it is also the moat:
whoever has the best-maintained catalog wins, and the catalog compounds.

## Moat

1. **The catalog.** 49 vendors of detection signals and feed URLs, curated and repaired over time.
   Copying the code is easy; keeping a catalog accurate is a habit.
2. **Impact mapping.** The scanner-to-announcement join is the product. A generic monitor cannot
   retrofit it without building a code scanner.
3. **Precision as a brand.** Alerting tools die of noise. The severity model, the "no action
   required" dampeners and the critical-requires-impact rule exist to keep the alert trusted.
4. **Data flywheel.** Aggregate (never per-customer) signal — which vendors break things most
   often, which deprecations catch teams out — is publishable content and a genuine dataset.

## Go to market

**Wedge: the free scan.** "Point us at your repo, get the list of deprecations already outstanding
in it." That output is shareable, specific and slightly alarming — the ideal top of funnel.

Ninety-day sequence:

1. **Weeks 1–2.** Ship the hosted version. Post the free-scan wedge to Hacker News, r/devops,
   r/webdev, Lobsters. The title writes itself: *"I scanned 500 open-source repos — here is how much
   deprecated API surface they are carrying."* Run that scan first; the post is the launch.
2. **Weeks 3–6.** Publish the aggregate data monthly ("The Deprecation Report"). It is SEO,
   backlinks and credibility in one artefact, and only you can produce it.
3. **Weeks 5–8.** Free public deadline pages per vendor (`/vendors/stripe`) — evergreen search
   traffic for "stripe api deprecation", "node 18 end of life", every quarter forever.
4. **Weeks 6–10.** Integrations as distribution: Slack app directory, a GitHub Action that fails a
   PR on a critical finding, a Backstage plugin. Each is a listing in someone else's marketplace.
5. **Weeks 8–12.** Outbound to agencies with a per-client-repo pitch, and to platform teams whose
   public repos your own scan flagged. That email writes itself too, and it is true.

**Content that only this product can write:** which vendor gives the least notice, which
deprecation broke the most repos, what the average lead time on a breaking change actually is.

## Metrics to run on

| Metric | Target | Why |
|---|---|---|
| Scan → first finding | > 80% of signups | If a scan finds nothing, the pitch failed |
| Findings per project per month | 3–12 | Below is boring, above is noise |
| Alert → acknowledged within 7 days | > 60% | The honest measure of whether alerts are trusted |
| False-positive rate (`ignored` findings) | < 15% | The number that decides retention |
| Source health | > 95% reachable | A dead feed is a silent blind spot |
| Free → paid conversion | 4–8% | Fair for a self-serve dev tool with a real free tier |

Instrument the false-positive rate first. This category dies of noise, and `status = ignored` is
the ground truth for it.

## Roadmap, in the order that earns most

1. **GitHub App** — read repos without a server-side path, comment the impact on PRs, and give the
   scanner history so it can say "you introduced this dependency last week".
2. **Public vendor deadline pages** — SEO plus a genuine free utility.
3. **Auto-fix PRs** for the mechanical migrations (bump a pinned action, raise a Docker base tag,
   swap a retired model string). Turns a warning into a merge button.
4. **Terraform / Kubernetes / OpenAPI scanning** — infrastructure carries the same deprecation risk
   and nobody watches it either.
5. **Postgres + multi-node** when one box stops being enough. Not before.
6. **Team routing** — vendor-to-owner mapping so the payments team gets Stripe and nobody else does.

## Risks, honestly

- **Catalog rot** is the operational risk. Mitigation: `sources:check` in CI, and treat a dead
  source as a bug.
- **A vendor ships a first-party version.** Unlikely — vendors have no incentive to tell you that
  you should also be watching their competitors — and none of them can see your code.
- **Noise fatigue** kills adoption. Mitigation: the severity floor per channel, the digest default,
  and watching the ignored-rate as a core metric.
- **Scanner blind spots** on dynamically constructed calls. Mitigation: state it plainly in the
  finding ("no direct match") rather than pretending to certainty.

---

*The product in one line: everyone else tells you what broke. This tells you what is about to.*
