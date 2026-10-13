'use strict';
// ===================================================================
// 로그라이크 모드 50웨이브 레벨 디자인
//  - 5층마다 보스: 5 맹장 / 10 관우(PC) / 15 철기대장 / 20 방패 장군 / 25 조운(PC) / 30 술사 장군 / 35 자객 두목 / 40 연합 장군 / 45 총사령관 / 50 여포(PC, 최종)
//  - 일반 웨이브: 층마다 몬스터 종류·수·생명력·피해량이 계단식으로 오른다. 신규 몬스터는 방패병 7층 / 자객 12층 / 술사 17층부터 등장.
//  - 일반 몬스터 배율: 생명력 +5%/층, 피해 +2%/층 / 보스 배율: 생명력 +3.5%/층, 피해 +1.2%/층 (보스는 자체 3단계 난이도가 따로 있음)
// ===================================================================
const MAX_WAVE = 50;
const BOSS_WAVES = { 5: 'bossGeneral', 10: 'guanBoss', 15: 'bossCav', 20: 'bossShield', 25: 'zhaoBoss', 30: 'bossCaster', 35: 'bossAssassin', 40: 'bossAlliance', 45: 'bossCommander', 50: 'boss' };
const MON_FROM = { soldier: 1, archer: 2, captain: 4, cavalry: 4, shield: 7, assassin: 12, caster: 17 };
const MON_COST = { soldier: 1, archer: 1, captain: 3, cavalry: 2.5, shield: 2.5, assassin: 1.5, caster: 2 };
const MON_THEME = { soldier: '보병 진격', archer: '궁병 사격', captain: '장수 집결', cavalry: '철기 돌격', shield: '방패 진형', assassin: '자객 습격', caster: '술사 주술' };
// 난이도 상향 (계단식): 10웨이브마다 한 단계씩 올라간다. 몬스터·보스의 생명력 / 피해에 곱해진다. 단계: W1~10, 11~20, 21~30, 31~40, 41~50
const TIER_HP = [1.25, 1.35, 1.45, 1.55, 1.65], TIER_DMG = [1.2, 1.25, 1.3, 1.35, 1.4];   // 체감 난이도(생명력 x 피해) 1.5 / 1.69 / 1.89 / 2.09 / 2.31배
const waveTier = n => Math.min(TIER_HP.length - 1, Math.floor((n - 1) / 10));
function buildWaves() {
  const L = [];
  for (let n = 1; n <= MAX_WAVE; n++) {
    const bt = BOSS_WAVES[n];
    if (bt) { L.push({ name: 'BOSS — ' + TYPES[bt].name, spawn: [[bt, 1]], bossWave: true, hpMul: +((1 + 0.035 * (n - 1)) * TIER_HP[waveTier(n)]).toFixed(2), dmgMul: +((1 + 0.012 * (n - 1)) * TIER_DMG[waveTier(n)]).toFixed(2), tier: waveTier(n) }); continue; }
    let s = n * 7919 + 17; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const avail = Object.keys(MON_FROM).filter(k => MON_FROM[k] <= n).sort(() => rnd() - 0.5);
    const fresh = Object.keys(MON_FROM).find(k => MON_FROM[k] === n);   // 새 몬스터가 처음 나오는 층은 반드시 포함
    const kinds = Math.min(avail.length, 2 + Math.floor(n / 14)), pick = avail.slice(0, kinds);
    if (fresh && !pick.includes(fresh)) pick[pick.length - 1] = fresh;
    const budget = 5 + 0.7 * n, each = budget / pick.length;
    const spawn = pick.map(k => [k, Math.max(1, Math.round(each / MON_COST[k])), true]);
    const dom = pick.reduce((a, k) => MON_COST[k] > MON_COST[a] ? k : a, pick[0]);
    L.push({ name: n + '전 · ' + (pick.length >= 3 ? '혼성 ' : '') + MON_THEME[dom], spawn, hpMul: +((1 + 0.05 * (n - 1)) * TIER_HP[waveTier(n)]).toFixed(2), dmgMul: +((1 + 0.02 * (n - 1)) * TIER_DMG[waveTier(n)]).toFixed(2), tier: waveTier(n), tm: n <= 10 ? 3 : n <= 25 ? 2.5 : 2 });
  }
  return L;
}
const wavePreview = i => { const w = WAVES[i]; return w.spawn.map(([t, c, ex]) => TYPES[t].name.replace('적 ', '') + (w.bossWave ? '' : ' ' + c)).join('  ·  '); };

// ----- 웨이브 선택 화면: 로비 > 로그라이크 모드 > 영웅 선택 > 웨이브 선택 (인게임에서는 웨이브 이동 버튼이 없다) -----
//  선택 가능: 이 계정이 도달한 최고 웨이브까지. 1층이 아닌 곳에서 시작하면 건너뛴 웨이브 수만큼 능력치 강화가 무작위로 자동 적용된다 (강화는 매 웨이브 클리어마다 선택).
const WV = { cols: 10, w: 104, h: 56, gap: 8, y0: 150 };
let waveSel = 1, waveTeam = null;
const accBest = () => ACC ? Math.max(1, ACC.best || 1) : 1;
const wvRect = i => { const c = i % WV.cols, r = Math.floor(i / WV.cols), tw = WV.cols * WV.w + (WV.cols - 1) * WV.gap; return { x: W / 2 - tw / 2 + c * (WV.w + WV.gap), y: WV.y0 + r * (WV.h + WV.gap), w: WV.w, h: WV.h }; };
const WV_GO = { x: W / 2 + 30, y: 580, w: 310, h: 56 }, WV_BACK = { x: 12, y: 664, w: 80, h: 30 };
function openWaves() { state = 'waves'; mode = 'yeonui'; applyGrowth('yeonui'); waveSel = Math.min(waveSel || 1, accBest()); }   // 로비 > 웨이브 선택 > 장수 선택 > 인게임
function wavesStart() { openPick('yeonui'); sfx('skill'); }
function wavesClick(x, y) {
  for (let i = 0; i < MAX_WAVE; i++) if (inRect(x, y, wvRect(i))) { if (i + 1 <= accBest()) { waveSel = i + 1; sfx('hit'); } return; }
  if (inRect(x, y, WV_GO)) { wavesStart(); return; }
  if (inRect(x, y, WV_BACK)) state = 'title';
}
function wavesKey(code) {
  const b = accBest();
  if (code === 'ArrowLeft') waveSel = Math.max(1, waveSel - 1); else if (code === 'ArrowRight') waveSel = Math.min(b, waveSel + 1);
  else if (code === 'ArrowUp') waveSel = Math.max(1, waveSel - WV.cols); else if (code === 'ArrowDown') waveSel = Math.min(b, waveSel + WV.cols);
  else if (code === 'Enter' || code === 'Space') wavesStart(); else if (code === 'Escape') state = 'title';
}
function drawWaves() {
  ctx.drawImage(bg, WORLD.w / 2 - W / 2, WORLD.h / 2 - H / 2, W, H, 0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(0, 0, W, H);
  text('웨이브 선택', W / 2, 62, 42, '#ffd34d', 'center');
  text((ACC ? ACC.name : '') + '  ·  최고 도달 ' + accBest() + '웨이브까지 선택 가능  ·  1층이 아닌 곳에서 시작하면 건너뛴 웨이브마다 능력치 강화가 1개씩 무작위로 자동 적용', W / 2, 96, 14, '#cfd3e6', 'center', false);
  text('보스 : 5층마다 (10 관우 · 25 조운 · 50 여포는 PC 보스)  ·  몬스터 등장 : 방패병 7층 · 자객 12층 · 술사 17층', W / 2, 120, 13, '#ffb27a', 'center', false);
  for (let i = 0; i < MAX_WAVE; i++) {
    const r = wvRect(i), n = i + 1, boss = !!WAVES[i].bossWave, open = n <= accBest(), sel = n === waveSel;
    ctx.fillStyle = sel ? 'rgba(212,167,58,.4)' : open ? (boss ? 'rgba(120,30,30,.55)' : 'rgba(20,24,36,.85)') : 'rgba(10,12,18,.6)'; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = sel ? '#ffd34d' : boss ? (open ? '#ff6a5a' : '#5a3434') : open ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.12)'; ctx.lineWidth = sel ? 3.5 : boss ? 2.5 : 1.5; ctx.strokeRect(r.x, r.y, r.w, r.h);
    text('W' + n, r.x + r.w / 2, r.y + 26, 22, open ? (boss ? '#ffb0a8' : '#fff') : '#555a6a', 'center');
    text(open ? (boss ? '보스 · ' + TYPES[WAVES[i].spawn[0][0]].short : '') : '잠김', r.x + r.w / 2, r.y + 46, 11, open ? '#ffb0a8' : '#555a6a', 'center', false);
  }
  const w = WAVES[waveSel - 1];
  ctx.fillStyle = 'rgba(12,14,24,.92)'; ctx.fillRect(W / 2 - 540, 560, 500, 100); ctx.strokeStyle = 'rgba(212,167,58,.7)'; ctx.lineWidth = 2; ctx.strokeRect(W / 2 - 540, 560, 500, 100);
  text('W' + waveSel + '  ' + w.name, W / 2 - 524, 590, 20, w.bossWave ? '#ffb0a8' : '#ffe9a0', 'left');
  text(wavePreview(waveSel - 1), W / 2 - 524, 616, 14, '#cfd3e6', 'left', false);
  text('난이도 ' + (w.tier + 1) + '단계  ·  몬스터 생명력 x' + w.hpMul.toFixed(2) + '  ·  피해 x' + w.dmgMul.toFixed(2) + (waveSel > UPGRADE_EVERY ? '  ·  자동 강화 ' + Math.floor((waveSel - 1) / UPGRADE_EVERY) + '개 (건너뛴 웨이브마다)' : '  ·  자동 강화 없음'), W / 2 - 524, 642, 13, '#ffb27a', 'left', false);
  const g = WV_GO; ctx.fillStyle = 'rgba(10,12,20,.92)'; ctx.fillRect(g.x, g.y, g.w, g.h); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3; ctx.strokeRect(g.x, g.y, g.w, g.h); text('다음 : 장수 선택 (Enter)', g.x + g.w / 2, g.y + 36, 22, '#ffd34d', 'center');
  const b = WV_BACK; ctx.fillStyle = 'rgba(10,12,20,.9)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = '#cfd3e6'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h); text('뒤로', b.x + b.w / 2, b.y + 21, 15, '#cfd3e6', 'center');
}
const UPGRADE_EVERY = 1;   // 능력치 강화(버프) 선택 간격 (웨이브) — 매 웨이브 클리어마다 선택
function catchUpUpgrades(n) {   // 웨이브 n 층에서 시작: 건너뛴 웨이브 수만큼 능력치 강화를 무작위로 자동 적용
  for (let i = 0, c = Math.floor(n / UPGRADE_EVERY); i < c; i++) { const offers = rollOffers(); if (!offers.length) break; const o = offers[Math.floor(Math.random() * offers.length)]; RUN[o.id] += o.val; RUN.picks.push({ id: o.id, rar: o.rar, val: o.val }); }
  P.maxhp = maxHpNow(); P.hp = P.maxhp; for (const id of HERO_IDS) P.hpStore[id] = heroMaxHp(id); P.speed = speedNow();
}
const WAVES = buildWaves();   // 로그라이크 모드 50웨이브
let RAID = false;   // 레이드 모드: 로그라이크 규칙(태그·성장) 위에서 보스 하나(여포 8단계)와 싸운다
const RAID_WAVE = { name: 'RAID — 여포 봉선', spawn: [['raidBoss', 1]], bossWave: true, hpMul: RAID_HPMUL, dmgMul: RAID_DMGMUL, tier: null };
const curWave = () => RAID ? RAID_WAVE : WAVES[waveIdx];
function applyFoeTheme() { }   // 스테이지 통합 — 진영 연출 전환 없음
// ===================================================================
// 로그라이크 (로그라이크 모드): 웨이브를 클리어할 때마다 랜덤 능력치 향상 3개 중 1개를 골라 그 판이 끝날 때까지 누적 적용 (모든 출전 영웅 공통)
//  희귀도: 일반(x1.0, 70%) / 희귀(x1.6, 25%) / 영웅(x2.4, 5%) — 같은 능력치를 여러 번 고르면 계속 쌓이고, 한도에 닿은 능력치는 제시되지 않는다.
// ===================================================================
const RUN = { atk: 0, hp: 0, spd: 0, aspd: 0, crit: 0, critDmg: 0, def: 0, rage: 0, cd: 0, tag: 0, heal: 0, drop: 0, ls: 0, eva: 0, acc: 0, picks: [] };
// ----- 회피율·적중률 -----
//  PC 기본: 회피율 10 / 적중 100 (모든 영웅 동일). 몬스터: 종류별 회피·적중 + 층이 오를수록 회피 +0.3/층, 적중 +0.6/층.
//  공격이 맞을 확률 = clamp(공격자 적중 - 방어자 회피, 25, 100)%. 빗나가면 피해·밀치기·분노·HIT 모두 없음 (MISS / 회피!). 스턴이 붙는 공격(궁극기·충격 돌격)은 항상 적중.
const PC_EVA = 10, PC_ACC = 100;
const MON_EVA = { soldier: 5, archer: 5, captain: 0, cavalry: 5, shield: 0, assassin: 30, caster: 15 }, MON_ACC = { assassin: 110, caster: 105 };
const monEva = e => Math.min(60, (MON_EVA[e.type] != null ? MON_EVA[e.type] : 5) + (mode === 'yeonui' ? waveIdx * 0.3 : 0));
const monAcc = a => a && a.fighter ? PC_ACC : (a ? (MON_ACC[a.type] || (a.boss ? 105 : 100)) : 100) + (mode === 'yeonui' ? waveIdx * 0.6 : 0);
function rollHit(att, tgt) {
  let acc, eva;
  if (tgt === P) { acc = monAcc(att); eva = PC_EVA + RUN.eva * 100; }
  else { acc = att === P ? PC_ACC + RUN.acc * 100 : monAcc(att); eva = tgt.fighter ? PC_EVA : monEva(tgt); }
  return Math.random() * 100 < clamp(acc - eva, 25, 100);
}
function resetRun() { RAID = false; upg = null; for (const k in RUN) RUN[k] = k === 'picks' ? [] : 0; }
const maxHpNow = () => heroMaxHp(HERO.pc), speedNow = () => HERO_STATS.speed * (1 + (RUN.spd + META.spd));   // 최대 체력·이동속도 = (기본 + 레벨 성장 +N) x 로그라이크 강화
const pct = v => '+' + Math.round(v * 100) + '%';
const UPG = {
  atk: { n: '공격력', ic: '공', base: 0.08, cap: 2.0, d: '모든 공격·스킬·궁극기 피해 증가', f: pct },
  hp: { n: '최대 생명력', ic: '체', base: 0.10, cap: 1.5, d: '모든 영웅의 최대 생명력 증가 (현재 생명력도 함께 회복)', f: pct },
  spd: { n: '이동속도', ic: '속', base: 0.06, cap: 0.5, d: '이동 속도 증가', f: pct },
  aspd: { n: '공격속도', ic: '연', base: 0.08, cap: 0.8, d: '공격·스킬 동작 속도 증가', f: pct },
  crit: { n: '치명타 확률', ic: '치', base: 0.06, cap: 0.6, d: '치명타 확률 증가 (기본 20%)', f: pct },
  critDmg: { n: '치명타 피해', ic: '폭', base: 0.20, cap: 2.0, d: '치명타 피해 배율 증가 (기본 x1.8)', f: v => '+' + Math.round(v * 100) + '%p' },
  def: { n: '방어력', ic: '방', base: 0.08, cap: 1.0, d: '받는 피해 감소', f: pct },
  rage: { n: '궁극기 쿨타임 회복', ic: '각', base: 0.15, cap: 1.5, d: '궁극기 재사용 대기시간이 더 빨리 회복됨 (기본 30초)', f: pct },
  cd: { n: '스킬 쿨타임', ic: '쿨', base: 0.07, cap: 0.5, d: '스킬1·스킬2 재사용 대기시간 감소', f: v => '-' + Math.round(v * 100) + '%' },
  tag: { n: '태그 쿨타임', ic: '태', base: 0.10, cap: 0.6, d: '태그 재사용 대기시간 감소', f: v => '-' + Math.round(v * 100) + '%' },
  heal: { n: '웨이브 회복', ic: '복', base: 0.08, cap: 0.5, d: '웨이브 클리어 시 회복량 증가 (기본 25%)', f: pct },
  drop: { n: '만두 드랍', ic: '만', base: 0.03, cap: 0.25, d: '몬스터의 만두 드랍 확률 증가 (기본 5%)', f: pct },
  ls: { n: '흡혈', ic: '혈', base: 0.03, cap: 0.3, d: '주는 피해의 일부만큼 생명력 회복', f: pct },
  eva: { n: '회피율', ic: '회', base: 0.025, cap: 0.3, d: '적의 공격이 빗나갈 확률 증가 (기본 10%, 층이 오를수록 적 적중이 높아짐)', f: v => '+' + Math.round(v * 100) + '%p' },
  acc: { n: '적중률', ic: '적', base: 0.08, cap: 0.6, d: '내 공격이 빗나가지 않을 확률 증가 (적의 회피율만큼 깎임)', f: v => '+' + Math.round(v * 100) },
};
const RARITY = [{ n: '일반', m: 1, col: '#cfd3e6', w: 70 }, { n: '희귀', m: 1.6, col: '#4fb0ff', w: 25 }, { n: '영웅', m: 2.4, col: '#c77dff', w: 5 }];
let upg = null;   // { offers: [{ id, rar, val }], next: 다음 웨이브 번호, t: 경과 시간 }
function rollRarity() { let r = Math.random() * 100; for (let i = 0; i < RARITY.length; i++) { r -= RARITY[i].w; if (r < 0) return i; } return 0; }
function rollOffers() {
  const ids = Object.keys(UPG).filter(k => RUN[k] < UPG[k].cap - 1e-9).sort(() => Math.random() - 0.5).slice(0, 3);
  return ids.map(id => { const rar = rollRarity(); return { id, rar, val: Math.min(+(UPG[id].base * RARITY[rar].m).toFixed(3), UPG[id].cap - RUN[id]) }; });
}
function openUpgrade(next) { projectiles = []; upg = { offers: rollOffers(), next, t: 0 }; state = 'upgrade'; auto = auto; sfx('skill'); }
function pickUpgrade(i, forced) {
  if (state !== 'upgrade' || !upg || (upg.t < 0.35 && !forced)) return;   // 연타로 실수로 고르는 것을 막는 짧은 대기
  const o = upg.offers[i]; if (!o) return;
  RUN[o.id] += o.val; RUN.picks.push({ id: o.id, rar: o.rar, val: o.val });
  if (o.id === 'hp') { const om = id => Math.round(baseHp(id) * (1 + RUN.hp - o.val)); P.hp += heroMaxHp(HERO.pc) - om(HERO.pc); P.maxhp = maxHpNow(); for (const id of TEAM) if (id !== HERO.pc && P.hpStore[id] > 0) P.hpStore[id] += heroMaxHp(id) - om(id); }
  if (o.id === 'spd') P.speed = speedNow();
  const nx = upg.next; upg = null; state = 'play'; ring(P.x, P.y, 90, 0.5, RARITY[o.rar].col, 8); dmgText(P.x, P.y - 90, UPG[o.id].n + ' ' + UPG[o.id].f(o.val), RARITY[o.rar].col, 24); sfx('heal');
  if (TUT) { tutEvent('buff'); return; }   // 튜토리얼: 다음 웨이브를 시작하지 않고 다음 단계로
  beginWave(nx);
}
const UPG_CARD = { w: 300, h: 290, gap: 24, y: 235 };
const upgCardRect = i => ({ x: W / 2 - (3 * UPG_CARD.w + 2 * UPG_CARD.gap) / 2 + i * (UPG_CARD.w + UPG_CARD.gap), y: UPG_CARD.y, w: UPG_CARD.w, h: UPG_CARD.h });
function upgradeClick(x, y) { if (!upg) return; for (let i = 0; i < upg.offers.length; i++) if (inRect(x, y, upgCardRect(i))) { pickUpgrade(i); return; } }
const UPG_TIME = 10;   // 선택 제한 시간(초): 직접 고르면 바로 진행, 10초가 지나면 랜덤으로 하나가 자동 선택됨
function updateUpgrade(rdt) { if (!upg) return; upg.t += rdt; if (upg.tut) return; if (upg.t >= UPG_TIME) pickUpgrade(Math.floor(Math.random() * upg.offers.length), true); }   // AUTO 와 무관하게 항상 10초 카운트 (직접 고르면 즉시 진행)
function drawUpgrade() {
  if (!upg) return;
  ctx.fillStyle = 'rgba(4,6,12,.74)'; ctx.fillRect(0, 0, W, H);
  text(upg.tut ? '튜토리얼  ·  능력치 강화(버프) 선택' : 'WAVE ' + (upg.next) + ' 클리어', W / 2, 96, 22, '#ffe9a0', 'center');
  text('능력치 강화 선택', W / 2, 150, 46, '#ffd34d', 'center');
  text('3개 중 1개를 고르세요  ·  클릭 또는 1 / 2 / 3 키  ·  이번 판이 끝날 때까지 모든 영웅에게 누적 적용', W / 2, 190, 16, '#cfd3e6', 'center', false);
  upg.offers.forEach((o, i) => {
    const r = upgCardRect(i), u = UPG[o.id], ra = RARITY[o.rar], cx = r.x + r.w / 2, pop = clamp((upg.t - i * 0.08) * 5, 0, 1), cur = RUN[o.id];
    ctx.save(); ctx.globalAlpha = pop; ctx.translate(0, (1 - pop) * 30);
    ctx.fillStyle = 'rgba(12,14,24,.95)'; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = ra.col; ctx.lineWidth = o.rar ? 4 : 2.5; ctx.strokeRect(r.x, r.y, r.w, r.h);
    if (o.rar) { ctx.strokeStyle = ra.col; ctx.globalAlpha = pop * (0.25 + 0.2 * Math.sin(T * 5)); ctx.lineWidth = 8; ctx.strokeRect(r.x - 5, r.y - 5, r.w + 10, r.h + 10); ctx.globalAlpha = pop; }
    text(ra.n, cx, r.y + 30, 15, ra.col, 'center');
    ctx.fillStyle = 'rgba(255,255,255,.07)'; circle(cx, r.y + 88, 38); ctx.strokeStyle = ra.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, r.y + 88, 38, 0, TAU); ctx.stroke();
    text(u.ic, cx, r.y + 104, 40, ra.col, 'center');
    text(u.n, cx, r.y + 154, 26, '#fff', 'center');
    text(u.f(o.val), cx, r.y + 194, 34, '#7dff9a', 'center');
    wrapText(u.d, cx, r.y + 224, r.w - 36, 14, '#cfd3e6');
    text(cur > 0 ? '현재 ' + u.f(cur) + ' → ' + u.f(cur + o.val) : '처음 선택', cx, r.y + 272, 13, '#ffb27a', 'center', false);
    text(String(i + 1), r.x + 20, r.y + 30, 18, '#ffd34d', 'left');
    ctx.restore();
  });
  const left = Math.max(0, UPG_TIME - upg.t), fr = left / UPG_TIME, urg = left <= 3;   // 남은 시간 카운트다운
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(W / 2 - 230, 566, 460, 12); ctx.fillStyle = urg ? '#ff6a5a' : '#ffd34d'; ctx.fillRect(W / 2 - 229, 567, 458 * fr, 10);
  if (upg.tut) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(W / 2 - 230, 566, 460, 12); text('카드 하나를 눌러 보세요  (튜토리얼은 시간 제한이 없고, 고른 효과는 연습용입니다)', W / 2, 606, 20, '#ffe9a0', 'center'); text('실전에서는 웨이브를 클리어할 때마다 이 화면이 나오며, 10초 안에 고르지 않으면 하나가 자동 선택됩니다', W / 2, 640, 14, '#cfd3e6', 'center', false); return; }
  text(Math.ceil(left) + '초 후 자동으로 선택됩니다  (직접 고르면 바로 진행)', W / 2, 606, urg ? 24 : 20, urg ? '#ff9a8a' : '#ffe9a0', 'center');
}
function wrapText(str, cx, y, maxW, size, col) {   // 가운데 정렬 두 줄 줄바꿈
  ctx.font = '500 ' + size + 'px ' + FONT; let line = '', ly = y;
  for (const ch of str) { if (ctx.measureText(line + ch).width > maxW) { text(line, cx, ly, size, col, 'center', false); line = ch; ly += size + 4; } else line += ch; }
  if (line) text(line, cx, ly, size, col, 'center', false);
}
const UPG_SHORT = { eva: '회피율', acc: '적중률', atk: '공격력', hp: '최대 생명력', spd: '이동속도', aspd: '공격속도', crit: '치명 확률', critDmg: '치명 피해', def: '방어력', rage: '궁극기 회복', cd: '스킬 쿨', tag: '태그 쿨', heal: '웨이브 회복', drop: '만두 드랍', ls: '흡혈' };
function drawRunSummary() {   // 로그라이크 모드 상단: 지금까지 고른 강화 합계
  if (mode === 'duel' || !RUN.picks.length) return;
  const tot = {}; for (const p of RUN.picks) tot[p.id] = (tot[p.id] || 0) + p.val;
  let s = '강화 ' + RUN.picks.length + ' : ' + Object.keys(tot).map(k => UPG[k].n + ' ' + UPG[k].f(tot[k])).join(' · ');
  ctx.font = '500 11px ' + FONT; if (ctx.measureText(s).width > 760) { while (s.length > 4 && ctx.measureText(s + '…').width > 760) s = s.slice(0, -1); s += '…'; }
  text(s, W / 2, 58, 11, '#ffd9a0', 'center', false);
}
// ===================================================================
// 계정 · PC 고유 성장 (메타 성장): 계정마다 영웅 3명의 레벨·경험치를 따로 기록한다 (브라우저/앱 저장소).
//  - 로비에 들어가기 전에 계정을 고른다. 계정은 최대 5개.
//  - 경험치: 로그라이크 모드에서만 획득 — 한 판이 끝날 때(승리·패배) 정산, 영웅이 준 피해 비율 + 출전 보너스로 나눠 받는다. 레벨 최대 30.
//  - 성장 효과(레벨 보정)는 로그라이크·비무장 모두 적용. 비무장은 같은 영웅이면 아군·적군 모두 계정의 같은 레벨을 쓰고 경험치는 쌓이지 않는다.
//  - 영웅마다 레벨당 오르는 능력치와, 5·10·15·20·25·30 레벨에서 풀리는 고유 성장 효과가 다르다.
// ===================================================================
const SAVE_KEY = 'sgb_save_v1', MAX_ACC = 5, MAX_LV = 30;
let SAVE = { accounts: [], last: null }, ACC = null;
function loadSave() { try { const j = JSON.parse(localStorage.getItem(SAVE_KEY)); if (j && Array.isArray(j.accounts)) { SAVE = j; for (const a of SAVE.accounts) { const h = a.heroes || (a.heroes = {}); if (h.lubu2) { const x = h.lubu || { lv: 1, xp: 0 }, y = h.lubu2; h.lubu = (y.lv > x.lv || (y.lv === x.lv && y.xp > x.xp)) ? y : x; delete h.lubu2; } } } } catch (_) { } }
function saveSave() { try { SAVE.last = ACC ? ACC.id : SAVE.last; localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (_) { } }
function newAcc(name) { const a = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, created: Date.now(), runs: 0, wins: 0, heroes: {} }; for (const id of HERO_IDS) a.heroes[id] = { lv: 1, xp: 0 }; return a; }
function heroRec(acc, id) { id = pcId(id); return acc.heroes[id] || (acc.heroes[id] = { lv: 1, xp: 0 }); }
const heroLv = id => NET.on && NET.lv ? (NET.lv[pcId(id)] || 1) : ACC ? heroRec(ACC, id).lv : 1;   // 온라인 대전 중에는 협상된 레벨표(NET.lv)를 쓴다
const xpNeed = lv => 300 + 120 * (lv - 1);   // lv -> lv+1 에 필요한 경험치
function promptName(def) { try { const v = window.prompt('계정 이름을 입력하세요 (최대 10자)', def); if (v === null) return null; return v.trim().slice(0, 10) || def; } catch (_) { return def; } }
function addXp(acc, id, amt) { const r = heroRec(acc, id), before = r.lv; if (r.lv >= MAX_LV) return { before, after: before, gain: 0 }; r.xp += amt; while (r.lv < MAX_LV && r.xp >= xpNeed(r.lv)) { r.xp -= xpNeed(r.lv); r.lv++; } if (r.lv >= MAX_LV) r.xp = 0; return { before, after: r.lv, gain: amt }; }

// ===== 영웅별 고유 성장: 레벨 1·5·10·15·20·25·30 에서 단계(티어)가 열린다 (레벨마다 오르는 능력치는 없음) =====
//  각 단계는 두 종류 중 하나 이상: ① 능력치 성장 (체력·공격력·방어력 +N)  ② 스킬 성장 (피해량 +%, 공격 횟수 +N, 조건부 버프 수치 +)
//  치명타 확률·치명타 피해·이동속도·회피·적중은 레벨로 성장하지 않는다. 비무장 모드는 체력 기준이 6,000(5배)이라 체력 +N 은 5배로 환산한다.
//  fx = { hp, atk, def, dmg: { a, s1, s2, u }, hits: { 키: +횟수 }, buff: { 키: +수치 } }
const FLAT_KEYS = ['hp', 'atk', 'def'], FLAT_NAME = { hp: '체력', atk: '공격력', def: '방어력' };
const GROW_LV = [1, 5, 10, 15, 20, 25, 30];
const GROWTH = {   // 방어력 N = 받는 피해 / (1 + N/100) (다른 방어력 효과와 합산)
  guan: { theme: '청룡의 수호 (체력·방어형)', tiers: [
    { lv: 1, name: '청룡의 맹세', fx: {} },
    { lv: 5, name: '청룡의 가호', fx: { hp: 120 } },
    { lv: 10, name: '연환 회전', fx: { hits: { guanS1: 1 } } },
    { lv: 15, name: '수호의 기세', fx: { hp: 100, def: 6 } },
    { lv: 20, name: '불괴의 경지', fx: { buff: { guard: 0.15, ultGuard: 0.15 } } },
    { lv: 25, name: '청룡의 위엄', fx: { dmg: { s1: 0.2, s2: 0.2, u: 0.2 } } },
    { lv: 30, name: '청룡 화신', fx: { hp: 130, atk: 6, def: 8, dmg: { u: 0.1 } } }] },
  lubu: { theme: '적토의 맹공 · 방천의 폭격 (공격형)', tiers: [
    { lv: 1, name: '적토의 기상', fx: {} },
    { lv: 5, name: '적토의 발굽', fx: { atk: 4 } },
    { lv: 10, name: '연격의 기세', fx: { hits: { lubuRush: 1, lubuQi: 4 }, dmg: { a: 0.1 } } },
    { lv: 15, name: '맹장의 안목', fx: { hp: 120, def: 4 } },
    { lv: 20, name: '질풍과 투지', fx: { buff: { runBonus: 0.1, comboBuff: 0.08 }, dmg: { a: 0.1 } } },
    { lv: 25, name: '방천의 일격', fx: { dmg: { s2: 0.2 }, hits: { lubuVolley: 1 } } },
    { lv: 30, name: '마신 강림', fx: { atk: 4, hp: 100, dmg: { u: 0.2 } } }] },
  zhao: { theme: '백룡의 기세 (균형형)', tiers: [
    { lv: 1, name: '백룡의 시작', fx: {} },
    { lv: 5, name: '칠진칠출 연장', fx: { hits: { zhaoS1: 1 } } },
    { lv: 10, name: '창의 단련', fx: { atk: 4 } },
    { lv: 15, name: '용담의 기세', fx: { buff: { aspdBuff: 0.08, postUltAspd: 0.08 } } },
    { lv: 20, name: '백룡의 갑주', fx: { hp: 120, def: 5 } },
    { lv: 25, name: '백룡강림 심화', fx: { hits: { zhaoU: 1 }, dmg: { s2: 0.2 } } },
    { lv: 30, name: '백룡 화신', fx: { hits: { zhaoS1: 1 }, atk: 4, hp: 100 } }] },
  diao: { theme: '연꽃의 가호 (회복·지원형)', tiers: [
    { lv: 1, name: '연꽃의 시작', fx: {} },
    { lv: 5, name: '꽃잎의 속삭임', fx: { hits: { diaoS1: 1 } } },
    { lv: 10, name: '비단 옷자락', fx: { hp: 100, def: 4 } },
    { lv: 15, name: '월하의 은총', fx: { buff: { blessAtk: 0.04, blessDef: 0.04 } } },
    { lv: 20, name: '회생의 향기', fx: { buff: { healPow: 0.2 }, atk: 3 } },
    { lv: 25, name: '연꽃 만개', fx: { hits: { diaoS1: 1 }, dmg: { s1: 0.2 } } },
    { lv: 30, name: '경국의 미소', fx: { hp: 100, atk: 3, buff: { ultHeal: 0.15 }, dmg: { u: 0.1 } } }] },
  dian: { theme: '불사의 광기 (돌격·내구형)', tiers: [
    { lv: 1, name: '악래의 기개', fx: {} },
    { lv: 5, name: '쌍극의 단련', fx: { atk: 4 } },
    { lv: 10, name: '투극 연장', fx: { hits: { dianS1: 1 } } },
    { lv: 15, name: '철벽의 몸', fx: { hp: 120, def: 5 } },
    { lv: 20, name: '불사의 의지', fx: { buff: { undyDur: 0.25 } } },
    { lv: 25, name: '지축 강타 심화', fx: { dmg: { s2: 0.2 }, buff: { undyAtk: 0.1 } } },
    { lv: 30, name: '악래 화신', fx: { hp: 130, atk: 4, def: 6, dmg: { u: 0.2 } } }] },
  huang: { theme: '백발백중 (원거리·저격형)', tiers: [
    { lv: 1, name: '노장의 기개', fx: {} },
    { lv: 5, name: '강궁의 단련', fx: { atk: 4 } },
    { lv: 10, name: '이중 화살', fx: { hits: { huangS1: 1 }, dmg: { a: 0.1 } } },
    { lv: 15, name: '노익장', fx: { hp: 120, def: 5 } },
    { lv: 20, name: '백발백중', fx: { buff: { huangAspd: 0.08, crystalStun: 0.2 } } },
    { lv: 25, name: '화살비 심화', fx: { hits: { huangRain: 1 }, dmg: { s2: 0.2 } } },
    { lv: 30, name: '신궁 강림', fx: { atk: 4, hp: 100, dmg: { u: 0.2 } } }] },
};
const SKILL_NAME = {   // 스킬 성장 표기용 이름
  guan: { a: '공격', s1: '회전참', s2: '청룡참', u: '청룡의 힘' }, lubu: { a: '공격', s1: '전환', s2: '돌격·연사', u: '적토 돌격·천하무쌍' }, zhao: { a: '공격', s1: '칠진칠출', s2: '단기필마', u: '백룡강림' }, diao: { a: '공격', s1: '연꽃 치유', s2: '월하 축복', u: '경국지색' }, dian: { a: '공격', s1: '쌍극 투척', s2: '지축 강타', u: '불사의 광기' }, huang: { a: '공격', s1: '백보천양', s2: '화살비', u: '수정화살' } };
const HIT_NAME = { guanS1: '회전참 공격 횟수', lubuRush: '적토 돌격 질주 횟수', lubuQi: '천하무쌍 검기 횟수', lubuVolley: '연사 일제사격 횟수', zhaoS1: '칠진칠출 찌르기 횟수', zhaoU: '백룡강림 대상당 찌르기 횟수', diaoS1: '연꽃 치유 횟수', dianS1: '쌍극 투척 개수', huangS1: '백보천양 화살 수', huangRain: '화살비 횟수' };
const BUFF_NAME = { guard: '3단 공격 방어력 버프', ultGuard: '청룡의 힘 방어력 버프', runBonus: '질주 이동속도 버프', comboBuff: '3단 완주 공격력 버프', aspdBuff: '3단 공격 공속 버프', postUltAspd: '백룡강림 후 공속 버프', healPow: '모든 회복량', ultHeal: '경국지색 회복량', blessAtk: '월하 축복 공격력', blessDef: '월하 축복 방어력', undyDur: '불사의 광기 지속시간', undyAtk: '불사의 광기 공격력', huangAspd: '3단 공속 버프', crystalStun: '수정화살 기절 시간' };
function growthFx(pc, lv) {   // 레벨 lv 까지 열린 단계의 효과 합계
  const o = { hp: 0, atk: 0, def: 0, dmg: {}, hits: {}, buff: {} }, g = GROWTH[pcId(pc)]; if (!g) return o;
  for (const t of g.tiers) if (lv >= t.lv) {
    for (const k of FLAT_KEYS) if (t.fx[k]) o[k] += t.fx[k];
    for (const sec of ['dmg', 'hits', 'buff']) if (t.fx[sec]) for (const k in t.fx[sec]) o[sec][k] = (o[sec][k] || 0) + t.fx[sec][k];
  }
  return o;
}
function fxText(pc, fx, sep = ' · ') {   // 단계 효과 설명 (능력치 + 스킬)
  pc = pcId(pc); const out = [], nm = SKILL_NAME[pc];
  for (const k of FLAT_KEYS) if (fx[k]) out.push(FLAT_NAME[k] + ' +' + fx[k]);
  if (fx.dmg) for (const k in fx.dmg) out.push(nm[k] + ' 피해 +' + Math.round(fx.dmg[k] * 100) + '%');
  if (fx.hits) for (const k in fx.hits) out.push(HIT_NAME[k] + ' +' + fx.hits[k]);
  if (fx.buff) for (const k in fx.buff) out.push(BUFF_NAME[k] + ' +' + Math.round(fx.buff[k] * 100) + '%p');
  return out.length ? out.join(sep) : '기본 (고유 성장 시작)';
}
const META = { atk: 0, aspd: 0, crit: 0, critDmg: 0, def: 0, rage: 0, cd: 0, spd: 0, ls: 0 };   // (퍼센트 보정 자리: 레벨 성장은 더 이상 쓰지 않음 = 항상 0)
const FLAT = { hp: 0, atk: 0, def: 0 };   // 지금 조작 중인 영웅의 레벨 성장 +N (로그라이크·비무장)
const zeroFlat = () => ({ hp: 0, atk: 0, def: 0 });
// ===== 장비 성장: PC마다 3종(무기 · 방어구 · 장신구) 착용, 능력치(체력·공격력·방어력) 상승. 장비는 레이드 모드에서만 획득 (장수 정보 페이지에서 장착) =====
//  온라인 대전에서는 적용하지 않는다 (양쪽 계정의 장비가 달라 공정하지 않으므로).
const EQ_SLOTS = ['무기', '방어구', '장신구'], EQ_MAX = 99;
const EQ_RAR = [{ n: '일반', c: '#cfd3e6' }, { n: '희귀', c: '#6fc3ff' }, { n: '영웅', c: '#c88aff' }, { n: '전설', c: '#ffb43a' }];
const EQ_NAME = [['녹슨 철극', '청동 월도', '적토 방천극', '봉선의 방천화극'], ['가죽 갑옷', '철찰 갑옷', '명광 흑철갑', '적토 용린갑'], ['옥 패', '호랑이 부적', '붉은 깃 허리띠', '적토마의 방울']];
const EQ_NAME_DIAN = [['쌍철극 자루', '쌍철극 파편', '악래의 쌍철극', '광전사의 쌍극'], ['두꺼운 가죽옷', '철 흉갑', '악래 갑주', '광전사의 불사갑'], ['돌 팔찌', '호랑이 어금니', '핏빛 어깨띠', '광기의 인장']];
const EQ_STAT = [{ atk: [2, 4, 7, 11] }, { def: [1.5, 3, 5, 8], hp: [25, 50, 80, 120] }, { hp: [40, 80, 130, 200], atk: [1, 1.5, 2.5, 4] }];   // 슬롯별 · 등급별 기본 수치 (±10% 무작위)
const eqData = acc => acc ? (acc.equip || (acc.equip = { inv: [], worn: {}, uid: 1 })) : null;
const eqWornIds = id => { const d = eqData(ACC); if (!d) return [null, null, null]; return d.worn[pcId(id)] || (d.worn[pcId(id)] = [null, null, null]); };
const eqItem = iid => { const d = eqData(ACC); return d ? d.inv.find(it => it.id === iid) || null : null; };
const equipOn = () => !!ACC && !NET.on && !(mode === 'duel' && pickOnline);
function equipRaw(id) { const o = { hp: 0, atk: 0, def: 0 }; if (!ACC) return o; for (const iid of eqWornIds(id)) { const it = iid != null && eqItem(iid); if (it) { o.hp += it.hp || 0; o.atk += it.atk || 0; o.def += it.def || 0; } } return o; }
function equipFlat(id) { if (NET.on && NET.raid) return (NET.eqf && NET.eqf[pcId(id)]) || { hp: 0, atk: 0, def: 0 }; if (!equipOn()) return { hp: 0, atk: 0, def: 0 }; return equipRaw(id); }   // 온라인 레이드: 파티원이 보낸 장비 수치
const flatTot = (id, lv) => { const f = flatOf(id, lv), e = equipFlat(id); return { hp: f.hp + e.hp, atk: f.atk + e.atk, def: f.def + e.def }; };   // 레벨 성장 + 장비
function eqRoll(slot, rar, src) { const d = eqData(ACC), st = EQ_STAT[slot], it = { id: d.uid++, slot, rar, name: (src === 'dianBoss' ? EQ_NAME_DIAN : EQ_NAME)[slot][rar], src: src || 'raidBoss', hp: 0, atk: 0, def: 0 }; for (const k in st) { const v = st[k][rar] * (0.9 + Math.random() * 0.2); it[k] = k === 'hp' ? Math.round(v) : +v.toFixed(1); } return it; }
function eqRarity(w) { let r = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; } return 0; }
const eqStatText = it => [['hp', '체력'], ['atk', '공격력'], ['def', '방어력']].filter(([k]) => it[k] > 0).map(([k, n]) => n + ' +' + it[k]).join('  ·  ');
const eqScore = it => (it.hp || 0) / 10 + (it.atk || 0) * 5 + (it.def || 0) * 8;
function eqWearer(iid) { const d = eqData(ACC); if (!d) return null; for (const h in d.worn) if (d.worn[h].includes(iid)) return h; return null; }
function eqEquip(hid, slot, iid) { const d = eqData(ACC); for (const h in d.worn) for (let k = 0; k < 3; k++) if (d.worn[h][k] === iid) d.worn[h][k] = null; eqWornIds(hid)[slot] = iid; saveSave(); sfx('skill'); }
function eqUnequip(hid, slot) { eqWornIds(hid)[slot] = null; saveSave(); sfx('hit'); }
function eqDrops(win) {   // 레이드 정산: 승리 = 1개 확정 + 60% 로 1개 더 / 패배·나가기 = 보스 체력을 깎은 만큼의 확률로 1개 (등급 낮음)
  const d = eqData(ACC); if (!d) return []; let n = 0, w;
  if (win) { n = 1 + (Math.random() < 0.6 ? 1 : 0); w = [30, 35, 28, 7]; }
  else { const b = enemies.find(e => e.boss), pct = b ? clamp(1 - b.hp / b.maxhp, 0, 1) : 0; if (Math.random() < pct * 0.8) n = 1; w = [60, 30, 9, 1]; }
  const out = []; for (let i = 0; i < n; i++) { if (d.inv.length >= EQ_MAX) break; const it = eqRoll((Math.random() * 3) | 0, eqRarity(w), raidBossId); d.inv.push(it); out.push(it); } return out;
}
function flatOf(id, lv) { const g = growthFx(id, lv); return { hp: g.hp, atk: g.atk, def: g.def }; }   // 능력치 성장(체력·공격력·방어력)만
function flatMode(id) { return ACC && (mode === 'yeonui' || mode === 'duel') && GROWTH[pcId(id)] ? flatTot(id, heroLv(id)) : zeroFlat(); }
const baseHp = id => { const f = flatMode(id); return mode === 'duel' ? DUEL_HP + f.hp * (DUEL_HP / HERO_STATS.hp) : HERO_STATS.hp + f.hp; };
const heroMaxHp = id => Math.round(baseHp(id) * (1 + RUN.hp));   // 영웅별 최대 생명력 = (기본 + 성장 +N) x 로그라이크 강화
const fmtFlat = (k, v) => '+' + (k === 'hp' ? Math.round(v) : +v.toFixed(1));
function metaFull(id) { const o = {}; for (const k in META) o[k] = 0; o.fl = flatMode(id); return o; }   // AI 영웅용 (비무장: 같은 영웅은 아군·적군 모두 계정의 같은 레벨)
function refreshMeta() {
  for (const k in META) META[k] = 0;
  const f = (HERO && flatMode(HERO.pc)) || zeroFlat(); FLAT.hp = f.hp; FLAT.atk = f.atk; FLAT.def = f.def;
  if (typeof P !== 'undefined' && P && HERO) { P.atk = HERO_STATS.atk + FLAT.atk; P.maxhp = heroMaxHp(HERO.pc); if (P.hp > P.maxhp) P.hp = P.maxhp; P.speed = speedNow(); }
}
// 한 판 기록 / 정산
let RS = { dmg: {}, kills: 0, boss: 0, waves: 0, done: false, summary: null };
function resetRS() { RS = { dmg: {}, kills: 0, boss: 0, waves: 0, done: false, summary: null }; }
function settleRun(res) {
  if (RS.done || !ACC) return; RS.done = true; if (mode !== 'yeonui') return;   // 경험치는 로그라이크 모드에서만 획득 (비무장은 기록·경험치 없음)
  const win = res === 'win', heroes = (RAID ? RAID_HEROES : TEAM).slice(), dmgOf = h => RS.dmg[h] || 0, pool = RS.waves * 50 + RS.boss * 250 + (win ? 1000 : 0) + Math.floor(heroes.reduce((t, h) => t + dmgOf(h), 0) / 30) + RS.kills;
  const sumD = heroes.reduce((t, h) => t + dmgOf(h), 0), n = heroes.length;
  RS.summary = heroes.filter(h => !(NET.on && NET.raid) || h === NET.myHero).map(h => {
    const gain = Math.round(pool * (0.3 / n + 0.7 * (sumD ? dmgOf(h) / sumD : 1 / n))), r = addXp(ACC, h, gain), row = { hero: h, gain, before: r.before, after: r.after };
    if (r.after > r.before) {   // 레벨업: 기본 능력치에 더해지는 +N 이 이전 -> 현재 로 얼마나 늘었는지, 새로 풀린 고유 성장 효과
      const m0 = flatOf(h, r.before), m1 = flatOf(h, r.after);
      row.changes = FLAT_KEYS.filter(k => m1[k] > m0[k] + 1e-9).map(k => FLAT_NAME[k] + ' ' + fmtFlat(k, m0[k]) + ' → ' + fmtFlat(k, m1[k]) + ' (+' + (k === 'hp' ? Math.round(m1[k] - m0[k]) : +(m1[k] - m0[k]).toFixed(1)) + ')');
      row.perks = GROWTH[h].tiers.filter(t => t.lv > r.before && t.lv <= r.after).map(t => 'Lv ' + t.lv + ' [' + t.name + '] ' + fxText(h, t.fx)); const nt = GROWTH[h].tiers.find(t => t.lv > r.after); row.next = nt ? '다음 Lv ' + nt.lv + ' [' + nt.name + '] ' + fxText(h, nt.fx) : '고유 성장 단계를 모두 해금';
    }
    return row;
  });
  ACC.runs++; if (win) ACC.wins++; if (RAID) RS.drops = eqDrops(win); saveSave();   // 장비는 레이드에서만 얻는다
}
function drawDropPanel() {   // 레이드 정산: 획득한 장비 (화면 위쪽)
  if (!RAID || !RS.done) return; const dr = RS.drops || [], w = 600, x = W / 2 - w / 2, y = 92, h = 46 + Math.max(1, dr.length) * 26;
  ctx.fillStyle = 'rgba(10,12,20,.88)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(255,211,77,.7)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  text('획득 장비', x + 16, y + 26, 16, '#ffd34d', 'left'); text('장비는 레이드 모드에서만 얻을 수 있습니다  ·  장수 정보에서 장착', x + w - 14, y + 26, 11.5, '#9aa3b8', 'right', false);
  if (!dr.length) { text('이번에는 획득한 장비가 없습니다 (보스를 많이 깎을수록 획득 확률 증가)', x + 16, y + 56, 13, '#aab3c8', 'left', false); return; }
  dr.forEach((it, i) => { const yy = y + 52 + i * 26; text('[' + EQ_SLOTS[it.slot] + ']', x + 16, yy + 12, 13, '#9ad4ff', 'left'); text(it.name, x + 84, yy + 12, 15, EQ_RAR[it.rar].c, 'left'); text(EQ_RAR[it.rar].n, x + 262, yy + 12, 12, EQ_RAR[it.rar].c, 'left', false); text(eqStatText(it), x + 320, yy + 12, 12.5, '#e6e9f5', 'left', false); });
}
function drawXpSummary() {   // 승패 화면: 이번 판 경험치 · 레벨업 · 성장 변화
  if (!RS.summary) return; const bx = W / 2 - 380, bw = 760;
  let hh = 24; for (const r of RS.summary) hh += 26 + (r.changes ? 16 : 0); const y = Math.min(556, H - 6 - hh);
  ctx.fillStyle = 'rgba(10,12,20,.86)'; ctx.fillRect(bx, y, bw, hh); ctx.strokeStyle = 'rgba(212,167,58,.7)'; ctx.lineWidth = 1.5; ctx.strokeRect(bx, y, bw, hh);
  text('획득 경험치  ·  ' + (ACC ? ACC.name : ''), bx + 12, y + 17, 13, '#ffd34d', 'left');
  let yy = y + 24;
  for (const r of RS.summary) {
    const up = r.after > r.before;
    text(PC_NAME[r.hero], bx + 12, yy + 18, 15, '#fff', 'left'); text('+' + r.gain + ' XP', bx + 220, yy + 18, 15, '#9dff9d', 'left');
    text('Lv ' + r.before + (up ? '  →  Lv ' + r.after : ''), bx + 380, yy + 18, 15, up ? '#ffe14a' : '#cfd3e6', 'left'); if (up) text('LEVEL UP!', bx + 600, yy + 18, 14, '#ffd34d', 'left');
    yy += 26;
    if (r.changes) {   // 성장 변화: 오른 능력치 + 새로 해금된 고유 성장 효과
      let line = (r.changes.length ? '성장 변화  ' + r.changes.join('  ·  ') : '') + (r.perks && r.perks.length ? (r.changes.length ? '    ' : '') + '★ 해금 ' + r.perks.join(' / ') : (r.changes.length ? '' : r.next));
      ctx.font = '500 11px ' + FONT; while (line.length > 8 && ctx.measureText(line).width > bw - 36) line = line.slice(0, -2);
      text(line, bx + 24, yy + 11, 11, r.perks && r.perks.length ? '#ffe9a0' : '#cfeed6', 'left', false); yy += 16;
    }
  }
}

// ----- 로그인 화면 + 계정 선택 팝업 (로비 진입 전) -----
//  state === 'account' : 로그인 화면 (배경 = 삼국지 야영지 노을). [로그인] = 마지막 계정으로 입장 / [계정 선택] = 팝업 (계정 선택·생성·이름 변경·삭제)
let accPopup = false;
const LOGIN_BTN = { x: W / 2 - 180, y: 468, w: 360, h: 64 }, ACCSEL_BTN = { x: W / 2 - 180, y: 548, w: 360, h: 54 };
const POP = { x: W / 2 - 400, y: 90, w: 800, h: 540 }, POP_ROW = { y: 186, h: 76, gap: 8 }, POP_CLOSE = { x: POP.x + POP.w - 46, y: POP.y + 10, w: 36, h: 36 };
const accRect = i => ({ x: POP.x + 24, y: POP_ROW.y + i * (POP_ROW.h + POP_ROW.gap), w: POP.w - 48, h: POP_ROW.h });
const accBtnRen = i => { const r = accRect(i); return { x: r.x + r.w - 214, y: r.y + r.h / 2 - 17, w: 98, h: 34 }; }, accBtnDel = i => { const r = accRect(i); return { x: r.x + r.w - 108, y: r.y + r.h / 2 - 17, w: 98, h: 34 }; };
function selectAcc(a) { ACC = a; accPopup = false; saveSave(); state = 'title'; refreshMeta(); sfx('skill'); }
function loginNow() {
  if (ACC && SAVE.accounts.includes(ACC)) { selectAcc(ACC); return; }
  if (SAVE.accounts.length === 1) { selectAcc(SAVE.accounts[0]); return; }
  accPopup = true; sfx('skill');   // 계정이 없거나 마지막 계정이 없으면 팝업에서 고르거나 만든다
}
function accountClick(x, y) {
  if (!accPopup) {
    if (inRect(x, y, LOGIN_BTN)) { loginNow(); return; }
    if (inRect(x, y, ACCSEL_BTN)) { accPopup = true; sfx('skill'); return; }
    return;
  }
  if (inRect(x, y, POP_CLOSE) || !inRect(x, y, POP)) { accPopup = false; return; }
  for (let i = 0; i < MAX_ACC; i++) {
    const a = SAVE.accounts[i];
    if (a) {
      if (inRect(x, y, accBtnRen(i))) { const nm = promptName(a.name); if (nm) { a.name = nm; saveSave(); } return; }
      if (inRect(x, y, accBtnDel(i))) { let ok = true; try { ok = window.confirm('"' + a.name + '" 계정과 모든 영웅 성장 기록을 삭제할까요?'); } catch (_) { } if (ok) { SAVE.accounts.splice(i, 1); if (ACC === a) ACC = null; saveSave(); } return; }
      if (inRect(x, y, accRect(i))) { selectAcc(a); return; }
    } else if (inRect(x, y, accRect(i))) { const nm = promptName('계정 ' + (SAVE.accounts.length + 1)); if (nm) { const na = newAcc(nm); SAVE.accounts.push(na); saveSave(); selectAcc(na); } return; }
  }
}
function accountKey(code) {
  if (!accPopup) { if (code === 'Enter' || code === 'Space') loginNow(); else if (code === 'KeyA') { accPopup = true; sfx('skill'); } return; }
  if (code === 'Escape') { accPopup = false; return; }
  const m = /^Digit([1-5])$/.exec(code); if (!m) return; const i = +m[1] - 1, a = SAVE.accounts[i]; if (a) selectAcc(a); else accountClick(accRect(i).x + 5, accRect(i).y + 5);
}
// --- 배경: 노을 진 산맥 위의 야영지 (정적 층은 한 번만 그려 두고, 구름·깃발·모닥불·불씨만 매 프레임 움직임) ---
let loginBg = null; const loginFx = { embers: [], clouds: null };
function loginRng(seed) { let v = seed; return () => { v = (v * 16807) % 2147483647; return v / 2147483647; }; }
function buildLoginBg() {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), R = loginRng(77);
  const sky = g.createLinearGradient(0, 0, 0, 470); sky.addColorStop(0, '#080b24'); sky.addColorStop(0.45, '#2b1a42'); sky.addColorStop(0.78, '#8c3a48'); sky.addColorStop(1, '#e58a4a'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 140; i++) { g.globalAlpha = 0.25 + R() * 0.6; g.fillStyle = '#fff'; const sz = R() < 0.1 ? 2 : 1; g.fillRect(R() * W, R() * 260, sz, sz); } g.globalAlpha = 1;
  const mg = g.createRadialGradient(930, 165, 20, 930, 165, 260); mg.addColorStop(0, 'rgba(255,240,200,.55)'); mg.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = mg; g.fillRect(560, 0, 720, 460);
  g.fillStyle = '#f6edcf'; g.beginPath(); g.arc(930, 165, 66, 0, TAU); g.fill(); g.fillStyle = 'rgba(190,170,130,.35)'; for (const [dx, dy, r] of [[-20, -10, 14], [18, 14, 10], [-6, 30, 8], [26, -22, 7]]) { g.beginPath(); g.arc(930 + dx, 165 + dy, r, 0, TAU); g.fill(); }
  const ridge = (base, amp, col, seed, jag) => { const r = loginRng(seed), ph = [r() * 6, r() * 6, r() * 6]; g.fillStyle = col; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 8) { const y = base - amp * (0.55 * Math.sin(x * 0.006 + ph[0]) + 0.3 * Math.sin(x * 0.015 + ph[1]) + 0.15 * Math.sin(x * 0.04 + ph[2])) - (jag ? Math.abs(Math.sin(x * 0.09 + ph[1])) * jag : 0); g.lineTo(x, y); } g.lineTo(W, H); g.closePath(); g.fill(); };
  ridge(430, 70, '#4a2a4a', 11, 14); ridge(480, 60, '#2d1d3d', 23, 10);
  // 멀리 보이는 성벽과 망루
  g.fillStyle = '#241833'; g.fillRect(150, 440, 260, 30); for (let x = 150; x < 410; x += 20) g.fillRect(x, 432, 12, 10); g.fillRect(250, 392, 56, 78); g.beginPath(); g.moveTo(240, 394); g.lineTo(278, 366); g.lineTo(316, 394); g.closePath(); g.fill(); g.fillRect(268, 410, 20, 24);
  ridge(540, 50, '#1a1228', 37, 8);
  // 야영 천막
  g.fillStyle = '#120c1e'; for (const [x, y, w, h] of [[520, 560, 90, 46], [640, 566, 74, 38], [1010, 556, 100, 50], [900, 568, 70, 34], [400, 572, 80, 40]]) { g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x, y - h); g.lineTo(x + w / 2, y); g.closePath(); g.fill(); g.fillRect(x - 1, y - h - 12, 2, 12); }
  // 오른쪽 언덕 위의 장수 (기마 실루엣 + 방천화극)
  const hill = () => { g.fillStyle = '#0a0612'; g.beginPath(); g.moveTo(760, H); g.lineTo(790, 600); g.quadraticCurveTo(900, 520, 1040, 560); g.quadraticCurveTo(1180, 590, W, 560); g.lineTo(W, H); g.closePath(); g.fill(); }; hill();
  g.save(); g.translate(930, 535); g.fillStyle = '#0a0612'; g.strokeStyle = '#0a0612'; g.lineCap = 'round';
  g.beginPath(); g.ellipse(0, 0, 34, 15, -0.08, 0, TAU); g.fill();                 // 말 몸통
  g.beginPath(); g.moveTo(26, -6); g.lineTo(46, -34); g.lineTo(58, -30); g.lineTo(48, -4); g.closePath(); g.fill();   // 목·머리
  g.beginPath(); g.moveTo(-32, -4); g.quadraticCurveTo(-52, 6, -46, 28); g.lineWidth = 5; g.stroke();                   // 꼬리
  g.lineWidth = 5; for (const [x0, x1] of [[-22, -28], [-10, -12], [14, 18], [26, 34]]) { g.beginPath(); g.moveTo(x0, 8); g.lineTo(x1, 38); g.stroke(); }   // 다리
  g.fillRect(-6, -48, 14, 34);                                                  // 기수 몸
  g.beginPath(); g.arc(1, -56, 7, 0, TAU); g.fill();                            // 머리
  g.beginPath(); g.moveTo(-6, -60); g.lineTo(-14, -78); g.lineTo(-2, -64); g.closePath(); g.fill(); g.beginPath(); g.moveTo(8, -60); g.lineTo(18, -80); g.lineTo(4, -64); g.closePath(); g.fill();   // 투구 깃
  g.lineWidth = 4; g.beginPath(); g.moveTo(14, -30); g.lineTo(34, -150); g.stroke();                                    // 방천화극 자루
  g.lineWidth = 3; g.beginPath(); g.moveTo(30, -138); g.lineTo(46, -150); g.moveTo(38, -130); g.lineTo(50, -138); g.stroke(); g.beginPath(); g.moveTo(34, -150); g.lineTo(32, -176); g.lineTo(38, -150); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-6, -40); g.quadraticCurveTo(-34, -30, -40, -4); g.lineTo(-14, -24); g.closePath(); g.fill();   // 휘날리는 망토
  g.restore();
  // 전경 풀숲
  g.fillStyle = '#07040d'; for (let x = -10; x < W + 10; x += 14) { const h = 14 + loginRng(x + 500)() * 38; g.beginPath(); g.moveTo(x, H); g.lineTo(x + 4, H - h); g.lineTo(x + 8, H); g.closePath(); g.fill(); }
  g.fillRect(0, H - 18, W, 18);
  loginBg = c;
}
const LOGIN_FIRES = [[520, 566], [718, 572], [1012, 562], [360, 578]], LOGIN_BANNERS = [[330, 470, 62, '蜀', '#2f8f5b'], [560, 440, 70, '漢', '#a8321f'], [790, 500, 58, '魏', '#2f5f9f'], [1090, 470, 66, '吳', '#b8742a'], [210, 512, 54, '蜀', '#2f8f5b']];
function drawLoginScene() {
  if (!loginBg) buildLoginBg();
  ctx.drawImage(loginBg, 0, 0);
  // 구름
  if (!loginFx.clouds) loginFx.clouds = Array.from({ length: 6 }, (_, i) => ({ x: i * 240, y: 70 + (i % 3) * 52, w: 260 + (i % 2) * 120, sp: 6 + i * 2.2 }));
  for (const c of loginFx.clouds) { c.x += c.sp / 60; if (c.x > W + 200) c.x = -c.w - 100; const gr = ctx.createRadialGradient(c.x + c.w / 2, c.y, 4, c.x + c.w / 2, c.y, c.w / 2); gr.addColorStop(0, 'rgba(255,200,170,.22)'); gr.addColorStop(1, 'rgba(255,200,170,0)'); ctx.fillStyle = gr; ctx.save(); ctx.translate(c.x + c.w / 2, c.y); ctx.scale(1, 0.22); ctx.translate(-(c.x + c.w / 2), -c.y); ctx.fillRect(c.x, c.y - c.w / 2, c.w, c.w); ctx.restore(); }
  // 깃발 (바람에 펄럭임)
  for (const [x, y, ph, ch, col] of LOGIN_BANNERS) {
    ctx.strokeStyle = '#0c0814'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y + 120); ctx.lineTo(x, y); ctx.stroke();
    const wv = k => Math.sin(T * 3.2 + ph + k * 0.7) * (3 + k * 1.6); ctx.fillStyle = col; ctx.globalAlpha = 0.92; ctx.beginPath(); ctx.moveTo(x, y + 4);
    for (let k = 0; k <= 5; k++) ctx.lineTo(x + k * 9 + 4, y + 4 + wv(k)); for (let k = 5; k >= 0; k--) ctx.lineTo(x + k * 9 + 4, y + 52 + wv(k)); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,240,200,.85)'; ctx.font = '700 22px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(ch, x + 26, y + 36 + wv(3) * 0.5); ctx.textAlign = 'left';
  }
  // 모닥불: 불빛 + 불씨
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [x, y] of LOGIN_FIRES) { const f = 0.75 + 0.25 * Math.sin(T * 11 + x) * Math.sin(T * 7.3 + y), gr = ctx.createRadialGradient(x, y - 10, 2, x, y - 10, 70 * f); gr.addColorStop(0, 'rgba(255,200,110,.75)'); gr.addColorStop(0.4, 'rgba(255,120,40,.3)'); gr.addColorStop(1, 'rgba(255,90,20,0)'); ctx.fillStyle = gr; ctx.fillRect(x - 80, y - 90, 160, 160); ctx.fillStyle = 'rgba(255,230,160,.9)'; ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.quadraticCurveTo(x - 4, y - 18 * f, x, y - 26 * f); ctx.quadraticCurveTo(x + 4, y - 18 * f, x + 7, y); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  if (Math.random() < 0.7) { const [x, y] = LOGIN_FIRES[(Math.random() * LOGIN_FIRES.length) | 0]; loginFx.embers.push({ x: x + rand(-8, 8), y: y - 20, vx: rand(-14, 14), vy: -rand(30, 80), t: 0, dur: rand(1.4, 3.0), sz: rand(1.5, 3.2) }); }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const e of loginFx.embers) { e.t += 1 / 60; e.x += (e.vx + Math.sin(T * 2 + e.y * 0.05) * 10) / 60; e.y += e.vy / 60; ctx.globalAlpha = Math.max(0, 1 - e.t / e.dur); ctx.fillStyle = e.t < e.dur * 0.5 ? '#ffd27a' : '#ff8a3a'; ctx.fillRect(e.x, e.y, e.sz, e.sz); }
  ctx.restore(); ctx.globalAlpha = 1; loginFx.embers = loginFx.embers.filter(e => e.t < e.dur).slice(-160);
  // 아래쪽 안개 + 비네트
  const mist = ctx.createLinearGradient(0, 500, 0, H); mist.addColorStop(0, 'rgba(40,24,52,0)'); mist.addColorStop(1, 'rgba(20,10,30,.55)'); ctx.fillStyle = mist; ctx.fillRect(0, 500, W, H - 500);
  const vg = ctx.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 760); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}
function drawLoginBtn(r, label, sub, primary) {
  const pul = primary ? 0.5 + 0.5 * Math.sin(T * 2.4) : 0;
  ctx.fillStyle = primary ? 'rgba(120,28,22,.88)' : 'rgba(14,12,26,.82)'; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = primary ? '#ffd34d' : 'rgba(255,255,255,.55)'; ctx.lineWidth = primary ? 3 : 2; ctx.strokeRect(r.x, r.y, r.w, r.h);
  if (primary) { ctx.save(); ctx.globalAlpha = 0.25 + 0.25 * pul; ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 6; ctx.strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8); ctx.restore(); }
  text(label, r.x + r.w / 2, r.y + (sub ? r.h / 2 - 2 : r.h / 2 + 9), primary ? 28 : 22, primary ? '#ffe9a0' : '#fff', 'center');
  if (sub) text(sub, r.x + r.w / 2, r.y + r.h - 12, 13, 'rgba(255,255,255,.75)', 'center', false);
}
function drawAccount() {
  drawLoginScene();
  // 로고
  ctx.save(); ctx.shadowColor = 'rgba(255,170,60,.8)'; ctx.shadowBlur = 28; text('三國 猛將傳', W / 2, 190, 96, '#ffd34d', 'center'); ctx.restore();
  text('삼국 맹장전', W / 2, 244, 30, '#fff', 'center');
  text('천하의 맹장들과 함께 웨이브를 돌파하고 보스를 쓰러뜨려라', W / 2, 288, 17, '#ffe9c8', 'center', false);
  const last = ACC && SAVE.accounts.includes(ACC) ? ACC : null, tot = last ? HERO_IDS.reduce((t, id) => t + heroRec(last, id).lv, 0) : 0;
  drawLoginBtn(LOGIN_BTN, '로그인', last ? last.name + '  ·  영웅 총 레벨 ' + tot : (SAVE.accounts.length ? '계정을 선택해 입장합니다' : '새 계정을 만들어 시작합니다'), true);
  drawLoginBtn(ACCSEL_BTN, '계정 선택', SAVE.accounts.length + ' / ' + MAX_ACC + ' 계정', false);
  text('Enter : 로그인   ·   A : 계정 선택', W / 2, 636, 13, 'rgba(255,255,255,.6)', 'center', false);
  if (accPopup) drawAccPopup();
}
function drawAccPopup() {
  ctx.fillStyle = 'rgba(0,0,0,.62)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(14,12,26,.97)'; ctx.fillRect(POP.x, POP.y, POP.w, POP.h); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3; ctx.strokeRect(POP.x, POP.y, POP.w, POP.h);
  ctx.strokeStyle = 'rgba(255,211,77,.35)'; ctx.lineWidth = 1; ctx.strokeRect(POP.x + 8, POP.y + 8, POP.w - 16, POP.h - 16);
  text('계정 선택', POP.x + POP.w / 2, POP.y + 48, 30, '#ffe9a0', 'center');
  text('계정마다 영웅 6명의 레벨·성장 기록이 따로 저장됩니다  ·  계정을 누르거나 1~5 키  ·  Esc 닫기', POP.x + POP.w / 2, POP.y + 76, 14, "#cfd3e6", "center", false);
  const cb = POP_CLOSE; ctx.fillStyle = 'rgba(40,16,16,.9)'; ctx.fillRect(cb.x, cb.y, cb.w, cb.h); ctx.strokeStyle = '#ff9a8a'; ctx.lineWidth = 2; ctx.strokeRect(cb.x, cb.y, cb.w, cb.h); text('✕', cb.x + cb.w / 2, cb.y + 25, 20, '#ff9a8a', 'center');
  for (let i = 0; i < MAX_ACC; i++) {
    const r = accRect(i), a = SAVE.accounts[i], cur = a && ACC === a;
    ctx.fillStyle = a ? (cur ? 'rgba(60,44,12,.85)' : 'rgba(24,26,42,.92)') : 'rgba(255,255,255,.04)'; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = cur ? '#ffd34d' : a ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.22)'; ctx.lineWidth = cur ? 3 : 1.5; if (!a) ctx.setLineDash([8, 6]); ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]);
    text(String(i + 1), r.x + 22, r.y + r.h / 2 + 7, 20, '#ffd34d', 'center');
    if (!a) { text('+  새 계정 만들기', r.x + r.w / 2, r.y + r.h / 2 + 7, 20, '#cfd3e6', 'center'); continue; }
    text(a.name + (cur ? '   (마지막 접속)' : ''), r.x + 46, r.y + 30, 22, cur ? '#ffe9a0' : '#fff', 'left');
    const tot = HERO_IDS.reduce((t, id) => t + heroRec(a, id).lv, 0);
    text('영웅 총 레벨 ' + tot + '  ·  플레이 ' + a.runs + '회  ·  승리 ' + a.wins + '회  ·  최고 ' + (a.best || 0) + '층', r.x + 46, r.y + 56, 13, '#9aa3b8', 'left', false);
    HERO_IDS.forEach((id, k) => { const px = r.x + 330 + k * 0, hx = r.x + r.w - 214 - 12 - (HERO_IDS.length - k) * 26; ctx.save(); ctx.beginPath(); ctx.arc(hx + 11, r.y + r.h / 2, 11, 0, TAU); ctx.clip(); ctx.translate(hx + 11, r.y + r.h / 2 + 3); ctx.scale(0.36, 0.36); drawPortraitIcon(HEROES[id], 0, 0); ctx.restore(); });
    for (const [bb, label, col] of [[accBtnRen(i), '이름 변경', '#9ad4ff'], [accBtnDel(i), '삭제', '#ff9a8a']]) { ctx.fillStyle = 'rgba(10,12,20,.9)'; ctx.fillRect(bb.x, bb.y, bb.w, bb.h); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(bb.x, bb.y, bb.w, bb.h); text(label, bb.x + bb.w / 2, bb.y + 23, 14, col, 'center', false); }
  }
}

// (영웅 성장 화면은 '장수 정보' 페이지로 통합되었다)
const ACC_BTN = { x: 14, y: 14, w: 300, h: 64 }, HELP_BTN = { x: W - 62, y: 16, w: 46, h: 46 }, HELP_PANEL = { x: W / 2 - 340, y: 100, w: 680, h: 480 };
let helpOpen = false, lobbyHero = null, lobbyHeroT = 0;   // 로비 도움말 창 / 가운데 대표 영웅 (누르면 다음 영웅)
function resetPlayer() {
  P = {
    x: WORLD.w / 2, y: WORLD.h / 2 + 100, r: HERO_STATS.r, hp: maxHpNow(), maxhp: maxHpNow(), atk: HERO_STATS.atk + FLAT.atk, speed: speedNow(), face: -Math.PI / 2,
    act: null, kx: 0, ky: 0, freeze: 0, combo: 0, comboT: 0, inv: 0, flash: 0, rage: 0, buffT: 0, cd: { s1: 0, s2: 0, dash: 0 }, hits: 0, hitTier: 0, hitsT: 0, bestHits: 0, walk: 0, ghostT: 0, aspdT: 0, runT: 0, runBuffT: 0, stillT: 0, dead: false, tagCd: 0, cdStore: {}, s2Store: { lubu: 0, lubu2: 0 }, hpStore: Object.fromEntries(HERO_IDS.map(id => [id, heroMaxHp(id)])), guardT: 0, ultGuardT: 0, postUltT: 0, comboBuffT: 0, blessT: 0, undyT: 0, floorT: 0, floorUsed: false,
  };
  HERO = heroDef(curHero); applyLabels();   // 웨이브 이동 시에는 지금 조작 중인 영웅 유지 (새 게임은 applyHero 에서 시작 영웅으로)
}
let lastStartWave = 0;
function startGame(team, startWave = 0) {
  speedIdx = SPEED_1X;
  lastStartWave = startWave;
  BTN.find(b => b.id === 'auto').y = 375;   // 로그라이크: AUTO 는 HIT 표시와 회피 버튼의 중간 (오른쪽 위에는 정지·나가기 버튼)
  resetRun(); resetRS(); if (team && team.length) TEAM = team.slice(0, 3); selHero = TEAM[0]; LUBU_FORM = 'lubu';
  mode = 'yeonui'; applyGrowth('yeonui'); allies = []; duel = null; applyHero(); resetPlayer(); enemies = []; projectiles = []; fx = []; dts = []; items = [];
  kills = 0; clock = 0; winT = 0; autoDodgeCd = 0; shake = 0; hitstop = 0; slowT = 0; flashT = 0; tagFx = null;
  cam.x = P.x - W / 2; cam.y = P.y - H / 2;
  state = 'play';
  if (tutNeeded('yeonui')) tutBegin('yeonui'); else { if (startWave > 0) catchUpUpgrades(startWave); beginWave(startWave); }
}
function startRaid(team) {
  speedIdx = SPEED_1X;   // 레이드 모드 (오프라인): 1~3명이 태그하며 보스 여포와 싸운다
  lastStartWave = 0;
  BTN.find(b => b.id === 'auto').y = 375;
  resetRun(); RAID = true; resetRS(); RAID_HEROES = (team && team.length ? team : TEAM).slice(0, 3); TEAM = [RAID_HEROES[0]]; selHero = TEAM[0]; LUBU_FORM = 'lubu';   // 태그 없음: 조작 PC 1명 + AI PC 최대 2명
  mode = 'yeonui'; applyGrowth('yeonui'); allies = []; duel = null; applyHero(); resetPlayer();
  RD.order = RAID_HEROES.slice(); RD.swapCd = 0; RD.cyc = 0;
  RAID_HEROES.slice(1).forEach((h, i) => allies.push(makeFighter(h, 'ally', P.x + (i ? 130 : -130), P.y + 70))); enemies = []; projectiles = []; fx = []; dts = []; items = [];
  kills = 0; clock = 0; winT = 0; autoDodgeCd = 0; shake = 0; hitstop = 0; slowT = 0; flashT = 0; tagFx = null; joy = null; auto = false; TUT = null;
  for (const k in buf) buf[k] = -9;
  cam.x = P.x - W / 2; cam.y = P.y - H / 2;
  { const cfg = RAID_CFG[raidBossId] || RAID_CFG.raidBoss; TYPES[raidBossId].hpScale = cfg.hp; RAID_WAVE.spawn = [[raidBossId, 1]]; RAID_WAVE.dmgMul = cfg.dmg; RAID_WAVE.name = 'RAID — ' + cfg.name; }
  state = 'play'; if (tutNeeded('raid')) tutBegin('raid'); else beginWave(0);   // 처음 입장하면 튜토리얼
}
// 선택한 웨이브의 시작 시점으로 즉시 이동: 전장(몬스터·투사체·아이템·이펙트)을 비우고 관우는 처음 상태(체력 가득, 쿨타임·버프·분노·콤보 초기화)로
function jumpToWave(i) {
  resetPlayer(); enemies = []; projectiles = []; fx = []; dts = []; items = [];
  winT = 0; autoDodgeCd = 0; shake = 0; hitstop = 0; slowT = 0; flashT = 0; tagFx = null; joy = null;
  for (const k in buf) buf[k] = -9;
  cam.x = P.x - W / 2; cam.y = P.y - H / 2;
  state = 'play'; beginWave(i);
}
let supplyT = 0, reinforceT = 0, reinforceMsg = '';
let spawnQ = [], respawnT = 0;   // 리스폰 대기열: { type, cap(필드 최대 수), left(남은 리스폰 수) }
function beginWave(i) { P.floorUsed = false; if (mode === 'yeonui' && !RAID && ACC && i + 1 > (ACC.best || 0)) { ACC.best = i + 1; saveSave(); } spawnQ = []; respawnT = 0; waveIdx = i; bannerT = 2.6; spawnT = 1.8; pendingSpawn = true; supplyT = 0; reinforceT = 0; }
const waveHpMul = () => (curWave() && curWave().hpMul) || 1, waveDmgMul = () => (curWave() && curWave().dmgMul) || 1;   // 웨이브별 난이도 배율
function makeEnemy(type, x, y) {
  const d = TYPES[type];
  return { type, d, x, y, r: d.boss && !d.foot ? BOSS_MOUNTED_R : d.r, mounted: !!d.mounted || (!!d.boss && !d.foot), hp: d.hp * ENEMY_HP_MULT * (d.hpScale || 1) * waveHpMul(), maxhp: d.hp * ENEMY_HP_MULT * (d.hpScale || 1) * waveHpMul(), speed: d.speed, state: 'chase', t: 0, kx: 0, ky: 0, freeze: 0, face: Math.PI / 2, cur: null,
    atkCd: rand(0.6, 1.6), flash: 0, spawnT: 0.7, armor: !!d.armor, boss: !!d.boss, walk: rand(0, 6), dashHit: false, dead: false };
}
function spawnOne(type) {
  let x, y;
  if (TYPES[type].boss) { x = WORLD.w / 2; y = WORLD.h / 2 - 380; }
  else {   // 원형 경기장 안쪽에서 플레이어와 430~640 떨어진 곳에 등장
    for (let k = 0; k < 24; k++) { const a = rand(0, TAU), d = rand(430, 640); x = P.x + Math.cos(a) * d; y = P.y + Math.sin(a) * d; if (Math.hypot(x - ARENA_C.x, y - ARENA_C.y) < ROGUE_R - 70) break; }
    const dx = x - ARENA_C.x, dy = y - ARENA_C.y, dd = Math.hypot(dx, dy), lim = ROGUE_R - 70; if (dd > lim) { x = ARENA_C.x + dx / dd * lim; y = ARENA_C.y + dy / dd * lim; }
  }
  enemies.push(makeEnemy(type, x, y));
  ring(x, y, 70, 0.5, '#ffd34d');
}
function spawnWave() {
  spawnQ = [];
  for (const [type, base, exact] of curWave().spawn) {
    const isBoss = !!TYPES[type].boss, n = isBoss ? base : Math.max(1, Math.round((exact ? base : base * ENEMY_COUNT_MULT) * WAVE_COUNT_CUT));
    for (let i = 0; i < n; i++) spawnOne(type);
    if (!isBoss) spawnQ.push({ type, cap: n, left: Math.round(n * ((curWave().tm || WAVE_TOTAL_MULT) - 1)) });   // 보스 웨이브는 리스폰 없음
  }
}
const waveLeft = () => spawnQ.reduce((t, q) => t + q.left, 0);   // 아직 등장하지 않은 몬스터 수
// 보스 웨이브 보급품: 술·만두를 각각 1~2개씩 아레나 안 랜덤 위치에 떨어뜨린다 (SUPPLY_INTERVAL 동안 유지)
function spawnSupplies() {
  for (const kind of ['wine', 'bun']) for (let i = 0, n = kind === 'wine' && Math.random() >= WINE_DROP_CHANCE ? 0 : Math.random() < 0.5 ? 1 : 2; i < n; i++) {
    const sa = rand(0, TAU), sr = Math.sqrt(Math.random()) * (ROGUE_R - 100), x = ARENA_C.x + Math.cos(sa) * sr, y = ARENA_C.y + Math.sin(sa) * sr;   // 경기장 안 임의 위치
    items.push({ kind, x, y, t: 0, life: SUPPLY_INTERVAL }); ring(x, y, 70, 0.6, kind === 'bun' ? '#7dff9a' : '#ffc04d');
  }
}

