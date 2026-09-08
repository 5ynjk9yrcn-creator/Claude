// Stripe billing, called over plain fetch. Every route no-ops cleanly when no
// keys are configured, so self-hosted installs never see it.
import crypto from 'node:crypto';
import { config, PLANS } from '../config.js';
import { log } from '../log.js';
import { router } from '../http/server.js';
import { updateAccount, getAccountByEmail, recordAudit } from '../store/accounts.js';
import { one } from '../db.js';

const enabled = () => Boolean(config.stripe.secretKey);

async function stripeApi(path, params, method = 'POST') {
  const body = new URLSearchParams(flatten(params)).toString();
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${config.stripe.secretKey}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: method === 'GET' ? undefined : body
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `stripe ${res.status}`);
  return json;
}

// Stripe wants bracketed keys for nested objects.
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else if (Array.isArray(v)) v.forEach((item, i) => { typeof item === 'object' ? flatten(item, `${key}[${i}]`, out) : (out[`${key}[${i}]`] = item); });
    else if (v !== undefined && v !== null) out[key] = String(v);
  }
  return out;
}

router.post('/billing/checkout', async (ctx) => {
  if (!enabled()) return ctx.redirect('/settings?err=' + encodeURIComponent('Billing is not configured.'));
  const plan = PLANS[ctx.body.plan] ? ctx.body.plan : 'pro';
  const price = config.stripe.priceIds[plan];
  if (!price) return ctx.redirect('/settings?err=' + encodeURIComponent(`No Stripe price configured for ${plan}.`));
  try {
    const session = await stripeApi('checkout/sessions', {
      mode: 'subscription',
      'line_items[0][price]': price,
      'line_items[0][quantity]': 1,
      customer_email: ctx.account.stripe_customer_id ? undefined : ctx.account.email,
      customer: ctx.account.stripe_customer_id || undefined,
      client_reference_id: ctx.account.id,
      success_url: `${config.baseUrl}/settings?ok=${encodeURIComponent('Subscription active. Thank you.')}`,
      cancel_url: `${config.baseUrl}/settings?err=${encodeURIComponent('Checkout cancelled.')}`,
      'subscription_data[metadata][account_id]': ctx.account.id,
      'metadata[account_id]': ctx.account.id,
      'metadata[plan]': plan
    });
    ctx.redirect(session.url, 303);
  } catch (err) {
    log.error('checkout failed', { error: err.message });
    ctx.redirect('/settings?err=' + encodeURIComponent(err.message));
  }
}, { auth: true, limit: 'write' });

router.post('/billing/portal', async (ctx) => {
  if (!enabled() || !ctx.account.stripe_customer_id) return ctx.redirect('/settings?err=' + encodeURIComponent('No billing account yet.'));
  try {
    const session = await stripeApi('billing_portal/sessions', {
      customer: ctx.account.stripe_customer_id,
      return_url: config.stripe.portalReturnUrl || `${config.baseUrl}/settings`
    });
    ctx.redirect(session.url, 303);
  } catch (err) {
    ctx.redirect('/settings?err=' + encodeURIComponent(err.message));
  }
}, { auth: true, limit: 'write' });

/** Stripe's own signature scheme: t=timestamp,v1=hmac over "t.payload". */
export function verifyStripeSignature(rawBody, header, secret, { toleranceSeconds = 300, now = Date.now() } = {}) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=').map((s) => s.trim())));
  if (!parts.t || !parts.v1) return false;
  if (Math.abs(now / 1000 - Number(parts.t)) > toleranceSeconds) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post('/api/v1/webhooks/stripe', (ctx) => {
  if (!enabled()) return ctx.json({ ignored: true }, 200);
  const raw = ctx.rawBody.toString('utf8');
  if (!verifyStripeSignature(raw, ctx.req.headers['stripe-signature'], config.stripe.webhookSecret)) {
    return ctx.json({ error: 'bad signature' }, 400);
  }
  let event;
  try { event = JSON.parse(raw); } catch { return ctx.json({ error: 'bad json' }, 400); }
  const object = event.data?.object || {};
  const accountId = object.metadata?.account_id || object.client_reference_id || null;
  const account = accountId ? one('SELECT * FROM accounts WHERE id = ?', accountId) : (object.customer_email ? getAccountByEmail(object.customer_email) : null);

  switch (event.type) {
    case 'checkout.session.completed': {
      if (account) {
        updateAccount(account.id, {
          plan: object.metadata?.plan || 'pro',
          stripe_customer_id: object.customer || account.stripe_customer_id,
          stripe_subscription_id: object.subscription || null,
          status: 'active'
        });
        recordAudit(account.id, 'billing.subscribed', { plan: object.metadata?.plan });
      }
      break;
    }
    case 'customer.subscription.updated': {
      const target = account || one('SELECT * FROM accounts WHERE stripe_subscription_id = ?', object.id);
      if (target) {
        const status = object.status === 'active' || object.status === 'trialing' ? 'active' : 'past_due';
        updateAccount(target.id, { status });
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const target = account || one('SELECT * FROM accounts WHERE stripe_subscription_id = ?', object.id);
      if (target) {
        updateAccount(target.id, { plan: 'free', status: 'active', stripe_subscription_id: null });
        recordAudit(target.id, 'billing.cancelled');
      }
      break;
    }
    default:
      log.debug('unhandled stripe event', { type: event.type });
  }
  ctx.json({ received: true });
}, { api: true });
