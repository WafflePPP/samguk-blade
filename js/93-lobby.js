'use strict';
// ===== 로비(시작 화면): 프로젝트 이름 · 설명 · 보스 스테이지 입장 버튼 2개 · 조작 가이드 =====
//  여포 보스 스테이지 = 시작 영웅 관우(보스 여포 봉선) / 관우 보스 스테이지 = 시작 영웅 여포 상마(보스 관우 운장). 전투 중에는 3인을 태그로 교체.
const LOBBY_STAGES = [
  { title: '로그라이크 모드', line: 'W1~W50  ·  5층마다 보스  ·  5층마다 능력치 강화 선택', start: '최대 3명 선택  ·  Z / X / C 태그  ·  여포는 K 로 상마↔하마', col: '#d8a03a' },
  { title: '비무장 모드', line: '1~3명 PC 대전 (적도 같은 인원)  ·  제한 시간 3분', start: '1~3명 선택  ·  태그 없이 시작부터 전투  ·  레벨 보정 양쪽 동일', col: '#4fb0ff' },
  { title: '레이드 모드', line: '보스전 (여포 봉선 · 전위 악래)  ·  1~3명 동시 전투', start: '1명 조작 + AI 동료 2명  ·  태그 없음  ·  온라인은 준비 중', col: '#e0504a' },
];
// ===== 로비 (참고: 모바일 게임의 깔끔한 로비) — 위: 프로필 · 로고 · 도움말 / 가운데: 대표 영웅 + 말풍선 / 아래: 내비게이션 바 =====
const LOBBY_HERO_BOX = { x: W / 2 - 360, y: 96, w: 360, h: 500 };
const LOBBY_LINES = {
  guan: ['의리로 천하를 지키겠소.', '청룡언월도가 울고 있구려.'], lubu: ['천하무쌍, 나를 막을 자 누구냐!', '적토마가 달리고 싶어 하오.'], zhao: ['창 한 자루면 충분하오.', '백만 대군 속이라도 가겠소.'],
  diao: ['모두 무사히 돌아오세요.', '연꽃이 장군을 지켜줄 거예요.'], dian: ['주공께는 한 걸음도 못 갑니다!', '쌍철극이 피를 원하는군.'], huang: ['백 보 밖이라도 빗나가지 않소.', '노장의 활솜씨를 보여주지.'],
};
function navIcon(i, x, y, col) {   // 내비게이션 아이콘 (선으로 그린 약식): 0 깃발 / 1 교차한 검 / 2 방천화극 / 3 두루마리
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (i === 0) { ctx.beginPath(); ctx.moveTo(-9, 17); ctx.lineTo(-9, -16); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-9, -15); ctx.lineTo(15, -9 + Math.sin(T * 4) * 1.5); ctx.lineTo(-9, 1); ctx.closePath(); ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1; }
  else if (i === 1) { for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-14 * d, 16); ctx.lineTo(14 * d, -16); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-9 * d, 9); ctx.lineTo(-15 * d, 4); ctx.stroke(); } }
  else if (i === 2) { ctx.beginPath(); ctx.moveTo(-11, 18); ctx.lineTo(11, -15); ctx.stroke(); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(9, -9, 7, Math.PI * 0.2, Math.PI * 1.2); ctx.stroke(); ctx.beginPath(); ctx.arc(2, -1, 7, Math.PI * 1.2, Math.PI * 2.2); ctx.stroke(); }
  else { ctx.strokeRect(-11, -14, 22, 28); ctx.lineWidth = 2; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-6, -7 + k * 7); ctx.lineTo(6, -7 + k * 7); ctx.stroke(); } }
  ctx.restore();
}
const NAV_SHORT = ['웨이브 50 · 5층마다 보스', '1~3 대 1~3 · 3분 대전', '여포 · 전위 레이드 보스전'];
const NAV_COL = ['#e0b13a', '#4fb0ff', '#ff6a5a', '#9dff9d'];
function drawLobbyNav() {
  const by = 596;   // 바 바탕
  { const g = ctx.createLinearGradient(0, by, 0, H); g.addColorStop(0, 'rgba(8,6,18,.72)'); g.addColorStop(1, 'rgba(4,3,10,.94)'); ctx.fillStyle = g; ctx.fillRect(0, by, W, H - by); }
  ctx.fillStyle = 'rgba(255,211,77,.55)'; ctx.fillRect(0, by, W, 2);
  const n = STAGE_HEROES.length + 1;
  for (let i = 0; i < n; i++) {
    const r = cardRect(i), sel = lobbySel === i, col = NAV_COL[i], title = i < STAGE_HEROES.length ? LOBBY_STAGES[i].title : '장수 정보';
    ctx.fillStyle = sel ? 'rgba(60,44,16,.88)' : 'rgba(18,14,30,.7)'; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = sel ? '#ffd34d' : 'rgba(255,255,255,.22)'; ctx.lineWidth = sel ? 3 : 1.5; ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = col; ctx.fillRect(r.x, r.y + r.h - 4, r.w, 4);
    if (sel) { ctx.strokeStyle = 'rgba(255,211,77,' + (0.2 + 0.18 * Math.sin(T * 5)) + ')'; ctx.lineWidth = 7; ctx.strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8); }
    navIcon(i, r.x + 38, r.y + 38, sel ? '#ffe9a0' : col);
    text(title, r.x + 72, r.y + 36, 21, sel ? '#ffe9a0' : '#e6e9f5', 'left');
    const sub = i < STAGE_HEROES.length ? NAV_SHORT[i] : '총 Lv ' + (ACC ? HERO_IDS.reduce((t, id) => t + heroRec(ACC, id).lv, 0) : 0) + (IS_TOUCH ? '' : '  ·  I');
    text(fitStr(sub, r.w - 82, 12.5), r.x + 72, r.y + 60, 12.5, sel ? '#ffd9a0' : '#aab3c8', 'left', false);
  }
  const sel = lobbySel;   // 선택한 항목의 한 줄 설명 (바 위쪽)
  if (sel < STAGE_HEROES.length) { const st = LOBBY_STAGES[sel]; text(st.start, W / 2, 586, 14, 'rgba(255,233,160,.9)', 'center', false); }
  text(IS_TOUCH ? '항목을 터치하면 입장합니다' : '← →  선택   ·   Enter  입장   ·   H  도움말', W / 2, 716, 11.5, 'rgba(255,255,255,.45)', 'center', false);
}
function drawLobbyHero() {   // 가운데 대표 영웅 (누르면 다음 영웅) + 말풍선
  const id = lobbyHero || selHero || HERO_IDS[0], h = HEROES[id]; lobbyHeroT += 1 / 60;
  const fx0 = W / 2 - 170, fy0 = 560;
  const sp = ctx.createRadialGradient(fx0, fy0 + 8, 10, fx0, fy0 + 8, 190); sp.addColorStop(0, 'rgba(255,214,140,.38)'); sp.addColorStop(1, 'rgba(255,214,140,0)'); ctx.fillStyle = sp; ctx.save(); ctx.translate(fx0, fy0 + 8); ctx.scale(1, 0.28); ctx.translate(-fx0, -(fy0 + 8)); ctx.fillRect(fx0 - 200, fy0 - 200, 400, 400); ctx.restore();
  ctx.save(); ctx.translate(fx0, fy0); const sc = h.mounted ? 1.7 : 2.1; ctx.scale(sc, sc); drawCardFigure(h, 0, 0); ctx.restore();
  // 이름표
  const nm = PC_NAME[id] + '  Lv ' + (ACC ? heroRec(ACC, id).lv : 1);
  ctx.font = '700 17px ' + FONT; const tw = ctx.measureText(nm).width + 34;
  ctx.fillStyle = 'rgba(10,8,20,.7)'; ctx.fillRect(fx0 - tw / 2, 232, tw, 30); ctx.fillStyle = '#ffd34d'; ctx.fillRect(fx0 - tw / 2, 232, 4, 30); text(nm, fx0 + 2, 253, 17, '#ffe9a0', 'center');
  // 말풍선
  const lines = LOBBY_LINES[id] || ['준비되었소.'], line = lines[Math.floor(lobbyHeroT / 6) % lines.length];
  ctx.font = '600 17px ' + FONT; const bw = ctx.measureText(line).width + 44, bx = fx0 + 130, by = 300;
  ctx.fillStyle = 'rgba(250,248,240,.93)'; ctx.beginPath(); ctx.moveTo(bx + 12, by); ctx.lineTo(bx + bw - 12, by); ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + 12); ctx.lineTo(bx + bw, by + 38); ctx.quadraticCurveTo(bx + bw, by + 50, bx + bw - 12, by + 50); ctx.lineTo(bx + 12, by + 50); ctx.quadraticCurveTo(bx, by + 50, bx, by + 38); ctx.lineTo(bx - 14, by + 40); ctx.lineTo(bx, by + 28); ctx.lineTo(bx, by + 12); ctx.quadraticCurveTo(bx, by, bx + 12, by); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2a2438'; ctx.font = '600 17px ' + FONT; ctx.textAlign = 'left'; ctx.fillText(line, bx + 22, by + 31); ctx.textAlign = 'left';
}
function drawLobbyAccount() {   // 왼쪽 위 프로필 카드 (누르면 계정 선택) / 오른쪽 위 도움말 버튼
  if (!ACC) return;
  const b = ACC_BTN, top = HERO_IDS.reduce((m, id) => heroRec(ACC, id).lv > heroRec(ACC, m).lv ? id : m, HERO_IDS[0]), tot = HERO_IDS.reduce((t, id) => t + heroRec(ACC, id).lv, 0);
  ctx.fillStyle = 'rgba(10,8,20,.72)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.fillStyle = '#ffd34d'; ctx.fillRect(b.x, b.y, 4, b.h); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.save(); ctx.beginPath(); ctx.arc(b.x + 40, b.y + 32, 24, 0, TAU); ctx.clip(); ctx.translate(b.x + 40, b.y + 37); ctx.scale(0.8, 0.8); drawPortraitIcon(HEROES[top], 0, 0); ctx.restore();
  ctx.strokeStyle = '#d4a73a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x + 40, b.y + 32, 24, 0, TAU); ctx.stroke();
  text(ACC.name, b.x + 76, b.y + 29, 20, '#fff', 'left'); text('총 Lv ' + tot + '   ·   최고 ' + (ACC.best || 0) + '층', b.x + 76, b.y + 51, 12.5, '#aab3c8', 'left', false);
  text('변경 ▾', b.x + b.w - 12, b.y + 22, 11.5, '#9ad4ff', 'right', false);
  const hb = HELP_BTN; ctx.fillStyle = 'rgba(10,8,20,.72)'; ctx.fillRect(hb.x, hb.y, hb.w, hb.h); ctx.strokeStyle = helpOpen ? '#ffd34d' : 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.strokeRect(hb.x, hb.y, hb.w, hb.h); text('?', hb.x + hb.w / 2, hb.y + 32, 26, '#ffe9a0', 'center');
}
function drawHelpPanel() {
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
  const p = HELP_PANEL; ctx.fillStyle = 'rgba(14,10,26,.96)'; ctx.fillRect(p.x, p.y, p.w, p.h); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3; ctx.strokeRect(p.x, p.y, p.w, p.h); ctx.strokeStyle = 'rgba(255,211,77,.3)'; ctx.lineWidth = 1; ctx.strokeRect(p.x + 8, p.y + 8, p.w - 16, p.h - 16);
  text('도움말 · 조작 가이드', W / 2, p.y + 46, 28, '#ffe9a0', 'center');
  const G = IS_TOUCH
    ? ['왼쪽 화면 드래그 : 이동 (가상 조이스틱)', '공격 버튼 : 누를 때마다 1 → 2 → 3단계', '스킬 · 궁극기(쿨타임 30초) · 회피 버튼', '왼쪽 TAG 버튼 : 선택한 영웅으로 교체 (로그라이크)', 'AUTO : 자동 전투 (생명력 10% 이하 자동 태그)', '붉은 범위 표시 = 적 공격 예고 — 회피로 피하세요!', '비무장·레이드 : 왼쪽 영웅 초상화를 눌러 조작 영웅 변경']
    : ['WASD / 방향키 : 이동      J / 마우스 클릭 : 공격 (1 → 2 → 3단계)', 'K · L : 스킬      ; : 궁극기 (쿨타임 30초)      Space : 회피 (무적)', 'Z · X · C : 선택한 영웅 순서대로 태그 (로그라이크)', 'T / Tab : 오토 전투 (생명력 10% 이하 자동 태그)', '붉은 범위 표시 = 적 공격 예고 — 회피로 피하세요!', '비무장·레이드 : 왼쪽 영웅 초상화를 누르거나 Q 로 조작 영웅 변경'];
  G.forEach((t, i) => text(t, W / 2, p.y + 92 + i * 28, 15, '#dfe3f5', 'center', false));
  text('튜토리얼 다시 보기', W / 2, p.y + 292, 17, '#ffd34d', 'center');
  [['로그라이크 모드', 'yeonui'], ['비무장 모드', 'duel'], ['레이드 모드', 'raid']].forEach(([nm, key], i) => { const r = tutBtnRect(i), done = ACC && ACC.tut && ACC.tut[key]; ctx.fillStyle = 'rgba(10,12,20,.9)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = done ? '#7a8aa0' : '#ffd34d'; ctx.lineWidth = 1.5; ctx.strokeRect(r.x, r.y, r.w, r.h); text('▶ ' + nm + (done ? '' : '  (처음 입장 시 진행)'), r.x + r.w / 2, r.y + 24, 15, done ? '#cfd3e6' : '#ffe9a0', 'center', false); });
  text('아무 곳이나 누르거나 Esc / H 로 닫기', W / 2, p.y + p.h - 22, 12.5, 'rgba(255,255,255,.55)', 'center', false);
}
function drawTitle() {
  drawLoginScene(); ctx.fillStyle = 'rgba(6,4,14,.22)'; ctx.fillRect(0, 0, W, H);   // 로그인 화면과 같은 노을 진 야영지 배경
  ctx.save(); ctx.shadowColor = 'rgba(255,170,60,.75)'; ctx.shadowBlur = 16; text('三國 猛將傳', W / 2, 54, 40, '#ffd34d', 'center'); ctx.restore();
  drawLobbyHero();
  drawLobbyNav();
  if (helpOpen) drawHelpPanel();
}
// 적토 돌격 질주 중 화면 가장자리에서 중심으로 흐르는 속도선
function drawSpeedLines() {
  const a = P.act; if (state !== 'play' || !a || !a.invul || !(a.ph === 'dash' || (a.type === 'tag' && a.id === 'lubu' && a.t >= 0.1 && a.t < 0.3))) return;
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const an = rand(0, TAU), r1 = rand(260, 420), r2 = r1 + rand(100, 260);
    ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(255,244,208,.32)' : 'rgba(255,154,74,.28)'; ctx.lineWidth = rand(1, 3);
    ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(an) * r1 * 1.5, H / 2 + Math.sin(an) * r1 * 0.9); ctx.lineTo(W / 2 + Math.cos(an) * r2 * 1.5, H / 2 + Math.sin(an) * r2 * 0.9); ctx.stroke();
  }
  ctx.restore();
}
function render() {
  ctx.clearRect(0, 0, W, H); ICON_HITS = []; if (iconTip && !(state === 'play' || state === 'upgrade')) iconTip = null;
  if (state === 'account') { drawAccount(); return; }
  if (state === 'info') { drawInfo(); return; }
  if (state === 'title') { drawTitle(); if (!helpOpen) drawLobbyAccount(); return; }
  if (state === 'pick') { drawPick(); return; }
  if (state === 'duelMenu') { drawDuelMenu(); return; }
  if (state === 'raidMenu') { raidMsgT = Math.max(0, raidMsgT - 1 / 60); drawRaidMenu(); return; }
  if (state === 'raidBoss') { drawRaidBoss(); return; }
  if (state === 'waves') { drawWaves(); return; }
  if (state === 'upgrade') { drawWorld(); drawHUD(); drawUpgrade(); return; }
  drawWorld(); drawSpeedLines(); drawTagOverlay(); drawHUD(); drawIconTip(); drawSpeedCtl(); if (state === 'play') { if (MINIMAP_ON) drawMinimap(); drawHeroPointer(); drawTutorial(); }
  if (flashT > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, flashT * 2)})`; ctx.fillRect(0, 0, W, H); }
  if (paused && state === 'play') drawPauseOverlay();
  if (mode === 'duel' && duel) { if (state === 'win' && winT > 1.0 || state === 'lose' && winT > 0.6) drawOverlay(duel.title, duel.sub, duel.col); }
  else {
    if (state === 'win') { if (winT > 1.2) drawOverlay('VICTORY', (RAID ? TYPES[raidBossId].short : TYPES.boss.short) + '를 쓰러뜨렸습니다!', '#ffd34d'); }
    if (state === 'lose') { if (RS.exited) drawOverlay('나가기', NET.on ? (NET.abortMsg || '전투에서 나갔습니다') : '지금까지의 경험치를 정산했습니다', '#9ad4ff'); else drawOverlay('DEFEAT', NET.raid ? '파티가 모두 쓰러졌습니다...' : HERO.short + '가 쓰러졌습니다...', '#ff5a5a'); }
  }
  if ((state === 'win' && winT > 1.2) || (state === 'lose' && winT > 0.7)) drawXpSummary(); drawDropPanel();   // 이번 판 경험치·레벨업
}

