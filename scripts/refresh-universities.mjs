// Refresh data/universities.json from the Hipo university-domains-list.
// Keeps our country list and every Korean name we added by hand; only new
// universities, removed universities and changed websites come from upstream.
// Usage: node scripts/refresh-universities.mjs [path-to-upstream.json]
import { readFile, writeFile } from 'node:fs/promises';

const UPSTREAM = 'https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json';
const FILE = new URL('../data/universities.json', import.meta.url);

const local = JSON.parse(await readFile(FILE, 'utf8'));
const upstream = process.argv[2]
  ? JSON.parse(await readFile(process.argv[2], 'utf8'))
  : await (await fetch(UPSTREAM)).json();

// Guard against a broken or truncated upstream file wiping our list.
if (!Array.isArray(upstream) || upstream.length < 0.9 * (local.unis.length + local.kr.length)) {
  console.error(`Upstream looks wrong (${upstream?.length} entries). Keeping the current file.`);
  process.exit(1);
}

// Universities students apply to that the Hipo list does not carry.
// [name, country code, official site, Korean name]. Kept on every daily run.
const CUSTOM_UNIS = [
  ['KEDGE Business School', 'FR', 'https://student.kedge.edu/', 'KEDGE 경영대학'],
];
// Countries we support beyond the original list. [name, region]
const EXTRA_COUNTRIES = { AU: ['Australia', 'oceania'] };
Object.assign(local.countries, Object.fromEntries(Object.entries(EXTRA_COUNTRIES).filter(([cc]) => !local.countries[cc])));

const koUni = new Map(local.unis.map(u => [u[1] + '|' + u[0], u[3] || '']));
const koKr = new Map(local.kr.map(u => [u[0], u[2] || '']));
const seen = new Set(), unis = [], kr = [];
for (const u of upstream) {
  const name = u.name?.trim(), cc = u.alpha_two_code, url = (u.web_pages || [])[0] || '';
  if (!name || seen.has(cc + '|' + name)) continue; // upstream has duplicates; first one wins
  seen.add(cc + '|' + name);
  if (cc === 'KR') kr.push([name, url, koKr.get(name) || '']);
  else if (local.countries[cc]) unis.push([name, cc, url, koUni.get(cc + '|' + name) || '']);
}
for (const [name, cc, url, ko] of CUSTOM_UNIS) {
  if (seen.has(cc + '|' + name)) continue; // upstream added it; keep theirs, but our Korean name
  seen.add(cc + '|' + name);
  unis.push([name, cc, url, koUni.get(cc + '|' + name) || ko]);
}
for (const u of unis) if (!u[3]) { const c = CUSTOM_UNIS.find(x => x[0] === u[0] && x[1] === u[1]); if (c) u[3] = c[3]; }
unis.sort((a, b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
kr.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

const key = l => l.map(u => u.join('\u0001'));
const before = new Set(key(local.unis)), after = new Set(key(unis));
const added = unis.filter(u => !before.has(u.join('\u0001'))).length;
const removed = local.unis.filter(u => !after.has(u.join('\u0001'))).length;

const out = { source: local.source, countries: local.countries, unis, kr };
await writeFile(FILE, JSON.stringify(out));
console.log(`universities: ${unis.length} abroad (${added} new or changed, ${removed} removed), ${kr.length} in Korea`);
