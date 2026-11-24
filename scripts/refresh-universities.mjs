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
  // partner universities of Korean universities (2027 notices: HUFS, Kwangwoon, Sangmyung, Sahmyook, SKHU and others) missing from Hipo
  ["Methodist University", "US", "https://www.methodist.edu/", ""],
  ["EPHEC University College", "BE", "https://www.ephec.be/", ""],
  ["Artevelde University of Applied Sciences", "BE", "https://www.arteveldehogeschool.be/", ""],
  ["Sciences Po Lyon", "FR", "https://www.sciencespo-lyon.fr/", "리옹 정치대학"],
  ["Sciences Po Aix", "FR", "https://www.sciencespo-aix.fr/", "엑스 정치대학"],
  ["EFAP (EDH Group)", "FR", "https://www.efap.com/", ""],
  ["EM Normandie Business School", "FR", "https://www.em-normandie.com/", ""],
  ["NEOMA Business School", "FR", "https://neoma-bs.com/", "NEOMA 경영대학원"],
  ["Burgundy School of Business", "FR", "https://www.bsb-education.com/", ""],
  ["University of the Philippines", "PH", "https://up.edu.ph/", "필리핀 대학교"],
  ["Nagasaki University of Foreign Studies", "JP", "", "나가사키외국어대학"],
  ["University of Niigata Prefecture", "JP", "https://www.unii.ac.jp/", ""],
  ["Shandong University at Weihai", "CN", "", "산둥대학교 웨이하이"],
  ["ECAM LaSalle", "FR", "https://www.ecam.fr/", ""],
  ["National Taipei University of Business", "TW", "https://www.ntub.edu.tw/", ""],
  ["Hong Bang International University", "VN", "https://hiu.vn/", ""],
  ["Qingdao Binhai University", "CN", "https://www.qdbhu.edu.cn/", ""],
  ["Dalian Minzu University", "CN", "https://www.dlnu.edu.cn/", ""],
  ["Liaodong University", "CN", "", "요동대학"],
  ["Zhengzhou University of Light Industry", "CN", "https://www.zzuli.edu.cn/", ""],
  ["Chienkuo Technology University", "TW", "https://www.ctu.edu.tw/", ""],
  ["Shoin University", "JP", "", ""],
  ["Osaka University of Tourism", "JP", "https://www.tourism.ac.jp/", ""],
  ["Jilin Animation Institute", "CN", "https://www.jlai.edu.cn/", ""],
  ["South China Business College", "CN", "", ""],
  ["Shanghai Ocean University", "CN", "https://www.shou.edu.cn/", "상하이해양대학"],
  ["Shaoxing University", "CN", "https://www.usx.edu.cn/", ""],
  ["Qilu University of Technology", "CN", "https://www.qlu.edu.cn/", ""],
  ["Harbin Cambridge University", "CN", "", ""],
  ["Qingdao Hengxing University of Science and Technology", "CN", "", ""],
  ["Jincheng College of Sichuan University", "CN", "", ""],
  ["Zhejiang International Studies University", "CN", "https://www.zisu.edu.cn/", "저장외국어대학"],
  ["Shanghai University of International Business and Economics", "CN", "https://www.suibe.edu.cn/", "상하이대외경제무역대학"],
  ["Baoji University of Arts and Sciences", "CN", "", ""],
  ["M. Auezov South Kazakhstan University", "KZ", "https://auezov.edu.kz/", ""],
  ["Taraz Innovative-Humanitarian University", "KZ", "", ""],
  ["Taraz State Pedagogical Institute", "KZ", "", ""],
  ["ICES Catholic University of Vendée", "FR", "https://www.ices.fr/", ""],
  ["UNINT University of International Studies of Rome", "IT", "https://www.unint.eu/", ""],
  ["National Taichung University of Science and Technology", "TW", "https://www.nutc.edu.tw/", ""],
  ["Chaoyang University of Technology", "TW", "https://www.cyut.edu.tw/", ""],
  ["Yamanashi Prefectural University", "JP", "https://www.yamanashi-ken.ac.jp/", ""],
  ["Momoyama Gakuin University", "JP", "https://www.andrew.ac.jp/", "모모야마학원대학"],
  ["EDHEC Business School", "FR", "https://www.edhec.edu/", "EDHEC 경영대학원"],
  ["Centria University of Applied Sciences", "FI", "", ""],
  ["Berliner Hochschule für Technik", "DE", "https://www.bht-berlin.de/", "베를린공과대학(BHT)"],
  ["Yancheng Institute of Technology", "CN", "https://www.ycit.edu.cn/", "염성공학원"],
  ["Shanghai Polytechnic University", "CN", "https://www.sspu.edu.cn/", "상해제2공업대학"],
  ["Heilongjiang Bayi Agricultural University", "CN", "https://www.byau.edu.cn/", "흑룡강팔일농간대학"],
];
// Countries we support beyond the original list. [name, region]
const EXTRA_COUNTRIES = { AU: ['Australia', 'oceania'], NZ: ['New Zealand', 'oceania'], MX: ['Mexico', 'ca'] };
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
