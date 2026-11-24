import './style.css';
import DATA from './data.json';

const APP = 'https://gyohwan-gaja-application-development.vercel.app';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const S = DATA.stats;
const fmtN = n => Number(n).toLocaleString('en-US');

/* ---------------- copy (KR / EN) ---------------- */
const T = {
  ko: {
    'nav.features': '기능', 'nav.data': '파견교 데이터', 'nav.trust': '멘토·신뢰', 'nav.start': '앱 시작하기',
    'hero.eyebrow': '교환학생 · 서머스쿨 출국 준비 앱',
    'hero.title': '합격 그다음,<br><em>출국까지의 모든 준비</em>',
    'hero.sub': `<b><span class="num">${S.countries}</span>개국 <span class="num">${fmtN(S.unis)}</span>개</b> 파견교 맞춤 가이드, 교환가자`,
    'hero.cta': '교환가자 시작하기', 'hero.more': '어떤 앱인지 보기', 'hero.cue': '아래로 스크롤',
    'show.label': '소개합니다', 'show.title': '합격 메일을 받은 날부터<br>입국 심사대까지, 한 앱으로',
    'show.lede': '파견교와 출국일을 고르면 지원, 비자, 숙소, 보험, 수강신청까지 해야 할 일이 마감일 순서로 정리돼요. 막히는 곳은 같은 학교 선배에게 물어보세요.',
    'show.start': '지금 바로 시작하기', 'show.list': '파견교 리스트 보기', 'show.phone': '교환가자 앱 화면', 'show.chips': '기능 바로 보기',
    'show.note': '실제 앱 화면입니다. 기준: University of Washington 2027 봄학기 교환학생 · 멘토와 채팅은 예시 데이터',
    'badge.dep': '출국', 'badge.visa': '체류 기간으로 <b>비자 판단</b>', 'badge.mentor': '<b>인증 멘토</b> · 같은 학교 먼저', 'badge.list': '할 일 <b class="num">17</b>개 마감일 순',
    'data.label': '파견교 데이터', 'data.title': '전 세계 파견교를,<br>매일 아침 다시 확인해요',
    'data.lede': `<span class="num">${S.countries}</span>개국 <span class="num">${fmtN(S.unis)}</span>개 대학과 <span class="num">${S.kr}</span>개 한국 대학, 그리고 매일 자동으로 점검하는 공식 국제처·비자 링크.`,
    'data.s1': '파견 국가', 'data.s2': '해외 대학', 'data.s3': '본교로 고를 수 있는 한국 대학', 'data.s4': '매일 점검하는 공식 링크',
    'u.country': '개국', 'u.school': '곳', 'u.link': '개',
    'trust.label': '멘토·신뢰', 'trust.title': '믿을 수 있는 정보만,<br>검증한 사람만',
    'trust.c1t': '공식 출처 일일 검증', 'trust.c1p': '매일 아침 6시, 각 대학 국제처와 비자 안내의 공식 링크를 전부 다시 열어 봐요. 어학 최소 점수는 출처 페이지에 그 숫자가 아직 있는지까지 확인하고, 끊긴 링크는 앱에서 숨겨요.',
    'trust.c1f': '링크', 'trust.c1g': '어학 출처',
    'trust.c2t': '수료 증빙을 확인한 선배', 'trust.c2p': '멘토가 되려면 파견교 성적증명서나 수료증을 제출하고, 운영팀이 직접 확인해야 해요. 심사는 최대 24시간이 걸리고, 승인된 선배만 프로필을 공개할 수 있어요.', 'trust.c2f': '운영팀 심사 최대 24시간',
    'trust.c3t': '필요한 것만, 증빙은 자동 파기', 'trust.c3p': '가입에는 아이디, 이름, 비밀번호만 받고 비밀번호는 되돌릴 수 없게 암호화해요. 멘토 수료 증빙 파일은 심사 후 30일이 지나면 자동으로 삭제돼요.', 'trust.c3f': '증빙 파일 30일 후 자동 삭제',
    'faq.title': '자주 묻는 질문', 'faq.lede': '더 궁금한 점은 gyohwan.info@gmail.com으로 보내 주세요.',
    'faq.q1': '어떤 학교를 지원하나요?',
    'faq.a1': `<b>${S.countries}개국 ${fmtN(S.unis)}개 해외 대학</b>을 한글·영문으로 검색할 수 있고, 본교는 <b>${S.kr}개 한국 대학</b> 중에서 고를 수 있어요. 대학 목록은 공개 데이터(Hipo university-domains-list)에 한국 대학들의 파견교 공지에 나온 학교를 더해 매일 갱신해요. 주요 파견교 96곳은 학교별 실제 지원 절차를, 나머지 학교는 공통 절차를 안내하고, 모든 학교가 파견교 포털 계정 만들기부터 시작해요.`,
    'faq.q2': '비자·어학 정보는 어디서 오나요?',
    'faq.a2': '각 대학 국제처와 대사관·이민청의 <b>공식 페이지</b>가 출처이고, 모든 안내에 원문 링크를 달아요. 링크와 어학 최소 점수는 매일 아침 자동으로 다시 확인해요. 출국일과 귀국일을 넣으면 체류 기간에 맞는 비자 단계로 바뀌어요. 제도는 바뀔 수 있으니, 실제로 제출하기 전에는 연결된 공식 페이지를 꼭 한 번 더 확인하세요.',
    'faq.q3': '선배 멘토는 어떻게 신청하나요?',
    'faq.a3': '프로그램을 마친 뒤 앱의 <b>마이 → 멘토 신청</b>에서 학교 이메일을 적고 파견교 성적증명서나 수료증(PDF·JPG·PNG, 3MB 이하)을 올리면 돼요. 운영팀이 <b>최대 24시간</b> 안에 심사하고 결과를 메일로 알려 드려요. 심사 중에도 멘토 프로필은 미리 써서 임시저장할 수 있어요.',
    'faq.q4': '이용 요금이 있나요?',
    'faq.a4': '체크리스트, 파견교 커뮤니티, 채팅은 <b>무료</b>예요. 선배 멘토링은 멘토마다 채팅으로 내용·시간·금액을 정하는데, 앱 안 결제는 아직 준비 중이라 지금은 합의 내용만 기록돼요. 출국 혜택 링크는 각 업체 공식 사이트로 연결되고, 제휴 수수료로 무료 기능을 운영할 계획이에요.',
    'faq.q5': '꼭 가입해야 하나요?',
    'faq.a5': '아니요. 로그인 없이 바로 둘러볼 수 있어요. 아이디로 가입하면 고른 파견교, 일정, 완료한 할 일이 계정에 저장되고, 한 번 로그인하면 1년 동안 로그인 화면 없이 바로 대시보드가 열려요.',
    'cta.title': '출국 준비, 이제 혼자 헤매지 마세요', 'cta.sub': '파견교만 고르면 오늘 해야 할 일부터 알려 드려요.', 'cta.btn': '교환가자 열기',
    'f.privacy': '개인정보처리방침', 'f.terms': '이용약관',
    region: { asia: '아시아', na: '북아메리카', europe: '유럽', oceania: '오세아니아' }, countriesUnit: '개국',
    checked: d => `마지막 자동 점검 ${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  },
  en: {
    'nav.features': 'Features', 'nav.data': 'Universities', 'nav.trust': 'Mentors & trust', 'nav.start': 'Open the app',
    'hero.eyebrow': 'Exchange & summer school prep app',
    'hero.title': 'You got in.<br><em>Now, everything until you fly.</em>',
    'hero.sub': `A guide for <b><span class="num">${fmtN(S.unis)}</span> host universities in <span class="num">${S.countries}</span> countries</b>. That’s 교환가자.`,
    'hero.cta': 'Start with 교환가자', 'hero.more': 'See what it does', 'hero.cue': 'Scroll down',
    'show.label': 'Meet the app', 'show.title': 'From the acceptance email<br>to passport control, in one app',
    'show.lede': 'Pick your host university and departure date. Applications, visa, housing, insurance and course registration fall into one list, ordered by deadline. When you get stuck, ask a senior from the same school.',
    'show.start': 'Get started now', 'show.list': 'See the universities', 'show.phone': '교환가자 app screen', 'show.chips': 'Jump to a feature',
    'show.note': 'Real app screens for a Spring 2027 exchange at the University of Washington. Mentors and chats show sample data.',
    'badge.dep': 'to departure', 'badge.visa': 'Visa by <b>length of stay</b>', 'badge.mentor': '<b>Verified mentors</b> · your school first', 'badge.list': '<b class="num">17</b> tasks by deadline',
    'data.label': 'University data', 'data.title': 'Host universities worldwide,<br>rechecked every morning',
    'data.lede': `<span class="num">${fmtN(S.unis)}</span> universities in <span class="num">${S.countries}</span> countries, <span class="num">${S.kr}</span> Korean home universities, and official international-office and visa links checked automatically every day.`,
    'data.s1': 'Countries', 'data.s2': 'Universities abroad', 'data.s3': 'Korean home universities', 'data.s4': 'Official links checked daily',
    'u.country': '', 'u.school': '', 'u.link': '',
    'trust.label': 'Mentors & trust', 'trust.title': 'Only reliable information,<br>only verified people',
    'trust.c1t': 'Official sources, checked daily', 'trust.c1p': 'Every morning at 6, we reopen every official international-office and visa link. For English minimums we check the number is still on the source page, and broken links are hidden in the app.',
    'trust.c1f': 'Links', 'trust.c1g': 'English sources',
    'trust.c2t': 'Seniors with verified proof', 'trust.c2p': 'To become a mentor, a student submits a host transcript or certificate and our team checks it by hand. Reviews take up to 24 hours, and only approved seniors can publish a profile.', 'trust.c2f': 'Team review within 24 hours',
    'trust.c3t': 'Only what we need, proof deleted', 'trust.c3p': 'Sign-up asks for an ID, a name and a password, and the password is stored one-way. Mentor proof files are deleted automatically 30 days after the review.', 'trust.c3f': 'Proof deleted after 30 days',
    'faq.title': 'Questions', 'faq.lede': 'Anything else? Write to gyohwan.info@gmail.com.',
    'faq.q1': 'Which universities are covered?',
    'faq.a1': `Search <b>${fmtN(S.unis)} universities in ${S.countries} countries</b> in Korean or English, and pick your home university from <b>${S.kr} Korean universities</b>. The list is the public Hipo university-domains-list plus partner schools from Korean universities’ exchange notices, refreshed daily. 96 major hosts get their own step-by-step application process; the rest get the common steps, and every checklist starts with the host portal login.`,
    'faq.q2': 'Where do visa and English requirements come from?',
    'faq.a2': 'From each university’s international office and the official embassy or immigration pages, linked on every step. Links and English minimums are rechecked every morning. Enter your departure and return dates and the visa steps change to match your length of stay. Rules change, so open the linked official page once more before you submit anything.',
    'faq.q3': 'How do I become a mentor?',
    'faq.a3': 'After your program, go to <b>Me → Become a mentor</b>, enter your university email and upload a host transcript or certificate (PDF, JPG or PNG up to 3 MB). Our team reviews it within <b>24 hours</b> and emails the result. You can draft your mentor profile while you wait.',
    'faq.q4': 'Does it cost anything?',
    'faq.a4': 'The checklist, communities and chats are <b>free</b>. Mentoring is priced by each mentor in chat; in-app payment is not connected yet, so for now only the agreement is recorded. Perk links go to each provider’s official site, and referral fees are planned to keep the free features free.',
    'faq.q5': 'Do I need an account?',
    'faq.a5': 'No, you can browse right away. Sign up with an ID to save your host, dates and finished tasks; once you log in, the app opens straight to your dashboard for a year.',
    'cta.title': 'Stop figuring out departure prep alone', 'cta.sub': 'Pick your host university and we’ll tell you what to do today.', 'cta.btn': 'Open 교환가자',
    'f.privacy': 'Privacy Policy', 'f.terms': 'Terms of Service',
    region: { asia: 'Asia', na: 'North America', europe: 'Europe', oceania: 'Oceania' }, countriesUnit: 'countries',
    checked: d => `Last automatic check ${d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}`,
  },
};
let LANG = (() => { try { return localStorage.getItem('gg_brand_lang') === 'en' ? 'en' : 'ko'; } catch { return 'ko'; } })();
const L = (ko, en) => (LANG === 'ko' ? ko : en);

function applyLang() {
  const t = T[LANG];
  document.documentElement.lang = LANG;
  $$('[data-i18n]').forEach(el => { const v = t[el.dataset.i18n]; if (typeof v === 'string') el.innerHTML = v; });
  $$('[data-i18n-aria]').forEach(el => { const v = t[el.dataset.i18nAria]; if (v) el.setAttribute('aria-label', v); });
  $$('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === LANG)));
  fillStats();
  $('#regions').innerHTML = ['asia', 'europe', 'na', 'oceania'].filter(r => S.regions[r]).map(r => `<span>${t.region[r]} <b class="num">${S.regions[r]}</b>${LANG === 'ko' ? '개국' : ''}</span>`).join('');
  $('#checkedAt').textContent = t.checked(new Date(S.checkedAt));
  document.title = L('교환가자 · 합격 그다음, 출국까지의 모든 준비', '교환가자 · You got in. Now, everything until you fly.');
  renderPhone(); renderTour();
}
function fillStats() {
  $$('[data-stat]').forEach(el => { const v = S[el.dataset.stat]; if (v != null && !el.dataset.counted) el.textContent = fmtN(v); });
}
$$('.lang button').forEach(b => b.addEventListener('click', () => { LANG = b.dataset.lang; try { localStorage.setItem('gg_brand_lang', LANG); } catch {} applyLang(); }));

/* ---------------- the phone: real app screens ---------------- */
// Offsets (days before departure) are the app's own checklist for a Spring 2027 exchange at the University of Washington.
const DEP_OFFSET = 40, STAY = 140;
const day0 = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
const depDate = new Date(day0.getTime() + DEP_OFFSET * 864e5), retDate = new Date(depDate.getTime() + STAY * 864e5);
const TASKS = [
  ['acct', 'apply', 158, 'University of Washington 포털 로그인 계정 만들기', 'Create your University of Washington portal login'],
  ['eng', 'apply', 154, '어학 최소 점수 충족 (TOEFL 76 · IELTS 6.0 · DET 110)', 'Meet English minimum (TOEFL 76 · IELTS 6.0 · DET 110)'],
  ['pickc', 'acad', 152, '수강 계획서 작성하기', 'Draft your course list (study plan)'],
  ['app', 'apply', 150, 'UW Study Abroad Exchange Application 제출하기', 'Submit the UW Study Abroad Exchange Application'],
  ['funds', 'visa', 104, '재정 증빙 준비하기', 'Prepare proof of funds'],
  ['fin', 'visa', 100, 'MyISSS에서 DS-2019 요청하기', 'Request your DS-2019 in MyISSS'],
  ['housing', 'living', 60, '숙소 신청하기', 'Apply for housing'],
  ['health', 'health', 55, '예방접종 기록 제출하기', 'Submit immunization records'],
  ['i20', 'visa', 50, 'DS-2019 확인하고 서명하기', 'Check and sign your DS-2019'],
  ['sevis', 'visa', 42, 'I-901 SEVIS 비용 내기 ($220)', 'Pay the I-901 SEVIS fee ($220)'],
  ['ds160', 'visa', 40, 'DS-160 작성하기', 'Fill out the DS-160'],
  ['appt', 'visa', 38, '비자 수수료 내고 인터뷰 예약하기', 'Pay the visa fee and book an interview'],
  ['flight', 'living', 30, '항공권 예약하기', 'Book your flight'],
  ['visa', 'visa', 25, '비자 인터뷰 보기', 'Attend your visa interview'],
  ['ins', 'living', 20, '보험 가입 또는 면제 신청하기', 'Buy insurance or request a waiver'],
  ['course', 'acad', 14, '수강신청하기', 'Register for courses'],
  ['arrive', 'arrival', 0, '미국 입국 후 체크인하기', 'Enter the U.S. and check in'],
].map(([id, cat, off, ko, en]) => ({ id, cat, ko, en, date: new Date(depDate.getTime() - off * 864e5), left: DEP_OFFSET - off }));
TASKS.forEach(t => { t.done = t.left < 7; }); // the app marks anything due within a week of joining as already handled
const CAT = { apply: ['지원', 'Apply'], visa: ['비자', 'Visa'], health: ['건강', 'Health'], living: ['생활', 'Living'], acad: ['학업', 'Academics'], arrival: ['입국', 'Arrival'] };
const WD = { ko: ['일', '월', '화', '수', '목', '금', '토'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dShort = d => L(`${d.getMonth() + 1}월 ${d.getDate()}일`, `${MON[d.getMonth()]} ${d.getDate()}`);
const dWeek = d => L(`${d.getMonth() + 1}월 ${d.getDate()}일 (${WD.ko[d.getDay()]})`, `${MON[d.getMonth()]} ${d.getDate()} (${WD.en[d.getDay()]})`);
const leftTxt = n => L(n === 0 ? '오늘' : `${n}일 남음`, n === 0 ? 'Today' : `${n} days left`);

const ICON = {
  list: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 13.8c2.1.8 3.5 3 3.5 6.2"/>',
  mentor: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-3.9 3.1-7 7-7 1.5 0 2.9.4 4 1.2"/><path d="m15 18 2 2 4-4"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>',
  gift: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8S10.5 3 8 4s-.5 4 4 4Zm0 0s1.5-5 4-4 .5 4-4 4Z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', chev: '<path d="m9 18 6-6-6-6"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  plane: '<path d="M3 11.5 21 3l-6.5 18-3.2-7.3L3 11.5Z"/><path d="m11.3 13.7 4.2-4.2"/>', shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.4-8 9-4.6-.6-8-4.5-8-9V6l8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  star: '<path d="m12 3 2.7 5.6 6.2.9-4.5 4.3 1.1 6.1L12 17l-5.5 2.9 1.1-6.1L3 9.5l6.2-.9Z"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"/>',
};
const ic = (n, s = 22, sw = 2) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
const TABS = [['home', 'list', '홈', 'Home'], ['community', 'users', '커뮤니티', 'Community'], ['mentor', 'mentor', '멘토링', 'Mentors'], ['chat', 'chat', '채팅', 'Chats'], ['perks', 'gift', '혜택', 'Perks'], ['me', 'user', '마이', 'Me']];
const SCREEN_TAB = { home: 'home', checklist: 'home', search: 'home', community: 'community', mentor: 'mentor', chat: 'chat', perks: 'perks', me: 'me' };
let screen = 'home';

const bar = (title, right = '') => `<div class="app-bar"><h3>${title}</h3>${right}</div>`;
const task = t => `<div class="a-task${t.done ? ' done' : ''}"><span class="ck">${t.done ? ic('check', 13, 3.4) : ''}</span><span style="flex:1;min-width:0"><b>${L(t.ko, t.en)}</b><span class="meta"><span class="pill cat">${L(...CAT[t.cat])}</span>${dShort(t.date)}${t.done ? '' : ` · <span class="pill ${t.left <= 14 ? 'warn' : 'ok'}">${leftTxt(t.left)}</span>`}</span></span></div>`;
const MENTORS = [
  ['Y', 'Yeon L.', '성균관대학교 경영학과', 'Sungkyunkwan University · Business Administration', 'University of Washington · 교환학생 2026 봄학기', 'University of Washington · Exchange Spring 2026', '4.7', 3, true],
  ['W', 'Woo J.', '연세대학교 컴퓨터공학과', 'Yonsei University · Computer Science', 'University of Washington · 교환학생 2025 봄학기', 'University of Washington · Exchange Spring 2025', '5.0', 2, false],
  ['S', 'Seo H.', '고려대학교 경제학과', 'Korea University · Economics', 'University of Washington · 서머스쿨 2025', 'University of Washington · Summer school 2025', '4.5', 2, false],
];
const SCREENS = {
  home() {
    const done = TASKS.filter(t => t.done).length, next = TASKS.find(t => !t.done);
    return bar(L('대시보드', 'Dashboard'), ic('bell', 22)) + `<div class="app-body">
      <section class="a-hero"><div class="top"><span class="mono">UW</span><span><b>University of Washington</b><small>${L('교환학생 · 2027 봄학기', 'Exchange · Spring 2027')}</small></span></div>
        <p class="lead">${L(`출국까지 <em class="num">${DEP_OFFSET}일</em> 남았어요`, `<em class="num">${DEP_OFFSET} days</em> until you fly`)}</p>
        <div class="trip"><span class="num">${dShort(depDate)} – ${dShort(retDate)} · ${L('4.6개월', '4.6 months')}</span><b>${L('날짜 변경', 'Change dates')}</b></div>
        <div class="prog"><div class="row"><span>${L('준비 현황', 'Prep progress')}</span><b class="num">${done} / ${TASKS.length}</b></div><div class="meter"><i style="width:${Math.round(done / TASKS.length * 100)}%"></i></div></div></section>
      <div class="a-next"><span style="flex:1"><span class="lbl" style="display:flex;justify-content:space-between"><span>${L('다음 할 일', 'Up next')}</span><span class="num${next.left <= 14 ? ' soon' : ''}">${dWeek(next.date)} · ${leftTxt(next.left)}</span></span><b>${L(next.ko, next.en)}</b></span>${ic('chev', 18)}</div>
      <div class="a-head"><h4>${L('체크리스트', 'Checklist')}</h4><span>${L('마감일 순', 'By deadline')}</span></div>
      <div class="a-list">${TASKS.filter(t => !t.done).slice(0, 4).map(task).join('')}</div></div>`;
  },
  checklist() {
    const v = TASKS.filter(t => t.cat === 'visa');
    return bar(L('대시보드', 'Dashboard'), ic('bell', 22)) + `<div class="app-body">
      <div class="a-chips">${['all', 'apply', 'visa', 'health', 'living'].map(c => `<span class="a-chip${c === 'visa' ? ' on' : ''}">${c === 'all' ? L('전체', 'All') : L(...CAT[c])}</span>`).join('')}</div>
      <div class="a-head"><h4>${L('미국 J-1 교환학생 비자', 'U.S. J-1 exchange visa')}</h4><span class="num">${v.filter(t => t.done).length}/${v.length}</span></div>
      <div class="a-list">${v.slice(1).map(task).join('')}</div>
      <div class="a-card" style="padding:12px 14px;font-size:12px;color:var(--ink-2)">${ic('shield', 16)} ${L('UW 공식 안내에 따라 DS-2019(J-1) 절차로 안내해요. 출국 30일 전부터 입국할 수 있어요.', 'Follows UW’s official DS-2019 (J-1) process. You can enter up to 30 days before the program starts.')}</div></div>`;
  },
  search() {
    const rows = [['UW', 'University of Washington', L('미국', 'United States')], ['UBC', 'University of British Columbia', L('캐나다', 'Canada')], ['UT', 'University of Toronto', L('캐나다', 'Canada')], ['UNAM', 'Universidad Nacional Autónoma de México', L('멕시코', 'Mexico')]];
    return `<div class="app-body white" style="padding-top:10px"><p style="font-size:22px;font-weight:800;letter-spacing:-.03em;line-height:1.3">${L('어느 대학에<br>합격했나요?', 'Which university<br>accepted you?')}</p>
      <div class="a-chips" style="background:var(--surface);border-radius:12px;padding:3px">${['asia', 'na', 'europe', 'oceania'].map(r => `<span class="a-chip${r === 'na' ? ' on' : ''}" style="border:0;flex:1;justify-content:center">${T[LANG].region[r]}</span>`).join('')}</div>
      <div class="a-row" style="box-shadow:inset 0 0 0 1px var(--line)">${ic('search', 18)}<span class="t" style="color:var(--ink-3);font-size:13px">${L('한글·영문 학교 이름 또는 나라로 검색', 'Search in Korean or English, or by country')}</span></div>
      <div class="a-head"><h4 style="font-size:13px">${L('전체 대학', 'All universities')}</h4><span class="num">${fmtN(S.regionUnis.na)}</span></div>
      ${rows.map(([m, n, c], i) => `<div class="a-row" style="box-shadow:none;${i === 0 ? 'background:var(--primary-soft)' : ''}"><span class="mono" style="background:${i === 0 ? 'var(--bg)' : 'var(--surface)'}">${m}</span><span class="t"><b>${n}</b><small>${c}</small></span>${i === 0 ? `<span style="color:var(--primary-ink)">${ic('check', 20, 2.6)}</span>` : ''}</div>`).join('')}</div>`;
  },
  community() {
    return bar(L('커뮤니티', 'Community')) + `<div class="app-body">
      <div class="a-row" style="box-shadow:inset 0 0 0 1px var(--line)">${ic('search', 18)}<span class="t" style="color:var(--ink-3);font-size:13px">${L('파견교 한인 학생 커뮤니티 찾기', 'Find your university’s Korean student community')}</span></div>
      <div class="a-card"><div class="ctop"><span class="mono" style="background:var(--surface);color:var(--ink-2)">UW</span><span><b>University of Washington</b><small>${L('한인 학생 커뮤니티 · 같은 학교로 가는 학생들', 'Korean student community · students going there')}</small></span></div>
        <div class="a-btn">${L('이 커뮤니티 가입하기', 'Join this community')}</div>
        <p style="font-size:11.5px;color:var(--ink-3);margin-top:8px;text-align:center">${L('출국 예정 · 현지 재학 중 · 수료 중에서 골라 가입해요', 'Join as going soon, there now, or completed')}</p></div>
      <div class="a-head"><h4>${L('게시판', 'Board')}</h4><span>${L('그룹 채팅은 채팅 탭에 있어요', 'Group chat is in the Chats tab')}</span></div>
      <div class="a-empty">${ic('chat', 26)}<b>${L('아직 글이 없어요', 'No posts yet')}</b>${L('가입하면 첫 글을 쓸 수 있어요.', 'Join to write the first post.')}</div></div>`;
  },
  mentor() {
    return bar(L('멘토링', 'Mentors')) + `<div class="app-body">
      <div class="a-navy"><b>${L('University of Washington를 수료한 인증 선배와 1:1로 이야기해요', 'Talk 1:1 with verified seniors who completed UW')}</b><small>${L('프로필 보기 → 채팅으로 조율 → 확정', 'View profile → agree in chat → confirm')}</small></div>
      <div class="a-head"><h4>${L('인증 멘토', 'Verified mentors')}</h4><span>${L('같은 학교·학과 멘토 먼저', 'Your school and major first')}</span></div>
      ${MENTORS.map(([a, n, sk, se, pk, pe, r, c, same]) => `<div class="a-mentor"><span class="a-ava">${a}</span><span style="flex:1;min-width:0"><span class="name">${n}<span class="vf">${ic('shield', 13, 2.4)}${L('인증', 'Verified')}</span></span>
        <span class="school">${L(sk, se)}${same ? `<span class="pill ok">${L('같은 학교', 'Same school')}</span><span class="pill ok">${L('같은 학과', 'Same major')}</span>` : ''}</span>
        <span class="prog" style="display:block">${L(pk, pe)}</span><span class="rate" style="display:flex;justify-content:space-between;align-items:center">★ <b class="num">${r}</b> <span class="num" style="flex:1;margin-left:3px">(${c})</span><span class="a-cta">${L('프로필 보기', 'View profile')}</span></span></span></div>`).join('')}</div>`;
  },
  chat() {
    return bar(L('채팅', 'Chats')) + `<div class="app-body">
      <div class="a-chips">${[L('전체', 'All'), L('커뮤니티', 'Communities'), L('멘토링', 'Mentors')].map((c, i) => `<span class="a-chip${i === 0 ? ' on' : ''}">${c}</span>`).join('')}</div>
      <div class="a-row"><span class="mono" style="background:var(--surface);color:var(--ink-2)">UW</span><span class="t"><b>University of Washington <span class="pill cat">${L('그룹', 'Group')}</span></b><small>${L('다음 주에 같이 비자 인터뷰 가실 분 있나요?', 'Anyone doing the visa interview next week?')}</small></span><time class="num">21:04</time></div>
      <div class="a-row"><span class="a-ava" style="width:40px;height:40px">Y</span><span class="t"><b>Yeon L. <span class="pill ok">${L('확정', 'Booked')}</span></b><small style="color:var(--ink-2)">${L('성균관대학교 경영학과', 'Sungkyunkwan University · Business')}</small><small>${L('DS-2019 서명할 곳 같이 봐 드릴게요', 'I’ll check where to sign your DS-2019')}</small></span><time class="num">18:30</time></div>
      <p style="text-align:center;font-size:11.5px;color:var(--ink-3);margin-top:4px">${L('커뮤니티 그룹 채팅과 멘토 1:1 채팅이 한곳에 모여요', 'Community group chats and mentor chats in one place')}</p></div>`;
  },
  perks() {
    const P = [['Airalo', L('미국 eSIM 데이터 요금제예요. 출국 전에 설치하고 도착하면 켜세요.', 'U.S. eSIM data plans. Install before you leave, turn on when you land.')], ['유심사', L('한국어 상담과 빠른 배송을 제공하는 eSIM·유심 스토어예요.', 'eSIM and SIM store with Korean support and fast delivery.')], ['Wise', L('숙소 보증금 같은 해외 송금을 실제 환율로 보내요.', 'Send deposits abroad at the real exchange rate.')], ['ISIC', L('교통, 박물관, 소프트웨어 할인을 받는 국제학생증이에요.', 'International student card for transport, museum and software discounts.')]];
    return bar(L('혜택', 'Perks')) + `<div class="app-body">
      <div class="a-trip"><span class="ico">${ic('plane', 20)}</span><span style="flex:1"><small>${L('나의 여정', 'Your trip')}</small><b>${L('서울 → 시애틀', 'Seoul → Seattle')}</b><small class="num">${dShort(depDate)} – ${dShort(retDate)}</small></span></div>
      <div class="a-chips">${[L('항공권', 'Flights'), L('숙소', 'Housing'), L('통신', 'Phone'), L('보험', 'Insurance'), L('금융', 'Money')].map((c, i) => `<span class="a-chip${i === 2 ? ' on' : ''}">${c}</span>`).join('')}</div>
      ${P.map(([n, w]) => `<div class="a-perk"><span class="pm">${n.slice(0, 4)}</span><span><b>${n}</b><small>${w}</small></span></div>`).join('')}</div>`;
  },
  me() {
    return bar(L('마이', 'Me')) + `<div class="app-body">
      <div class="a-row"><span class="a-ava">${ic('user', 22)}</span><span class="t"><b>${L('게스트로 둘러보는 중', 'Browsing as a guest')}</b><small>${L('아이디로 가입하면 계획이 저장돼요', 'Sign up to save your plan')}</small></span></div>
      <div class="a-navy" style="display:flex;gap:10px;align-items:center">${ic('shield', 22)}<span><b>${L('다녀온 뒤 멘토가 되어 보세요', 'Become a mentor after you return')}</b><small>${L('수료 증빙 제출 · 운영팀 심사 최대 24시간', 'Proof of completion · team review within 24 hours')}</small></span></div>
      <div class="a-list">${[[ic('globe', 18), L('언어', 'Language'), L('한국어 · English', 'Korean · English')], [ic('plane', 18), L('출국 일정', 'Travel dates'), `${dShort(depDate)} → ${dShort(retDate)}`], [ic('bell', 18), L('마감 알림', 'Deadline reminders'), L('켜짐', 'On')]].map(([i, a, b]) => `<div class="a-task">${i}<span style="flex:1"><b style="font-size:13.5px">${a}</b><span class="meta">${b}</span></span>${ic('chev', 16)}</div>`).join('')}</div></div>`;
  },
};
function renderPhone() {
  $('#pane').innerHTML = SCREENS[screen]();
  const cur = SCREEN_TAB[screen];
  $('#tabbar').innerHTML = TABS.map(([k, i, ko, en]) => `<button type="button" data-tab="${k}" class="${k === cur ? 'on' : ''}" aria-current="${k === cur ? 'page' : 'false'}">${ic(i, 22)}${L(ko, en)}</button>`).join('');
}
function show(s) { if (s === screen) return; screen = s; const p = $('#pane'); p.style.opacity = '0'; setTimeout(() => { renderPhone(); p.style.opacity = '1'; }, reduced ? 0 : 180); }
$('#tabbar').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; const i = TOUR.findIndex(t => t.s === b.dataset.tab); if (i >= 0) goTour(i, true); else show(b.dataset.tab); });

/* ---------------- feature tour: advances on its own like Apple's highlights; tap to jump, button to pause ---------------- */
const TOUR = [
  { s: 'home', ko: ['출국 D-day 대시보드', '파견교와 출국일만 고르면 출국까지 남은 날과 다음 할 일을 한 문장으로 알려줘요. 출국일을 바꾸면 마감일도 같이 다시 계산돼요.'], en: ['Your departure dashboard', 'Pick your host and dates and it tells you, in one sentence, how long until you fly and what to do next. Change the dates and every deadline follows.'] },
  { s: 'checklist', ko: ['맞춤 비자·지원 체크리스트', '파견교 포털 로그인부터 비자 인터뷰까지, 해야 할 일이 마감일 순서로 정리돼요. 체류 기간에 맞춰 필요한 비자 단계가 바뀌어요.'], en: ['Visa and application checklist', 'From the host portal login to the visa interview, every step in deadline order. The visa steps change with your length of stay.'] },
  { s: 'community', ko: ['파견교 한인 커뮤니티', '같은 학교로 가는 학생, 지금 현지에 있는 학생, 다녀온 학생이 게시판에서 만나요. 가입하면 그룹 채팅도 열려요.'], en: ['Korean communities per host', 'Students going soon, there now or back home meet on one board. Joining opens the group chat too.'] },
  { s: 'mentor', ko: ['수료 증빙을 확인한 선배 멘토', '같은 학교·학과 선배를 먼저 보여줘요. 프로필을 보고 채팅으로 멘토링 내용과 시간, 금액을 정해요.'], en: ['Mentors with verified proof', 'Seniors from your own school and major come first. Read the profile, then agree on what, how long and the price in chat.'] },
  { s: 'chat', ko: ['모든 대화를 한 탭에', '커뮤니티 그룹 채팅과 멘토 1:1 채팅이 채팅 탭 하나에 최근 순으로 모여요.'], en: ['Every chat in one tab', 'Community group chats and 1:1 mentor chats, together and newest first.'] },
  { s: 'perks', ko: ['내 일정에 맞춘 출국 혜택', '항공권, 숙소, eSIM, 보험, 송금까지 출국 일정에 맞춰 각 업체 공식 사이트로 바로 연결해요.'], en: ['Perks for your trip', 'Flights, housing, eSIM, insurance and money transfer, matched to your dates and linked to each provider’s official site.'] },
];
const DUR = 5500, tourList = $('#tourList'), tourNow = $('#tourNow'), tourPlay = $('#tourPlay');
let tIdx = 0, tProg = 0, tPlaying = !reduced, tVisible = false, tLast = performance.now();
const PLAY_IC = { pause: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>', play: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/></svg>' };
function renderTour() {
  tourList.setAttribute('aria-label', L('교환가자 주요 기능', 'What 교환가자 does'));
  tourList.innerHTML = TOUR.map((t, i) => `<li><button type="button" data-i="${i}"><span class="tt"><span class="no num">0${i + 1}</span><span>${L(t.ko[0], t.en[0])}</span></span><span class="desc"><span>${L(t.ko[1], t.en[1])}</span></span><span class="pbar" aria-hidden="true"><i></i></span></button></li>`).join('');
  syncTour();
}
function syncTour() {
  $$('li', tourList).forEach((li, i) => { li.classList.toggle('on', i === tIdx); li.style.setProperty('--p', i < tIdx ? 1 : i === tIdx ? tProg : 0); $('button', li).setAttribute('aria-current', i === tIdx ? 'true' : 'false'); });
  const t = TOUR[tIdx]; tourNow.innerHTML = `<b>${L(t.ko[0], t.en[0])}</b><span>${L(t.ko[1], t.en[1])}</span>`;
  tourPlay.innerHTML = (tPlaying ? PLAY_IC.pause : PLAY_IC.play) + `<span>${tPlaying ? L('일시정지', 'Pause') : L('자동 재생', 'Play')}</span>`;
  tourPlay.setAttribute('aria-pressed', String(!tPlaying));
}
function goTour(i, byUser) { tIdx = (i + TOUR.length) % TOUR.length; tProg = 0; show(TOUR[tIdx].s); syncTour(); if (byUser) tLast = performance.now(); }
tourList.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) goTour(+b.dataset.i, true); });
tourPlay.addEventListener('click', () => { tPlaying = !tPlaying; tLast = performance.now(); syncTour(); });
new IntersectionObserver(es => { tVisible = es[0].isIntersecting; tLast = performance.now(); }, { threshold: .35 }).observe($('#tour'));
(function tick(t) {
  const dt = t - tLast; tLast = t;
  if (tPlaying && tVisible && !document.hidden) {
    tProg += dt / DUR;
    if (tProg >= 1) goTour(tIdx + 1); else { const li = tourList.children[tIdx]; li && li.style.setProperty('--p', tProg.toFixed(4)); }
  }
  requestAnimationFrame(tick);
})(performance.now());

/* ---------------- motion: the phone floats calmly and leans a little toward the pointer ---------------- */
const phone = $('#phone'), zone = $('#deviceZone');
let mx = 0, my = 0, tx = 0, ty = 0;
addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
function fitPhone() { phone.dataset.scale = Math.min(1.15, (zone.clientWidth - 24) / 360, (zone.clientHeight - 24) / 740).toFixed(3); if (reduced) phone.style.transform = `scale(${phone.dataset.scale})`; }
fitPhone(); addEventListener('resize', fitPhone);
function floatLoop(t) {
  tx += (mx - tx) * .05; ty += (my - ty) * .05;
  const sc = +phone.dataset.scale || 1;
  phone.style.transform = `translateY(${(Math.sin(t / 1400) * 6).toFixed(2)}px) scale(${sc}) rotateY(${(tx * 7).toFixed(2)}deg) rotateX(${(-ty * 5).toFixed(2)}deg)`;
  requestAnimationFrame(floatLoop);
}
if (!reduced) requestAnimationFrame(floatLoop); else phone.style.transform = `scale(${phone.dataset.scale || 1})`;

/* ---------------- nav, reveal, count-up ---------------- */
const nav = $('#nav');
const onScroll = () => nav.classList.toggle('solid', scrollY > 24);
addEventListener('scroll', onScroll, { passive: true }); onScroll();
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in'); io.unobserve(e.target);
  $$('[data-count]', e.target).forEach(el => countUp(el));
}), { threshold: .15 });
$$('.rv').forEach(el => io.observe(el));
function countUp(el) {
  const v = S[el.dataset.stat]; if (v == null || reduced) return;
  el.dataset.counted = '1'; const t0 = performance.now(), dur = 1400;
  const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4); el.textContent = fmtN(Math.round(v * e)); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

/* ---------------- 3D: loaded only when its section is near the screen ---------------- */
function webgl() { try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { return false; } }
const HAS_GL = webgl();
function lazy3d(canvas, load) {
  if (!HAS_GL) return false;
  let started = false;
  new IntersectionObserver((es, o) => { if (es[0].isIntersecting && !started) { started = true; o.disconnect(); load().then(m => m.default(canvas, { reduced, stats: S, land: DATA.land, dday: DEP_OFFSET })).catch(err => { console.warn('3D unavailable', err); canvas.remove(); }); } }, { rootMargin: '300px' }).observe(canvas);
  return true;
}
if (!lazy3d($('#hero3d'), () => import('./hero3d.js'))) {
  $('#hero3d').insertAdjacentHTML('afterend', `<div class="fallback" aria-hidden="true"><span>${ic('plane', 40, 2)}</span><span>${ic('globe', 40, 2)}</span><span>${ic('shield', 40, 2)}</span><span class="num">D-${DEP_OFFSET}</span></div>`);
}
lazy3d($('#show3d'), () => import('./show3d.js'));
lazy3d($('#globe3d'), () => import('./globe3d.js'));

$$('[data-app]').forEach(a => { a.href = APP; a.rel = 'noopener'; });
applyLang();
