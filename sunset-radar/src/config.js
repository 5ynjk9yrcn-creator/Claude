// Central configuration. Everything is env-driven so the same image runs
// locally, self-hosted, or multi-tenant in production.
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..');

const bool = (v, dflt = false) => {
  if (v === undefined || v === '') return dflt;
  return /^(1|true|yes|on)$/i.test(String(v));
};
const int = (v, dflt) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : dflt;
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 8080),
  host: process.env.HOST || '0.0.0.0',
  baseUrl: (process.env.BASE_URL || '').replace(/\/$/, '') || `http://localhost:${int(process.env.PORT, 8080)}`,
  dbPath: process.env.DATABASE_PATH || path.join(ROOT, 'data', 'sunsetradar.db'),
  reposDir: process.env.REPOS_DIR || path.join(ROOT, 'data', 'repos'),
  logLevel: process.env.LOG_LEVEL || 'info',

  // Single-tenant mode skips signup/billing and treats every visitor as the
  // owner. This is what self-hosted customers run.
  singleTenant: bool(process.env.SINGLE_TENANT, false),
  signupsOpen: bool(process.env.SIGNUPS_OPEN, true),
  sessionTtlDays: int(process.env.SESSION_TTL_DAYS, 30),

  // Scheduler
  scheduler: {
    enabled: bool(process.env.SCHEDULER_ENABLED, true),
    tickSeconds: int(process.env.SCHEDULER_TICK_SECONDS, 60),
    pollConcurrency: int(process.env.POLL_CONCURRENCY, 4),
    rescanHours: int(process.env.RESCAN_HOURS, 24),
    digestHourUtc: int(process.env.DIGEST_HOUR_UTC, 13)
  },

  // Outbound HTTP
  http: {
    timeoutMs: int(process.env.FETCH_TIMEOUT_MS, 15000),
    userAgent: process.env.FETCH_USER_AGENT || 'SunsetRadar/1.0 (+https://sunsetradar.dev)',
    maxBytes: int(process.env.FETCH_MAX_BYTES, 4 * 1024 * 1024),
    retries: int(process.env.FETCH_RETRIES, 2),
    // Hard offline switch: makes every outbound fetch fail fast instead of
    // touching the network. Used by the test suite, and useful in sandboxes.
    offline: bool(process.env.HTTP_OFFLINE, false)
  },

  // Optional LLM enrichment. Everything works without it; with a key the
  // summaries and severity calls get sharper.
  llm: {
    enabled: bool(process.env.LLM_ENABLED, !!process.env.ANTHROPIC_API_KEY),
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.LLM_MODEL || 'claude-sonnet-5',
    baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    maxItemsPerRun: int(process.env.LLM_MAX_ITEMS_PER_RUN, 40),
    minRiskScore: int(process.env.LLM_MIN_RISK_SCORE, 25)
  },

  // Notifications
  email: {
    provider: process.env.EMAIL_PROVIDER || '', // resend | postmark | smtp
    from: process.env.EMAIL_FROM || 'Sunset Radar <alerts@localhost>',
    apiKey: process.env.EMAIL_API_KEY || '',
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: int(process.env.SMTP_PORT, 587),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      secure: bool(process.env.SMTP_SECURE, false)
    }
  },

  // Billing (optional; absent keys simply disable the upgrade flow)
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    priceIds: {
      pro: process.env.STRIPE_PRICE_PRO || '',
      team: process.env.STRIPE_PRICE_TEAM || ''
    },
    portalReturnUrl: process.env.STRIPE_PORTAL_RETURN_URL || ''
  }
};

// Plan limits are enforced in code, not in a spreadsheet.
export const PLANS = {
  free: {
    id: 'free', name: 'Free', priceMonthly: 0,
    projects: 1, vendors: 5, pollMinutes: 1440, apiKeys: 1,
    features: ['Daily polling', '1 project', '5 watched vendors', 'Email + webhook alerts']
  },
  pro: {
    id: 'pro', name: 'Pro', priceMonthly: 29,
    projects: 5, vendors: 40, pollMinutes: 60, apiKeys: 5,
    features: ['Hourly polling', '5 projects', '40 watched vendors', 'Slack + webhooks + email', 'Public JSON API', 'Migration briefs']
  },
  team: {
    id: 'team', name: 'Team', priceMonthly: 99,
    projects: 25, vendors: 200, pollMinutes: 15, apiKeys: 25,
    features: ['15-minute polling', '25 projects', 'Unlimited vendors', 'All alert channels', 'Per-project routing', 'Priority source additions']
  },
  enterprise: {
    id: 'enterprise', name: 'Enterprise', priceMonthly: 0,
    projects: 1000, vendors: 5000, pollMinutes: 5, apiKeys: 200,
    features: ['Self-hosted or dedicated', 'Custom sources', 'SSO', 'SLA']
  }
};

export const planFor = (id) => PLANS[id] || PLANS.free;
