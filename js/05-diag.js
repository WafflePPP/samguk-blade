'use strict';
// ---------- 진단: 오류 기록(복사) + 디버그 오버레이 ----------
// 맨 앞에 로드되어 이후 파일의 로드 오류도 잡는다. 최상위에서는 window/localStorage/performance 만 쓰고,
// 게임 전역(mode, state, NET, ctx, text ...)은 함수 안(실행 중)에서만 부른다.
const ERR_MAX = 20, ERR_KEY = 'tkc_errlog', DBG_KEY = 'tkc_dbg';
const ERRS = [];   // { t(ms), src, msg, file, line, col, stack, ctx, n, prev }
const DBG = { on: false, fps: 0, upd: 0, updMax: 0, rnd: 0, ping: -1, gapAvg: -1, gapMax: -1, sinceSnap: -1, copyMsg: '', copyT: 0, copyPending: false };
const DBG_BTN = () => ({ x: W / 2 - 320, y: 452, w: 170, h: 36 }), ERR_BTN = () => ({ x: W / 2 + 150, y: 452, w: 170, h: 36 });   // 도움말 창 안 버튼 (튜토리얼 버튼 좌우)
let dbgAcc = { n: 0, t0: 0, u: 0, uMax: 0, r: 0 }, dbgPingAt = 0, dbgPingSent = 0, dbgLastSnap = 0, dbgGaps = [];

function errLoad() {
  try { DBG.on = localStorage.getItem(DBG_KEY) === '1'; } catch (_) { }
  try { const a = JSON.parse(localStorage.getItem(ERR_KEY) || '[]'); if (Array.isArray(a)) for (const e of a.slice(-ERR_MAX)) { e.prev = true; ERRS.push(e); } } catch (_) { }
}
function errSave() { try { localStorage.setItem(ERR_KEY, JSON.stringify(ERRS)); } catch (_) { } }
const errClean = s => String(s == null ? '' : s).replace(/(https?|file|capacitor):\/\/[^\s)]*?([^\/\s)?]+\.js)(\?[^\s):]*)?/g, '$2');   // 주소·쿼리 제거, 파일 이름만 남김
function errCtx() {   // 현재 상황 (개인 정보 없음: 계정·저장 데이터는 쓰지 않는다)
  try { return { mode: typeof mode !== 'undefined' ? mode : '?', state: typeof state !== 'undefined' ? state : '?', raid: typeof RAID !== 'undefined' && !!RAID, online: typeof NET !== 'undefined' && NET.on ? (NET.role || 'on') : 'off' }; } catch (_) { return {}; }
}
function errLog(src, msg, file, line, col, stack) {
  try {
    msg = errClean(msg).slice(0, 300); file = errClean(file).slice(0, 80); stack = errClean(stack).split('\n').slice(0, 6).join(' | ').slice(0, 600);
    const last = ERRS[ERRS.length - 1];
    if (last && !last.prev && last.src === src && last.msg === msg && last.line === line && last.file === file) {   // 같은 오류가 반복되면 횟수만 올린다 (프레임마다 나는 오류가 20칸을 채우지 않게)
      last.n++; last.t = Date.now(); if ((last.n & (last.n - 1)) === 0) errSave(); return;
    }
    ERRS.push({ t: Date.now(), src, msg, file, line: line | 0, col: col | 0, stack, ctx: errCtx(), n: 1 });
    while (ERRS.length > ERR_MAX) ERRS.shift();
    errSave();
  } catch (_) { }
}
window.addEventListener('error', ev => { errLog('error', ev.message || (ev.error && ev.error.message), ev.filename, ev.lineno, ev.colno, ev.error && ev.error.stack); });
window.addEventListener('unhandledrejection', ev => { const r = ev.reason; errLog('promise', r && r.message ? r.message : r, '', 0, 0, r && r.stack); });
function errReport() {
  let v = '?'; try { const s = document.querySelector('script[src*="js/"]'); const m = s && /[?&]v=([^&"]+)/.exec(s.getAttribute('src')); if (m) v = m[1]; } catch (_) { }
  const iso = t => new Date(t).toISOString().replace('T', ' ').slice(0, 19) + 'Z';
  const head = ['[삼국 맹장전 오류 기록]', '생성 ' + iso(Date.now()) + ' · 게임 ' + (typeof GAME_VER !== 'undefined' ? GAME_VER : '?') + ' · 빌드 v=' + v + ' · NET_VER ' + (typeof NET_VER !== 'undefined' ? NET_VER : '?') + ' · 화면 ' + innerWidth + 'x' + innerHeight + ' · 터치 ' + (typeof IS_TOUCH !== 'undefined' && IS_TOUCH ? 'O' : 'X'), 'UA ' + (navigator.userAgent || '').slice(0, 140), '기록 ' + ERRS.length + '건 (최대 ' + ERR_MAX + ', 이전 실행분은 [이전] 표시)'];
  const body = ERRS.map((e, i) => { const c = e.ctx || {}; return '#' + (i + 1) + (e.prev ? ' [이전]' : '') + ' ' + iso(e.t) + ' [' + e.src + (e.n > 1 ? ' x' + e.n : '') + '] mode=' + c.mode + ' state=' + c.state + ' raid=' + c.raid + ' online=' + c.online + '\n   ' + e.msg + '\n   ' + (e.file || '-') + ':' + e.line + ':' + e.col + (e.stack ? '\n   ' + e.stack : ''); });
  return head.concat(body.length ? body : ['(기록된 오류 없음)']).join('\n');
}
function errCopy() {   // 반드시 사용자 입력(pointerup) 안에서 호출
  const txt = errReport(), done = ok => { DBG.copyMsg = ok ? '복사됨 (' + ERRS.length + '건)' : '복사 실패'; DBG.copyT = Date.now(); };
  const fallback = () => { try { const ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); if (!ok && typeof prompt === 'function') prompt('오류 기록 — 전체 선택 후 복사하세요', txt); done(ok); } catch (_) { done(false); } };
  try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => done(true), fallback); else fallback(); } catch (_) { fallback(); }
}
window.addEventListener('pointerup', () => { if (DBG.copyPending) { DBG.copyPending = false; errCopy(); } });   // 터치는 pointerdown 이 아니라 pointerup 이 사용자 동작으로 인정된다

// 도움말 창 클릭 처리 — 처리했으면 true (도움말을 닫지 않는다)
function diagHelpClick(x, y) {
  if (inRect(x, y, DBG_BTN())) { DBG.on = !DBG.on; try { localStorage.setItem(DBG_KEY, DBG.on ? '1' : '0'); } catch (_) { } dbgAcc = { n: 0, t0: 0, u: 0, uMax: 0, r: 0 }; return true; }
  if (inRect(x, y, ERR_BTN())) { DBG.copyPending = true; return true; }
  return false;
}
function drawDiagButtons() {
  const b = (r, label, on) => { ctx.fillStyle = 'rgba(10,12,20,.9)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = on ? '#7dff9a' : '#7a8aa0'; ctx.lineWidth = 1.5; ctx.strokeRect(r.x, r.y, r.w, r.h); text(label, r.x + r.w / 2, r.y + 24, 14, on ? '#bfffd0' : '#cfd3e6', 'center', false); };
  b(DBG_BTN(), '디버그 표시: ' + (DBG.on ? '켜짐' : '꺼짐'), DBG.on);
  b(ERR_BTN(), '오류 기록 복사 (' + ERRS.length + ')', ERRS.length > 0);
  if (DBG.copyMsg && Date.now() - DBG.copyT < 3000) text(DBG.copyMsg, W / 2 + 235, 506, 13, DBG.copyMsg.startsWith('복사됨') ? '#7dff9a' : '#ff8a8a', 'center', false);
}

// ----- 디버그 오버레이 (기본 꺼짐; 켜졌을 때만 측정) -----
function dbgFrame(now, updMs, rndMs) {   // frame() 에서 켜져 있을 때만 호출
  const a = dbgAcc; if (!a.t0) a.t0 = now;
  a.n++; a.u += updMs; a.r += rndMs; if (updMs > a.uMax) a.uMax = updMs;
  if (now - a.t0 >= 500) { DBG.fps = a.n * 1000 / (now - a.t0); DBG.upd = a.u / a.n; DBG.updMax = a.uMax; DBG.rnd = a.r / a.n; dbgAcc = { n: 0, t0: now, u: 0, uMax: 0, r: 0 }; }
  if (typeof NET !== 'undefined' && NET.on) {
    if (NET.open && now - dbgPingAt > 2000) { dbgPingAt = now; dbgPingSent = now; netRaw({ t: 'ping' }); }   // 서버가 'pong' 으로 답한다 → 왕복 지연
    const s = NET.snaps && NET.snaps[NET.snaps.length - 1];   // 참가자 쪽: 받은 스냅샷 간격
    if (s && s.rt !== dbgLastSnap) { if (dbgLastSnap) { dbgGaps.push(s.rt - dbgLastSnap); if (dbgGaps.length > 30) dbgGaps.shift(); } dbgLastSnap = s.rt; }
    if (dbgGaps.length) { DBG.gapAvg = dbgGaps.reduce((p, c) => p + c, 0) / dbgGaps.length; DBG.gapMax = Math.max.apply(null, dbgGaps); DBG.sinceSnap = now - dbgLastSnap; }
  } else { DBG.ping = -1; DBG.gapAvg = -1; dbgGaps.length = 0; dbgLastSnap = 0; }
}
function dbgPong() { if (dbgPingSent) { DBG.ping = performance.now() - dbgPingSent; dbgPingSent = 0; } }
function drawDebug() {
  const L = ['FPS ' + DBG.fps.toFixed(0) + '   update ' + DBG.upd.toFixed(1) + 'ms (최대 ' + DBG.updMax.toFixed(1) + ')   draw ' + DBG.rnd.toFixed(1) + 'ms'];
  if (typeof NET !== 'undefined' && NET.on) L.push('온라인 ' + (NET.role || '') + '   ping ' + (DBG.ping < 0 ? '-' : DBG.ping.toFixed(0) + 'ms') + (DBG.gapAvg >= 0 ? '   스냅샷 간격 ' + DBG.gapAvg.toFixed(0) + 'ms (최대 ' + DBG.gapMax.toFixed(0) + ', 마지막 ' + DBG.sinceSnap.toFixed(0) + 'ms 전)' : ''));
  if (ERRS.length) L.push('오류 ' + ERRS.length + '건 (도움말에서 복사)');
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);   // 캔버스 해상도 = 논리 좌표(W×H)
  ctx.font = '12px monospace'; let w = 0; for (const l of L) w = Math.max(w, ctx.measureText(l).width);
  const x = 6, y = 540;   // 왼쪽 가운데 아래: 위쪽 정보 표·아래쪽 안내 줄·조작 버튼과 겹치지 않는 자리
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x, y, w + 12, L.length * 15 + 6);
  ctx.fillStyle = DBG.fps && DBG.fps < 30 ? '#ff8a8a' : '#aaffbb'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  L.forEach((l, i) => ctx.fillText(l, x + 6, y + 16 + i * 15));
  ctx.restore();
}
errLoad();

// ----- 캡처·프로모 모드 (개발·스토어 그래픽용) — 주소에 ?capture 가 있을 때만 켜진다 (일반 사용자에게는 없음) -----
// F6 : 확대(1 → 1.6 → 2.4 → 3.2배, 영웅이 화면 가운데)   F7 : 화면 정지   F8 : HUD 숨기기   F9 : 지금 화면을 1280x720 PNG 로 저장
const CAP = { on: false, hideHud: false, freeze: false, zi: 0 }, CAP_ZOOM = [1, 1.6, 2.4, 3.2];
try { CAP.on = /[?&]capture(=|&|$)/.test(location.search); } catch (_) { }
function capSave() {
  const d = new Date(), p = n => String(n).padStart(2, '0'), v = typeof GAME_VER !== 'undefined' ? GAME_VER.split('+')[0] : 'x';
  const name = 'tkc-v' + v + '-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '.png';
  cv.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, 'image/png');
  return name;
}
if (CAP.on) {
  console.info('[capture] F6 확대 · F7 정지 · F8 HUD 숨김 · F9 PNG 저장');
  window.addEventListener('keydown', e => {
    if (e.code === 'F6') CAP.zi = (CAP.zi + 1) % CAP_ZOOM.length;
    else if (e.code === 'F7') CAP.freeze = !CAP.freeze;
    else if (e.code === 'F8') CAP.hideHud = !CAP.hideHud;
    else if (e.code === 'F9') capSave();
    else return;
    e.preventDefault();
  });
}
