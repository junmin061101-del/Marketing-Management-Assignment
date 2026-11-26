// Daily accuracy check. Opens every official link in index.html and every
// English-requirement source page, then writes data/status.json, which the
// app reads to hide dead links and flag scores that no longer match.
// Usage: node scripts/verify-data.mjs
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

// PDF sources are read with poppler's pdftotext when it is installed (the daily job installs it).
function pdfText(buf) {
  try { return execFileSync('pdftotext', ['-q', '-', '-'], { input: buf, maxBuffer: 1 << 26 }).toString(); }
  catch { return ''; }
}

const ROOT = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', ROOT), 'utf8');
const OUT = new URL('data/status.json', ROOT);
const prev = await readFile(OUT, 'utf8').then(JSON.parse).catch(() => ({ links: {}, english: {} }));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const SKIP = /fonts\.(googleapis|gstatic)\.com|w3\.org|google\.com\/(search|travel)/;

// ---- 1. collect links (template URLs with ${...} are built per student and skipped)
const urls = [...new Set([...html.matchAll(/https?:\/\/[^'"`\s<>)]+/g)].map(m => m[0].replace(/[,;]$/, '')))]
  .filter(u => !u.includes('${') && !SKIP.test(u));

// ---- 2. pull the ENGLISH table out of the page source
const start = html.indexOf('const T=('), end = html.indexOf('function englishOf');
const ctx = { L: (label, url) => ({ label, url }) };
vm.runInNewContext(html.slice(start, end).replace('const ENGLISH=', 'this.ENGLISH=').replace('const T=', 'this.T='), ctx);
const ENGLISH = ctx.ENGLISH;

async function get(url, wantText) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA, 'accept-language': 'en' }, signal: AbortSignal.timeout(25000) });
      const type = r.headers.get('content-type') || '';
      const pdf = type.includes('pdf') || /\.pdf$/i.test(new URL(r.url).pathname);
      let text = '';
      if (wantText && r.ok) text = pdf ? pdfText(Buffer.from(await r.arrayBuffer())) : await r.text();
      else await r.body?.cancel();
      return { code: r.status, final: r.url, pdf, text };
    } catch (e) {
      if (attempt) return viaCurl(url) || { code: 0, error: e.cause?.code || e.name };
    }
  }
}

// Node's fetch is stricter than browsers about old TLS setups and huge headers;
// curl gets through those, so a site is only "down" if curl fails too.
function viaCurl(url) {
  try {
    const out = execFileSync('curl', ['-s', '-o', '/dev/null', '-L', '-m', '30', '-A', UA, '-w', '%{http_code} %{url_effective}', url]).toString().split(' ');
    return +out[0] ? { code: +out[0], final: out[1] } : null;
  } catch { return null; }
}

// ok: page opened · blocked: site refuses bots or our region (still fine for people) ·
// down: timeout or server error today · moved: now lands on another site's home page ·
// broken: gone, or redirected to its own home page
function classify(url, r) {
  if (r.error === 'ENOTFOUND') return 'broken';
  if (!r.code || r.code >= 500) return 'down';
  if (r.code === 404 || r.code === 410) return 'broken';
  if (r.code >= 400) return 'blocked';
  const a = new URL(url), b = new URL(r.final);
  if (/error-vpn|geo-?block/i.test(b.pathname)) return 'blocked'; // region lock: works from Korea
  const ROOT = /^\/?((en|ko|kr|cn|en-us|en-gb|home|main)(\/|\.html?|\/index\.html?)?)?\/?$/i;
  if (!ROOT.test(a.pathname) && (ROOT.test(b.pathname) || /\/(404|not-?found)/i.test(b.pathname))) {
    // a specific page now lands on a home page: dead on the same site, moved if the site changed
    return a.hostname.replace(/^www\./, '') === b.hostname.replace(/^www\./, '') ? 'broken' : 'moved';
  }
  return 'ok';
}

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

const today = new Date().toISOString().slice(0, 10);
const links = {};
await pool(urls, 12, async url => {
  const r = await get(url, false);
  const s = classify(url, r);
  const old = prev.links?.[url];
  links[url] = { s, code: r.code || r.error, ...(r.final && r.final !== url ? { final: r.final } : {}),
    since: old && old.s === s ? old.since : today };
});

// ---- 3. check each English minimum still appears on its source page
const strip = t => t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const NAME = { 'TOEFL iBT': /TOEFL/i, IELTS: /IELTS|IETLS/i, DET: /Duolingo|DET\b/i, Cambridge: /Cambridge|CAE|C1 Advanced/i };
const english = {};
await pool(Object.entries(ENGLISH).flatMap(([uni, v]) => Object.entries(v).map(([k, e]) => [uni, k, e])), 6, async ([uni, k, e]) => {
  const id = uni + '|' + k;
  const r = await get(e.src.url, true);
  if (!r.text) { english[id] = { s: 'unchecked', why: r.pdf && r.code === 200 ? 'pdf reader missing' : 'page ' + (r.code || r.error) }; return; }
  const text = strip(r.text);
  // only plain scores (80, 6.5) or ranges (6.5–7.0) are compared; grades such as B2, C1, N2 are not
  const checkable = e.t.filter(([test, min]) => NAME[test] && /^\d+(\.\d+)?(\s*[–-]\s*\d+(\.\d+)?)?$/.test(String(min).trim()));
  // the page never names any of these tests (scores load by script or sit on a linked page): we cannot tell, so do not call it changed
  if (checkable.length && !checkable.some(([test]) => NAME[test].test(text))) { english[id] = { s: 'unchecked', why: 'scores not in page text' }; return; }
  const has = n => { n = n.replace(/\.0$/, ''); return new RegExp(`(^|[^\\d.,])${n.replace('.', '[.,]')}([.,]0)?(?![\\d])`).test(text); }; // 6,5 as well as 6.5
  const missing = checkable.filter(([test, min]) => !NAME[test].test(text) || !String(min).split(/\s*[–-]\s*/).every(has))
    .map(([test, min]) => `${test} ${min}`);
  english[id] = missing.length ? { s: 'changed', missing } : { s: 'ok' };
});

const sorted = o => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a < b ? -1 : 1));
await writeFile(OUT, JSON.stringify({ checkedAt: new Date().toISOString(), links: sorted(links), english: sorted(english) }, null, 1) + '\n');

const count = (o, s) => Object.values(o).filter(x => x.s === s).length;
console.log(`links: ${urls.length} checked · ok ${count(links, 'ok')} · blocked ${count(links, 'blocked')} · down ${count(links, 'down')} · moved ${count(links, 'moved')} · broken ${count(links, 'broken')}`);
for (const [u, x] of Object.entries(links)) if (x.s === 'broken' || x.s === 'moved') console.log('  ' + x.s.toUpperCase(), x.code, u, x.final ? '-> ' + x.final : '');
console.log(`english: ok ${count(english, 'ok')} · changed ${count(english, 'changed')} · unchecked ${count(english, 'unchecked')}`);
for (const [id, x] of Object.entries(english)) if (x.s !== 'ok') console.log('  ', x.s.toUpperCase(), id, x.missing?.join(', ') || x.why);
