'use strict';
// ===================================================================
// 비무장 모드 (1~3명 PC 대전, 적도 같은 인원): 태그 없이 시작부터 전투. 플레이어(관우) + 아군 AI 2명(여포 상마·하마) vs 적 AI 3명(관우·여포 상마·하마).
//  AI 도 PC 와 같은 스킬 세트(콤보 3단·스킬1·스킬2·궁극기)와 같은 수치를 쓴다. 제한 시간 3분, 시간이 끝나면 남은 생명력 합계로 승패.
//  - 적 AI = enemies 배열(플레이어 공격이 맞음) / 아군 AI = allies 배열(플레이어 공격에 맞지 않음). 둘 다 fighter 플래그, 행동은 updateFighter 가 처리
// ===================================================================
const DUEL_TIME = 180, DUEL_RAGE = 4, DUEL_R = 560, DUEL_HP = 6000;   // 제한 시간(초), 궁극기 게이지 획득 배율(모든 PC·AI), 경기장 반경
const ARENA_C = { x: WORLD.w / 2, y: WORLD.h / 2 };
const DUEL_NAME = { guan: '관우', lubu: '여포(상마)', lubu2: '여포(하마)', zhao: '조운', diao: '초선', dian: '전위', huang: '황충' }, DUEL_TAG = { guan: '관우', lubu: '상마', lubu2: '하마', zhao: '조운', diao: '초선', dian: '전위', huang: '황충' };
let allies = [], duel = null;
const ROGUE_R = 640;   // 로그라이크 모드 원형 경기장 반경
function arenaClamp(o) {   // 비무장·로그라이크 모드: 경기장 원 밖으로 나가지 못함
  if (mode !== 'duel' && mode !== 'yeonui') return;
  const dx = o.x - ARENA_C.x, dy = o.y - ARENA_C.y, d = Math.hypot(dx, dy), lim = (mode === 'duel' ? DUEL_R : ROGUE_R) - 36;
  if (d > lim) { o.x = ARENA_C.x + dx / d * lim; o.y = ARENA_C.y + dy / d * lim; }
}
let pickOnline = false, pickFold = true;   // pickFold: 영웅 선택 카드의 스킬 정보를 접어 둠 (6명이라 기본은 접힘)   // 비무장 영웅 선택이 온라인(친구와 대전)용인가
function enterMode(i) { if (i === 0) openWaves(); else if (i === 1) openDuelMenu(); else openRaidMenu(); }
// 레이드 입장: 오프라인(내 PC 1~3명) / 온라인(준비 중)
let raidMsgT = 0;
function openRaidMenu() { state = 'raidMenu'; mode = 'yeonui'; raidMsgT = 0; applyGrowth('yeonui'); }
function raidMenuPick(online) { pickOnline = online; openRaidBoss(); sfx('skill'); }
// 레이드 보스 선택 (지금은 여포 봉선만 열려 있음)
const RAID_BOSSES = [
  { id: 'raidBoss', name: '여포 봉선', sub: '기마 → 하마 · 8단계', open: true, art: 'lubu', desc: ['체력이 줄수록 8단계로 강해지고 기마에서 하마로 변하는 보스', '3·6단계에서 부하 소환 · 하마 후 회전 폭풍 · 전쟁의 함성 · 최후의 광폭', '고유 능력: 상태 이상 저항 (경직·스턴·둔화가 거듭될수록 지속시간 감소)'] },
  { id: 'dianBoss', name: '전위 악래', sub: '불사의 광기 · 5단계', open: true, art: 'dian', desc: ['쌍철극 3연 베기 · 쌍극 투척 · 지축 강타 · 충격 돌진으로 몰아붙이는 근접 보스', '포효하면 6초간 광폭(피해 +30%)이 되고, 체력 20% 미만에서 30초간 쓰러지지 않는 불사 보호', '고유 능력: 상태 이상 저항 (경직·스턴·둔화가 거듭될수록 지속시간 감소)'] },
  { name: '관우 운장', sub: '준비 중', open: false }];
const RAID_CFG = { raidBoss: { hp: RAID_HP_SCALE, dmg: RAID_DMGMUL, name: '여포 봉선' }, dianBoss: { hp: DIAN_HP_SCALE, dmg: DIAN_DMGMUL, name: '전위 악래' } };
let raidBossId = 'raidBoss';   // 선택한 레이드 보스
let raidSel = 0;
const RB = { card: i => ({ x: W / 2 - 430 + i * 295, y: 130, w: 270, h: 320 }), go: { x: W / 2 - 160, y: 600, w: 320, h: 60 }, back: BACK_HIT };
function openRaidBoss() { state = 'raidBoss'; mode = 'yeonui'; applyGrowth('yeonui'); raidSel = 0; }
function raidBossNext() { if (!RAID_BOSSES[raidSel].open) { raidMsgT = 2; sfx('hit'); return; } raidBossId = RAID_BOSSES[raidSel].id; if (pickOnline) NET.status = ''; openPick('raid'); sfx('skill'); }
function raidBossClick(x, y) { if (inRect(x, y, RB.back)) { state = 'raidMenu'; return; } for (let i = 0; i < RAID_BOSSES.length; i++) if (inRect(x, y, RB.card(i))) { raidSel = i; if (!RAID_BOSSES[i].open) { raidMsgT = 2; sfx('hit'); } else sfx('hit'); return; } if (inRect(x, y, RB.go)) raidBossNext(); }
function raidBossKey(code) { if (code === 'Escape') state = 'raidMenu'; else if (code === 'ArrowLeft') raidSel = (raidSel + RAID_BOSSES.length - 1) % RAID_BOSSES.length; else if (code === 'ArrowRight') raidSel = (raidSel + 1) % RAID_BOSSES.length; else if (code === 'Enter' || code === 'Space') raidBossNext(); }
function drawRaidBoss() {
  drawLoginScene(); ctx.fillStyle = 'rgba(6,4,14,.55)'; ctx.fillRect(0, 0, W, H);
  backBtn(BACK_BTN);
  text('레이드 보스 선택', W / 2, 62, 40, '#ff8a7a', 'center'); text((pickOnline ? '온라인  ·  보스는 방장이 정합니다 (친구 방에 참가할 때는 아무 보스나 골라도 됩니다)' : '오프라인') + '  ·  보스 한 마리를 쓰러뜨리는 협동 전투', W / 2, 96, 15, COLORS.silver, 'center', false);
  RAID_BOSSES.forEach((b, i) => {
    const r = RB.card(i), sel = i === raidSel; ctx.save(); ctx.globalAlpha = b.open ? 1 : 0.55;
    ctx.fillStyle = sel ? 'rgba(62,26,22,.92)' : 'rgba(18,12,28,.88)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = sel ? COLORS.gold : 'rgba(255,255,255,.28)'; ctx.lineWidth = sel ? 4 : 1.5; ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#e0504a'; ctx.fillRect(r.x, r.y, r.w, 4);
    if (b.open) { const sp = ctx.createRadialGradient(r.x + r.w / 2, r.y + 230, 8, r.x + r.w / 2, r.y + 230, 120); sp.addColorStop(0, 'rgba(255,214,140,.3)'); sp.addColorStop(1, 'rgba(255,214,140,0)'); ctx.fillStyle = sp; ctx.fillRect(r.x, r.y + 100, r.w, 220); ctx.save(); ctx.translate(r.x + r.w / 2, r.y + 250); ctx.scale(1.1, 1.1); drawCardFigure(HEROES[b.art || 'lubu'], 0, 0); ctx.restore(); }
    else { text('🔒', r.x + r.w / 2, r.y + 190, 54, 'rgba(255,255,255,.4)', 'center'); }
    text(b.name, r.x + r.w / 2, r.y + 40, 26, sel ? COLORS.goldText : '#fff', 'center'); text(b.sub, r.x + r.w / 2, r.y + 66, 14, b.open ? '#ffb27a' : COLORS.silverOff, 'center', false);
    ctx.restore();
  });
  const d = RAID_BOSSES[raidSel];
  ctx.fillStyle = 'rgba(12,8,22,.78)'; ctx.fillRect(W / 2 - 430, 470, 860, 112); ctx.strokeStyle = 'rgba(255,211,77,.4)'; ctx.lineWidth = 1.5; ctx.strokeRect(W / 2 - 430, 470, 860, 112);
  if (d.open) {
    text(d.name + '  ·  레이드 보스', W / 2 - 410, 500, 19, COLORS.goldText, 'left');
    d.desc.forEach((t, i) => text(t, W / 2 - 410, 528 + i * 21, 13.5, '#dfe3f5', 'left', false));
  } else text('아직 열리지 않은 보스입니다 (준비 중)', W / 2, 532, 18, '#9aa3b8', 'center');
  const g = RB.go; ctx.globalAlpha = d.open ? 1 : 0.4; ctx.fillStyle = COLORS.panel92; ctx.fillRect(g.x, g.y, g.w, g.h); ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 3; ctx.strokeRect(g.x, g.y, g.w, g.h); text('다음 : 장수 선택 (Enter)', g.x + g.w / 2, g.y + 38, 22, COLORS.gold, 'center'); ctx.globalAlpha = 1;
  if (raidMsgT > 0) { raidMsgT = Math.max(0, raidMsgT - 1 / 60); text('아직 열리지 않은 보스입니다', W / 2, 588, 16, COLORS.goldText, 'center'); }
}
function raidMenuClick(x, y) { if (inRect(x, y, DM.off)) raidMenuPick(false); else if (inRect(x, y, DM.on)) raidMenuPick(true); else if (inRect(x, y, DM.back)) state = 'title'; }
function raidMenuKey(code) { if (code === 'Digit1' || code === 'KeyA' || code === 'ArrowLeft') raidMenuPick(false); else if (code === 'Digit2' || code === 'KeyD' || code === 'ArrowRight') raidMenuPick(true); else if (code === 'Escape') state = 'title'; }
function drawRaidMenu() {
  ctx.drawImage(bg, WORLD.w / 2 - W / 2, WORLD.h / 2 - H / 2, W, H, 0, 0, W, H); ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(0, 0, W, H);
  text('레이드 모드', W / 2, 90, 44, '#ff8a7a', 'center'); text('보스를 골라 1~3명이 함께 쓰러뜨려라', W / 2, 132, 20, COLORS.silver, 'center', false);
  const card = (r, key, title, col, lines, dim) => {
    ctx.globalAlpha = dim ? 0.55 : 1; ctx.fillStyle = COLORS.panel90; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.strokeRect(r.x, r.y, r.w, r.h);
    text(key, r.x + 20, r.y + 34, 20, col, 'left'); text(title, r.x + r.w / 2, r.y + 90, 40, col, 'center');
    lines.forEach((ln, i) => text(fitStr(ln, r.w - 40, 15), r.x + r.w / 2, r.y + 150 + i * 28, 15, i ? COLORS.silver : '#fff', 'center', false)); ctx.globalAlpha = 1;
  };
  card(DM.off, '1', '오프라인', COLORS.gold, ['PC 1 ~ 3명이 동시에 보스와 전투', '내가 1명을 직접 조작 · 나머지는 AI 동료 (태그 없음)', '내 계정의 영웅 레벨 성장 적용', '보스는 체력에 따라 8단계로 강해집니다']);
  card(DM.on, '2', '온라인', COLORS.good, ['친구와 함께 보스를 토벌 (협동 · 최대 3명)', '각자 장수 1명을 골라 동시에 전투', '방 코드로 입장 · 보스는 방장이 정함', '장수 레벨·장비는 각자의 계정 기준']);
  backBtn(BACK_BTN);
}
// 비무장 입장: 오프라인(AI 와 대전) / 온라인(친구와 대전) 선택
const DM = { off: { x: W / 2 - 450, y: 200, w: 430, h: 300 }, on: { x: W / 2 + 20, y: 200, w: 430, h: 300 }, back: BACK_HIT };
function openDuelMenu() { state = 'duelMenu'; mode = 'duel'; applyGrowth('duel'); }
function duelMenuPick(online) { pickOnline = online; openPick('duel'); if (online) { if (NET.paired && NET.team.length) duelPick = NET.team; else NET.team = duelPick; } sfx('skill'); }   // 온라인: 선택한 팀(duelPick)이 곧 NET.team (같은 배열)
function duelMenuClick(x, y) { if (inRect(x, y, DM.off)) duelMenuPick(false); else if (inRect(x, y, DM.on)) duelMenuPick(true); else if (inRect(x, y, DM.back)) state = 'title'; }
function duelMenuKey(code) { if (code === 'Digit1' || code === 'KeyA' || code === 'ArrowLeft') duelMenuPick(false); else if (code === 'Digit2' || code === 'KeyD' || code === 'ArrowRight') duelMenuPick(true); else if (code === 'Escape') state = 'title'; }
function drawDuelMenu() {
  ctx.drawImage(bg, WORLD.w / 2 - W / 2, WORLD.h / 2 - H / 2, W, H, 0, 0, W, H); ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(0, 0, W, H);
  text('비무장 모드', W / 2, 90, 44, COLORS.gold, 'center'); text('어떻게 대전할까요?', W / 2, 132, 20, COLORS.silver, 'center', false);
  const card = (r, key, title, col, lines) => {
    ctx.fillStyle = COLORS.panel90; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.strokeRect(r.x, r.y, r.w, r.h);
    text(key, r.x + 20, r.y + 34, 20, col, 'left'); text(title, r.x + r.w / 2, r.y + 90, 40, col, 'center');
    lines.forEach((ln, i) => text(fitStr(ln, r.w - 40, 15), r.x + r.w / 2, r.y + 150 + i * 28, 15, i ? COLORS.silver : '#fff', 'center', false));
  };
  card(DM.off, '1', '오프라인', COLORS.gold, ['AI 와 1 ~ 3명 대전 (적도 같은 인원)', '제한 시간 3분 · 태그 없이 시작부터 전투', '내 계정의 영웅 레벨 성장이 적용됩니다']);
  card(DM.on, '2', '온라인', COLORS.good, ['방 코드로 친구와 대전 (1~3 vs 1~3)', '제한 시간 3분 · 비무장과 같은 규칙', '영웅 레벨 성장 적용', '(같은 영웅이 양 팀에 있으면 낮은 레벨로 맞춤)']);
  backBtn(BACK_BTN);
}
// 비무장 영웅 선택: PC 3명을 순서대로 고른다 (첫 번째 = 조작 영웅). 적도 같은 3명 — 양쪽 모두 같은 규칙
const PICK_CARD = { w: 196, h: 452, gap: 8, y: 130 }, PICK_BTN = { go: { x: W / 2 - 270, y: 596, w: 250, h: 48 }, goC: { x: W / 2 - 125, y: 596, w: 250, h: 48 }, online: { x: W / 2 + 20, y: 596, w: 250, h: 48 }, back: { x: 12, y: 664, w: 80, h: 30 } };
let duelPick = [], duelLast = null, pickFor = 'duel';
const pickNeed = () => 1;   // 시작에 필요한 최소 인원 (비무장·로그라이크 모두 1~3명. 비무장은 고른 인원수만큼 적도 배치)
const pickStart = () => { if (pickFor === 'duel') startDuel(duelPick); else if (pickFor === 'raid') startRaid(duelPick.slice(0, 3)); else { TEAM = duelPick.slice(0, 3); startGame(TEAM, waveSel - 1); } };   // 로그라이크: 웨이브 선택 다음 영웅 선택 → 출전   // 로그라이크: 영웅 선택 다음 웨이브 선택
const pickCardH = () => pickFold ? 246 : PICK_CARD.h;   // 온라인에서 '장수 정보 접기' 상태면 카드 높이를 줄여 아래에 방 조작 영역을 둔다
const pickCardRect = i => ({ x: W / 2 - (HERO_IDS.length * PICK_CARD.w + (HERO_IDS.length - 1) * PICK_CARD.gap) / 2 + i * (PICK_CARD.w + PICK_CARD.gap), y: PICK_CARD.y, w: PICK_CARD.w, h: pickCardH() });
let duelFoes = [];   // 비무장(오프라인) 상대 팀: 영웅 선택 화면에서 미리 정해 보여 주고, 전투 시작 때 그대로 사용
function foeSync() { const n = duelPick.length; if (duelFoes.length !== n) duelFoes = HERO_IDS.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).slice(0, n).map(v => v[1]); }
// 상대 팀 정보 줄: 영웅 초상 + 이름 + 적용 레벨 + 체력·공격력·방어력(비무장 수치) + 성장 단계 해금 수. rawOf 가 있으면 '상대 원래 레벨'도 함께 표기
function drawFoeRow(R, label, sub, ids, lvOf, rawOf, emptyMsg) {
  ctx.fillStyle = 'rgba(10,12,20,.82)'; ctx.fillRect(R.x, R.y, R.w, R.h); ctx.strokeStyle = COLORS.dangerText; ctx.lineWidth = 2; ctx.strokeRect(R.x, R.y, R.w, R.h);
  text(label, R.x + 12, R.y + 22, 15, '#ff9a8a', 'left'); text(fitStr(sub, 104, 10.5), R.x + 12, R.y + 40, 10.5, '#9aa3b8', 'left', false);
  if (!ids.length) { text(emptyMsg, R.x + R.w / 2 + 50, R.y + R.h / 2 + 6, 15, COLORS.silver, 'center', false); return; }
  const x0 = R.x + 124, cw = (R.w - 134) / 3;
  ids.forEach((id, i) => {
    const x = x0 + i * cw, lv = lvOf(id), m = flatOf(id, lv), hp = DUEL_HP + m.hp * DUEL_HP / HERO_STATS.hp, atk = HERO_STATS.atk + m.atk, un = GROWTH[id].tiers.filter(t => t.lv > 1 && lv >= t.lv).length, cy = R.y + R.h / 2, raw = rawOf ? rawOf(id) : lv;
    ctx.save(); ctx.beginPath(); ctx.arc(x + 20, cy, 19, 0, TAU); ctx.clip(); ctx.translate(x + 20, cy + 4); ctx.scale(0.62, 0.62); drawPortraitIcon(HEROES[id], 0, 0); ctx.restore(); ctx.strokeStyle = COLORS.dangerText; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + 20, cy, 19, 0, TAU); ctx.stroke();
    text(PC_NAME[id], x + 46, cy - R.h * 0.24, 15, COLORS.goldText, 'left'); text('Lv ' + lv + (raw !== lv ? ' (상대 Lv ' + raw + ')' : ''), x + 46 + 52, cy - R.h * 0.24, 13, lv >= MAX_LV ? COLORS.gold : COLORS.goodAlt, 'left');
    text(fitStr('체력 ' + fmtI(hp) + ' · 공격 ' + f1n(atk) + ' · 방어 ' + f1n(m.def), cw - 54, 12), x + 46, cy + 3, 12, '#fff', 'left', false);
    text(fitStr(GROWTH[id].theme.replace(new RegExp(' \\(.*\\)'), '') + ' · 성장 ' + un + '/6', cw - 54, 10.5), x + 46, cy + R.h * 0.25, 10.5, '#ffb27a', 'left', false);
  });
}
const f1n = n => +n.toFixed(1);
function openPick(m) { const gm = m === 'raid' ? 'yeonui' : m; pickFor = m; state = 'pick'; mode = gm; applyGrowth(gm); pickTab = 0; pickFocus = null; pickPrevFoc = undefined; pickPrevSel = {}; duelFoes = []; duelPick = []; }   // 모든 모드: 장수 선택 화면은 비어 있는 상태로 시작 (미리 골라진 장수 없음)
const rOn = () => pickFor === 'raid' && pickOnline;   // 온라인 레이드 방 화면인가
function togglePick(id) {
  if (rOn()) { if (netRaidTaken(id)) { NET.status = '다른 파티원이 이미 고른 장수입니다'; sfx('hit'); return; } if (duelPick[0] === id) duelPick.length = 0; else { duelPick.length = 0; duelPick.push(id); } NET.myReady = false; netRaidMine(); return; }
  const k = duelPick.indexOf(id); if (k >= 0) duelPick.splice(k, 1); else if (duelPick.length < 3) duelPick.push(id); if (pickFor === 'duel' && pickOnline) { NET.myReady = false; netSendTeam(); } }
function pickBack() { if (rOn()) { netClose(); NET.status = ''; } if (pickFor === 'duel') { if (pickOnline) { netClose(); NET.status = ''; } state = 'duelMenu'; } else state = pickFor === 'raid' ? 'raidBoss' : 'waves'; }
// 온라인 방 조작 영역 (영웅 선택 화면 아래): 서버 · 방 만들기 · 방 참가 · 대전 시작 · 장수 정보 접기/펴기 + 상대 팀 정보
function onlineLayout() {
  const by = 130 + pickCardH() + 12, fd = pickFold;
  return { by, url: { x: 24, y: by, w: 300, h: 44 }, create: { x: 332, y: by, w: 120, h: 44 }, join: { x: 460, y: by, w: 120, h: 44 }, start: { x: 588, y: by, w: 130, h: 44 }, fold: { x: 726, y: by, w: 190, h: 44 }, strip: { x: 24, y: by + 54, w: 1232, h: fd ? 112 : 60 } };
}
function drawOnlinePanel() {
  const L = onlineLayout(), bx = (r, label, col, dis, sz = 17) => { ctx.globalAlpha = dis ? 0.4 : 1; ctx.fillStyle = COLORS.panel90; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.strokeRect(r.x, r.y, r.w, r.h); text(fitStr(label, r.w - 12, sz), r.x + r.w / 2, r.y + r.h / 2 + 6, sz, col, 'center'); ctx.globalAlpha = 1; };
  const busy = !!NET.ws, none = false;
  bx(L.url, '서버: ' + NET.url.replace(new RegExp('^wss?://'), ''), '#9ad4ff', busy, 14);
  bx(L.create, '방 만들기', COLORS.good, busy || none); bx(L.join, '방 참가', COLORS.ally, busy || none);
  if (NET.role === 'guest' && NET.paired) bx(L.start, '방장 대기 중', COLORS.goldText, true, 15); else bx(L.start, '대전 시작', COLORS.gold, !(NET.role === 'host' && NET.paired && netReady()));
  if (NET.code) text('방 코드  ' + NET.code, W - 24, L.by + 31, 24, COLORS.gold, 'right');
  if (NET.paired) { const lvT = netLvTable(NET.team, NET.peerTeam); drawFoeRow(L.strip, '상대 팀', NET.peerTeam.length ? '적용 레벨' : '', NET.peerTeam, id => lvT[id] || 1, id => (NET.peerLv || {})[id] || 1, '상대가 영웅을 고르는 중...'); }
  else drawFoeRow(L.strip, '상대 팀', '', [], id => 1, null, '상대가 방에 들어오면 상대 팀의 영웅과 레벨이 표시됩니다');
  if (pickFold) {
    const y = L.strip.y + L.strip.h + 30;
    text('같은 영웅이 양 팀에 있으면 낮은 쪽 레벨로 맞춰 적용됩니다  ·  선택 ' + duelPick.length + ' / 3 (첫 번째 영웅을 직접 조작)', W / 2, y, 14, COLORS.silver, 'center', false);
    if (NET.role === 'guest' && NET.paired) text('방장이 대전을 시작하기를 기다리는 중...', W / 2, y + 34, 20, COLORS.goldText, 'center');
  }
}
const PICK_FOLD_BTN = { x: W - 220, y: 18, w: 196, h: 34 }, pickGoRect = () => ({ x: W / 2 - 125, y: 130 + pickCardH() + 12, w: 250, h: 48 });
function pickClick(x, y) {
  if (newPickUI()) { pickClickNew(x, y); return; }
  if (inRect(x, y, PICK_FOLD_BTN)) { pickFold = !pickFold; sfx('hit'); return; }
  if (pickFor === 'duel' && pickOnline) {
    const L = onlineLayout();
    if (inRect(x, y, L.url) && !NET.ws) { netPromptUrl(); return; }
    if (!NET.ws && inRect(x, y, L.create)) { netCreate(); return; }
    if (!NET.ws && inRect(x, y, L.join)) { netPromptJoin(); return; }
    if (NET.role === 'host' && inRect(x, y, L.start)) { netStartHost(); return; }
  }
  for (let i = 0; i < HERO_IDS.length; i++) if (inRect(x, y, pickCardRect(i))) { togglePick(HERO_IDS[i]); sfx('hit'); return; }
  if (!(pickFor === 'duel' && pickOnline) && inRect(x, y, pickGoRect()) && duelPick.length >= pickNeed()) { pickStart(); return; }
  if (inRect(x, y, PICK_BTN.back)) pickBack();
}
function pickKey(code) {
  if (newPickUI()) { pickKeyNew(code); return; }
  const m = /^Digit([1-6])$/.exec(code); if (m) { const hid = HERO_IDS[+m[1] - 1]; if (hid) togglePick(hid); return; }
  if (code === 'KeyF') { pickFold = !pickFold; return; }
  if (pickFor === 'duel' && pickOnline) { if (code === 'Enter') netStartHost(); else if (code === 'Escape') pickBack(); return; }
  if ((code === 'Enter' || code === 'Space') && duelPick.length >= pickNeed()) pickStart(); else if (code === 'Escape') pickBack();
}
// 영웅 선택 화면에 보이는 스킬 성능 (실제 전투 수치에서 계산: 기본 공격력 x 배율 x 영웅 보정 계수 bal, 레벨 성장은 별도 표기)
const fmtI = n => Math.round(n).toLocaleString('en-US');
function heroSkillRows(id) {
  if (id === 'lubu') {   // 여포: 상마 / 하마 두 폼의 수치를 함께 표시
    const A = HERO_STATS.atk + (ACC ? flatTot(id, heroLv(id)).atk : 0), SK = A * SKILL_DMG_MULT, hm = HEROES.lubu.bal, hf = HEROES.lubu2.bal, sp = RUSH_SPECS.three, sum = tb => tb.reduce((t, c) => t + c.mult.reduce((x, y) => x + y, 0), 0);
    return [
      { n: 'J · 공격 (상마 / 하마)', c1: '3단 콤보 합계 ' + fmtI(sum(LUBU_ATK) * A * hm.a) + ' / ' + fmtI(sum(LUBU2_ATK) * A * hf.a), c2: '범위 ' + LUBU_ATK.map(c => Math.round(c.rad)).join('·') + ' / ' + LUBU2_ATK.map(c => Math.round(c.rad)).join('·') },
      { n: 'K · ' + HEROES.lubu.skills.s1 + ' / ' + HEROES.lubu2.skills.s1, c1: '상마 ↔ 하마 전환 + 360° 베기 1회', c2: '쿨 ' + CD.s1 + '초 · 체력·분노 유지 · 스킬2 쿨은 폼별' },
      { n: 'L · 돌격 (상마) / 연사 (하마)', c1: '돌격 피해 ' + fmtI(SK * 3.4 * hm.s2) + ' / 연사 합계 ' + fmtI(SK * 2.4 * S2_ARROW_MULT * 9 * hf.s2), c2: '쿨 ' + CD.s2 + '초 · 폼에 따라 스킬이 바뀜' },
      { n: '; · 적토 돌격 (상마) / 천하무쌍 (하마)', c1: '3연속 질주 합계 ' + fmtI((sp.dmg * sp.n + 1) * SK * sp.mult * hm.u) + ' / 범위 ' + ULT_RADIUS + ' 피해 ' + fmtI(A * 6.5 * SKILL_DMG_MULT * ULT_DMG_MULT * hf.u) + ' (360° + 검기 12연타)', c2: '둘 다 기절 2.2초 · 사용 후 공격 증가' },
    ];
  }
  if (id === 'huang') {   // 황충: 백보천양 · 화살비 · 마법의 수정화살
    const H = HEROES.huang, b = H.bal, A = HERO_STATS.atk + (ACC ? flatTot(id, heroLv(id)).atk : 0), SK = A * SKILL_DMG_MULT, sum = HUANG_ATK.reduce((t, c) => t + c.mult.reduce((x, y) => x + y, 0), 0);
    return [
      { n: 'J · ' + H.skills.attack, c1: '3단 콤보 합계 피해 ' + fmtI(sum * A * b.a) + ' (5발) · 먼 적 최대 +' + Math.round(HUANG_FAR * 100) + '%', c2: '사거리 ' + HUANG_ATK.map(c => Math.round(c.rad)).join('·') + ' · 이동 사격 · 3단 성공 시 공속 +' + Math.round((H.aspdBuff.mult - 1) * 100) + '% (' + H.aspdBuff.dur + '초)' },
      { n: 'K · ' + H.skills.s1, c1: '후퇴 사격 · 강궁 ' + HUANG_K + '발 관통 · 한 발 피해 ' + fmtI(A * 0.85 * SKILL_DMG_MULT * S1_DMG_MULT * 3.0 * b.s1) + ' (먼 적 최대 +40%)', c2: '사거리 ' + Math.round(SNIPE_SPD * SNIPE_LIFE) + ' · 쿨 ' + CD.s1 + '초' },
      { n: 'L · ' + H.skills.s2, c1: '구역 ' + RAIN_N + '회 낙하 · 한 번 피해 ' + fmtI(A * 0.75 * SKILL_DMG_MULT * 3.0 * b.s2), c2: '반경 ' + RAIN_R + ' · 사거리 900 · 둔화 -45% · 시전 중 슈퍼아머·이동 가능 · 쿨 ' + CD.s2 + '초' },
      { n: '; · ' + H.skills.s3, c1: '피해 ' + fmtI(A * 6.5 * SKILL_DMG_MULT * ULT_DMG_MULT * b.u) + ' · 기절 ' + (1 * (1 + CRYSTAL_STUN_UP)).toFixed(1) + ' ~ ' + Math.min(3.5 * (1 + CRYSTAL_STUN_UP), 7).toFixed(1) + '초 (멀수록 길게)', c2: '사거리 ' + Math.round(CRYSTAL_SPD * CRYSTAL_LIFE) + ' · 주변 폭발 피해 40% · 보스는 기절 최대 2초' }];
  }
  if (id === 'dian') {   // 전위: 쌍극 투척 · 지축 강타 · 불사의 광기
    const H = HEROES.dian, b = H.bal, A = HERO_STATS.atk + (ACC ? flatTot(id, heroLv(id)).atk : 0), SK = A * SKILL_DMG_MULT, sum = DIAN_ATK.reduce((t, c) => t + c.mult.reduce((x, y) => x + y, 0), 0), U = H.undy;
    return [
      { n: 'J · ' + H.skills.attack, c1: '3단 콤보 합계 피해 ' + fmtI(sum * A * b.a) + ' (3타)', c2: '범위 ' + DIAN_ATK.map(c => Math.round(c.rad)).join('·') + ' · 3단 성공 시 공격력 +' + Math.round((H.comboBuff.atk - 1) * 100) + '% (' + H.comboBuff.dur + '초)' },
      { n: 'K · ' + H.skills.s1, c1: '쌍극 ' + DIAN_BLADES + '자루 관통 · 한 자루 피해 ' + fmtI(A * 0.85 * SKILL_DMG_MULT * S1_DMG_MULT * 1.6 * b.s1), c2: '사거리 ' + Math.round(BLADE_SPEED * BLADE_LIFE) + ' · 쿨 ' + CD.s1 + '초' },
      { n: 'L · ' + H.skills.s2, c1: '파고들어 내려찍기 피해 ' + fmtI(SK * 3.0 * b.s2), c2: '반경 ' + SLAM_R + ' · 멀리 밀쳐냄 · 쿨 ' + CD.s2 + '초' },
      { n: '; · ' + H.skills.s3, c1: '시전마다 ' + U.dur.toFixed(1) + '초 공격력 +' + Math.round((U.atk - 1) * 100) + '% · 흡혈 ' + Math.round(U.ls * 100) + '%', c2: '전투당 1회 ' + U.floor + '초간 죽지 않음(생명력 1 보호) · 포효 폭발 ' + fmtI(SK * 2.0 * b.u) + ' (반경 240) · 시전 중 무적' }];
  }
  if (id === 'diao') {   // 초선(힐러): 회복량 중심 표기
    const H = HEROES.diao, b = H.bal, A = HERO_STATS.atk + (ACC ? flatTot(id, heroLv(id)).atk : 0), SK = A * SKILL_DMG_MULT, hm = healMul(), q = v => +(v * 100 * hm).toFixed(1), qo = v => +(v * 100 * (mode === 'duel' ? DUEL_HEAL_OTHER : hm)).toFixed(1), hs = v => mode === 'duel' ? '자신 +' + q(v) + '% / 다른 아군 +' + qo(v) + '%' : '아군 +' + q(v) + '%', n = DIAO_S1_TIMES.length, sum = DIAO_ATK.reduce((t, c) => t + c.mult.reduce((x, y) => x + y, 0), 0);
    return [
      { n: 'J · ' + H.skills.attack, c1: '3단 콤보 합계 피해 ' + fmtI(sum * A * b.a) + ' (3타)', c2: '범위 ' + DIAO_ATK.map(c => Math.round(c.rad)).join('·') + ' · 3단 성공 시 아군 생명력 +' + q(DIAO_HEAL.combo * HEAL_POW) + '%' },
      { n: 'K · ' + H.skills.s1, c1: '연꽃 ' + n + '회 · 매회 생명력 ' + hs(DIAO_HEAL.pulse * HEAL_POW), c2: '회복 범위 ' + HEAL_R + ' · 적 합계 피해 ' + fmtI(A * 0.85 * SKILL_DMG_MULT * S1_DMG_MULT * b.s1 * n) + ' · 쿨 ' + CD.s1 + '초 · 슈퍼아머' },
      { n: 'L · ' + H.skills.s2, c1: '아군 전체 공격력 +' + Math.round(BLESS_ATK * 100) + '% · 방어력 +' + Math.round(BLESS_DEF * 100) + '% (' + BLESS_DUR + '초)', c2: '주변 적 피해 ' + fmtI(SK * 1.2 * b.s2) + ' · 밀쳐냄 · 쿨 ' + CD.s2 * (H.s2cdMul || 1) + '초' },
      { n: '; · ' + H.skills.s3, c1: '범위 ' + ULT_HEAL_R + ' 생명력 ' + hs(DIAO_HEAL.ult * ULT_HEAL_POW) + ' · 적 피해 ' + fmtI(A * 6.5 * SKILL_DMG_MULT * ULT_DMG_MULT * b.u), c2: '범위 ' + ULT_RADIUS + ' 적 기절 2.2초 · 무적 연출' + (mode === 'duel' ? '' : ' · 대기 중인 동료도 회복') },
    ];
  }
  const H = HEROES[id], b = H.bal, A = HERO_STATS.atk + (ACC ? flatTot(id, heroLv(id)).atk : 0), S1U = A * 0.85 * SKILL_DMG_MULT * S1_DMG_MULT * b.s1, SK = A * SKILL_DMG_MULT;
  const tb = id === 'zhao' ? ZHAO_ATK : id === 'lubu' ? LUBU_ATK : id === 'lubu2' ? LUBU2_ATK : id === 'diao' ? DIAO_ATK : id === 'dian' ? DIAN_ATK : id === 'huang' ? HUANG_ATK : GUAN_ATK;
  const comboDmg = tb.reduce((t, c) => t + c.mult.reduce((x, y) => x + y, 0), 0) * A * b.a, comboHits = tb.reduce((t, c) => t + c.hits.length, 0);
  const rows = [{ n: 'J · ' + H.skills.attack, c1: tb.length + '단 콤보 합계 피해 ' + fmtI(comboDmg) + ' (' + comboHits + '타)', c2: '범위 ' + tb.map(c => Math.round(c.rad)).join('·') + (id === 'lubu' ? ' · 공속 -10%' : '') }];
  if (id === 'guan') rows.push({ n: 'K · ' + H.skills.s1, c1: '3연속 360° 회전 합계 ' + fmtI(S1U * 3), c2: '반경 ' + S1_RADIUS + ' · 쿨 ' + CD.s1 + '초 · 슈퍼아머' });
  else if (id === 'lubu') rows.push({ n: 'K · ' + H.skills.s1, c1: '전방 직선 일격 피해 ' + fmtI(S1U * 3), c2: '길이 ' + Math.round(THRUST_LEN) + ' · 쿨 ' + CD.s1 + '초 · 슈퍼아머' });
  else if (id === 'lubu2') rows.push({ n: 'K · ' + H.skills.s1, c1: '3연속 부채꼴 합계 ' + fmtI(S1U * CONE_HITS.reduce((t, h) => t + h.mult, 0)), c2: '반경 ' + CONE_HITS.map(h => h.r).join('·') + ' · 쿨 ' + CD.s1 + '초' });
  else rows.push({ n: 'K · ' + H.skills.s1, c1: '전방 직선 ' + FLURRY_TIMES.length + '연속 찌르기 합계 ' + fmtI(S1U * FLURRY_MULT * FLURRY_TIMES.length), c2: '길이 ' + FLURRY_LEN + ' · 쿨 ' + CD.s1 * (H.s1cdMul || 1) + '초 · 슈퍼아머' });
  if (id === 'lubu2') rows.push({ n: 'L · ' + H.skills.s2, c1: '관통 화살 3x3 합계 ' + fmtI(SK * 2.4 * S2_ARROW_MULT * 9 * b.s2), c2: '사거리 ' + Math.round(950 * ARROW_LIFE) + ' · 쿨 ' + CD.s2 + '초' });
  else if (id === 'guan') rows.push({ n: 'L · ' + H.skills.s2, c1: '돌진 + 폭발 피해 ' + fmtI(SK * 3.4 * b.s2), c2: '폭발 반경 ' + S2_BLAST + ' · 쿨 ' + CD.s2 + '초 · 멀리 밀침' });
  else rows.push({ n: 'L · ' + H.skills.s2, c1: '질주 ' + RUSH_LEN + ' + 폭발 피해 ' + fmtI(SK * 3.4 * b.s2), c2: '폭발 반경 ' + (id === 'zhao' ? RUSH_SPECS.zhao.blastR : S2_BLAST) + ' · 쿨 ' + CD.s2 + '초' });
  if (id === 'lubu') { const sp = RUSH_SPECS.three; rows.push({ n: '; · ' + H.skills.s3, c1: sp.n + '연속 질주 합계 ' + fmtI((sp.dmg * sp.n + 1) * SK * sp.mult * b.u * A / A), c2: '무적 · 기절 2.2초 · 폭발 ' + sp.blastR }); }
  else if (id === 'zhao') rows.push({ n: '; · ' + H.skills.s3, c1: '범위 ' + ULT_RADIUS + ' 내 최대 ' + ZU_MAX + '명 · 대상당 ' + ZU_H + '연속 찌르기 합계 ' + fmtI(A * 6.5 * SKILL_DMG_MULT * ULT_DMG_MULT * b.u), c2: '고속 이동 · 이동 중 충돌 없음 · 기절 2.2초 · 무적' });
  else rows.push({ n: '; · ' + H.skills.s3, c1: '범위 ' + ULT_RADIUS + ' 피해 ' + fmtI(A * 6.5 * SKILL_DMG_MULT * ULT_DMG_MULT * b.u), c2: '기절 2.2초 · 무적 연출' + (id === 'guan' ? ' · 방어 +50%' : '') });
  return rows;
}
function wrapLeft(str, x, y, maxW, size, col, maxLines = 2, lh = size + 3) {
  ctx.font = '500 ' + size + 'px ' + FONT; let line = '', ly = y, n = 0;
  for (const ch of str) { if (ctx.measureText(line + ch).width > maxW) { text(line, x, ly, size, col, 'left', false, false); n++; if (n >= maxLines) return; line = ch; ly += lh; } else line += ch; }
  if (line) text(line, x, ly, size, col, 'left', false, false);
}
const PICK_NOTE = id => id === 'lubu' ? '상마: ' + HEROES.lubu.sub + ' · ' + HEROES.lubu.sub2 + '  /  하마: ' + HEROES.lubu2.sub : HEROES[id].sub + (HEROES[id].sub2 ? ' · ' + HEROES[id].sub2 : '');
// ===== 새 장수 선택 화면 (왼쪽 영웅 목록 · 가운데 영웅 · 오른쪽 정보 패널 · 아래 파티 슬롯 + 시작) — 온라인 대전만 아래 기존 화면을 쓴다 =====
const newPickUI = () => true;   // 모든 모드(온라인 대전 포함)가 같은 장수 선택 화면을 쓴다
let pickFocus = null, pickTab = 0;
let pickFocT = -9, pickPopT = {}, pickPrevFoc, pickPrevSel = {};   // 장수 선택 화면의 부드러운 전환: 가운데 장수 바뀐 시각 / 장수별 선택·해제 시각
const easeOut = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
const PK = { back: BACK_HIT, list: i => ({ x: 22, y: 92 + i * 80, w: 184, h: 72 }), arrL: { x: 224, y: 270, w: 42, h: 84 }, arrR: { x: 598, y: 270, w: 42, h: 84 }, toggle: { x: 262, y: 520, w: 340, h: 46 }, tab: i => ({ x: 700 + i * 172, y: 184, w: 160, h: 38 }), slot: i => ({ x: 24 + i * 162, y: 604, w: 152, h: 100 }), go: { x: W - 304, y: 610, w: 280, h: 86 }, on: { url: { x: 530, y: 600, w: 200, h: 34 }, create: { x: 738, y: 600, w: 100, h: 34 }, join: { x: 846, y: 600, w: 100, h: 34 } }, panel: { x: 680, y: 92, w: 576, h: 484 } };
function backBtn(b) { ctx.save(); ctx.fillStyle = 'rgba(10,8,20,.8)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 2.5; ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = COLORS.goldText; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(b.x + b.w / 2 + 7, b.y + 14); ctx.lineTo(b.x + b.w / 2 - 7, b.y + b.h / 2); ctx.lineTo(b.x + b.w / 2 + 7, b.y + b.h - 14); ctx.stroke(); ctx.restore(); }
const pickSlotLabels = () => (pickFor === 'duel' || pickFor === 'raid') ? ['조작', '아군 AI', '아군 AI'] : ['시작', '태그 Z', '태그 X'];
function pickCycleFocus(d) { if (!pickFocus) { pickFocus = d > 0 ? HERO_IDS[0] : HERO_IDS[HERO_IDS.length - 1]; sfx('hit'); return; } const i = Math.max(0, HERO_IDS.indexOf(pickFocus)); pickFocus = HERO_IDS[(i + d + HERO_IDS.length) % HERO_IDS.length]; sfx('hit'); }
function pickClickNew(x, y) {
  if (inRect(x, y, PK.back)) { pickBack(); sfx('hit'); return; }
  for (let i = 0; i < HERO_IDS.length; i++) if (inRect(x, y, PK.list(i))) { pickFocus = HERO_IDS[i]; togglePick(HERO_IDS[i]); sfx('hit'); try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) { } return; }
  if (inRect(x, y, PK.arrL)) { pickCycleFocus(-1); return; } if (inRect(x, y, PK.arrR)) { pickCycleFocus(1); return; }
  if (inRect(x, y, PK.toggle)) { if (pickFocus) { togglePick(pickFocus); sfx('hit'); } return; }
  for (let i = 0; i < 2; i++) if (inRect(x, y, PK.tab(i))) { pickTab = i; sfx('hit'); return; }
  if (!rOn()) for (let i = 0; i < 3; i++) if (inRect(x, y, PK.slot(i))) { if (duelPick[i]) { pickFocus = duelPick[i]; if (duelPick.length > 0) { togglePick(duelPick[i]); } } sfx('hit'); return; }
  if ((pickFor === 'duel' || pickFor === 'raid') && pickOnline) {   // 온라인 대전·레이드: 서버 · 방 만들기 · 방 참가 · 시작
    if (!NET.ws && inRect(x, y, PK.on.url)) { netPromptUrl(); return; }
    if (!NET.ws && inRect(x, y, PK.on.create)) { netCreate(); return; }
    if (!NET.ws && inRect(x, y, PK.on.join)) { netPromptJoin(); return; }
    if (NET.role === 'host' && inRect(x, y, PK.go)) { if (pickFor === 'raid') netRaidStartHost(); else netStartHost(); }
    else if (NET.role === 'guest' && NET.paired && inRect(x, y, PK.go)) netToggleReady();
    return;
  }
  if (inRect(x, y, PK.go) && duelPick.length >= pickNeed()) pickStart();
}
function pickKeyNew(code) {
  const m = /^Digit([1-6])$/.exec(code); if (m) { pickFocus = HERO_IDS[+m[1] - 1]; togglePick(pickFocus); return; }
  if (code === 'ArrowLeft' || code === 'ArrowUp') pickCycleFocus(-1); else if (code === 'ArrowRight' || code === 'ArrowDown') pickCycleFocus(1);
  else if (code === 'Space') { if (pickFocus) togglePick(pickFocus); } else if (code === 'Tab' || code === 'KeyF') pickTab = 1 - pickTab;
  else if (code === 'Enter') { if (NET.role === 'guest' && pickOnline && (pickFor === 'duel' || pickFor === 'raid')) netToggleReady(); else if (rOn()) netRaidStartHost(); else if (pickFor === 'duel' && pickOnline) netStartHost(); else if (duelPick.length >= pickNeed()) pickStart(); } else if (code === 'Escape') pickBack();
}
function drawPickOnline() {   // 아래 가운데: 서버 · 방 만들기 · 방 참가 / 방 코드·상태 / 상대 팀(적용 레벨)
  const L = PK.on, busy = !!NET.ws, none = false;
  const bx = (r, label, col, dis, sz) => { ctx.globalAlpha = dis ? 0.45 : 1; ctx.fillStyle = COLORS.panel92; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(r.x, r.y, r.w, r.h); text(fitStr(label, r.w - 12, sz), r.x + r.w / 2, r.y + r.h / 2 + 5, sz, col, 'center'); ctx.globalAlpha = 1; };
  bx(L.url, '서버: ' + (NET.url ? NET.url.replace(/^wss?:\/\//, '') : '미설정 (눌러서 입력)'), '#9ad4ff', busy, 12); bx(L.create, '방 만들기', COLORS.good, busy || none, 15); bx(L.join, '방 참가', COLORS.ally, busy || none, 15);
  if (NET.code) { text('방 코드  ' + NET.code, 530, 662, 21, COLORS.gold, 'left'); if (NET.status) text(fitStr(NET.status, 240, 12), 706, 662, 12, COLORS.goldText, 'left', false); }
  else text(fitStr(NET.status || '방을 만들거나 친구의 방 코드로 참가하세요', 430, 13), 530, 660, 13, COLORS.goldText, 'left', false);
  const lvT = NET.paired ? netLvTable(NET.team, NET.peerTeam) : {};
  text('상대 팀', 530, 694, 12, '#ff9a8a', 'left');
  if (NET.paired && NET.peerTeam.length) NET.peerTeam.forEach((fid, i) => { const x = 612 + i * 118, ap = lvT[fid] || 1, og = (NET.peerLv || {})[fid] || 1; ctx.save(); ctx.beginPath(); ctx.arc(x, 688, 17, 0, TAU); ctx.clip(); ctx.translate(x, 691); ctx.scale(0.6, 0.6); drawPortraitIcon(HEROES[fid], 0, 0); ctx.restore(); ctx.strokeStyle = COLORS.dangerText; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, 688, 17, 0, TAU); ctx.stroke(); text('Lv ' + ap, x + 22, 693, 13, '#fff', 'left'); if (og !== ap) text('(원 ' + og + ')', x + 22, 706, 10, '#9aa3b8', 'left', false); });
  else text(NET.paired ? '상대가 영웅을 고르는 중...' : '상대가 방에 들어오면 상대 팀의 영웅과 레벨이 표시됩니다', 612, 693, 12, COLORS.silverOff, 'left', false);
  if (NET.role === 'guest' && NET.paired) text(NET.myReady ? '준비 완료 — 방장이 시작하기를 기다리는 중...' : '장수를 고른 뒤 오른쪽 아래 "준비"를 누르세요', 530, 714, 12, NET.myReady ? COLORS.good : COLORS.goldText, 'left', false);
  else if (NET.role === 'host' && NET.paired) text(NET.peerReady ? '상대가 준비했습니다 — 대전을 시작할 수 있습니다' : '상대가 준비하기를 기다리는 중...', 530, 714, 12, NET.peerReady ? COLORS.good : COLORS.silver, 'left', false);
}
function drawPickEmpty() {   // 아직 아무 장수도 고르지 않았을 때: 가운데에 빈 자리 표시
  const fx0 = 432, fy0 = 500; ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.beginPath(); ctx.ellipse(fx0, fy0 + 8, 150, 38, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.arc(fx0, 330, 118, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  text('?', fx0, 366, 120, 'rgba(255,255,255,.2)', 'center');
  ctx.restore();
  ctx.fillStyle = 'rgba(70,72,86,.92)'; ctx.fillRect(fx0 - 84, 112, 168, 30); text('선택한 장수 없음', fx0, 133, 14, COLORS.silver, 'center');
  const t = PK.toggle; ctx.globalAlpha = 0.6; ctx.fillStyle = 'rgba(30,30,40,.9)'; ctx.fillRect(t.x, t.y, t.w, t.h); ctx.strokeStyle = '#6f7690'; ctx.lineWidth = 2; ctx.strokeRect(t.x, t.y, t.w, t.h); ctx.globalAlpha = 1;
  text('왼쪽 목록에서 장수를 눌러 선택하세요', t.x + t.w / 2, t.y + 30, 18, COLORS.silverOff, 'center');
}
function drawPickNew() {
  if (!pickFocus && duelPick.length) pickFocus = duelPick[0];   // 고른 장수가 있으면 그 장수를 보여 준다 / 없으면 비어 있는 상태
  const empty = !pickFocus;
  if (pickFocus !== pickPrevFoc) { pickPrevFoc = pickFocus; pickFocT = T; }
  for (const q of HERO_IDS) { const on = duelPick.includes(q); if (on !== !!pickPrevSel[q]) { pickPopT[q] = T; pickPrevSel[q] = on; } }
  drawLoginScene(); ctx.fillStyle = 'rgba(6,4,14,.62)'; ctx.fillRect(0, 0, W, H);
  const duelP = pickFor === 'duel', id = pickFocus || HERO_IDS[0], h = HEROES[id], inT = duelPick.indexOf(id), rec = ACC ? heroRec(ACC, id) : { lv: 1, xp: 0 }, lv = rec.lv;
  backBtn(BACK_BTN);
  const ttl = pickFor === 'raid' ? '레이드' + (pickOnline ? ' (온라인)' : '') + '  ·  ' + RAID_CFG[raidBossId].name : pickFor === 'duel' ? '비무장 모드 (' + (pickOnline ? '온라인' : '오프라인') + ')' : '로그라이크  ·  W' + waveSel + '부터';
  text(ttl, 90, 40, 24, COLORS.gold, 'left'); text(rOn() ? '장수 선택  —  파티원마다 1명씩 · 같은 영웅은 중복 선택 불가 · 각자 자기 영웅을 직접 조작' : '장수 선택  —  최대 3명 · ' + (pickFor === 'yeonui' ? '선택한 순서대로 시작 영웅과 태그(Z/X/C)' : '첫 번째 영웅을 직접 조작, 나머지는 AI 동료') + (pickFor === 'duel' && pickOnline ? '  ·  같은 영웅이 양 팀에 있으면 낮은 쪽 레벨로 맞춰 적용' : ''), 90, 62, 13, COLORS.silver, 'left', false);
  // 왼쪽 영웅 목록
  HERO_IDS.forEach((hid, i) => {
    const pr0 = PK.list(i), pk = clamp((T - (pickPopT[hid] || -9)) / 0.3, 0, 1), pop = 1 + 0.06 * Math.sin(Math.PI * pk), pcx = pr0.x + pr0.w / 2, pcy = pr0.y + pr0.h / 2;
    ctx.save(); ctx.translate(pcx, pcy); ctx.scale(pop, pop); ctx.translate(-pcx, -pcy);
    const r = PK.list(i), hh = HEROES[hid], foc = !empty && hid === id, k = duelPick.indexOf(hid), rc = ACC ? heroRec(ACC, hid) : { lv: 1 };
    ctx.fillStyle = foc ? 'rgba(62,46,16,.92)' : 'rgba(14,10,26,.82)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = foc ? COLORS.gold : k >= 0 ? COLORS.ally : 'rgba(255,255,255,.22)'; ctx.lineWidth = foc ? 3 : 1.5; ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.save(); ctx.beginPath(); ctx.arc(r.x + 40, r.y + 36, 26, 0, TAU); ctx.clip(); ctx.translate(r.x + 40, r.y + 40); ctx.scale(0.9, 0.9); drawPortraitIcon(hh, 0, 0); ctx.restore(); ctx.strokeStyle = COLORS.goldTrim; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x + 40, r.y + 36, 26, 0, TAU); ctx.stroke();
    text(PC_NAME[hid], r.x + 76, r.y + 32, 18, foc ? COLORS.goldText : '#fff', 'left'); text('Lv ' + rc.lv, r.x + 76, r.y + 54, 13, rc.lv >= MAX_LV ? COLORS.gold : COLORS.goodAlt, 'left', false);
    if (k >= 0) { ctx.fillStyle = k === 0 ? COLORS.gold : COLORS.ally; circle(r.x + r.w - 20, r.y + 20, 14); text(String(k + 1), r.x + r.w - 20, r.y + 26, 17, '#111', 'center'); }
    if (rOn() && netRaidTaken(hid)) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(r.x, r.y, r.w, r.h); text('선택됨', r.x + r.w - 10, r.y + r.h - 10, 12, '#ff9a8a', 'right'); }
    if (k >= 0 && pk < 1) { ctx.strokeStyle = 'rgba(255,211,77,' + (0.7 * (1 - pk)) + ')'; ctx.lineWidth = 6; ctx.strokeRect(r.x - 4 - 6 * pk, r.y - 4 - 6 * pk, r.w + 8 + 12 * pk, r.h + 8 + 12 * pk); }   // 선택 순간 금빛 파문
    ctx.restore();
  });
  // 가운데 영웅
  if (empty) drawPickEmpty(); else { const fx0 = 432, fy0 = 500, sp = ctx.createRadialGradient(fx0, fy0 + 8, 10, fx0, fy0 + 8, 200); sp.addColorStop(0, 'rgba(255,214,140,.4)'); sp.addColorStop(1, 'rgba(255,214,140,0)'); ctx.fillStyle = sp; ctx.save(); ctx.translate(fx0, fy0 + 8); ctx.scale(1, 0.26); ctx.translate(-fx0, -(fy0 + 8)); ctx.fillRect(fx0 - 220, fy0 - 220, 440, 440); ctx.restore();
    { const ea = easeOut((T - pickFocT) / 0.26); ctx.save(); ctx.globalAlpha = ea; ctx.translate(fx0 - 40 * (1 - ea), fy0); const sc = (h.mounted ? 1.8 : 2.2) * (0.93 + 0.07 * ea); ctx.scale(sc, sc); drawCardFigure(h, 0, 0); ctx.restore(); }
    for (const [b, d] of [[PK.arrL, -1], [PK.arrR, 1]]) { ctx.fillStyle = 'rgba(10,8,20,.55)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = COLORS.goldText; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(b.x + b.w / 2 - d * 6, b.y + 26); ctx.lineTo(b.x + b.w / 2 + d * 6, b.y + b.h / 2); ctx.lineTo(b.x + b.w / 2 - d * 6, b.y + b.h - 26); ctx.stroke(); }
    if (inT >= 0) { ctx.fillStyle = inT === 0 ? COLORS.gold : COLORS.ally; ctx.fillRect(fx0 - 56, 112, 112, 30); text((inT + 1) + '번  ' + pickSlotLabels()[inT], fx0, 133, 15, '#111', 'center'); } else { ctx.fillStyle = 'rgba(70,72,86,.92)'; ctx.fillRect(fx0 - 84, 112, 168, 30); text('선택 안 함', fx0, 133, 14, COLORS.silver, 'center'); }
    const t = PK.toggle; ctx.fillStyle = inT >= 0 ? 'rgba(60,18,18,.9)' : 'rgba(18,40,24,.9)'; ctx.fillRect(t.x, t.y, t.w, t.h); ctx.strokeStyle = inT >= 0 ? '#ff9a8a' : COLORS.good; ctx.lineWidth = 2.5; ctx.strokeRect(t.x, t.y, t.w, t.h); const tk = rOn() && inT < 0 && netRaidTaken(id); text(rOn() ? (inT >= 0 ? '선택 해제' : tk ? '다른 파티원이 고른 장수입니다' : '이 장수로 선택') : inT >= 0 ? '선택 해제 (파티에서 제외)' : duelPick.length >= 3 ? '파티가 가득 찼습니다 (3/3)' : '이 장수를 선택 (파티에 추가)', t.x + t.w / 2, t.y + 30, 19, inT >= 0 ? '#ff9a8a' : tk || (!rOn() && duelPick.length >= 3) ? COLORS.silverOff : COLORS.good, 'center'); }
  // 오른쪽 정보 패널
  if (empty) { const p = PK.panel; ctx.fillStyle = 'rgba(14,10,26,.9)'; ctx.fillRect(p.x, p.y, p.w, p.h); ctx.strokeStyle = 'rgba(255,211,77,.35)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.strokeRect(p.x, p.y, p.w, p.h); ctx.setLineDash([]); text('선택한 장수가 없습니다', p.x + p.w / 2, p.y + 220, 26, COLORS.silverOff, 'center'); text('왼쪽 목록에서 장수를 누르면 바로 선택됩니다.', p.x + p.w / 2, p.y + 262, 14, '#6f7690', 'center', false); text('선택한 장수를 다시 누르면 선택이 해제됩니다.', p.x + p.w / 2, p.y + 284, 14, '#6f7690', 'center', false); } else { const p = PK.panel; ctx.fillStyle = 'rgba(14,10,26,.9)'; ctx.fillRect(p.x, p.y, p.w, p.h); ctx.strokeStyle = COLORS.goldGlow55; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, p.w, p.h);
    text(PC_NAME[id], p.x + 22, p.y + 44, 32, COLORS.goldText, 'left'); text('Lv ' + lv, p.x + p.w - 22, p.y + 44, 30, lv >= MAX_LV ? COLORS.gold : COLORS.goodAlt, 'right'); text(GROWTH[id].theme, p.x + 22, p.y + 68, 14, '#ffb27a', 'left', false);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(p.x + 22, p.y + 80, p.w - 44, 12); ctx.fillStyle = '#4fd36a'; ctx.fillRect(p.x + 23, p.y + 81, (p.w - 46) * (lv >= MAX_LV ? 1 : rec.xp / xpNeed(lv)), 10); text(lv >= MAX_LV ? 'MAX' : 'EXP ' + rec.xp + ' / ' + xpNeed(lv), p.x + p.w - 22, p.y + 108, 11, '#9aa3b8', 'right', false);
    ['스테이터스', '스킬'].forEach((nm, i) => { const r = PK.tab(i), on = pickTab === i; ctx.fillStyle = on ? 'rgba(212,167,58,.9)' : COLORS.panelHi90; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = on ? COLORS.gold : 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.5; ctx.strokeRect(r.x, r.y, r.w, r.h); text(nm, r.x + r.w / 2, r.y + 26, 17, on ? '#2a1c06' : COLORS.silver, 'center'); });
    if (pickTab === 0) {
      const lf = ACC ? flatTot(id, lv) : zeroFlat(), hb = duelP ? DUEL_HP : HERO_STATS.hp, ha = duelP ? lf.hp * DUEL_HP / HERO_STATS.hp : lf.hp, atk = HERO_STATS.atk + lf.atk, df = lf.def;
      let refHp = 1, refAtk = 1, refDef = 1; for (const q of HERO_IDS) { const f = ACC ? flatTot(q, heroLv(q)) : zeroFlat(); refHp = Math.max(refHp, hb + (duelP ? f.hp * DUEL_HP / HERO_STATS.hp : f.hp)); refAtk = Math.max(refAtk, HERO_STATS.atk + f.atk); refDef = Math.max(refDef, f.def, 1); }
      const bars = [['체력', hb + ha, refHp, fmtI(hb + ha) + '  (기본 ' + fmtI(hb) + ' +' + fmtI(ha) + ')', '#ff5a6a'], ['공격력', atk, refAtk, (+atk.toFixed(1)) + '  (기본 ' + HERO_STATS.atk + ' +' + (+lf.atk.toFixed(1)) + ')', '#ff9a3a'], ['방어력', df, refDef, (+df.toFixed(1)) + '  ·  받는 피해 -' + (+(100 - 100 / (1 + df / 100)).toFixed(1)) + '%', '#5aa8ff']];
      bars.forEach((b, i) => { const y = p.y + 176 + i * 68; ctx.fillStyle = b[4]; circle(p.x + 44, y + 12, 18); text(b[0], p.x + 76, y + 6, 15, '#fff', 'left'); text(b[3], p.x + p.w - 22, y + 6, 13, '#dfe3f5', 'right', false); const bw = p.w - 98, n = 10, on = Math.max(b[1] > 0 ? 1 : 0, Math.round(clamp(b[1] / b[2], 0, 1) * n)); for (let k = 0; k < n; k++) { ctx.fillStyle = k < on ? b[4] : 'rgba(255,255,255,.12)'; ctx.fillRect(p.x + 76 + k * (bw / n), y + 16, bw / n - 4, 14); } });
      text('이동속도 ' + HERO_STATS.speed + '  ·  회피율 ' + PC_EVA + '%  ·  적중 ' + PC_ACC + '  ·  치명타 ' + Math.round(CRIT_BASE * 100) + '% (x' + CRIT_BASE_DMG + ')', p.x + 22, p.y + 400, 12, COLORS.silverOff, 'left', false);
      const nxt = GROWTH[id].tiers.find(t => t.lv > lv); text(fitStr(nxt ? '다음 성장  Lv ' + nxt.lv + ' [' + nxt.name + '] ' + fxText(id, nxt.fx) : '고유 성장 단계를 모두 해금했습니다', p.w - 44, 12), p.x + 22, p.y + 424, 12, nxt ? COLORS.goodAlt : COLORS.gold, 'left', false);
      wrapLeft(PICK_NOTE(id), p.x + 22, p.y + 448, p.w - 44, 11.5, COLORS.silverDim, 2, 15);
    } else {
      heroSkillRows(id).forEach((row, j) => { const y = p.y + 196 + j * 68; ctx.fillStyle = j === 3 ? 'rgba(255,211,77,.1)' : 'rgba(255,255,255,.04)'; ctx.fillRect(p.x + 14, y - 22, p.w - 28, 64); text(row.n, p.x + 26, y, 14, j === 3 ? COLORS.gold : COLORS.goldText, 'left'); const ls = wrapStr(row.c1, p.w - 64, '500 12px ' + FONT).slice(0, 2); ls.forEach((l, q) => text(l, p.x + 26, y + 18 + q * 15, 12, '#fff', 'left', false)); text(fitStr(row.c2, p.w - 64, 11), p.x + 26, y + 18 + ls.length * 15 + 3, 11, '#ffb27a', 'left', false); });
    }
  }
  // 아래: 파티 슬롯 + 시작
  ctx.fillStyle = 'rgba(8,6,18,.82)'; ctx.fillRect(0, 590, W, H - 590); ctx.fillStyle = 'rgba(255,211,77,.5)'; ctx.fillRect(0, 590, W, 2);
  if (rOn()) drawRaidSlots(); else for (let i = 0; i < 3; i++) {
    const r = PK.slot(i), hid = duelPick[i], lab = pickSlotLabels()[i]; ctx.fillStyle = hid ? COLORS.panelHi92 : 'rgba(255,255,255,.04)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = hid ? (i === 0 ? COLORS.gold : COLORS.ally) : 'rgba(255,255,255,.25)'; ctx.lineWidth = hid ? 2.5 : 1.5; if (!hid) ctx.setLineDash([6, 5]); ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]);
    text(String(i + 1) + '  ' + lab, r.x + 10, r.y + 20, 12, i === 0 ? COLORS.gold : '#9ad4ff', 'left');
    if (hid) { ctx.save(); ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + 54, 22, 0, TAU); ctx.clip(); ctx.translate(r.x + r.w / 2, r.y + 58); const sp0 = 0.75 * (0.6 + 0.4 * easeOut((T - (pickPopT[hid] || -9)) / 0.25)); ctx.scale(sp0, sp0); drawPortraitIcon(HEROES[hid], 0, 0); ctx.restore(); text(PC_NAME[hid] + '  Lv ' + (ACC ? heroRec(ACC, hid).lv : 1), r.x + r.w / 2, r.y + 92, 13, '#fff', 'center', false); }
    else text('+', r.x + r.w / 2, r.y + 66, 38, 'rgba(255,255,255,.3)', 'center');
  }
  if (rOn()) drawPickRaidOnline();
  else if (duelP && pickOnline) drawPickOnline();
  else if (duelP) { foeSync(); text('상대 (AI)', 560, 624, 12, '#ff9a8a', 'left'); duelFoes.forEach((fid, i) => { const x = 590 + i * 70; ctx.save(); ctx.beginPath(); ctx.arc(x, 664, 22, 0, TAU); ctx.clip(); ctx.translate(x, 668); ctx.scale(0.75, 0.75); drawPortraitIcon(HEROES[fid], 0, 0); ctx.restore(); ctx.strokeStyle = COLORS.dangerText; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, 664, 22, 0, TAU); ctx.stroke(); text('Lv ' + (ACC ? heroRec(ACC, fid).lv : 1), x, 702, 11, COLORS.silver, 'center', false); }); if (!duelFoes.length) text('영웅을 고르면 상대 팀이 표시됩니다', 560, 664, 13, COLORS.silverOff, 'left', false); }
  else text(pickFor === 'raid' ? '보스 : ' + RAID_CFG[raidBossId].name + (raidBossId === 'dianBoss' ? ' (5단계)' : ' (8단계)') : '시작 웨이브 W' + waveSel, 560, 650, 15, '#ffb27a', 'left', false);
  { const g = PK.go, on = (duelP || rOn()) && pickOnline, gOn = on && NET.role === 'guest' && NET.paired, ok = gOn ? duelPick.length >= 1 : rOn() ? netRaidCanStart() : on ? (NET.role === 'host' && NET.paired && netReady()) : duelPick.length >= pickNeed(); ctx.globalAlpha = ok ? 1 : 0.4; ctx.fillStyle = 'rgba(80,24,18,.92)'; ctx.fillRect(g.x, g.y, g.w, g.h); ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 3.5; ctx.strokeRect(g.x, g.y, g.w, g.h);
    text(gOn ? (NET.myReady ? '준비 취소' : '준비') : rOn() ? '레이드 시작' : on ? '대전 시작' : duelP ? '전투 시작' : pickFor === 'raid' ? '레이드 시작' : '출전', g.x + g.w / 2, g.y + 40, 30, COLORS.goldText, 'center'); text((gOn ? (NET.myReady ? '준비 완료 — 방장 시작 대기' : '장수를 고른 뒤 누르세요') : rOn() ? '파티 ' + netRaidCount() + ' / 3' : on ? (NET.peerReady ? '상대 준비 완료' : '상대 준비 대기') : duelPick.length + ' / 3 선택') + '  ·  Enter', g.x + g.w / 2, g.y + 68, 13, '#ffd9a0', 'center', false); ctx.globalAlpha = 1; }
}
function drawPick() {
  if (newPickUI()) { drawPickNew(); return; }
  ctx.drawImage(bg, WORLD.w / 2 - W / 2, WORLD.h / 2 - H / 2, W, H, 0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(0, 0, W, H);
  const duelP = pickFor === 'duel';
  text((duelP ? (pickOnline ? '비무장 모드 (온라인)' : '비무장 모드 (오프라인)') : (pickFor === 'raid' ? '레이드 모드 (오프라인)' : '로그라이크 모드')) + '  ·  영웅 선택', W / 2, 56, 40, COLORS.gold, 'center');
  text(duelP ? (pickOnline ? '1~3명을 순서대로 고르세요 (상대 팀 인원은 상대가 정합니다)  —  첫 번째 영웅을 직접 조작합니다 (전투 중 초상화 · Q 로 변경)' : '1~3명을 순서대로 고르세요 (인원수만큼 적도 배치)  —  첫 번째 영웅을 직접 조작합니다 (전투 중 아군 초상화로 변경 가능)') : (pickFor === 'raid' ? '1~3명을 고르세요  —  첫 번째 영웅을 직접 조작하고 나머지는 AI 동료로 동시에 보스와 싸웁니다' : '최대 3명까지 고르세요 (1명 이상)  —  첫 번째 영웅으로 시작하고, 선택한 순서대로 Z / X / C 로 태그합니다'), W / 2, 90, 16, COLORS.silver, 'center', false);
  text(duelP ? (pickOnline ? (NET.status || '방을 만들거나 친구의 방 코드로 참가하세요') : '적군은 같은 인원수의 PC (구성 랜덤)  ·  규칙 동일 · 레벨 보정은 같은 영웅끼리 같은 레벨(내 계정 기준)') : (pickFor === 'raid' ? '첫 번째 영웅을 직접 조작, 나머지 영웅은 AI 동료로 함께 싸웁니다 (태그 없음)  ·  보스 : 여포 봉선 (8단계)  ·  성장 레벨 적용  ·  보스 체력에 따라 패턴이 늘어납니다' : '웨이브 1 ~ 50  ·  5층마다 보스 (10 관우 · 25 조운 · 50 여포)  ·  다음 화면에서 웨이브 선택'), W / 2, 114, 14, duelP ? '#ff9a8a' : '#ffb27a', 'center', false);
  const text0 = text;
  HERO_IDS.forEach((id, i) => {
    const r = pickCardRect(i), h = HEROES[id], k = duelPick.indexOf(id), on = k >= 0, lv = ACC ? heroLv(id) : 1, g = GROWTH[id], mt = metaFull(id);
    const text = (s, x, y, sz, col, al = 'left', ...rest) => text0(al === 'left' && typeof s === 'string' ? fitStr(s, Math.max(40, r.x + r.w - 10 - x), sz) : s, x, y, sz, col, al, ...rest);   // 카드가 좁아져도 글자가 넘치지 않게 줄임
    ctx.save(); ctx.beginPath(); ctx.rect(r.x - 8, r.y - 8, r.w + 16, r.h + 8 + (r.h < PICK_CARD.h ? 3 : 8)); ctx.clip();   // 접힌 카드는 아래 정보를 잘라서 가림
    ctx.fillStyle = on ? 'rgba(40,34,18,.95)' : 'rgba(10,12,20,.88)'; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = on ? COLORS.gold : 'rgba(255,255,255,.3)'; ctx.lineWidth = on ? 4 : 2; ctx.strokeRect(r.x, r.y, r.w, r.h);
    if (on) { ctx.strokeStyle = `rgba(255,211,77,${0.25 + 0.2 * Math.sin(T * 5)})`; ctx.lineWidth = 8; ctx.strokeRect(r.x - 5, r.y - 5, r.w + 10, r.h + 10); }
    // 머리: 초상 / 이름 / 레벨
    ctx.save(); ctx.beginPath(); ctx.arc(r.x + 50, r.y + 70, 30, 0, TAU); ctx.clip(); ctx.translate(r.x + 50, r.y + 75); ctx.scale(1.0, 1.0); drawPortraitIcon(h, 0, 0); ctx.restore(); ctx.strokeStyle = COLORS.goldTrim; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x + 50, r.y + 70, 30, 0, TAU); ctx.stroke();
    text(PC_NAME[id], r.x + 92, r.y + 64, 22, on ? COLORS.goldText : '#dfe3f5', 'left'); text(g.theme, r.x + 92, r.y + 84, 12, '#ffb27a', 'left', false); text((i + 1) + ' 키', r.x + 92, r.y + 102, 11, 'rgba(255,255,255,.5)', 'left', false);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(r.x + r.w - 80, r.y + 10, 70, 24); ctx.strokeStyle = lv >= MAX_LV ? COLORS.gold : 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.5; ctx.strokeRect(r.x + r.w - 80, r.y + 10, 70, 24); text('Lv ' + lv, r.x + r.w - 45, r.y + 28, 15, lv >= MAX_LV ? COLORS.gold : COLORS.goodAlt, 'center');
    // 능력치: 기본 능력치 + 레벨 성장 (+N). 성장하는 것은 체력·공격력·방어력뿐 (이동속도·공격속도는 성장 없음)
    const lf = ACC ? flatTot(id, lv) : zeroFlat(), hb = duelP ? DUEL_HP : HERO_STATS.hp, ha = duelP ? lf.hp * DUEL_HP / HERO_STATS.hp : lf.hp, f1 = n2 => +n2.toFixed(1);
    text(duelP ? '능력치 · 비무장 수치  (기본 + 레벨 ' + lv + ' 성장)' : '능력치  (기본 + 레벨 ' + lv + ' 성장 +N)', r.x + 14, r.y + 128, 12, duelP ? '#9ad4ff' : COLORS.gold, 'left');
    text('체력 ' + fmtI(hb + ha) + '   (기본 ' + fmtI(hb) + ' +' + fmtI(ha) + ')', r.x + 14, r.y + 145, 12, '#fff', 'left', false);
    text('공격력 ' + f1(HERO_STATS.atk + lf.atk) + '   (기본 ' + HERO_STATS.atk + ' +' + f1(lf.atk) + ')', r.x + 14, r.y + 161, 12, '#fff', 'left', false);
    text('방어력 ' + f1(lf.def) + '   (기본 0 +' + f1(lf.def) + ')   받는 피해 -' + f1(100 - 100 / (1 + lf.def / 100)) + '%', r.x + 14, r.y + 177, 12, '#fff', 'left', false);
    text('치명타 확률 ' + Math.round(CRIT_BASE * 100) + '% · 치명타 피해 x' + CRIT_BASE_DMG + ' (성장 없음)', r.x + 14, r.y + 192, 11, COLORS.silverOff, 'left', false);
    text('이동속도 ' + HERO_STATS.speed + ' · 회피율 ' + PC_EVA + '% · 적중 ' + PC_ACC + ' (성장 없음)', r.x + 14, r.y + 206, 11, COLORS.silverOff, 'left', false);
    const nxt = g.tiers.find(t => t.lv > lv);
    text(fitStr(nxt ? '다음 Lv ' + nxt.lv + ' [' + nxt.name + '] ' + fxText(id, nxt.fx) : '고유 성장 단계를 모두 해금했습니다', r.w - 28, 10.5), r.x + 14, r.y + 224, 10.5, nxt ? COLORS.goodAlt : COLORS.gold, 'left', false);
    text(duelP ? '▼ 스킬 · 비무장 수치' : '▼ 스킬 · 로그라이크 수치', r.x + r.w - 14, r.y + 236, 10, duelP ? '#9ad4ff' : '#ffb27a', 'right', false);
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r.x + 12, r.y + 238); ctx.lineTo(r.x + r.w - 12, r.y + 238); ctx.stroke();
    // 스킬 성능
    heroSkillRows(id).forEach((row, j) => { const yy = r.y + 254 + j * 44; text(row.n, r.x + 14, yy, 13, j === 3 ? COLORS.gold : COLORS.goldText, 'left'); text(row.c1, r.x + 14, yy + 15, 11.5, '#fff', 'left', false); text(row.c2, r.x + 14, yy + 29, 11, '#ffb27a', 'left', false); });
    wrapLeft(PICK_NOTE(id), r.x + 14, r.y + 424, r.w - 28, 9.5, '#9aa3b8', 3, 11);
    if (on) { ctx.fillStyle = k === 0 ? COLORS.gold : COLORS.ally; circle(r.x + 28, r.y + 28, 18); text(String(k + 1), r.x + 28, r.y + 35, 20, '#111', 'center'); text(k === 0 ? ((duelP || pickFor === 'raid') ? '조작' : '시작') : ((duelP || pickFor === 'raid') ? '아군' : '태그 ' + ['Z', 'X', 'C'][k - 1]), r.x + 52, r.y + 32, 14, k === 0 ? COLORS.gold : '#9ad4ff', 'left'); }
    ctx.restore();
  });
  { const b = PICK_FOLD_BTN; ctx.fillStyle = COLORS.panel90; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = COLORS.silver; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h); text(pickFold ? '스킬 정보 펴기 ▼ (F)' : '스킬 정보 접기 ▲ (F)', b.x + b.w / 2, b.y + 23, 14, COLORS.silver, 'center'); }
  const btn = (r, label, col, dis) => { ctx.globalAlpha = dis ? 0.4 : 1; ctx.fillStyle = COLORS.panel90; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.strokeRect(r.x, r.y, r.w, r.h); text(label, r.x + r.w / 2, r.y + r.h / 2 + 8, 21, col, 'center'); ctx.globalAlpha = 1; };
  if (!(duelP && pickOnline)) btn(pickGoRect(), duelP ? '전투 시작  (Enter)' : pickFor === 'raid' ? '레이드 시작  (Enter)' : '다음 : 웨이브 선택  (Enter)', COLORS.gold, duelPick.length < pickNeed()); btn(PICK_BTN.back, '뒤로', COLORS.silver, false);
  if (!(duelP && pickOnline)) text('선택 ' + duelPick.length + ' / 3', W / 2 + 160, pickGoRect().y + 32, 22, duelPick.length >= pickNeed() ? COLORS.good : COLORS.goldText, 'left');
  if (duelP) {
    if (pickOnline) drawOnlinePanel();
    else { foeSync(); drawFoeRow({ x: 24, y: pickGoRect().y + 60, w: 1232, h: pickFold ? 112 : 60 }, '상대 팀 (AI)', '같은 영웅은 내 레벨', duelFoes, id => ACC ? heroRec(ACC, id).lv : 1, null, '영웅을 고르면 상대 팀이 표시됩니다'); }
  } else text('카드를 누르면 선택 / 해제됩니다 · 선택한 순서가 곧 시작 영웅과 태그 순서입니다', W / 2, pickGoRect().y + 76, 14, COLORS.silver, 'center', false);
}
function restartMode() { if (NET.on) { if (NET.raid) netRaidBackToRoom(); else netBackToRoom(); return; } if (mode === 'duel') { duelFoes = []; startDuel(duelLast); } else if (RAID) startRaid(RAID_HEROES); else startGame(null, lastStartWave); }

