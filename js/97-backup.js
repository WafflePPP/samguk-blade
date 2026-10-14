'use strict';
// ---------- 저장 안전망: 백업 내보내기·가져오기 + 손상 복구 ----------
// 계정 팝업(로그인 화면 > 계정 선택) 위쪽의 [백업 내보내기] [백업 가져오기] 버튼.
//  - 내보내기: 계정·영웅 성장 전체를 한 줄 코드('SGB1.…')로 만들어 복사한다 (메신저에 붙여 보관 → 폰 교체·앱 삭제 대비).
//  - 가져오기: 코드를 붙여 넣으면 검사(형식·체크섬·값 범위) 후 현재 저장을 교체한다. 교체 직전 상태는 sgb_save_v1_prev 에 한 번 보관되어 "직전 상태로 되돌리기" 가능.
//  - 손상 복구: 실행 때마다 읽은 저장을 sgb_save_v1_boot 에 한 부 보관한다. 저장이 깨져 읽히지 않으면 깨진 원본은 sgb_save_v1_corrupt 로 남기고 boot 사본으로 복구한다.
// 판 기록(sgb_runlog_v1)·소리 설정은 백업에 포함하지 않는다. 게임 코드가 아니라 데이터 이동 도구이므로 온라인 규칙(NET_VER)과 무관.
const BK_PREFIX = 'SGB1.', BK_BOOT = SAVE_KEY + '_boot', BK_PREV = SAVE_KEY + '_prev', BK_CORRUPT = SAVE_KEY + '_corrupt';
const BK_EXPORT = { x: POP.x + 24, y: POP.y + 14, w: 130, h: 30 }, BK_IMPORT = { x: POP.x + 162, y: POP.y + 14, w: 130, h: 30 };
let SAVE_NOTE = null, BK_POP = null;   // SAVE_NOTE = { msg, t } 로그인 화면에 잠시 보이는 안내

// ----- 손상 복구 (loadSave 에서 부른다) -----
function saveRescue(raw) {
  try { if (raw) localStorage.setItem(BK_CORRUPT, raw); } catch (_) { }
  try {
    const j = JSON.parse(localStorage.getItem(BK_BOOT));
    if (j && Array.isArray(j.accounts) && j.accounts.length) { SAVE = j; SAVE_NOTE = { msg: '저장 데이터를 읽지 못해 지난 실행 때의 백업으로 복구했습니다', t: Date.now() }; saveSave(); }
    else if (raw) SAVE_NOTE = { msg: '저장 데이터를 읽지 못했습니다 — 계정 > 백업 가져오기로 복원할 수 있습니다', t: Date.now() };
  } catch (_) { }
}
function saveBootSnap() { try { if (SAVE.accounts.length) localStorage.setItem(BK_BOOT, JSON.stringify(SAVE)); } catch (_) { } }

// ----- 코드 만들기·읽기 -----
const bkHash = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
const bkEnc = s => btoa(unescape(encodeURIComponent(s))), bkDec = b => decodeURIComponent(escape(atob(b)));
function bkMake() {
  const save = JSON.stringify(SAVE), body = JSON.stringify({ k: 'sgb-save', v: 1, game: typeof GAME_VER !== 'undefined' ? GAME_VER : '?', t: new Date().toISOString().slice(0, 16), chk: bkHash(save), save: JSON.parse(save) });
  return BK_PREFIX + bkEnc(body);
}
function bkValidate(save) {   // 값 범위 검사 → 문제가 있으면 한국어 이유를 돌려준다 (없으면 '')
  if (!save || !Array.isArray(save.accounts) || !save.accounts.length) return '계정이 없습니다';
  if (save.accounts.length > MAX_ACC) return '계정이 ' + MAX_ACC + '개를 넘습니다';
  const ids = new Set();
  for (const a of save.accounts) {
    if (!a || typeof a.id !== 'string' || !a.id || a.id.length > 40 || ids.has(a.id)) return '계정 정보가 올바르지 않습니다';
    ids.add(a.id);
    if (typeof a.name !== 'string' || !a.name || a.name.length > 40) return '계정 이름이 올바르지 않습니다';
    if (!a.heroes || typeof a.heroes !== 'object' || Array.isArray(a.heroes)) return '영웅 기록이 없습니다';
    for (const k in a.heroes) {
      const h = a.heroes[k];
      if (!/^[a-z0-9_]{1,20}$/.test(k) || !h || !Number.isFinite(h.lv) || h.lv < 1 || h.lv > MAX_LV || !Number.isFinite(h.xp) || h.xp < 0) return '영웅 레벨 값이 범위를 벗어났습니다';
    }
    for (const f of ['runs', 'wins', 'best']) if (a[f] != null && (!Number.isFinite(a[f]) || a[f] < 0)) return '기록 값이 올바르지 않습니다';
  }
  return '';
}
function bkParse(txt) {   // → { ok, save, info } 또는 { ok:false, why }
  try {
    let s = String(txt || '').replace(/\s+/g, ''); const i = s.indexOf(BK_PREFIX); if (i < 0) return { ok: false, why: '백업 코드가 아닙니다 (SGB1. 로 시작해야 합니다)' };
    s = s.slice(i + BK_PREFIX.length);
    const j = JSON.parse(bkDec(s));
    if (!j || j.k !== 'sgb-save' || j.v !== 1 || !j.save) return { ok: false, why: '지원하지 않는 형식입니다' };
    if (bkHash(JSON.stringify(j.save)) !== j.chk) return { ok: false, why: '코드가 중간에 잘렸거나 바뀌었습니다 (체크섬 불일치) — 전체를 다시 복사해 주세요' };
    const why = bkValidate(j.save); if (why) return { ok: false, why };
    return { ok: true, save: j.save, info: { game: j.game, t: j.t, n: j.save.accounts.length, names: j.save.accounts.map(a => a.name).join(', ') } };
  } catch (_) { return { ok: false, why: '코드를 읽지 못했습니다 — 전체를 다시 복사해 주세요' }; }
}
function bkApply(save) {   // 교체 직전 상태를 prev 에 보관하고 적용
  try { const cur = localStorage.getItem(SAVE_KEY); if (cur) localStorage.setItem(BK_PREV, cur); } catch (_) { }
  SAVE = save; ACC = SAVE.accounts.find(a => a.id === SAVE.last) || null; saveSave(); saveBootSnap();
}
function bkRestorePrev() {
  try { const j = JSON.parse(localStorage.getItem(BK_PREV)); if (!j || bkValidate(j)) return false; const cur = localStorage.getItem(SAVE_KEY); SAVE = j; ACC = SAVE.accounts.find(a => a.id === SAVE.last) || null; saveSave(); if (cur) localStorage.setItem(BK_PREV, cur); return true; } catch (_) { return false; }
}

// ----- 화면: 버튼(캔버스) + 창(DOM, 폰에서 길게 눌러 복사·붙여넣기 가능) -----
function drawBackupBtns() {
  for (const [b, label] of [[BK_EXPORT, '백업 내보내기'], [BK_IMPORT, '백업 가져오기']]) { ctx.fillStyle = 'rgba(10,12,20,.9)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = '#9ad4ff'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x, b.y, b.w, b.h); text(label, b.x + b.w / 2, b.y + 21, 14, '#9ad4ff', 'center'); }
}
function backupClick(x, y) { if (inRect(x, y, BK_EXPORT)) { bkOpen('export'); return true; } if (inRect(x, y, BK_IMPORT)) { bkOpen('import'); return true; } return false; }
function bkClose() { if (BK_POP) { try { BK_POP.remove(); } catch (_) { } BK_POP = null; } }
function bkOpen(kind) {
  bkClose();
  const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:5%;top:6%;width:90%;max-width:660px;background:#10121c;border:2px solid #ffd34d;padding:12px;z-index:99999;color:#fff;font:14px sans-serif;box-sizing:border-box';
  const mk = (tag, css, txt) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; };
  const btn = (txt, fn) => { const b = mk('button', 'margin:8px 8px 0 0;padding:9px 18px;font-size:15px', txt); b.onclick = fn; return b; };
  const msg = mk('div', 'margin-top:8px;min-height:20px;color:#ffe9a0;white-space:pre-wrap');
  const ta = mk('textarea', 'width:100%;height:150px;box-sizing:border-box;background:#fff;color:#000;font:12px monospace');
  if (kind === 'export') {
    d.append(mk('div', 'font-size:18px;color:#ffe9a0;margin-bottom:6px', '백업 내보내기'), mk('div', 'margin-bottom:6px;color:#cfd3e6', '아래 코드 전체를 복사해 메신저·메모 등에 보관하세요. 폰을 바꾸거나 앱을 지운 뒤 [백업 가져오기]에 붙여 넣으면 계정과 영웅 성장이 복원됩니다.'));
    ta.value = bkMake(); ta.readOnly = true; d.append(ta);
    d.append(btn('복사', () => { ta.focus(); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (_) { } const fin = o => { msg.textContent = o ? '복사됨 (계정 ' + SAVE.accounts.length + '개)' : '자동 복사가 안 됩니다 — 위 글을 길게 눌러 직접 복사해 주세요'; }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(() => fin(true), () => fin(ok)); else fin(ok); }));
  } else {
    d.append(mk('div', 'font-size:18px;color:#ffe9a0;margin-bottom:6px', '백업 가져오기'), mk('div', 'margin-bottom:6px;color:#ff9a8a', '현재 계정·성장 기록이 백업 내용으로 교체됩니다. (교체 직전 상태는 한 번 보관되어 되돌릴 수 있습니다)'));
    ta.placeholder = '여기에 SGB1. 로 시작하는 백업 코드를 붙여 넣으세요'; d.append(ta);
    let armed = null;
    const go = btn('가져오기', () => {
      const r = bkParse(ta.value); if (!r.ok) { armed = null; go.textContent = '가져오기'; msg.textContent = '❌ ' + r.why; return; }
      if (!armed || armed !== ta.value) { armed = ta.value; go.textContent = '정말 교체하기'; msg.textContent = '백업: 계정 ' + r.info.n + '개 (' + r.info.names + ') · 게임 ' + r.info.game + ' · ' + String(r.info.t).replace('T', ' ') + '\n현재: 계정 ' + SAVE.accounts.length + '개 — 한 번 더 누르면 교체합니다'; return; }
      bkApply(r.save); armed = null; go.textContent = '가져오기'; msg.textContent = '✅ 가져왔습니다 — 계정 ' + r.info.n + '개. 계정 선택 창에서 확인하세요.'; sfx('skill');
    });
    d.append(go);
    let hasPrev = false; try { hasPrev = !!localStorage.getItem(BK_PREV); } catch (_) { }
    if (hasPrev) d.append(btn('직전 상태로 되돌리기', () => { msg.textContent = bkRestorePrev() ? '✅ 직전 상태로 되돌렸습니다' : '❌ 되돌릴 수 없습니다'; }));
  }
  d.append(btn('닫기', bkClose), msg); document.body.appendChild(d); BK_POP = d; try { ta.focus(); if (kind === 'export') ta.select(); } catch (_) { }
}
