/* nneow — 상대와 나, 둘만 공유하는 캘린더
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
  reply: I('<path d="M10 8L5 12.5 10 17"/><path d="M5 12.5h9a5 5 0 0 1 5 5V19"/>'),
  download: I('<path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/>'),
  upload: I('<path d="M12 16V5M7 9.5l5-5 5 5M5 19.5h14"/>'),
  google: I('<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
  bars: I('<path d="M7 5v14M12 5v14M17 5v14"/>'),
  grid: I('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
  list: I('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>'),
  share: I('<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12"/>'),
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
/* 스티커 — 상대 캘린더에 붙일 수 있음 */
const STICKERS = {
  heart: { label: '하트', svg: '<svg class="stk" viewBox="0 0 24 24"><path d="M12 21s-8.2-5-8.2-11.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.2 2.8C20.2 16 12 21 12 21z" fill="#ff7aa8" stroke="#ec5c8f" stroke-width="1.2" stroke-linejoin="round"/><ellipse cx="8.3" cy="9.6" rx="1.7" ry="1.1" fill="#fff" opacity=".75" transform="rotate(-30 8.3 9.6)"/></svg>' },
  star: { label: '별', svg: '<svg class="stk" viewBox="0 0 24 24"><path d="M12 2.8l2.8 5.7 6.3.9-4.6 4.5 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.5 6.3-.9z" fill="#ffd23f" stroke="#e7b500" stroke-width="1.2" stroke-linejoin="round"/><circle cx="9.6" cy="10" r="1" fill="#fff" opacity=".8"/></svg>' },
  clover: { label: '네잎클로버', svg: '<svg class="stk" viewBox="0 0 24 24"><g fill="#55c271" stroke="#2f9a4d" stroke-width="1" stroke-linejoin="round"><path d="M12 11.5C9 11.5 6 10 6 7.3 6 5.6 7.4 4.5 8.8 4.9 10 5.2 10.6 6 12 7.2 13.4 6 14 5.2 15.2 4.9 16.6 4.5 18 5.6 18 7.3 18 10 15 11.5 12 11.5z" transform="rotate(0 12 12)"/><path d="M12 11.5C9 11.5 6 10 6 7.3 6 5.6 7.4 4.5 8.8 4.9 10 5.2 10.6 6 12 7.2 13.4 6 14 5.2 15.2 4.9 16.6 4.5 18 5.6 18 7.3 18 10 15 11.5 12 11.5z" transform="rotate(90 12 12)"/><path d="M12 11.5C9 11.5 6 10 6 7.3 6 5.6 7.4 4.5 8.8 4.9 10 5.2 10.6 6 12 7.2 13.4 6 14 5.2 15.2 4.9 16.6 4.5 18 5.6 18 7.3 18 10 15 11.5 12 11.5z" transform="rotate(180 12 12)"/><path d="M12 11.5C9 11.5 6 10 6 7.3 6 5.6 7.4 4.5 8.8 4.9 10 5.2 10.6 6 12 7.2 13.4 6 14 5.2 15.2 4.9 16.6 4.5 18 5.6 18 7.3 18 10 15 11.5 12 11.5z" transform="rotate(270 12 12)"/></g><circle cx="12" cy="12" r="1.3" fill="#2f9a4d"/></svg>' },
};
const catFace = () => '<svg class="face cat-face" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 8 L7.5 -1.5 L15.5 3.6 A17 17 0 0 1 24.5 3.6 L32.5 -1.5 L32 8 A17 17 0 1 1 8 8 Z"/></svg>';
const face = (k) => `<svg class="face" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="20" cy="20" r="17"/>${(FACES[k] || FACES.smile).d}</svg>`;

/* ================= 저장소 ================= */
const CLOUD = (() => { try { return JSON.parse(localStorage.getItem('nneow.cloud')); } catch { return null; } })();
const KEY = CLOUD ? 'nneow.couple.' + CLOUD.cid : 'duo.store.v1';
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
      b: { name: '상대', colors: { schedule: '#e0707c', plan: '#f5a94a', memo: '#6dbb6d', shared: '#ff8fb1' }, font: 'wanted', theme: 'pink', fs: 1, allowAccess: true },
    },
    events: [
      ev({ owner: 'a', title: '여행', start: D(9), end: D(11), allDay: true, shared: true, memo: '짐 미리 싸두기!', createdAt: now - 60 * HOUR }),
      ev({ owner: 'a', title: '회의', start: D(9), end: D(9), startTime: '10:00', endTime: '11:00' }),
      ev({ owner: 'a', title: '아침 운동', start: today, end: today, startTime: '07:00', endTime: '08:00', type: 'plan', doneBy: { a: true } }),
      ev({ owner: 'a', title: '팀 회의', start: today, end: today, startTime: '14:00', endTime: '15:00', memo: '발표 자료 확인' }),
      ev({ owner: 'a', title: '저녁 약속', start: today, end: today, startTime: '19:00', endTime: '21:00', shared: true, createdAt: now - 3 * HOUR }),
      ev({ owner: 'b', title: '병원 방문', start: today, end: today, startTime: '11:00', endTime: '12:00', doneBy: { b: true } }),
      ev({ owner: 'b', title: '회의', start: today, end: today, startTime: '10:00', endTime: '11:00', type: 'plan' }),
      ev({ owner: 'b', title: '기념일', start: D(23), end: D(23), allDay: true, shared: true, createdAt: now - 26 * HOUR }),
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
    moodLog: [],
    photos: { a: {}, b: {} },
    gallery: [], stickers: [], pokes: [],
    notifs: [],
  };
}

function emptyDb() {
  return {
    v: 1,
    users: {
      a: { name: '나', colors: { ...DEFAULT_COLORS }, font: 'wanted', theme: 'light', fs: 1, allowAccess: false },
      b: { name: '상대', colors: { ...DEFAULT_COLORS, shared: '#ff8fb1' }, font: 'wanted', theme: 'light', fs: 1, allowAccess: false },
    },
    events: [], deadlines: [], memos: [], todos: [], moods: {}, moodLog: [], photos: { a: {}, b: {} }, notifs: [],
    gallery: [], stickers: [], pokes: [],
  };
}
function ensureShape(d) {
  const e = emptyDb();
  Object.keys(e).forEach((k) => { if (d[k] == null) d[k] = e[k]; });
  d.photos.a = d.photos.a || {}; d.photos.b = d.photos.b || {};
  ['a', 'b'].forEach((r) => { d.users[r] = { ...e.users[r], ...(d.users[r] || {}) }; d.users[r].colors = { ...e.users[r].colors, ...(d.users[r].colors || {}) }; });
  // 예전 '날짜별 사진'을 공유 갤러리로 옮김 (id가 같아서 두 기기에서 옮겨도 중복되지 않음)
  ['a', 'b'].forEach((r) => Object.entries(d.photos[r]).forEach(([date, o]) => {
    const id = `ph_${r}_${date}`;
    if (o && o.img && !d.gallery.some((g) => g.id === id)) d.gallery.push({ id, owner: r, date, img: o.img, src: o.src || '', caption: '', at: o.at || Date.now(), onCal: true });
  }));
  d.photos = { a: {}, b: {} };
  return d;
}
function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
let db = load();
if (!db || !db.users) { db = CLOUD ? emptyDb() : seed(); }
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch { if (!CLOUD) toast('저장 공간이 부족해요. 사진 메모를 일부 지워주세요.'); }
  if (CLOUD && window.nneowCloud) window.nneowCloud.push(db);
}
ensureShape(db);
try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* 용량 초과 시 무시 */ }

/* 사용자: 기본은 'a'. ?as=b 로 상대방 시점 */
const params = new URLSearchParams(location.search);
const ME = CLOUD ? CLOUD.role : (params.get('as') === 'b' || params.get('as') === 'a') ? params.get('as') : (sessionStorage.getItem('duo.me') || localStorage.getItem('duo.me') || 'a');
if (!CLOUD) sessionStorage.setItem('duo.me', ME);
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
  memoTab: 'all',
  memoPrivate: false,
  memoView: 'list',
  memoImg: '',
  placing: null,
  galFilter: 'all',
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
const rainLikely = (s) => { const d = dayWx(s); return !!(d && d.prob != null && d.prob >= 70); }; // 비 올 확률 70% 이상

function getPos() {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition((p) => res(p.coords), () => res(null), { timeout: 8000, maximumAge: 30 * 60e3 });
  });
}
async function loadWeather(force = false) {
  if (!force && wx && wx.v === 2 && Date.now() - wx.at < 30 * 60e3) return;
  const pos = await getPos();
  const lat = pos ? pos.latitude : 37.5665; const lon = pos ? pos.longitude : 126.978; // 위치 권한이 없으면 서울
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&past_days=62&forecast_days=16&timezone=auto`;
    const r = await fetch(url); if (!r.ok) throw new Error('weather');
    const j = await r.json();
    const daily = {};
    j.daily.time.forEach((t, i) => { daily[t] = { code: j.daily.weather_code[i], max: Math.round(j.daily.temperature_2m_max[i]), min: Math.round(j.daily.temperature_2m_min[i]), prob: (j.daily.precipitation_probability_max || [])[i] }; });
    wx = { v: 2, at: Date.now(), gps: !!pos, current: { temp: Math.round(j.current.temperature_2m), code: j.current.weather_code }, daily };
    localStorage.setItem(WX_KEY, JSON.stringify(wx));
    render();
  } catch { /* 오프라인이면 캐시 유지 */ }
}

/* ================= 데이터 조회 ================= */
const colorOf = (ev) => db.users[ev.owner].colors[ev.shared ? 'shared' : (ev.type || 'schedule')];
const covers = (ev, s) => ev.start <= s && ev.end >= s;
const isTimed = (e) => !e.allDay && e.start === e.end && e.startTime;
/* 내 캘린더: 내 일정 + 상대가 공유한 일정 / 상대 캘린더(⑤): 상대 일정 + 내가 공유한 일정 */
function visibleEvents(owner = S.viewPartner ? YOU : ME) {
  const other = owner === ME ? YOU : ME;
  return db.events.filter((e) => e.owner === owner || (e.owner === other && e.shared));
}
function visibleDeadlines(owner = S.viewPartner ? YOU : ME) {
  return db.deadlines.filter((d) => d.owner === owner || d.shared);
}
const myMemos = () => db.memos.filter((m) => !m.chat && (m.owner === ME || m.toPartner));
const memosOn = (s) => myMemos().filter((m) => m.date === s);
const unreadMemos = () => db.notifs.filter((n) => n.to === ME && n.type === 'memo' && !n.read).length;
/* ① LIST = 오늘 일정 (내 일정 + 상대가 공유한 일정). 완료 체크는 사람마다 따로 */
const isDone = (e, who) => !!(e.doneBy && e.doneBy[who]);
function listToday(who) {
  const t = todayStr();
  return visibleEvents(who).filter((e) => covers(e, t))
    .sort((a, b) => (isTimed(a) ? 1 : 0) - (isTimed(b) ? 1 : 0) || (a.startTime || '').localeCompare(b.startTime || ''));
}
function progressOf(who) { const l = listToday(who); const done = l.filter((e) => isDone(e, who)).length; return { total: l.length, done, pct: l.length ? Math.round(done / l.length * 100) : 0 }; }
const photosOn = (s) => db.gallery.filter((g) => g.date === s && g.onCal).sort((a, b) => b.at - a.at); // 달력에 붙인 사진만
const stickerOn = (owner, s) => db.stickers.filter((x) => x.to === owner && x.date === s).sort((a, b) => b.at - a.at)[0];
const hasEventOn = (owner, s) => visibleEvents(owner).some((e) => covers(e, s));

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
refreshSessionFace(false); // 달력에 실제로 표시될 때 '봤음'으로 기록 (after.month)
setInterval(() => { // 1시간이 지나면 스마일로 초기화
  const before = S.sessionFace; refreshSessionFace(false);
  if (before !== S.sessionFace && S.screen === 'month') render();
}, 30e3);

function sendMood(k) {
  db.moods[ME] = { face: k, at: Date.now(), seenAt: null };
  db.moodLog.push({ id: uid(), owner: ME, face: k, at: Date.now() });
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
      navigator.serviceWorker.ready.then((r) => r.showNotification('nneow', { body: n.text, icon: 'assets/icons/icon-192.png', tag: n.id }));
    } else new Notification('nneow', { body: n.text, icon: 'assets/icons/icon-192.png' });
  } catch { /* 무시 */ }
}

/* 다른 탭(상대방)에서 바뀐 내용 실시간 반영 */
function applyRemote(next, persist) {
  if (!next || !next.users) return;
  const prevIds = new Set(db.notifs.map((n) => n.id));
  db = ensureShape(next);
  if (persist) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* 용량 초과 시 캐시 생략 */ } }
  const fresh = db.notifs.filter((n) => n.to === ME && !prevIds.has(n.id) && Date.now() - n.at < 5 * 60e3).slice(-3);
  fresh.forEach((n) => {
    toastHTML(n.face ? `${face(n.face)} ${esc(n.text)}` : esc(n.text));
    systemNotify(n);
  });
  const pm = db.moods[YOU]; // 상대가 바꾼 표정을 아직 못 봤다면 (1시간 이내) 지금 보여줌
  if (pm && !pm.seenAt && Date.now() - pm.at < HOUR && S.sessionFaceAt !== pm.at) { S.sessionFaceAt = null; refreshSessionFace(false); bumpSmile = true; }
  applyPrefs();
  if (!$('.overlay')) { render(false, true); showPokes(); } else renderQuiet = true;
}
window.addEventListener('storage', (e) => {
  if (e.key !== KEY || !e.newValue) return;
  applyRemote(load(), false);
});
let bumpSmile = false; let renderQuiet = false;

/* ================= 환경 설정 반영 ================= */
const FONTS = {
  wanted: { label: 'Wanted Sans', css: '"Wanted Sans Variable", "Wanted Sans", -apple-system, "Apple SD Gothic Neo", sans-serif' },
  system: { label: '시스템 기본', css: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif' },
  serif: { label: '명조', css: '"Nanum Myeongjo", "AppleMyungjo", "Noto Serif KR", "Batang", serif' },
  round: { label: '둥근 고딕', css: '"Nanum Square Round", "NanumSquareRound", "Jua", "Apple SD Gothic Neo", sans-serif' },
};
const THEMES = { light: '화이트', pink: '핑크', cream: '크림', dark: '다크' };
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
  history.pushState({ screen, sel: S.sel, memoId: S.memoId }, '');
  render(true);
}
function back() { history.back(); }
window.addEventListener('popstate', (e) => {
  closeSheet();
  const st = e.state || { screen: 'list' };
  S.screen = st.screen; if (st.sel) S.sel = st.sel; if (st.memoId) S.memoId = st.memoId;
  S.rangeStart = null;
  render(true);
});
history.replaceState({ screen: 'list' }, '');

/* ================= 렌더 ================= */
const app = $('#app');
function render(scrollTop, keepInput) {
  let keep = null;
  const ae = document.activeElement;
  if (keepInput && ae && app.contains(ae) && /^(INPUT|TEXTAREA)$/.test(ae.tagName)) {
    const f = ae.closest('[data-form]');
    keep = { sel: ae.id ? '#' + ae.id : f ? `[data-form="${f.dataset.form}"] [name="${ae.name}"]` : null, v: ae.value };
  }
  const sc = keepInput && $('.scroll', app); const top = sc ? sc.scrollTop : 0;
  const fn = SCREENS[S.screen] || SCREENS.list;
  app.innerHTML = fn();
  after[S.screen] && after[S.screen](scrollTop);
  if (keepInput && S.screen !== 'inbox' && S.screen !== 'memo') { const n = $('.scroll', app); if (n) n.scrollTop = top; }
  if (keep && keep.sel) { const n = $(keep.sel); if (n) { n.value = keep.v; n.focus(); } }
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
  const items = listToday(ME);
  const cur = wx && wx.current; const wet = cur && isWet(cur.code);
  return `
  <section class="screen list-screen">
    <div class="list-date">${fmtFull(t)}</div>
    <div class="list-title-row">
      <button class="list-title" data-act="toMonth">LIST</button>
      <span class="wx-dot ${wet ? 'wet' : ''}" title="${wet ? '비/눈' : ''}"></span>
      <span class="wx ${wet ? 'wet' : ''}">${cur ? `${wxIcon(cur.code)} ${cur.temp}°C` : `${ICON.cloud} --°C`}</span>
    </div>
    ${connBanner()}
    <div class="scroll">
      <ul class="todo-list">
        ${items.length ? items.map((e) => { const done = isDone(e, ME); return `
          <li class="todo ${done ? 'done' : ''}">
            <button class="chk ${done ? 'on' : ''}" data-act="toggleDone" data-id="${e.id}" aria-label="완료">${done ? ICON.check : ''}</button>
            <span class="txt">${esc(e.title)}</span>
            <span class="todo-when">${isTimed(e) ? timeLabel(e.startTime) : e.start !== e.end ? `${parse(e.start).getDate()}–${parse(e.end).getDate()}일` : '하루 종일'}</span>
            ${e.owner !== ME ? `<span class="tag">${esc(you().name)}</span>` : e.shared ? '<span class="tag">함께</span>' : ''}
          </li>`; }).join('') : '<li class="empty">오늘은 일정이 없어요<br/>달력에서 일정을 추가하면 여기에 떠요</li>'}
      </ul>
      <div class="list-hint">LIST를 누르면 달력으로 넘어가요</div>
    </div>
  </section>`;
};

/* 연결이 끊겼거나, 홈 화면 앱에서 아직 로그인하지 않았을 때 안내 */
function connBanner() {
  const c = window.nneowCloud; if (!c || !c.available) return '';
  if (CLOUD && c.status === 'signed-out') return `<button class="conn-banner" data-act="toPair"><b>로그인이 풀려 연결이 끊겼어요</b><span>같은 계정으로 다시 로그인하면 그대로 이어져요 →</span></button>`;
  if (!CLOUD && IS_STANDALONE && c.status !== 'signed-in') return `<button class="conn-banner" data-act="toPair"><b>상대와 연결하려면 한 번 로그인해 주세요</b><span>홈 화면 앱은 Safari와 따로 저장돼요. 같은 계정으로 로그인하면 바로 이어져요 →</span></button>`;
  return '';
}

/* ---------- ② 월 달력 ---------- */
SCREENS.month = () => {
  const { y, m } = S.month;
  const first = new Date(y, m, 1);
  const start = ymd(new Date(y, m, 1 - first.getDay()));
  const daysIn = new Date(y, m + 1, 0).getDate();
  const weeks = 6; // 달마다 높이가 달라지지 않게 항상 6줄
  const evs = visibleEvents();
  const owner = S.viewPartner ? YOU : ME;
  const t = todayStr();
  let html = '';
  for (let w = 0; w < weeks; w++) {
    const ws = addDays(start, w * 7); const we = addDays(ws, 6);
    let cells = '';
    for (let i = 0; i < 7; i++) {
      const s = addDays(ws, i); const d = parse(s);
      const out = d.getMonth() !== m;
      const dm = memosOn(s);
      const memoCol = dm.length ? db.users[(dm.find((x) => x.owner === ME) || dm[0]).owner].colors.memo : '';
      const rainy = !out && rainLikely(s);
      const dlEnd = evs.some((x) => x.deadline && x.end === s);
      // 갤러리: 두 사람의 사진을 함께 보여줌 (보고 있는 캘린더 주인의 사진이 크게, 다른 사람 사진은 작게)
      const other = owner === ME ? YOU : ME;
      const phs = S.photoMode && !out ? photosOn(s) : [];
      const photo = phs.find((g) => g.owner === owner) || phs[0];
      const subPhoto = photo && photo.owner === owner && phs.find((g) => g.owner === other);
      const stk = !out && stickerOn(owner, s);
      const blocked = S.placing && !out && hasEventOn(YOU, s);
      cells += `
        <div class="cell ${i === 0 ? 'sun' : ''} ${out ? 'out' : ''} ${s === t ? 'today' : ''} ${S.rangeStart === s ? 'range-start' : ''} ${S.photoMode ? 'pmode' : ''} ${blocked ? 'blocked' : ''} ${S.placing && !blocked ? 'placeable' : ''}"
             data-act="day" data-lp="range" data-date="${s}">
          <div class="num-wrap">${rainy ? '<span class="rainbox"></span>' : ''}<span class="num">${d.getDate()}</span></div>
          ${memoCol && !out ? `<span class="memo-bar" style="--c:${memoCol}"></span>` : ''}
          ${photo ? `<div class="cell-photo-wrap"><img class="cell-photo" src="${photo.img}" alt="" />${subPhoto ? `<img class="cell-photo-sub" src="${subPhoto.img}" alt="" />` : ''}${phs.length > 1 && !subPhoto ? `<span class="cell-photo-n">${phs.length}</span>` : ''}</div>` : ''}
          ${stk ? `<span class="cell-stk ${photo ? 'on-photo' : ''}" style="left:${Math.round((stk.x ?? 0.5) * 100)}%;top:${Math.round((stk.y ?? 0.78) * 100)}%">${STICKERS[stk.kind] ? STICKERS[stk.kind].svg : ''}</span>` : ''}
          ${!out && dlEnd && !S.photoMode ? '<span class="deadline-tri" title="데드라인"></span>' : ''}
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
        bars += `<div class="bar ${contL ? 'cont-l' : ''} ${contR ? 'cont-r' : ''}" style="--c:${colorOf(e)};left:calc(${vis0} * 100% / 7 + 3px);width:calc(${vis1 - vis0 + 1} * 100% / 7 - 6px);top:${47 + lane * 21}px">${esc(e.title)}</div>`;
      });
      Object.entries(extra).forEach(([c, n]) => { bars += `<div class="bar more" style="left:calc(${c} * 100% / 7);width:calc(100% / 7);top:${47 + 3 * 21}px">+${n}</div>`; });
    }
    html += `<div class="week">${cells}<div class="bars">${bars}</div></div>`;
  }
  const curFace = S.flashFace || S.sessionFace;
  const unread = unreadMemos();
  return `
  <section class="screen">
    <header class="month-head">
      <button class="icon-btn smile-btn ${bumpSmile ? 'bump' : ''}" data-act="smile" data-lp="mood" aria-label="표정 / 사진 보기 전환">${S.viewPartner ? catFace() : face(curFace)}</button>
      <button class="icon-btn" data-act="prevMonth" aria-label="이전 달">${ICON.left}</button>
      <button class="month-title" data-act="pickMonth">${y}년 ${m + 1}월</button>
      <button class="icon-btn" data-act="nextMonth" aria-label="다음 달">${ICON.right}</button>
      <button class="icon-btn" data-act="toSearch" aria-label="검색">${ICON.search}</button>
    </header>
    ${S.placing ? `<div class="place-hint">${STICKERS[S.placing].svg}<span>붙이고 싶은 자리를 눌러주세요</span><button data-act="cancelPlace">취소</button></div>` : ''}
    <div class="weekdays">${WD.map((d, i) => `<span class="${i === 0 ? 'sun' : ''}">${d}</span>`).join('')}</div>
    <div class="grid" id="grid">${html}</div>
    <nav class="bottombar">
      <button data-act="toMemo" aria-label="메모">${ICON.square}${unread ? `<span class="badge">${unread > 99 ? '99+' : unread}</span>` : ''}</button>
      <button data-act="togglePartner" data-lp="plus" class="${S.viewPartner ? 'on' : ''}" aria-label="상대 캘린더 전환">${ICON.plus}</button>
      <button data-act="toGallery" data-lp="bars" aria-label="갤러리">${ICON.bars}</button>
      <button data-act="toSettings" data-lp="circle" aria-label="설정">${ICON.circle}</button>
    </nav>
  </section>`;
};
after.month = () => {
  bumpSmile = false;
  const pm = db.moods[YOU]; // 상대 표정이 화면에 처음 보인 순간 → 다음 접속부터는 스마일
  if (pm && S.sessionFaceAt === pm.at && !pm.seenAt) { pm.seenAt = Date.now(); save(); }
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
    const redEnd = dls.some((x) => x.to === d);
    s += `<button class="sday ${dt.getDay() === 0 ? 'sun' : ''} ${d === S.sel ? 'sel' : ''} ${redEnd ? 'redend' : ''}" data-act="selDay" data-lp="strip" data-date="${d}" id="sd-${d}">
      <span class="w">${WD[dt.getDay()]}</span><span class="d">${dt.getDate()}</span>
    </button>`;
  }
  return `<div class="strip" id="strip">${s}</div>`;
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
    const hasNote = (g.e.notes || []).some((n) => n.by !== g.e.owner); // 상대가 남긴 메모 = 검은 동그라미
    return `<button class="ev" data-act="openEvent" data-lp="evNote" data-id="${g.e.id}" style="--c:${colorOf(g.e)};top:${g.s / 60 * ROW + 2}px;height:${(g.f - g.s) / 60 * ROW - 4}px;left:calc(${g.col} * 100% / ${g.n} + 4px);width:calc(100% / ${g.n} - 8px)">
      ${esc(g.e.title)}${hasMemo ? '<span class="mini"></span>' : ''}${hasNote ? '<span class="mini dot"></span>' : ''}
      <small>${timeLabel(g.e.startTime)}${g.e.endTime ? ' – ' + timeLabel(g.e.endTime) : ''}${g.e.owner !== ME ? ' · ' + esc(db.users[g.e.owner].name) : ''}</small>
    </button>`;
  }).join('');
}
SCREENS.day = () => {
  const evs = visibleEvents().filter((e) => covers(e, S.sel));
  const allday = evs.filter((e) => !isTimed(e));
  const timed = evs.filter(isTimed);
  const dls = visibleDeadlines().filter((d) => d.from <= S.sel && d.to >= S.sel);
  const stkDay = stickerOn(S.viewPartner ? YOU : ME, S.sel);
  let hours = '';
  for (let h = 0; h < 24; h++) hours += `<div class="hour"><div class="lbl">${hourLabel(h)}</div><div class="slot" data-act="slot" data-hour="${h}"></div></div>`;
  return `
  <section class="screen">
    ${topbar(fmtDate(S.sel), `<button class="icon-btn" data-act="newEvent" aria-label="일정 추가">${ICON.plus}</button>`)}
    ${stripHTML()}
    ${allday.length || dls.length || stkDay ? `<div class="allday">
      ${stkDay ? `<button class="chip stk-chip" data-act="openSticker" data-id="${stkDay.id}">${STICKERS[stkDay.kind] ? STICKERS[stkDay.kind].svg : ''} ${esc(db.users[stkDay.from].name)}의 스티커</button>` : ''}
      ${dls.map((d) => `<button class="chip red" data-act="openDeadline" data-id="${d.id}">레드라인 · ${esc(d.title)} ${d.to === S.sel ? '· 오늘까지' : `· ${diffDays(S.sel, d.to)}일 남음`}</button>`).join('')}
      ${allday.map((e) => `<button class="chip" style="--c:${colorOf(e)}" data-act="openEvent" data-id="${e.id}">${esc(e.title)}${e.start !== e.end ? ` (${parse(e.start).getDate()}–${parse(e.end).getDate()}일)` : ''}</button>`).join('')}
    </div>` : ''}
    <div class="scroll" id="tl-scroll">
      <div class="timeline">
        ${hours}
        <div class="ev-layer">${evBlocks(timed)}</div>
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
  // 공유 일정은 양쪽 칸에 모두 표시
  const mine = visibleEvents(ME).filter((e) => covers(e, S.sel));
  const yours = visibleEvents(YOU).filter((e) => covers(e, S.sel));
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

/* ---------- ④ 메모: 모아보기 / 나누기 ---------- */
const whoName = (o) => (o === ME ? me().name : you().name);
function quoteHTML(r) {
  if (!r) return '';
  const m = r.kind === 'memo' && db.memos.find((x) => x.id === r.id);
  if (!m) return '<div class="kk-quote"><span>삭제된 메모</span></div>';
  return `<div class="kk-quote"><b>${esc(whoName(m.owner))}에게 답장</b><span>${esc(m.text || '사진')}</span></div>`;
}
function memoListItems() {
  const list = S.memoPrivate
    ? db.memos.filter((m) => m.owner === ME && !m.toPartner)
    : db.memos.filter((m) => m.toPartner);
  return list.slice().sort((a, b) => b.createdAt - a.createdAt);
}
function memoAllHTML() {
  const list = memoListItems();
  const tools = `<div class="memo-tools">
    <button class="chkline" data-act="memoPrivate"><span class="chk ${S.memoPrivate ? 'on' : ''}">${S.memoPrivate ? ICON.check : ''}</span>나만 보는 메모</button>
    <div class="viewtog"><button data-act="memoView" data-v="list" class="${S.memoView === 'list' ? 'on' : ''}" aria-label="목록">${ICON.list}</button><button data-act="memoView" data-v="grid" class="${S.memoView === 'grid' ? 'on' : ''}" aria-label="바둑판">${ICON.grid}</button></div>
  </div>`;
  const empty = `<div class="empty">${S.memoPrivate ? '나만 보는 메모가 없어요' : '나눈 메모가 없어요'}</div>`;
  const body = !list.length ? empty : S.memoView === 'grid'
    ? `<div class="memo-grid">${list.map((m) => `<button class="mg-item" style="--c:${db.users[m.owner].colors.memo}" data-act="openMemo" data-lp="memo" data-id="${m.id}">
        ${m.image ? `<img src="${m.image}" alt="" />` : `<span class="mg-text">${esc(m.text)}</span>`}
        <span class="mg-who">${esc(whoName(m.owner).slice(0, 1))}</span></button>`).join('')}</div>`
    : `<div class="memo-list">${list.map((m) => `<button class="ml-item" style="--c:${db.users[m.owner].colors.memo}" data-act="openMemo" data-lp="memo" data-id="${m.id}">
        <span class="ml-bar"></span>
        <div class="ml-body"><div class="ml-text">${esc(m.text) || '사진'}</div>
        <div class="ml-sub">${esc(whoName(m.owner))} · ${m.chat ? clockLabel(m.createdAt) : fmtDate(m.date) + ' 메모'} · ${ago(m.createdAt)}</div></div>
        ${m.image ? `<img class="ml-img" src="${m.image}" alt="" />` : ''}</button>`).join('')}</div>`;
  return `${tools}<div class="scroll" id="memo-scroll">${body}<div style="height:90px"></div></div>
    <button class="fab" data-act="composeMemo" aria-label="메모 쓰기">${ICON.plus}</button>`;
}
function memoPadHTML() {
  const list = db.memos.filter((m) => m.toPartner).slice().sort((a, b) => a.createdAt - b.createdAt);
  let lastDay = '';
  const rows = list.map((m) => {
    const mine = m.owner === ME; const day = ymd(new Date(m.createdAt));
    const sep = day !== lastDay ? `<div class="pad-date">${fmtDate(day)}</div>` : ''; lastDay = day;
    return `${sep}<div class="pad-row ${mine ? 'me' : 'you'}" data-lp="memo" data-kind="memo" data-id="${m.id}">
      <div class="pad-meta">${esc(whoName(m.owner))} · ${clockLabel(m.createdAt)}${m.chat ? '' : ` · ${fmtDate(m.date)} 메모`}</div>
      ${quoteHTML(m.replyTo)}
      ${m.image ? `<img class="pad-img" src="${m.image}" alt="" />` : ''}
      ${m.text ? `<div class="pad-text">${esc(m.text)}</div>` : ''}
      <span class="kk-reply-ico">${ICON.reply}</span>
    </div>`;
  }).join('');
  const rm = S.replyTo && db.memos.find((x) => x.id === S.replyTo.id);
  return `<div class="scroll pad" id="pad-scroll">${rows || '<div class="empty">메모를 주고받아 보세요</div>'}</div>
    <div class="pad-bottom">
      ${rm ? `<div class="kk-replybar"><div><b>${esc(whoName(rm.owner))}에게 답장</b><span>${esc(rm.text || '사진')}</span></div><button data-act="cancelReply" aria-label="답장 취소">${ICON.x}</button></div>` : ''}
      ${S.memoImg ? `<div class="pad-attach"><img src="${S.memoImg}" alt="" /><button data-act="padImgRm" aria-label="사진 빼기">${ICON.x}</button></div>` : ''}
      <form class="composer" data-form="padSend">
        <button type="button" class="icon-btn" data-act="padImage" aria-label="사진 첨부">${ICON.image}</button>
        <input name="text" id="pad-input" placeholder="메모를 남겨보세요" autocomplete="off" />
        <button class="icon-btn send" type="submit" aria-label="보내기">${ICON.send}</button>
      </form>
    </div>`;
}
SCREENS.memo = () => `
  <section class="screen">
    ${topbar('메모', S.memoTab === 'share' ? '<button class="poke-btn" data-act="poke">콕 찌르기</button>' : '')}
    <div class="memo-tabs"><button data-act="memoTab" data-v="all" class="${S.memoTab === 'all' ? 'on' : ''}">메모 모아보기</button><button data-act="memoTab" data-v="share" class="${S.memoTab === 'share' ? 'on' : ''}">메모 나누기</button></div>
    ${S.memoTab === 'share' ? memoPadHTML() : memoAllHTML()}
  </section>`;
after.memo = () => {
  if (S.memoTab !== 'share') return;
  const c = $('#pad-scroll'); c.scrollTop = c.scrollHeight;
  let ch = false; db.notifs.forEach((n) => { if (n.to === ME && n.type === 'memo' && !n.read) { n.read = true; ch = true; } });
  if (ch) save();
  if (S.replyTo) $('#pad-input').focus();
  /* 메모를 누른 채 왼쪽으로 밀면 답장 */
  let sw = null;
  const reset = (row) => { row.style.transition = 'transform .2s'; row.style.transform = ''; row.classList.remove('arm'); setTimeout(() => { row.style.transition = ''; }, 220); };
  c.addEventListener('pointerdown', (e) => { const row = e.target.closest('.pad-row'); if (!row) return; sw = { row, x: e.clientX, y: e.clientY, dx: 0, active: false }; });
  c.addEventListener('pointermove', (e) => {
    if (!sw) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (!sw.active) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { sw = null; return; }
      if (dx < -10 && Math.abs(dx) > Math.abs(dy)) sw.active = true; else return;
    }
    sw.dx = Math.max(-90, Math.min(0, dx));
    sw.row.style.transform = `translateX(${sw.dx}px)`;
    sw.row.classList.toggle('arm', sw.dx < -55);
  });
  const end = () => {
    if (!sw) return; const { row, dx, active } = sw; sw = null;
    if (!active) return;
    reset(row); swallowClick = true; setTimeout(() => { swallowClick = false; }, 300);
    if (dx < -55) { if (navigator.vibrate) navigator.vibrate(12); S.replyTo = { kind: 'memo', id: row.dataset.id }; render(false, true); }
  };
  c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end); c.addEventListener('pointerleave', end);
};
let swallowClick = false;

/* 메모 크게 보기 (메모장 화면) */
SCREENS.memoView = () => {
  const m = db.memos.find((x) => x.id === S.memoId);
  if (!m) return `<section class="screen">${topbar('메모')}<div class="empty">메모가 없어요</div></section>`;
  const mine = m.owner === ME;
  return `<section class="screen">
    ${topbar(m.chat ? '나눈 메모' : fmtDate(m.date), mine ? '<button class="poke-btn" data-act="memoViewEdit">수정</button>' : '')}
    <div class="scroll pad memo-view">
      <div class="mv-meta">${esc(whoName(m.owner))} · ${fmtDate(ymd(new Date(m.createdAt)))} ${clockLabel(m.createdAt)}${!m.toPartner ? ' · 나만 보기' : ''}${m.editedAt ? ' · 수정됨' : ''}</div>
      ${quoteHTML(m.replyTo)}
      ${m.image ? `<img class="mv-img" src="${m.image}" alt="" />` : ''}
      ${m.text ? `<div class="mv-text ${mine ? 'me' : 'you'}">${esc(m.text)}</div>` : ''}
      ${mine ? '<button class="btn danger block" data-act="memoViewDelete" style="margin-top:30px">메모 삭제</button>' : ''}
    </div>
  </section>`;
};

/* 메모 크게 보기 (시트) */
function memoDetail(m) {
  const mine = m.owner === ME;
  openSheet(`<div class="sheet-head"><button class="icon-btn" data-act="close">${ICON.x}</button><h3>${m.chat ? '나눈 메모' : fmtDate(m.date) + ' 메모'}</h3>${mine ? '<button class="icon-btn" data-act="memoEditOpen">수정</button>' : '<span></span>'}</div>
    ${m.image ? `<img class="photo-view" src="${m.image}" alt="" style="aspect-ratio:auto;margin-bottom:12px" />` : ''}
    ${m.text ? `<div class="detail-memo">${esc(m.text)}</div>` : ''}
    <div class="kv"><b>누가</b><span>${esc(whoName(m.owner))}${!m.toPartner ? ' · 나만 보기' : ''}</span></div>
    <div class="kv"><b>언제</b><span>${fmtDate(ymd(new Date(m.createdAt)))} ${clockLabel(m.createdAt)}</span></div>
    ${mine ? '<button class="btn danger block" data-act="memoDelete" style="margin-top:10px">삭제</button>' : ''}`);
  actions.memoEditOpen = () => { closeSheet(); memoCompose({ memo: m }); };
  actions.memoDelete = () => confirmSheet('이 메모를 삭제할까요?', '', '삭제', () => { db.memos = db.memos.filter((x) => x.id !== m.id); save(); render(false, true); }, true);
}
/* 내 메모 꾹 → 수정 / 삭제 */
function memoMenu(m) {
  openSheet(`<div class="confirm-text">내 메모</div><div class="confirm-sub">${esc((m.text || '사진').slice(0, 40))}</div>
    <div class="actions"><button class="btn ghost" data-act="memoEditOpen">수정</button><button class="btn danger" data-act="memoDelete">삭제</button></div>`, { center: true });
  actions.memoEditOpen = () => { closeSheet(); memoCompose({ memo: m }); };
  actions.memoDelete = () => { closeSheet(); db.memos = db.memos.filter((x) => x.id !== m.id); save(); render(false, true); toast('삭제했어요'); };
}

/* ---------- 갤러리 (공유) ---------- */
SCREENS.gallery = () => {
  const all = db.gallery.slice().sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at);
  const list = all.filter((g) => S.galFilter === 'all' || (S.galFilter === 'me' ? g.owner === ME : g.owner === YOU));
  let lastM = '', html = '';
  list.forEach((g) => {
    const d = parse(g.date); const mk = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
    if (mk !== lastM) { html += `${lastM ? '</div>' : ''}<div class="g-head">${mk}</div><div class="g-grid">`; lastM = mk; }
    html += `<button class="g-item" data-act="openPhoto" data-id="${g.id}"><img src="${g.img}" alt="" loading="lazy" /><span class="g-who ${g.owner === ME ? 'me' : 'you'}">${esc(whoName(g.owner).slice(0, 1))}</span>${g.caption ? '<span class="g-cap"></span>' : ''}${g.onCal ? '<span class="g-oncal">달력</span>' : ''}</button>`;
  });
  if (lastM) html += '</div>';
  return `<section class="screen">
    ${topbar('갤러리', `<button class="icon-btn" data-act="addPhotos" aria-label="사진 올리기">${ICON.plus}</button>`)}
    <div class="g-filter">${[['all', '모두'], ['me', '내 사진'], ['you', esc(you().name)]].map(([k, l]) => `<button data-act="galFilter" data-v="${k}" class="${S.galFilter === k ? 'on' : ''}">${l}</button>`).join('')}<span class="g-count">${list.length}장</span></div>
    <div class="scroll">${html || `<div class="empty">아직 사진이 없어요<br/>＋를 눌러 사진을 올리거나, 휴대폰 갤러리에서 ‘공유 → nneow’로 보내보세요</div>`}<div style="height:24px"></div></div>
  </section>`;
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
        <li><button data-act="toggleAccess">상대방 접근 허용<span class="val">${me().allowAccess ? '허용함' : '허용 안 함'}</span><span class="switch ${me().allowAccess ? 'on' : ''}"></span></button></li>
        <li><button data-act="toPair">상대 휴대폰과 연결<span class="val">${cloudLabel()}</span>${ICON.right}</button></li>
        <li><button data-act="toSync">다른 캘린더와 동기화${ICON.right}</button></li>
        <li><button data-act="editNames">이름<span class="val">${esc(me().name)} · ${esc(you().name)}</span>${ICON.right}</button></li>
        <li><button data-act="askNotif">알림 허용<span class="val">${'Notification' in window ? ({ granted: '허용됨', denied: '차단됨', default: '꺼짐' }[Notification.permission]) : '지원 안 됨'}</span>${ICON.right}</button></li>
        <li><button data-act="refreshWx">날씨 새로고침<span class="val">${wx ? (wx.gps ? 'GPS 위치' : '서울 기준') : '-'}</span>${ICON.right}</button></li>
        ${CLOUD ? '' : `<li><button data-act="openPartnerTab">상대 화면 열기 (같은 기기 미리보기)${ICON.right}</button></li>`}
      </ul>
      <p class="note">접근을 허용하면 ${esc(you().name)}가 내 일정에 메모를 남기고, 내 캘린더에 스티커를 붙일 수 있어요.<br/>${esc(you().name)}는 지금 접근을 ${you().allowAccess ? '<b>허용했어요</b>' : '허용하지 않았어요'}.</p>
      ${CLOUD ? '' : '<ul class="menu"><li><button data-act="resetAll" style="color:var(--red)">모든 데이터 초기화</button></li></ul>'}
      <p class="note">nneow · 지금 <b>${esc(me().name)}</b>(으)로 사용 중이에요. ${CLOUD ? '상대 휴대폰과 실시간으로 공유되고 있어요.' : '아직 상대 휴대폰과 연결되지 않아 이 기기 안에만 저장돼요. ‘상대 휴대폰과 연결’에서 연결해 주세요.'}</p>
    </div>
  </section>`;

/* ---------- 상대 휴대폰과 연결 ---------- */
const C = () => window.nneowCloud;
function cloudLabel() {
  const c = C(); if (!c || !c.available) return '사용 불가';
  const st = c.status;
  if (CLOUD) {
    if (st === 'live') return c.members >= 2 ? '연결됨' : '상대 기다리는 중';
    return { connecting: '연결 중…', 'signed-out': '로그인 필요', error: '오류' }[st] || '연결 중…';
  }
  return st === 'signed-in' ? '로그인됨' : '연결 안 됨';
}
const UA = navigator.userAgent || '';
const IN_APP = /KAKAOTALK|Instagram|FBAN|FBAV|NAVER\(|NAVER|Line\/|DaumApps|everytimeApp|SamsungBrowser\/.*CrossApp/i.test(UA);
const IS_KAKAO = /KAKAOTALK/i.test(UA);
const IS_IOS = /iPhone|iPad|iPod/i.test(UA);
const IS_STANDALONE = window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
const NO_GOOGLE = IS_STANDALONE && IS_IOS && !(window.nneowCloud && window.nneowCloud.sameOriginAuth); // 아이폰 웹앱에서는 구글 로그인 창이 열리지 않음
function loginHelpHTML() {
  if (IN_APP) return `<div class="warn-box"><b>${IS_KAKAO ? '카카오톡' : '앱'} 안의 브라우저로 열려 있어요</b>
    <span>여기서는 구글 로그인이 막혀 있어요. 외부 브라우저(${IS_IOS ? 'Safari' : 'Chrome'})로 열거나, 아래 <b>이메일로 시작</b>을 써주세요.</span>
    <button class="btn block" data-act="openExternal">${IS_IOS ? 'Safari' : 'Chrome'}로 열기</button></div>`;
  if (IS_STANDALONE && IS_IOS) return `<div class="warn-box"><b>웹앱은 Safari와 따로 한 번 로그인해요</b>
    <span>① Safari에서 <b>이메일</b>로 가입했다면 → 아래에 같은 이메일·비밀번호를 넣으면 상대와 바로 이어져요.</span>
    <span>② Safari에서 <b>구글</b>로 가입했다면 → Safari의 nneow → 설정 → 상대 휴대폰과 연결에서 <b>비밀번호 만들기</b>를 한 번 하고, 여기서 구글 이메일 + 그 비밀번호로 로그인해요.</span>
    <span>③ 처음이라면 → 아래에서 이메일로 시작하고 초대 코드로 연결해요.</span></div>`;
  return '';
}
const emailFormHTML = () => `<div class="pair-box"><b>이메일로 시작</b><span>어디서나 되는 방법이에요. 처음이면 자동으로 가입돼요. (비밀번호 6자 이상)</span>
  <input id="l-email" type="email" autocomplete="email" placeholder="이메일" value="${esc(S.loginEmail || '')}" />
  <input id="l-pw" type="password" autocomplete="current-password" placeholder="비밀번호" />
  <button class="btn block" data-act="loginEmail">이메일로 시작</button></div>`;
SCREENS.pair = () => {
  const c = C();
  let body = '';
  if (!c || !c.available) {
    body = `<p class="note">서버 연결 기능을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.</p>`;
  } else if (CLOUD && c.status === 'signed-out') {
    body = `<div class="pair-hero">${ICON.lock}<b>로그인이 풀렸어요</b><span>연결했던 계정으로 다시 로그인해 주세요</span></div>
      ${loginHelpHTML()}
      <div class="pair-actions">${IN_APP || NO_GOOGLE ? '' : '<button class="btn block" data-act="loginGoogle">구글로 로그인</button>'}</div>
      ${emailFormHTML()}
      <div class="pair-actions"><button class="btn danger block" data-act="unpair">이 기기 연결 해제</button></div>`;
  } else if (CLOUD && c.members < 2 && CLOUD.role === 'a') {
    const code = c.code;
    body = code ? `<div class="pair-hero"><span>상대에게 이 초대 코드를 보내주세요</span>
      <div class="pair-code">${esc(code)}</div>
      <span>상대가 nneow에서 로그인하고 이 숫자를 입력하면 연결돼요</span>
      <span class="pair-wait">상대를 기다리는 중…</span></div>
      <div class="pair-actions"><button class="btn block" data-act="shareInvite">초대 코드 보내기</button>
      <div class="actions" style="margin:0"><button class="btn ghost" data-act="copyCode">코드 복사</button><button class="btn ghost" data-act="changeCode">코드 바꾸기</button></div>
      <button class="btn danger block" data-act="unpair">초대 취소</button></div>`
    : `<div class="pair-hero"><b>초대 코드를 정해주세요</b><span>상대가 입력할 숫자예요 (4~8자리)</span></div>
      <div class="pair-box"><input id="p-mycode" inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="예: 1004" class="code-input" />
      <button class="btn block" data-act="setCode">이 코드로 정하기</button><button class="btn ghost block" data-act="randomCode">아무 숫자로 만들기</button></div>
      <div class="pair-actions"><button class="btn danger block" data-act="unpair">초대 취소</button></div>`;
  } else if (CLOUD) {
    body = `<div class="pair-hero ok"><div class="pair-duo"><span class="kk-av">${esc(me().name.slice(0, 1))}</span><span class="pair-link"></span><span class="kk-av you">${esc(you().name.slice(0, 1))}</span></div>
      <b>${esc(me().name)} · ${esc(you().name)}</b><span>${c.status === 'live' ? '실시간으로 함께 쓰는 중' : c.status === 'error' ? '동기화 오류: ' + esc(c.error) : '연결 중…'}</span></div>
      ${c.user && c.user.email && !c.hasPassword ? `<div class="pair-box"><b>웹앱(홈 화면 앱)에서도 쓰려면</b><span>아이폰 웹앱에서는 구글 로그인 창이 열리지 않아요. 여기서 비밀번호를 만들어 두면, 웹앱에서 <b>${esc(c.user.email)}</b> + 비밀번호로 로그인해 바로 이어져요.</span>
        <input id="pw-new" type="password" autocomplete="new-password" placeholder="비밀번호 (6자 이상)" /><button class="btn block" data-act="addPassword">비밀번호 만들기</button></div>` : ''}
      <ul class="menu"><li><button data-act="editNames">이름 바꾸기${ICON.right}</button></li></ul>
      <div class="pair-actions"><button class="btn danger block" data-act="unpair">이 기기 연결 해제</button></div>
      <p class="note">연결을 해제해도 서버의 데이터는 지워지지 않아요. 같은 계정으로 다시 로그인하면 그대로 이어져요.</p>`;
  } else if (c.status === 'signed-in') {
    body = `<div class="pair-who">${esc(c.email || '로그인됨')}로 로그인했어요</div>
      <div class="field" style="padding:16px 20px 0"><label>내 이름</label><input id="p-name" maxlength="12" value="${esc(me().name === '나' || me().name === '상대' ? '' : me().name)}" placeholder="상대에게 보일 이름" /></div>
      <div class="pair-box"><b>처음 시작하는 사람</b><span>우리 둘만 아는 숫자로 초대 코드를 정해요 (4~8자리). 비워두면 자동으로 만들어요.</span>
        <input id="p-mycode" inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="예: 1004" class="code-input" value="${esc(S.myCode || '')}" />
        <button class="btn block" data-act="createPair">초대 코드 만들기</button></div>
      <div class="pair-box"><b>초대 코드를 받은 사람</b><span>상대가 보낸 숫자를 입력해요</span>
        <input id="p-code" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" placeholder="초대 코드" class="code-input" value="${esc(S.pairCode || '')}" />
        <button class="btn block" data-act="joinPair">연결하기</button></div>
      <div class="pair-actions"><button class="btn ghost block" data-act="logout">다른 계정으로 로그인</button></div>`;
  } else {
    body = `<div class="pair-hero"><img src="assets/icons/logo.png" alt="" class="pair-logo" /><b>상대 휴대폰과 연결하기</b>
      <span>로그인하고 초대 코드로 연결하면<br/>두 사람의 휴대폰이 실시간으로 공유돼요</span></div>
      ${loginHelpHTML()}
      ${IN_APP || NO_GOOGLE ? '' : '<div class="pair-actions"><button class="btn block" data-act="loginGoogle">구글로 로그인</button></div>'}
      ${emailFormHTML()}
      <p class="note">휴대폰을 바꿔도 같은 구글 계정 / 이메일로 로그인하면 그대로 이어져요.</p>`;
  }
  const err = S.cloudErr ? `<div class="warn-box err"><b>연결 오류</b><span>${esc(S.cloudErr)}</span></div>` : '';
  return `<section class="screen">${topbar('상대 휴대폰과 연결')}<div class="scroll">${err}${body}
<div style="height:30px"></div></div></section>`;
};
async function cloudTry(fn, okMsg) {
  S.cloudErr = '';
  try { await fn(); if (okMsg) toast(okMsg); }
  catch (e) {
    const code = e && e.code;
    const msg = {
      'auth/popup-closed-by-user': '로그인을 취소했어요',
      'auth/unauthorized-domain': '이 주소가 Firebase에 등록되지 않았어요 (Authentication → 설정 → 승인된 도메인)',
      'auth/operation-not-allowed': 'Firebase에서 이 로그인 방식을 켜주세요 (Authentication → 로그인 방법)',
      'auth/admin-restricted-operation': 'Firebase에서 익명 로그인을 켜주세요 (Authentication → 로그인 방법)',
      'auth/operation-not-supported-in-this-environment': '이 브라우저에서는 구글 로그인이 안 돼요. 이메일로 시작을 써주세요',
      'auth/web-storage-unsupported': '이 브라우저에서는 로그인이 안 돼요. Chrome이나 Safari로 열어주세요',
      'auth/network-request-failed': '인터넷 연결을 확인해 주세요',
      'auth/invalid-email': '이메일 주소를 확인해 주세요',
      'auth/weak-password': '비밀번호는 6자 이상이어야 해요',
      'auth/wrong-password': '비밀번호가 맞지 않아요. 구글로 가입한 이메일이라면 Safari의 nneow에서 먼저 ‘비밀번호 만들기’를 해주세요',
      'auth/too-many-requests': '시도가 너무 많아요. 잠시 후 다시 해주세요',
      'auth/internal-error': '로그인 창을 열지 못했어요. 이메일로 시작을 써주세요',
      'auth/requires-recent-login': '보안을 위해 한 번 로그아웃 후 다시 로그인하고 시도해 주세요',
      'auth/provider-already-linked': '이미 비밀번호가 있어요',
      'auth/credential-already-in-use': '이 이메일은 이미 다른 계정에서 쓰고 있어요',
      'permission-denied': 'Firestore 보안 규칙이 게시되지 않았어요 (Firestore Database → 규칙 → 게시)',
      'unavailable': '서버에 닿지 않아요. 인터넷 연결을 확인해 주세요',
    }[code] || (e && e.message) || '연결에 실패했어요';
    const opNotAllowed = code === 'auth/operation-not-allowed';
    S.cloudErr = (opNotAllowed && S.lastLogin === 'email') ? 'Firebase에서 이메일/비밀번호 로그인을 켜주세요 (Authentication → 로그인 방법 → 이메일/비밀번호)' : `${msg}${code ? ` [${code}]` : ''}`;
    toast(msg);
  }
  render(false, true);
}

/* ---------- 다른 캘린더와 동기화 ---------- */
SCREENS.sync = () => {
  const n = visibleEvents(ME).length; const imported = db.events.filter((e) => e.owner === ME && e.importUid).length;
  return `
  <section class="screen">
    ${topbar('다른 캘린더와 동기화')}
    <div class="scroll">
      <div class="menu-title">nneow → 휴대폰 캘린더</div>
      <ul class="menu">
        <li><button data-act="exportICS">내 일정 내보내기 (.ics)<span class="val">${n}개</span>${ICON.download}</button></li>
      </ul>
      <p class="note">아이폰: 파일을 열면 ‘캘린더에 추가’가 나와요.<br/>안드로이드 · 구글: calendar.google.com → 설정 → 가져오기에 파일을 올려주세요.<br/>일정 하나만 보낼 때는 일정을 눌러 ‘휴대폰 캘린더에 추가’ / ‘구글 캘린더에 추가’를 쓰면 돼요.</p>
      <div class="menu-title">휴대폰 캘린더 → nneow</div>
      <ul class="menu">
        <li><button data-act="importICS">캘린더 파일 가져오기 (.ics)<span class="val">${imported ? `가져온 일정 ${imported}개` : ''}</span>${ICON.upload}</button></li>
        ${imported ? `<li><button data-act="removeImported" style="color:var(--red)">가져온 일정 모두 지우기</button></li>` : ''}
      </ul>
      <p class="note">구글 캘린더: 설정 → 가져오기/내보내기 → 내보내기로 받은 .ics 파일<br/>아이폰: iCloud.com 캘린더 공유 또는 내보낸 .ics 파일<br/>같은 일정은 두 번 들어오지 않아요. 반복 일정은 첫 번째 일정만 들어와요.</p>
    </div>
  </section>`;
};

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
      <input name="q" id="q" placeholder="일정, 메모, 사진 검색" value="${esc(S.query)}" autocomplete="off" />
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
  const pics = db.gallery.filter((g) => has(g.caption));
  const dls = visibleDeadlines(ME).filter((d) => has(d.title));
  const row = (c, t, s, date) => `<button class="result" data-act="gotoDay" data-date="${date}"><span class="dotc" style="--c:${c}"></span><div><div class="t">${t}</div><div class="s">${s}</div></div></button>`;
  const out = [
    ...evs.map((e) => row(colorOf(e), hl(e.title, q), `${fmtDate(e.start)}${e.end !== e.start ? ' – ' + fmtDate(e.end) : ''} · ${e.owner === ME ? '내 일정' : esc(you().name) + ' 일정'}`, e.start)),
    ...dls.map((d) => row('var(--red)', hl(d.title, q), `레드라인 · ${fmtDate(d.to)}까지`, d.to)),
    ...memos.map((m) => row(db.users[m.owner].colors.memo, hl(m.text, q), `메모 · ${fmtDate(m.date)}`, m.date)),
    ...pics.map((g) => row('var(--muted)', hl(g.caption, q), `사진 · ${fmtDate(g.date)}`, g.date)),
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
  if (renderQuiet) { renderQuiet = false; render(false, true); }
  setTimeout(showPokes, 0);
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
    <div class="date-row"><span>시작일</span><input type="date" id="e-start" class="date-pill" value="${e.start}" /></div><div class="date-row"><span>종료일</span><input type="date" id="e-end" class="date-pill" value="${e.end}" /></div>
    <div id="e-times" style="${e.allDay ? 'display:none' : ''}"><div class="date-row"><span>시작 시간</span><input type="time" id="e-st" class="date-pill" value="${e.startTime || '09:00'}" /></div><div class="date-row"><span>종료 시간</span><input type="time" id="e-et" class="date-pill" value="${e.endTime || '10:00'}" /></div></div>
    <div class="switch-row">${esc(you().name)}와 공유<button class="switch ${e.shared ? 'on' : ''}" id="e-shared"></button></div>
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
      db.events.push({ id: uid(), owner: ME, createdAt: Date.now(), sharedAt: data.shared ? Date.now() : null, ...data });
      if (data.shared) notify('event', `${me().name}님이 공유 일정을 추가했어요: ${title} (${fmtDate(start)})`);
    } else {
      const t = db.events.find((x) => x.id === ev.id);
      if (data.shared && !t.shared) t.sharedAt = Date.now();
      Object.assign(t, data);
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
    ${(e.notes || []).map((n) => `<div class="detail-memo note"><span class="note-mark ${n.by === e.owner ? 'sq' : ''}"></span>${esc(n.text)}<div class="s" style="font-size:.75em;color:var(--muted);margin-top:4px">${esc(whoName(n.by))} · ${ago(n.at)}</div></div>`).join('')}
    ${!e.memo && !dayMemos.length && !(e.notes || []).length ? '<div class="empty" style="padding:14px 0">이 날의 메모가 없어요</div>' : ''}
    ${!mine && db.users[e.owner].allowAccess ? '<button class="btn block" data-act="noteOpen" style="margin-top:8px">이 일정에 메모 남기기</button>' : ''}
    <button class="btn ghost block" data-act="memoForDay" data-date="${e.start}" style="margin-top:8px">이 날짜에 메모 쓰기</button>
    <div class="actions" style="margin-top:8px"><button class="btn ghost" data-act="evToPhone">휴대폰 캘린더에 추가</button><a class="btn ghost" style="display:grid;place-items:center;text-decoration:none" href="${googleURL(e)}" target="_blank" rel="noopener">구글 캘린더에 추가</a></div>
  `);
  actions.editEvent = () => { closeSheet(); eventSheet(e); };
  actions.noteOpen = () => { closeSheet(); noteSheet(e); };
  actions.evToPhone = () => shareOrDownload(buildICS([e]), `${e.title.replace(/[\\/:*?"<>|]/g, '') || 'event'}.ics`);
}

/* 메모 작성 / 수정: 날짜 → 큰 글 칸 → 상대에게 보내기 → 사진 추가 */
function memoCompose(opts = {}) {
  const m = opts.memo || null;
  let image = m ? m.image : '';
  const date = m ? m.date : (opts.date || todayStr());
  const draw = (sh) => {
    $('#m-photo', sh).innerHTML = image
      ? `<img src="${image}" alt="" /><button class="rm" type="button" id="m-rm">${ICON.x}</button>`
      : `<span class="mp-add">${ICON.image}<span>사진 추가</span></span>`;
    $('#m-photo', sh).classList.toggle('has', !!image);
    const rm = $('#m-rm', sh); if (rm) rm.onclick = (ev) => { ev.stopPropagation(); image = ''; draw(sh); };
  };
  openSheet(`
    <div class="sheet-head"><button class="icon-btn" data-act="close">${ICON.x}</button><h3>${m ? '메모 수정' : '메모'}</h3><button class="icon-btn" data-act="saveMemo">${ICON.check}</button></div>
    ${m && m.chat ? '' : `<div class="date-row"><span>날짜</span><input type="date" id="m-date" class="date-pill" value="${date}" /></div>`}
    <div class="field"><textarea id="m-text" class="memo-big-input" placeholder="메모를 남겨보세요">${esc(m ? m.text : (opts.text || ''))}</textarea></div>
    <div class="switch-row">상대방에게 보내기<button class="switch ${(m ? m.toPartner : S.memoSend) ? 'on' : ''}" id="m-send"></button></div>
    <button type="button" class="memo-photo" id="m-photo"></button>
    <input type="file" accept="image/*" id="m-file" hidden />
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
    const d = ($('#m-date', root) || {}).value || date;
    if (m) {
      const was = m.toPartner;
      Object.assign(m, { text: t, image, date: d, toPartner: send, editedAt: Date.now() });
      if (send && !was) notify('memo', `${me().name}님이 메모를 보냈어요: ${t || '사진'}`);
      save(); closeSheet(); render(false, true); toast('메모를 고쳤어요');
    } else { closeSheet(); addMemo(t, image, d, send); }
  };
}
function addMemo(text, image, date, send, replyTo = null, chat = false) {
  db.memos.push({ id: uid(), owner: ME, date, text, image, toPartner: send, createdAt: Date.now(), replyTo, chat });
  if (send) notify('memo', chat ? `${me().name}: ${text || '사진'}` : `${me().name}님이 메모를 보냈어요: ${text || '사진'}`);
  save();
  render();
  if (!chat) toast(send ? `${you().name}에게 메모를 보냈어요` : '메모를 저장했어요');
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

/* ================= 갤러리 사진 (정사각형 + 확대/위치 조정) ================= */
function pickFile(cb) {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
  i.onchange = () => i.files[0] && cb(i.files[0]); i.click();
}
function pickFiles(cb) {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = true;
  i.onchange = () => i.files.length && cb([...i.files]); i.click();
}
/* 정사각형 가운데 자르기 (여러 장 올릴 때) */
function autoSquare(src, out = 640) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => { const s0 = Math.min(img.width, img.height); const c = document.createElement('canvas'); c.width = out; c.height = out;
      c.getContext('2d').drawImage(img, (img.width - s0) / 2, (img.height - s0) / 2, s0, s0, 0, 0, out, out); res(c.toDataURL('image/jpeg', 0.82)); };
    img.onerror = () => res(''); img.src = src;
  });
}
/* 사진 올리기: 한 장이면 확대·위치 조정, 여러 장이면 가운데를 정사각형으로 */
async function addPhotos(files, date, onCal = false) {
  files = files.filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|gif|webp|heic)$/i.test(f.name || ''));
  if (!files.length) return;
  if (files.length === 1) {
    const src = await shrinkImage(files[0], 1080);
    if (!src) { toast('사진을 열 수 없어요'); return; }
    cropSheet(src, (img) => photoInfoSheet([{ img, src }], date, onCal));
    return;
  }
  toast(`${files.length}장을 준비하는 중…`);
  const items = [];
  for (const f of files.slice(0, 30)) { const src = await shrinkImage(f, 1080); if (src) items.push({ img: await autoSquare(src), src }); }
  photoInfoSheet(items, date, onCal);
}
function photoInfoSheet(items, date = todayStr(), onCal = false) {
  openSheet(`<div class="sheet-head"><button class="icon-btn" data-act="close">${ICON.x}</button><h3>${items.length > 1 ? `사진 ${items.length}장` : '사진'} 올리기</h3><button class="icon-btn" data-act="phSave">${ICON.check}</button></div>
    <div class="ph-preview">${items.map((x) => `<img src="${x.img}" alt="" />`).join('')}</div>
    <div class="date-row"><span>날짜</span><input type="date" id="ph-date" class="date-pill" value="${date}" /></div>
    <div class="field"><label>메모</label><textarea id="ph-cap" rows="2" placeholder="사진에 남길 메모 (선택)"></textarea></div>
    <div class="switch-row">달력에도 붙이기<button class="switch ${onCal ? 'on' : ''}" id="ph-cal"></button></div>
    <p class="note" style="padding:0">사진은 공유 갤러리에 올라가요. ‘달력에도 붙이기’를 켜면 그 날짜 달력(사진 보기)에도 보여요.</p>`, { bind: (sh) => { $('#ph-cal', sh).onclick = (e) => e.currentTarget.classList.toggle('on'); } });
  actions.phSave = () => {
    const d = $('#ph-date', root).value || date; const cap = $('#ph-cap', root).value.trim();
    const cal = $('#ph-cal', root).classList.contains('on');
    items.forEach((x, i) => db.gallery.push({ id: uid(), owner: ME, date: d, img: x.img, src: x.src || '', caption: cap, at: Date.now() + i, onCal: cal }));
    notify('photo', `${me().name}님이 사진 ${items.length > 1 ? items.length + '장을' : '을'} 올렸어요 (${fmtDate(d)})`);
    save(); closeSheet(); render(); toast(`사진을 올렸어요 · ${you().name}에게도 보여요`);
  };
}
/* 사진 크게 보기: 정보 + 메모 */
function photoViewer(g) {
  const mine = g.owner === ME;
  const dayMemos = memosOn(g.date);
  openSheet(`<div class="sheet-head"><button class="icon-btn" data-act="close">${ICON.x}</button><h3>${fmtDate(g.date)}</h3><button class="icon-btn" data-act="phShare" aria-label="공유">${ICON.share}</button></div>
    <img class="photo-view" src="${g.img}" alt="" />
    <div class="ph-info">
      <div class="kv"><b>올린 사람</b><span>${esc(whoName(g.owner))}</span></div>
      <div class="kv"><b>올린 시간</b><span>${fmtDate(ymd(new Date(g.at)))} ${clockLabel(g.at)}</span></div>
    </div>
    <div class="lbl-sm">메모</div>
    ${mine ? `<div class="field"><textarea id="g-cap" rows="2" placeholder="이 사진에 메모 남기기">${esc(g.caption || '')}</textarea></div>
      <div class="date-row"><span>날짜</span><input type="date" id="g-date" class="date-pill" value="${g.date}" /></div>`
      : (g.caption ? `<div class="detail-memo">${esc(g.caption)}</div>` : '<div class="empty" style="padding:8px 0">사진 메모가 없어요</div>')}
    ${dayMemos.length ? `<div class="lbl-sm">이 날의 메모</div>${dayMemos.map((m) => `<div class="detail-memo">${esc(m.text) || '사진'}<div class="s" style="font-size:.75em;color:var(--muted);margin-top:4px">${esc(whoName(m.owner))}</div></div>`).join('')}` : ''}
    ${mine ? `<div class="switch-row">달력에도 붙이기<button class="switch ${g.onCal ? 'on' : ''}" id="g-cal"></button></div>
      <div class="actions"><button class="btn" data-act="gSave">저장</button><button class="btn ghost" data-act="gAdjust">확대 · 위치 조정</button></div>` : ''}
    <div class="actions" style="margin-top:8px"><button class="btn ghost" data-act="gDay">이 날 일정 보기</button>${mine ? '<button class="btn danger" data-act="gDelete">삭제</button>' : ''}</div>`);
  const gc = $('#g-cal', root); if (gc) gc.onclick = (e) => e.currentTarget.classList.toggle('on');
  actions.gSave = () => { g.caption = $('#g-cap', root).value.trim(); g.date = $('#g-date', root).value || g.date; g.onCal = $('#g-cal', root).classList.contains('on'); save(); closeSheet(); render(); toast('저장했어요'); };
  actions.gAdjust = () => { closeSheet(); cropSheet(g.src || g.img, (img) => { g.img = img; save(); render(); toast('조정했어요'); photoViewer(g); }); };
  actions.gDelete = () => confirmSheet('이 사진을 삭제할까요?', `${esc(you().name)}의 갤러리에서도 사라져요`, '삭제', () => { db.gallery = db.gallery.filter((x) => x.id !== g.id); save(); render(); }, true);
  actions.gDay = () => { closeSheet(); const d = parse(g.date); S.month = { y: d.getFullYear(), m: d.getMonth() }; go('day', { sel: g.date, viewPartner: false }); };
  actions.phShare = async () => {
    try {
      const blob = await (await fetch(g.img)).blob(); const file = new File([blob], `nneow-${g.date}.jpg`, { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; }
      const a = document.createElement('a'); a.href = g.img; a.download = file.name; a.click();
    } catch { /* 취소 */ }
  };
}
/* 달력 사진 모드에서 날짜 누르기 */
function photoDay(s) {
  const list = photosOn(s);
  const upload = () => pickFiles((files) => addPhotos(files, s, true)); // 달력에서 올리면 달력에 붙음
  if (!list.length) { upload(); return; }
  openSheet(`<div class="sheet-head"><span></span><h3>${fmtDate(s)}</h3><button class="icon-btn" data-act="close">${ICON.x}</button></div>
    <div class="g-grid sheet-grid">${list.map((g) => `<button class="g-item" data-act="openPhoto" data-id="${g.id}"><img src="${g.img}" alt="" /><span class="g-who ${g.owner === ME ? 'me' : 'you'}">${esc(whoName(g.owner).slice(0, 1))}</span></button>`).join('')}</div>
    <div class="actions"><button class="btn" data-act="phUpload">사진 올리기</button><button class="btn ghost" data-act="phDay">이 날 일정 보기</button></div>`);
  actions.phUpload = () => { closeSheet(); upload(); };
  actions.phDay = () => { closeSheet(); go('day', { sel: s }); };
}
/* 휴대폰 갤러리 '공유 → nneow' 로 받은 사진 */
async function receiveShared() {
  if (!new URLSearchParams(location.search).has('share') || !('caches' in window)) return;
  history.replaceState(history.state, '', location.pathname);
  try {
    const cache = await caches.open('nneow-share');
    const meta = await cache.match('shared/meta'); if (!meta) return;
    const { count } = await meta.json(); const files = [];
    for (let i = 0; i < count; i++) { const r = await cache.match('shared/' + i); if (r) { const b = await r.blob(); files.push(new File([b], `shared-${i}.jpg`, { type: b.type || 'image/jpeg' })); } }
    await caches.delete('nneow-share');
    const run = () => { S.screen = 'gallery'; history.pushState({ screen: 'gallery' }, ''); render(true); addPhotos(files, todayStr()); };
    // 서버 데이터를 받은 뒤에 올려야 덮어쓰이지 않음
    if (CLOUD && C() && C().status !== 'live') { let n = 0; const t = setInterval(() => { if (C().status === 'live' || ++n > 30) { clearInterval(t); run(); } }, 500); } else run();
  } catch { /* 무시 */ }
}

/* ================= 스티커 · 콕 찌르기 · 상대 일정 메모 ================= */
function placeSticker(s, pos = {}) {
  if (hasEventOn(YOU, s)) { toast('일정이 있는 날에는 붙일 수 없어요'); return; }
  const kind = S.placing;
  db.stickers = db.stickers.filter((x) => !(x.from === ME && x.to === YOU && x.date === s));
  db.stickers.push({ id: uid(), from: ME, to: YOU, date: s, kind, at: Date.now(), x: pos.x ?? 0.5, y: pos.y ?? 0.78 });
  notify('sticker', `${me().name}님이 ${fmtDate(s)}에 ${STICKERS[kind].label} 스티커를 붙였어요`);
  S.placing = null; save(); render(); toastHTML(`${STICKERS[kind].svg} ${esc(you().name)}의 캘린더에 붙였어요`);
}
function stickerSheet(x) {
  const canRemove = x.from === ME || x.to === ME;
  openSheet(`<div class="stk-big">${STICKERS[x.kind] ? STICKERS[x.kind].svg : ''}</div>
    <div class="confirm-text">${esc(db.users[x.from].name)}의 ${STICKERS[x.kind] ? STICKERS[x.kind].label : ''} 스티커</div><div class="confirm-sub">${fmtDate(x.date)} · ${ago(x.at)}</div>
    <div class="actions"><button class="btn ghost" data-act="close">닫기</button>${canRemove ? '<button class="btn danger" data-act="stkRemove">떼기</button>' : ''}</div>`, { center: true });
  actions.stkRemove = () => { db.stickers = db.stickers.filter((y) => y.id !== x.id); save(); closeSheet(); render(); };
}
function pokeSheet() {
  openSheet(`<div class="poke-hand">👉</div><div class="confirm-text">${esc(you().name)}를 콕 찌를까요?</div>
    <div class="confirm-sub">${esc(you().name)}가 앱을 열자마자 이 메시지가 떠요</div>
    <div class="field"><input id="poke-text" maxlength="60" placeholder="보고 싶어!" /></div>
    <div class="actions"><button class="btn ghost" data-act="close">취소</button><button class="btn" data-act="pokeSend">콕 찌르기</button></div>`, { center: true });
  actions.pokeSend = () => {
    const text = $('#poke-text', root).value.trim() || '콕!';
    db.pokes.push({ id: uid(), from: ME, to: YOU, text, at: Date.now(), seenAt: null });
    if (db.pokes.length > 100) db.pokes = db.pokes.slice(-100);
    notify('poke', `${me().name}님이 콕 찔렀어요: ${text}`);
    save(); closeSheet(); toast(`${you().name}를 콕 찔렀어요`);
  };
}
/* 받은 '콕'은 앱에 들어오자마자 띄움 */
function showPokes() {
  if ($('.overlay')) return;
  const p = db.pokes.filter((x) => x.to === ME && !x.seenAt).sort((a, b) => a.at - b.at)[0];
  if (!p) return;
  openSheet(`<div class="poke-hand shake">👉</div><div class="confirm-text">${esc(db.users[p.from].name)}님이 콕 찔렀어요!</div>
    <div class="poke-msg">${esc(p.text)}</div><div class="confirm-sub">${ago(p.at)}</div>
    <div class="actions"><button class="btn block" data-act="pokeOk">확인</button></div>`, { center: true });
  actions.pokeOk = () => { p.seenAt = Date.now(); save(); closeSheet(); };
}
function noteSheet(e) {
  openSheet(`<div class="sheet-head"><button class="icon-btn" data-act="close">${ICON.x}</button><h3>${esc(e.title)}에 메모</h3><button class="icon-btn" data-act="noteSave">${ICON.check}</button></div>
    <div class="confirm-sub" style="text-align:left">${esc(db.users[e.owner].name)}의 일정에 남기는 메모예요. 일정에 ● 표시로 보여요.</div>
    <div class="field"><textarea id="note-text" rows="3" placeholder="메모를 남겨보세요"></textarea></div>`, { bind: (sh) => setTimeout(() => $('#note-text', sh).focus(), 250) });
  actions.noteSave = () => {
    const t = $('#note-text', root).value.trim(); if (!t) { toast('메모를 입력해 주세요'); return; }
    e.notes = [...(e.notes || []), { id: uid(), by: ME, text: t, at: Date.now() }];
    notify('note', `${me().name}님이 ‘${e.title}’ 일정에 메모를 남겼어요`);
    save(); closeSheet(); render(); toast('메모를 남겼어요');
  };
}
function cropSheet(src, onDone) {
  let st = null;
  openSheet(`<div class="sheet-head"><button class="icon-btn" data-act="close">${ICON.x}</button><h3>사진 조정</h3><button class="icon-btn" data-act="cropOk">${ICON.check}</button></div>
    <div class="crop" id="crop"><img id="crop-img" src="${src}" alt="" draggable="false" /><div class="crop-grid"></div></div>
    <input type="range" id="crop-zoom" min="1" max="4" step="0.01" value="1" class="crop-zoom" aria-label="확대" />
    <p class="note" style="padding:6px 0 0;text-align:center">두 손가락으로 확대하고, 끌어서 위치를 맞춰주세요</p>`, {
    bind: (sh) => {
      const box = $('#crop', sh), img = $('#crop-img', sh), zoom = $('#crop-zoom', sh);
      const init = () => {
        const V = box.clientWidth, w = img.naturalWidth, h = img.naturalHeight;
        const base = V / Math.min(w, h);
        st = { V, w, h, base, z: 1, x: (V - w * base) / 2, y: (V - h * base) / 2 };
        img.style.width = w + 'px'; img.style.height = h + 'px';
        apply();
      };
      const apply = () => {
        const sc = st.base * st.z;
        st.x = Math.min(0, Math.max(st.V - st.w * sc, st.x));
        st.y = Math.min(0, Math.max(st.V - st.h * sc, st.y));
        img.style.transform = `translate(${st.x}px, ${st.y}px) scale(${sc})`;
        zoom.value = st.z;
      };
      const zoomTo = (nz, cx = st.V / 2, cy = st.V / 2) => {
        nz = Math.min(4, Math.max(1, nz)); const k = nz / st.z;
        st.x = cx - (cx - st.x) * k; st.y = cy - (cy - st.y) * k; st.z = nz; apply();
      };
      if (img.complete && img.naturalWidth) requestAnimationFrame(init); else img.onload = init;
      const pts = new Map(); let pinch = null;
      box.addEventListener('pointerdown', (e) => { box.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: st.z }; } });
      box.addEventListener('pointermove', (e) => {
        if (!st || !pts.has(e.pointerId)) return;
        const prev = pts.get(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 1) { st.x += e.clientX - prev.x; st.y += e.clientY - prev.y; apply(); }
        else if (pinch) { const [a, b] = [...pts.values()]; const r = box.getBoundingClientRect(); zoomTo(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); }
      });
      const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
      box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
      box.addEventListener('wheel', (e) => { e.preventDefault(); const r = box.getBoundingClientRect(); zoomTo(st.z * (1 - e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
      zoom.addEventListener('input', () => zoomTo(+zoom.value));
    },
  });
  actions.cropOk = () => {
    if (!st) return;
    const sc = st.base * st.z, out = 640;
    const c = document.createElement('canvas'); c.width = out; c.height = out;
    c.getContext('2d').drawImage($('#crop-img'), -st.x / sc, -st.y / sc, st.V / sc, st.V / sc, 0, 0, out, out);
    closeSheet(); onDone(c.toDataURL('image/jpeg', 0.82));
  };
}

/* ================= 다른 캘린더와 동기화 (.ics) ================= */
const icsEsc = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
const icsUnesc = (t) => String(t || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
const ymdC = (s) => s.replace(/-/g, '');
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
function evToVevent(e) {
  const L = ['BEGIN:VEVENT', `UID:${e.importUid || e.id + '@nneow'}`, `DTSTAMP:${stamp()}`];
  if (e.allDay || !e.startTime) { L.push(`DTSTART;VALUE=DATE:${ymdC(e.start)}`, `DTEND;VALUE=DATE:${ymdC(addDays(e.end, 1))}`); }
  else { L.push(`DTSTART:${ymdC(e.start)}T${e.startTime.replace(':', '')}00`, `DTEND:${ymdC(e.end)}T${(e.endTime || e.startTime).replace(':', '')}00`); }
  L.push(`SUMMARY:${icsEsc(e.title)}`);
  if (e.memo) L.push(`DESCRIPTION:${icsEsc(e.memo)}`);
  L.push('END:VEVENT');
  return L.join('\r\n');
}
function buildICS(list) {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//nneow//KO', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:nneow', ...list.map(evToVevent), 'END:VCALENDAR'].join('\r\n');
}
async function shareOrDownload(text, name) {
  const file = new File([text], name, { type: 'text/calendar' });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: name }); return; } catch { /* 취소 시 다운로드로 */ }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function parseICSDate(v) {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/); if (!m) return null;
  if (!m[4]) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: '' };
  let d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  if (m[7]) d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
  return { date: ymd(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
function importICS(text) {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  let cur = null, added = 0, skipped = 0;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') {
      if (cur && cur.DTSTART) {
        const uidv = cur.UID || uid();
        if (db.events.some((e) => e.importUid === uidv || e.id + '@nneow' === uidv)) { skipped++; }
        else {
          const s0 = parseICSDate(cur.DTSTART); let e0 = cur.DTEND ? parseICSDate(cur.DTEND) : null;
          if (s0) {
            const allDay = !s0.time; let end = e0 ? e0.date : s0.date;
            if (allDay && e0 && end > s0.date) end = addDays(end, -1);
            db.events.push({ id: uid(), owner: ME, title: icsUnesc(cur.SUMMARY) || '(제목 없음)', type: 'schedule', allDay, start: s0.date, end: end < s0.date ? s0.date : end,
              startTime: s0.time, endTime: allDay ? '' : (e0 ? e0.time : s0.time), shared: false, deadline: false, memo: icsUnesc(cur.DESCRIPTION || ''), createdAt: Date.now(), importUid: uidv });
            added++;
          }
        }
      }
      cur = null; continue;
    }
    if (!cur) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    const key = line.slice(0, i).split(';')[0].toUpperCase();
    if (!(key in cur)) cur[key] = line.slice(i + 1);
  }
  return { added, skipped };
}
function googleURL(e) {
  const dates = e.allDay || !e.startTime
    ? `${ymdC(e.start)}/${ymdC(addDays(e.end, 1))}`
    : `${ymdC(e.start)}T${e.startTime.replace(':', '')}00/${ymdC(e.end)}T${(e.endTime || e.startTime).replace(':', '')}00`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.title)}&dates=${dates}&details=${encodeURIComponent(e.memo || '')}`;
}

/* ================= 액션 ================= */
const actions = {
  back,
  close: closeSheet,
  overlay: (el, e) => { if (e.target === el) closeSheet(); },
  toMonth: () => go('month'),
  toSearch: () => go('search'),
  toMemo: () => { closeSheet(); go('memo'); },
  toGallery: () => go('gallery'),
  toSettings: () => go('settings'),
  toColors: () => go('colors'),
  toSync: () => go('sync'),
  toPair: () => go('pair'),
  loginGoogle: () => { S.lastLogin = 'google'; cloudTry(() => C().signInGoogle()); },
  loginEmail: () => {
    const em = ($('#l-email') || {}).value || ''; const pw = ($('#l-pw') || {}).value || '';
    if (!em.includes('@')) { toast('이메일을 입력해 주세요'); return; }
    if (pw.length < 6) { toast('비밀번호는 6자 이상이어야 해요'); return; }
    S.lastLogin = 'email'; S.loginEmail = em.trim(); cloudTry(() => C().signInEmail(em.trim(), pw));
  },
  openExternal: () => {
    const url = location.href;
    if (IS_KAKAO) location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url);
    else if (!IS_IOS) location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
    else toast('오른쪽 아래 … 메뉴에서 ‘Safari로 열기’를 눌러주세요');
  },

  loginAnon: () => cloudTry(() => C().signInAnon()),
  logout: () => cloudTry(() => C().disconnect()),
  addPassword: () => {
    const pw = ($('#pw-new') || {}).value || '';
    if (pw.length < 6) { toast('비밀번호는 6자 이상이어야 해요'); return; }
    cloudTry(() => C().addPassword(pw), '비밀번호를 만들었어요. 홈 화면 앱에서 이메일로 로그인하세요');
  },
  createPair: () => {
    const n = ($('#p-name') || {}).value || ''; const mc = (($('#p-mycode') || {}).value || '').replace(/\D/g, '');
    S.myCode = mc;
    if (mc && (mc.length < 4 || mc.length > 8)) { toast('코드는 숫자 4~8자리로 정해주세요'); return; }
    cloudTry(async () => { sessionStorage.setItem('nneow.openPair', '1'); await C().createCouple(n.trim(), mc); });
  },
  setCode: () => {
    const mc = (($('#p-mycode') || {}).value || '').replace(/\D/g, '');
    if (mc.length < 4 || mc.length > 8) { toast('코드는 숫자 4~8자리로 정해주세요'); return; }
    cloudTry(() => C().changeCode(mc), '코드를 정했어요');
  },
  randomCode: () => cloudTry(() => C().changeCode(''), '코드를 만들었어요'),
  changeCode: () => {
    openSheet(`<div class="confirm-text">코드 바꾸기</div><div class="confirm-sub">숫자 4~8자리로 정해주세요</div>
      <div class="field"><input id="cc-code" inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="예: 0214" class="code-input" /></div>
      <div class="actions"><button class="btn ghost" data-act="close">취소</button><button class="btn" data-act="ccSave">바꾸기</button></div>`, { center: true });
    actions.ccSave = () => {
      const mc = ($('#cc-code', root).value || '').replace(/\D/g, '');
      if (mc.length < 4 || mc.length > 8) { toast('코드는 숫자 4~8자리로 정해주세요'); return; }
      closeSheet(); cloudTry(() => C().changeCode(mc), '코드를 바꿨어요');
    };
  },
  joinPair: () => {
    const n = ($('#p-name') || {}).value || ''; const code = (($('#p-code') || {}).value || '').replace(/\D/g, '');
    S.pairCode = code;
    if (code.length < 4 || code.length > 8) { toast('초대 코드(숫자 4~8자리)를 입력해 주세요'); return; }
    cloudTry(async () => { sessionStorage.setItem('nneow.openPair', '1'); await C().joinCouple(code, n.trim()); });
  },
  shareInvite: async () => {
    const code = C() && C().code; if (!code) { toast('먼저 초대 코드를 정해주세요'); return; }
    const text = `nneow에서 나랑 캘린더 같이 쓰자!\n초대 코드: ${code}\n${location.origin + location.pathname}`;
    if (navigator.share) { try { await navigator.share({ text }); return; } catch { /* 취소 */ } }
    try { await navigator.clipboard.writeText(text); toast('초대 코드를 복사했어요'); } catch { toast(code); }
  },
  copyCode: async () => { const code = C() && C().code; if (!code) return; try { await navigator.clipboard.writeText(code); toast('코드를 복사했어요'); } catch { toast(code); } },
  unpair: () => confirmSheet('이 기기의 연결을 해제할까요?', '서버의 데이터는 그대로 남아요', '해제', async () => {
    await C().disconnect(); const u = new URL(location.href); u.searchParams.delete('as'); location.replace(u.pathname + u.search);
  }, true),
  exportICS: () => shareOrDownload(buildICS(visibleEvents(ME)), 'nneow.ics'),
  importICS: () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = '.ics,text/calendar';
    i.onchange = async () => {
      const f = i.files[0]; if (!f) return;
      const r = importICS(await f.text()); save(); render();
      toast(r.added ? `${r.added}개 일정을 가져왔어요${r.skipped ? ` (중복 ${r.skipped}개 제외)` : ''}` : (r.skipped ? '이미 가져온 일정이에요' : '가져올 일정이 없어요'));
    };
    i.click();
  },
  removeImported: () => confirmSheet('가져온 일정을 모두 지울까요?', '', '지우기', () => { db.events = db.events.filter((e) => !(e.owner === ME && e.importUid)); save(); render(); }, true),
  cancelReply: () => { S.replyTo = null; render(false, true); },

  /* ① LIST 완료 체크 */
  toggleDone: (el) => {
    const e = db.events.find((x) => x.id === el.dataset.id); if (!e) return;
    e.doneBy = { ...(e.doneBy || {}), [ME]: !isDone(e, ME) };
    save(); render();
  },

  /* 갤러리 */
  addPhotos: () => pickFiles((files) => addPhotos(files, todayStr())),
  openPhoto: (el) => { const g = db.gallery.find((x) => x.id === el.dataset.id); if (g) { closeSheet(); photoViewer(g); } },
  galFilter: (el) => { S.galFilter = el.dataset.v; render(); },

  /* 스티커 · 콕 */
  stickerPick: (el) => {
    closeSheet();
    if (!you().allowAccess) { toast(`${you().name}가 접근을 허용해야 스티커를 붙일 수 있어요`); return; }
    S.placing = el.dataset.k; S.viewPartner = true; render();
  },
  cancelPlace: () => { S.placing = null; render(); },
  openSticker: (el) => { const x = db.stickers.find((y) => y.id === el.dataset.id); if (x) stickerSheet(x); },
  poke: () => pokeSheet(),

  /* 월 달력 */
  smile: () => { S.photoMode = !S.photoMode; render(); },
  prevMonth: () => shiftMonth(-1),
  nextMonth: () => shiftMonth(1),
  pickMonth: () => monthPicker(S.month.y),
  togglePartner: () => { S.viewPartner = !S.viewPartner; S.placing = null; render(); },
  day: (el, e) => {
    const s = el.dataset.date;
    if (S.placing) { // 칸 안에서 누른 자리 그대로
      const r = el.getBoundingClientRect(); const cl = (v) => Math.min(0.86, Math.max(0.14, v));
      placeSticker(s, { x: cl((e.clientX - r.left) / r.width), y: cl((e.clientY - r.top) / r.height) }); return;
    }
    if (S.photoMode && !S.rangeStart) { photoDay(s); return; }
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
  memoForDay: (el) => { closeSheet(); memoCompose({ date: el.dataset.date }); },
  splitPrev: () => { S.sel = addDays(S.sel, -1); render(); },
  splitNext: () => { S.sel = addDays(S.sel, 1); render(); },
  gotoDay: (el) => { const s = el.dataset.date; const d = parse(s); S.month = { y: d.getFullYear(), m: d.getMonth() }; go('day', { sel: s, viewPartner: false }); },

  /* 메모 */
  composeMemo: () => memoCompose({ date: todayStr() }),
  memoTab: (el) => { S.memoTab = el.dataset.v; S.replyTo = null; render(true); },
  memoPrivate: () => { S.memoPrivate = !S.memoPrivate; render(); },
  memoView: (el) => { S.memoView = el.dataset.v; render(); },
  openMemo: (el) => { const m = db.memos.find((x) => x.id === el.dataset.id); if (m) go('memoView', { memoId: m.id }); },
  memoViewEdit: () => { const m = db.memos.find((x) => x.id === S.memoId); if (m) memoCompose({ memo: m }); },
  memoViewDelete: () => { const m = db.memos.find((x) => x.id === S.memoId); if (!m) return;
    confirmSheet('이 메모를 삭제할까요?', '', '삭제', () => { db.memos = db.memos.filter((x) => x.id !== m.id); save(); back(); }, true); },
  padImage: () => pickFile(async (f) => { S.memoImg = await shrinkImage(f); render(false, true); }),
  padImgRm: () => { S.memoImg = ''; render(false, true); },

  /* 설정 */
  pickFont: () => optionSheet('글씨체 변경', FONTS, me().font, (k) => { me().font = k; }, (k, v) => `<span style="font-family:${v.css.replace(/"/g, '&quot;')}">${v.label} · 가나다 Aa</span>`),
  pickTheme: () => optionSheet('테마 변경', THEMES, me().theme, (k) => { me().theme = k; }),
  pickSize: () => optionSheet('글자 크기', SIZES, String(me().fs || 1), (k) => { me().fs = +k; }),
  pickColor: (el) => colorSheet(el.dataset.k),
  toggleAccess: () => {
    if (me().allowAccess) { me().allowAccess = false; save(); render(); toast('상대방 접근을 껐어요'); return; }
    confirmSheet('상대방 접근을 허용하시겠습니까?', `${esc(you().name)}가 내 일정에 메모를 남기고<br/>내 캘린더에 스티커를 붙일 수 있어요`, '허용', () => {
      me().allowAccess = true; notify('access', `${me().name}님이 접근을 허용했어요`); save(); render(); toast('접근을 허용했어요');
    });
  },
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
    <div class="face-grid">${Object.entries(STICKERS).map(([k, v]) => `<button data-act="stickerPick" data-k="${k}" class="stk-btn">${v.svg}${v.label}</button>`).join('')}${Object.entries(FACES).filter(([k]) => k !== 'smile').map(([k, v]) => `<button data-act="moodPick" data-k="${k}" class="${mine && mine.face === k && Date.now() - mine.at < HOUR ? 'on' : ''}">${face(k)}${v.label}</button>`).join('')}</div>
    <p class="note" style="padding:12px 0 0">하트 · 별 · 네잎클로버는 ${esc(you().name)}의 캘린더에 붙이는 스티커예요${you().allowAccess ? '' : ' (상대가 접근을 허용해야 해요)'}</p>`);
  actions.moodPick = (el) => { closeSheet(); sendMood(el.dataset.k); };
}

/* 레드라인 (화면 ③ 숫자 꾹) */
function redlineAsk(target) {
  const from = S.sel < target ? S.sel : target; const to = S.sel < target ? target : S.sel;
  openSheet(`<div class="confirm-text">이 기간까지 레드라인을<br/>설정하겠습니까?</div>
    <div class="confirm-sub">${fmtDate(from)} → <b style="color:var(--red)">${fmtDate(to)}</b></div>
    <div class="field"><input id="r-title" placeholder="레드라인 이름 (예: 시험 기간)" /></div>
    <div class="switch-row" style="padding-top:0">${esc(you().name)}와 공유<button class="switch" id="r-shared"></button></div>
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

/* 상대의 오늘 진행률 (상대의 ① LIST 기준) */
function progressSheet() {
  const p = progressOf(YOU); const list = listToday(YOU);
  openSheet(`<div class="progress-card" style="margin:0">
      <div class="pc-top"><span>${esc(you().name)}의 오늘 진행률</span><b>${p.pct}%</b></div>
      <div class="pc-bar"><i style="width:${p.pct}%"></i></div>
      <div class="pc-sub">${p.total ? `오늘 일정 ${p.total}개 중 ${p.done}개 완료` : '오늘 등록된 일정이 없어요'}</div></div>
    ${list.length ? `<ul class="todo-list prog-list">${list.map((e) => { const d = isDone(e, YOU); return `<li class="todo ${d ? 'done' : ''}"><span class="chk ${d ? 'on' : ''}">${d ? ICON.check : ''}</span><span class="txt">${esc(e.title)}</span><span class="todo-when">${isTimed(e) ? timeLabel(e.startTime) : '하루 종일'}</span></li>`; }).join('')}</ul>` : ''}
    <div class="actions"><button class="btn block" data-act="close">닫기</button></div>`, { center: true });
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
    const m = db.memos.find((x) => x.id === el.dataset.id); if (!m) return;
    if (m.owner !== ME) { memoDetail(m); return; }
    memoMenu(m);
  },
  plus: () => go('list'), // ＋ 꾹 → 화면 ①
  bars: () => go('split', { sel: todayStr() }), // ||| 꾹 → 화면 ⑨
  circle: () => progressSheet(), // ○ 꾹 → 상대의 오늘 진행률
  evNote: (el) => {
    const e = db.events.find((x) => x.id === el.dataset.id); if (!e) return;
    if (e.owner === ME) { eventDetail(e); return; }
    if (!db.users[e.owner].allowAccess) { toast(`${db.users[e.owner].name}가 접근을 허용하지 않았어요`); return; }
    noteSheet(e);
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
  if (lpFired || swallowClick) { lpFired = false; swallowClick = false; e.preventDefault(); e.stopPropagation(); return; }
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
  if (kind === 'padSend' && (v || S.memoImg)) {
    const r = S.replyTo; S.replyTo = null; const img = S.memoImg; S.memoImg = '';
    addMemo(v, img, todayStr(), true, r, true);
    $('#pad-input') && $('#pad-input').focus();
  }
});

/* ================= 시작 ================= */
if (sessionStorage.getItem('nneow.openPair')) { sessionStorage.removeItem('nneow.openPair'); S.screen = 'pair'; history.replaceState({ screen: 'list' }, ''); history.pushState({ screen: 'pair' }, ''); }
render();
loadWeather();
showPokes();
receiveShared();
if (window.nneowCloud) {
  window.nneowCloud.start({
    getDb: () => db,
    emptyDb,
    applyRemote: (d) => applyRemote(d, true),
    toast,
    onStatus: () => { if (['pair', 'settings', 'list'].includes(S.screen) && !$('.overlay')) render(false, true); },
    resetLocal: (cid, db0) => {
      try { if (db0) localStorage.setItem('nneow.couple.' + cid, JSON.stringify(db0)); else localStorage.removeItem('nneow.couple.' + cid); } catch { /* 무시 */ }
      sessionStorage.setItem('nneow.openPair', '1');
      const u = new URL(location.href); u.searchParams.delete('as'); location.replace(u.pathname + u.search);
    },
  });
}
// 휴대폰이 저장공간을 정리할 때 앱 데이터(로그인 포함)를 지우지 않도록 요청
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch { /* 무시 */ }
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
// 자정이 지나면 LIST 날짜 갱신
let lastDay = todayStr();
setInterval(() => { if (todayStr() !== lastDay) { lastDay = todayStr(); render(); } }, 60e3);
})();
