// Build-time facts for the landing page, taken only from the app's own data:
//   ../data/universities.json  → countries, universities abroad, Korean universities
//   ../data/status.json        → official links and English-score sources checked every morning
// If the files are not next to this project (Vercel builds only this folder), the live app's copies are used.
// Also turns the public 1:110m world land map into dots for the globe, so the page ships no 3D or map files.
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import { geoContains } from 'd3-geo';

const APP = 'https://gyohwan-gaja-application-development.vercel.app';
const here = p => new URL(p, import.meta.url);
async function load(name) {
  try { return JSON.parse(await readFile(here(`../../data/${name}`), 'utf8')); } catch {}
  try { const r = await fetch(`${APP}/data/${name}`, { signal: AbortSignal.timeout(20000) }); if (r.ok) return await r.json(); } catch {}
  return null;
}
const [unis, status] = await Promise.all([load('universities.json'), load('status.json')]);
const prev = await readFile(here('../src/data.json'), 'utf8').then(JSON.parse).catch(() => null);

let stats = prev?.stats || null;
if (unis && status) {
  const region = cc => ({ us: 'na', ca: 'na' })[unis.countries[cc]?.[1]] || unis.countries[cc]?.[1];
  const byCountry = {};
  for (const u of unis.unis) byCountry[u[1]] = (byCountry[u[1]] || 0) + 1;
  const regions = {}, regionUnis = {};
  for (const cc of Object.keys(byCountry)) { regions[region(cc)] = (regions[region(cc)] || 0) + 1; regionUnis[region(cc)] = (regionUnis[region(cc)] || 0) + byCountry[cc]; }
  const links = Object.values(status.links || {}), eng = Object.values(status.english || {});
  stats = {
    countries: Object.keys(byCountry).length,
    unis: unis.unis.length,
    kr: unis.kr.length,
    regions,
    regionUnis,
    top: Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([cc, n]) => [cc, unis.countries[cc][0], n]),
    links: links.length,
    linksOk: links.filter(l => l.s === 'ok' || l.s === 'blocked').length,
    english: eng.length,
    checkedAt: status.checkedAt,
  };
}
if (!stats) throw new Error('No university data found and no previous build to fall back on.');

// globe dots: an even spread of points on the sphere, kept where there is land
const require = createRequire(import.meta.url);
const topo = JSON.parse(await readFile(require.resolve('world-atlas/land-110m.json'), 'utf8'));
const land = feature(topo, topo.objects.land);
const N = 20000, dots = [], ga = Math.PI * (3 - Math.sqrt(5));
for (let i = 0; i < N; i++) {
  const y = 1 - (i / (N - 1)) * 2, lat = Math.asin(y) * 180 / Math.PI, lng = (((i * ga) * 180 / Math.PI) % 360) - 180;
  if (geoContains(land, [lng, lat])) dots.push(Math.round(lat * 10), Math.round(lng * 10));
}
await writeFile(here('../src/data.json'), JSON.stringify({ stats, land: dots }));
console.log(`landing data: ${stats.countries} countries, ${stats.unis} universities, ${stats.kr} Korean universities, ${stats.links} links, ${dots.length / 2} land dots`);
