// Builds data/kr-majors.json: every Korean university (Korean name) with its departments, from the
// Ministry of Education's 대학알리미 file "교육부_대학알리미_재적 학생 현황_대학_학과별" (data.go.kr dataset 15164558, CSV).
//   1. Download the CSV from https://www.data.go.kr/data/15164558/fileData.do
//   2. node scripts/build-kr-majors.mjs <downloaded.csv>
// Uses the latest disclosure year in the file, skips closed universities (학교상태 = 폐교),
// and adds the English name from data/universities.json so old English profiles and English searches still match.
import { readFile, writeFile } from 'node:fs/promises';

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/build-kr-majors.mjs <csv>'); process.exit(1); }
function parse(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const [head, ...rows] = parse((await readFile(src, 'utf8')).replace(/^﻿/, ''));
const col = n => { const i = head.indexOf(n); if (i < 0) throw new Error('missing column ' + n); return i; };
const Y = col('공시연도'), N = col('학교명'), ST = col('학교상태'), REG = col('지역'), KIND = col('학교종류'), DEP = col('학과명');
const year = Math.max(...rows.map(r => Number(r[Y]) || 0));
const tidy = s => s.replace(/[・ㆍ]/g, '·').replace(/\s+/g, ' ').trim();
const schools = new Map();
for (const r of rows) {
  if (Number(r[Y]) !== year || r[ST] === '폐교' || !r[N]) continue;
  const name = tidy(r[N]).replace(/\((.+)\)$/, ' ($1)');      // 고려대학교(세종) → 고려대학교 (세종)
  const s = schools.get(name) || { n: name, r: r[REG], k: r[KIND], m: new Set() };
  if (r[DEP]) s.m.add(tidy(r[DEP]));
  schools.set(name, s);
}
// English names (and the search aliases the app already knows) for matching older profiles
const uni = JSON.parse(await readFile(new URL('../data/universities.json', import.meta.url), 'utf8'));
const en = new Map(uni.kr.filter(u => u[2]).map(u => [u[2], u[0]]));
const out = [...schools.values()].sort((a, b) => a.n.localeCompare(b.n, 'ko')).map(s => {
  const base = s.n.replace(/ \(.+\)$/, ''), e = s.n === base ? en.get(base) || en.get(base.replace(/^국립/, '')) || '' : '';  // 국립공주대학교 = 공주대학교
  return [s.n, s.r, e, [...s.m].sort((a, b) => a.localeCompare(b, 'ko'))];
});
await writeFile(new URL('../data/kr-majors.json', import.meta.url), JSON.stringify({
  source: '교육부 대학알리미 · 재적 학생 현황(대학, 학과별) · data.go.kr 15164558', year, schools: out,
}));
console.log(`${out.length} universities, ${out.reduce((a, s) => a + s[3].length, 0)} departments (${year})`);
