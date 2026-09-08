// Migrations are an ordered list of [name, sql]. They only ever get appended
// to, so an old database upgrades itself on boot.
export const MIGRATIONS = [
  ['001_core', `
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      password_hash TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'active',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      trial_ends_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      user_agent TEXT
    );
    CREATE INDEX idx_sessions_account ON sessions(account_id);

    CREATE TABLE api_keys (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      prefix TEXT NOT NULL,
      hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      revoked_at TEXT
    );
    CREATE INDEX idx_api_keys_prefix ON api_keys(prefix);

    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      repo_path TEXT,
      repo_url TEXT,
      default_branch TEXT DEFAULT 'main',
      settings TEXT,
      last_scan_at TEXT,
      last_scan_stats TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_projects_account ON projects(account_id);

    CREATE TABLE vendors (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT,
      homepage TEXT,
      docs_url TEXT,
      builtin INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE sources (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      url TEXT NOT NULL,
      label TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      etag TEXT,
      last_modified TEXT,
      content_hash TEXT,
      last_polled_at TEXT,
      last_status TEXT,
      last_error TEXT,
      failure_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(vendor_id, url)
    );
    CREATE INDEX idx_sources_poll ON sources(enabled, last_polled_at);

    CREATE TABLE items (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
      guid TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT,
      body TEXT,
      published_at TEXT,
      hash TEXT NOT NULL,
      risk_score INTEGER NOT NULL DEFAULT 0,
      categories TEXT,
      signals TEXT,
      deadline_at TEXT,
      summary TEXT,
      enriched INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(source_id, guid)
    );
    CREATE INDEX idx_items_vendor ON items(vendor_id, published_at);
    CREATE INDEX idx_items_risk ON items(risk_score);

    CREATE TABLE inventory (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      value TEXT NOT NULL,
      file TEXT,
      line INTEGER,
      snippet TEXT,
      confidence REAL NOT NULL DEFAULT 1.0,
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      UNIQUE(project_id, vendor_id, kind, value, file, line)
    );
    CREATE INDEX idx_inventory_project ON inventory(project_id, active);
    CREATE INDEX idx_inventory_vendor ON inventory(project_id, vendor_id);

    CREATE TABLE findings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
      severity TEXT NOT NULL,
      score INTEGER NOT NULL,
      impact TEXT,
      matched_files INTEGER NOT NULL DEFAULT 0,
      deadline_at TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      snoozed_until TEXT,
      notified_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, item_id)
    );
    CREATE INDEX idx_findings_project ON findings(project_id, status, severity);

    CREATE TABLE channels (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      target TEXT NOT NULL,
      min_severity TEXT NOT NULL DEFAULT 'medium',
      digest INTEGER NOT NULL DEFAULT 0,
      secret TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      last_ok_at TEXT,
      last_error TEXT
    );
    CREATE INDEX idx_channels_account ON channels(account_id, enabled);

    CREATE TABLE deliveries (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      finding_id TEXT REFERENCES findings(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      delivered_at TEXT,
      UNIQUE(channel_id, finding_id, kind)
    );

    CREATE TABLE runs (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      ok INTEGER,
      stats TEXT,
      error TEXT
    );
    CREATE INDEX idx_runs_kind ON runs(kind, started_at);

    CREATE TABLE kv (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE usage (
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      scans INTEGER NOT NULL DEFAULT 0,
      polls INTEGER NOT NULL DEFAULT 0,
      findings INTEGER NOT NULL DEFAULT 0,
      notifications INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (account_id, month)
    );

    CREATE TABLE audit_log (
      id TEXT PRIMARY KEY,
      account_id TEXT,
      action TEXT NOT NULL,
      detail TEXT,
      ip TEXT,
      created_at TEXT NOT NULL
    );
  `],
  ['002_watchlist', `
    -- Which vendors a project actually watches. Normally derived from the
    -- scan, but a user can pin extra vendors or mute noisy ones.
    CREATE TABLE watchlist (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
      origin TEXT NOT NULL DEFAULT 'scan',
      muted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(project_id, vendor_id)
    );
    CREATE INDEX idx_watchlist_vendor ON watchlist(vendor_id, muted);
  `],
  ['003_dedupe', `
    -- The same change is often announced in two places (an RSS feed and a
    -- GitHub release, say). One key per announcement keeps one finding.
    ALTER TABLE items ADD COLUMN dedupe_key TEXT;
    CREATE INDEX idx_items_dedupe ON items(vendor_id, dedupe_key);
  `]
];
