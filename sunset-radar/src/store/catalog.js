// Vendors and their sources. The built-in catalog is synced into the database
// on boot so an operator can add or disable sources per install without
// editing code, while catalog updates still flow in on upgrade.
import { all, one, run, nowIso } from '../db.js';
import { id } from './ids.js';
import { VENDORS, CATALOG_VERSION } from '../catalog/vendors.js';

export function syncCatalog(vendors = VENDORS) {
  const now = nowIso();
  let added = 0; let updated = 0; let sourcesAdded = 0;
  for (const v of vendors) {
    const existing = one('SELECT * FROM vendors WHERE slug = ?', v.slug);
    let vendorId;
    if (existing) {
      vendorId = existing.id;
      run('UPDATE vendors SET name = ?, category = ?, homepage = ?, docs_url = ? WHERE id = ?',
        v.name, v.category || null, v.homepage || null, v.docs || null, vendorId);
      updated++;
    } else {
      vendorId = id('vnd');
      run('INSERT INTO vendors (id, slug, name, category, homepage, docs_url, builtin, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
        vendorId, v.slug, v.name, v.category || null, v.homepage || null, v.docs || null, now);
      added++;
    }
    for (const s of v.sources || []) {
      const found = one('SELECT id FROM sources WHERE vendor_id = ? AND url = ?', vendorId, s.url);
      if (found) continue;
      run('INSERT INTO sources (id, vendor_id, kind, url, label, enabled, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
        id('src'), vendorId, s.kind, s.url, s.label || null, now);
      sourcesAdded++;
    }
  }
  return { added, updated, sourcesAdded, catalogVersion: CATALOG_VERSION };
}

export const listVendors = () => all('SELECT * FROM vendors ORDER BY name');
export const getVendor = (vendorId) => one('SELECT * FROM vendors WHERE id = ?', vendorId);
export const getVendorBySlug = (slug) => one('SELECT * FROM vendors WHERE slug = ?', slug);

export const listSources = (vendorId = null) =>
  vendorId
    ? all('SELECT * FROM sources WHERE vendor_id = ? ORDER BY url', vendorId)
    : all('SELECT s.*, v.slug AS vendor_slug, v.name AS vendor_name FROM sources s JOIN vendors v ON v.id = s.vendor_id ORDER BY v.name');

/**
 * Sources worth polling right now: enabled, attached to a vendor somebody
 * watches, and not polled inside their interval. Failing sources back off.
 */
export function duePolls({ limit = 25, now = Date.now(), defaultMinutes = 60, onlyWatched = true } = {}) {
  const rows = all(`
    SELECT s.*, v.slug AS vendor_slug, v.name AS vendor_name,
           (SELECT COUNT(*) FROM watchlist w WHERE w.vendor_id = s.vendor_id AND w.muted = 0) AS watchers
    FROM sources s JOIN vendors v ON v.id = s.vendor_id
    WHERE s.enabled = 1
  `);
  const due = rows.filter((s) => {
    if (onlyWatched && s.watchers === 0) return false;
    if (!s.last_polled_at) return true;
    // Exponential backoff on repeated failure, capped at ~12 hours.
    const backoff = s.failure_count > 0 ? Math.min(2 ** s.failure_count, 12) * 60 : 0;
    const waitMinutes = Math.max(defaultMinutes, backoff);
    return new Date(s.last_polled_at).getTime() + waitMinutes * 60000 <= now;
  });
  // Most-watched sources first: they matter to the most customers.
  due.sort((a, b) => b.watchers - a.watchers || String(a.last_polled_at || '').localeCompare(String(b.last_polled_at || '')));
  return due.slice(0, limit);
}

export function markSourcePolled(sourceId, { status, error = null, etag = null, lastModified = null, contentHash = null, ok = true }) {
  const now = nowIso();
  if (ok) {
    run(`UPDATE sources SET last_polled_at = ?, last_status = ?, last_error = NULL, failure_count = 0,
         etag = COALESCE(?, etag), last_modified = COALESCE(?, last_modified), content_hash = COALESCE(?, content_hash) WHERE id = ?`,
      now, String(status), etag, lastModified, contentHash, sourceId);
  } else {
    run('UPDATE sources SET last_polled_at = ?, last_status = ?, last_error = ?, failure_count = failure_count + 1 WHERE id = ?',
      now, String(status), String(error || '').slice(0, 500), sourceId);
  }
}

export function addSource(vendorId, { kind, url, label = null, enabled = true }) {
  const existing = one('SELECT * FROM sources WHERE vendor_id = ? AND url = ?', vendorId, url);
  if (existing) return existing;
  const sourceId = id('src');
  run('INSERT INTO sources (id, vendor_id, kind, url, label, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    sourceId, vendorId, kind, url, label, enabled ? 1 : 0, nowIso());
  return one('SELECT * FROM sources WHERE id = ?', sourceId);
}

export function createCustomVendor({ slug, name, category = 'custom', homepage = null, docs = null }) {
  const existing = getVendorBySlug(slug);
  if (existing) return existing;
  const vendorId = id('vnd');
  run('INSERT INTO vendors (id, slug, name, category, homepage, docs_url, builtin, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
    vendorId, slug, name, category, homepage, docs, nowIso());
  return getVendor(vendorId);
}
