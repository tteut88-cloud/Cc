/* 우리 캘린더 — 상대와 나, 둘만 공유하는 캘린더
 * 데이터는 localStorage 한 곳(공유 저장소)에 두 사람 몫이 함께 저장됩니다.
 * 같은 기기에서 ?as=b 로 열면 상대방 시점으로 볼 수 있고, 탭 사이에 실시간으로 동기화됩니다.
 */
(() => {
'use strict';

/* ================= 유틸 ================= */
const $ = (s, r = document) => r.querySelector(s);
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const todayStr = () => ymd(new Date());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const fmtDate = (s) => { const d = parse(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`; };
const fmtFull = (s) => { const d = parse(s); return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WD[d.getDay()]}요일`; };
const hourLabel = (h) => h === 0 ? '오전 12시' : h < 12 ? `오전 ${h}시` : h === 12 ? '오후 12시' : `오후 ${h - 12}시`;
const timeLabel = (t) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); const ap = h < 12 ? '오전' : '오후'; const hh = h % 12 === 0 ? 12 : h % 12; return `${ap} ${hh}:${pad(m)}`; };
const clockLabel = (ts) => { const d = new Date(ts); const h = d.getHours(); return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${pad(d.getMinutes())}`; };
const toMin = (t) => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m; };
const ago = (ts) => { const s = (Date.now() - ts) / 1000; if (s < 60) return '방금'; if (s < 3600) return `${Math.floor(s / 60)}분 전`; if (s < 86400) return `${Math.floor(s / 3600)}시간 전`; return `${Math.floor(s / 86400)}일 전`; };
const HOUR = 3600e3;

/* ================= 아이콘 ================= */
const I = (d, extra = '') => `<svg class="ico" viewBox="0 0 24 24" ${extra}>${d}</svg>`;
const ICON = {
  left: I('<path d="M15 5l-7 7 7 7"/>'),
  right: I('<path d="M9 5l7 7-7 7"/>'),
  search: I('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>'),
  square: I('<rect x="4" y="4" width="16" height="16" rx="3.5"/>'),
  plus: I('<path d="M12 4v16M4 12h16"/>'),
  menu: I('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  circle: I('<circle cx="12" cy="12" r="8.5"/>'),
  x: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  image: I('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8 8.5"/>'),
  send: I('<path d="M4 12l16-8-6 16-2.5-6.5z" fill="currentColor"/>'),
  heart: I('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
  lock: I('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  sun: I('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>'),
  cloud: I('<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4.2 4.2 0 0 1-.5 8.5z"/>'),
  rain: I('<path d="M7 14.5a4.2 4.2 0 0 1-.5-8.4A5.6 5.6 0 0 1 17.3 7a3.8 3.8 0 0 1-.4 7.5z"/><path d="M8 17.5l-1 2.5M12 17.5l-1 2.5M16 17.5l-1 2.5"/>'),
  snow: I('<path d="M7 14.5a4.2 4.2 0 0 1-.5-8.4A5.6 5.6 0 0 1 17.3 7a3.8 3.8 0 0 1-.4 7.5z"/><path d="M8 18h.01M12 19.5h.01M16 18h.01" stroke-width="3"/>'),
  more: I('<circle cx="12" cy="5.5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="18.5" r="1" fill="currentColor"/>'),
  trash: I('<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>'),
  users: I('<rect x="3" y="5" width="8" height="14" rx="2"/><rect x="13" y="5" width="8" height="14" rx="2"/>'),
};

/* 표정 — 같은 선 스타일로 그린 얼굴들. 웃는 표정은 '활짝'만 선택지에 포함 */
const FACES = {
  smile: { label: '기본', d: '<circle cx="14.5" cy="16.5" r="2" fill="currentColor" stroke="none"/><circle cx="25.5" cy="16.5" r="2" fill="currentColor" stroke="none"/><path d="M13 23.5q7 7 14 0"/>' },
  grin: { label: '활짝', d: '<path d="M11.5 17.5q3-4 6 0M22.5 17.5q3-4 6 0"/><path d="M12 22h16q-1 9-8 9t-8-9z"/>' },
  love: { label: '사랑', d: '<path d="M14.5 19.5s-4-2.4-4-5.2a2 2 0 0 1 4-.9 2 2 0 0 1 4 .9c0 2.8-4 5.2-4 5.2zM25.5 19.5s-4-2.4-4-5.2a2 2 0 0 1 4-.9 2 2 0 0 1 4 .9c0 2.8-4 5.2-4 5.2z" fill="#ff5f93" stroke="#ff5f93" stroke-width="1"/><circle cx="20" cy="26.5" r="2.3"/>' },
  flutter: { label: '설렘', d: '<circle cx="14.5" cy="17" r="2" fill="currentColor" stroke="none"/><circle cx="25.5" cy="17" r="2" fill="currentColor" stroke="none"/><path d="M17.5 25.5h5"/><ellipse cx="11.5" cy="22.5" rx="2.6" ry="1.6" fill="#ff8fb1" stroke="none" opacity=".8"/><ellipse cx="28.5" cy="22.5" rx="2.6" ry="1.6" fill="#ff8fb1" stroke="none" opacity=".8"/>' },
  kiss: { label: '뽀뽀', d: '<path d="M11.5 16.5h5"/><circle cx="25.5" cy="16.5" r="2" fill="currentColor" stroke="none"/><path d="M19 22.5q4 1.5 0 3.2q4 1.7 0 3.3"/>' },
  sad: { label: '슬픔', d: '<circle cx="14.5" cy="17" r="2" fill="currentColor" stroke="none"/><circle cx="25.5" cy="17" r="2" fill="currentColor" stroke="none"/><path d="M14 28q6-6 12 0"/>' },
  cry: { label: '눈물', d: '<path d="M11.5 16.5q3 2.5 6 0M22.5 16.5q3 2.5 6 0"/><path d="M14 20q-2 3.2 0 4.4q2-1.2 0-4.4z" fill="#5b8def" stroke="#5b8def" stroke-width="1"/><path d="M14.5 29q5.5-5 11 0"/>' },
  angry: { label: '화남', d: '<path d="M11 12.5l6 3M29 12.5l-6 3"/><circle cx="15" cy="18.5" r="2" fill="currentColor" stroke="none"/><circle cx="25" cy="18.5" r="2" fill="currentColor" stroke="none"/><path d="M14.5 28q5.5-4.5 11 0"/>' },
  surprised: { label: '놀람', d: '<circle cx="14.5" cy="16" r="2.4"/><circle cx="25.5" cy="16" r="2.4"/><circle cx="20" cy="26" r="3.6"/>' },
  sleepy: { label: '졸림', d: '<path d="M11.5 17.5h6M22.5 17.5h6"/><ellipse cx="20" cy="26" rx="2.4" ry="1.8"/><path d="M27 6h4l-4 4h4" stroke-width="1.6"/>' },
  meh: { label: '무표정', d: '<circle cx="14.5" cy="17" r="2" fill="currentColor" stroke="none"/><circle cx="25.5" cy="17" r="2" fill="currentColor" stroke="none"/><path d="M14 25.5h12"/>' },
  tired: { label: '지침', d: '<path d="M12 14l4.5 3-4.5 3M28 14l-4.5 3 4.5 3"/><path d="M14 27q3-2.5 6 0t6 0"/>' },
  sick: { label: '아픔', d: '<path d="M12.5 14.5l4 4M16.5 14.5l-4 4M23.5 14.5l4 4M27.5 14.5l-4 4"/><path d="M14 27.5q3-2.5 6 0t6 0"/>' },
  worried: { label: '걱정', d: '<path d="M11.5 13.5l5-1.8M28.5 13.5l-5-1.8"/><circle cx="14.5" cy="18" r="2" fill="currentColor" stroke="none"/><circle cx="25.5" cy="18" r="2" fill="currentColor" stroke="none"/><path d="M15 27.5q2.5-2 5 0t5 0"/>' },
};
const face = (k) => `<svg class="face" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="20" cy="20" r="17"/>${(FACES[k] || FACES.smile).d}</svg>`;

/* ================= 저장소 ================= */
const KEY = 'duo.store.v1';
const DEFAULT_COLORS = { schedule: '#e0707c', plan: '#f5a94a', memo: '#6dbb6d', shared: '#5b8def' };
const PALETTE = ['#e0707c', '#ff8fb1', '#f5a94a', '#f2cf4a', '#9ccc65', '#6dbb6d', '#4fc3b0', '#5bc0eb', '#5b8def', '#8e7cf0', '#b07cc6', '#9e9e9e'];

function seed() {
  const t = new Date(); const Y = t.getFullYear(); const M = t.getMonth();
  const D = (n) => ymd(new Date(Y, M, n));
  const today = todayStr(); const now = Date.now();
  const ev = (o) => ({ id: uid(), allDay: false, shared: false, deadline: false, memo: '', startTime: '', endTime: '', type: 'schedule', createdAt: now, ...o });
  return {
    v: 1,
    users: {
      a: { name: '나', colors: { ...DEFAULT_COLORS }, font: 'wanted', theme: 'light', fs: 1 },
      b: { name: '상대', colors: { schedule: '#e0707c', plan: '#f5a94a', memo: '#6dbb6d', shared: '#ff8fb1' }, font: 'wanted', theme: 'pink', fs: 1 },
    },
    events: [
      ev({ owner: 'a', title: '여행', start: D(9), end: D(11), allDay: true, shared: true, memo: '짐 미리 싸두기!' }),
      ev({ owner: 'a', title: '회의', start: D(9), end: D(9), startTime: '10:00', endTime: '11:00' }),
      ev({ owner: 'a', title: '아침 운동', start: today, end: today, startTime: '07:00', endTime: '08:00', type: 'plan' }),
      ev({ owner: 'a', title: '팀 회의', start: today, end: today, startTime: '14:00', endTime: '15:00', memo: '발표 자료 확인' }),
      ev({ owner: 'a', title: '저녁 약속', start: today, end: today, startTime: '19:00', endTime: '21:00', shared: true }),
      ev({ owner: 'b', title: '병원 방문', start: today, end: today, startTime: '11:00', endTime: '12:00' }),
      ev({ owner: 'b', title: '회의', start: today, end: today, startTime: '10:00', endTime: '11:00', type: 'plan' }),
      ev({ owner: 'b', title: '기념일', start: D(23), end: D(23), allDay: true, shared: true }),
      ev({ owner: 'a', title: '보고서 제출', start: D(17), end: D(17), allDay: true, deadline: true }),
    ],
    deadlines: [{ id: uid(), owner: 'a', from: D(13), to: D(19), title: '다이어트', shared: false }],
    memos: [
      { id: uid(), owner: 'a', date: D(9), text: '이번 주말에 영화 볼까?', image: '', toPartner: true, createdAt: now - 50 * HOUR },
      { id: uid(), owner: 'b', date: D(9), text: '좋아!\n다음주도 괜찮아 :)', image: '', toPartner: true, createdAt: now - 49 * HOUR },
      { id: uid(), owner: 'a', date: D(23), text: '이번 주말에 바다 보러 갈까?', image: '', toPartner: true, createdAt: now - 2 * HOUR },
    ],
    todos: [
      { id: uid(), owner: 'a', date: today, text: '운동하기', done: true, shared: false },
      { id: uid(), owner: 'a', date: today, text: '마트 가기', done: false, shared: false },
      { id: uid(), owner: 'a', date: today, text: '보고서 작성', done: false, shared: false },
      { id: uid(), owner: 'a', date: today, text: '친구 생일 선물', done: false, shared: false },
      { id: uid(), owner: 'a', date: today, text: '청소하기', done: false, shared: false },
      { id: uid(), owner: 'b', date: today, text: '같이 장보기', done: false, shared: true },
    ],
    moods: {},
    notifs: [],
  };
}

function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
let db = load();
if (!db || !db.users) { db = seed(); }
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch { toast('저장 공간이 부족해요. 사진 메모를 일부 지워주세요.'); }
}
save();

/* 사용자: 기본은 'a'. ?as=b 로 상대방 시점 */
const params = new URLSearchParams(location.search);
const ME = (params.get('as') === 'b' || params.get('as') === 'a') ? params.get('as') : (sessionStorage.getItem('duo.me') || localStorage.getItem('duo.me') || 'a');
sessionStorage.setItem('duo.me', ME);
const YOU = ME === 'a' ? 'b' : 'a';
const me = () => db.users[ME];
const you = () => db.users[YOU];

/* ================= 상태 ================= */
const S = {
  screen: 'list',
  month: (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })(),
  sel: todayStr(),
  photoMode: false,
  viewPartner: false,
  rangeStart: null,
  query: '',
  memoSend: true,
  sessionFace: 'smile',
  flashFace: null,
};

/* ================= 날씨 (GPS + Open-Meteo) ================= */
const WX_KEY = 'duo.wx';
let wx = (() => { try { return JSON.parse(localStorage.getItem(WX_KEY)); } catch { return null; } })();
const isRain = (c) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95;
const isSnow = (c) => (c >= 71 && c <= 77) || c === 85 || c === 86;
const isWet = (c) => isRain(c) || isSnow(c);
const wxIcon = (c) => c == null ? ICON.cloud : isSnow(c) ? ICON.snow : isRain(c) ? ICON.rain : c <= 1 ? ICON.sun : ICON.cloud;
const wxText = (c) => c == null ? '' : isSnow(c) ? '눈' : isRain(c) ? '비' : c <= 1 ? '맑음' : c <= 3 ? '구름' : c <= 48 ? '흐림' : '흐림';
const dayWx = (s) => wx && wx.daily && wx.daily[s];

function getPos() {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition((p) => res(p.coords), () => res(null), { timeout: 8000, maximumAge: 30 * 60e3 });
  });
}
async function loadWeather(force = false) {
  if (!force && wx && Date.now() - wx.at < 30 * 60e3) return;
  const pos = await getPos();
  const lat = pos ? pos.latitude : 37.5665; const lon = pos ? pos.longitude : 126.978; // 위치 권한이 없으면 서울
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&past_days=62&forecast_days=16&timezone=auto`;
    const r = await fetch(url); if (!r.ok) throw new Error('weather');
    const j = await r.json();
    const daily = {};
    j.daily.time.forEach((t, i) => { daily[t] = { code: j.daily.weather_code[i], max: Math.round(j.daily.temperature_2m_max[i]), min: Math.round(j.daily.temperature_2m_min[i]) }; });
    wx = { at: Date.now(), gps: !!pos, current: { temp: Math.round(j.current.temperature_2m), code: j.current.weather_code }, daily };
    localStorage.setItem(WX_KEY, JSON.stringify(wx));
    render();
  } catch { /* 오프라인이면 캐시 유지 */ }
}

/* ================= 데이터 조회 ================= */
const colorOf = (ev) => db.users[ev.owner].colors[ev.shared ? 'shared' : (ev.type || 'schedule')];
const covers = (ev, s) => ev.start <= s && ev.end >= s;
/* 내 캘린더: 내 일정 + 상대가 공유한 일정 / 상대 캘린더(⑤): 상대 일정 + 내가 공유한 일정 */
function visibleEvents(owner = S.viewPartner ? YOU : ME) {
  const other = owner === ME ? YOU : ME;
  return db.events.filter((e) => e.owner === owner || (e.owner === other && e.shared));
}
function visibleDeadlines(owner = S.viewPartner ? YOU : ME) {
  return db.deadlines.filter((d) => d.owner === owner || d.shared);
}
const myMemos = () => db.memos.filter((m) => m.owner === ME || m.toPartner);
const memosOn = (s) => myMemos().filter((m) => m.date === s);
const unreadCount = () => db.notifs.filter((n) => n.to === ME && n.type === 'memo' && !n.read).length;

function notify(type, text, extra = {}) {
  db.notifs.push({ id: uid(), to: YOU, from: ME, type, text, at: Date.now(), read: false, ...extra });
  if (db.notifs.length > 200) db.notifs = db.notifs.slice(-200);
}

/* ================= 표정 ================= */
function refreshSessionFace(markSeen) {
  const m = db.moods[YOU];
  if (m && Date.now() - m.at < HOUR && (!m.seenAt || S.sessionFaceAt === m.at)) {
    S.sessionFace = m.face; S.sessionFaceAt = m.at;
    if (markSeen && !m.seenAt) { m.seenAt = Date.now(); save(); }
  } else {
    S.sessionFace = 'smile'; S.sessionFaceAt = null;
  }
}
refreshSessionFace(true); // 앱에 들어온 순간: 마지막으로 바꾼 표정을 한 번만 보여줌
setInterval(() => { // 1시간이 지나면 스마일로 초기화
  const before = S.sessionFace; refreshSessionFace(false);
  if (before !== S.sessionFace && S.screen === 'month') render();
}, 30e3);

function sendMood(k) {
  db.moods[ME] = { face: k, at: Date.now(), seenAt: null };
  notify('mood', `${me().name}의 오늘 표정: ${FACES[k].label}`, { face: k });
  save();
  S.flashFace = k; render();
  toastHTML(`${face(k)} 오늘의 표정을 ${esc(you().name)}에게 보냈어요`);
  setTimeout(() => { S.flashFace = null; if (S.screen === 'month') render(); }, 2200);
}

/* ================= 토스트 / 알림 ================= */
let toastTimer;
function toastHTML(html) {
  const t = $('#toast'); t.innerHTML = html; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
const toast = (s) => toastHTML(esc(s));

function systemNotify(n) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((r) => r.showNotification('우리 캘린더', { body: n.text, icon: 'assets/icons/icon-192.png', tag: n.id }));
    } else new Notification('우리 캘린더', { body: n.text, icon: 'assets/icons/icon-192.png' });
  } catch { /* 무시 */ }
}

/* 다른 탭(상대방)에서 바뀐 내용 실시간 반영 */
window.addEventListener('storage', (e) => {
  if (e.key !== KEY || !e.newValue) return;
  const prevIds = new Set(db.notifs.map((n) => n.id));
  db = load() || db;
  const fresh = db.notifs.filter((n) => n.to === ME && !prevIds.has(n.id));
  fresh.forEach((n) => {
    toastHTML(n.face ? `${face(n.face)} ${esc(n.text)}` : `💗 ${esc(n.text)}`);
    systemNotify(n);
  });
  if (fresh.some((n) => n.type === 'mood')) { S.sessionFaceAt = null; refreshSessionFace(true); bumpSmile = true; }
  applyPrefs();
  if (!$('.overlay')) render(); else renderQuiet = true;
});
let bumpSmile = false; let renderQuiet = false;

/* ================= 환경 설정 반영 ================= */
const FONTS = {
  wanted: { label: 'Wanted Sans', css: '"Wanted Sans Variable", "Wanted Sans", -apple-system, "Apple SD Gothic Neo", sans-serif' },
  system: { label: '시스템 기본', css: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif' },
  serif: { label: '명조', css: '"Nanum Myeongjo", "AppleMyungjo", "Noto Serif KR", "Batang", serif' },
  round: { label: '둥근 고딕', css: '"Nanum Square Round", "NanumSquareRound", "Jua", "Apple SD Gothic Neo", sans-serif' },
};
const THEMES = { light: '화이트', pink: '핑크 💗', cream: '크림', dark: '다크' };
const SIZES = { 0.9: '작게', 1: '보통', 1.1: '크게' };
function applyPrefs() {
  const u = me();
  const root = document.documentElement;
  root.dataset.theme = u.theme || 'light';
  root.style.setProperty('--font', (FONTS[u.font] || FONTS.wanted).css);
  root.style.setProperty('--fs', u.fs || 1);
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]').setAttribute('content', bg || '#ffffff');
}
applyPrefs();

/* ================= 네비게이션 ================= */
function go(screen, opts = {}) {
  Object.assign(S, opts);
  S.screen = screen;
  history.pushState({ screen, sel: S.sel }, '');
  render(true);
}
function back() { history.back(); }
window.addEventListener('popstate', (e) => {
  closeSheet();
  const st = e.state || { screen: 'list' };
  S.screen = st.screen; if (st.sel) S.sel = st.sel;
  S.rangeStart = null;
  render(true);
});
history.replaceState({ screen: 'list' }, '');

/* ================= 렌더 ================= */
const app = $('#app');
function render(scrollTop) {
  const fn = SCREENS[S.screen] || SCREENS.list;
  app.innerHTML = fn();
  after[S.screen] && after[S.screen](scrollTop);
}

const topbar = (title, right = '') => `
  <header class="topbar">
    <button class="icon-btn" data-act="back" aria-label="뒤로">${ICON.left}</button>
    <h1>${title}</h1>
    <div>${right}</div>
  </header>`;

const SCREENS = {};
const after = {};

/* ---------- ① LIST ---------- */
SCREENS.list = () => {
  const t = todayStr();
  const todos = db.todos.filter((x) => x.date === t && (x.owner === ME || x.shared));
  const cur = wx && wx.current; const wet = cur && isWet(cur.code);
  return `
  <section class="screen list-screen">
    <div class="list-date">${fmtFull(t)}</div>
    <div class="list-title-row">
      <button class="list-title" data-act="toMonth">LIST</button>
      <span class="wx-dot ${wet ? 'wet' : ''}" title="${wet ? '비/눈' : ''}"></span>
      <span class="wx ${wet ? 'wet' : ''}">${cur ? `${wxIcon(cur.code)} ${cur.temp}°C` : `${ICON.cloud} --°C`}</span>
    </div>
    <div class="scroll">
      <ul class="todo-list">
        ${todos.length ? todos.map((x) => `
          <li class="todo ${x.done ? 'done' : ''}">
            <button class="chk ${x.done ? 'on' : ''}" data-act="toggleTodo" data-id="${x.id}" aria-label="완료">${x.done ? ICON.check : ''}</button>
            <span class="txt">${esc(x.text)}</span>
            ${x.shared ? `<span class="tag">함께${x.owner !== ME ? ' · ' + esc(you().name) : ''}</span>` : ''}
            <button class="del" data-act="delTodo" data-id="${x.id}" aria-label="삭제">${ICON.x}</button>
          </li>`).join('') : '<li class="empty">오늘 할 일을 적어보세요</li>'}
      </ul>
      <form class="add-row" data-form="addTodo">
        <input name="text" placeholder="할 일 추가" autocomplete="off" />
        <button type="button" class="pill-toggle ${S.todoShared ? 'on' : ''}" data-act="todoShare">💗 함께</button>
        <button class="btn" type="submit">추가</button>
      </form>
      <div class="list-hint">LIST를 누르면 달력으로 넘어가요</div>
    </div>
  </section>`;
};

/* ---------- ② 월 달력 ---------- */
SCREENS.month = () => {
  const { y, m } = S.month;
  const first = new Date(y, m, 1);
  const start = ymd(new Date(y, m, 1 - first.getDay()));
  const daysIn = new Date(y, m + 1, 0).getDate();
  const weeks = Math.ceil((first.getDay() + daysIn) / 7);
  const evs = visibleEvents();
  const t = todayStr();
  const owner = S.viewPartner ? YOU : ME;
  let html = '';
  for (let w = 0; w < weeks; w++) {
    const ws = addDays(start, w * 7); const we = addDays(ws, 6);
    let cells = '';
    for (let i = 0; i < 7; i++) {
      const s = addDays(ws, i); const d = parse(s);
      const out = d.getMonth() !== m;
      const memo = memosOn(s).length > 0;
      const dw = dayWx(s); const rain = dw && isRain(dw.code); const snow = dw && isSnow(dw.code);
      const dlEnd = evs.some((x) => x.deadline && x.end === s);
      const photo = S.photoMode && memosOn(s).find((x) => x.image);
      cells += `
        <div class="cell ${i === 0 ? 'sun' : ''} ${out ? 'out' : ''} ${s === t ? 'today' : ''} ${S.rangeStart === s ? 'range-start' : ''} ${photo ? 'photo' : ''}"
             data-act="day" data-lp="range" data-date="${s}" ${photo ? `style="background-image:url('${photo.image}')"` : ''}>
          <div class="num-wrap">
            ${!out && (rain || snow) ? `<span class="sticker ${snow ? 'snow' : ''}"></span>` : ''}
            <span class="num ${memo && !out ? 'memo' : ''}">${d.getDate()}</span>${!out && rain ? '<span class="rainline"></span>' : ''}
          </div>
          ${!out && dlEnd ? '<span class="deadline-tri" title="데드라인"></span>' : ''}
        </div>`;
    }
    /* 여러 날 일정 막대 (lane 배치) */
    let bars = '';
    if (!S.photoMode) {
      const segs = evs.filter((e) => e.start <= we && e.end >= ws)
        .sort((a, b) => a.start.localeCompare(b.start) || diffDays(b.start, b.end) - diffDays(a.start, a.end) || (a.startTime || '').localeCompare(b.startTime || ''));
      const lanes = []; const extra = {};
      segs.forEach((e) => {
        const s0 = e.start < ws ? ws : e.start; const s1 = e.end > we ? we : e.end;
        const c0 = diffDays(ws, s0); const c1 = diffDays(ws, s1);
        let lane = lanes.findIndex((end) => end < c0);
        if (lane === -1) { lane = lanes.length; lanes.push(-1); }
        lanes[lane] = c1;
        if (lane >= 3) { for (let c = c0; c <= c1; c++) extra[c] = (extra[c] || 0) + 1; return; }
        // 밖의 달(이전/다음 달) 칸은 비워 둠
        const vis0 = Math.max(c0, parse(ws).getMonth() !== m ? diffDays(ws, ymd(new Date(y, m, 1))) : 0);
        const lastCol = diffDays(ws, ymd(new Date(y, m, daysIn)));
        const vis1 = Math.min(c1, lastCol);
        if (vis1 < vis0) return;
        const contL = e.start < addDays(ws, vis0); const contR = e.end > addDays(ws, vis1);
        bars += `<div class="bar ${contL ? 'cont-l' : ''} ${contR ? 'cont-r' : ''}" style="--c:${colorOf(e)};left:calc(${vis0} * 100% / 7 + 3px);width:calc(${vis1 - vis0 + 1} * 100% / 7 - 6px);top:${44 + lane * 21}px">${esc(e.title)}</div>`;
      });
      Object.entries(extra).forEach(([c, n]) => { bars += `<div class="bar more" style="left:calc(${c} * 100% / 7);width:calc(100% / 7);top:${44 + 3 * 21}px">+${n}</div>`; });
    }
    html += `<div class="week">${cells}<div class="bars">${bars}</div></div>`;
  }
  const curFace = S.flashFace || S.sessionFace;
  const unread = unreadCount();
  return `
  <section class="screen">
    <header class="month-head">
      <button class="icon-btn smile-btn ${bumpSmile ? 'bump' : ''}" data-act="smile" data-lp="mood" aria-label="표정 / 사진 보기 전환">${face(curFace)}</button>
      <button class="icon-btn" data-act="prevMonth" aria-label="이전 달">${ICON.left}</button>
      <button class="month-title" data-act="pickMonth">${y}년 ${m + 1}월</button>
      <button class="icon-btn" data-act="nextMonth" aria-label="다음 달">${ICON.right}</button>
      <button class="icon-btn" data-act="toSearch" aria-label="검색">${ICON.search}</button>
    </header>
    ${S.viewPartner ? `<div class="partner-banner">💗 ${esc(db.users[owner].name)}의 캘린더</div>` : ''}
    ${S.photoMode ? `<div class="photo-banner">사진으로 보는 중</div>` : ''}
    <div class="weekdays">${WD.map((d, i) => `<span class="${i === 0 ? 'sun' : ''}">${d}</span>`).join('')}</div>
    <div class="grid" id="grid">${html}</div>
    <nav class="bottombar">
      <button data-act="toMemo" aria-label="메모">${ICON.square}</button>
      <button data-act="togglePartner" class="${S.viewPartner ? 'on' : ''}" aria-label="상대 캘린더 전환">${ICON.plus}</button>
      <button data-act="toInbox" aria-label="기록">${ICON.menu}${unread ? `<span class="badge">${unread > 99 ? '99+' : unread}</span>` : ''}</button>
      <button data-act="toSettings" aria-label="설정">${ICON.circle}</button>
    </nav>
  </section>`;
};
after.month = () => {
  bumpSmile = false;
  const g = $('#grid'); let sx = 0, sy = 0;
  g.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  g.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx; const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 50) shiftMonth(dx < 0 ? 1 : -1);
  });
};
function shiftMonth(n) {
  const d = new Date(S.month.y, S.month.m + n, 1);
  S.month = { y: d.getFullYear(), m: d.getMonth() }; render();
}

/* ---------- ③ 하루 (타임라인) ---------- */
const ROW = 56;
function stripHTML() {
  const dls = visibleDeadlines();
  let s = '';
  for (let i = -7; i <= 30; i++) {
    const d = addDays(S.sel, i); const dt = parse(d);
    const dw = dayWx(d); const inRed = dls.some((x) => x.from <= d && x.to >= d);
    s += `<button class="sday ${dt.getDay() === 0 ? 'sun' : ''} ${d === S.sel ? 'sel' : ''} ${inRed ? 'inred' : ''}" data-act="selDay" data-lp="strip" data-date="${d}" id="sd-${d}">
      <span class="w">${WD[dt.getDay()]}</span><span class="d">${dt.getDate()}</span>${dw && isWet(dw.code) ? '<span class="dot"></span>' : ''}
    </button>`;
  }
  return `<div class="strip" id="strip">${s}</div>`;
}
function wxLine(s) {
  const dw = dayWx(s);
  if (!dw) return `<div class="day-wx">${ICON.cloud} 날씨 정보 없음</div>`;
  return `<div class="day-wx ${isWet(dw.code) ? 'wet' : ''}">${wxIcon(dw.code)} ${wxText(dw.code)} ${dw.max}° / ${dw.min}°</div>`;
}
/* 겹치는 일정을 나란히 배치 */
function layoutTimed(list) {
  const items = list.map((e) => ({ e, s: toMin(e.startTime), f: Math.max(toMin(e.endTime || e.startTime), toMin(e.startTime) + 30) }))
    .sort((a, b) => a.s - b.s || b.f - a.f);
  const cols = []; let group = []; let groupEnd = -1; const out = [];
  const flush = () => { const n = Math.max(1, ...group.map((g) => g.col + 1)); group.forEach((g) => { g.n = n; out.push(g); }); group = []; cols.length = 0; };
  items.forEach((it) => {
    if (it.s >= groupEnd && group.length) flush();
    let c = cols.findIndex((end) => end <= it.s); if (c === -1) { c = cols.length; cols.push(0); }
    cols[c] = it.f; it.col = c; group.push(it); groupEnd = Math.max(groupEnd, it.f);
  });
  if (group.length) flush();
  return out;
}
function evBlocks(list) {
  return layoutTimed(list).map((g) => {
    const hasMemo = !!g.e.memo || memosOn(g.e.start).length > 0;
    return `<button class="ev" data-act="openEvent" data-id="${g.e.id}" style="--c:${colorOf(g.e)};top:${g.s / 60 * ROW + 2}px;height:${(g.f - g.s) / 60 * ROW - 4}px;left:calc(${g.col} * 100% / ${g.n} + 4px);width:calc(100% / ${g.n} - 8px)">
      ${esc(g.e.title)}${hasMemo ? '<span class="mini"></span>' : ''}
      <small>${timeLabel(g.e.startTime)}${g.e.endTime ? ' – ' + timeLabel(g.e.endTime) : ''}${g.e.owner !== ME ? ' · ' + esc(db.users[g.e.owner].name) : ''}</small>
    </button>`;
  }).join('');
}
const isTimed = (e) => !e.allDay && e.start === e.end && e.startTime;
SCREENS.day = () => {
  const evs = visibleEvents().filter((e) => covers(e, S.sel));
  const allday = evs.filter((e) => !isTimed(e));
  const timed = evs.filter(isTimed);
  const dls = visibleDeadlines().filter((d) => d.from <= S.sel && d.to >= S.sel);
  let hours = '';
  for (let h = 0; h < 24; h++) hours += `<div class="hour"><div class="lbl">${hourLabel(h)}</div><div class="slot" data-act="slot" data-hour="${h}"></div></div>`;
  const isToday = S.sel === todayStr();
  const now = new Date();
  return `
  <section class="screen">
    ${topbar(fmtDate(S.sel), `<button class="icon-btn" data-act="newEvent" aria-label="일정 추가">${ICON.plus}</button>`)}
    ${stripHTML()}
    ${wxLine(S.sel)}
    ${allday.length || dls.length ? `<div class="allday">
      ${dls.map((d) => `<button class="chip red" data-act="openDeadline" data-id="${d.id}">레드라인 · ${esc(d.title)} ${d.to === S.sel ? '· 오늘까지' : `· ${diffDays(S.sel, d.to)}일 남음`}</button>`).join('')}
      ${allday.map((e) => `<button class="chip" style="--c:${colorOf(e)}" data-act="openEvent" data-id="${e.id}">${esc(e.title)}${e.start !== e.end ? ` (${parse(e.start).getDate()}–${parse(e.end).getDate()}일)` : ''}</button>`).join('')}
    </div>` : ''}
    <div class="scroll" id="tl-scroll">
      <div class="timeline">
        ${hours}
        <div class="ev-layer">${evBlocks(timed)}</div>
        ${isToday ? `<div class="nowline" style="top:${(now.getHours() * 60 + now.getMinutes()) / 60 * ROW}px"></div>` : ''}
      </div>
    </div>
  </section>`;
};
after.day = (fresh) => {
  const st = $('#sd-' + S.sel); const strip = $('#strip');
  if (st && strip) strip.scrollLeft = st.offsetLeft - 8;
  if (fresh) {
    const sc = $('#tl-scroll');
    const timed = visibleEvents().filter((e) => covers(e, S.sel) && isTimed(e));
    const firstH = timed.length ? Math.min(...timed.map((e) => toMin(e.startTime))) / 60 : 8;
    sc.scrollTop = Math.max(0, (Math.min(firstH, 8) - 0.5) * ROW);
  }
};

/* ---------- ⑨ 함께 보는 일정 ---------- */
SCREENS.split = () => {
  const mine = db.events.filter((e) => e.owner === ME && covers(e, S.sel));
  const yours = db.events.filter((e) => e.owner === YOU && covers(e, S.sel));
  let hours = '';
  for (let h = 0; h < 24; h++) hours += `<div class="hour split"><div class="lbl">${hourLabel(h)}</div><div class="slot" data-act="slot" data-hour="${h}"></div><div class="slot"></div></div>`;
  const ad = (list) => list.filter((e) => !isTimed(e)).map((e) => `<button class="chip" style="--c:${colorOf(e)}" data-act="openEvent" data-id="${e.id}">${esc(e.title)}</button>`).join('');
  const adMine = ad(mine), adYours = ad(yours);
  return `
  <section class="screen">
    ${topbar('함께 보는 일정')}
    <div class="day-nav">
      <button data-act="splitPrev">${ICON.left}</button><span>${fmtDate(S.sel)}</span><button data-act="splitNext">${ICON.right}</button>
    </div>
    <div class="split-head"><span></span><span>내 일정</span><span class="you">${esc(you().name)} 일정</span></div>
    ${adMine || adYours ? `<div class="split-head"><span></span><span class="allday" style="border:0">${adMine}</span><span class="allday" style="border:0">${adYours}</span></div>` : ''}
    <div class="scroll" id="tl-scroll">
      <div class="timeline">
        ${hours}
        <div class="ev-layer half" style="width:calc((100% - 70px) / 2)">${evBlocks(mine.filter(isTimed))}</div>
        <div class="ev-layer half" style="left:calc(70px + (100% - 70px) / 2);width:calc((100% - 70px) / 2)">${evBlocks(yours.filter(isTimed))}</div>
      </div>
    </div>
  </section>`;
};
after.split = (fresh) => { if (fresh) $('#tl-scroll').scrollTop = 8.5 * ROW; };

/* ---------- ④ 메모 ---------- */
SCREENS.memo = () => {
  const list = myMemos().slice().sort((a, b) => a.createdAt - b.createdAt);
  let lastDay = '';
  const items = list.map((x) => {
    const mine = x.owner === ME;
    const day = ymd(new Date(x.createdAt));
    const sep = day !== lastDay ? `<div class="date-sep">${fmtDate(day)}</div>` : ''; lastDay = day;
    const col = db.users[x.owner].colors.memo;
    return `${sep}<div class="msg ${mine ? 'me' : 'you'}" data-lp="memo" data-id="${x.id}">
      ${mine ? '' : `<div class="avatar">${esc(you().name.slice(0, 1))}</div>`}
      <div class="bubble" style="--mc:${col}">
        <span class="for">${fmtDate(x.date)} 메모 ${mine && !x.toPartner ? '· 나만 보기' : ''}</span>
        ${x.image ? `<img src="${x.image}" alt="" />` : ''}${esc(x.text)}
      </div>
      <div class="meta">${mine && !x.toPartner ? '🔒' : ''}<span>${clockLabel(x.createdAt)}</span></div>
    </div>`;
  }).join('');
  return `
  <section class="screen">
    ${topbar('메모', `<button class="icon-btn" data-act="composeMemo" aria-label="사진과 함께 쓰기">${ICON.more}</button>`)}
    <div class="scroll" id="chat-scroll"><div class="chat">${items || '<div class="empty">아직 메모가 없어요.<br/>사진과 함께 메모를 남겨보세요.</div>'}</div></div>
    <form class="composer" data-form="quickMemo">
      <button type="button" class="icon-btn" data-act="composeMemo" aria-label="사진 첨부">${ICON.image}</button>
      <input name="text" placeholder="메모를 입력하세요" autocomplete="off" />
      <button type="button" class="icon-btn heart ${S.memoSend ? 'on' : ''}" data-act="memoSendToggle" aria-label="상대에게 보내기">${ICON.heart}</button>
      <button class="icon-btn send" type="submit" aria-label="보내기">${ICON.send}</button>
    </form>
  </section>`;
};
after.memo = () => { const c = $('#chat-scroll'); c.scrollTop = c.scrollHeight; };

/* ---------- ⑥ 기록: 서로에게 남긴 메모만, 카톡 대화창처럼 ---------- */
SCREENS.inbox = () => {
  const list = db.memos.filter((m) => m.toPartner).slice().sort((a, b) => a.createdAt - b.createdAt);
  let lastDay = '', prevOwner = null, html = '';
  list.forEach((m, i) => {
    const mine = m.owner === ME;
    const d = new Date(m.createdAt); const day = ymd(d);
    if (day !== lastDay) { html += `<div class="kk-date">${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WD[d.getDay()]}요일</div>`; lastDay = day; prevOwner = null; }
    const next = list[i + 1];
    const showTime = !next || next.owner !== m.owner || clockLabel(next.createdAt) !== clockLabel(m.createdAt) || ymd(new Date(next.createdAt)) !== day;
    const first = prevOwner !== m.owner;
    html += `<div class="kk-row ${mine ? 'me' : 'you'} ${first ? 'first' : ''}">
      ${!mine ? (first ? `<div class="kk-av">${esc(you().name.slice(0, 1))}</div>` : '<div class="kk-av blank"></div>') : ''}
      <div class="kk-col">
        ${!mine && first ? `<div class="kk-name">${esc(you().name)}</div>` : ''}
        <div class="kk-line">
          <div class="kk-bubble">${m.image ? `<img src="${m.image}" alt="" />` : ''}${m.text ? `<span>${esc(m.text)}</span>` : ''}</div>
          ${showTime ? `<span class="kk-time">${clockLabel(m.createdAt)}</span>` : ''}
        </div>
      </div>
    </div>`;
    prevOwner = m.owner;
  });
  return `
  <section class="screen kk">
    ${topbar(esc(you().name))}
    <div class="scroll kk-scroll" id="kk-scroll">${html || '<div class="kk-empty">아직 서로에게 남긴 메모가 없어요</div>'}</div>
  </section>`;
};
after.inbox = () => {
  const c = $('#kk-scroll'); c.scrollTop = c.scrollHeight;
  let ch = false; db.notifs.forEach((n) => { if (n.to === ME && n.type === 'memo' && !n.read) { n.read = true; ch = true; } });
  if (ch) save();
};

/* ---------- ⑦ 설정 ---------- */
SCREENS.settings = () => `
  <section class="screen">
    ${topbar('설정')}
    <div class="scroll">
      <ul class="menu">
        <li><button data-act="pickFont">글씨체 변경<span class="val">${FONTS[me().font]?.label || ''}</span>${ICON.right}</button></li>
        <li><button data-act="pickTheme">테마 변경<span class="val">${THEMES[me().theme] || ''}</span>${ICON.right}</button></li>
        <li><button data-act="toColors">컬러 설정${ICON.right}</button></li>
        <li><button data-act="pickSize">글자 크기<span class="val">${SIZES[me().fs || 1]}</span>${ICON.right}</button></li>
      </ul>
      <div class="menu-title">우리 둘</div>
      <ul class="menu">
        <li><button data-act="editNames">이름<span class="val">${esc(me().name)} · ${esc(you().name)}</span>${ICON.right}</button></li>
        <li><button data-act="askNotif">알림 허용<span class="val">${'Notification' in window ? ({ granted: '허용됨', denied: '차단됨', default: '꺼짐' }[Notification.permission]) : '지원 안 됨'}</span>${ICON.right}</button></li>
        <li><button data-act="refreshWx">날씨 새로고침<span class="val">${wx ? (wx.gps ? 'GPS 위치' : '서울 기준') : '-'}</span>${ICON.right}</button></li>
        <li><button data-act="openPartnerTab">상대 화면 열기 (같은 기기)${ICON.right}</button></li>
      </ul>
      <ul class="menu"><li><button data-act="resetAll" style="color:var(--red)">모든 데이터 초기화</button></li></ul>
      <p class="note">지금 <b>${esc(me().name)}</b>(으)로 사용 중이에요. 이 버전은 기기 안에 저장되며, 같은 기기의 두 탭(내 화면 / 상대 화면) 사이에 실시간으로 공유됩니다.</p>
    </div>
  </section>`;

/* ---------- ⑧ 컬러 설정 ---------- */
const CAT = { schedule: '일정', plan: '계획', memo: '메모', shared: '공유' };
SCREENS.colors = () => `
  <section class="screen">
    ${topbar('컬러 설정')}
    <div class="scroll">
      <ul class="menu">
        ${Object.entries(CAT).map(([k, l]) => `<li><button data-act="pickColor" data-k="${k}">${l}<span class="swatch" style="--c:${me().colors[k]}"></span></button></li>`).join('')}
      </ul>
      <p class="note">설정한 컬러대로 캘린더에 글자가 표시돼요.<br/>공유 색상은 ${esc(you().name)}의 캘린더에도 그대로 표시됩니다.<br/>${esc(you().name)}의 공유 색상: <span class="chip" style="--c:${you().colors.shared}">공유 일정</span></p>
    </div>
  </section>`;

/* ---------- 검색 ---------- */
SCREENS.search = () => `
  <section class="screen" style="padding-top:0">
    <form class="search-bar" data-form="search" onsubmit="return false">
      <button type="button" class="icon-btn" data-act="back">${ICON.left}</button>
      <input name="q" id="q" placeholder="일정, 메모, 할 일 검색" value="${esc(S.query)}" autocomplete="off" />
    </form>
    <div class="scroll" id="results">${searchResults()}</div>
  </section>`;
function hl(text, q) {
  const t = esc(text); if (!q) return t;
  const i = text.toLowerCase().indexOf(q.toLowerCase()); if (i < 0) return t;
  return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
}
function searchResults() {
  const q = S.query.trim(); if (!q) return '<div class="empty">찾고 싶은 일정을 입력하세요</div>';
  const ql = q.toLowerCase(); const has = (s) => (s || '').toLowerCase().includes(ql);
  const evs = [...visibleEvents(ME), ...db.events.filter((e) => e.owner === YOU && !e.shared)]
    .filter((e) => has(e.title) || has(e.memo)).sort((a, b) => b.start.localeCompare(a.start));
  const memos = myMemos().filter((m) => has(m.text)).sort((a, b) => b.createdAt - a.createdAt);
  const todos = db.todos.filter((t) => (t.owner === ME || t.shared) && has(t.text));
  const dls = visibleDeadlines(ME).filter((d) => has(d.title));
  const row = (c, t, s, date) => `<button class="result" data-act="gotoDay" data-date="${date}"><span class="dotc" style="--c:${c}"></span><div><div class="t">${t}</div><div class="s">${s}</div></div></button>`;
  const out = [
    ...evs.map((e) => row(colorOf(e), hl(e.title, q), `${fmtDate(e.start)}${e.end !== e.start ? ' – ' + fmtDate(e.end) : ''} · ${e.owner === ME ? '내 일정' : esc(you().name) + ' 일정'}`, e.start)),
    ...dls.map((d) => row('var(--red)', hl(d.title, q), `레드라인 · ${fmtDate(d.to)}까지`, d.to)),
    ...memos.map((m) => row(db.users[m.owner].colors.memo, hl(m.text, q), `메모 · ${fmtDate(m.date)}`, m.date)),
    ...todos.map((t) => row('var(--muted)', hl(t.text, q), `할 일 · ${fmtDate(t.date)}`, t.date)),
  ];
  return out.join('') || '<div class="empty">검색 결과가 없어요</div>';
}
after.search = () => {
  const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length);
  q.addEventListener('input', () => { S.query = q.value; $('#results').innerHTML = searchResults(); });
};

/* ================= 시트(모달) ================= */
const root = $('#sheet-root');
let sheetBind = null;
function openSheet(html, { center = false, bind } = {}) {
  root.innerHTML = `<div class="overlay ${center ? 'center' : ''}" data-act="overlay"><div class="sheet" role="dialog">${center ? '' : '<div class="grab"></div>'}${html}</div></div>`;
  sheetBind = bind || null;
  if (bind) bind(root.querySelector('.sheet'));
}
function closeSheet() {
  root.innerHTML = ''; sheetBind = null;
  $$('.sday.pending').forEach((el) => el.classList.remove('pending'));
  if (renderQuiet) { renderQuiet = false; render(); }
}
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function confirmSheet(text, sub, okLabel, onOk, danger) {
  openSheet(`<div class="confirm-text">${text}</div>${sub ? `<div class="confirm-sub">${sub}</div>` : ''}
    <div class="actions"><button class="btn ghost" data-act="close">아니요</button><button class="btn ${danger ? 'danger' : ''}" data-act="confirmOk">${okLabel}</button></div>`, { center: true });
  actions.confirmOk = () => { closeSheet(); onOk(); };
}

/* 일정 편집 */
function eventSheet(ev) {
  const isNew = !ev.id;
  const e = { title: '', type: 'schedule', allDay: false, deadline: false, start: S.sel, end: S.sel, startTime: '09:00', endTime: '10:00', shared: false, memo: '', ...ev };
  openSheet(`
    <div class="sheet-head"><button class="icon-btn" data-act="close">${ICON.x}</button><h3>${isNew ? '새 일정' : '일정 수정'}</h3><button class="icon-btn" data-act="saveEvent">${ICON.check}</button></div>
    <div class="field"><input id="e-title" placeholder="제목" value="${esc(e.title)}" /></div>
    <div class="field"><div class="seg" id="e-type">
      <button data-v="schedule" class="${e.type === 'schedule' ? 'on' : ''}">일정</button><button data-v="plan" class="${e.type === 'plan' ? 'on' : ''}">계획</button></div></div>
    <div class="switch-row">하루 종일<button class="switch ${e.allDay ? 'on' : ''}" id="e-allday"></button></div>
    <div class="row2 field"><div><label>시작일</label><input type="date" id="e-start" value="${e.start}" /></div><div><label>종료일</label><input type="date" id="e-end" value="${e.end}" /></div></div>
    <div class="row2 field" id="e-times" style="${e.allDay ? 'display:none' : ''}"><div><label>시작</label><input type="time" id="e-st" value="${e.startTime || '09:00'}" /></div><div><label>종료</label><input type="time" id="e-et" value="${e.endTime || '10:00'}" /></div></div>
    <div class="switch-row">💗 ${esc(you().name)}와 공유<button class="switch ${e.shared ? 'on' : ''}" id="e-shared"></button></div>
    <div class="switch-row"><span>◢ 데드라인 <small style="color:var(--muted);font-weight:500">(마지막 날에 표시)</small></span><button class="switch ${e.deadline ? 'on' : ''}" id="e-deadline"></button></div>
    <div class="field"><label>메모</label><textarea id="e-memo" rows="3" placeholder="이 일정에 남길 메모">${esc(e.memo)}</textarea></div>
    ${isNew ? '' : `<button class="btn danger block" data-act="deleteEvent">일정 삭제</button>`}
  `, {
    bind: (sh) => {
      $$('#e-type button', sh).forEach((b) => b.onclick = () => { $$('#e-type button', sh).forEach((x) => x.classList.toggle('on', x === b)); });
      $$('.switch', sh).forEach((b) => b.onclick = () => { b.classList.toggle('on'); if (b.id === 'e-allday') $('#e-times', sh).style.display = b.classList.contains('on') ? 'none' : ''; });
      if (isNew) setTimeout(() => $('#e-title', sh).focus(), 250);
    },
  });
  actions.saveEvent = () => {
    const sh = root;
    const title = $('#e-title', sh).value.trim(); if (!title) { toast('제목을 입력해 주세요'); return; }
    let start = $('#e-start', sh).value || S.sel; let end = $('#e-end', sh).value || start;
    if (end < start) [start, end] = [end, start];
    const allDay = $('#e-allday', sh).classList.contains('on');
    let st = $('#e-st', sh).value, et = $('#e-et', sh).value;
    if (!allDay && et && st && et <= st) et = `${pad(Math.min(23, +st.slice(0, 2) + 1))}:${st.slice(3)}`;
    const data = { title, type: $('#e-type .on', sh).dataset.v, allDay, start, end, startTime: allDay ? '' : st, endTime: allDay ? '' : et, shared: $('#e-shared', sh).classList.contains('on'), deadline: $('#e-deadline', sh).classList.contains('on'), memo: $('#e-memo', sh).value.trim() };
    if (isNew) {
      db.events.push({ id: uid(), owner: ME, createdAt: Date.now(), ...data });
      if (data.shared) notify('event', `${me().name}님이 공유 일정을 추가했어요: ${title} (${fmtDate(start)})`);
    } else {
      const t = db.events.find((x) => x.id === ev.id); Object.assign(t, data);
      if (data.shared) notify('event', `${me().name}님이 공유 일정을 수정했어요: ${title}`);
    }
    save(); closeSheet(); render(); toast(isNew ? '일정을 등록했어요' : '수정했어요');
  };
  actions.deleteEvent = () => confirmSheet('이 일정을 삭제할까요?', esc(e.title), '삭제', () => {
    db.events = db.events.filter((x) => x.id !== ev.id); save(); render(); toast('삭제했어요');
  }, true);
}

/* 일정 상세 — 사각형을 누르면 메모가 등장 */
function eventDetail(e) {
  const mine = e.owner === ME;
  const dayMemos = memosOn(e.start);
  const when = e.allDay || e.start !== e.end || !e.startTime
    ? (e.start === e.end ? `${fmtDate(e.start)} · 하루 종일` : `${fmtDate(e.start)} – ${fmtDate(e.end)}`)
    : `${fmtDate(e.start)} · ${timeLabel(e.startTime)} – ${timeLabel(e.endTime)}`;
  openSheet(`
    <div class="sheet-head"><button class="icon-btn" data-act="close">${ICON.x}</button><h3>${esc(e.title)}</h3>${mine ? `<button class="icon-btn" data-act="editEvent">수정</button>` : '<span></span>'}</div>
    <div class="kv"><b>언제</b><span>${when}</span></div>
    <div class="kv"><b>종류</b><span class="chip" style="--c:${colorOf(e)}">${e.shared ? '공유 · ' : ''}${CAT[e.type] || '일정'}</span></div>
    ${e.deadline ? `<div class="kv"><b>마감</b><span>◢ ${fmtDate(e.end)}까지</span></div>` : ''}
    <div class="kv"><b>누구</b><span>${mine ? '내 일정' : esc(db.users[e.owner].name) + '의 일정'}</span></div>
    <div class="lbl-sm" style="margin-top:14px">메모</div>
    ${e.memo ? `<div class="detail-memo">${esc(e.memo)}</div>` : ''}
    ${dayMemos.map((m) => `<div class="detail-memo">${m.image ? `<img src="${m.image}" alt="" />` : ''}${esc(m.text)}<div class="s" style="font-size:.75em;color:var(--muted);margin-top:4px">${m.owner === ME ? '나' : esc(you().name)} · ${clockLabel(m.createdAt)}</div></div>`).join('')}
    ${!e.memo && !dayMemos.length ? '<div class="empty" style="padding:14px 0">이 날의 메모가 없어요</div>' : ''}
    <button class="btn ghost block" data-act="memoForDay" data-date="${e.start}" style="margin-top:8px">이 날짜에 메모 쓰기</button>
  `);
  actions.editEvent = () => { closeSheet(); eventSheet(e); };
}

/* 메모 작성 (사진 + 글 + 상대에게 보내기) */
function memoCompose(date = S.sel || todayStr(), text = '') {
  let image = '';
  const draw = (sh) => {
    $('#m-photo', sh).innerHTML = image
      ? `<img src="${image}" alt="" /><button class="rm" type="button" id="m-rm">${ICON.x}</button>`
      : `<div style="display:flex;flex-direction:column;align-items:center;gap:6px">${ICON.image}<span style="font-size:.85em">사진 추가</span></div>`;
    const rm = $('#m-rm', sh); if (rm) rm.onclick = (ev) => { ev.stopPropagation(); image = ''; draw(sh); };
  };
  openSheet(`
    <div class="sheet-head"><button class="icon-btn" data-act="close">${ICON.x}</button><h3>메모</h3><button class="icon-btn" data-act="saveMemo">${ICON.check}</button></div>
    <button type="button" class="photo-pick" id="m-photo"></button>
    <input type="file" accept="image/*" id="m-file" hidden />
    <div class="field"><textarea id="m-text" rows="3" placeholder="메모를 남겨보세요">${esc(text)}</textarea></div>
    <div class="field"><label>날짜</label><input type="date" id="m-date" value="${date}" /></div>
    <div class="switch-row">상대방에게 보내기<button class="switch ${S.memoSend ? 'on' : ''}" id="m-send"></button></div>
  `, {
    bind: (sh) => {
      draw(sh);
      $('#m-photo', sh).onclick = () => $('#m-file', sh).click();
      $('#m-file', sh).onchange = async (ev) => { const f = ev.target.files[0]; if (f) { image = await shrinkImage(f); draw(sh); } };
      $('#m-send', sh).onclick = (ev) => ev.currentTarget.classList.toggle('on');
    },
  });
  actions.saveMemo = () => {
    const t = $('#m-text', root).value.trim();
    if (!t && !image) { toast('메모나 사진을 넣어주세요'); return; }
    const send = $('#m-send', root).classList.contains('on');
    addMemo(t, image, $('#m-date', root).value || date, send);
    closeSheet();
  };
}
function addMemo(text, image, date, send) {
  db.memos.push({ id: uid(), owner: ME, date, text, image, toPartner: send, createdAt: Date.now() });
  if (send) notify('memo', `${me().name}님이 메모를 보냈어요: ${text || '📷 사진'}`);
  save();
  if (S.screen === 'memo') render(); else render();
  toast(send ? `${you().name}에게 메모를 보냈어요` : '메모를 저장했어요');
}
function shrinkImage(file, max = 900) {
  return new Promise((res) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => res('');
    img.src = url;
  });
}

/* ================= 액션 ================= */
const actions = {
  back,
  close: closeSheet,
  overlay: (el, e) => { if (e.target === el) closeSheet(); },
  toMonth: () => go('month'),
  toSearch: () => go('search'),
  toMemo: () => { closeSheet(); go('memo'); },
  toInbox: () => go('inbox'),
  toSettings: () => go('settings'),
  toColors: () => go('colors'),

  /* 할 일 */
  toggleTodo: (el) => {
    const t = db.todos.find((x) => x.id === el.dataset.id); if (!t) return;
    t.done = !t.done;
    if (t.shared && t.done) notify('todo', `${me().name}님이 같이 할 일을 끝냈어요: ${t.text}`);
    save(); render();
  },
  delTodo: (el) => { db.todos = db.todos.filter((x) => x.id !== el.dataset.id); save(); render(); },
  todoShare: () => { S.todoShared = !S.todoShared; const v = $('[data-form="addTodo"] input').value; render(); const i = $('[data-form="addTodo"] input'); i.value = v; i.focus(); },

  /* 월 달력 */
  smile: () => { S.photoMode = !S.photoMode; render(); toast(S.photoMode ? '사진으로 보기' : '일정으로 보기'); },
  prevMonth: () => shiftMonth(-1),
  nextMonth: () => shiftMonth(1),
  pickMonth: () => monthPicker(S.month.y),
  togglePartner: () => { S.viewPartner = !S.viewPartner; render(); toast(S.viewPartner ? `${you().name}의 캘린더로 전환` : '내 캘린더로 전환'); },
  day: (el) => {
    const s = el.dataset.date;
    if (S.rangeStart) {
      const a = S.rangeStart; S.rangeStart = null;
      if (s === a) { render(); toast('기간 선택을 취소했어요'); return; }
      if (S.viewPartner) { render(); return; }
      render();
      eventSheet({ start: s < a ? s : a, end: s < a ? a : s, allDay: true });
      return;
    }
    go('day', { sel: s });
  },

  /* 하루 화면 */
  selDay: (el) => { S.sel = el.dataset.date; history.replaceState({ screen: S.screen, sel: S.sel }, ''); render(true); },
  slot: (el) => {
    if (S.viewPartner && S.screen === 'day') { toast(`${you().name}의 캘린더는 볼 수만 있어요`); return; }
    const h = +el.dataset.hour;
    eventSheet({ startTime: `${pad(h)}:00`, endTime: `${pad(Math.min(23, h + 1))}:${h === 23 ? '59' : '00'}` });
  },
  newEvent: () => { if (S.viewPartner) { toast(`${you().name}의 캘린더는 볼 수만 있어요`); return; } eventSheet({}); },
  openEvent: (el) => { const e = db.events.find((x) => x.id === el.dataset.id); if (e) eventDetail(e); },
  openDeadline: (el) => {
    const d = db.deadlines.find((x) => x.id === el.dataset.id); if (!d) return;
    const mine = d.owner === ME;
    openSheet(`<div class="confirm-text">레드라인 · ${esc(d.title)}</div><div class="confirm-sub">${fmtDate(d.from)} → ${fmtDate(d.to)}${d.shared ? ' · 공유' : ''}</div>
      <div class="actions"><button class="btn ghost" data-act="close">닫기</button>${mine ? '<button class="btn danger" data-act="delDeadline">레드라인 삭제</button>' : ''}</div>`, { center: true });
    actions.delDeadline = () => { db.deadlines = db.deadlines.filter((x) => x.id !== d.id); save(); closeSheet(); render(); toast('레드라인을 지웠어요'); };
  },
  memoForDay: (el) => { closeSheet(); memoCompose(el.dataset.date); },
  splitPrev: () => { S.sel = addDays(S.sel, -1); render(); },
  splitNext: () => { S.sel = addDays(S.sel, 1); render(); },
  gotoDay: (el) => { const s = el.dataset.date; const d = parse(s); S.month = { y: d.getFullYear(), m: d.getMonth() }; go('day', { sel: s, viewPartner: false }); },

  /* 메모 */
  composeMemo: () => memoCompose(),
  memoSendToggle: () => { S.memoSend = !S.memoSend; const v = $('[data-form="quickMemo"] input').value; render(); const i = $('[data-form="quickMemo"] input'); i.value = v; toast(S.memoSend ? `${you().name}에게 보내기 켜짐` : '나만 보기'); },

  /* 설정 */
  pickFont: () => optionSheet('글씨체 변경', FONTS, me().font, (k) => { me().font = k; }, (k, v) => `<span style="font-family:${v.css.replace(/"/g, '&quot;')}">${v.label} · 가나다 Aa</span>`),
  pickTheme: () => optionSheet('테마 변경', THEMES, me().theme, (k) => { me().theme = k; }),
  pickSize: () => optionSheet('글자 크기', SIZES, String(me().fs || 1), (k) => { me().fs = +k; }),
  pickColor: (el) => colorSheet(el.dataset.k),
  editNames: () => {
    openSheet(`<div class="sheet-head"><button class="icon-btn" data-act="close">${ICON.x}</button><h3>이름</h3><button class="icon-btn" data-act="saveNames">${ICON.check}</button></div>
      <div class="field"><label>내 이름</label><input id="n-me" value="${esc(me().name)}" maxlength="12" /></div>
      <div class="field"><label>상대 이름</label><input id="n-you" value="${esc(you().name)}" maxlength="12" /></div>`);
    actions.saveNames = () => { me().name = $('#n-me').value.trim() || me().name; you().name = $('#n-you').value.trim() || you().name; save(); closeSheet(); render(); };
  },
  askNotif: async () => {
    if (!('Notification' in window)) { toast('이 브라우저는 알림을 지원하지 않아요'); return; }
    const p = await Notification.requestPermission(); render(); toast(p === 'granted' ? '알림을 켰어요' : '알림이 꺼져 있어요');
  },
  refreshWx: async () => { toast('날씨를 불러오는 중…'); await loadWeather(true); render(); },
  openPartnerTab: () => { const u = new URL(location.href); u.searchParams.set('as', YOU); window.open(u.toString(), '_blank'); },
  resetAll: () => confirmSheet('모든 데이터를 지울까요?', '예시 데이터로 다시 시작해요', '초기화', () => { db = seed(); save(); applyPrefs(); go('list'); }, true),
};

function monthPicker(year) {
  let y = year;
  const draw = () => `
    <div class="year-row"><button data-act="mpPrev">${ICON.left}</button><span>${y}년</span><button data-act="mpNext">${ICON.right}</button></div>
    <div class="month-pick">${Array.from({ length: 12 }, (_, i) => `<button data-act="mpPick" data-m="${i}" class="${y === S.month.y && i === S.month.m ? 'on' : ''}">${i + 1}월</button>`).join('')}</div>
    <div class="actions"><button class="btn ghost" data-act="mpList">오늘의 LIST</button><button class="btn" data-act="mpToday">오늘로 이동</button></div>`;
  openSheet(`<div id="mp">${draw()}</div>`);
  actions.mpPrev = () => { y--; $('#mp').innerHTML = draw(); };
  actions.mpNext = () => { y++; $('#mp').innerHTML = draw(); };
  actions.mpPick = (el) => { S.month = { y, m: +el.dataset.m }; closeSheet(); render(); };
  actions.mpToday = () => { const d = new Date(); S.month = { y: d.getFullYear(), m: d.getMonth() }; closeSheet(); render(); };
  actions.mpList = () => { closeSheet(); back(); };
}

function optionSheet(title, opts, cur, apply, labelFn) {
  openSheet(`<div class="sheet-head"><span></span><h3>${title}</h3><button class="icon-btn" data-act="close">${ICON.x}</button></div>
    <div class="opt-list">${Object.entries(opts).map(([k, v]) => `<button data-act="optPick" data-k="${k}">${labelFn ? labelFn(k, v) : esc(typeof v === 'string' ? v : v.label)}${String(k) === String(cur) ? ICON.check : ''}</button>`).join('')}</div>`);
  actions.optPick = (el) => { apply(el.dataset.k); save(); applyPrefs(); closeSheet(); render(); };
}

function colorSheet(k) {
  const cur = me().colors[k];
  openSheet(`<div class="sheet-head"><span></span><h3>${CAT[k]} 컬러</h3><button class="icon-btn" data-act="close">${ICON.x}</button></div>
    <div class="palette">${PALETTE.map((c) => `<button data-act="colorPick" data-c="${c}" style="--c:${c}" class="${c === cur ? 'on' : ''}" aria-label="${c}"></button>`).join('')}</div>
    <div class="field"><label>직접 고르기</label><input type="color" id="c-custom" value="${cur}" style="height:52px;padding:6px" /></div>
    <div style="margin-top:6px"><span class="chip" id="c-prev" style="--c:${cur}">${CAT[k]} 미리보기</span></div>`, {
    bind: (sh) => { $('#c-custom', sh).oninput = (e) => { $('#c-prev', sh).style.setProperty('--c', e.target.value); }; $('#c-custom', sh).onchange = (e) => setColor(k, e.target.value); },
  });
  actions.colorPick = (el) => setColor(k, el.dataset.c);
}
function setColor(k, c) {
  me().colors[k] = c;
  if (k === 'shared') notify('color', `${me().name}님이 공유 색상을 바꿨어요`);
  save(); closeSheet(); render(); toast(`${CAT[k]} 컬러를 바꿨어요`);
}

/* 표정 고르기 (스마일 꾹) */
function moodPicker() {
  const mine = db.moods[ME];
  openSheet(`<div class="sheet-head"><span></span><h3>오늘의 표정</h3><button class="icon-btn" data-act="close">${ICON.x}</button></div>
    <div class="confirm-sub" style="margin-top:-6px">고른 표정이 ${esc(you().name)}에게 알림으로 전송돼요</div>
    <div class="face-grid">${Object.entries(FACES).filter(([k]) => k !== 'smile').map(([k, v]) => `<button data-act="moodPick" data-k="${k}" class="${mine && mine.face === k && Date.now() - mine.at < HOUR ? 'on' : ''}">${face(k)}${v.label}</button>`).join('')}</div>`);
  actions.moodPick = (el) => { closeSheet(); sendMood(el.dataset.k); };
}

/* 레드라인 (화면 ③ 숫자 꾹) */
function redlineAsk(target) {
  const from = S.sel < target ? S.sel : target; const to = S.sel < target ? target : S.sel;
  openSheet(`<div class="confirm-text">이 기간까지 레드라인을<br/>설정하겠습니까?</div>
    <div class="confirm-sub">${fmtDate(from)} → <b style="color:var(--red)">${fmtDate(to)}</b></div>
    <div class="field"><input id="r-title" placeholder="레드라인 이름 (예: 시험 기간)" /></div>
    <div class="switch-row" style="padding-top:0">💗 ${esc(you().name)}와 공유<button class="switch" id="r-shared"></button></div>
    <div class="actions"><button class="btn ghost" data-act="close">아니요</button><button class="btn" data-act="redOk" style="background:var(--red);color:#fff">설정</button></div>`, {
    center: true,
    bind: (sh) => { $('#r-shared', sh).onclick = (e) => e.currentTarget.classList.toggle('on'); },
  });
  actions.redOk = () => {
    const title = $('#r-title', root).value.trim() || '레드라인';
    const shared = $('#r-shared', root).classList.contains('on');
    db.deadlines.push({ id: uid(), owner: ME, from, to, title, shared });
    if (shared) notify('deadline', `${me().name}님이 레드라인을 설정했어요: ${title} (${fmtDate(to)}까지)`);
    save(); closeSheet(); render(); toast('레드라인을 설정했어요');
  };
}

/* ================= 꾹 누르기 ================= */
const LONG = {
  mood: () => moodPicker(),
  range: (el) => {
    if (S.viewPartner) { toast(`${you().name}의 캘린더는 볼 수만 있어요`); return; }
    S.rangeStart = el.dataset.date; render(); toast('끝나는 날짜를 눌러주세요');
  },
  strip: (el) => {
    const d = el.dataset.date;
    if (d === S.sel) { go('split'); return; } // 당일 숫자 꾹 → 화면 ⑨
    if (S.viewPartner) { toast(`${you().name}의 캘린더는 볼 수만 있어요`); return; }
    el.classList.add('pending'); redlineAsk(d);
  },
  memo: (el) => {
    const m = db.memos.find((x) => x.id === el.dataset.id); if (!m || m.owner !== ME) return;
    confirmSheet('이 메모를 삭제할까요?', esc((m.text || '사진').slice(0, 40)), '삭제', () => { db.memos = db.memos.filter((x) => x.id !== m.id); save(); render(); }, true);
  },
};
let lpTimer = null, lpFired = false, lpStart = null;
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-lp]'); lpFired = false;
  if (!el) return;
  lpStart = { x: e.clientX, y: e.clientY };
  clearTimeout(lpTimer);
  lpTimer = setTimeout(() => {
    lpFired = true;
    if (navigator.vibrate) navigator.vibrate(15);
    LONG[el.dataset.lp] && LONG[el.dataset.lp](el);
  }, 480);
});
const cancelLP = () => clearTimeout(lpTimer);
document.addEventListener('pointerup', cancelLP);
document.addEventListener('pointercancel', cancelLP);
document.addEventListener('pointermove', (e) => { if (lpStart && Math.hypot(e.clientX - lpStart.x, e.clientY - lpStart.y) > 10) cancelLP(); });
document.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-lp]')) e.preventDefault(); });

/* ================= 이벤트 위임 ================= */
document.addEventListener('click', (e) => {
  if (lpFired) { lpFired = false; e.preventDefault(); e.stopPropagation(); return; }
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = actions[el.dataset.act]; if (!fn) return;
  if (el.dataset.act === 'overlay') { if (e.target === el) closeSheet(); return; } // 시트 안 입력창 클릭은 그대로 둠
  e.preventDefault();
  fn(el, e);
}, true);

document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-form]'); if (!f) return;
  e.preventDefault();
  const kind = f.dataset.form; const input = f.querySelector('input'); const v = input ? input.value.trim() : '';
  if (kind === 'addTodo' && v) {
    db.todos.push({ id: uid(), owner: ME, date: todayStr(), text: v, done: false, shared: !!S.todoShared });
    if (S.todoShared) notify('todo', `${me().name}님이 같이 할 일을 추가했어요: ${v}`);
    save(); render(); $('[data-form="addTodo"] input').focus();
  } else if (kind === 'addShared' && v) {
    db.todos.push({ id: uid(), owner: ME, date: todayStr(), text: v, done: false, shared: true });
    notify('todo', `${me().name}님이 같이 할 일을 추가했어요: ${v}`);
    save(); render();
  } else if (kind === 'quickMemo' && v) {
    addMemo(v, '', S.sel || todayStr(), S.memoSend);
  }
});

/* ================= 시작 ================= */
render();
loadWeather();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
// 자정이 지나면 LIST 날짜 갱신
let lastDay = todayStr();
setInterval(() => { if (todayStr() !== lastDay) { lastDay = todayStr(); render(); } }, 60e3);
})();
