/* nneow 클라우드 동기화 (Firebase Auth + Firestore)
 * - 두 사람이 하나의 couples/{cid} 문서를 공유하고, 데이터는 couples/{cid}/docs/{col__id} 에 저장
 * - 앱 데이터(db)를 문서 단위로 나눠 바뀐 것만 올리고, 상대가 바꾼 내용은 실시간으로 받음
 */
(() => {
'use strict';

const CONFIG = {
  apiKey: 'AIzaSyDzYZev5ns3imqyeSEiF7rN6bb7sSyTaHk',
  authDomain: 'meow-ced8f.firebaseapp.com',
  projectId: 'meow-ced8f',
  storageBucket: 'meow-ced8f.firebasestorage.app',
  messagingSenderId: '89386576660',
  appId: '1:89386576660:web:1e9fe60a53f50a4bc43001',
  measurementId: 'G-62DG7T6JZD',
};
const LS = 'nneow.cloud';
const ARRAYS = ['events', 'deadlines', 'memos', 'todos', 'notifs', 'moodLog', 'gallery', 'stickers', 'pokes'];

const available = typeof firebase !== 'undefined';
let auth = null, fs = null, hooks = null;
const st = { code: '', user: null, unsub: null, coupleUnsub: null, synced: new Map(), timer: null, latest: null, status: 'off', members: 0, error: '', invite: null };

const info = () => { try { return JSON.parse(localStorage.getItem(LS)); } catch { return null; } };
const setInfo = (v) => (v ? localStorage.setItem(LS, JSON.stringify({ ...v, pid: CONFIG.projectId })) : localStorage.removeItem(LS));
// 예전 Firebase 프로젝트로 연결해 둔 기록은 지워서 새 프로젝트로 깨끗하게 시작
{ const c = info(); if (c && c.pid !== CONFIG.projectId) localStorage.removeItem(LS); }

function init() {
  if (!available || auth) return;
  const app = firebase.initializeApp(CONFIG);
  auth = firebase.auth(app);
  fs = firebase.firestore(app);
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {}); // 앱을 닫았다 열어도 로그인 유지
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
    st.members = d.exists ? (d.data().members || []).length : 0;
    st.code = d.exists ? (d.data().code || '') : '';
    const c = info(); if (c && st.code && c.code !== st.code) setInfo({ ...c, code: st.code });
    hooks.onStatus();
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

/* ---------- 초대 코드 (숫자 4~8자리, 직접 정하거나 자동) ----------
 * 코드는 couples/{cid}.code 에도 저장 → 어느 기기에서 다시 로그인해도 코드를 볼 수 있음
 */
function makeCode() { const r = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000; return String(r).padStart(6, '0'); }
const cleanCode = (c) => String(c || '').replace(/\D/g, '');
async function codeTaken(code) { const d = await fs.collection('invites').doc(code).get(); return d.exists; }
async function pickCode(wanted) {
  if (wanted) {
    if (!/^\d{4,8}$/.test(wanted)) throw new Error('코드는 숫자 4~8자리로 정해주세요');
    if (await codeTaken(wanted)) throw new Error('이미 누가 쓰고 있는 번호예요. 다른 숫자로 정해주세요');
    return wanted;
  }
  for (let i = 0; i < 8; i++) { const c = makeCode(); if (!(await codeTaken(c))) return c; }
  throw new Error('코드를 만들지 못했어요. 다시 시도해 주세요');
}

async function createCouple(myName, wantedCode) {
  const u = auth.currentUser; if (!u) throw new Error('로그인이 필요해요');
  const code = await pickCode(cleanCode(wantedCode)); // 먼저 번호를 확인해서 빈 캘린더가 남지 않게
  const ref = fs.collection('couples').doc();
  await ref.set({ members: [u.uid], roles: { [u.uid]: 'a' }, code, createdAt: Date.now() });
  try { await fs.collection('invites').doc(code).set({ cid: ref.id, createdBy: u.uid, fromName: myName || '', createdAt: Date.now() }); }
  catch (e) { throw new Error(e.code === 'permission-denied' ? '이미 누가 쓰고 있는 번호예요. 다른 숫자로 정해주세요' : (e.message || '코드를 만들지 못했어요')); }
  const db0 = hooks.emptyDb(); db0.users.a.name = myName || db0.users.a.name;
  const col = docsCol(ref.id); const b = fs.batch();
  flatten(db0).forEach((json, k) => b.set(col.doc(k), { col: k.split('__')[0], json, by: u.uid, at: firebase.firestore.FieldValue.serverTimestamp() }));
  await b.commit();
  setInfo({ cid: ref.id, role: 'a', uid: u.uid, code });
  hooks.resetLocal(ref.id, db0);
  return code;
}

/* 상대가 들어오기 전, 코드를 새로 정하거나 바꾸기 */
async function changeCode(wantedCode) {
  const c = info(); const u = auth && auth.currentUser;
  if (!c || !u) throw new Error('로그인이 필요해요');
  const old = st.code || c.code;
  const code = await pickCode(cleanCode(wantedCode));
  await fs.collection('invites').doc(code).set({ cid: c.cid, createdBy: u.uid, createdAt: Date.now() });
  await fs.collection('couples').doc(c.cid).update({ code });
  if (old && old !== code) await fs.collection('invites').doc(old).delete().catch(() => {});
  st.code = code; setInfo({ ...c, code });
  return code;
}

async function joinCouple(code, myName) {
  const u = auth.currentUser; if (!u) throw new Error('로그인이 필요해요');
  code = cleanCode(code);
  if (code.length < 4 || code.length > 8) throw new Error('초대 코드(숫자 4~8자리)를 입력해 주세요');
  const inv = await fs.collection('invites').doc(code).get();
  if (!inv.exists) throw new Error('초대 코드를 찾을 수 없어요. 숫자를 다시 확인해 주세요');
  const cid = inv.data().cid;
  if (inv.data().createdBy === u.uid) throw new Error('내가 만든 코드예요. 상대 휴대폰에서 입력해 주세요');
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
  await fs.collection('invites').doc(code).delete().catch(() => {});
  setInfo({ cid, role: 'b', uid: u.uid });
  hooks.resetLocal(cid, null);
}

async function disconnect() {
  await flush().catch(() => {});
  const c = info();
  // 상대가 아직 안 들어온 초대 코드는 함께 취소
  const code = st.code || (c && c.code);
  if (c && c.role === 'a' && code && st.members < 2 && fs) await fs.collection('invites').doc(code).delete().catch(() => {});
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
      st.status = 'signed-in'; hooks.onStatus(); return;
    }
    st.status = 'off'; hooks.onStatus();
  });
}

window.nneowCloud = {
  available, start, push, flush, info, signInGoogle, signInAnon, signInEmail, createCouple, joinCouple, changeCode, disconnect,
  get code() { const c = info(); return st.code || (c && c.code) || ''; },
  get email() { return (auth && auth.currentUser && auth.currentUser.email) || ''; },
  get status() { return st.status; },
  get user() { return st.user; },
  get members() { return st.members; },
  get error() { return st.error; },
};
})();
