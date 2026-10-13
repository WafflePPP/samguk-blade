'use strict';
// ===== 튜토리얼: 각 모드에 처음 들어갈 때(또는 로비의 '튜토리얼 다시 보기') 진행 =====
//  전투 중 안내 패널에 따라 이동·공격·스킬·회피·궁극기·태그(또는 조작 변경)·AUTO 를 직접 해본다. 진행 중에는 무적이고 적은 가만히 서 있다.
//  끝나거나 건너뛰면 계정에 기록하고(ACC.tut) 전투를 처음부터 정상 시작한다.
const tutNeeded = m => !!ACC && !(ACC.tut && ACC.tut[m]);
function tutSteps(m) {
  const S = [
    { id: 'move', ev: 'move', n: 1.2, t: () => IS_TOUCH ? '왼쪽 화면을 드래그해서 이동하세요' : 'WASD 또는 방향키로 이동하세요', h: () => '이동하는 동안 영웅이 가는 방향을 바라봅니다. 이동은 적의 공격 범위를 피하는 기본 수단입니다.' },
    { id: 'attack', ev: 'attack', n: 3, btn: 'attack', t: () => '공격 버튼을 3번 눌러 3단 콤보를 해보세요' + (IS_TOUCH ? '' : '  (J / 클릭)'), h: () => '1 → 2 → 3단계로 이어지고, 3단 공격이 적에게 맞으면 영웅 고유 버프가 켜집니다. ' + HERO.sub },
    { id: 's1', ev: 's1', n: 1, btn: 's1', t: () => '스킬1 — ' + HERO.skills.s1 + (IS_TOUCH ? '' : '  (K)'), h: () => (HERO.info[1] ? HERO.info[1][2] : '') },
    { id: 's2', ev: 's2', n: 1, btn: 's2', t: () => '스킬2 — ' + HERO.skills.s2 + (IS_TOUCH ? '' : '  (L)'), h: () => (HERO.info[2] ? HERO.info[2][2] : '') },
    { id: 'dash', ev: 'dash', n: 1, btn: 'dash', t: () => '회피' + (IS_TOUCH ? ' 버튼을 눌러보세요' : '  (Space) 를 눌러보세요'), h: () => '짧게 무적이 되며 빠르게 이동합니다. 쿨타임 ' + dashCdNow() + '초 — 적의 붉은 범위가 보이면 먼저 이동으로 피하고, 급할 때 회피를 쓰세요.' },
    { id: 's3', ev: 's3', n: 1, btn: 's3', pre: () => { P.rage = 100; }, t: () => '궁극기 — ' + HERO.skills.s3 + (IS_TOUCH ? '' : '  ( ; )'), h: () => '궁극기는 쿨타임(' + ULT_CD + '초)마다 쓸 수 있습니다. 튜토리얼에서는 바로 쓸 수 있도록 충전해 두었습니다.' },
  ];
  if (m === 'yeonui' && TEAM.length >= 2) S.push({ id: 'tag', ev: 'tag', n: 1, btn: 'tag', t: () => '태그 — 다른 영웅으로 교체' + (IS_TOUCH ? ' (왼쪽 TAG 버튼)' : '  (Z / X / C)'), h: () => '체력과 궁극기 쿨타임은 함께 쓰고, 스킬 쿨타임은 영웅마다 따로 흐릅니다. 교체하면 태그 스킬이 바로 나갑니다.' });
  if ((m === 'duel' || m === 'raid') && allies.length) S.push({ id: 'swap', ev: 'swap', n: 1, btn: 'swap', t: () => '조작 영웅 변경 — 아군을 직접 조작' + (IS_TOUCH ? ' (왼쪽 위 초상화를 누르기)' : '  (Q 또는 왼쪽 위 초상화 클릭)'), h: () => '체력·궁극기 게이지·쿨타임은 그대로 넘어가고, 순서 목록은 바뀌지 않습니다.' });
  S.push({ id: 'auto', ev: 'auto', n: 1, btn: 'auto', t: () => 'AUTO' + (IS_TOUCH ? ' 버튼' : '  (T)') + ' — 자동 전투를 켜 보세요', h: () => m === 'duel' ? '자동 회피·공격·스킬·궁극기를 AI 영웅과 같은 규칙으로 사용합니다. 직접 움직이면 해제됩니다.' : '자동으로 적을 쫓아 공격·회피하며, 체력이 10% 이하가 되면 자동으로 태그합니다. 직접 움직이면 해제됩니다.', pre: () => { } });
  S.push({ id: 'info', ev: 'ok', n: 1, ok: true, pre: () => { auto = false; }, t: () => m === 'duel' ? '비무장 모드 규칙' : m === 'raid' ? '레이드 모드 규칙' : '로그라이크 모드 규칙', lines: () => m === 'raid'
    ? ['내가 1명을 직접 조작, 나머지 PC는 AI 동료입니다 (태그 없음). Q·초상화로 조작 변경', '보스는 체력이 줄수록 단계가 올라 강해집니다 (여포 8단계 · 전위 5단계)', '붉은 범위는 이동·회피(Space)로 피하세요. 범위 안의 AI 동료도 함께 맞습니다', '아이콘을 누르면 상세 정보 · 보스는 상태 이상 저항이 있어 스턴이 점점 짧아집니다']
    : m === 'duel'
    ? ['고른 인원수(1~3명)만큼 적도 같은 수가 나옵니다. 모든 AI 영웅은 같은 규칙으로 싸웁니다.', '제한 시간 3분 — 시간이 끝나면 남은 체력 합계로 승패가 갈립니다.', 'M 키 또는 미터기 제목을 누르면 주는 피해·받은 피해 표를 접고 펼 수 있습니다.', '레벨 보정은 같은 영웅끼리 같은 레벨(내 계정 기준)로 적용되며, 경험치는 얻지 않습니다.']
    : ['5웨이브마다(5·10·15…) 능력치 강화 3개 중 1개를 고릅니다 (10초 뒤 자동 선택).', '5층마다 보스가 나옵니다 (10 관우 · 25 조운 · 50 여포). 보스 공격의 붉은 범위는 이동이나 회피로 피할 수 있습니다.', '경험치와 레벨은 이 모드에서만 얻습니다. Lv 1·5·10·15·20·25·30 에 영웅 고유 성장 단계가 열립니다.', '여포는 K 로 상마 ↔ 하마를 전환합니다 (스킬2 쿨타임은 폼마다 따로 흐릅니다).'] });
  return S;
}
function tutBegin(m) {
  TUT = { mode: m, steps: tutSteps(m), i: 0, prog: 0, fade: 0 }; auto = false;
  if (m === 'yeonui' || m === 'raid') {   // 웨이브(보스)를 시작하지 않고, 가만히 서 있는 허수아비 3기만 둔다 (레이드는 동료 AI 도 가만히)
    enemies = []; spawnQ = []; pendingSpawn = false; spawnT = 99; bannerT = 0; projectiles = [];
    for (let k = 0; k < 3; k++) { const e = makeEnemy('soldier', P.x + 230 + (k % 2) * 60, P.y - 120 + k * 120); e.hp = e.maxhp = 1e9; e.freeze = 1e12; e.spawnT = 0; enemies.push(e); }
    if (m === 'raid') tutFreeze();
  } else tutFreeze();
  const s = TUT.steps[0]; if (s.pre) s.pre();
}
function tutFreeze() { for (const f of [...allies, ...enemies]) if (f.fighter) { f.freeze = 1e12; f.hp = f.maxhp = 1e9; } }
function tutEvent(name, v = 1) {
  const s = TUT && TUT.steps[TUT.i]; if (!s || TUT.fade > 0 || s.ev !== name) return;
  TUT.prog += v; if (TUT.prog >= s.n) { TUT.fade = 0.8; sfx('heal'); }
}
function tutUpdate(dt) {
  if (!TUT) return;
  if (mode === 'duel' || TUT.mode === 'raid') for (const f of [...allies, ...enemies]) if (f.fighter && f.freeze < 1e11) { f.freeze = 1e12; f.hp = f.maxhp = Math.max(f.maxhp, 1e9); }   // 조작 변경 뒤에도 가만히
  if (TUT.fade > 0) { TUT.fade -= dt; if (TUT.fade <= 0) { TUT.i++; TUT.prog = 0; const s = TUT.steps[TUT.i]; if (!s) tutEnd(false); else if (s.pre) s.pre(); } }
}
function tutEnd(skipped) {
  const m = TUT ? TUT.mode : mode; TUT = null; auto = false;
  if (ACC) { ACC.tut = ACC.tut || {}; ACC.tut[m] = true; saveSave(); }
  restartMode();
}
const TUT_SKIP = { x: W / 2 + 280, y: 92, w: 120, h: 26 }, TUT_OK = { x: W / 2 - 90, y: 312, w: 180, h: 36 };
function tutClick(x, y) {
  if (!TUT) return false;
  if (inRect(x, y, TUT_SKIP)) { tutEnd(true); return true; }
  const s = TUT.steps[TUT.i]; if (s && s.ok && inRect(x, y, TUT_OK)) { tutEvent('ok'); return true; }
  return false;
}
const tutBtnRect = i => ({ x: W / 2 - 140, y: 408 + i * 44, w: 280, h: 36 });   // 도움말 창 안의 튜토리얼 버튼
function drawTutorial() {
  if (!TUT || state !== 'play') return; const s = TUT.steps[TUT.i]; if (!s) return;
  const big = !!s.ok, pw = 900, px = W / 2 - pw / 2, py = 86, ph = big ? 270 : 92;
  ctx.save(); ctx.fillStyle = 'rgba(10,12,20,.9)'; ctx.fillRect(px, py, pw, ph); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2.5; ctx.strokeRect(px, py, pw, ph);
  text('튜토리얼  ' + (TUT.i + 1) + ' / ' + TUT.steps.length, px + 16, py + 22, 14, '#ffd34d', 'left');
  const b = TUT_SKIP; ctx.fillStyle = 'rgba(40,20,20,.9)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = '#ff9a8a'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x, b.y, b.w, b.h); text('건너뛰기' + (IS_TOUCH ? '' : ' (Esc)'), b.x + b.w / 2, b.y + 18, 13, '#ffb4a8', 'center');
  text(s.t(), W / 2, py + 54, big ? 26 : 24, '#fff', 'center');
  if (!big) {
    text(fitStr(s.h() || '', pw - 40, 13), W / 2, py + 80, 13, '#cfd3e6', 'center', false);
    if (s.n > 1) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(px + 16, py + ph - 8, pw - 32, 5); ctx.fillStyle = '#4fd36a'; ctx.fillRect(px + 16, py + ph - 8, (pw - 32) * clamp(TUT.prog / s.n, 0, 1), 5); }
  } else {
    s.lines().forEach((ln, k) => text(fitStr('•  ' + ln, pw - 60, 15), px + 30, py + 100 + k * 34, 15, '#dfe3f5', 'left', false));
    const o = TUT_OK; ctx.fillStyle = 'rgba(30,60,30,.95)'; ctx.fillRect(o.x, o.y, o.w, o.h); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 2.5; ctx.strokeRect(o.x, o.y, o.w, o.h); text('시작하기' + (IS_TOUCH ? '' : ' (Enter)'), o.x + o.w / 2, o.y + 27, 20, '#9dff9d', 'center');
  }
  // 눌러야 할 버튼 강조
  let hx = null, hy = null, hr = 40;
  if (s.btn && BTN.find(q => q.id === s.btn)) { const q = BTN.find(q2 => q2.id === s.btn); hx = q.x; hy = q.y; hr = q.r + 10; }
  else if (s.btn === 'tag' && TEAM.length > 1) { const q = tagBtnPos(1); hx = q.x; hy = q.y; hr = TAG_BTN_R + 10; }
  else if (s.btn === 'swap' && (duel || RAID)) { hx = DUEL_ROW.x + 100; hy = DUEL_ROW.y + DUEL_ROW.step + 19; hr = 34; }
  if (hx != null && TUT.fade <= 0) { const k = 0.5 + 0.5 * Math.sin(T * 8); ctx.strokeStyle = `rgba(255,243,120,${0.5 + 0.5 * k})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(hx, hy, hr + k * 8, 0, TAU); ctx.stroke(); text('▼ 여기', hx, hy - hr - 14, 15, '#ffe14a', 'center', true); }
  if (TUT.fade > 0) { text('✔ 완료!', W / 2, py + ph + 36, 30, '#7dff9a', 'center'); }
  ctx.restore();
}
// ===== 장수 정보 페이지 (로비 > 장수 정보): PC 별 능력치 · 스킬 · 고유 성장 단계를 한눈에 보고, 레벨을 바꿔 가며 성장 결과를 미리 본다 =====
const INFO_BTN = { x: W / 2 - 491 + 3 * 250, y: 616, w: 232, h: 84 }, INFO_BACK = { x: 12, y: 664, w: 80, h: 30 };
let infoSel = 0, infoLv = 1;
const infoPc = () => HERO_IDS[infoSel];
const infoTab = i => ({ x: 40 + i * 201, y: 82, w: 195, h: 46 });
const INFO_CTL = { m5: { x: 56, y: 304, w: 40, h: 30 }, m1: { x: 100, y: 304, w: 40, h: 30 }, box: { x: 144, y: 304, w: 90, h: 30 }, p1: { x: 238, y: 304, w: 40, h: 30 }, p5: { x: 282, y: 304, w: 40, h: 30 }, cur: { x: 326, y: 304, w: 54, h: 30 } };
let infoTabR = 0, eqPick = null;   // 오른쪽 패널 탭 (0 영웅 성장 / 1 장비) · 장비 선택 팝업 { slot, page }
const INFO_RTAB = i => ({ x: 876 + i * 178, y: 148, w: 172, h: 28 }), EQ_ROW = i => ({ x: 876, y: 206 + i * 84, w: 354, h: 76 });
const EQP = { x: W / 2 - 340, y: 100, w: 680, h: 500 }, EQP_ROWS = 7, EQP_ROW = i => ({ x: EQP.x + 20, y: EQP.y + 70 + i * 52, w: EQP.w - 40, h: 46 }), EQP_PREV = { x: EQP.x + 20, y: EQP.y + EQP.h - 52, w: 90, h: 36 }, EQP_NEXT = { x: EQP.x + 120, y: EQP.y + EQP.h - 52, w: 90, h: 36 }, EQP_OFF = { x: EQP.x + EQP.w - 250, y: EQP.y + EQP.h - 52, w: 110, h: 36 }, EQP_CLOSE = { x: EQP.x + EQP.w - 130, y: EQP.y + EQP.h - 52, w: 110, h: 36 };
const eqList = slot => { const d = eqData(ACC); return d ? d.inv.filter(it => it.slot === slot).sort((a, b) => b.rar - a.rar || eqScore(b) - eqScore(a)) : []; };
function drawEquipTab(R, id) {
  const worn = eqWornIds(id), tot = equipFlat(id), d = eqData(ACC);
  text('장비 3종 착용  (눌러서 변경)', R.x + 16, R.y + 56, 13, '#ffd34d', 'left');
  for (let i = 0; i < 3; i++) {
    const r = EQ_ROW(i), it = worn[i] != null ? eqItem(worn[i]) : null, rc = it ? EQ_RAR[it.rar].c : '#6c7288';
    ctx.fillStyle = it ? 'rgba(30,24,44,.92)' : 'rgba(255,255,255,.04)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = rc; ctx.lineWidth = it ? 2 : 1.5; if (!it) ctx.setLineDash([6, 5]); ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]);
    text(EQ_SLOTS[i], r.x + 12, r.y + 20, 12, '#9ad4ff', 'left');
    if (it) { text(it.name, r.x + 12, r.y + 44, 17, rc, 'left'); text(EQ_RAR[it.rar].n, r.x + r.w - 12, r.y + 20, 12, rc, 'right'); text(fitStr(eqStatText(it), r.w - 24, 12.5), r.x + 12, r.y + 64, 12.5, '#e6e9f5', 'left', false); }
    else text('비어 있음  —  눌러서 장착', r.x + 12, r.y + 50, 14, '#8a90a6', 'left', false);
  }
  const yy = EQ_ROW(3).y + 4;
  text('장비 효과 합계', R.x + 16, yy + 6, 13, '#ffd34d', 'left');
  text('체력 +' + tot.hp + '   ·   공격력 +' + +tot.atk.toFixed(1) + '   ·   방어력 +' + +tot.def.toFixed(1), R.x + 16, yy + 28, 14, tot.hp + tot.atk + tot.def > 0 ? '#9dff9d' : '#8a90a6', 'left', false);
  text('보유 장비 ' + (d ? d.inv.length : 0) + ' / ' + EQ_MAX + '  ·  장비는 레이드 모드에서만 획득', R.x + 16, yy + 50, 11.5, '#9aa3b8', 'left', false);
  text('온라인 대전에서는 장비가 적용되지 않습니다', R.x + 16, yy + 68, 11, '#7a8196', 'left', false);
}
function drawEqPicker() {
  if (!eqPick) return; const slot = eqPick.slot, list = eqList(slot), pages = Math.max(1, Math.ceil(list.length / EQP_ROWS)), id = infoPc(), cur = eqWornIds(id)[slot];
  eqPick.page = clamp(eqPick.page, 0, pages - 1);
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = 'rgba(14,10,26,.97)'; ctx.fillRect(EQP.x, EQP.y, EQP.w, EQP.h); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3; ctx.strokeRect(EQP.x, EQP.y, EQP.w, EQP.h);
  text(EQ_SLOTS[slot] + ' 선택  ·  ' + PC_NAME[id], EQP.x + 20, EQP.y + 40, 24, '#ffe9a0', 'left'); text('아이템을 누르면 장착합니다 (다른 영웅이 착용 중이면 옮겨 옵니다)', EQP.x + 20, EQP.y + 60, 12, '#9aa3b8', 'left', false);
  list.slice(eqPick.page * EQP_ROWS, eqPick.page * EQP_ROWS + EQP_ROWS).forEach((it, i) => {
    const r = EQP_ROW(i), rc = EQ_RAR[it.rar].c, wr = eqWearer(it.id), mine = cur === it.id;
    ctx.fillStyle = mine ? 'rgba(60,44,16,.9)' : 'rgba(30,24,44,.9)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = mine ? '#ffd34d' : rc; ctx.lineWidth = mine ? 2.5 : 1.5; ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.fillStyle = rc; ctx.fillRect(r.x, r.y, 6, r.h);
    text(it.name, r.x + 18, r.y + 29, 17, rc, 'left'); text(EQ_RAR[it.rar].n, r.x + 200, r.y + 29, 12, rc, 'left', false); text(fitStr(eqStatText(it), 300, 13), r.x + 262, r.y + 29, 13, '#e6e9f5', 'left', false);
    if (mine) text('착용 중', r.x + r.w - 12, r.y + 29, 13, '#ffd34d', 'right'); else if (wr) text(PC_NAME[wr] + ' 착용', r.x + r.w - 12, r.y + 29, 12.5, '#9ad4ff', 'right', false);
  });
  if (!list.length) text('보유한 ' + EQ_SLOTS[slot] + '이(가) 없습니다  —  레이드 모드에서 획득하세요', EQP.x + EQP.w / 2, EQP.y + 220, 16, '#aab3c8', 'center', false);
  const btn = (b, label, col, dis) => { ctx.globalAlpha = dis ? 0.4 : 1; ctx.fillStyle = 'rgba(10,12,20,.92)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h); text(label, b.x + b.w / 2, b.y + 24, 15, col, 'center'); ctx.globalAlpha = 1; };
  btn(EQP_PREV, '◀ 이전', '#9ad4ff', eqPick.page <= 0); btn(EQP_NEXT, '다음 ▶', '#9ad4ff', eqPick.page >= pages - 1); text((eqPick.page + 1) + ' / ' + pages, EQP.x + 240, EQP.y + EQP.h - 28, 13, '#cfd3e6', 'left', false);
  btn(EQP_OFF, '해제', '#ff9a8a', cur == null); btn(EQP_CLOSE, '닫기', '#cfd3e6', false);
}
function eqPickClick(x, y) {
  const slot = eqPick.slot, list = eqList(slot), pages = Math.max(1, Math.ceil(list.length / EQP_ROWS)), id = infoPc();
  if (inRect(x, y, EQP_CLOSE) || !inRect(x, y, EQP)) { eqPick = null; return; }
  if (inRect(x, y, EQP_PREV)) { eqPick.page = Math.max(0, eqPick.page - 1); return; } if (inRect(x, y, EQP_NEXT)) { eqPick.page = Math.min(pages - 1, eqPick.page + 1); return; }
  if (inRect(x, y, EQP_OFF) && eqWornIds(id)[slot] != null) { eqUnequip(id, slot); eqPick = null; return; }
  for (let i = 0; i < EQP_ROWS; i++) { const it = list[eqPick.page * EQP_ROWS + i]; if (it && inRect(x, y, EQP_ROW(i))) { eqEquip(id, slot, it.id); eqPick = null; return; } }
}
function openInfo() { state = 'info'; mode = 'yeonui'; infoSel = Math.max(0, HERO_IDS.indexOf(curHero)); infoLv = ACC ? heroLv(infoPc()) : 1; }
function infoSetLv(v) { infoLv = clamp(v, 1, MAX_LV); }
function infoSelect(i) { eqPick = null; infoSel = clamp(i, 0, HERO_IDS.length - 1); infoLv = ACC ? heroLv(infoPc()) : 1; sfx('hit'); }
function infoClick(x, y) {
  if (eqPick) { eqPickClick(x, y); return; }
  for (let i = 0; i < 2; i++) if (inRect(x, y, INFO_RTAB(i))) { infoTabR = i; sfx('hit'); return; }
  if (infoTabR === 1) for (let i = 0; i < 3; i++) if (inRect(x, y, EQ_ROW(i))) { eqPick = { slot: i, page: 0 }; sfx('hit'); return; }
  if (inRect(x, y, INFO_BACK)) { state = 'title'; return; }
  for (let i = 0; i < HERO_IDS.length; i++) if (inRect(x, y, infoTab(i))) { infoSelect(i); return; }
  const c = INFO_CTL;
  if (inRect(x, y, c.m5)) infoSetLv(infoLv - 5); else if (inRect(x, y, c.m1)) infoSetLv(infoLv - 1); else if (inRect(x, y, c.p1)) infoSetLv(infoLv + 1); else if (inRect(x, y, c.p5)) infoSetLv(infoLv + 5); else if (inRect(x, y, c.cur)) infoSetLv(ACC ? heroLv(infoPc()) : 1);
  else if (inRect(x, y, c.box)) infoSetLv(infoLv >= MAX_LV ? 1 : MAX_LV);   // 가운데 칸: 1 <-> 최대 레벨
}
function infoKey(code) {
  if (eqPick) { if (code === 'Escape' || code === 'Enter') eqPick = null; return; }
  if (code === 'KeyE' || code === 'Tab') { infoTabR = 1 - infoTabR; return; }
  if (code === 'Escape' || code === 'Enter' || code === 'KeyI') { state = 'title'; return; }
  if (code === 'ArrowLeft' || code === 'KeyA') infoSelect(infoSel - 1); else if (code === 'ArrowRight' || code === 'KeyD') infoSelect(infoSel + 1);
  else if (/^Digit[1-6]$/.test(code)) infoSelect(+code.slice(5) - 1);
  else if (code === 'ArrowUp' || code === 'KeyW') infoSetLv(infoLv + 1); else if (code === 'ArrowDown' || code === 'KeyS') infoSetLv(infoLv - 1);
  else if (code === 'PageUp') infoSetLv(infoLv + 5); else if (code === 'PageDown') infoSetLv(infoLv - 5);
}
function infoBuffLines(id, lv) {   // 조건부 버프 (미리보기 레벨의 성장 수치가 적용된 값)
  const pc = (v, base = 1) => Math.round((v - base) * 100) + '%';
  if (id === 'guan') return ['3단 공격 성공: 방어력 +' + Math.round(HEROES.guan.guard.bonus * 100) + '% (' + HEROES.guan.guard.dur + '초)', '청룡의 힘 사용: 방어력 +' + Math.round(HEROES.guan.ultGuard * 100) + '% (' + HEROES.guan.ultGuardDur + '초)'];
  if (id === 'lubu') return ['(상마) 3단 공격 성공: 이동속도 +' + pc(HEROES.lubu.runBonus) + ' (' + HEROES.lubu.runDur + '초, 이동하면 유지)', '(상마) 적토 돌격 후: 공격력 +' + pc(HEROES.lubu.postUltAtk) + ' (' + HEROES.lubu.postUltDur + '초)', '(상마) 50 HIT부터 10 HIT마다 공속·피해 +1%', '(하마) 3단 콤보 완주: 공격력 +' + pc(HEROES.lubu2.comboBuff.atk) + ' (' + HEROES.lubu2.comboBuff.dur + '초)', '(하마) 천하무쌍 후: 공격력 +' + pc(HEROES.lubu2.postUltAtk) + ' (' + HEROES.lubu2.postUltDur + '초)'];
  if (id === 'huang') return ['3단 공격 성공: 공속 +' + Math.round((HEROES.huang.aspdBuff.mult - 1) * 100) + '% (' + HEROES.huang.aspdBuff.dur + '초)', '[고유] 저격: 멀수록 피해 증가 (공격 +' + Math.round(HUANG_FAR * 100) + '% · 백보천양 +40%)', '[고유] 이동 사격 (이동속도 50%) · 백보천양은 후퇴하며 시전', '화살비: 맞은 적 이동속도 -45% (1.5초)', '수정화살: 거리에 비례해 기절 1 ~ 3.5초 · 보스는 최대 2초'];
  if (id === 'dian') return ['3단 공격 성공: 공격력 +' + Math.round((HEROES.dian.comboBuff.atk - 1) * 100) + '% (' + HEROES.dian.comboBuff.dur + '초)', '불사의 광기: 전투당 1회 ' + HEROES.dian.undy.floor + '초간 죽지 않음 (생명력 1 보호)', '불사의 광기: 시전마다 ' + HEROES.dian.undy.dur.toFixed(1) + '초간 공격력 +' + Math.round((HEROES.dian.undy.atk - 1) * 100) + '% · 피해의 ' + Math.round(HEROES.dian.undy.ls * 100) + '% 생명력 흡수', '[고유] 상태 이상 저항: 경직·스턴·둔화의 지속시간 100→80→60→40→20%', '[고유] 저항은 5회째부터 60초 뒤 초기화 (보스 여포도 같은 고유 능력)'];
  if (id === 'diao') return ['3단 공격 성공: 주변 아군 생명력 +' + +(DIAO_HEAL.combo * HEAL_POW * 100).toFixed(1) + '% 회복', '연꽃 치유: 범위 아군 생명력 +' + +(DIAO_HEAL.pulse * HEAL_POW * 100).toFixed(1) + '% x ' + DIAO_S1_TIMES.length + '회 (비무장: 자신 x' + DUEL_HEAL_MUL + ' / 다른 아군 x' + DUEL_HEAL_OTHER + ')', '월하 축복: 아군 전체 공격력 +' + Math.round(BLESS_ATK * 100) + '% · 방어력 +' + Math.round(BLESS_DEF * 100) + '% (' + BLESS_DUR + '초)', '경국지색: 범위 아군 생명력 +' + +(DIAO_HEAL.ult * ULT_HEAL_POW * 100).toFixed(1) + '% 회복 + 적 기절'];
  return ['3단 공격 성공: 공속 +' + pc(HEROES.zhao.aspdBuff.mult) + ' (' + HEROES.zhao.aspdBuff.dur + '초)', '백룡강림 후: 공속 +' + pc(HEROES.zhao.postUltAspd) + ' (' + HEROES.zhao.postUltDur + '초)'];
}
function infoRows(id, m) { const sv = mode; mode = m; applyGrowth(m); try { return heroSkillRows(id); } finally { mode = sv; } }   // 모드(로그라이크 / 비무장)별 스킬 수치
function drawInfo() {
  drawLoginScene(); ctx.fillStyle = 'rgba(6,4,14,.78)'; ctx.fillRect(0, 0, W, H);
  text('장수 정보', W / 2, 54, 36, '#ffd34d', 'center');
  text('능력치 · 스킬 · 고유 능력 · 영웅 성장  —  ← → 장수 선택  ·  ↑ ↓ 레벨 미리보기 (PageUp / PageDown ±5)', W / 2, 76, 13, '#cfd3e6', 'center', false);
  const id = infoPc(), g = GROWTH[id], rec = ACC ? heroRec(ACC, id) : { lv: 1, xp: 0 }, curLv = rec.lv;
  HERO_IDS.forEach((pid, i) => {   // 장수 탭
    const r = infoTab(i), on = i === infoSel, lvp = ACC ? heroLv(pid) : 1;
    ctx.fillStyle = on ? 'rgba(40,34,18,.95)' : 'rgba(10,12,20,.85)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = on ? '#ffd34d' : 'rgba(255,255,255,.3)'; ctx.lineWidth = on ? 3 : 1.5; ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.save(); ctx.beginPath(); ctx.arc(r.x + 26, r.y + 23, 18, 0, TAU); ctx.clip(); ctx.translate(r.x + 26, r.y + 27); ctx.scale(0.6, 0.6); drawPortraitIcon(HEROES[pid], 0, 0); ctx.restore();
    text(PC_NAME[pid], r.x + 54, r.y + 29, 18, on ? '#ffe9a0' : '#cfd3e6', 'left'); text('Lv ' + lvp, r.x + r.w - 12, r.y + 29, 15, lvp >= MAX_LV ? '#ffd34d' : '#9dff9d', 'right');
  });
  // 미리보기 레벨의 성장 수치를 실제 값에 적용한 채로 그린다 (로그라이크 / 비무장 각각)
  const old = rec.lv; rec.lv = infoLv; applyGrowth('yeonui');
  try {
    const rowsP = infoRows(id, 'yeonui'), rowsD = infoRows(id, 'duel'); applyGrowth('yeonui');
    // ---- 왼쪽: 프로필 + 능력치 + 성장 진행 ----
    const L = { x: 40, y: 142, w: 344, h: 514 }; ctx.fillStyle = 'rgba(12,14,24,.92)'; ctx.fillRect(L.x, L.y, L.w, L.h); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2; ctx.strokeRect(L.x, L.y, L.w, L.h);
    ctx.save(); ctx.beginPath(); ctx.arc(104, 214, 46, 0, TAU); ctx.clip(); ctx.translate(104, 214 + 6); ctx.scale(1.55, 1.55); drawPortraitIcon(HEROES[id], 0, 0); ctx.restore(); ctx.strokeStyle = '#d4a73a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(104, 214, 46, 0, TAU); ctx.stroke();
    text(PC_NAME[id], 166, 200, 28, '#ffe9a0', 'left'); text(fitStr(g.theme, 200, 13), 166, 224, 13, '#ffb27a', 'left', false);
    text('현재 Lv ' + curLv + (curLv >= MAX_LV ? ' (최대)' : '  ·  ' + rec.xp + ' / ' + xpNeed(curLv) + ' XP'), 166, 246, 13, '#cfd3e6', 'left', false);
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(166, 254, 200, 8); ctx.fillStyle = '#4fd36a'; ctx.fillRect(167, 255, 198 * (curLv >= MAX_LV ? 1 : rec.xp / xpNeed(curLv)), 6);
    text('성장 미리보기  (실제 레벨은 바뀌지 않습니다)', 56, 296, 13, '#ffd34d', 'left');
    const C = INFO_CTL; for (const [k, lab] of [['m5', '-5'], ['m1', '◀'], ['p1', '▶'], ['p5', '+5'], ['cur', '현재']]) { const b = C[k]; ctx.fillStyle = 'rgba(10,12,20,.9)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = '#9ad4ff'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x, b.y, b.w, b.h); text(lab, b.x + b.w / 2, b.y + 21, 14, '#9ad4ff', 'center'); }
    const bx = C.box; ctx.fillStyle = 'rgba(40,34,18,.95)'; ctx.fillRect(bx.x, bx.y, bx.w, bx.h); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2; ctx.strokeRect(bx.x, bx.y, bx.w, bx.h); text('Lv ' + infoLv, bx.x + bx.w / 2, bx.y + 22, 17, infoLv >= MAX_LV ? '#ffd34d' : '#fff', 'center');
    const m = flatOf(id, infoLv), eq = equipFlat(id), bs = { hp: HERO_STATS.hp, atk: HERO_STATS.atk, def: 0 };
    text('능력치', 56, 362, 14, '#ffd34d', 'left'); text('로그라이크·레이드', 262, 362, 12, '#ffb27a', 'right', false); text('비무장', 366, 362, 12, '#9ad4ff', 'right', false);
    FLAT_KEYS.forEach((k, j) => {
      const dv = k === 'hp' ? DUEL_HP + (m.hp + eq.hp) * DUEL_HP / HERO_STATS.hp : bs[k] + m[k] + eq[k], v = bs[k] + m[k] + eq[k], f = n => k === 'hp' ? fmtI(n) : +n.toFixed(1), yy = 388 + j * 26;
      text(FLAT_NAME[k], 56, yy, 15, '#fff', 'left', false); text(f(v), 262, yy, 16, m[k] + eq[k] > 0 ? '#9dff9d' : '#fff', 'right', false); text(f(dv), 366, yy, 16, m[k] + eq[k] > 0 ? '#9dff9d' : '#fff', 'right', false);
      text('기본 ' + (k === 'hp' ? fmtI(bs[k]) : bs[k]) + ' ' + fmtFlat(k, m[k]) + (eq[k] > 0 ? '  장비 ' + fmtFlat(k, eq[k]) : '') + (k === 'hp' ? '   (비무장은 체력 기준 6,000)' : k === 'def' ? '   (받는 피해 -' + (100 - 100 / (1 + m.def / 100)).toFixed(1) + '%)' : ''), 56, yy + 13, 10.5, '#8a90a6', 'left', false);
    });
    text('성장하지 않는 능력치 (두 모드 공통)', 56, 496, 13, '#cfd3e6', 'left');
    [['치명타 확률 / 피해', Math.round(CRIT_BASE * 100) + '%  /  x' + CRIT_BASE_DMG], ['이동속도', String(HERO_STATS.speed)], ['회피율 / 적중', PC_EVA + '%  /  ' + PC_ACC], ['회피 쿨타임 · 무적 · 거리 (모든 모드)', DASH_CD_PVE + '초 · ' + DASH_INV_PVE + '초 · +' + Math.round((DASH_DIST_PVE - 1) * 100) + '%'], ].forEach(([k, v], j) => { text(k, 56, 518 + j * 20, 13, '#aab3c8', 'left', false); text(v, 366, 518 + j * 20, 13, '#fff', 'right', false); });
    const nt = g.tiers.find(t => t.lv > infoLv);
    text(fitStr(nt ? '다음 성장 단계  Lv ' + nt.lv + ' [' + nt.name + ']' : '고유 성장 단계를 모두 해금', L.w - 32, 12), 56, 628, 12, nt ? '#9dff9d' : '#ffd34d', 'left', false);
    text('경험치: 로그라이크·레이드에서 획득 (판 종료 시 정산)', 56, 646, 11, '#7a8196', 'left', false);
    // ---- 가운데: 스킬 (로그라이크 / 비무장) ----
    const M = { x: 400, y: 142, w: 450, h: 514 }; ctx.fillStyle = 'rgba(12,14,24,.92)'; ctx.fillRect(M.x, M.y, M.w, M.h); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2; ctx.strokeRect(M.x, M.y, M.w, M.h);
    text('스킬  (Lv ' + infoLv + ' 성장 반영)', M.x + 16, M.y + 28, 16, '#ffd34d', 'left'); text('로그라이크·레이드 / 비무장 수치', M.x + M.w - 16, M.y + 28, 12, '#aab3c8', 'right', false);
    rowsP.forEach((row, j) => {
      const yy = M.y + 54 + j * 64, rd = rowsD[j] || row;
      text(fitStr(row.n, M.w - 32, 14), M.x + 16, yy, 14, j === 3 ? '#ffd34d' : '#ffe9a0', 'left');
      text(fitStr('로그라이크·레이드  ' + row.c1, M.w - 32, 12), M.x + 16, yy + 16, 12, '#fff', 'left', false);
      text(fitStr('비무장  ' + rd.c1, M.w - 32, 12), M.x + 16, yy + 31, 12, '#9ad4ff', 'left', false);
      text(fitStr(row.c2, M.w - 32, 11.5), M.x + 16, yy + 46, 11.5, '#ffb27a', 'left', false);
    });
    text('조건부 버프 · 고유 능력', M.x + 16, M.y + 322, 15, '#ffd34d', 'left');
    infoBuffLines(id, infoLv).forEach((ln, j) => text(fitStr('•  ' + ln, M.w - 32, 12.5), M.x + 16, M.y + 344 + j * 20, 12.5, '#dfe3f5', 'left', false));
    const HH = id === 'lubu' ? [HEROES.lubu, HEROES.lubu2] : [HEROES[id]];
    text('스킬 설명', M.x + 16, M.y + 470, 14, '#ffd34d', 'left');
    HH.forEach((h, hi) => text(fitStr((id === 'lubu' ? (hi ? '하마  ' : '상마  ') : '') + h.info.map(r => r[0] + ' ' + r[1]).join('  ·  '), M.w - 32, 11.5), M.x + 16, M.y + 490 + hi * 18, 11.5, '#aab3c8', 'left', false));
    // ---- 오른쪽: 영웅 성장 (고유 성장 단계) ----
    const R = { x: 866, y: 142, w: 374, h: 514 }; ctx.fillStyle = 'rgba(12,14,24,.92)'; ctx.fillRect(R.x, R.y, R.w, R.h); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2; ctx.strokeRect(R.x, R.y, R.w, R.h);
    ['영웅 성장', '장비'].forEach((nm, i) => { const t = INFO_RTAB(i), on = infoTabR === i; ctx.fillStyle = on ? 'rgba(212,167,58,.9)' : 'rgba(30,24,44,.9)'; ctx.fillRect(t.x, t.y, t.w, t.h); ctx.strokeStyle = on ? '#ffd34d' : 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.5; ctx.strokeRect(t.x, t.y, t.w, t.h); text(nm, t.x + t.w / 2, t.y + 20, 15, on ? '#2a1c06' : '#cfd3e6', 'center'); });
    if (infoTabR === 0) text(fitStr('Lv ' + infoLv + ' 누적: 체력 +' + m.hp + ' · 공격력 +' + m.atk + ' · 방어력 +' + m.def + ' · 스킬 성장 ' + g.tiers.filter(t => infoLv >= t.lv && (t.fx.dmg || t.fx.hits || t.fx.buff)).length + '개', R.w - 32, 11.5), R.x + 16, R.y + 46, 11.5, '#9dff9d', 'left', false);
    if (infoTabR === 0) g.tiers.forEach((t, j) => {
      const yy = R.y + 56 + j * 64, on = infoLv >= t.lv, cur = curLv >= t.lv, skill = !!(t.fx.dmg || t.fx.hits || t.fx.buff), stat = !!(t.fx.hp || t.fx.atk || t.fx.def);
      ctx.fillStyle = on ? 'rgba(60,200,90,.14)' : 'rgba(255,255,255,.04)'; ctx.fillRect(R.x + 10, yy, R.w - 20, 58); ctx.strokeStyle = on ? '#4fd36a' : 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.strokeRect(R.x + 10, yy, R.w - 20, 58);
      text('Lv ' + t.lv, R.x + 20, yy + 17, 13, on ? '#9dff9d' : '#7a8196', 'left'); text(t.name, R.x + 74, yy + 17, 14, on ? '#fff' : '#8a90a6', 'left');
      text((stat ? '능력치 ' : '') + (skill ? '스킬' : ''), R.x + R.w - 20, yy + 17, 11, on ? '#ffd34d' : '#6c7288', 'right');
      const parts = fxText(id, t.fx, '\n').split('\n'); parts.slice(0, 3).forEach((p, k) => text(fitStr(p, R.w - 40, 10.5), R.x + 20, yy + 31 + k * 12, 10.5, on ? '#cfeed6' : '#6c7288', 'left', false));
      if (cur) text('✔ 달성', R.x + R.w - 20, yy + 53, 10.5, '#7dff9a', 'right', false);
    });
    if (infoTabR === 1) drawEquipTab(R, id);
  } finally { rec.lv = old; applyGrowth('yeonui'); mode = 'yeonui'; }
  const b = INFO_BACK; ctx.fillStyle = 'rgba(10,12,20,.9)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = '#cfd3e6'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h); text('뒤로', b.x + b.w / 2, b.y + 21, 15, '#cfd3e6', 'center');
  drawEqPicker();
}
function applyGrowth(m) {
  m = m || mode; const on = !!ACC && (m === 'yeonui' || m === 'duel'), G = pc => growthFx(pc, on ? heroLv(pc) : 0);
  const gg = G('guan'), gl = G('lubu'), gz = G('zhao'), gd = G('diao'), gdn = G('dian'), ghz = G('huang'), src = { guan: gg, lubu: gl, lubu2: gl, zhao: gz, diao: gd, dian: gdn, huang: ghz };
  for (const id in src) {   // 스킬 피해량 +%
    const d = src[id].dmg, sc = b => ({ a: b.a * (1 + (d.a || 0)), s1: b.s1 * (1 + (d.s1 || 0)), s2: b.s2 * (1 + (d.s2 || 0)), u: b.u * (1 + (d.u || 0)) });
    HEROES[id]._balCur = { pve: sc(BAL_BASE[id].pve), duel: sc(BAL_BASE[id].duel) };
  }
  // 조건부 버프 수치
  HEROES.guan.guard.bonus = 0.5 + (gg.buff.guard || 0); HEROES.guan.ultGuard = 0.5 + (gg.buff.ultGuard || 0);
  HEROES.lubu.runBonus = 1.2 + (gl.buff.runBonus || 0); HEROES.lubu2.comboBuff.atk = 1.1 + (gl.buff.comboBuff || 0);
  HEROES.zhao.aspdBuff.mult = 1.10 + (gz.buff.aspdBuff || 0); HEROES.zhao.postUltAspd = 1.10 + (gz.buff.postUltAspd || 0);
  BLESS_ATK = 0.1 + (gd.buff.blessAtk || 0); BLESS_DEF = 0.1 + (gd.buff.blessDef || 0); HEAL_POW = 1 + (gd.buff.healPow || 0); ULT_HEAL_POW = HEAL_POW + (gd.buff.ultHeal || 0);
  HEROES.dian.undy.dur = 6 * (1 + (gdn.buff.undyDur || 0)); HEROES.dian.undy.atk = 1.3 + (gdn.buff.undyAtk || 0); DIAN_BLADES = 2 + (gdn.hits.dianS1 || 0);
  HEROES.huang.aspdBuff.mult = 1.12 + (ghz.buff.huangAspd || 0); HUANG_K = 1 + (ghz.hits.huangS1 || 0); RAIN_N = 4 + (ghz.hits.huangRain || 0); CRYSTAL_STUN_UP = ghz.buff.crystalStun || 0;
  DIAO_S1_N = 3 + (gd.hits.diaoS1 || 0); DIAO_S1_TIMES = Array.from({ length: DIAO_S1_N }, (_, i) => 0.12 + 0.18 * i);
  // 공격 횟수 (한 번의 피해는 그대로이므로 횟수만큼 총 피해가 늘어난다)
  GUAN_S1_N = 3 + (gg.hits.guanS1 || 0); GUAN_S1_TIMES = Array.from({ length: GUAN_S1_N }, (_, i) => 0.12 + 0.15 * i);
  const fn = 4 + (gz.hits.zhaoS1 || 0); FLURRY_TIMES = Array.from({ length: fn }, (_, i) => 0.08 + 0.075 * (i)); FLURRY_DUR = 0.08 + 0.075 * (fn - 1) + 0.14;
  ZU_H = ZU_H0 + (gz.hits.zhaoU || 0);
  LU_N = LU_N0 + (gl.hits.lubuQi || 0); LU_END = LU_TICK0 + LU_N * LU_IV + 0.15;
  const rn = 3 + (gl.hits.lubuRush || 0), R3 = RUSH_SPECS.three, B3 = GROW_BASE.rush; R3.n = rn; R3.wind = Array.from({ length: rn }, (_, i) => B3.wind[Math.min(i, B3.wind.length - 1)]); R3.dash = Array.from({ length: rn }, (_, i) => B3.dash[Math.min(i, B3.dash.length - 1)]);
  SHOOT_N = 3 + (gl.hits.lubuVolley || 0); SHOOT_TIMES = Array.from({ length: SHOOT_N }, (_, i) => 0.1 + 0.12 * i);
  SKD_CLEAR();
}
function SKD_CLEAR() { for (const k in SKD) delete SKD[k]; }
const CRIT_BASE = 0.2, CRIT_BASE_DMG = 1.8;   // 표기용 (치명타는 레벨로 성장하지 않음)
function fitStr(s, w, size) { ctx.font = '500 ' + size + 'px ' + FONT; if (ctx.measureText(s).width <= w) return s; while (s.length > 2 && ctx.measureText(s + '…').width > w) s = s.slice(0, -1); return s + '…'; }
function zultInit(u, list) {
  const tg = list.filter(e => !e.dead && dist(u, e) < ULT_RADIUS + e.r).sort((a, b) => dist(u, a) - dist(u, b)).slice(0, ZU_MAX);
  return { tg, n: tg.length * ZU_H, i: 0, seg: null };
}
function zultHitFx(u, tg) {
  const ca = Math.cos(u.face), sa = Math.sin(u.face);
  fx.push({ k: 'beam', hid: fxHeroNow, x: u.x + ca * 60, y: u.y - 14 + sa * 60, ang: u.face, len: 60, w: 20, t: 0, dur: 0.12 }); sparks(tg.x, tg.y - 20, 3, '#d8f0ff', 300, 0.25); if (Math.random() < 0.5) sfx('swing');
}
function zultStep(u, a, z, hitFn) {   // 한 프레임 진행. 끝나면 true
  while (z.i < z.n) {
    const t0 = ZU_WIND + z.i * ZU_IV;
    if (!z.seg) {
      const bi = Math.floor(z.i / ZU_BLOCK); let tg = null;
      for (let k = 0; k < z.tg.length && !tg; k++) { const c = z.tg[(bi + k) % z.tg.length]; if (!c.dead) tg = c; }
      if (!tg) { z.i = z.n; break; }
      const ang = z.i * 2.4 + 1, tx = tg.x + Math.cos(ang) * ZU_STAND, ty = tg.y + Math.sin(ang) * ZU_STAND * 0.8;
      z.seg = { fx: u.x, fy: u.y, tx, ty, tg };
      if (u === P && mode !== 'duel') slowT = Math.max(slowT, ZU_SLOW);   // 찌르기를 시작할 때마다 짧은 슬로 모션
      const l = Math.hypot(tx - u.x, ty - u.y), an = Math.atan2(ty - u.y, tx - u.x); if (l > 30) streak(u.x, u.y - 6, an + Math.PI, Math.min(l, 320), 5, 0.5, '#bfe8ff');
    }
    const s = z.seg, f = clamp((a.t - t0) / ZU_IV, 0, 1);
    u.x = s.fx + (s.tx - s.fx) * f; u.y = s.fy + (s.ty - s.fy) * f; u.face = Math.atan2(s.tg.y - u.y, s.tg.x - u.x); arenaClamp(u);
    { const px = z.lx == null ? s.fx : z.lx, py = z.ly == null ? s.fy : z.ly, dd = Math.hypot(u.x - px, u.y - py), n = Math.min(4, Math.max(1, Math.round(dd / 60))); for (let k = 1; k <= n; k++) ghost(px + (u.x - px) * k / n, py + (u.y - py) * k / n, u.face, u === P ? undefined : u.hero, { dur: 0.4, a: 0.6, glow: 'rgba(150,215,255,1)' }); z.lx = u.x; z.ly = u.y; }
    if (f >= 1) { hitFn(s.tg); z.seg = null; z.i++; continue; }
    return false;
  }
  return true;
}
function zultEnd(u, H) {   // 마무리 연출 + 사용 후 버프
  ring(u.x, u.y, 170, 0.4, H.ult.a, 10); ring(u.x, u.y, 90, 0.3, '#fff', 6); sparks(u.x, u.y - 20, 24, H.ult.a, 600, 0.5); sfx('boom');
  u.postUltT = H.postUltDur; dmgText(u.x, u.y - 100, H.postUltAspd ? '공속 +' + Math.round((H.postUltAspd - 1) * 100) + '%' : '공격력 +' + Math.round(((H.postUltAtk || 1) - 1) * 100) + '%', '#ffb04d', 26);
}
function startAttack(m) {
  const chain = P.comboT > 0 || (P.act && P.act.type === 'atk');
  P.combo = chain ? (P.combo + 1) % (HERO.comboLen || 3) : 0;
  aim(m);
  P.act = { type: 'atk', t: 0, dur: comboTable()[P.combo].dur, c: P.combo, n: 0 };
  if (auto && mode === 'duel') P.comboT = 1.0;   // 비무장 AUTO: AI 와 같이 공격을 시작할 때 콤보 유지 시간 1.0초
  sfx('swing');
}
function startAct(type, dur, m) { aim(m); P.act = { type, t: 0, dur, hits: 0, set: new Set(), done: false }; }
// 방향 입력 없이 회피만 눌렀을 때의 자동 방향: 가장 임박한 공격을 읽고, 회피 이동(DASH_DIST) 후 위험 범위에서 가장 멀리 벗어나는 방향을 고른다.
//  (돌진은 진행 방향에 수직, 도약은 낙하 지점에서 멀어지는 쪽, 십자는 선이 없는 대각, 범위형은 반경/각도를 벗어나는 쪽. 투창은 공격자 반대쪽)
//  임박한 공격이 없으면 가장 가까운 적의 반대쪽으로 물러남 (적이 없으면 바라보는 방향의 반대)
const DASH_DIST = Math.round(209 * DASH_DIST_PVE);   // 회피 이동 거리 (속도 950 x 0.22초)
function dashMargin(e, c, x, y) {   // (x,y) 가 공격 범위에서 얼마나 벗어나 있는가 (양수 = 안전, 음수 = 범위 안)
  const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
  switch (c.kind) {
    case 'circle': return d - (c.r + P.r);
    case 'cone': { const df = angDiff(e.face, a); return Math.max(d - (c.r + P.r), df > c.half ? d * Math.sin(Math.min(df - c.half, Math.PI / 2)) - P.r : -1); }
    case 'leap': case 'rain': return Math.hypot(x - c.tx, y - c.ty) - (c.r + P.r);
    case 'cross': { const ang = e.face + c.off, ca = Math.cos(ang), sa = Math.sin(ang), lx = Math.abs(dx * ca + dy * sa), ly = Math.abs(-dx * sa + dy * ca); return Math.max(Math.min(lx, ly) - (c.w / 2 + P.r), Math.max(lx, ly) - c.len); }
    case 'charge': { const cf = Math.cos(e.face), sf = Math.sin(e.face), al = dx * cf + dy * sf, lat = Math.abs(-dx * sf + dy * cf); return Math.max(lat - ((c.hitR || e.r) + P.r), -al - P.r, al - c.len - P.r); }
  }
  return 0;
}
function smartDashAngle() {
  let best = null, bt = 1e9;
  for (const e of enemies) {
    if (e.dead || e.state !== 'wind' || !e.cur) continue;
    const c = e.cur; if (c.kind === 'fan' ? dist(e, P) > 900 : !threatens(e)) continue;
    const rem = c.windup - e.t; if (rem < bt) { bt = rem; best = e; }
  }
  if (!best) { const t = nearest(520); return t ? angTo(t, P) : P.face + Math.PI; }
  const c = best.cur, away = angTo(best, P);
  if (c.kind === 'fan') return away;
  let base = away;
  if (c.kind === 'charge') base = best.face + (Math.sin(away - best.face) >= 0 ? 1 : -1) * Math.PI / 2;
  else if (c.kind === 'leap') base = Math.hypot(P.x - c.tx, P.y - c.ty) > 20 ? Math.atan2(P.y - c.ty, P.x - c.tx) : away;
  let bestA = base, bs = -1e9;
  for (let k = 0; k < 16; k++) {   // 기본 방향에서 ±22.5° 단위로 후보를 만들어 범위 이탈량이 가장 큰 방향 선택 (비슷하면 기본 방향에 가까운 쪽)
    const dev = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 8, ang = base + dev, ex = P.x + Math.cos(ang) * DASH_DIST, ey = P.y + Math.sin(ang) * DASH_DIST;
    const sc = Math.min(dashMargin(best, c, ex, ey), 120) - Math.abs(dev) * 6;
    if (sc > bs) { bs = sc; bestA = ang; }
  }
  return bestA;
}
function startDash(m) {
  P.cd.dash = dashCdNow(); P.inv = dashInvNow();
  let dx = m.mx, dy = m.my; const l = Math.hypot(dx, dy);
  if (l > 0.2) { P.face = Math.atan2(dy, dx); } else { P.face = smartDashAngle(); }
  P.act = { type: 'dash', t: 0, dur: 0.22 }; sfx('dash');
}
function canCancel(a) { return (a.type === 'atk' && a.t > a.dur * (a.c === 2 ? 0.75 : 0.6)) || (a.type === 'dash' && a.t > a.dur * 0.8); }

function updatePlayer(dt) {
  fxHeroNow = HERO.id;
  if (P.dead) return;
  const p = P;
  for (const k in p.cd) p.cd[k] = Math.max(0, p.cd[k] - dt);
  p.tagCd = Math.max(0, p.tagCd - dt); p.hitT = Math.max(0, (p.hitT || 0) - dt);
  p.rage = Math.min(100, p.rage + dt / ULT_CD * 100 * (1 + RUN.rage + META.rage));   // 궁극기 쿨타임
  for (const id of TEAM) if (id !== HERO.pc && p.hpStore[id] > 0) p.hpStore[id] = Math.min(heroMaxHp(id), p.hpStore[id] + heroMaxHp(id) * BENCH_REGEN * dt);   // 대기 중인 영웅은 천천히 회복 (전투 불능이면 회복 안 함)
  for (const id in p.cdStore) { const st = p.cdStore[id]; st.s1 = Math.max(0, st.s1 - dt); st.s2 = Math.max(0, st.s2 - dt); } for (const k in p.s2Store) p.s2Store[k] = Math.max(0, p.s2Store[k] - dt);   // 대기 중인 영웅의 스킬 쿨타임도 흐름
  p.inv = Math.max(0, p.inv - dt); p.flash = Math.max(0, p.flash - dt); p.comboT = Math.max(0, p.comboT - dt);
  if (p.hitsT > 0) { p.hitsT -= dt; if (p.hitsT <= 0) { p.hits = 0; p.hitTier = 0; } }
  if (p.freeze > 0) { p.freeze -= dt; return; }   // 역경직: 적중 직후 플레이어만 잠깐 정지
  let m = manualMove();
  if (auto) { if (Math.hypot(m.mx, m.my) > 0.3) auto = false; else m = autoInput(dt); }
  const ml = Math.hypot(m.mx, m.my); if (TUT && ml > 0.3) tutEvent('move', dt);
  const mv = ml > 1 ? { x: m.mx / ml, y: m.my / ml } : { x: m.mx, y: m.my };

  // 행동 시작 판정 (우선순위: 회피 > 궁극기 > 청룡참 > 회전참 > 공격)
  if (!RAID) for (let i = 0; i < TEAM.length; i++) if (want('tag' + i)) { use('tag' + i); tryTag(TEAM[i]); }
  let a = p.act;
  if (want('dash') && p.cd.dash <= 0 && (!a || (a.type !== 'ult' && !a.invul && a.type !== 'dash' && a.type !== 'stun'))) { use('dash'); startDash(m); }
  else if (!a || canCancel(a)) {
    if (want('s3') && p.rage >= 100) { use('s3'); p.rage = 0; if (mode !== 'duel' && !HERO.ultRush && !HERO.zUlt && !HERO.lUlt && !HERO.rageUlt && !HERO.crystalUlt) slowT = Math.max(slowT, ULT_SLOW);   // 궁극기: 일괄 슬로우 모션 (실시간 2.2초)
      if (HERO.ultRush) startRush(m, RUSH_SPECS.three); else if (HERO.zUlt) { aim(m); P.act = { type: 'zult', t: 0, dur: 99, invul: true, set: new Set(), done: false }; } else if (HERO.lUlt) { aim(m); P.act = { type: 'lult', t: 0, dur: 99, invul: true, set: new Set(), done: false }; } else if (HERO.crystalUlt) { aim(m); startAct('crystal', 1.0, m); } else if (HERO.rageUlt) { aim(m); startAct('rage', 0.7, m); P.act.invul = true; } else startAct('ult', 1.3, m); sfx('skill'); if (!HERO.ultRush) flashT = 0.15; if (HERO.ultGuard) { p.ultGuardT = HERO.ultGuardDur; dmgText(p.x, p.y - 100, '방어력 +' + Math.round(HERO.ultGuard * 100) + '%', '#7fffd0', 24); } }
    else if (want('s2') && s2Ready()) { use('s2'); castS2(); if (HERO.rush) startRush(m, RUSH_SPECS[HERO.rushSpec || 'one']); else if (HERO.rainS2) { startAct('rain', RAIN_DUR(), m); P.act.rn = 0; rainZone(P, P.act); ring(P.act.rx, P.act.ry, RAIN_R, 0.7, '#ffe08a', 5); } else if (HERO.slam) startAct('slam', 0.5, m); else if (HERO.bless) startAct('bless', 0.55, m); else if (HERO.shoot) startAct('shoot', 0.5 + 0.12 * (SHOOT_N - 3), m); else startAct('s2', S2_DASH_END + 0.26, m); sfx('swing'); }
    else if (want('s1') && p.cd.s1 <= 0 && HERO.s1Switch) { use('s1'); p.cd.s1 = CD.s1 * (1 - (RUN.cd + META.cd)); doFormSwitch(); p.act = { type: 'switch', t: 0, dur: 0.3, set: new Set(), done: false }; }   // 여포: 상마 <-> 하마 전환 (찌르기·방천 베기를 대체)
    else if (want('s1') && p.cd.s1 <= 0) { use('s1'); p.cd.s1 = CD.s1 * (HERO.s1cdMul || 1) * (1 - (RUN.cd + META.cd)); startAct(HERO.s1Throw ? 'throw' : HERO.s1Snipe ? 'snipe' : 's1', HERO.s1Throw ? 0.6 : HERO.s1Snipe ? 0.7 : HERO.s1Heal ? DIAO_S1_DUR() : HERO.s1Cone ? CONE_DUR : HERO.s1Flurry ? FLURRY_DUR : HERO.thrust ? 0.45 : 0.7 + 0.15 * (GUAN_S1_N - 3), m); if (HERO.thrust) { const tg = nearest(THRUST_LEN); if (tg) P.face = angTo(P, tg); } sfx('swing'); }
    else if (want('attack')) { use('attack'); startAttack(m); }
  }
  a = p.act;

  // 질주(여포 상마): 공격 3단계(360° 베기)가 적중하면 발동 -> runDur 초 동안 이동속도 x runBonus. 이동하거나 돌격·적토 돌격을 쓰면 지속시간이 갱신됨
  if (HERO.runBonus) {
    if (p.runBuffT > 0 && ml > 0.2 && !a && Math.random() < 0.4) streak(p.x - Math.cos(p.face) * 34, p.y + 6 + rand(-8, 8), p.face + Math.PI, rand(50, 100), 2, 0.22, 'rgba(225,205,160,.9)');
    if (p.runBuffT > 0) { p.runBuffT = (ml > 0.2 || (a && a.type === 'rush')) ? HERO.runDur : Math.max(0, p.runBuffT - dt); if (ml > 0.2 && !a && Math.random() < 0.5) sparks(p.x, p.y + 14, 1, '#c9a46a', 140, 0.3); }   // 이동 중에는 지속시간이 가득 차게 갱신, 멈추면 감소
  }
  p.blessT = Math.max(0, p.blessT - dt); p.undyT = Math.max(0, (p.undyT || 0) - dt); p.floorT = Math.max(0, (p.floorT || 0) - dt); p.lungeT = Math.max(0, (p.lungeT || 0) - dt); p.aspdT = Math.max(0, p.aspdT - dt); p.postUltT = Math.max(0, p.postUltT - dt); p.comboBuffT = Math.max(0, p.comboBuffT - dt); p.ultGuardT = Math.max(0, p.ultGuardT - dt);
  if (HERO.guard && p.guardT > 0) p.guardT = Math.max(0, p.guardT - dt);   // 관우 방어: 3단계 공격 성공 시 켜지고 guard.dur(10초) 동안 지속
  if (p.slowT > 0) p.slowT -= dt; drTick(p, dt);
  const spd = p.speed * (HERO.runBonus && p.runBuffT > 0 ? HERO.runBonus : 1) * (p.buffT > 0 ? WINE_MOVE_SPEEDUP : 1) * (p.slowT > 0 ? 0.55 : 1);   // 술 버프 중 이동속도 +30%
  let vx = 0, vy = 0;
  if (!a) {
    vx = mv.x * spd; vy = mv.y * spd;
    p.mvAmt = ml > 0.2 ? Math.min(1, ml) * (spd / p.speed) : 0; p.mvAng = Math.atan2(mv.y, mv.x);
    if (ml > 0.2) { if (!(auto && mode === 'duel')) p.face = Math.atan2(mv.y, mv.x); p.walk += dt * 12 * (spd / p.speed); p.stepT = (p.stepT || 0) + dt; if (p.stepT > 0.2 / (spd / p.speed)) { p.stepT = 0; sparks(p.x - Math.cos(p.face) * 8, p.y + 12, 2, '#cdbf99', 70, 0.35); } }   // 발걸음 먼지
  } else {
    p.mvAmt = 0;
    // 공격속도 증가(술 버프 +30%, HIT 누적 보너스)는 평타·회전참·청룡참에만 적용하고, 청룡의 힘(ult)에는 적용하지 않는다.
    const atkSpeedBuff = (p.buffT > 0 ? WINE_ATK_SPEEDUP : 1) * comboMul() * (p.aspdT > 0 ? HERO.aspdBuff.mult : 1) * (HERO.postUltAspd && p.postUltT > 0 ? HERO.postUltAspd : 1) * (1 + (RUN.aspd + META.aspd));
    const rate = a.type === 'dash' || a.type === 'hurt' || a.type === 'stun' || a.type === 'rush' || a.type === 'tag' || a.type === 'switch' || a.type === 'zult' || a.type === 'lult' || a.type === 'rage' || a.type === 'crystal' ? 1 : ATK_SPEED * (a.type === 'ult' ? 1 : atkSpeedBuff) * (HERO.atkSlow && (a.type === 'atk' || a.type === 's1') ? HERO.atkSlow : 1);
    a.t += dt * rate;
    const f = p.face, cx = Math.cos(f), sy = Math.sin(f);
    if (a.type === 'atk') {
      const c = comboTable()[a.c];
      if (HERO.kite) { vx = mv.x * spd * 0.5; vy = mv.y * spd * 0.5; if (ml > 0.2) { p.walk += dt * 8; p.mvAmt = 0.5; p.mvAng = Math.atan2(mv.y, mv.x); } }   // 원거리 장수: 이동하며 사격
      if (a.t >= c.move[0] && a.t < c.move[1]) {
        const env = lungeEase((a.t - c.move[0]) / (c.move[1] - c.move[0]));   // 모든 PC: 공격 전진 속도를 부드럽게 가속·감속 (총 이동 거리는 그대로)
        vx = cx * c.move[2] * rate * env; vy = sy * c.move[2] * rate * env;
        p.lungeT = 0.22; p.walk += dt * 14 * env; p.mvAmt = 0.9 * Math.min(1, env); p.mvAng = f;   // 전진하는 동안 달리기 자세(기울임·걸음)
        if (Math.random() < 0.4 * Math.min(1, env)) sparks(p.x - cx * 20, p.y + 14, 1, '#c9a46a', 120, 0.35);
      }
      if (a.n < c.hits.length && a.t >= c.hits[a.n]) {
        const i = a.n++;
        if (c.span) {   // 3단계: 몸 주위를 한 바퀴 베는 회전베기 (적중 시점에 가까운 적 쪽으로 방향 보정)
          if (i > 0) { const tg = nearest(420); if (tg) p.face = angTo(p, tg); }
          arcFx(p.x, p.y, p.face, c.rad, 1.5, 0.2, HERO.fx.a, c.dirs[i]); arcFx(p.x, p.y, p.face + Math.PI, c.rad, 1.5, 0.2, HERO.fx.a, c.dirs[i]); sfx('swing');
        } else { if (c.ranged) arrowStreak(p, c.rad, c.fan ? c.fan[i] : 0); else arcFx(p.x, p.y, p.face, c.rad, c.half, 0.22, HERO.fx.a, c.dirs[i]); if (c.slam) { ring(p.x + Math.cos(p.face) * 110, p.y + Math.sin(p.face) * 110, 90, 0.3, '#ffb070', 10); sparks(p.x + Math.cos(p.face) * 120, p.y, 12, '#c9a46a', 420, 0.5); doShake(7); sfx('boom'); } }
        const hitN = doArc(c.rad, c.half, p.atk * c.mult[i] * HERO.bal.a, { kb: c.kb, far: c.far });
        if (a.c === 2 && hitN > 0) {   // 3단계(360° 베기)가 적에게 적중 = 공격 3단계 성공
          if (HERO.guard) { const wasOn = p.guardT > 0; p.guardT = HERO.guard.dur; if (!wasOn) { dmgText(p.x, p.y - 100, '방어력 +' + Math.round(HERO.guard.bonus * 100) + '%', '#8fb4ff', 24); ring(p.x, p.y, 60, 0.3, '#8fb4ff', 5); } }   // 관우: 방어력 증가 (10초, 다시 성공하면 갱신)
          if (HERO.runBonus) { if (p.runBuffT <= 0) { dmgText(p.x, p.y - 100, '이동속도 +' + Math.round((HERO.runBonus - 1) * 100) + '%', '#7fd0ff', 24); ring(p.x, p.y, 70, 0.3, '#7fd0ff', 5); } p.runBuffT = HERO.runDur; }   // 여포(상마): 질주 (10초)
        }
        if (a.c === 2 && hitN > 0 && HERO.comboHeal) comboHeal(p);   // 초선: 3단 공격 성공 시 주변 아군 회복
        if (a.c === 2 && HERO.aspdBuff) { if (p.aspdT <= 0) dmgText(p.x, p.y - 100, '공속 +' + Math.round((HERO.aspdBuff.mult - 1) * 100) + '%', '#bfe8ff', 24); p.aspdT = HERO.aspdBuff.dur; }   // 조운: 3단 공격 성공
        if (a.c === 2 && HERO.comboBuff) { if (p.comboBuffT <= 0) dmgText(p.x, p.y - 100, '공격력 +' + Math.round((HERO.comboBuff.atk - 1) * 100) + '%', '#ffd34d', 24); p.comboBuffT = HERO.comboBuff.dur; }   // 3단 콤보 완주
      }
      if (a.t >= a.dur) { p.act = null; if (!(auto && mode === 'duel')) p.comboT = 0.6; }
    } else if (a.type === 's1') {
      vx = mv.x * spd * 0.35; vy = mv.y * spd * 0.35;
      const times = HERO.s1Cone ? CONE_TIMES : HERO.s1Flurry ? FLURRY_TIMES : HERO.s1Heal ? DIAO_S1_TIMES : GUAN_S1_TIMES;
      if (a.hits < (HERO.thrust ? 1 : HERO.s1Flurry ? FLURRY_TIMES.length : HERO.s1Heal ? DIAO_S1_TIMES.length : GUAN_S1_N) && a.t >= times[a.hits]) {
        a.hits++; sfx('swing');
        if (HERO.s1Cone) coneSlam(a.hits);
        else if (HERO.s1Flurry) flurryHit(a.hits);
        else if (HERO.s1Heal) lotusPulse(p);   // 초선: 연꽃 치유
        else if (HERO.thrust) lineThrust();   // 여포(상마): 찌르기
        else {
          arcFx(p.x, p.y, p.face + a.hits * 2.1, S1_RADIUS, 1.5, 0.2, HERO.fx.s, 1); arcFx(p.x, p.y, p.face + a.hits * 2.1 + Math.PI, S1_RADIUS, 1.5, 0.2, HERO.fx.s, 1);
          doArc(S1_RADIUS, Math.PI, p.atk * 0.85 * SKILL_DMG_MULT * S1_DMG_MULT * HERO.bal.s1, { kb: 260, rec: 2 });
        }
      }
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 's2') {
      if (a.t >= 0.1 && a.t < S2_DASH_END) {
        if (HERO.mounted) { p.ghostT -= dt; if (p.ghostT <= 0) { ghost(p.x, p.y, p.face); p.ghostT = 0.03; } sparks(p.x, p.y + 12, 1, '#c9a46a', 140, 0.3); }   // 기마: 질주 잔상·흙먼지
        vx = cx * 1500 * S2_SPEED_MULT * rate; vy = sy * 1500 * S2_SPEED_MULT * rate; p.inv = Math.max(p.inv, 0.05);
        for (const e of enemies) if (!e.dead && !a.set.has(e) && dist(P, e) < e.r + S2_WIDTH) { a.set.add(e); hitEnemy(e, p.atk * 2.4 * SKILL_DMG_MULT * HERO.bal.s2, { from: P, kb: 600 * S2_KB_MULT }); }
      }
      if (a.t >= S2_DASH_END && !a.done) {   // 돌진 종료 지점 폭발
        a.done = true; arcFx(p.x, p.y, p.face, S2_BLAST, 1.5, 0.2, HERO.fx.s, 1); arcFx(p.x, p.y, p.face + Math.PI, S2_BLAST, 1.5, 0.2, HERO.fx.s, 1);
        doArc(S2_BLAST, Math.PI, p.atk * 1.0 * SKILL_DMG_MULT * HERO.bal.s2, { kb: 350 * S2_KB_MULT });
      }
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'snipe') {   // 황충 백보천양: 뒤로 물러나며 시위를 당겼다가 강궁 한 발
      if (a.t < 0.16) { vx = -cx * 1700 * rate; vy = -sy * 1700 * rate; p.inv = Math.max(p.inv, 0.2); p.walk += dt * 20; if (Math.random() < 0.7) sparks(p.x, p.y + 10, 1, '#e8dcc0', 120, 0.3); }
      else { vx = mv.x * spd * 0.5; vy = mv.y * spd * 0.5; }
      if (!a.done && a.t >= 0.3) { a.done = true; sniperShot(p); }
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'rain') {   // 황충 화살비: 지정 구역에 화살 N 번 낙하 (시전 중 슈퍼아머)
      vx = mv.x * spd * 0.6; vy = mv.y * spd * 0.6;
      while (a.rn < RAIN_N && a.t >= RAIN_T0 + a.rn * RAIN_IV) { a.rn++; rainPulse(p, a); }
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'crystal') {   // 황충 마법의 수정화살: 기운을 모으고 한 발 (시전 중 슈퍼아머)
      vx = mv.x * spd * 0.35; vy = mv.y * spd * 0.35;
      if (a.t < 0.5) { const tg = nearest(2200); if (tg) p.face = angTo(p, tg); }
      if (!a.done && a.t >= 0.5) { a.done = true; crystalFire(p); }
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'throw') {   // 전위 쌍극 투척
      vx = mv.x * spd * 0.35; vy = mv.y * spd * 0.35;
      if (!a.done && a.t >= 0.18) { a.done = true; throwBlades(p); }
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'slam') {   // 전위 지축 강타: 짧게 파고든 뒤 내려찍음
      if (a.t >= 0.08 && a.t < 0.18) { vx = cx * 1200 * rate; vy = sy * 1200 * rate; p.inv = Math.max(p.inv, 0.05); }
      if (!a.done && a.t >= 0.2) { a.done = true; slamHit(p); }
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'rage') {   // 전위 불사의 광기: 포효 (시전 중 무적) 뒤 불사 상태
      p.inv = Math.max(p.inv, 0.1);
      if (!a.done && a.t >= 0.25) { a.done = true; rageStart(p); }
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'bless') {   // 초선 월하 축복: 부채를 들어 올렸다가 내리며 아군 전체에 축복
      vx = mv.x * spd * 0.35; vy = mv.y * spd * 0.35;
      if (!a.done && a.t >= 0.2) { a.done = true; moonBless(p); }
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'shoot') {   // 화살 쏘기: 0.1 / 0.22 / 0.34 에 일제 사격, 이동은 느리게 가능
      vx = mv.x * spd * 0.35; vy = mv.y * spd * 0.35;
      const times = SHOOT_TIMES;
      if (a.hits < SHOOT_TIMES.length && a.t >= times[a.hits]) { a.hits++; fireArrows(); }
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'tag') {   // 태그 스킬 (진입 무적, 슬로우 모션 중에 발동)
      p.inv = Math.max(p.inv, 0.15);
      const dmgT = p.atk * 2.4 * SKILL_DMG_MULT, ca = Math.cos(p.face), sa = Math.sin(p.face);
      if (a.id === 'guan') {   // 관우: 청룡 강림 — 칼끝으로 기운이 모이고 청룡이 내려와 반경 380 폭발 (청룡 연출은 drawTagWorldFx)
        if (a.t < 0.2 && Math.random() < 0.8) { const ang = rand(0, TAU), sx = p.x + Math.cos(ang) * 230, sy2 = p.y + Math.sin(ang) * 170, tx = p.x, ty = p.y - HERO.ult.tipH, l = Math.hypot(tx - sx, ty - sy2); fx.push({ k: 'spark', x: sx, y: sy2, vx: (tx - sx) / l * 520, vy: (ty - sy2) / l * 520, t: 0, dur: 0.4, color: '#7fffd0', sz: 5 }); }
        if (!a.done && a.t >= 0.225) { a.done = true; ring(p.x, p.y, 380, 0.6, '#7fffd0', 18); ring(p.x, p.y, 260, 0.45, '#fff', 10); ring(p.x, p.y, 160, 0.35, '#3affc0', 12); sparks(p.x, p.y - 10, 60, '#7fffd0', 900, 0.8); doShake(20); hitstop = Math.max(hitstop, 0.12); flashT = Math.max(flashT, 0.3); sfx('boom'); doArc(380, Math.PI, dmgT, { kb: 800, rec: 2, shake: 10 }); }
      } else if (a.id === 'zhao') {   // 조운: 백룡 강습 — 짧게 파고들며 전방 직선(길이 560, 폭 120)을 꿰뚫음
        if (a.t >= 0.04 && a.t < 0.16) { vx = ca * 1600; vy = sa * 1600; for (let k = 0; k < 2; k++) { const off = rand(-40, 40); streak(p.x - Math.sin(p.face) * off, p.y + Math.cos(p.face) * off - 6, p.face + Math.PI, rand(100, 200), rand(2, 3), 0.22, '#d8f0ff'); } }
        if (!a.done && a.t >= 0.16) {
          a.done = true; fx.push({ k: 'beam', hid: fxHeroNow, x: p.x + ca * 280, y: p.y - 14 + sa * 280, ang: p.face, len: 280, w: 70, t: 0, dur: 0.35 }); ring(p.x + ca * 60, p.y + sa * 60, 100, 0.4, '#7fd0ff', 10); sparks(p.x + ca * 200, p.y - 10, 30, '#d8f0ff', 700, 0.5); doShake(10); sfx('boom');
          for (const e of enemies) { if (e.dead) continue; const dx = e.x - p.x, dy = e.y - p.y, lx = dx * ca + dy * sa, ly = Math.abs(-dx * sa + dy * ca); if (lx >= -e.r && lx <= 560 + e.r && ly <= 60 + e.r) hitEnemy(e, dmgT * 1.2, { from: P, kb: 700, rec: 2, shake: 8 }); }
        }
      } else if (a.id === 'diao') {   // 초선: 연꽃 강림 — 발밑에서 연꽃이 만개해 아군을 치유하고 주변 적을 밀쳐냄
        if (a.t < 0.2 && Math.random() < 0.8) sparks(p.x + rand(-70, 70), p.y + rand(-20, 20), 1, '#ffb3d6', 220, 0.5);
        if (!a.done && a.t >= 0.2) { a.done = true; ring(p.x, p.y, 380, 0.6, '#ff9ac8', 16); ring(p.x, p.y, 240, 0.45, '#fff', 9); ring(p.x, p.y, 140, 0.35, '#ff5aa8', 12); sparks(p.x, p.y - 10, 50, '#ffb3d6', 800, 0.8); doShake(12); flashT = Math.max(flashT, 0.2); sfx('boom'); healTeam(p, DIAO_HEAL.tag * HEAL_POW, HEAL_R); doArc(340, Math.PI, dmgT * 0.7, { kb: 700, rec: 2, shake: 6 }); }
      } else if (a.id === 'huang') {   // 황충: 백발백중 — 정면 부채꼴로 관통 화살 5발
        if (!a.done && a.t >= 0.2) { a.done = true; for (let k = -2; k <= 2; k++) { const ang = p.face + k * 0.16; projectiles.push({ x: p.x + ca * 30, y: p.y - 14 + sa * 30, vx: Math.cos(ang) * 1200, vy: Math.sin(ang) * 1200, dmg: dmgT * 0.45, life: 0.7, r: 14, arrow: true, friendly: true, hit: new Set() }); } ring(p.x, p.y, 140, 0.4, '#ffe08a', 8); sparks(p.x + ca * 40, p.y - 14, 24, '#fff1c8', 700, 0.5); doShake(8); sfx('boom'); }
      } else if (a.id === 'dian') {   // 전위: 악래 돌진 — 육중하게 돌진해 쌍극으로 내려찍음 (반경 300)
        if (a.t >= 0.02 && a.t < 0.2) { vx = ca * 1400; vy = sa * 1400; }
        if (!a.done && a.t >= 0.2) { a.done = true; ring(p.x, p.y, 300, 0.5, '#ff7a5a', 14); ring(p.x, p.y, 180, 0.4, '#fff', 8); sparks(p.x, p.y - 10, 40, '#ffb88a', 800, 0.7); doShake(16); hitstop = Math.max(hitstop, 0.08); sfx('boom'); doArc(300, Math.PI, dmgT * 1.1, { kb: 900, rec: 2, shake: 8 }); }
      } else if (a.id === 'lubu') {   // 여포(상마): 적토 강습 — 불꽃을 두르고 전방으로 질주 (길이 약 540, 폭 80) + 질주 발동
        if (!a.done) { a.done = true; p.runBuffT = HERO.runDur; ring(p.x, p.y, 140, 0.35, '#ff7a3a', 14); ring(p.x, p.y, 80, 0.3, '#fff', 8); sparks(p.x, p.y - 10, 26, '#ffd27a', 650, 0.5); sfx('boom'); }
        if (a.t >= 0.1 && a.t < 0.3) {
          vx = ca * 2700; vy = sa * 2700;
          p.ghostT -= dt; if (p.ghostT <= 0) { ghost(p.x, p.y, p.face); p.ghostT = 0.015; }
          for (let k = 0; k < 4; k++) { const off = rand(-70, 70); streak(p.x - Math.sin(p.face) * off, p.y + Math.cos(p.face) * off - 6, p.face + Math.PI, rand(140, 280), rand(2, 4), 0.28, k % 2 ? '#fff4d0' : '#ff9a4a'); }
          for (let k = 0; k < 2; k++) fx.push({ k: 'fire', x: p.x - ca * rand(0, 30), y: p.y + 10 - sa * rand(0, 30), r: rand(18, 30), t: 0, dur: rand(0.35, 0.6) });
          sparks(p.x, p.y + 10, 3, Math.random() < 0.5 ? '#ff7a3a' : '#ffd27a', 320, 0.45);
          for (const e of enemies) if (!e.dead && !a.set.has(e) && dist(P, e) < e.r + 80) { a.set.add(e); hitEnemy(e, dmgT, { from: P, kb: 900, rec: 2, shake: 6, stop: 0.05 }); }
        } else if (a.t >= 0.3 && !a.end) { a.end = true; ring(p.x, p.y, 170, 0.4, '#ff7a3a', 14); ring(p.x, p.y, 100, 0.3, '#fff', 8); sparks(p.x, p.y - 8, 28, '#ffd27a', 700, 0.5); doShake(12); }
      } else {   // 여포(하마): 방천 베기 — 거대한 방천화극이 전방에 내리꽂히고 부채꼴(반경 380, ±1.3)이 휩쓸림 (연출은 drawTagWorldFx)
        if (!a.done && a.t >= 0.233) { a.done = true; arcFx(p.x, p.y, p.face, 380, 1.3, 0.28, HERO.fx.a, 1); arcFx(p.x, p.y, p.face, 300, 1.3, 0.28, '#ffd27a', -1); ring(p.x + ca * 200, p.y + sa * 200, 150, 0.45, '#ff7a3a', 14); for (let k = 0; k < 10; k++) { const an = k / 10 * TAU; fx.push({ k: 'fire', x: p.x + ca * 200 + Math.cos(an) * 110, y: p.y + sa * 200 + Math.sin(an) * 70, r: rand(30, 46), t: 0, dur: rand(0.5, 0.9) }); } sparks(p.x + ca * 200, p.y - 10, 40, '#ffd27a', 800, 0.7); doShake(18); hitstop = Math.max(hitstop, 0.1); flashT = Math.max(flashT, 0.25); sfx('boom'); doArc(380, 1.3, dmgT * 1.1, { kb: 800, rec: 2, shake: 10 }); }
      }
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'rush') {
      const sp = a.sp;
      if (a.invul) p.inv = Math.max(p.inv, 0.2); else if (sp.inv) p.inv = Math.max(p.inv, 0.12);   // 단기필마: 돌격(선딜 + 질주) 동안 무적   // 적토 돌격(궁극기): 시전 내내 무적
      if (a.ph === 'wind') {
        a.pt += dt; if (a.pt < sp.wind[a.n] * 0.6) rushAim(m);   // 선딜 앞부분에 조준, 뒷부분은 고정
        if (sp.invul) {   // 궁극기: 질주 방향 뒤쪽으로 속도선이 흐르며 힘을 모음
          if (Math.random() < 0.8) { const off = rand(-sp.w, sp.w); streak(p.x - Math.sin(p.face) * off + Math.cos(p.face) * rand(20, 70), p.y + Math.cos(p.face) * off + Math.sin(p.face) * rand(20, 70) - 6, p.face + Math.PI, rand(60, 130), 2, 0.18, '#ffb070'); }
        }
        if (a.pt >= sp.wind[a.n]) { a.ph = 'dash'; a.pt = 0; a.set = new Set(); sfx('swing'); if (sp.invul) { for (let k = 0; k < 10; k++) { const off = rand(-sp.w, sp.w); streak(p.x - Math.sin(p.face) * off, p.y + Math.cos(p.face) * off - 6, p.face + Math.PI, rand(140, 260), rand(2, 4), 0.3, k % 2 ? '#fff4d0' : '#ff9a4a'); } sparks(p.x, p.y + 8, 10, '#ffd27a', 500, 0.3); } }
      } else {
        a.pt += dt; const v = RUSH_LEN / sp.dash[a.n];
        vx = cx * v; vy = sy * v; p.inv = Math.max(p.inv, 0.05);
        p.ghostT -= dt; if (p.ghostT <= 0) { ghost(p.x, p.y, p.face); p.ghostT = 0.03; }
        if (sp.invul) {   // 속도감: 뒤로 길게 흐르는 속도선 + 촘촘한 잔상 + 얇은 불꽃 꼬리
          const px = -Math.sin(p.face), py = Math.cos(p.face);
          for (let k = 0; k < 4; k++) { const off = rand(-sp.w, sp.w) * 0.9; streak(p.x + px * off - Math.cos(p.face) * rand(0, 30), p.y + py * off - Math.sin(p.face) * rand(0, 30) - 6, p.face + Math.PI, rand(110, 240), rand(1.5, 3.5), 0.22, k % 2 ? '#fff4d0' : '#ff9a4a'); }
          fx.push({ k: 'fire', x: p.x - Math.cos(p.face) * 20, y: p.y + 10 - Math.sin(p.face) * 20, r: rand(14, 22), t: 0, dur: 0.3 });
          p.ghostT = Math.min(p.ghostT, 0.015);
        } else sparks(p.x, p.y + 12, 1, '#c9a46a', 140, 0.3);
        for (const e of enemies) if (!e.dead && !a.set.has(e) && dist(P, e) < e.r + sp.w) { a.set.add(e); hitEnemy(e, p.atk * sp.dmg * SKILL_DMG_MULT * sp.mult * (sp.invul ? HERO.bal.u : HERO.bal.s2), { from: P, kb: sp.kb, stun: sp.stun, rage: sp.invul ? 0 : undefined, breakArmor: !!sp.stun, shake: sp.invul ? 4 : undefined, stop: sp.invul ? 0.03 : undefined }); }
        if (a.pt >= sp.dash[a.n]) {
          a.n++;
          if (sp.invul) sparks(p.x, p.y + 6, 8, '#ffd27a', 420, 0.3);
          if (a.n >= sp.n) {   // 마지막 질주 끝: 폭발
            arcFx(p.x, p.y, p.face, sp.blastR, 1.5, 0.2, HERO.fx.s, 1); arcFx(p.x, p.y, p.face + Math.PI, sp.blastR, 1.5, 0.2, HERO.fx.s, 1);
            doArc(sp.blastR, Math.PI, p.atk * 1.0 * SKILL_DMG_MULT * sp.mult * (sp.invul ? HERO.bal.u : HERO.bal.s2), { kb: sp.blastKb, stun: sp.stun, rage: sp.invul ? 0 : undefined, breakArmor: !!sp.stun });
            if (sp.invul) { ring(p.x, p.y, sp.blastR, 0.25, HERO.ult.a, 5); doShake(5); if (HERO.postUltAtk) { p.postUltT = HERO.postUltDur; dmgText(p.x, p.y - 100, '공격력 +' + Math.round((HERO.postUltAtk - 1) * 100) + '%', '#ffb04d', 26); } } else doShake(8);   // 적토 돌격 후 공격력 증가
            p.act = null;
          } else { a.ph = 'wind'; a.pt = 0; rushAim(m); if (sp.invul && mode !== 'duel') slowT = Math.max(slowT, RUSH_SLOW); }   // 다음 질주 시작: 다시 슬로 모션
        }
      }
    } else if (a.type === 'ult') {
      p.inv = Math.max(p.inv, 0.1);
      const tipX = p.x, tipY = p.y - HERO.ult.tipH;
      if (a.t < 0.15 && Math.random() < 0.8) {   // 주변 기운이 칼날로 빨려 들어감
        const ang = rand(0, TAU), sx = p.x + Math.cos(ang) * 230, sy = p.y + Math.sin(ang) * 170, dx = tipX - sx, dy = tipY - sy, l = Math.hypot(dx, dy);
        fx.push({ k: 'spark', x: sx, y: sy, vx: dx / l * 520, vy: dy / l * 520, t: 0, dur: 0.4, color: HERO.ult.a, sz: 5 });
      }
      if (HERO.ultStyle === 'lance' && a.t >= 0.12 && a.t < 0.55) lanceStreaks(p.x, p.y);   // 백룡강림: 몸 주변으로 흐르는 속도선
      if (a.t >= 0.15 && a.t < 0.55) {   // 칼날에서 청룡의 기운이 사방으로 분출
        for (let k = 0; k < 2; k++) { const ang = rand(0, TAU), sp = rand(180, 520); fx.push({ k: 'spark', x: tipX + rand(-20, 20), y: tipY + rand(-40, 40), vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 120, t: 0, dur: rand(0.3, 0.6), color: Math.random() < 0.5 ? HERO.ult.b : HERO.ult.a, sz: rand(3, 6) }); }
      }
      if (!a.done && a.t >= 0.55) {
        a.done = true; doShake(26); hitstop = Math.max(hitstop, 0.16); flashT = 0.35; sfx('boom');
        ring(p.x, p.y, ULT_RADIUS, 0.6, HERO.ult.a, 18); ring(p.x, p.y, 260, 0.45, '#fff', 10); ring(p.x, p.y, 160, 0.35, HERO.ult.c, 12);
        sparks(p.x, p.y - 10, 50, HERO.ult.a, 900, 0.8);
        if (HERO.healUlt) ultHeal(p);   // 초선: 범위 아군 대량 회복
        if ((HERO.postUltAtk || HERO.postUltAspd) && !HERO.ultRush) { p.postUltT = HERO.postUltDur; dmgText(p.x, p.y - 100, (HERO.postUltAspd ? '공속 +' + Math.round((HERO.postUltAspd - 1) * 100) : '공격력 +' + Math.round((HERO.postUltAtk - 1) * 100)) + '%', '#ffb04d', 26); }   // 천하무쌍: 사용 후 공격력 증가
        for (const e of enemies) if (!e.dead && dist(P, e) < ULT_RADIUS + e.r) hitEnemy(e, p.atk * 6.5 * SKILL_DMG_MULT * ULT_DMG_MULT * HERO.bal.u, { from: P, kb: 900, stun: 2.2, breakArmor: true, stop: 0.1, shake: 12, rage: 0 });
      }
      if ((HERO.ultStyle === 'halberd' || HERO.ultStyle === 'lance') && a.done && a.t < 0.9) for (let k = 0; k < 3; k++) { const ang = rand(0, TAU), rr = Math.sqrt(Math.random()) * ULT_RADIUS, lc = HERO.ultStyle === 'lance'; fx.push({ k: 'spark', x: p.x + Math.cos(ang) * rr, y: p.y + Math.sin(ang) * rr * 0.75, vx: rand(-30, 30), vy: rand(-260, -120), t: 0, dur: rand(0.4, 0.8), color: lc ? (Math.random() < 0.5 ? '#bfe8ff' : '#ffffff') : (Math.random() < 0.5 ? '#ff7a3a' : '#ffd27a'), sz: rand(4, 8) }); }   // 천하무쌍: 솟구치는 불꽃
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'zult') {   // 조운 백룡강림: 고속 이동 연속 찌르기 (이동 중 적과 충돌 없음, 무적)
      p.inv = Math.max(p.inv, 0.1);
      if (a.t < ZU_WIND) { lanceStreaks(p.x, p.y); const tg = nearest(ULT_RADIUS); if (tg) p.face = angTo(p, tg); }
      else {
        if (!a.z) { a.z = zultInit(P, enemies); flashT = Math.max(flashT, 0.12); sfx('boom'); ring(p.x, p.y, 120, 0.3, HERO.ult.a, 8); }
        const per = p.atk * 6.5 * SKILL_DMG_MULT * ULT_DMG_MULT * HERO.bal.u / ZU_H0;
        if (zultStep(p, a, a.z, tg => { hitEnemy(tg, per, { from: P, kb: 40, stun: 2.2, breakArmor: true, rage: 0, shake: 3 }); zultHitFx(P, tg); })) { zultEnd(p, HERO); p.act = null; }
      }
    } else if (a.type === 'lult') {   // 여포(하마) 천하무쌍: 360° 휘두르기 -> 검기 연타 (무적)
      p.inv = Math.max(p.inv, 0.1);
      if (a.t < LU_WIND) { const tg = nearest(ULT_RADIUS); if (tg) p.face = angTo(p, tg); }
      if (lultStep(p, a, HERO, (sh, o) => { const dm = p.atk * 6.5 * SKILL_DMG_MULT * ULT_DMG_MULT * HERO.bal.u * sh; for (const e of enemies) if (!e.dead && dist(P, e) < ULT_RADIUS + e.r) hitEnemy(e, dm, { from: P, kb: o.kb, stun: o.stun, breakArmor: true, rage: 0, shake: o.shake, stop: o.stop }); })) { zultEnd(p, HERO); p.act = null; }
    } else if (a.type === 'switch') {   // 폼 전환 직후 짧은 자세 (슈퍼아머 + 느린 이동)
      vx = mv.x * spd * 0.5; vy = mv.y * spd * 0.5; p.inv = Math.max(p.inv, 0.1);
      if (!a.done && a.t >= 0.2) { a.done = true; formSlash(P, HERO, true); }   // 360° 베기 1회
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'stun') {
      if (a.t >= a.dur) { p.act = null; if (mode !== 'duel') p.inv = Math.max(p.inv, 0.6); }   // 스턴 해제 직후 짧은 무적(연속 스턴 방지)
    } else if (a.type === 'hurt') {
      if (a.t >= a.dur) { p.act = null; if (mode !== 'duel') p.inv = Math.max(p.inv, 0.4); }   // 회복 직후 짧은 무적(연속 경직 방지)
    } else if (a.type === 'dash') {
      vx = Math.cos(f) * dashSpeedNow(); vy = Math.sin(f) * dashSpeedNow();
      p.ghostT -= dt; if (p.ghostT <= 0) { ghost(p.x, p.y, p.face); p.ghostT = 0.04; }
      if (a.t >= a.dur) p.act = null;
    }
  }
  vx += p.kx; vy += p.ky; { const kf = Math.exp(-8 * dt); p.kx *= kf; p.ky *= kf; }
  p.x = clamp(p.x + vx * dt, 70, WORLD.w - 70); p.y = clamp(p.y + vy * dt, 80, WORLD.h - 70); arenaClamp(p);
}

