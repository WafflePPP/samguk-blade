'use strict';
// ---------- AI 스킬 세트 (플레이어와 같은 수치, 시간은 실제 초 = 행동 시간 / 행동 속도) ----------
function comboDef(hero, stage) {
  const tb = hero === 'zhao' ? ZHAO_ATK : hero === 'lubu' ? LUBU_ATK : hero === 'lubu2' ? LUBU2_ATK : hero === 'diao' ? DIAO_ATK : hero === 'dian' ? DIAN_ATK : hero === 'huang' ? HUANG_ATK : GUAN_ATK, c = tb[stage], rate = ATK_SPEED * (HEROES[hero].atkSlow || 1);
  return { name: 'atk', dur: c.dur / rate, aim: 0.12, move: [c.move[0] / rate, c.move[1] / rate, c.move[2] * rate], armor: false,
    ev: c.hits.map((h, i) => ({ t: h / rate, fx: 'cone', r: c.rad, half: c.half, mult: c.mult[i] * HEROES[hero].bal.a, kb: c.kb, spin: !!c.span, thrust: !!c.thrust, slam: !!c.slam, dir: c.dirs[i], stg: stage, retar: !!c.span && i > 0, ranged: !!c.ranged, off: c.fan ? c.fan[i] : 0, far: c.far })) };
}
function rushDef(sp, armor, inv, bal) {   // 돌격(1회) / 적토 돌격(3연속): 선딜 -> 질주 반복 + 마지막 폭발 (연출·피해는 플레이어와 동일)
  const ev = [], ult = !!sp.invul; let t = 0;
  for (let i = 0; i < sp.n; i++) {
    ev.push({ t, fx: 'aim' }, { t: t + sp.wind[i] * 0.6, fx: 'aim' });
    if (ult) ev.push({ t0: t, t1: t + sp.wind[i], fx: 'windfx', w: sp.w });
    t += sp.wind[i];
    ev.push({ t0: t, t1: t + sp.dash[i], fx: 'dash', rush: true, ult, v: RUSH_LEN / sp.dash[i], w: sp.w, mult: sp.dmg * SKILL_DMG_MULT * sp.mult * bal, kb: sp.kb, stun: sp.stun, rage: ult ? 0 : undefined });
    t += sp.dash[i];
  }
  ev.push({ t, fx: 'blast', r: sp.blastR, half: Math.PI, mult: SKILL_DMG_MULT * sp.mult * bal, kb: sp.blastKb, stun: sp.stun, ult, rage: ult ? 0 : undefined });
  return { name: 'rush', dur: t + 0.25, aim: 0, armor, inv: inv ? t + 0.25 : 0, invul: ult, ev };
}
function ultDef(hero) { return { name: 'ult', dur: 2.6, inv: 2.6, invul: true, aim: 0.8, ev: [{ t: 1.1, fx: 'ult', r: ULT_RADIUS, half: Math.PI, mult: 6.5 * SKILL_DMG_MULT * ULT_DMG_MULT * HEROES[hero].bal.u, kb: 900, stun: 2.2, rage: 0 }] }; }
const switchDef = hero => ({ name: 's1', dur: 0.7, aim: 0, range: 900, ev: [{ t: 0.25, fx: 'form' }],   // 여포 AI 의 K 스킬 (상마 <-> 하마 전환): 반대 폼의 스킬2 가 준비됐고 지금 스킬2 가 쿨타임일 때 전환
  cond: f => f.s2Store[hero === 'lubu' ? 'lubu2' : 'lubu'] <= 0 && f.cd.s2 > 1.5 });
function switchFighterForm(f) {   // AI 여포의 상마 <-> 하마 전환 (플레이어의 doFormSwitch 와 같은 효과)
  const to = f.hero === 'lubu' ? 'lubu2' : 'lubu'; f.s2Store[f.hero] = f.cd.s2; f.hero = to; f.mounted = HEROES[to].mounted; f.skills = skillDefs(to); f.d.name = DUEL_NAME[to]; f.cd.s2 = f.s2Store[to] || 0; f.combo = 0; f.comboT = 0;
  ring(f.x, f.y, 110, 0.4, HEROES[to].ult.a, 10); ring(f.x, f.y, 170, 0.5, '#fff', 6); sparks(f.x, f.y - 20, 26, HEROES[to].ult.a, 600, 0.5); sfx('skill'); dmgText(f.x, f.y - 100, to === 'lubu' ? '상마 전환' : '하마 전환', HEROES[to].ult.a, 22);
  formSlash(f, HEROES[to], false);
}
function huangDefs() {   // 황충 AI: 백보천양(중거리) / 화살비(목표 지점에 연속 낙하) / 마법의 수정화살(아주 먼 거리까지)
  const bl = HEROES.huang.bal;
  return {
    s1: { name: 's1', dur: 0.7 / ATK_SPEED, aim: 0.3, inv: 0.25, range: 1100, ev: [{ t0: 0, t1: 0.16 / ATK_SPEED, fx: 'move', v: 1700 * ATK_SPEED, back: true }, { t: 0.3 / ATK_SPEED, fx: 'snipe', len: 1400, w: 24 }] },
    s2: { name: 's2', dur: RAIN_DUR() / ATK_SPEED, armor: true, aim: 0.25, range: [0, 900], ev: Array.from({ length: RAIN_N }, (_, i) => ({ t: (RAIN_T0 + i * RAIN_IV) / ATK_SPEED, fx: 'rain', r: RAIN_R })) },
    ult: { name: 'ult', dur: 1.6, armor: true, aim: 0.7, ev: [{ t: 0.7, fx: 'crystal', len: 2000, w: 40 }] } };
}
function dianDefs() {   // 전위 AI: 쌍극 투척(중거리) / 지축 강타(근접: 파고들어 내려찍음) / 불사의 광기
  const bl = HEROES.dian.bal;
  return {
    s1: { name: 's1', dur: 0.6 / ATK_SPEED, aim: 0.1, range: 560, cond: f => { const t = nearestOpp(f); return !t || dist(f, t) > 200; }, ev: [{ t: 0.18 / ATK_SPEED, fx: 'blades' }] },
    s2: { name: 's2', dur: 0.5 / ATK_SPEED, armor: true, aim: 0.15, range: [0, 280], ev: [{ t0: 0.16, t1: 0.36, fx: 'move', v: 600 }, { t: 0.4, fx: 'cone', r: SLAM_R, half: Math.PI, mult: 3.0 * SKILL_DMG_MULT * bl.s2, kb: 900, rec: 2, slam: true, s: true, afd: 0.25 }] },
    ult: { name: 'ult', dur: 1.1, aim: 0.2, ev: [{ t: 0.45, fx: 'rage', r: 240, half: Math.PI }] } };
}
function skillDefs(hero) {
  if (hero === 'huang') return huangDefs();
  if (hero === 'dian') return dianDefs();
  if (hero === 'diao') return diaoDefs();
  const bl = HEROES[hero].bal, S1M = 0.85 * SKILL_DMG_MULT * S1_DMG_MULT * bl.s1;
  if (hero === 'guan') return {
    s1: { name: 's1', dur: 1.4 + 0.3 * (GUAN_S1_N - 3), armor: true, aim: 0.1, range: 230, ev: GUAN_S1_TIMES.map(t => t * 2).map((t, i) => ({ t, fx: 'cone', r: S1_RADIUS, half: Math.PI, mult: S1M, kb: 260, rec: 2, spin: true, s: true, rot: (i + 1) * 2.1, afd: 0.2 })) },
    s2: { name: 's2', dur: 0.96, aim: 0.15, range: [150, 300], ev: [{ t0: 0.2, t1: 0.44, fx: 'dash', v: 2250 * ATK_SPEED, w: S2_WIDTH, mult: 2.4 * SKILL_DMG_MULT * bl.s2, kb: 600 * S2_KB_MULT }, { t: 0.44, fx: 'cone', r: S2_BLAST, half: Math.PI, mult: SKILL_DMG_MULT * bl.s2, kb: 350 * S2_KB_MULT, s: true, afd: 0.2 }] },
    ult: ultDef(hero) };
  if (hero === 'lubu') return {
    s1: switchDef('lubu'),
    s2: { ...rushDef(RUSH_SPECS.one, true, false, bl.s2), range: [190, 440] },
    ult: rushDef(RUSH_SPECS.three, true, true, bl.u) };
  if (hero === 'zhao') return {
    s1: { name: 's1', dur: FLURRY_DUR / ATK_SPEED, armor: true, aim: 0.1, range: 380, ev: FLURRY_TIMES.map((t, i) => ({ off: FLURRY_OFFS[i % FLURRY_OFFS.length], t: t / ATK_SPEED, fx: 'line', len: FLURRY_LEN, w: FLURRY_W, mult: S1M * FLURRY_MULT, kb: 120, rec: 1, thrust: true, retar: true, bw: FLURRY_W * 0.3, bd: 0.18 })) },
    s2: { ...rushDef(RUSH_SPECS.zhao, true, true, bl.s2), range: [180, 440] },
    ult: { name: 'zult', zult: true, dur: 99, invul: true, aim: 0, ev: [] } };
  return {
    s1: switchDef('lubu2'),
    s2: { name: 's2', dur: 1.0 + 0.24 * (SHOOT_N - 3), aim: 0.2, range: [260, 560], ev: SHOOT_TIMES.map(t => t * 2).map(t => ({ t, fx: 'arrows', n: 3, spread: 0.18, mult: 2.4 * SKILL_DMG_MULT * S2_ARROW_MULT * bl.s2 })) },
    ult: { name: 'lult', lult: true, dur: 99, invul: true, aim: 0, ev: [{ t: LU_WIND + LU_SWING * 0.55, fx: 'cone', r: ULT_RADIUS, half: Math.PI }] } };
}
function diaoDefs() {   // 초선 AI: 연꽃 치유(다친 아군이 있거나 적이 가까울 때) / 월하 축복(축복이 꺼져 있을 때) / 경국지색
  return {
    s1: { name: 's1', dur: DIAO_S1_DUR() / ATK_SPEED, armor: true, aim: 0.1, range: 330, cond: f => lotusWanted(f) || (nearestOpp(f) && dist(f, nearestOpp(f)) < 230), ev: DIAO_S1_TIMES.map(t => ({ t: t / ATK_SPEED, fx: 'lotus', r: LOTUS_DMG_R, half: Math.PI })) },
    s2: { name: 's2', dur: 0.55 / ATK_SPEED, armor: true, aim: 0.1, range: [0, 420], cond: f => f.blessT < 3, ev: [{ t: 0.2 / ATK_SPEED, fx: 'bless', r: 260, half: Math.PI }] },
    ult: ultDef('diao') };
}
const FKIT = { guan: { reach: 175 }, lubu: { reach: 175 }, lubu2: { reach: 175 }, zhao: { reach: 175 }, diao: { reach: 175 }, dian: { reach: 175 }, huang: { reach: 380, keep: 230 } };   // AI 접근 거리: 공격 범위가 비슷해졌으므로 비슷하게

function makeFighter(hero, team, x, y) {
  const mt = metaFull(hero), hm = heroMaxHp(hero);
  return { meta: mt, fighter: true, hero, team, type: 'fighter', d: { name: DUEL_NAME[hero], hitRec: 0.32 }, x, y, r: 20, mounted: HEROES[hero].mounted, hp: hm, maxhp: hm, atk: HERO_STATS.atk + mt.fl.atk, speed: HERO_STATS.speed * (1 + mt.spd),
    state: 'move', t: 0, kx: 0, ky: 0, freeze: 0, face: team === 'ally' ? 0 : Math.PI, cur: null, atkCd: rand(0.7, 1.5), flash: 0, spawnT: 0, armor: false, boss: false, walk: rand(0, 6), dead: false,
    rage: 0, cd: { s1: rand(0, 2), s2: rand(0, 3) }, s2Store: { lubu: 0, lubu2: 0 }, dashCd: 0, invT: 0, hitT: 0, hitAng: 0, hitMag: 1, guardT: 0, ultGuardT: 0, runT: 0, aspdT: 0, postUltT: 0, comboBuffT: 0, blessT: 0, undyT: 0, floorT: 0, floorUsed: false, hits: 0, hitsT: 0, hitTier: 0, ghostT: 0, moving: false, act: null, combo: 0, comboT: 0, lean: 1, skills: skillDefs(hero), seed: rand(0, 6) };
}
// 조작 영웅 변경: 눌린 아군 AI(f)와 지금 조작 중인 영웅(P)이 서로 역할을 맞바꿈 (위치·생명력·분노·스킬 쿨타임을 그대로 주고받음). 쓰러져 관전 중이면 살아있는 아군으로 옮겨 다시 조작 가능
const DUEL_ROW = { x: 10, get y() { return mode === 'duel' ? 32 : 10; }, w: 200, h: 38, step: 42 };   // HUD 왼쪽 목록 (0 = 현재 조작 영웅, 1~2 = 아군 AI)
// 목록 순서는 영웅 선택 순서로 고정 (조작 영웅을 바꿔도 칸이 바뀌지 않고, 현재 조작 영웅 칸만 금색으로 강조)
function duelRowAt(x, y) { if ((mode !== 'duel' && !RAID) || state !== 'play') return -1; for (let i = 0; i < (duel || RD).order.length; i++) { const ry = DUEL_ROW.y + i * DUEL_ROW.step; if (x >= DUEL_ROW.x && x <= DUEL_ROW.x + DUEL_ROW.w && y >= ry && y <= ry + DUEL_ROW.h) return i; } return -1; }
function swapControl(f) {
  if (NET.on) return false;
  const D = duel || RD;
  if ((mode !== 'duel' && !RAID) || state !== 'play' || !f || f.dead || D.swapCd > 0) return false;
  const a = P.act; if (!P.dead && a && (a.type === 'ult' || a.type === 'stun' || a.invul)) return false;   // 궁극기·스턴·무적 연출 중에는 변경 불가
  const oldHero = curHero, oldForm = HERO.id, o = { x: P.x, y: P.y, face: P.face, hp: P.hp, rage: P.rage, s1: P.cd.s1, s2: P.cd.s2, dead: P.dead, inv: P.inv, kx: P.kx, ky: P.ky, runT: P.runBuffT, guardT: P.guardT, ultGuardT: P.ultGuardT, aspdT: P.aspdT, postUltT: P.postUltT, comboBuffT: P.comboBuffT, blessT: P.blessT, undyT: P.undyT, floorT: P.floorT, floorUsed: P.floorUsed, hits: P.hits, hitsT: P.hitsT, hitTier: P.hitTier };
  const nw = { hero: f.hero, x: f.x, y: f.y, face: f.face, hp: f.hp, rage: f.rage, s1: f.cd.s1, s2: f.cd.s2, kx: f.kx, ky: f.ky, inv: f.invT, runT: f.runT, guardT: f.guardT, ultGuardT: f.ultGuardT, aspdT: f.aspdT, postUltT: f.postUltT, comboBuffT: f.comboBuffT, blessT: f.blessT, undyT: f.undyT, floorT: f.floorT, floorUsed: f.floorUsed, hits: f.hits, hitsT: f.hitsT, hitTier: f.hitTier };
  Object.assign(f, { meta: metaFull(oldHero), speed: HERO_STATS.speed * (1 + metaFull(oldHero).spd), atk: HERO_STATS.atk + metaFull(oldHero).fl.atk, maxhp: heroMaxHp(oldHero), hero: oldForm, mounted: HEROES[oldForm].mounted, skills: skillDefs(oldForm), d: { name: DUEL_NAME[oldForm], hitRec: 0.32 }, x: o.x, y: o.y, face: o.face, hp: o.hp, rage: o.rage, kx: o.kx, ky: o.ky, invT: o.inv, dead: o.dead,
    act: null, state: 'move', t: 0, armor: false, atkCd: 0.4, comboT: 0, combo: 0, dashCd: 0, freeze: 0, flash: 0, runT: o.runT, guardT: o.guardT, ultGuardT: o.ultGuardT, aspdT: o.aspdT, postUltT: o.postUltT, comboBuffT: o.comboBuffT, blessT: o.blessT, undyT: o.undyT, floorT: o.floorT, floorUsed: o.floorUsed, hits: o.hits, hitsT: o.hitsT, hitTier: o.hitTier });
  f.cd.s1 = o.s1; f.cd.s2 = o.s2;
  curHero = pcId(nw.hero); HERO = HEROES[nw.hero]; if (curHero === 'lubu') LUBU_FORM = nw.hero; { const ts = P.s2Store; P.s2Store = f.s2Store; f.s2Store = ts; } applyLabels();
  Object.assign(P, { x: nw.x, y: nw.y, face: nw.face, hp: nw.hp, rage: nw.rage, kx: nw.kx, ky: nw.ky, inv: Math.max(nw.inv, 0.3), dead: false, act: null, freeze: 0, combo: 0, comboT: 0, runT: 0, runBuffT: nw.runT, guardT: nw.guardT, ultGuardT: nw.ultGuardT, aspdT: nw.aspdT, postUltT: nw.postUltT, comboBuffT: nw.comboBuffT, blessT: nw.blessT, undyT: nw.undyT, floorT: nw.floorT, floorUsed: nw.floorUsed, hits: nw.hits, hitsT: nw.hitsT, hitTier: nw.hitTier, flash: 0 });
  P.cd.s1 = nw.s1; P.cd.s2 = nw.s2; P.atkCd = 0.4; P.autoBusy = null; for (const k in buf) buf[k] = -9;
  ring(P.x, P.y, 90, 0.4, HERO.ult.a, 8); ring(P.x, P.y, 150, 0.5, '#4fb0ff', 5); sparks(P.x, P.y - 20, 24, HERO.ult.a, 600, 0.5); sfx('skill');
  { const t = { drN: P.drN, drT: P.drT, drBusy: P.drBusy, drCur: P.drCur }; P.drN = f.drN; P.drT = f.drT; P.drBusy = f.drBusy; P.drCur = f.drCur; Object.assign(f, t); }   // 상태 이상 저항 횟수도 영웅을 따라간다
  D.swapCd = 1.5; if (TUT) tutEvent('swap'); return true;
}
function cycleControl() { const D = duel || RD, n = allies.length; for (let k = 0; k < n; k++) { const f = allies[(D.cyc++) % n]; if (f && !f.dead) return swapControl(f); } return false; }
function startDuel(picks) {
  speedIdx = SPEED_1X;
  resetRun(); resetRS(); BTN.find(b => b.id === 'auto').y = 375;   // 로그라이크와 같은 위치: HIT 표시와 회피 버튼의 중간
  const shuf = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]), POOL = HERO_IDS.slice();
  const ap = picks && picks.length >= 1 ? picks.slice(0, 3) : shuf(POOL).slice(0, 3), fp = (duelFoes.length === ap.length && duelFoes.every(h => HEROES[h])) ? duelFoes.slice() : shuf(POOL).slice(0, ap.length);   // 아군 = 영웅 선택 화면에서 고른 3명 (첫 번째 = 조작 영웅) / 적 = 같은 3명 (배치 랜덤)
  duelLast = ap.slice();
  mode = 'duel'; applyGrowth('duel'); selHero = ap[0]; LUBU_FORM = 'lubu'; applyHero(); resetPlayer(); P.maxhp = heroMaxHp(curHero); P.hp = P.maxhp; P.x = ARENA_C.x - 420; P.y = ARENA_C.y; P.face = 0;
  enemies = []; allies = []; projectiles = []; fx = []; dts = []; items = [];
  kills = 0; clock = 0; winT = 0; autoDodgeCd = 0; shake = 0; hitstop = 0; slowT = 0; flashT = 0; tagFx = null; joy = null; auto = false; waveIdx = 0; bannerT = 0; pendingSpawn = false; spawnQ = [];
  for (const k in buf) buf[k] = -9;
  cam.x = P.x - W / 2; cam.y = P.y - H / 2;
  ap.slice(1).forEach((h, i) => allies.push(makeFighter(h, 'ally', ARENA_C.x - 470, ARENA_C.y + (i ? 150 : -150))));
  { const FP = ap.length === 1 ? [[420, 0]] : ap.length === 2 ? [[470, -150], [420, 0]] : [[470, -150], [420, 0], [470, 150]]; fp.forEach((h, i) => enemies.push(makeFighter(h, 'foe', ARENA_C.x + FP[i][0], ARENA_C.y + FP[i][1]))); }   // 아군 진영(조작 영웅 -420, 아군 -470 ±150)과 좌우 대칭 배치
  duel = { stats: {}, order: ap.slice(), t: DUEL_TIME, t0: 0, swapCd: 0, cyc: 0, foes: enemies.slice(), title: '', sub: '', col: '' };
  state = 'play'; if (tutNeeded('duel')) tutBegin('duel');
}

// ---------- 전투 판정 ----------
function oppUnits(f) { return f.team === 'foe' ? (P.dead ? allies.filter(u => !u.dead) : [P, ...allies.filter(u => !u.dead)]) : enemies.filter(u => (u.fighter || RAID) && !u.dead && u.spawnT <= 0); }   // 레이드: 아군 AI 는 보스와 부하도 상대
function nearestOpp(f) { let b = null, bd = 1e9; for (const u of oppUnits(f)) { const d = dist(f, u); if (d < bd) { bd = d; b = u; } } return b; }
// ---- AI 버프·피해 보정: 플레이어와 같은 규칙 (HIT 단계 공속·피해 / 3단 공격 성공 버프 / 궁극기 후 공격력 / 방어력) ----
const fComboTier = f => { const h = HEROES[f.hero]; return h.hitBonus ? (f.hits >= h.hitBonus.start ? Math.floor((f.hits - h.hitBonus.start) / h.hitBonus.step) + 1 : 0) : Math.min(COMBO_MAX_TIER, Math.floor(f.hits / COMBO_STEP)); };
const fComboPct = f => fComboTier(f) * (HEROES[f.hero].hitBonus ? HEROES[f.hero].hitBonus.per : COMBO_BONUS);
const fAtkMul = f => { const h = HEROES[f.hero]; return (f.blessT > 0 ? 1 + BLESS_ATK : 1) * (f.undyT > 0 && h.undy ? h.undy.atk : 1) * (1 + fComboPct(f)) * (1 + f.meta.atk) * (h.postUltAtk && f.postUltT > 0 ? h.postUltAtk : 1) * (h.comboBuff && f.comboBuffT > 0 ? h.comboBuff.atk : 1); };
const fDef = f => { const h = HEROES[f.hero]; return 1 + (f.blessT > 0 ? BLESS_DEF : 0) + (h.guard && f.guardT > 0 ? h.guard.bonus : 0) + (h.ultGuard && f.ultGuardT > 0 ? h.ultGuard : 0) + f.meta.fl.def / 100; };
const fRate = (f, def) => (def.name === 'atk' || def.name === 's1' || def.name === 's2') ? (1 + fComboPct(f)) * (1 + f.meta.aspd) * (HEROES[f.hero].aspdBuff && f.aspdT > 0 ? HEROES[f.hero].aspdBuff.mult : 1) * (HEROES[f.hero].postUltAspd && f.postUltT > 0 ? HEROES[f.hero].postUltAspd : 1) : 1;
function comboDone(f) {   // 공격 3단계가 적중: 영웅별 버프 (방어력 / 질주 / 공속 / 공격력) — 플레이어와 동일
  const h = HEROES[f.hero];
  if (h.comboHeal) comboHeal(f);   // 초선: 주변 아군 회복
  if (h.guard) { const was = f.guardT > 0; f.guardT = h.guard.dur; if (!was) { dmgText(f.x, f.y - 100, '방어력 +' + Math.round(h.guard.bonus * 100) + '%', '#8fb4ff', 24); ring(f.x, f.y, 60, 0.3, '#8fb4ff', 5); } }
  if (h.runBonus) { if (f.runT <= 0) { dmgText(f.x, f.y - 100, '이동속도 +' + Math.round((h.runBonus - 1) * 100) + '%', '#7fd0ff', 24); ring(f.x, f.y, 70, 0.3, '#7fd0ff', 5); } f.runT = h.runDur; }
  if (h.aspdBuff) { if (f.aspdT <= 0) dmgText(f.x, f.y - 100, '공속 +' + Math.round((h.aspdBuff.mult - 1) * 100) + '%', '#bfe8ff', 24); f.aspdT = h.aspdBuff.dur; }
  if (h.comboBuff) { if (f.comboBuffT <= 0) dmgText(f.x, f.y - 100, '공격력 +' + Math.round((h.comboBuff.atk - 1) * 100) + '%', '#ffd34d', 24); f.comboBuffT = h.comboBuff.dur; }
}
function fHit(f, o, amt) {
  const fls = f.meta.ls + (f.undyT > 0 && HEROES[f.hero].undy ? HEROES[f.hero].undy.ls : 0); if (fls > 0) { const hv = Math.min(f.maxhp - f.hp, amt * fls); if (hv > 0) { f.hp += hv; recHeal(f, f, hv); } }   // 흡혈   // 적중 성공: 분노·HIT 누적 (HIT 단계가 오르면 문구)
  f.hits++; f.hitsT = 3;
  const tier = fComboTier(f), h = HEROES[f.hero];
  if (tier > f.hitTier) { f.hitTier = tier; if (!h.hitBonus || tier === 1) { dmgText(f.x, f.y - 100, '공속·피해 +' + Math.round(fComboPct(f) * 100) + '%', '#ffb04d', 24); ring(f.x, f.y, 80, 0.35, '#ffb04d', 4); } }
}
function dmgUnit(f, u, dmg, o) {   // f 가 u 에게 dmg 피해 (u = 플레이어 / 아군 AI / 적 AI) — 플레이어 스킬과 같은 피해·밀치기·경직·스턴·분노 규칙
  let landed;
  if (u === P) { if (P.dead) return false; const crit = Math.random() < 0.2 + f.meta.crit, before = P.hp; hurtPlayer(Math.round(dmg * fAtkMul(f) * (crit ? 1.8 + f.meta.critDmg : 1) * rand(0.92, 1.08)), f, false, o.stun || 0, o.rec, o.kb || 0); landed = P.hp < before; }
  else landed = hitEnemy(u, dmg, { from: f, kb: o.kb || 0, rec: o.rec, stun: o.stun, slow: o.slow, ai: true, by: f, rage: 0 });
  if (landed && o.slow && u === P) P.slowT = Math.max(P.slowT || 0, o.slow * drPeek(P));
  if (landed) fHit(f, o, dmg * fAtkMul(f));
  return landed;
}
function arcHit(f, radius, half, dmg, o) {
  let n = 0;
  for (const u of oppUnits(f)) {
    const d = dist(f, u); if (d - u.r > radius) continue;
    if (half < Math.PI && d > u.r + 24 && angDiff(f.face, angTo(f, u)) > half + Math.atan2(u.r, Math.max(d, 1))) continue;
    if (dmgUnit(f, u, o && o.far ? dmg * farMul(o.far, d - 150, radius - 150) : dmg, o)) n++;
  }
  return n;
}
function lineHit(f, len, w, dmg, o) {
  const ca = Math.cos(f.face), sa = Math.sin(f.face); let n = 0;
  for (const u of oppUnits(f)) { const dx = u.x - f.x, dy = u.y - f.y, lx = dx * ca + dy * sa, ly = Math.abs(-dx * sa + dy * ca); if (lx >= -u.r && lx <= len + u.r && ly <= w / 2 + u.r && dmgUnit(f, u, dmg, o)) n++; }
  return n;
}
function execEv(f, ev, a) {
  fxHeroNow = f.hero;   // AI 스킬 이벤트: 연출·피해는 플레이어 스킬과 동일
  const H_ = HEROES[f.hero], shk = n => { if (dist(f, P) < 700) doShake(n); };
  if (ev.fx === 'aim') { const t = a.target && !a.target.dead ? a.target : nearestOpp(f); if (t) f.face = angTo(f, t); return; }
  if (ev.fx === 'cone') {
    const fc = ev.s ? H_.fx.s : H_.fx.a, both = ev.spin || ev.half >= Math.PI, dur = ev.afd || 0.22;
    if (ev.retar) { const t = nearestOpp(f); if (t && dist(f, t) < 420) f.face = angTo(f, t); }
    const rot = ev.rot || 0, cf = Math.cos(f.face), sf = Math.sin(f.face);
    if (ev.ranged) arrowStreak(f, ev.r, ev.off || 0); else if (both) { arcFx(f.x, f.y, f.face + rot, ev.r, 1.5, dur, fc, 1); arcFx(f.x, f.y, f.face + rot + Math.PI, ev.r, 1.5, dur, fc, 1); } else arcFx(f.x, f.y, f.face, ev.r, ev.half, dur, fc, ev.dir || 1);
    sfx('swing');
    if (ev.slam) { ring(f.x + cf * 110, f.y + sf * 110, 90, 0.3, '#ffb070', 10); sparks(f.x + cf * 120, f.y, 12, '#c9a46a', 420, 0.5); shk(7); sfx('boom'); }
    if (ev.cs) { sparks(f.x + cf * ev.r * 0.6, f.y - 8, 6 + ev.cs * 3, '#fff4d0', 300 + ev.cs * 100, 0.3); shk(3 + ev.cs * 2); }
    const n = arcHit(f, ev.r, ev.half, f.atk * ev.mult, ev);
    if (ev.stg === 2 && n > 0) comboDone(f);   // 공격 3단계 성공
  } else if (ev.fx === 'line') {
    if (ev.retar) { const t = nearestOpp(f); if (t && dist(f, t) < ev.len) f.face = angTo(f, t); }
    const fb0 = f.face; if (ev.off) f.face = fb0 + ev.off;
    const ca = Math.cos(f.face), sa = Math.sin(f.face);
    fx.push({ k: 'beam', hid: fxHeroNow, x: f.x + ca * ev.len / 2, y: f.y - 14 + sa * ev.len / 2, ang: f.face, len: ev.len / 2, w: ev.bw != null ? ev.bw : ev.w * 0.5, t: 0, dur: ev.bd || 0.3 }); sfx('swing');
    if (ev.rg) { ring(f.x + ca * 40, f.y + sa * 40, 60, 0.25, H_.fx.s, 6); shk(5); }
    lineHit(f, ev.len, ev.w, f.atk * ev.mult, ev); f.face = fb0;
  } else if (ev.fx === 'arrows') {
    const tg = nearestOpp(f); if (tg && dist(f, tg) < 900) f.face = angTo(f, tg);
    for (let k = 0; k < ev.n; k++) { const ang = f.face + (k - (ev.n - 1) / 2) * ev.spread; projectiles.push({ x: f.x + Math.cos(f.face) * 30, y: f.y - 14 + Math.sin(f.face) * 30, vx: Math.cos(ang) * 950, vy: Math.sin(ang) * 950, dmg: f.atk * ev.mult, life: ARROW_LIFE, r: 12, arrow: true, team: f.team, owner: f, hit: new Set() }); }
    sparks(f.x + Math.cos(f.face) * 30, f.y - 14, 4, '#f2e7c9', 200, 0.25); sfx('swing');
  } else if (ev.fx === 'blast') {   // 돌격 종료 폭발 (적토 돌격은 링·후속 버프까지)
    arcFx(f.x, f.y, f.face, ev.r, 1.5, 0.2, H_.fx.s, 1); arcFx(f.x, f.y, f.face + Math.PI, ev.r, 1.5, 0.2, H_.fx.s, 1);
    arcHit(f, ev.r, Math.PI, f.atk * ev.mult, ev);
    if (ev.ult) { ring(f.x, f.y, ev.r, 0.25, H_.ult.a, 5); shk(5); if (H_.postUltAtk) { f.postUltT = H_.postUltDur; dmgText(f.x, f.y - 100, '공격력 +' + Math.round((H_.postUltAtk - 1) * 100) + '%', '#ffb04d', 26); } } else shk(8);
  } else if (ev.fx === 'snipe') {   // 황충 백보천양
    sniperShot(f);
  } else if (ev.fx === 'rain') {   // 황충 화살비 한 번
    rainPulse(f, a);
  } else if (ev.fx === 'crystal') {   // 황충 마법의 수정화살
    crystalFire(f);
  } else if (ev.fx === 'blades') {   // 전위 쌍극 투척
    throwBlades(f);
  } else if (ev.fx === 'rage') {   // 전위 불사의 광기
    rageStart(f);
  } else if (ev.fx === 'lotus') {   // 초선 연꽃 치유 한 번
    lotusPulse(f);
  } else if (ev.fx === 'bless') {   // 초선 월하 축복
    moonBless(f);
  } else if (ev.fx === 'form') {   // 여포 상마 <-> 하마 전환
    switchFighterForm(f);
  } else if (ev.fx === 'ult') {   // 궁극기 폭발
    shk(26); hitstop = Math.max(hitstop, 0.16); flashT = Math.max(flashT, 0.35); sfx('boom');
    ring(f.x, f.y, ULT_RADIUS, 0.6, H_.ult.a, 18); ring(f.x, f.y, 260, 0.45, '#fff', 10); ring(f.x, f.y, 160, 0.35, H_.ult.c, 12); sparks(f.x, f.y - 10, 50, H_.ult.a, 900, 0.8);
    if ((H_.postUltAtk || H_.postUltAspd) && !H_.ultRush) { f.postUltT = H_.postUltDur; dmgText(f.x, f.y - 100, (H_.postUltAspd ? '공속 +' + Math.round((H_.postUltAspd - 1) * 100) : '공격력 +' + Math.round((H_.postUltAtk - 1) * 100)) + '%', '#ffb04d', 26); }
    if (H_.healUlt) ultHeal(f);   // 초선: 범위 아군 대량 회복
    arcHit(f, ULT_RADIUS, Math.PI, f.atk * ev.mult, ev);
  }
}
function duelProjectile(p) {
  if (p.crystal) { crystalStep(p); if (p.x < 40 || p.y < 40 || p.x > WORLD.w - 40 || p.y > WORLD.h - 40) p.life = 0; return; }
  for (const u of oppUnits({ team: p.team })) if (!p.hit.has(u) && dist(p, { x: u.x, y: u.y - 14 }) < p.r + u.r) { p.hit.add(u); dmgUnit(p.owner, u, p.far ? p.dmg * farMul(p.far, Math.hypot(p.x - p.x0, p.y - p.y0) - 150, p.farR) : p.dmg, { kb: 120 }); }
  if (p.x < 40 || p.y < 40 || p.x > WORLD.w - 40 || p.y > WORLD.h - 40) p.life = 0;
}

// ---------- AI ----------
function beginAct(f, def, tgt) {
  f.act = { def, t: 0, ev: def.ev.map(e => ({ ...e, done: false, set: e.fx === 'dash' ? new Set() : null })), target: tgt }; f.state = 'act'; f.armor = !!def.armor;
  if (def.inv) f.invT = Math.max(f.invT, def.inv);
  if (def.name === 'ult') { const h = HEROES[f.hero]; if (h.ultGuard) { f.ultGuardT = h.ultGuardDur; dmgText(f.x, f.y - 100, '방어력 +' + Math.round(h.ultGuard * 100) + '%', '#7fffd0', 24); } }   // 궁극기 사용 시 방어력 증가 (관우)
  if (tgt) f.face = angTo(f, tgt);
}
function endAct(f) { const combo = f.act && f.act.def.name === 'atk'; f.act = null; f.state = 'move'; f.armor = false; f.atkCd = combo ? 0.1 + rand(0, 0.2) : 0.35 + rand(0, 0.35); }
function threatened(f) {   // 근처 상대가 공격 동작(선딜) 중인가
  for (const u of oppUnits(f)) {
    if (dist(f, u) > 330) continue;
    if (u === P) { const a = P.act; if (a && ['atk', 's1', 's2', 'rush', 'ult', 'shoot'].includes(a.type) && a.t < 0.3) return u; }
    else if (u.act && u.act.t < 0.35 && u.act.def.name !== 'dodge') return u;
  }
  return null;
}
function runAct(f, dt) {
  const a = f.act, def = a.def, H_ = HEROES[f.hero], dtr = dt * fRate(f, def); a.t += dtr; f.dashing = false;   // 공속 버프(HIT·조운 3단 버프)는 평타·스킬1·스킬2 에만 적용 (플레이어와 동일)
  if (def.lult) {   // 여포(하마) 천하무쌍 (AI): 플레이어와 같은 360° 휘두르기 + 검기 연타
    f.invT = Math.max(f.invT, 0.1);
    if (a.t < LU_WIND) { const t = a.target && !a.target.dead ? a.target : nearestOpp(f); if (t) f.face = angTo(f, t); }
    if (lultStep(f, a, H_, (sh, o) => arcHit(f, ULT_RADIUS, Math.PI, f.atk * 6.5 * SKILL_DMG_MULT * ULT_DMG_MULT * H_.bal.u * sh, { kb: o.kb, stun: o.stun, rage: 0 }))) { zultEnd(f, H_); endAct(f); }
    return;
  }
  if (def.zult) {   // 조운 백룡강림 (AI): 플레이어와 같은 고속 연속 찌르기
    f.invT = Math.max(f.invT, 0.1); f.dashing = a.t >= ZU_WIND;
    if (a.t < ZU_WIND) { lanceStreaks(f.x, f.y); const t = a.target && !a.target.dead ? a.target : nearestOpp(f); if (t) f.face = angTo(f, t); }
    else {
      if (!a.z) { a.z = zultInit(f, oppUnits(f)); flashT = Math.max(flashT, 0.12); sfx('boom'); ring(f.x, f.y, 120, 0.3, H_.ult.a, 8); }
      const per = f.atk * 6.5 * SKILL_DMG_MULT * ULT_DMG_MULT * H_.bal.u / ZU_H0;
      if (zultStep(f, a, a.z, tg => { dmgUnit(f, tg, per, { kb: 40, stun: 2.2, rage: 0 }); zultHitFx(f, tg); })) { zultEnd(f, H_); f.dashing = false; endAct(f); }
    }
    return;
  }
  const cf = Math.cos(f.face), sf = Math.sin(f.face);
  if (def.aim && a.t < def.aim && a.target && !a.target.dead) f.face = angTo(f, a.target);
  if (def.move && a.t >= def.move[0] && a.t < def.move[1]) {
    const env = lungeEase((a.t - def.move[0]) / (def.move[1] - def.move[0]));
    f.x += Math.cos(f.face) * def.move[2] * dtr * env; f.y += Math.sin(f.face) * def.move[2] * dtr * env;
    f.lungeT = 0.22; f.walk += dt * 14 * env; f.moving = true;
  }
  if (def.name === 'ult') {   // 궁극기 연출: 기운이 무기 끝으로 모임 -> 분출 -> (방천화극·백룡강림) 폭발 뒤 솟구치는 기운
    const at = a.t * ATK_SPEED, tx = f.x, ty = f.y - H_.ult.tipH;
    if (at < 0.15 && Math.random() < 0.8) { const ang = rand(0, TAU), sx = f.x + Math.cos(ang) * 230, sy = f.y + Math.sin(ang) * 170, dx = tx - sx, dy = ty - sy, l = Math.hypot(dx, dy); fx.push({ k: 'spark', x: sx, y: sy, vx: dx / l * 520, vy: dy / l * 520, t: 0, dur: 0.4, color: H_.ult.a, sz: 5 }); }
    if (H_.ultStyle === 'lance' && at >= 0.12 && at < 0.55) lanceStreaks(f.x, f.y);
    if (at >= 0.15 && at < 0.55) for (let k = 0; k < 2; k++) { const ang = rand(0, TAU), sp = rand(180, 520); fx.push({ k: 'spark', x: tx + rand(-20, 20), y: ty + rand(-40, 40), vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 120, t: 0, dur: rand(0.3, 0.6), color: Math.random() < 0.5 ? H_.ult.b : H_.ult.a, sz: rand(3, 6) }); }
    if (at >= 0.55 && at < 0.9 && (H_.ultStyle === 'halberd' || H_.ultStyle === 'lance')) for (let k = 0; k < 3; k++) { const ang = rand(0, TAU), rr = Math.sqrt(Math.random()) * ULT_RADIUS, lc = H_.ultStyle === 'lance'; fx.push({ k: 'spark', x: f.x + Math.cos(ang) * rr, y: f.y + Math.sin(ang) * rr * 0.75, vx: rand(-30, 30), vy: rand(-260, -120), t: 0, dur: rand(0.4, 0.8), color: lc ? (Math.random() < 0.5 ? '#bfe8ff' : '#ffffff') : (Math.random() < 0.5 ? '#ff7a3a' : '#ffd27a'), sz: rand(4, 8) }); }
  }
  for (const ev of a.ev) {
    if (ev.fx === 'dash' || ev.fx === 'move') {
      if (a.t >= ev.t0 && a.t < ev.t1) {
        const ang = ev.back ? f.face + Math.PI : ev.ang != null ? ev.ang : f.face, ca = Math.cos(f.face), sa = Math.sin(f.face);
        if (ev.fx === 'dash' && !ev.started) { ev.started = true; if (ev.rush) { sfx('swing'); if (ev.ult) { for (let k = 0; k < 10; k++) { const off = rand(-ev.w, ev.w); streak(f.x - sa * off, f.y + ca * off - 6, f.face + Math.PI, rand(140, 260), rand(2, 4), 0.3, k % 2 ? '#fff4d0' : '#ff9a4a'); } sparks(f.x, f.y + 8, 10, '#ffd27a', 500, 0.3); } } }
        f.x += Math.cos(ang) * ev.v * dtr; f.y += Math.sin(ang) * ev.v * dtr; f.dashing = true; f.walk += dtr * 20;
        if (ev.fx === 'move') { if (Math.random() < 0.7) fx.push({ k: 'spark', x: f.x, y: f.y + 8, vx: rand(-60, 60), vy: rand(-60, 60), t: 0, dur: 0.3, color: '#bfe8ff', sz: 5 }); }
        else {
          f.invT = Math.max(f.invT, 0.05);   // 질주 중 무적 (플레이어와 동일)
          if (ev.rush) {
            f.ghostT -= dt; if (f.ghostT <= 0) { ghost(f.x, f.y, f.face, f.hero); f.ghostT = 0.03; }
            if (ev.ult) {
              for (let k = 0; k < 4; k++) { const off = rand(-ev.w, ev.w) * 0.9; streak(f.x - sa * off - ca * rand(0, 30), f.y + ca * off - sa * rand(0, 30) - 6, f.face + Math.PI, rand(110, 240), rand(1.5, 3.5), 0.22, k % 2 ? '#fff4d0' : '#ff9a4a'); }
              fx.push({ k: 'fire', x: f.x - ca * 20, y: f.y + 10 - sa * 20, r: rand(14, 22), t: 0, dur: 0.3 }); f.ghostT = Math.min(f.ghostT, 0.015);
            } else sparks(f.x, f.y + 12, 1, '#c9a46a', 140, 0.3);
          }
          for (const u of oppUnits(f)) if (!ev.set.has(u) && dist(f, u) < u.r + ev.w) { ev.set.add(u); dmgUnit(f, u, f.atk * ev.mult, ev); }
        }
      } else if (ev.fx === 'dash' && ev.ult && !ev.ended && a.t >= ev.t1) { ev.ended = true; sparks(f.x, f.y + 6, 8, '#ffd27a', 420, 0.3); }
    } else if (ev.fx === 'windfx') {   // 적토 돌격 선딜: 질주 방향 뒤쪽으로 속도선
      if (a.t >= ev.t0 && a.t < ev.t1 && Math.random() < 0.8) { const off = rand(-ev.w, ev.w); streak(f.x - sf * off + cf * rand(20, 70), f.y + cf * off + sf * rand(20, 70) - 6, f.face + Math.PI, rand(60, 130), 2, 0.18, '#ffb070'); }
    } else if (!ev.done && ev.t != null && a.t >= ev.t) { ev.done = true; execEv(f, ev, a); }
  }
  if (a.t >= def.dur) endAct(f);
}
function updateFighter(f, dt) {
  const Hf = HEROES[f.hero]; f.bgT = Math.max(0, (f.bgT || 0) - dt);
  f.guardT = Math.max(0, f.guardT - dt); f.ultGuardT = Math.max(0, f.ultGuardT - dt); f.aspdT = Math.max(0, f.aspdT - dt); f.postUltT = Math.max(0, f.postUltT - dt); f.comboBuffT = Math.max(0, f.comboBuffT - dt); f.blessT = Math.max(0, f.blessT - dt); f.undyT = Math.max(0, (f.undyT || 0) - dt); f.floorT = Math.max(0, (f.floorT || 0) - dt);
  if (f.hitsT > 0) { f.hitsT -= dt; if (f.hitsT <= 0) { f.hits = 0; f.hitTier = 0; } }   // 3초간 적중이 없으면 HIT 초기화
  if (f.runT > 0) f.runT = (f.moving || (f.act && f.act.def.name === 'rush')) ? Hf.runDur : Math.max(0, f.runT - dt);   // 질주: 이동 중이거나 돌격 중이면 지속시간 갱신
  f.moving = false;
  f.lungeT = Math.max(0, (f.lungeT || 0) - dt); f.hitT = Math.max(0, f.hitT - dt); f.flash = Math.max(0, f.flash - dt); f.invT = Math.max(0, f.invT - dt); f.rage = Math.min(100, f.rage + dt / ULT_CD * 100 * (1 + f.meta.rage)); f.cd.s1 = Math.max(0, f.cd.s1 - dt); f.cd.s2 = Math.max(0, f.cd.s2 - dt); for (const k in f.s2Store) f.s2Store[k] = Math.max(0, f.s2Store[k] - dt); f.dashCd = Math.max(0, f.dashCd - dt); if (f.slowT > 0) f.slowT -= dt; drTick(f, dt); f.atkCd -= dt; f.comboT -= dt;
  f.x += f.kx * dt; f.y += f.ky * dt; const kf = Math.exp(-9 * dt); f.kx *= kf; f.ky *= kf;
  if (f.freeze > 0) { f.freeze -= dt; arenaClamp(f); return; }
  if ((!f.human || netAuto(f)) && f.state !== 'stun' && f.dashCd <= 0 && !(f.act && (f.act.def.invul || f.act.def.name === 'ult' || f.act.def.name === 'dodge'))) {   // 자동 회피 (AUTO 플레이어와 동일 규칙)
    const dg = RAID ? raidDodgeDir(f) : dodgeDir(f);
    if (dg != null) { f.dashCd = dashCdNow(); f.invT = dashInvNow(); f.act = null; f.armor = false; beginAct(f, { name: 'dodge', dur: 0.26, ev: [{ t0: 0, t1: 0.22, fx: 'move', v: dashSpeedNow(), ang: dg }] }, null); runAct(f, dt); arenaClamp(f); return; }
  }
  if (f.state === 'hit' || f.state === 'stun') { if (f.act) { f.act = null; f.armor = false; } f.t -= dt; if (f.t <= 0) { f.state = 'move'; f.atkCd = Math.max(f.atkCd, 0.25); } arenaClamp(f); return; }
  const tgt = nearestOpp(f); if (!tgt) return;
  if (f.act) { runAct(f, dt); arenaClamp(f); return; }
  if (f.human && !netAuto(f)) { humanFighter(f, dt, tgt); arenaClamp(f); return; }   // 온라인 대전: 사람 입력
  const d = dist(f, tgt), kit = FKIT[f.hero], sk = f.skills; f.face = angTo(f, tgt);
  // 이동: 사정거리까지 접근, 가까우면 좌우로 조금씩 움직임
  const reach = kit.reach + tgt.r;
  if (kit.keep && d < kit.keep + tgt.r) { const sp = f.speed * 0.8 * (f.slowT > 0 ? 0.55 : 1), aw = f.face + Math.PI + (Math.sin(T * 0.9 + f.seed) > 0 ? 0.5 : -0.5); f.moving = true; f.x += Math.cos(aw) * sp * dt; f.y += Math.sin(aw) * sp * dt; f.walk += dt * 12; }   // 원거리 장수: 가까워지면 거리를 벌림
  else if (d > reach * 0.85) { const sp = f.speed * (Hf.runBonus && f.runT > 0 ? Hf.runBonus : 1) * (f.slowT > 0 ? 0.55 : 1); f.moving = true; f.x += Math.cos(f.face) * sp * dt; f.y += Math.sin(f.face) * sp * dt; f.walk += dt * 12; }
  else { const sd = Math.sin(T * 1.3 + f.seed) > 0 ? 1 : -1; f.x += Math.cos(f.face + Math.PI / 2) * sd * 70 * dt; f.y += Math.sin(f.face + Math.PI / 2) * sd * 70 * dt; f.walk += dt * 6; f.moving = true; }
  // 공격 결정: 궁극기 > 스킬2 > 스킬1 > 콤보
  if (f.atkCd <= 0) {
    if (f.rage >= 100 && (HEROES[f.hero].crystalUlt ? d < 1600 : d < 300)) { f.rage = 0; beginAct(f, sk.ult, tgt); sfx('skill'); }
    else if (f.cd.s2 <= 0 && d <= sk.s2.range[1] && (!sk.s2.cond || sk.s2.cond(f)) && Math.random() < 0.5) { f.cd.s2 = CD.s2 * (HEROES[f.hero].s2cdMul || 1) * (1 - f.meta.cd); beginAct(f, sk.s2, tgt); }
    else if (f.cd.s1 <= 0 && d <= sk.s1.range && (!sk.s1.cond || sk.s1.cond(f)) && Math.random() < 0.5) { f.cd.s1 = CD.s1 * (HEROES[f.hero].s1cdMul || 1) * (1 - f.meta.cd); beginAct(f, sk.s1, tgt); }
    else if (d <= reach + 25) { const st = f.comboT > 0 ? (f.combo + 1) % 3 : 0; f.combo = st; f.comboT = 1.0; beginAct(f, comboDef(f.hero, st), tgt); }
  }
  arenaClamp(f);
}
function updateDuel(dt) {
  duel.t -= dt; duel.t0 += dt; duel.swapCd = Math.max(0, duel.swapCd - dt);
  for (const f of allies) if (!f.dead) updateFighter(f, dt);
  for (const f of enemies) if (f.fighter && !f.dead) updateFighter(f, dt);
  // 겹침 해소 (질주 중인 파이터는 통과)
  const all = (P.dead ? [] : [P]).concat(allies.filter(u => !u.dead), enemies.filter(u => u.fighter && !u.dead));
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j]; if (a.dashing || b.dashing || ((a === P || b === P) && P.act && P.act.type === 'zult')) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = a.r + b.r - 4;
    if (d < min) { const k = (min - d) / 2 / d; if (a !== P) { a.x -= dx * k; a.y -= dy * k; } if (b !== P) { b.x += dx * k; b.y += dy * k; } }
  }
  // 승패
  const foesAlive = enemies.filter(e => e.fighter && !e.dead).length, mine = (P.dead ? 0 : 1) + allies.filter(a => !a.dead).length;
  const endDuel = (res, title, sub, col) => { state = res; winT = 0; duel.title = title; duel.sub = sub; duel.col = col; };
  if (!foesAlive) endDuel('win', 'VICTORY', '비무장 승리! 적을 모두 쓰러뜨렸습니다', '#ffd34d');
  else if (!mine) endDuel('lose', 'DEFEAT', '아군이 모두 쓰러졌습니다...', '#ff5a5a');
  else if (duel.t <= 0) {
    const myHp = (P.dead ? 0 : P.hp) + allies.reduce((t, a) => t + (a.dead ? 0 : a.hp), 0), foeHp = enemies.reduce((t, e) => t + (e.fighter && !e.dead ? e.hp : 0), 0);
    if (myHp > foeHp) endDuel('win', 'VICTORY', `시간 종료 — 남은 생명력 ${Math.round(myHp)} vs ${Math.round(foeHp)} 로 승리`, '#ffd34d');
    else endDuel('lose', myHp === foeHp ? 'DRAW' : 'DEFEAT', `시간 종료 — 남은 생명력 ${Math.round(myHp)} vs ${Math.round(foeHp)}`, '#ff9a5a');
  }
}

