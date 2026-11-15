/* nneow 클라우드 동기화 (Firebase Auth + Firestore)
 * - 두 사람이 하나의 couples/{cid} 문서를 공유하고, 데이터는 couples/{cid}/docs/{col__id} 에 저장
 * - 앱 데이터(db)를 문서 단위로 나눠 바뀐 것만 올리고, 상대가 바꾼 내용은 실시간으로 받음
 */
(() => {
'use strict';

const CONFIG = {
  apiKey: 'AIzaSyCzGYjebevBG2IoSqJc8rT2YimeolJendY',
  authDomain: 'nneow-5a0ac.firebaseapp.com',
  projectId: 'nneow-5a0ac',
  storageBucket: 'nneow-5a0ac.firebasestorage.app',
  messagingSenderId: '615200908922',
  appId: '1:615200908922:web:d48bf45378f9c968c93dc3',
  measurementId: 'G-2J39P64M36',
};
const LS = 'nneow.cloud';
const ARRAYS = ['events', 'deadlines', 'memos', 'todos', 'notifs', 'moodLog', 'gallery', 'stickers', 'pokes'];

const available = typeof firebase !== 'undefined';
let auth = null, fs = null, hooks = null;
const st = { user: null, unsub: null, coupleUnsub: null, synced: new Map(), timer: null, latest: null, status: 'off', members: 0, error: '', invite: null };

const info = () => { try { return JSON.parse(localStorage.getItem(LS)); } catch { return null; } };
const setInfo = (v) => (v ? localStorage.setItem(LS, JSON.stringify(v)) : localStorage.removeItem(LS));

function init() {
  if (!available || auth) return;
  const app = firebase.initializeApp(CONFIG);
  auth = firebase.auth(app);
  fs = firebase.firestore(app);
  // 로컬 에뮬레이터로 시험할 때: ?emu=1
  const q = new URLSearchParams(location.search);
  if (q.get('emu')) sessionStorage.setItem('nneow.emu', '1');
  if (sessionStorage.getItem('nneow.emu') && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    auth.useEmulator('http://127.0.0.1:9099', { disableWarnings: true });
    fs.useEmulator('127.0.0.1', 8080);
  } else {
    fs.enablePersistence({ synchronizeTabs: true }).catch(() => {}); // 오프라인에서도 동작
  }
}

/* ---------- db <-> 문서 ---------- */
function flatten(db) {
  const m = new Map();
  ARRAYS.forEach((col) => (db[col] || []).forEach((o) => m.set(`${col}__${o.id}`, JSON.stringify(o))));
  ['a', 'b'].forEach((r) => {
    if (db.users && db.users[r]) m.set(`users__${r}`, JSON.stringify(db.users[r]));
    if (db.moods && db.moods[r]) m.set(`moods__${r}`, JSON.stringify(db.moods[r]));
    Object.entries((db.photos && db.photos[r]) || {}).forEach(([d, o]) => m.set(`photos__${r}_${d}`, JSON.stringify(o)));
  });
  return m;
}
function unflatten(m) {
  const db = hooks.emptyDb();
  for (const [k, json] of m) {
    const i = k.indexOf('__'); const col = k.slice(0, i); const id = k.slice(i + 2);
    let o; try { o = JSON.parse(json); } catch { continue; }
    if (ARRAYS.includes(col)) db[col].push(o);
    else if (col === 'users') db.users[id] = { ...db.users[id], ...o };
    else if (col === 'moods') db.moods[id] = o;
    else if (col === 'photos') { const r = id.slice(0, 1); db.photos[r][id.slice(2)] = o; }
  }
  db.notifs.sort((a, b) => a.at - b.at);
  db.moodLog.sort((a, b) => a.at - b.at);
  db.memos.sort((a, b) => a.createdAt - b.createdAt);
  return db;
}
const docsCol = (cid) => fs.collection('couples').doc(cid).collection('docs');

/* ---------- 올리기: 바뀐 문서만 ---------- */
function push(db) {
  if (st.status !== 'live') return; // 서버 상태를 받기 전에는 올리지 않음 (덮어쓰기 방지)
  st.latest = db;
  clearTimeout(st.timer);
  st.timer = setTimeout(flush, 250);
}
async function flush() {
  clearTimeout(st.timer); st.timer = null;
  const c = info(); if (!c || !st.latest || !fs) return;
  const now = flatten(st.latest);
  const ops = [];
  now.forEach((json, k) => { if (st.synced.get(k) !== json) ops.push(['set', k, json]); });
  st.synced.forEach((_, k) => { if (!now.has(k)) ops.push(['del', k]); });
  if (!ops.length) return;
  st.synced = now;
  const col = docsCol(c.cid);
  for (let i = 0; i < ops.length; i += 400) {
    const b = fs.batch();
    ops.slice(i, i + 400).forEach(([t, k, json]) => {
      if (t === 'set') b.set(col.doc(k), { col: k.split('__')[0], json, by: st.user ? st.user.uid : '', at: firebase.firestore.FieldValue.serverTimestamp() });
      else b.delete(col.doc(k));
    });
    try { await b.commit(); }
    catch (e) { st.error = e.code || e.message; hooks.toast('동기화에 실패했어요: ' + st.error); }
  }
}

/* ---------- 받기: 실시간 구독 ---------- */
function subscribe(cid) {
  if (st.unsub) st.unsub();
  st.status = 'connecting'; hooks.onStatus();
  st.unsub = docsCol(cid).onSnapshot({ includeMetadataChanges: false }, (snap) => {
    const m = new Map();
    snap.docs.forEach((d) => { const v = d.data(); if (v && typeof v.json === 'string') m.set(d.id, v.json); });
    if (snap.metadata.fromCache && !m.size) return; // 비어 있는 캐시는 무시하고 서버 응답을 기다림
    st.status = 'live'; st.error = '';
    if (st.timer) { st.synced = m; flush(); hooks.onStatus(); return; } // 내 변경을 먼저 보내고, 다음 스냅샷에서 반영
    st.synced = m;
    const cur = flatten(hooks.getDb());
    let same = cur.size === m.size;
    if (same) for (const [k, v] of m) { if (cur.get(k) !== v) { same = false; break; } }
    if (!same && m.size) hooks.applyRemote(unflatten(m));
    hooks.onStatus();
  }, (e) => {
    st.status = 'error'; st.error = e.code || e.message; hooks.onStatus();
  });
  if (st.coupleUnsub) st.coupleUnsub();
  st.coupleUnsub = fs.collection('couples').doc(cid).onSnapshot((d) => {
    st.members = d.exists ? (d.data().members || []).length : 0; hooks.onStatus();
  }, () => {});
}

/* ---------- 로그인 ---------- */
async function signInGoogle() {
  init();
  const p = new firebase.auth.GoogleAuthProvider();
  try { await auth.signInWithPopup(p); }
  catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(e.code)) await auth.signInWithRedirect(p);
    else throw e;
  }
}
async function signInAnon() { init(); await auth.signInAnonymously(); }
/* 이메일 로그인: 카카오톡 안 브라우저, 홈 화면 앱 등 구글 로그인 창이 안 뜨는 곳에서도 동작. 계정이 없으면 새로 만듦 */
async function signInEmail(email, pw) {
  init();
  try { await auth.signInWithEmailAndPassword(email, pw); }
  catch (e) {
    if (!['auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(e.code)) throw e;
    try { await auth.createUserWithEmailAndPassword(email, pw); }
    catch (e2) { if (e2.code === 'auth/email-already-in-use') { const x = new Error('비밀번호가 맞지 않아요'); x.code = 'auth/wrong-password'; throw x; } throw e2; }
  }
}
/* 같은 계정으로 다른 기기에서 로그인하면 기존 연결을 찾아줌 */
async function findCouple() {
  const u = auth.currentUser; if (!u) return null;
  const q = await fs.collection('couples').where('members', 'array-contains', u.uid).limit(1).get();
  if (q.empty) return null;
  const d = q.docs[0]; const role = (d.data().roles || {})[u.uid];
  return role ? { cid: d.id, role, uid: u.uid } : null;
}

/* ---------- 이메일로 초대 ----------
 * A가 상대 이메일을 입력 → emailInvites/{상대 이메일} 생성
 * B가 그 이메일로 로그인하면 초대를 찾아 바로 연결 (코드 필요 없음)
 */
const myEmail = () => ((auth && auth.currentUser && auth.currentUser.email) || '').trim().toLowerCase();
const normEmail = (e) => String(e || '').trim().toLowerCase();
async function checkInvite() {
  const em = myEmail(); if (!em) return null;
  const d = await fs.collection('emailInvites').doc(em).get().catch(() => null);
  return d && d.exists ? d.data() : null;
}

async function createCouple(myName, partnerEmail) {
  const u = auth.currentUser; if (!u) throw new Error('로그인이 필요해요');
  const pe = normEmail(partnerEmail);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(pe)) throw new Error('상대 이메일을 확인해 주세요');
  if (pe === myEmail()) throw new Error('내 이메일이에요. 상대가 로그인할 이메일을 넣어주세요');
  // 상대가 먼저 나를 초대했다면 그 초대로 바로 연결
  const mine = await checkInvite();
  if (mine) { await joinCouple(mine.cid, myName); return 'joined'; }
  const ref = fs.collection('couples').doc();
  await ref.set({ members: [u.uid], roles: { [u.uid]: 'a' }, createdAt: Date.now() });
  try {
    await fs.collection('emailInvites').doc(pe).set({ cid: ref.id, createdBy: u.uid, fromName: myName || '', fromEmail: myEmail(), createdAt: Date.now() });
  } catch (e) {
    await ref.delete().catch(() => {});
    if (e.code === 'permission-denied') throw new Error('이 이메일은 이미 다른 사람이 초대했어요');
    throw e;
  }
  const db0 = hooks.emptyDb(); db0.users.a.name = myName || db0.users.a.name;
  const col = docsCol(ref.id); const b = fs.batch();
  flatten(db0).forEach((json, k) => b.set(col.doc(k), { col: k.split('__')[0], json, by: u.uid, at: firebase.firestore.FieldValue.serverTimestamp() }));
  await b.commit();
  setInfo({ cid: ref.id, role: 'a', uid: u.uid, partnerEmail: pe });
  hooks.resetLocal(ref.id, db0);
  return 'invited';
}

async function joinCouple(cid, myName) {
  const u = auth.currentUser; if (!u) throw new Error('로그인이 필요해요');
  try {
    await fs.collection('couples').doc(cid).update({
      members: firebase.firestore.FieldValue.arrayUnion(u.uid),
      [`roles.${u.uid}`]: 'b',
      joinedAt: Date.now(),
    });
  } catch (e) {
    const again = await findCouple().catch(() => null);
    if (!again || again.cid !== cid) throw new Error('이미 두 사람이 연결된 캘린더예요');
  }
  const col = docsCol(cid);
  const ub = await col.doc('users__b').get();
  const base = ub.exists ? JSON.parse(ub.data().json) : hooks.emptyDb().users.b;
  if (myName) base.name = myName;
  await col.doc('users__b').set({ col: 'users', json: JSON.stringify(base), by: u.uid, at: firebase.firestore.FieldValue.serverTimestamp() });
  await fs.collection('emailInvites').doc(myEmail()).delete().catch(() => {});
  setInfo({ cid, role: 'b', uid: u.uid });
  hooks.resetLocal(cid, null);
}
async function acceptInvite(myName) {
  const inv = st.invite || await checkInvite();
  if (!inv) throw new Error('초대를 찾을 수 없어요');
  await joinCouple(inv.cid, myName);
}

async function disconnect() {
  await flush().catch(() => {});
  const c = info();
  // 상대가 아직 안 들어온 초대는 함께 취소
  if (c && c.role === 'a' && c.partnerEmail && st.members < 2 && fs) await fs.collection('emailInvites').doc(c.partnerEmail).delete().catch(() => {});
  if (st.unsub) st.unsub(); if (st.coupleUnsub) st.coupleUnsub();
  setInfo(null);
  if (auth) await auth.signOut().catch(() => {});
}

/* ---------- 시작 ---------- */
function start(h) {
  hooks = h;
  if (!available) { st.status = 'unavailable'; return; }
  init();
  auth.getRedirectResult().catch(() => {});
  auth.onAuthStateChanged(async (u) => {
    st.user = u;
    const c = info();
    if (c && u && c.uid === u.uid) { subscribe(c.cid); return; }
    if (c && !u) { st.status = 'signed-out'; hooks.onStatus(); return; }
    if (!c && u) {
      // 다른 기기에서 이미 연결해 둔 계정이면 자동으로 이어 붙임
      const found = await findCouple().catch(() => null);
      if (found) { setInfo(found); hooks.resetLocal(found.cid, null); return; }
      st.invite = await checkInvite(); // 누가 내 이메일로 초대했는지
      st.status = st.invite ? 'invited' : 'signed-in'; hooks.onStatus(); return;
    }
    st.status = 'off'; hooks.onStatus();
  });
}

window.nneowCloud = {
  available, start, push, flush, info, signInGoogle, signInAnon, signInEmail, createCouple, acceptInvite, disconnect,
  get email() { return myEmail(); },
  get invite() { return st.invite; },
  get status() { return st.status; },
  get user() { return st.user; },
  get members() { return st.members; },
  get error() { return st.error; },
};
})();
