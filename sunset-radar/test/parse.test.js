import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseFeed, parseDate, stripTags } from '../src/parse/feed.js';
import { parseChangelogHtml, parseEolJson, findDate } from '../src/parse/html.js';
import { fixture } from './helpers.js';

test('parses RSS with CDATA and HTML bodies', () => {
  const items = parseFeed(fs.readFileSync(fixture('sample-rss.xml'), 'utf8'));
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Deprecating the /v1/charges endpoint');
  assert.equal(items[0].guid, 'chg-001');
  assert.match(items[0].body, /\/v1\/charges/);
  assert.doesNotMatch(items[0].body, /<p>/);
  assert.equal(items[0].publishedAt.slice(0, 10), '2026-08-03');
});

test('parses Atom entries including double-escaped content', () => {
  const items = parseFeed(fs.readFileSync(fixture('sample-atom.xml'), 'utf8'));
  assert.equal(items.length, 1);
  assert.equal(items[0].url, 'https://github.com/acme/sdk/releases/tag/v20.0.0');
  assert.doesNotMatch(items[0].body, /</, 'escaped markup should be unwrapped, not shown');
  assert.match(items[0].body, /drops Node 18 support/);
});

test('splits a headless changelog page into dated entries', () => {
  const items = parseChangelogHtml(fs.readFileSync(fixture('sample-changelog.html'), 'utf8'), { sourceUrl: 'https://acme.dev/changelog' });
  assert.equal(items.length, 2);
  assert.equal(items[0].url, 'https://acme.dev/changelog#2026-08-01');
  assert.equal(items[0].publishedAt.slice(0, 10), '2026-08-01');
  assert.match(items[0].body, /removes/);
});

test('ignores navigation and footers when splitting a page', () => {
  const html = '<html><body><nav><h2>Menu</h2></nav><main>'
    + '<h2>Real entry</h2><p>' + 'x'.repeat(200) + '</p>'
    + '<h2>Second entry</h2><p>' + 'y'.repeat(200) + '</p>'
    + '<h2>August</h2><p>z</p>'
    + '</main><footer><h2>Legal notices</h2></footer></body></html>';
  const items = parseChangelogHtml(html, { sourceUrl: 'u' });
  assert.deepEqual(items.map((i) => i.title), ['Real entry', 'Second entry'],
    'month dividers, empty sections and page chrome are not changelog entries');
});

test('turns end-of-life cycles into dated items', () => {
  const items = parseEolJson(fs.readFileSync(fixture('sample-eol.json'), 'utf8'), { productName: 'Node.js', sourceUrl: 'https://endoflife.date/nodejs' });
  const cycles = items.map((i) => i.title);
  assert.ok(cycles.some((t) => t.includes('18') && t.includes('past end of life')));
  assert.ok(items.every((i) => i.deadlineAt));
});

test('date helpers accept the formats vendors actually use', () => {
  assert.equal(parseDate('Mon, 03 Aug 2026 12:00:00 GMT').slice(0, 10), '2026-08-03');
  assert.equal(findDate('effective March 1, 2027 for everyone').slice(0, 10), '2027-03-01');
  assert.equal(parseDate('nonsense'), null);
});

test('strips tags without eating text', () => {
  assert.equal(stripTags('<p>Hello <b>world</b></p>'), 'Hello world');
  assert.equal(stripTags('a &amp; b'), 'a & b');
});
