'use strict';
// ---------- 오토 전투 AI ----------
function threatens(e) {
  const c = e.cur; if (!c) return false;
  const d = dist(e, P);
  if (c.kind === 'circle') return d <= c.r + P.r + 40;
  if (c.kind === 'cone') return d <= c.r + P.r + 40 && angDiff(e.face, angTo(e, P)) <= c.half + 0.3;
  if (c.kind === 'leap' || c.kind === 'rain') return Math.hypot((c.tx != null ? c.tx : e.x) - P.x, (c.ty != null ? c.ty : e.y) - P.y) <= c.r + P.r + 40;
  if (c.kind === 'cross') { const ang = e.face + c.off, dx = P.x - e.x, dy = P.y - e.y, lx = dx * Math.cos(ang) + dy * Math.sin(ang), ly = -dx * Math.sin(ang) + dy * Math.cos(ang), hw = c.w / 2 + P.r + 20; return (Math.abs(lx) <= c.len && Math.abs(ly) <= hw) || (Math.abs(ly) <= c.len && Math.abs(lx) <= hw); }
  if (c.kind === 'charge') { const a = angTo(e, P), along = Math.cos(a - e.face) * d, side = Math.abs(Math.sin(a - e.face) * d); return along > 0 && along < c.len + 60 && side < c.w / 2 + P.r + 20; }
  return false;
}
// ===== 비무장 자동 회피: AUTO 플레이어와 모든 AI 영웅(아군·적)이 같은 규칙을 쓴다 =====
//  상대 영웅의 공격이 적중하기 0.22초 전 (선딜 중인 공격의 판정 영역 안에 있을 때) 회피(대시: 무적 0.26초, 약 209px, 쿨타임 CD.dash)를 쓴다.
//  영역 밖으로 비껴 나가는 방향(아레나 안쪽)으로 피하고, 날아오는 화살도 피한다. 궁극기·스턴·무적 중에는 못 쓴다 (플레이어의 회피 규칙과 동일).
function dodgeEvents(at) {   // 공격자 at 의 곧 닿을 공격 판정들: { tt: 적중까지 남은 실제 초, fx, r, half, len, w }
  const out = [];
  if (at === P) {
    const a = P.act; if (!a || P.dead) return out;
    const add = (t, ev) => { const tt = (t - a.t) / ATK_SPEED; if (tt >= -0.02 && tt <= 0.25) out.push({ tt, ...ev }); };
    if (a.type === 'atk') { const c = comboTable()[a.c]; c.hits.forEach((h, i) => { if (i >= a.n) add(h, { fx: 'cone', r: c.rad, half: c.span ? Math.PI : c.half }); }); }
    else if (a.type === 's1') {
      if (HERO.s1Cone) CONE_TIMES.forEach((t, i) => { if (i >= a.hits) add(t, { fx: 'cone', r: CONE_HITS[i].r, half: CONE_HITS[i].half }); });
      else if (HERO.s1Flurry) FLURRY_TIMES.forEach((t, i) => { if (i >= a.hits) add(t, { fx: 'line', len: FLURRY_LEN, w: FLURRY_W / 2 }); });
      else if (HERO.thrust) { if (a.hits < 1) add(0.12, { fx: 'line', len: THRUST_LEN, w: THRUST_W / 2 }); }
      else if (HERO.s1Heal) DIAO_S1_TIMES.forEach((t, i) => { if (i >= a.hits) add(t, { fx: 'cone', r: LOTUS_DMG_R, half: Math.PI }); });
      else GUAN_S1_TIMES.forEach((t, i) => { if (i >= a.hits) add(t, { fx: 'cone', r: S1_RADIUS, half: Math.PI }); });
    }
    else if (a.type === 's2') { if (a.t < S2_DASH_END) add(0.1, { fx: 'line', len: 300, w: S2_WIDTH }); add(S2_DASH_END, { fx: 'cone', r: S2_BLAST, half: Math.PI }); }
    else if (a.type === 'rush' && a.ph === 'wind') out.push({ tt: a.sp.wind[a.n] - a.pt, fx: 'line', len: RUSH_LEN, w: a.sp.w });
    else if (a.type === 'ult') add(0.55, { fx: 'cone', r: ULT_RADIUS, half: Math.PI });
    else if (a.type === 'bless') { if (!a.done) add(0.2, { fx: 'cone', r: 260, half: Math.PI }); }
    else if (a.type === 'slam') { if (!a.done) add(0.2, { fx: 'cone', r: SLAM_R, half: Math.PI }); }
    else if (a.type === 'snipe') { if (!a.done) add(0.3, { fx: 'line', len: 1400, w: 24 }); }
    else if (a.type === 'crystal') { if (!a.done) add(0.5, { fx: 'line', len: 2000, w: 40 }); }
    else if (a.type === 'rain') { for (let k = a.rn; k < RAIN_N; k++) add(RAIN_T0 + k * RAIN_IV, { fx: 'zone', cx: a.rx, cy: a.ry, r: RAIN_R }); }
    else if (a.type === 'rage') { if (!a.done) add(0.25, { fx: 'cone', r: 240, half: Math.PI }); }
    else if (a.type === 'switch') { if (!a.done) { const tt = 0.2 - a.t; if (tt >= -0.02 && tt <= 0.25) out.push({ tt, fx: 'cone', r: FORM_SLASH_R, half: Math.PI }); } }
    return out;
  }
  const a = at.act; if (!a || a.def.name === 'dodge') return out;
  for (const ev of a.ev) {
    if (ev.done || ev.fx === 'aim' || ev.fx === 'move' || ev.fx === 'windfx') continue;
    const tt = (ev.t != null ? ev.t : ev.t0) - a.t;
    if (ev.fx === 'cone' || ev.fx === 'blast' || ev.fx === 'ult') out.push({ tt, fx: 'cone', r: ev.r, half: ev.half });
    else if (ev.fx === 'line') out.push({ tt, fx: 'line', len: ev.len, w: ev.w / 2 });
    else if (ev.fx === 'dash') out.push({ tt, fx: 'line', len: ev.v * (ev.t1 - ev.t0), w: ev.w });
    else if (ev.fx === 'form') out.push({ tt, fx: 'cone', r: FORM_SLASH_R, half: Math.PI });
    else if (ev.fx === 'lotus') out.push({ tt, fx: 'cone', r: LOTUS_DMG_R, half: Math.PI });
    else if (ev.fx === 'rage') out.push({ tt, fx: 'cone', r: ev.r, half: Math.PI });
    else if (ev.fx === 'snipe' || ev.fx === 'crystal') out.push({ tt, fx: 'line', len: ev.len, w: ev.w / 2 });
    else if (ev.fx === 'rain') { const tg = a.target; out.push({ tt, fx: 'zone', cx: a.rx != null ? a.rx : (tg ? tg.x : at.x), cy: a.ry != null ? a.ry : (tg ? tg.y : at.y), r: ev.r }); }
    else if (ev.fx === 'bless') out.push({ tt, fx: 'cone', r: 260, half: Math.PI });
  }
  return out;
}
function dodgeDir(u) {   // u(플레이어 또는 AI 영웅)가 피해야 하면 회피 방향(rad), 아니면 null
  const atk = (u === P || u.team === 'ally') ? enemies.filter(e => e.fighter && !e.dead && e.spawnT <= 0) : [...(P.dead ? [] : [P]), ...allies.filter(a => !a.dead)];
  let best = null, bt = 9;
  for (const at of atk) {
    const evs = dodgeEvents(at); if (!evs.length) continue;
    const fa = at.face, dx = u.x - at.x, dy = u.y - at.y, d = Math.hypot(dx, dy), c = Math.cos(fa), sn = Math.sin(fa), lx = dx * c + dy * sn, ly = -dx * sn + dy * c;
    for (const ev of evs) {
      if (ev.tt < -0.02 || ev.tt > 0.22 || ev.tt >= bt) continue;
      let hit, ang = Math.atan2(dy, dx);
      if (ev.fx === 'zone') { const zx = u.x - ev.cx, zy = u.y - ev.cy; hit = Math.hypot(zx, zy) - u.r <= ev.r; ang = Math.atan2(zy, zx); }
      else if (ev.fx === 'cone') hit = d - u.r <= ev.r && (ev.half >= Math.PI || angDiff(fa, Math.atan2(dy, dx)) <= ev.half + 0.25);
      else { hit = lx >= -u.r && lx <= ev.len + u.r && Math.abs(ly) <= ev.w + u.r + 10; ang = fa + (ly >= 0 ? 1 : -1) * Math.PI / 2; }
      if (hit) { bt = ev.tt; best = ang; }
    }
  }
  const mine = u === P || u.team === 'ally';
  for (const p of projectiles) {   // 날아오는 상대 화살
    if (mine ? p.team !== 'foe' : !(p.friendly || p.team === 'ally')) continue;
    const dx = u.x - p.x, dy = u.y - p.y, sp = Math.hypot(p.vx, p.vy) || 1, along = (dx * p.vx + dy * p.vy) / sp, lat = (-dx * p.vy + dy * p.vx) / sp;
    if (along > 0 && along < 200 && Math.abs(lat) < u.r + 26 && along / sp < bt) { bt = along / sp; best = Math.atan2(p.vy, p.vx) + (lat >= 0 ? 1 : -1) * Math.PI / 2; }
  }
  if (best == null) return null;
  const room = a => { const px = u.x + Math.cos(a) * DASH_DIST - ARENA_C.x, py = u.y + Math.sin(a) * DASH_DIST - ARENA_C.y; return DUEL_R - 40 - Math.hypot(px, py); };
  if (room(best) < 0 && room(best + Math.PI) > room(best)) best += Math.PI;   // 벽 쪽이면 반대편으로
  return best;
}
function duelDodge() { const a = dodgeDir(P); return a == null ? null : { mx: Math.cos(a), my: Math.sin(a) }; }
// ===== 비무장 AUTO: AI 영웅(updateFighter)과 완전히 같은 규칙으로 자동 회피 · 공격 · 스킬 · 궁극기 =====
//  우선순위: 회피(자동 회피 규칙 공유) > 궁극기(분노 100 & 거리 300 이내) > 스킬2(사거리 안, 50%) > 스킬1(사거리 안, 50%) > 콤보(사거리 + 25 이내)
//  행동이 끝나면 AI 와 같은 대기시간(콤보 뒤 0.1~0.3초, 그 외 0.35~0.7초) 후 다음 행동을 고르고, 이동도 같다 (사정거리까지 접근, 가까우면 좌우로 70px/s)
const SKD = {};   // 폼별 스킬 정의(사거리) 캐시
function duelAutoInput(dt) {
  if (P.cd.dash <= 0 && !(P.act && (P.act.type === 'ult' || P.act.type === 'dash' || P.act.type === 'stun' || P.act.invul))) { const dd = duelDodge(); if (dd) { press('dash'); return dd; } }
  if (P.act) { P.autoBusy = P.act.type; return { mx: 0, my: 0 }; }
  if (P.autoBusy) {   // AI 의 endAct / 피격 회복 / 회피와 같은 대기시간 규칙
    const b = P.autoBusy; P.autoBusy = null;
    if (b === 'hurt' || b === 'stun') P.atkCd = Math.max(P.atkCd || 0, 0.25); else P.atkCd = b === 'atk' ? 0.1 + rand(0, 0.2) : 0.35 + rand(0, 0.35);
  }
  P.atkCd = (P.atkCd == null ? rand(0.7, 1.5) : P.atkCd) - dt;
  const tgt = nearest(); if (!tgt) return { mx: 0, my: 0 };
  P.face = angTo(P, tgt);
  const d = dist(P, tgt), reach = FKIT[HERO.id].reach + tgt.r, sk = SKD[HERO.id] || (SKD[HERO.id] = skillDefs(HERO.id));
  if (P.atkCd <= 0) {
    if (P.rage >= 100 && (HERO.crystalUlt ? d > 250 && d < 1600 : d < 300)) press('s3');
    else if (P.cd.s2 <= 0 && d <= sk.s2.range[1] && (!HERO.bless || P.blessT < 3) && Math.random() < 0.5) press('s2');
    else if (P.cd.s1 <= 0 && d <= sk.s1.range && (!HERO.s1Switch || (P.s2Store[HERO.id === 'lubu' ? 'lubu2' : 'lubu'] <= 0 && P.cd.s2 > 1.5)) && (!HERO.s1Heal || lotusWanted(P) || d < 230) && (!HERO.s1Throw || d > 200) && (!HERO.s1Snipe || d > 220) && Math.random() < 0.5) press('s1');
    else if (d <= reach + 25) press('attack');
  }
  const ux = Math.cos(P.face), uy = Math.sin(P.face);
  const kp = FKIT[HERO.id].keep; if (kp && d < kp + tgt.r) { const sg = Math.sin(T * 0.9) > 0 ? 0.5 : -0.5, c = Math.cos(sg), s = Math.sin(sg); return { mx: -(ux * c - uy * s), my: -(ux * s + uy * c) }; }   // 원거리 장수: 가까우면 거리를 벌림
  if (d > reach * 0.85) return { mx: ux, my: uy };
  const sd = Math.sin(T * 1.3 + (P.seed || (P.seed = rand(0, 6)))) > 0 ? 1 : -1, k = 70 / (P.speed * (HERO.runBonus && P.runBuffT > 0 ? HERO.runBonus : 1));
  return { mx: -uy * sd * k, my: ux * sd * k };
}
function autoInput(dt) {
  if (mode === 'duel') return duelAutoInput(dt);   // 비무장 AUTO = AI 영웅과 같은 규칙
  autoDodgeCd -= dt;
  if (mode === 'duel' && autoDodgeCd <= 0 && P.cd.dash <= 0 && !(P.act && (P.act.type === 'ult' || P.act.type === 'dash' || P.act.type === 'stun' || P.act.invul))) { const dd = duelDodge(); if (dd) { press('dash'); autoDodgeCd = 0.5; return dd; } }
  if (mode !== 'duel' && !RAID && P.hp <= P.maxhp * 0.1 && P.tagCd <= 0 && !(P.act && (P.act.type === 'ult' || P.act.type === 'stun' || P.act.invul))) {   // 자동 태그
    let bi = -1, bh = 0; TEAM.forEach((id, i) => { if (id !== HERO.pc && P.hpStore[id] > bh) { bh = P.hpStore[id]; bi = i; } });
    if (bi >= 0 && bh > P.hp + P.maxhp * 0.15) press('tag' + bi);
  }
  const tgt = nearest();
  let potion = null, pd = 800;
  for (const it of items) { if (it.kind === 'bun' ? P.hp >= P.maxhp : P.buffT > 3) continue; const dd = dist(it, P); if (dd < pd) { pd = dd; potion = it; } }
  const toPotion = () => ({ mx: (potion.x - P.x) / Math.max(pd, 1), my: (potion.y - P.y) / Math.max(pd, 1) });
  // 생명력 50% 이하: 거리와 상관없이 필드의 가장 가까운 만두를 먼저 먹으러 감 (공격·스킬은 먹고 나서 이어서). 단, 임박한 공격의 회피는 계속 한다.
  let bun = null, bd = 1e9;
  if (P.hp <= P.maxhp * 0.5) for (const it of items) if (it.kind === 'bun') { const dd = dist(it, P); if (dd < bd) { bd = dd; bun = it; } }
  const toBun = () => ({ mx: (bun.x - P.x) / Math.max(bd, 1), my: (bun.y - P.y) / Math.max(bd, 1) });
  if (bun && !tgt) return toBun();
  if (!tgt) return potion ? toPotion() : { mx: 0, my: 0 };
  const d = dist(P, tgt);
  for (const e of enemies) {
    if (e.state === 'wind' && e.cur && e.cur.windup - e.t < 0.3 && autoDodgeCd <= 0 && P.cd.dash <= 0 && (!P.act || P.act.type !== 'ult') && threatens(e)) {
      press('dash'); autoDodgeCd = 1.0;
      const c = e.cur; let a = angTo(e, P) + (c.kind === 'charge' ? Math.PI / 2 : 0) * (Math.random() < .5 ? 1 : -1);
      if (c.kind === 'leap') a = Math.atan2(P.y - c.ty, P.x - c.tx);
      else if (c.kind === 'cross') a = e.face + c.off + Math.PI / 4 + (Math.random() < .5 ? 0 : Math.PI);
      return { mx: Math.cos(a), my: Math.sin(a) };
    }
  }
  if (bun) return toBun();
  if (potion && (d > 170 || (potion.kind === 'bun' && P.hp < P.maxhp * 0.6))) return toPotion();
  let near = 0; for (const e of enemies) if (!e.dead && dist(P, e) < S1_RADIUS - 20 + e.r) near++;
  if (P.rage >= 100 && (HERO.crystalUlt ? d > 300 && d < 1800 : mode === 'duel' ? d < (HERO.ultRush ? 440 : ULT_RADIUS - 30) : (near >= 3 || tgt.boss || tgt.type === 'captain') && d < 330)) press('s3');   // 비무장: 상대 영웅이 궁극기 범위 안에 있으면 자동 발동
  if (P.cd.s1 <= 0 && (HERO.s1Switch ? (P.s2Store[HERO.id === 'lubu' ? 'lubu2' : 'lubu'] <= 0 && P.cd.s2 > 1.5 && d < 700) : HERO.s1Snipe ? (d > 120 && d < 1100) : HERO.s1Throw ? (d > 220 && d < 560) : HERO.s1Heal ? (lotusWanted(P) || near >= 1) : HERO.s1Flurry ? d < FLURRY_LEN - 40 : near >= (mode === 'duel' ? 1 : 2))) press('s1');
  if (s2Ready() && (HERO.rainS2 ? (d > 200 && d < 900 && (tgt.boss || enemies.filter(e => !e.dead && e.spawnT <= 0 && dist(e, tgt) < RAIN_R + e.r).length >= 2)) : HERO.slam ? d < 250 : HERO.bless ? (P.blessT < 3 && d < 520) : d > 160 && d < (HERO.rush ? 560 : HERO.shoot ? 650 : 330))) press('s2');
  if (HERO.kite) {   // 원거리 장수: 사거리 안에서 쏘면서 거리를 유지 (가까우면 물러나며 사격)
    if (d < HUANG_RANGE[0] + tgt.r - 30) press('attack');
    const ax = Math.cos(angTo(P, tgt)), ay = Math.sin(angTo(P, tgt));
    if (d < 230 + tgt.r) { const sg = Math.sin(T * 0.8) > 0 ? 0.55 : -0.55, c = Math.cos(sg), s = Math.sin(sg); return { mx: -(ax * c - ay * s), my: -(ax * s + ay * c) }; }
    if (d > HUANG_RANGE[0] + tgt.r - 60) return { mx: ax, my: ay };
    return { mx: 0, my: 0 };
  }
  if (d < 125 + tgt.r) press('attack');
  if (d > 95 + tgt.r) return { mx: Math.cos(angTo(P, tgt)), my: Math.sin(angTo(P, tgt)) };
  return { mx: 0, my: 0 };
}

// ---------- 적 AI ----------
function chooseAttack(e, d) {
  const c = chooseAttackBase(e, d);
  const scale = c2 => {   // 몬스터 공통 배율(피해량·공격속도)을 스킬과 그 후속 스킬(then)에 적용
    c2.dmg *= ENEMY_DMG_MULT * waveDmgMul() * (e.d.mb ? MB.dmg[mbStage(e)] : e.d.zhao ? ZB.dmg[zStage(e)] : e.d.dian ? DB.dmg[dStage(e)] * (e.rageT > 0 ? 1.3 : 1) : e.boss && !e.d.foot ? bossTab(e).dmg[bossStage(e)] : 1);
    const base = c2.kind === 'arrow' || c2.kind === 'fan' ? ENEMY_ATK_SLOW / RANGED_ATK_RATE : ENEMY_ATK_SLOW;
    const slow = base / (e.boss ? BOSS_CAST_SPEEDUP : ENEMY_ATK_SPEEDUP);
    for (const k of ['windup', 'recover', 'cd', 'dashT', 'delay', 'gap']) if (c2[k]) c2[k] *= slow;
    if (c2.winds) c2.winds = c2.winds.map(w => w * slow);
    if (c2.dashTs) c2.dashTs = c2.dashTs.map(w => w * slow);
    if (c2.gaps) c2.gaps = c2.gaps.map(w => w * slow);
    if (e.boss) { if (c2.windup) c2.windup *= BOSS_WINDUP_MUL; if (c2.winds) c2.winds = c2.winds.map(w => w * BOSS_WINDUP_MUL); if (c2.recover) c2.recover *= BOSS_RECOVER_MUL; }   // 보스: 선딜 -12%, 후딜 -30%
    if (e.boss) {   // 회피 쿨타임 3초 기준 보장: 대시 없이 걸어서도 피할 수 있도록 보스 돌진·근거리 원형의 선딜 하한 (걷기 270px/s x 0.42초 = 113px >= 돌진 폭 반(85) + 몸 반경)
      if (c2.kind === 'charge') { if (c2.windup) c2.windup = Math.max(c2.windup, BOSS_WALK_WIND); if (c2.winds) c2.winds = c2.winds.map(w => Math.max(w, BOSS_WALK_WIND)); }
      else if (c2.kind === 'circle' && !c2.ult && c2.r <= 260 && c2.windup) { if (c2.chase) c2.chase = Math.min(c2.chase, 100); c2.windup = Math.max(c2.windup, (c2.r + 22 - 70) / (270 - 0.75 * (c2.chase || 0)) + 0.08); }   // 근접 원형: 바로 옆(70px)에서 걸어 반경 밖으로 나갈 시간 + 추적 속도는 걷기보다 느리게
      if (c2.kind === 'circle' && c2.ult && c2.windup) c2.windup = Math.max(c2.windup, (c2.r + 22 - 70) / 270 + 0.08);   // 궁극기 대범위 원형도 바로 옆에서 걸어 반경 밖으로 나갈 시간 확보
      if (c2.kind === 'cone') {   // 360° 부채꼴(전방위 베기): 바로 옆에서 걸어 반경 밖으로 나갈 시간
        const need = r => (r + 22 - 70) / 270 + 0.08;
        if (c2.winds && c2.halfs) c2.winds = c2.winds.map((w, i) => c2.halfs[i] >= Math.PI - 0.01 ? Math.max(w, need(c2.rs ? c2.rs[i] : c2.r)) : w);
        else if (c2.half >= Math.PI - 0.01 && c2.windup) c2.windup = Math.max(c2.windup, need(c2.r));
      }
      if (c2.kind === 'charge' || c2.kind === 'cone' || c2.kind === 'leap') { const mw = c2.winds && c2.winds.length ? Math.min(...c2.winds) : c2.windup; if (mw) { const lock = c2.kind === 'leap' && c2.r ? (c2.r + 22) / 270 + 0.08 : BOSS_AIM_LOCK; c2.track = Math.min(c2.track != null ? c2.track : 0.4, Math.max(0.05, 1 - lock / mw)); } }   // 도약은 낙하 지점이 굳은 뒤 반경 밖으로 걸어 나갈 시간까지 / 조준 고정: 시전 직전 BOSS_AIM_LOCK 초는 방향이 굳어서, 옆으로 걸어 피할 시간이 남는다
    }
    if (c2.then) scale(c2.then);
  };
  if (c) scale(c);
  return c;
}
function chooseAttackBase(e, d) {
  const fast = e.d.mb ? MB.fast[mbStage(e)] : e.d.zhao ? ZB.fast[zStage(e)] : e.d.dian ? DB.fast[dStage(e)] * (e.rageT > 0 ? 0.88 : 1) : e.boss && !e.d.foot ? bossTab(e).fast[bossStage(e)] : (e.boss && e.hp < e.maxhp * 0.5 ? 0.8 : 1);
  switch (e.type) {
    case 'soldier': if (d <= 80 + e.r) return { kind: 'cone', r: 100, half: 0.9, dmg: 30, windup: 0.55, recover: 0.6, cd: 0.9, track: 0.4 }; break;
    case 'archer': if (d <= 560 && d >= 140) return { kind: 'arrow', dmg: 26, windup: 0.85, recover: 0.7, cd: 1.5, track: 0.6 }; break;
    case 'captain': if (d <= 160 + e.r) return { kind: 'circle', r: 150, dmg: 60, windup: 1.0, recover: 0.9, cd: 1.0 }; break;
    case 'cavalry': if (d >= 200 && d <= 720) return { kind: 'charge', len: Math.min(600, d + 160), w: 70, dmg: 50, windup: 0.7, recover: 1.1, cd: 0.9, track: 0.6, dashT: 0.5, stunP: PLAYER_STUN_CAV }; break;   // 거리를 벌린 뒤 일직선 돌진
    case 'shield': if (d <= 110 + e.r) return { kind: 'cone', r: 130, half: 1.0, dmg: 40, windup: 0.85, recover: 0.9, cd: 1.2, track: 0.4 }; break;   // 방패 밀치기
    case 'assassin':   // 멀리서 짧게 돌진해 찌름 / 붙으면 짧은 베기
      if (d >= 150 && d <= 440) return { kind: 'charge', len: Math.min(460, d + 120), w: 60, hitR: 26, dmg: 42, windup: 0.5, recover: 0.7, cd: 1.0, track: 0.6, dashT: 0.2 };
      if (d <= 70 + e.r) return { kind: 'cone', r: 90, half: 1.0, dmg: 30, windup: 0.4, recover: 0.5, cd: 0.7, track: 0.4 }; break;
    case 'caster': if (d <= 560 && d >= 140) return { kind: 'rain', r: 105, dmg: 50, windup: 1.2, recover: 0.8, cd: 1.6, track: 0.55, color: '190,110,255' }; break;   // 플레이어 위치에 낙뢰
    case 'boss': case 'raidBoss': case 'dianBoss': case 'guanBoss': case 'zhaoBoss': case 'bossGeneral': case 'bossCav': case 'bossShield': case 'bossCaster': case 'bossAssassin': case 'bossAlliance': case 'bossCommander':
      return bossAttack(e, d, fast);
  }
  return null;
}
// ===== 보스 여포 스킬 구성 (매번 직전 스킬을 제외하고 무작위 선택 / 보스 웨이브에는 증원 없음, 30초마다 술·만두 보급품만) =====
//  1페이즈 (HP 100~51%, 기마)  : mountedAttack
//     가까움(d < 250) : 베기 1회 → (딜레이) → 추적 발구르기  |  돌진 3연속(스턴)
//     멈  (d >= 250)  : 점프 공격 | 돌진 3연속(스턴) | 화살 4발 | 화살 연사 (화살 패턴은 2페이즈와 동일)
//  2페이즈 (HP 50~0%, 하마)    : footAttack — 1페이즈처럼 거리(FOOT_NEAR)로 구분
//     가까움(d < 250) : 내려찍기(slam, 제자리 원 340) | 휘두르기 → (딜레이) → 추적 발구르기 | 3연참(combo3, 1~2번째 베기는 필수·3번째만 가까울 때) | 폭발(blast, 제자리 360° 원 600)
//     멈  (d >= 250)  : 도약(leap) | 돌진(charge) → 곧바로 점프 공격 | 화살(fan, 4발) | 화살 연사(arrows, 3연속 일제 사격) | 십자 참격(cross, 길이 900·선딜 단축) | 베기류(휘두르기·3연참)는 멀리서도 선택: 관우를 탐색해 접근한 뒤 시전
//     베기류는 범위가 1.5배(휘두르기 330, 3연참 255~280)이고 3연참은 베기 사이마다 딜레이가 있음 / 하마 후 후딜은 원래 값(1배)
//  추적 발구르기(stompSpec): 딜레이 뒤 선딜 0.49초(앞 75% 동안 초속 600으로 추적)로 내려찍는 반경 190 원형
// 기마(1페이즈) 스킬 — 선딜을 짧게, 플레이어와의 거리(MOUNTED_NEAR)에 따라 후보가 달라짐
//  돌진 공격(charge) : 거리와 상관없이 언제나 사용 가능 — 일직선 질주 3연속(회차마다 선딜 0.62→0.52→0.42초, 질주 속도 1.0→1.24→1.64배), 피격 시 스턴
//  가까울 때(d < MOUNTED_NEAR): 베기 1회 -> 발구르기 | 돌진 3연속
//     발구르기: 관우를 최대한 추적하며(선딜의 앞 75% 동안 고속 접근) 매우 빠르게(선딜 0.49초) 내려찍는 원형
//  멀 때(d >= MOUNTED_NEAR)   : 점프 공격(도약 내려찍기) | 돌진 3연속 | 원거리 공격(투창 4발, 직선 예고)
const MOUNTED_NEAR = 250;
// 1페이즈(기마) 단계별: 0단계 = 기본 / 1단계 = 화살 연사 4연발·베기 2연속 추가 / 2단계 = 돌격 4연속·베기→돌격·도약 2연속 추가
function mountedAttack(e, d, fast) {
  const st = bossStage(e), af = Math.min(ARROW_F, fast);
  const chargeSpec = nMax => { const len = clamp(d + 300, 640, 900), n = nMax || (st >= 2 ? 4 : 3); return { kind: 'charge', chain: n, step: 0, lens: Array(n).fill(len), winds: [0.5, 0.42, 0.34, 0.30].slice(0, n).map(x => x * fast), dashTs: [0.45, 0.365, 0.275, 0.24].slice(0, n), gaps: [0.22, 0.1, 0.25].slice(0, n - 1), noPursue: true, len, w: 100, dmg: 95, windup: 0.5 * fast, recover: 1.0, cd: 0.5, track: 0.35, dashT: 0.45, stunP: PLAYER_STUN_BOSS }; };
  const slashSpec = n => ({ kind: 'cone', chain: n, step: 0, rs: Array(n).fill(330), halfs: Array(n).fill(1.1), r: 330, half: 1.1, winds: Array(n).fill(0.5 * fast), windup: 0.5 * fast, gap: 0.55 * fast, dmg: 70, recover: 0.8, cd: 0.5, track: 0.45, lunge: 150, then: stompSpec(fast, 0.45) });   // 베기 n회 -> 딜레이 -> 추적 발구르기
  const jumpSpec = () => ({ kind: 'leap', r: 160, dmg: 100, windup: 0.84 * fast, recover: 0.9, cd: 0.5, track: 0.55, tx: P.x, ty: P.y, stunP: PLAYER_STUN_BOSS });
  const pick = opts => { const pool = opts.filter(k => k !== e.last), list = pool.length ? pool : opts, k = list[Math.random() * list.length | 0]; e.last = k; return k; };
  if (d < MOUNTED_NEAR) {
    const opts = ['slash', 'charge']; if (st >= 1) opts.push('slash2'); if (st >= 2) opts.push('slashCharge'); if (st >= 3) opts.push('slash2Charge');
    switch (pick(opts)) {
      case 'charge': return chargeSpec();
      case 'slash2': return slashSpec(2);
      case 'slashCharge': { const c = slashSpec(1); c.then = { ...chargeSpec(2), delay: 0.5 * fast }; return c; }
      case 'slash2Charge': { const c = slashSpec(2); c.then = { ...chargeSpec(3), delay: 0.5 * fast }; return c; }   // 베기 2연 -> 돌진 3연속 (레이드 3단계)
      default: return slashSpec(1);
    }
  }
  const opts = ['jump', 'charge', 'fan', 'arrows']; if (st >= 2) opts.push('jump2'); if (st >= 3) opts.push('stormCharge', 'jump3');   // 3단계(레이드 전용)
  switch (pick(opts)) {
    case 'jump': return jumpSpec();
    case 'jump2': return { ...jumpSpec(), then: { ...jumpSpec(), windup: 0.7 * fast, delay: 0.4 * fast } };
    case 'jump3': return { ...jumpSpec(), then: { ...jumpSpec(), windup: 0.7 * fast, delay: 0.4 * fast, then: { ...jumpSpec(), windup: 0.62 * fast, delay: 0.35 * fast } } };   // 도약 3연속 (레이드 3단계)
    case 'stormCharge': return { ...arrowStormSpec(5, af), then: { ...chargeSpec(3), delay: 0.7 * fast, noPursue: true } };   // 화살 5연사 -> 돌진 3연속 (레이드 3단계)
    case 'charge': return chargeSpec();
    case 'fan': return arrowFanSpec(af);
    case 'arrows': return arrowStormSpec(st >= 1 ? 4 : 3, af);
  }
  return null;
}
const FOOT_NEAR = 250;   // 2페이즈: 이 거리 안이면 근접 패턴, 밖이면 원거리·이동 패턴
// 1·2페이즈 공통 화살 패턴 (페이즈별 시전 속도 배율 fast 와 무관하게 동일한 값 — 2페이즈 기준)
const ARROW_F = 0.8;
const arrowFanSpec = (f = ARROW_F) => ({ kind: 'fan', n: 4, half: 0.8, dmg: 40, windup: 0.9 * f, recover: 0.9, cd: 0.5, track: 0.6 });   // 화살 4발 (중앙이 빔)
const arrowStormSpec = (chain = 3, f = ARROW_F) => ({ kind: 'fan', chain, step: 0, n: 4, half: 0.8, shifts: [0, 0.267, -0.267, 0.267, -0.267].slice(0, chain), speed: 720, dmg: 40, windup: 0.3 * f, winds: [0.3, 0.225, 0.225, 0.225, 0.225].slice(0, chain).map(x => x * f), gap: 0.8 * f, noPursue: true, recover: 0.9, cd: 0.5, track: 0.5 });   // 화살 연사: chain 연속 일제 사격 (중앙이 빈 4발, 빠른 화살, 매번 재조준)
const stompSpec = (fast, delay) => ({ kind: 'circle', r: 190, dmg: 85, delay: delay * fast, windup: 0.4 * fast, recover: 0.9, cd: 0.5, stomp: true, chase: 600, stunP: PLAYER_STUN_BOSS });
// ===== 보스 관우 운장 (여포로 플레이할 때 등장, 도보, 관우(PC)의 스킬 기반). 모든 선딜레이(windup)는 w = fast x 0.8 (20% 감소) =====
//  1페이즈 (체력 100~51%)
//     가까움(d < FOOT_NEAR) : 베기 콤보(베기·베기·360° 베기) | 회전참(3연속, 범위 점점 커짐) | 회전참 → 청룡참 | 청룡참(돌진 후 폭발)
//     멈  (d >= FOOT_NEAR)  : 청룡참 | 베기 콤보(탐색·접근 후) | 청룡 참격(기운 4발 2연발) | 도약 일섬
//  (추가 패턴) 청룡 일섬(넓은 베기 → 추적 발구르기) · 회전 → 도약 일섬 : 1·2페이즈 / 청룡의 힘 → 청룡참 · 도약 일섬 2연속 · 청룡참 3연속 → 연속 회전베기 : 2페이즈
//  2페이즈 (체력 50~0%, 난이도 상승: 피해 +15%, 시전 20% 빠름(fast), 연계기·청룡의 힘 추가)
//     가까움 : 베기 콤보(간격 단축) | 회전참(4연속, 최대 반경 360) | 연속 회전베기 | 회전참 → 청룡참 | 청룡참 → 연속 회전베기 | 청룡의 힘
//     멈     : 청룡참 3연속 | 청룡참 → 연속 회전베기 | 베기 콤보 | 청룡 참격(5연발) | 도약 일섬 | 연속 회전베기 | 청룡의 힘
function enterGuanPhase2(e) {
  e.phase2 = true; e.cur = { recover: 1.4, cd: 0.4 }; e.state = 'recover'; e.t = 0; e.swing = null; e.lift = 0;
  const ac = e.d.auraCol || '#7fffd0'; ring(e.x, e.y, 260, 0.6, ac, 14); ring(e.x, e.y, 150, 0.4, '#fff', 8); sparks(e.x, e.y - 30, 40, ac, 700, 0.8); doShake(16); flashT = 0.25; sfx('boom');
  reinforceMsg = e.d.p2msg || (e.d.short + '가 청룡의 기운을 폭발시켰다!  2페이즈'); reinforceT = 3.5;
}
function guanBossAttack(e, d, fast) {
  const w = fast * 0.8, p2 = !!e.phase2, near = d < FOOT_NEAR;
  const opts = p2 ? (near ? ['combo', 'spin', 'whirl', 'spinCharge', 'chargeWhirl', 'ult', 'sweepStomp', 'spinLeap', 'ultCharge'] : ['dragonCharge', 'chargeWhirl', 'combo', 'wave', 'leap', 'whirl', 'ult', 'doubleLeap', 'dragonWhirl', 'sweepStomp'])
                  : (near ? ['combo', 'spin', 'spinCharge', 'charge', 'sweepStomp', 'spinLeap'] : ['charge', 'combo', 'wave', 'leap', 'sweepStomp']);
  const pool = opts.filter(k => k !== e.last), list = pool.length ? pool : opts, k = list[Math.random() * list.length | 0];
  e.last = k;
  const len = clamp(d + 200, 460, 700), PI = Math.PI;
  const blast = () => ({ kind: 'circle', r: 170, dmg: 70, windup: 0.35 * w, recover: 0.9, cd: 0.5 });   // 청룡참 종료 지점 폭발
  const charge = () => ({ kind: 'charge', len, w: 170, hitR: 85, dmg: 95, windup: 0.6 * w, recover: 1.0, cd: 0.6, track: 0.5, dashT: 0.38, then: blast() });
  const whirl = () => ({ kind: 'cone', chain: 3, step: 0, rs: [170, 230, 290], halfs: [PI, PI, PI], r: 170, half: PI, winds: [0.5 * w, 0.68 * w, 0.88 * w], windup: 0.5 * w, gap: (p2 ? 0.5 : 0.6) * fast, stopDist: 120, mandatory: 2, contDist: 330, pre: { dist: 150, speed: 600, maxT: 1.1 }, lunge: 0, dmg: 45, recover: 1.1, cd: 0.6 });   // 연속 회전베기: 쫓아가며 360° 회전 3연속, 범위 170 -> 230 -> 290, 선딜은 범위에 비례
  const boost = c => { c.dmg *= 1.15; if (c.then) boost(c.then); return c; };
  let c = null;
  switch (k) {
    case 'combo': c = { kind: 'cone', chain: 3, step: 0, rs: [215, 215, 240], halfs: [1.15, 1.15, PI], r: 215, half: 1.15, winds: [0.7 * w, 0.5 * w, 0.75 * w], windup: 0.7 * w, gap: (p2 ? 0.4 : 0.5) * fast, stopDist: 140, mandatory: 2, contDist: 300, pre: { dist: 150, speed: 600, maxT: 1.1 }, lunge: 100, dmg: 55, recover: 1.0, cd: 0.6, track: 0.4 }; break;   // 3번째는 360° 베기
    case 'spin': { const rs = p2 ? [180, 240, 300, 360] : [180, 240, 300], ws = p2 ? [0.55, 0.72, 0.92, 1.1] : [0.55, 0.72, 0.92];   // 제자리 회전 연속: 범위가 커질수록 선딜이 긺
      c = { kind: 'cone', chain: rs.length, step: 0, rs, halfs: rs.map(() => PI), r: rs[0], half: PI, winds: ws.map(x => x * w), windup: ws[0] * w, gap: 0.4 * fast, noPursue: true, lunge: 0, dmg: 50, recover: 1.0, cd: 0.6 }; break; }
    case 'spinCharge': c = { kind: 'cone', chain: 1, step: 0, rs: [225], halfs: [PI], r: 225, half: PI, winds: [0.7 * w], windup: 0.7 * w, dmg: 50, recover: 1.0, cd: 0.6, lunge: 0, then: { ...charge(), delay: 0.45 * fast, noPursue: true } }; break;   // 회전 한 번 -> 딜레이 -> 청룡참
    case 'charge': c = charge(); break;
    case 'chargeWhirl': c = { ...charge(), then: { ...whirl(), pre: null, delay: 0.3 * fast } }; break;   // 청룡참 -> 곧바로 쫓아가며 연속 회전베기 (2페이즈)
    case 'dragonCharge': c = { kind: 'charge', chain: 3, step: 0, lens: [len, Math.min(len, 560), Math.min(len, 560)], winds: [0.5 * w, 0.42 * w, 0.34 * w], dashTs: [0.45, 0.365, 0.275], gaps: [0.45, 0.2], noPursue: true, len, w: 170, hitR: 85, dmg: 85, windup: 0.5 * w, recover: 1.1, cd: 0.6, track: 0.4, dashT: 0.45, then: blast() }; break;   // 청룡참 3연속(갈수록 빠름) -> 폭발
    case 'wave': c = p2
      ? { kind: 'fan', wave: true, chain: 5, step: 0, n: 4, half: 0.7, shifts: [0, 0.28, -0.28, 0.28, -0.28], speed: 720, dmg: 45, windup: 0.5 * w, winds: [0.5 * w, 0.35 * w, 0.35 * w, 0.35 * w, 0.35 * w], gap: 0.5 * fast, noPursue: true, recover: 0.9, cd: 0.5, track: 0.5 }   // 청룡 참격 5연발
      : { kind: 'fan', wave: true, chain: 2, step: 0, n: 4, half: 0.7, shifts: [0, 0.28], speed: 640, dmg: 45, windup: 0.6 * w, winds: [0.6 * w, 0.4 * w], gap: 0.6 * fast, noPursue: true, recover: 0.9, cd: 0.5, track: 0.5 }; break;   // 청룡 참격 2연발
    case 'leap': c = { kind: 'leap', r: 170, dmg: 100, windup: 1.3 * w, recover: 1.0, cd: 0.6, track: 0.55, tx: P.x, ty: P.y, stunP: PLAYER_STUN_BOSS }; break;   // 도약 일섬
    case 'whirl': c = whirl(); break;
    case 'sweepStomp': c = { kind: 'cone', r: 320, half: 1.2, dmg: 75, windup: 0.8 * w, recover: 0.8, cd: 0.5, track: 0.45, lunge: 0, pre: { dist: 150, speed: 600, maxT: 1.1 }, then: stompSpec(w, 0.75) }; break;   // 청룡 일섬: 넓은 부채꼴 베기(탐색·접근 후) -> 딜레이 -> 추적 발구르기
    case 'spinLeap': c = { kind: 'cone', chain: 1, step: 0, rs: [225], halfs: [PI], r: 225, half: PI, winds: [0.7 * w], windup: 0.7 * w, dmg: 50, recover: 1.0, cd: 0.6, lunge: 0, then: { kind: 'leap', r: 170, dmg: 100, windup: 1.3 * w, recover: 1.0, cd: 0.6, track: 0.55, tx: P.x, ty: P.y, stunP: PLAYER_STUN_BOSS, delay: 0.4 * fast } }; break;   // 회전 한 번 -> 딜레이 -> 도약 일섬
    case 'ultCharge': c = { kind: 'circle', r: 380, dmg: 110, windup: 1.2 * w, recover: 1.0, cd: 0.6, ult: true, stunP: PLAYER_STUN_BOSS, then: { ...charge(), delay: 0.8 * fast, noPursue: true } }; break;   // 청룡의 힘 직후 청룡참 (2페이즈)
    case 'doubleLeap': c = { kind: 'leap', r: 170, dmg: 100, windup: 1.3 * w, recover: 1.0, cd: 0.6, track: 0.55, tx: P.x, ty: P.y, stunP: PLAYER_STUN_BOSS, then: { kind: 'leap', r: 170, dmg: 100, windup: 1.1 * w, recover: 1.0, cd: 0.6, track: 0.55, tx: P.x, ty: P.y, stunP: PLAYER_STUN_BOSS, delay: 0.4 * fast } }; break;   // 도약 일섬 2연속 (2페이즈)
    case 'dragonWhirl': c = { kind: 'charge', chain: 3, step: 0, lens: [len, Math.min(len, 560), Math.min(len, 560)], winds: [0.5 * w, 0.42 * w, 0.34 * w], dashTs: [0.45, 0.365, 0.275], gaps: [0.45, 0.2], noPursue: true, len, w: 170, hitR: 85, dmg: 85, windup: 0.5 * w, recover: 1.1, cd: 0.6, track: 0.4, dashT: 0.45, then: { ...whirl(), pre: null, delay: 0.35 * fast } }; break;   // 청룡참 3연속 -> 곧바로 연속 회전베기 (2페이즈)
    case 'ult': c = { kind: 'circle', r: 380, dmg: 110, windup: 1.4 * w, recover: 1.1, cd: 0.6, ult: true, stunP: PLAYER_STUN_BOSS }; break;   // 청룡의 힘 (2페이즈)
  }
  if (c && p2) boost(c);   // 2페이즈 피해 +15%
  return c;
}
// ===== 보스 조운 자룡 (W6, 도보): 스킬 구성 = PC 조운의 스킬 (공격 3단 콤보 · 칠진칠출 · 단기필마 · 백룡 강습(태그 스킬) · 백룡강림). 4단계로 세분화 =====
//  단계는 남은 체력으로 결정: 1단계 100~76% / 2단계 75~51% / 3단계 50~26% (2페이즈: 청색 기운 해방) / 4단계 25~0% (폭주)
//  모든 선딜레이(windup)는 w = fast x 0.8, fast·피해·재시전 대기·연계 확률은 단계마다 어려워짐 (ZB). 모든 패턴은 회피(Space)나 이동으로 피할 수 있다.
//  공격(combo)   : 1단 찌르기 -> 2단 넓은 휘두르기 -> 3단 3연속 찌르기 (단계마다 조준을 다시 잡음)
//  칠진칠출(flurry): 조준을 한 번 고정한 뒤 같은 직선으로 연속 찌름 (1단계 5회 / 2~3단계 7회 / 4단계 9회) — 고정된 직선 밖으로 비껴 피함
//  단기필마(dash)  : 짧은 선딜의 좁은 돌진 -> 작은 폭발 / 백룡 강습(strike): 길고 넓은 직선 돌진 / 백룡강림(ult): 반경 320 범위
//  1단계: 공격 · 칠진칠출 · 단기필마 · 백룡 강습
//  2단계: + 공격 -> 단기필마 (가까울 때) / 백룡 강습 -> 단기필마 (멀 때)
//  3단계: + 칠진칠출 -> 단기필마 / 단기필마 2연속 -> 폭발 / 백룡강림
//  4단계: + 백룡강림 -> 칠진칠출 (가까울 때) / 백룡 강습 2연속 (멀 때) / 공격 -> 칠진칠출 / 단기필마 3연속
const ZB = { dmg: [1.1, 1.22, 1.38, 1.55], fast: [1.0, 0.9, 0.8, 0.7], cd: [0.95, 0.85, 0.75, 0.62], chain: [0.30, 0.38, 0.46, 0.56] };
const zStage = e => { const r = e.hp / e.maxhp; return r > 0.75 ? 0 : r > 0.5 ? 1 : r > 0.25 ? 2 : 3; };
// ===== 레이드 보스 전위 악래 (도보, 5단계): PC 전위의 스킬 구성 — 쌍철극 3연 베기 · 쌍극 투척 · 지축 강타 · 불사의 광기 =====
//  단계(체력): 0 = 100~80% / 1 = ~60% / 2 = ~40% / 3 = ~20% / 4 = 20% 미만 (불사 보호 30초: 이 동안은 생명력 1 밑으로 내려가지 않음)
//  1단계~: 투척 3연발 · 내려찍기→3연 베기 / 2단계~: 포효(폭발 + 6초 광폭: 피해 +30% · 이동 +20%) · 충격 돌진 · 돌진 3연속 / 3단계~: 회전 폭풍(4연속) · 포효→투척 / 4단계: 포효→내려찍기 (최후)
const DB = { dmg: [1.0, 1.12, 1.25, 1.4, 1.6], fast: [1.0, 0.9, 0.8, 0.7, 0.62], cd: [1.0, 0.88, 0.78, 0.68, 0.58], chain: [0.20, 0.30, 0.40, 0.50, 0.62] };
const dStage = e => { const r = e.hp / e.maxhp; return r > 0.8 ? 0 : r > 0.6 ? 1 : r > 0.4 ? 2 : r > 0.2 ? 3 : 4; };
function dianBossAttack(e, d, fast) {
  const st = dStage(e), w = fast * 0.8, near = d < FOOT_NEAR, PI = Math.PI;
  const opts = near ? ['combo', 'spin', 'slam'] : ['throw', 'slam', 'combo', 'rush'];
  if (st >= 1) opts.push(near ? 'slamCombo' : 'throw3');
  if (st >= 2) { opts.push('roar'); opts.push(near ? 'quake' : 'rush3'); }
  if (st >= 3) opts.push(near ? 'storm' : 'roarThrow');
  if (st >= 4) opts.push('finale');
  const pool = opts.filter(k => k !== e.last), list = pool.length ? pool : opts, k = list[Math.random() * list.length | 0];
  e.last = k;
  const len = clamp(d + 200, 420, 700);
  const combo = () => ({ kind: 'cone', chain: 3, step: 0, rs: [230, 230, 270], halfs: [1.15, 1.15, PI], r: 230, half: 1.15, winds: [0.7 * w, 0.5 * w, 0.8 * w], windup: 0.7 * w, gap: 0.45 * fast, stopDist: 140, mandatory: 2, contDist: 320, pre: { dist: 150, speed: 600, maxT: 1.1 }, lunge: 100, dmg: 55, recover: 1.0, cd: 0.6, track: 0.4 });
  const spin = n => { const rs = [200, 260, 320, 380].slice(0, n), ws = [0.55, 0.72, 0.92, 1.1].slice(0, n); return { kind: 'cone', chain: n, step: 0, rs, halfs: rs.map(() => PI), r: rs[0], half: PI, winds: ws.map(x => x * w), windup: ws[0] * w, gap: 0.4 * fast, noPursue: true, lunge: 0, dmg: 50, recover: 1.0, cd: 0.6 }; };
  const throwSp = n => ({ kind: 'fan', wave: true, chain: n, step: 0, n: 2, half: 0.16, shifts: [0, 0.3, -0.3].slice(0, n), speed: 880, dmg: 45, windup: 0.6 * w, winds: [0.6, 0.42, 0.42].slice(0, n).map(x => x * w), gap: 0.4 * fast, noPursue: true, recover: 0.9, cd: 0.5, track: 0.5 });
  const slam = () => ({ kind: 'charge', len: 300, w: 140, hitR: 60, dmg: 70, windup: 0.5 * w, recover: 0.8, cd: 0.6, track: 0.5, dashT: 0.25, then: { kind: 'circle', r: 250, dmg: 85, windup: 0.5 * w, recover: 0.9, cd: 0.5 } });
  const roar = () => ({ kind: 'circle', r: 340, dmg: 100, windup: 1.3 * w, recover: 1.0, cd: 0.6, ult: true, rage: true, stunP: PLAYER_STUN_BOSS });
  const quake = () => ({ kind: 'charge', len: 400, w: 150, hitR: 70, dmg: 80, windup: 0.6 * w, recover: 1.1, cd: 0.6, track: 0.5, dashT: 0.4, quakeR: 220 });
  const rush = n => ({ kind: 'charge', chain: n, step: 0, lens: Array(n).fill(len), winds: [0.5, 0.42, 0.36].slice(0, n).map(x => x * w), dashTs: [0.4, 0.34, 0.3].slice(0, n), gaps: [0.4, 0.25].slice(0, n - 1), noPursue: true, len, w: 140, hitR: 64, dmg: 70, windup: 0.5 * w, recover: 1.0, cd: 0.6, track: 0.4, dashT: 0.4 });
  switch (k) {
    case 'combo': return combo();
    case 'spin': return spin(3);
    case 'slam': return slam();
    case 'throw': return throwSp(1);
    case 'throw3': return throwSp(3);
    case 'rush': return rush(2);
    case 'rush3': return rush(3);
    case 'slamCombo': { const c = slam(); c.then.then = { ...combo(), delay: 0.5 * fast, pre: null }; return c; }
    case 'quake': return quake();
    case 'roar': return roar();
    case 'storm': return spin(4);
    case 'roarThrow': return { ...roar(), then: { ...throwSp(2), delay: 0.5 * fast } };
    case 'finale': { const c = slam(); return { ...roar(), then: { ...c, delay: 0.6 * fast, noPursue: true } }; }
  }
  return null;
}
function zhaoBossAttack(e, d, fast) {
  const st = zStage(e), w = fast * 0.8, near = d < FOOT_NEAR;
  const opts = near ? ['combo', 'flurry', 'dash', 'strike'] : ['dash', 'strike', 'flurry', 'combo'];
  if (st >= 1) opts.push(near ? 'comboDash' : 'strikeDash');
  if (st >= 2) { opts.push(near ? 'flurryDash' : 'dashRush'); opts.push('ult'); }
  if (st >= 3) { opts.push(near ? 'ultFlurry' : 'doubleStrike'); opts.push(near ? 'comboFlurry' : 'dashRush'); }
  const pool = opts.filter(k => k !== e.last), list = pool.length ? pool : opts, k = list[Math.random() * list.length | 0];
  e.last = k;
  const len = clamp(d + 160, 420, 640), np = st >= 3 ? 9 : st >= 1 ? 7 : 5;
  const combo = () => ({ kind: 'cone', chain: 5, step: 0, rs: [200, 170, 220, 220, 220], halfs: [0.33, 1.2, 0.4, 0.4, 0.4], r: 200, half: 0.33, winds: [0.6, 0.5, 0.55, 0.45, 0.45].map(x => x * w), windup: 0.6 * w, gap: 0.35 * fast, stopDist: 150, mandatory: 2, contDist: 300, pre: { dist: 170, speed: 700, maxT: 1.0 }, lunge: 100, dmg: 42, recover: 1.0, cd: 0.6, track: 0.3 });
  const flurry = () => ({ kind: 'cone', chain: np, step: 0, rs: Array(np).fill(380), halfs: Array(np).fill(0.12), r: 380, half: 0.12, winds: [0.95, ...Array(np - 1).fill(0.22)].map(x => x * w), windup: 0.95 * w, gap: 0.06 * fast, fixedAim: true, noPursue: true, stopDist: 200, mandatory: np, contDist: 9999, pre: { dist: 230, speed: 700, maxT: 1.0 }, lunge: 0, dmg: 20, recover: 1.2, cd: 0.6, track: 0.3 });
  const dash = () => ({ kind: 'charge', len, w: 100, hitR: 50, dmg: 80, windup: 0.45 * w, recover: 0.9, cd: 0.5, track: 0.5, dashT: 0.28, then: { kind: 'circle', r: 120, dmg: 55, windup: 0.3 * w, recover: 0.9, cd: 0.5 } });
  const strike = () => ({ kind: 'charge', len: 560, w: 120, hitR: 60, dmg: 95, windup: 0.55 * w, recover: 1.0, cd: 0.6, track: 0.5, dashT: 0.2 });
  const nd = n => ({ kind: 'charge', chain: n, step: 0, lens: [len, Math.min(len, 520), Math.min(len, 520)].slice(0, n), winds: [0.45 * w, 0.36 * w, 0.3 * w].slice(0, n), dashTs: [0.3, 0.26, 0.22].slice(0, n), gaps: [0.4, 0.2].slice(0, n - 1), noPursue: true, len, w: 100, hitR: 50, dmg: 70, windup: 0.45 * w, recover: 1.0, cd: 0.6, track: 0.4, dashT: 0.3, then: { kind: 'circle', r: 120, dmg: 55, windup: 0.3 * w, recover: 0.9, cd: 0.5 } });
  const ult = () => ({ kind: 'circle', r: ULT_RADIUS, dmg: 110, windup: 1.4 * w, recover: 1.1, cd: 0.6, ult: true, stunP: PLAYER_STUN_BOSS });
  switch (k) {
    case 'combo': return combo();
    case 'flurry': return flurry();
    case 'dash': return dash();
    case 'strike': return strike();
    case 'comboDash': return { ...combo(), then: { ...dash(), delay: 0.5 * fast } };
    case 'strikeDash': return { ...strike(), then: { ...dash(), delay: 0.5 * fast } };
    case 'flurryDash': return { ...flurry(), then: { ...dash(), delay: 0.5 * fast } };
    case 'dashRush': return nd(st >= 3 ? 3 : 2);
    case 'ult': return ult();
    case 'ultFlurry': return { ...ult(), then: { ...flurry(), pre: null, delay: 0.7 * fast } };
    case 'doubleStrike': return { ...strike(), then: { ...strike(), delay: 0.55 * fast, noPursue: true } };
    case 'comboFlurry': return { ...combo(), then: { ...flurry(), pre: null, delay: 0.6 * fast } };
  }
  return null;
}
// ===== 몬스터 보스 (5층마다): 기존 몬스터·신규 몬스터(방패병·자객·술사)의 기술을 조합해 층이 오를수록 어려워짐 =====
//  보스 층: 5 맹장 / 10 관우 운장(PC 기반) / 15 철기대장 / 20 방패 장군 / 25 조운 자룡(PC 기반) / 30 술사 장군 / 35 자객 두목 / 40 연합 장군 / 45 총사령관 / 50 여포 봉선(PC 기반)
//  3단계(남은 체력 100~67% / 66~34% / 33~0%)마다 시전 속도·피해·연계 확률이 오르고 기술이 추가된다. 모든 기술은 회피(Space)나 이동으로 피할 수 있다.
//  기술 이름: slam 내려찍기(원) / combo 3연 베기 / bash 방패 밀치기(스턴) / sweep 휘두르기→발구르기 / charge 돌진 / quake 충격 돌진 / chain:N 돌진 N연속 / dash:N 자객 돌진 N연속
//            / rain:N 지정 지점 낙뢰 N연발 / storm:N 화살 연사 / leap 도약 / summon 부하 소환 / ult 대범위 폭발. 'a+b' = a 직후 b.
const MB = { dmg: [1.0, 1.12, 1.25], fast: [1.0, 0.88, 0.76], cd: [1.0, 0.88, 0.76], chain: [0.20, 0.30, 0.40] };
const mbStage = e => { const r = e.hp / e.maxhp; return r > 0.66 ? 0 : r > 0.33 ? 1 : 2; };
function monsterBossAttack(e, d, fast) {
  const st = mbStage(e), w = fast * 0.8, kit = e.d.kit, near = d < FOOT_NEAR, PI = Math.PI;
  const opts = (near ? kit.near : kit.far).slice(); for (let s = 1; s <= st; s++) { const add = kit['s' + s]; if (add) opts.push(...(near ? add.near : add.far)); }
  const pool = opts.filter(k => k !== e.last), list = pool.length ? pool : opts, key = list[Math.random() * list.length | 0];
  e.last = key;
  const len = clamp(d + 200, 460, 700);
  const B = {
    slam: () => ({ kind: 'circle', r: e.d.slamR || 200, dmg: 80, windup: 1.0 * w, recover: 0.9, cd: 0.5 }),
    combo: () => ({ kind: 'cone', chain: 3, step: 0, rs: [200, 200, 230], halfs: [1.0, 1.0, PI], r: 200, half: 1.0, winds: [0.7 * w, 0.5 * w, 0.75 * w], windup: 0.7 * w, gap: 0.5 * fast, stopDist: 140, mandatory: 2, contDist: 300, pre: { dist: 150, speed: 600, maxT: 1.1 }, lunge: 100, dmg: 55, recover: 1.0, cd: 0.6, track: 0.4 }),
    bash: () => ({ kind: 'cone', r: 170, half: 1.0, dmg: 70, windup: 0.9 * w, recover: 0.9, cd: 0.5, track: 0.5, pre: { dist: 130, speed: 600, maxT: 1.0 }, stunP: PLAYER_STUN_BOSS }),
    sweep: () => ({ kind: 'cone', r: 300, half: 1.1, dmg: 70, windup: 0.8 * w, recover: 0.8, cd: 0.5, track: 0.45, lunge: 0, pre: { dist: 150, speed: 600, maxT: 1.1 }, then: stompSpec(w, 0.7) }),
    charge: () => ({ kind: 'charge', len, w: 150, hitR: 70, dmg: 90, windup: 0.6 * w, recover: 1.0, cd: 0.6, track: 0.5, dashT: 0.4 }),
    quake: () => ({ kind: 'charge', len, w: 150, hitR: 70, dmg: 85, windup: 0.65 * w, recover: 1.1, cd: 0.6, track: 0.5, dashT: 0.4, quakeR: 190 }),
    chain: n => ({ kind: 'charge', chain: n, step: 0, lens: Array(n).fill(len), winds: [0.55, 0.45, 0.38, 0.34, 0.32].slice(0, n).map(x => x * w), dashTs: [0.4, 0.35, 0.3, 0.28, 0.26].slice(0, n), gaps: [0.4, 0.3, 0.25, 0.25].slice(0, n - 1), noPursue: true, len, w: 130, hitR: 60, dmg: 75, windup: 0.55 * w, recover: 1.1, cd: 0.6, track: 0.4, dashT: 0.4 }),
    dash: n => ({ kind: 'charge', chain: n, step: 0, lens: Array(n).fill(Math.min(len, 520)), winds: [0.5, 0.38, 0.32, 0.3, 0.28, 0.26].slice(0, n).map(x => x * w), dashTs: [0.24, 0.22, 0.2, 0.2, 0.18, 0.18].slice(0, n), gaps: [0.45, 0.3, 0.28, 0.25, 0.25].slice(0, n - 1), noPursue: true, len: Math.min(len, 520), w: 80, hitR: 36, dmg: 55, windup: 0.5 * w, recover: 1.1, cd: 0.6, track: 0.4, dashT: 0.24 }),
    rain: n => ({ kind: 'rain', chain: n, step: 0, r: 110, dmg: 55, windup: 1.0 * w, winds: Array(n).fill(0).map((_, i) => (i ? 0.95 : 1.05) * w), gap: 0.3 * fast, noPursue: true, track: 0.4, recover: 1.0, cd: 0.6, color: '190,110,255' }),
    storm: n => arrowStormSpec(n, Math.min(ARROW_F, fast)),
    leap: () => leapSpec(fast),
    summon: () => ({ kind: 'summon', type: e.d.minion, n: e.d.minionN || 3, dmg: 0, windup: 1.1 * w, recover: 1.0, cd: 0.8 }),
    ult: () => ({ kind: 'circle', r: e.d.ultR || 340, dmg: 110, windup: 1.5 * w, recover: 1.1, cd: 0.6, ult: true, stunP: PLAYER_STUN_BOSS }),
  };
  const build = tok => { const [nm, arg] = tok.split(':'); return B[nm](arg ? +arg : undefined); };
  const parts = key.split('+'); let c = build(parts[0]), cur = c;
  for (let i = 1; i < parts.length; i++) { const nx = build(parts[i]); nx.delay = 0.5 * fast; nx.noPursue = true; if (nx.pre) nx.pre = null; cur.then = nx; cur = nx; }
  return c;
}
function bossAttack(e, d, fast) {
  if (e.d.mb) return monsterBossAttack(e, d, fast);
  if (e.d.foot) return e.d.zhao ? zhaoBossAttack(e, d, fast) : e.d.dian ? dianBossAttack(e, d, fast) : guanBossAttack(e, d, fast);
  if (e.mounted) return mountedAttack(e, d, fast);
  return footAttack(e, d, fast);
}
// 2페이즈 도약(점프 내려찍기): 선딜 1.1 -> 1.32 (+20%). 돌진 직후의 연계 점프에도 같은 스펙을 사용
const leapSpec = fast => ({ kind: 'leap', r: 160, dmg: 100, windup: 1.32 * fast, recover: 1.0, cd: 0.6, track: 0.55, tx: P.x, ty: P.y, stunP: PLAYER_STUN_BOSS });
// 2페이즈(하마) 단계별: 3단계 = 기본 / 4단계 = 화살 4연발·폭발→돌진·도약→십자 추가 / 5단계 = 화살 5연발·휘두르기→3연참·돌진 2연속 추가
function footAttack(e, d, fast) {
  const st = bossStage(e) - (e.d.raid ? 1 : 0), af = Math.min(ARROW_F, fast), near = d < FOOT_NEAR;
  const opts = near ? ['slam', 'sweep', 'combo3', 'blast'] : ['leap', 'charge', 'fan', 'arrows', 'cross', 'sweep', 'combo3'];   // 베기류는 멀리서도 선택 가능(탐색·접근 후 시전)
  if (st >= 3) opts.push(near ? 'slamCombo' : 'arrowsCharge');
  if (st >= 4) { opts.push(near ? 'blastCharge' : 'leapCross'); if (near) opts.push('doubleSlam'); }
  if (st >= 5) opts.push(near ? 'sweepCombo' : 'doubleCharge');
  if (e.d.raid && st >= 5) opts.push(near ? 'spinStorm' : 'warCry');   // 레이드 6단계~: 회전 폭풍 / 전쟁의 함성
  if (e.d.raid && st >= 6) opts.push(near ? 'finaleNear' : 'finaleFar');   // 레이드 7단계: 최후의 광폭
  const pool = opts.filter(k => k !== e.last), k = (pool.length ? pool : opts)[Math.random() * (pool.length ? pool : opts).length | 0];
  e.last = k;
  const combo3 = () => ({ kind: 'cone', chain: 3, step: 0, rs: [255, 255, 280], halfs: [0.9, 0.9, 1.3], r: 255, half: 0.9, winds: [0.8 * fast, 0.5 * fast, 0.65 * fast], windup: 0.8 * fast, gap: 0.7 * Math.max(fast, 0.75), stopDist: 140, mandatory: 2, contDist: 300, pre: { dist: 150, speed: 600, maxT: 1.1 }, lunge: 100, dmg: 55, recover: 1.0, cd: 0.6, track: 0.4 });   // 3연참 (베기 사이 간격은 시전 가속과 무관하게 최소 확보): 범위 1.5배 + 베기 사이 딜레이
  const sweep = () => ({ kind: 'cone', r: 330, half: 1.1, dmg: 70, windup: 0.75 * fast, recover: 0.8, cd: 0.5, track: 0.45, pre: { dist: 150, speed: 600, maxT: 1.1 }, then: stompSpec(Math.max(fast, 0.8), 0.6) });   // 휘두르기 후 딜레이를 두고 추적 발구르기로 연계 (연계 간격 하한)
  const blast = () => ({ kind: 'cone', r: 450, half: Math.PI / 2, dmg: 85, windup: 1.2 * fast, recover: 1.0, cd: 0.5, track: 0.5, heavy: true });   // 폭발: 반경 600 원형 -> 반경 450, 정면 180° (보스 뒤·옆으로 이동하거나 회피로 피함)
  const slam = () => ({ kind: 'cone', r: 270, half: Math.PI / 2, dmg: 80, windup: 1.0 * fast, recover: 0.9, cd: 0.5, track: 0.5, heavy: true });   // 내려찍기: 정면 180°
  const charge = () => ({ kind: 'charge', len: 900, w: 180, hitR: 70, dmg: 95, windup: 0.5 * fast, recover: 1.0, cd: 0.6, track: 0.5, dashT: 0.45, then: leapSpec(fast) });   // 돌진 후 반드시 점프 공격
  const cross = () => ({ kind: 'cross', len: 900, w: 90, dmg: 90, windup: 0.6 * fast, recover: 1.0, cd: 0.6, track: 0.5, off: Math.random() < 0.5 ? 0 : Math.PI / 4 });
  const PI = Math.PI, warCry = () => ({ kind: 'circle', r: 400, dmg: 110, windup: 1.4 * fast, recover: 1.1, cd: 0.6, ult: true, stunP: PLAYER_STUN_BOSS });
  const spinStorm = () => { const rs = [190, 250, 310, 370], ws = [0.55, 0.72, 0.92, 1.1]; return { kind: 'cone', chain: 4, step: 0, rs, halfs: rs.map(() => PI), r: rs[0], half: PI, winds: ws.map(x => x * fast * 0.9), windup: ws[0] * fast * 0.9, gap: 0.4 * fast, noPursue: true, lunge: 0, dmg: 55, recover: 1.0, cd: 0.6 }; };
  switch (k) {
    case 'spinStorm': return spinStorm();
    case 'warCry': return { ...warCry(), then: { ...leapSpec(fast), delay: 0.5 * fast } };
    case 'finaleNear': return { ...warCry(), then: { ...charge(), delay: 0.7 * fast, noPursue: true } };
    case 'finaleFar': return { ...arrowStormSpec(5, af), then: { ...warCry(), delay: 0.6 * fast } };
    case 'slam': return slam();
    case 'sweep': return sweep();
    case 'combo3': return combo3();
    case 'blast': return blast();
    case 'leap': return leapSpec(fast);
    case 'charge': return charge();
    case 'fan': return arrowFanSpec(af);
    case 'arrows': return arrowStormSpec(st >= 5 ? 5 : st >= 4 ? 4 : 3, af);
    case 'cross': return cross();
    case 'blastCharge': return { ...blast(), then: { ...charge(), delay: 0.85 * fast, noPursue: true } };   // 폭발 직후 돌진 -> 점프 (4단계~)
    case 'leapCross': return { ...leapSpec(fast), then: { ...cross(), delay: 0.8 * Math.max(fast, 0.7) } };   // 도약 직후 십자 참격 (4단계~)
    case 'sweepCombo': return { ...sweep(), then: { ...combo3(), pre: null, delay: 0.75 * fast } };   // 휘두르기 -> 3연참 (5단계~)
    case 'slamCombo': return { ...slam(), then: { ...combo3(), pre: null, delay: 0.75 * fast } };   // 내려찍기 -> 3연참 (3단계~)
    case 'arrowsCharge': return { ...arrowStormSpec(3, af), then: { ...charge(), delay: 0.8 * fast, noPursue: true } };   // 화살 연사 -> 돌진 -> 점프 (3단계~)
    case 'doubleSlam': return { ...slam(), then: { ...slam(), delay: 0.7 * fast, windup: 0.9 * fast } };   // 내려찍기 2연속 (4단계~)
    case 'doubleCharge': return { ...charge(), then: { ...charge(), delay: 0.45 * fast, noPursue: true } };   // 돌진 2연속 -> 점프 (5단계~)
  }
  return null;
}
// ---- 레이드: 조작 PC 1명 + AI PC 최대 2명이 동시에 보스와 싸운다 (태그 없음). 보스는 조작 PC 를 노리고, 공격 범위 안의 AI PC 도 함께 맞는다 ----
let RAID_HEROES = [];
const RD = { order: [], swapCd: 0, cyc: 0 };   // 레이드의 영웅 목록·변경 쿨타임 (비무장의 duel.order / swapCd / cyc 와 같은 역할)
const RAID_ALLY_TAKEN = 0.6;   // AI 동료가 보스에게 받는 피해 배율 (AI 는 패턴을 사람만큼 못 피하므로 완화)
const friendsOf = () => RAID ? [P, ...allies].filter(u => !u.dead) : [P];
const tgtOf = e => { if (!RAID || !P.dead) return P; let b = null, bd = 1e9; for (const u of allies) if (!u.dead) { const d = dist(e, u); if (d < bd) { bd = d; b = u; } } return b || P; };
const RAID_HUMAN_TAKEN = 1.0;   // 온라인 레이드: 사람이 조작하는 PC 가 보스에게 받는 피해 배율 (AI 동료는 RAID_ALLY_TAKEN)
function foeHurt(e, u, dmg, stunT) {
  if (u === P) { hurtPlayer(dmg, e, false, stunT); return; }
  if (u.dead) return; const hum = !!u.human && !netAuto(u);
  if (hum && u.bgT > 0) return;   // 보스에게 맞은 경직·스턴 시간 동안은 연계 공격이 겹쳐 맞지 않음
  const ok = hitEnemy(u, dmg * (hum ? RAID_HUMAN_TAKEN : RAID_ALLY_TAKEN), { ai: true, from: e, kb: 260, stun: stunT || 0, nocrit: true, rec: 1.5 });
  if (hum && ok) u.bgT = Math.max(u.bgT || 0, 0.5, stunT || 0);
}
function raidDodgeDir(f) {   // AI 동료의 보스 공격 회피: 선딜 중인 공격 범위 안에 있으면 범위를 가장 많이 벗어나는 방향으로
  for (const e of enemies) {
    if (e.dead || !e.boss || e.state !== 'wind' || !e.cur) continue; const c = e.cur;
    if (c.windup - e.t > 0.4 || c.kind === 'fan' || c.kind === 'summon' || c.kind === 'arrow') continue;
    if (dashMargin(e, c, f.x, f.y) > 6) continue;
    let best = null, bs = -1e9; for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, m = dashMargin(e, c, f.x + Math.cos(a) * DASH_DIST, f.y + Math.sin(a) * DASH_DIST); if (m > bs) { bs = m; best = a; } }
    return best;
  }
  return null;
}
function updateRaidAllies(dt) {
  RD.swapCd = Math.max(0, RD.swapCd - dt);
  for (const f of allies) if (!f.dead) updateFighter(f, dt);
  if (P.dead && !allies.some(a => !a.dead) && state === 'play') { state = 'lose'; slowT = 1.2; }
}
function resolveAttack(e) {
  const c = e.cur, PT = tgtOf(e);
  if (c.kind === 'circle') {
    for (const u of friendsOf()) if (dist(e, u) <= c.r + u.r) foeHurt(e, u, c.dmg, c.stunP);
    ring(e.x, e.y, c.r, 0.35, '#ff6a4a'); doShake(e.boss || e.type === 'captain' ? 9 : 4); sfx('enemy');
    if (c.rage) { e.rageT = 6; dmgText(e.x, e.y - e.r * 3.4, '광폭!', '#ff7a4a', 28); }   // 전위: 포효 뒤 6초 광폭
    if (c.ult) { e.ultT = 0; ring(e.x, e.y, c.r, 0.6, e.d.auraCol || '#7fffd0', 18); ring(e.x, e.y, 260, 0.45, '#fff', 10); sparks(e.x, e.y - 10, 40, e.d.auraCol || '#7fffd0', 800, 0.8); doShake(22); sfx('boom'); }
  } else if (c.kind === 'cone') {
    for (const u of friendsOf()) if (dist(e, u) <= c.r + u.r && angDiff(e.face, angTo(e, u)) <= c.half) foeHurt(e, u, c.dmg);
    arcFx(e.x, e.y, e.face, c.r, c.half, 0.2, e.d.foot ? (e.d.fxCol || '#bfffe6') : '#ff9a8a', 1, e.boss ? bossTrailId(e) : 'foe'); sfx('enemy'); if (c.heavy) { doShake(9); ring(e.x + Math.cos(e.face) * c.r * 0.45, e.y + Math.sin(e.face) * c.r * 0.45, c.r * 0.3, 0.35, '#ff6a4a', 8); } e.swing = { t: 0, half: c.half, r: c.r };
    if (c.chain && c.step < c.chain - 1 && !(c.contDist && c.step + 1 >= (c.mandatory || 1) && dist(e, PT) > c.contDist)) {   // 연속 베기: 다음 타로 이어짐 (contDist 가 있으면 관우가 그 거리 안일 때만, 멀어졌으면 연속기를 중단)
      c.step++; c.windup = c.winds[c.step]; c.r = c.rs[c.step]; c.half = c.halfs[c.step];
      if (c.fixedAim) c.track = 0.0001; else e.face = angTo(e, PT); const lg = c.lunge != null ? c.lunge : 300; e.kx += Math.cos(e.face) * lg; e.ky += Math.sin(e.face) * lg; if (c.gap) { c.delay = c.gap; e.state = 'pause'; } else e.state = 'wind'; e.t = 0; return;   // 베기 사이에 딜레이(gap)
    }
    if (c.then) { e.cur = c.then; e.state = c.then.delay ? 'pause' : 'wind'; e.t = 0; e.face = angTo(e, PT); return; }   // 베기가 끝나면 (딜레이 후) 후속 스킬(발구르기)로
  } else if (c.kind === 'leap') {   // 도약 착지
    e.x = clamp(c.tx, 90, WORLD.w - 90); e.y = clamp(c.ty, 90, WORLD.h - 90); e.lift = 0;
    for (const u of friendsOf()) if (dist(e, u) <= c.r + u.r) foeHurt(e, u, c.dmg, c.stunP);
    ring(e.x, e.y, c.r, 0.4, '#ff6a4a', 10); ring(e.x, e.y, c.r * 0.55, 0.3, '#fff', 6); sparks(e.x, e.y, 20, '#c9a46a', 500, 0.6); doShake(16); sfx('boom');
  } else if (c.kind === 'fan') {   // 화살 부채꼴 (보스가 활을 꺼내 쏨)
    const shf = c.shifts ? c.shifts[c.step || 0] : 0; for (let i = 0; i < c.n; i++) { const a = e.face + shf + (i / (c.n - 1) - 0.5) * 2 * c.half; const sp = c.speed || 520; projectiles.push({ x: e.x, y: e.y - 20, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: c.dmg, life: 1.8, r: c.wave ? 15 : 12, boss: true, arrow: !c.wave, wave: !!c.wave, blue: !!e.d.zhao }); }
    sfx('swing'); doShake(4);
    if (c.chain && c.step < c.chain - 1) { c.step++; c.windup = c.winds[c.step]; if (c.gap) { c.delay = c.gap; e.state = 'pause'; } else e.state = 'wind'; e.t = 0; return; }   // 화살 연사: 다음 일제 사격으로 (매번 재조준)
  } else if (c.kind === 'cross') {   // 십자 참격
    const ang = e.face + c.off, ca = Math.cos(ang), sa = Math.sin(ang);
    for (const u of friendsOf()) { const dx = u.x - e.x, dy = u.y - e.y, lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca, hw = c.w / 2 + u.r; if ((Math.abs(lx) <= c.len && Math.abs(ly) <= hw) || (Math.abs(ly) <= c.len && Math.abs(lx) <= hw)) foeHurt(e, u, c.dmg); }
    fx.push({ k: 'beam', hid: e.boss ? bossTrailId(e) : '', x: e.x, y: e.y, ang, len: c.len, w: c.w, t: 0, dur: 0.35 }); fx.push({ k: 'beam', hid: e.boss ? bossTrailId(e) : '', x: e.x, y: e.y, ang: ang + Math.PI / 2, len: c.len, w: c.w, t: 0, dur: 0.35 });
    ring(e.x, e.y, 120, 0.3, '#ffd34d', 8); doShake(12); sfx('boom');
  } else if (c.kind === 'rain') {   // 술사의 낙뢰: 지정한 지점의 원 안에서 피해
    const tx = c.tx != null ? c.tx : PT.x, ty = c.ty != null ? c.ty : PT.y;
    for (const u of friendsOf()) if (Math.hypot(u.x - tx, u.y - ty) <= c.r + u.r) foeHurt(e, u, c.dmg, c.stunP);
    ring(tx, ty, c.r, 0.4, '#c77dff', 10); ring(tx, ty, c.r * 0.55, 0.3, '#fff', 6); sparks(tx, ty - 10, 18, '#c77dff', 500, 0.6); doShake(e.boss ? 7 : 3); sfx('boom');
    if (c.chain && c.step < c.chain - 1) { c.step++; c.windup = c.winds[c.step]; c.tx = PT.x; c.ty = PT.y; if (c.gap) { c.delay = c.gap; e.state = 'pause'; } else e.state = 'wind'; e.t = 0; return; }
  } else if (c.kind === 'summon') {   // 부하 소환 (필드 몬스터가 많으면 소환 수를 줄임)
    const room = Math.max(0, 14 - enemies.length), n = Math.min(c.n, room);
    for (let i = 0; i < n; i++) { const a = TAU * i / Math.max(1, n) + rand(0, 0.6), m = makeEnemy(c.type, clamp(e.x + Math.cos(a) * 120, 90, WORLD.w - 90), clamp(e.y + Math.sin(a) * 120, 90, WORLD.h - 90)); m.spawnT = 0.8; enemies.push(m); ring(m.x, m.y, 50, 0.5, e.d.auraCol || '#fff', 6); }
    ring(e.x, e.y, 180, 0.5, e.d.auraCol || '#fff', 10); sfx('skill'); reinforceMsg = e.d.short + '가 부하를 불러냈다!'; reinforceT = 2.5;
  } else if (c.kind === 'arrow') {
    const a = e.face; projectiles.push({ x: e.x, y: e.y - 14, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, dmg: c.dmg, life: 1.6, r: 10 }); sfx('swing');
  } else if (c.kind === 'charge') { e.state = 'dash'; e.t = 0; e.dashHit = false; e.dashSet = new Set(); return; }
  if (c.then) { e.cur = c.then; e.state = c.then.delay ? 'pause' : 'wind'; e.t = 0; e.face = angTo(e, PT); return; }   // 연계 스킬 (원형·도약 등 이어서)
  e.state = 'recover'; e.t = 0;
}
// 2페이즈 진입: 여포가 적토마에서 내림 (말은 달아나고, 잠시 자세를 가다듬은 뒤 도보 패턴으로 전환)
function raidStageUp(e, st) {   // 레이드 보스 단계 상승: 포효(공격 기회) + 알림. 3단계(62%)·6단계(37%)에서 부하 소환
  ring(e.x, e.y, 300, 0.6, '#ff6a4a', 14); ring(e.x, e.y, 170, 0.45, '#fff', 8); sparks(e.x, e.y - 30, 36, '#ffcf70', 700, 0.8); doShake(14); flashT = Math.max(flashT, 0.15); sfx('boom');
  if (st !== 4) { e.cur = { recover: 1.0, cd: 0.4 }; e.state = 'recover'; e.t = 0; e.lift = 0; reinforceMsg = '여포의 기세가 오른다!  (' + (st + 1) + '/8단계)'; reinforceT = 3; }   // 4단계(하마)는 내리는 연출이 따로 있음
  if (st === 2 || st === 5) raidAdds(e, st);
}
function raidAdds(e, st) {
  const list = st === 2 ? [['soldier', 4], ['archer', 2]] : [['cavalry', 2], ['captain', 2], ['archer', 2]]; let k = 0;
  for (const [t, n] of list) for (let i = 0; i < n; i++) { const a = TAU * (k++) / 8 + 0.4, m = makeEnemy(t, clamp(e.x + Math.cos(a) * 420, 160, WORLD.w - 160), clamp(e.y + Math.sin(a) * 420, 160, WORLD.h - 160)); m.spawnT = 0.7; enemies.push(m); }
  reinforceMsg = '여포가 부하를 불러냈다!'; reinforceT = 3;
}
function dismountBoss(e) {
  e.mounted = false; e.r = e.d.r; e.cur = { recover: 1.3, cd: 0.4 }; e.state = 'recover'; e.t = 0; e.lift = 0;
  const a = rand(0, TAU); fx.push({ k: 'horse', x: e.x, y: e.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, face: a, t: 0, dur: 1.6, r: BOSS_MOUNTED_R });
  ring(e.x, e.y, 200, 0.6, '#ff8a4a', 12); sparks(e.x, e.y - 30, 30, '#ffcf70', 500, 0.7); doShake(18); sfx('boom');
  reinforceMsg = e.d.short + '가 적토마에서 내렸다!'; reinforceT = 3;
}
function updateEnemies(dt) {
  let winders = 0, cavBusy = 0; for (const e of enemies) { if (e.type === 'cavalry') { if (e.state === 'wind' || e.state === 'dash') cavBusy++; } else if (e.state === 'wind' && !e.boss && e.type !== 'archer') winders++; }   // 철기병 돌진은 동시에 2기까지
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.fighter) continue;   // 비무장 모드 파이터는 updateFighter 가 처리
    e.flash = Math.max(0, e.flash - dt);
    if (e.swing) { e.swing.t += dt; if (e.swing.t > 1.2) e.swing = null; }
    if (e.ultT != null) { e.ultT += dt; if (e.ultT > 1.3) e.ultT = null; }
    if (e.spawnT > 0) { e.spawnT -= dt; continue; }
    if (e.freeze > 0) { e.freeze -= dt; continue; }   // 역경직: 공격이 적중한 적은 잠깐 정지
    if (e.boss && e.mounted && !e.d.mb && e.hp < e.maxhp * BOSS_DISMOUNT_HP) dismountBoss(e);
    else if (e.d.foot && !e.phase2 && e.hp < e.maxhp * 0.5) enterGuanPhase2(e);   // 보스 관우 2페이즈 진입
    if (e.phase2 && Math.random() < 0.25) fx.push({ k: 'spark', x: e.x + rand(-e.r, e.r), y: e.y - rand(0, e.r * 2), vx: rand(-20, 20), vy: rand(-120, -40), t: 0, dur: rand(0.4, 0.8), color: e.d.auraCol || '#7fffd0', sz: rand(3, 5) });
    if (e.d.zhao) {   // 보스 조운 단계 상승 알림 (3단계 = 2페이즈 연출이 따로 있음)
      const zs = zStage(e); if (e.zst == null) e.zst = zs;
      else if (zs > e.zst) { e.zst = zs; if (zs !== 2) { ring(e.x, e.y, 240, 0.5, e.d.auraCol, 12); ring(e.x, e.y, 140, 0.4, '#fff', 8); sparks(e.x, e.y - 30, 30, e.d.auraCol, 600, 0.7); doShake(12); flashT = Math.max(flashT, 0.15); sfx('boom'); reinforceMsg = '조운의 기세가 오른다!  (' + (zs + 1) + '단계)'; reinforceT = 3; } }
    }
    if (e.d.dian) {   // 보스 전위: 단계 상승 알림 · 광폭 · 최후 단계의 불사 보호(30초, 전투당 1회)
      const ds = dStage(e); if (e.dst == null) e.dst = ds;
      else if (ds > e.dst) {
        e.dst = ds; ring(e.x, e.y, 260, 0.5, '#ff7a4a', 12); ring(e.x, e.y, 150, 0.4, '#fff', 8); sparks(e.x, e.y - 30, 34, '#ffb27a', 650, 0.7); doShake(13); flashT = Math.max(flashT, 0.15); sfx('boom');
        reinforceMsg = '전위의 광기가 오른다!  (' + (ds + 1) + '/5단계)'; reinforceT = 3; e.cur = { recover: 0.9, cd: 0.4 }; e.state = 'recover'; e.t = 0;
        if (ds === 4 && !e.floorUsed) { e.floorUsed = true; e.floorT = 30; reinforceMsg = '전위가 불사의 광기에 사로잡혔다!  30초간 쓰러지지 않는다'; }
      }
      if (e.rageT > 0) { e.rageT -= dt; if (Math.random() < 0.5) fx.push({ k: 'spark', x: e.x + rand(-e.r, e.r), y: e.y - rand(0, e.r * 2), vx: rand(-30, 30), vy: rand(-160, -60), t: 0, dur: rand(0.3, 0.6), color: '#ff5a3a', sz: rand(3, 6) }); }
      if (e.floorT > 0) e.floorT -= dt;
    }
    if (e.boss && !e.d.foot) {   // 보스 여포 단계 상승 알림 (3단계 = 하마 연출이 따로 있음)
      const st = bossStage(e);
      if (e.stage == null) e.stage = st;
      else if (st > e.stage) { e.stage = st; if (e.d.raid) raidStageUp(e, st); else if (st !== 3) { ring(e.x, e.y, 240, 0.5, '#ff6a4a', 12); ring(e.x, e.y, 140, 0.4, '#fff', 8); sparks(e.x, e.y - 30, 30, '#ffcf70', 600, 0.7); doShake(12); flashT = Math.max(flashT, 0.15); sfx('boom'); reinforceMsg = '여포의 기세가 오른다!  (' + (st + 1) + '/6단계)'; reinforceT = 3; } }
    }
    e.x += e.kx * dt; e.y += e.ky * dt; const kf = Math.exp(-9 * dt); e.kx *= kf; e.ky *= kf;
    const PT = tgtOf(e), d = dist(e, PT), toP = angTo(e, PT), sp = e.speed * (e.rageT > 0 ? 1.2 : 1) * (e.boss ? (e.mounted ? 1.5 : 1.25) : 1) * (e.slowT > 0 ? (e.boss ? 0.75 : 0.55) : 1);
    e.atkCd -= dt; if (e.slowT > 0) e.slowT -= dt; drTick(e, dt);
    if (e.state !== 'wind') e.lift = 0;
    if (e.state === 'stun' || e.state === 'hit') { e.t -= dt; if (e.t <= 0) { e.state = 'chase'; e.atkCd = Math.max(e.atkCd, 0.3); } }
    else if (e.state === 'chase') {
      let dir = 0;
      e.face = toP;
      if (e.type === 'archer') { if (d < 280) dir = -1; else if (d > 460) dir = 1; }
      else if (e.type === 'caster') { if (d < 320) dir = -1; else if (d > 500) dir = 1; }
      else if (e.type === 'cavalry') { if (d < 260) dir = -1; else if (d > 520) dir = 1; }   // 돌진 거리를 확보하려고 물러났다가 접근
      else if (d > e.r + PT.r + 30) dir = 1;
      if (dir) { e.x += Math.cos(toP) * sp * dir * dt; e.y += Math.sin(toP) * sp * dir * dt; e.walk += dt * 10; }
      if (e.atkCd <= 0) {
        const melee = e.type === 'soldier';
        if (!(melee && winders >= 3) && !(e.type === 'cavalry' && cavBusy >= 2)) { const c = chooseAttack(e, d); if (c) { e.cur = c; if (c.pre) { e.state = 'pause'; c.delay = c.pre.maxT; } else e.state = 'wind'; e.t = 0; if (melee) winders++; if (e.type === 'cavalry') cavBusy++; } }
      }
    } else if (e.state === 'pause') {   // 시전 전 접근(pre) / 베기 사이·후속 스킬 전 딜레이 (이 시간이 회피 쿨타임 0.9초를 확보해 줌)
      e.t += dt; e.face = toP; e.walk += dt * 14; const pr = e.cur.pre;
      if (pr) {   // 탐색·접근: 관우 쪽으로 빠르게 이동해 pr.dist 안에 들어오면 (또는 maxT 가 지나면) 베기 시전 시작
        if (d > pr.dist) { e.x += Math.cos(toP) * pr.speed * dt; e.y += Math.sin(toP) * pr.speed * dt; }
        if (d <= pr.dist || e.t >= e.cur.delay) { e.cur.pre = null; e.state = 'wind'; e.t = 0; }
      } else {
        if (!e.cur.noPursue && d > (e.cur.stopDist || e.r + PT.r + 10)) { e.x += Math.cos(toP) * 400 * dt; e.y += Math.sin(toP) * 400 * dt; }
        if (e.cur.contDist && e.cur.step >= (e.cur.mandatory || 1) && d > e.cur.contDist) { e.state = 'recover'; e.t = 0; }   // 필수 횟수 이후의 베기: 딜레이 중 관우가 멀어졌으면 이어서 시전하지 않고 종료
        else if (e.t >= e.cur.delay) { e.state = 'wind'; e.t = 0; }
      }
    } else if (e.state === 'wind') {
      e.t += dt; const c = e.cur, prog = e.t / c.windup;
      if (c.ult && Math.random() < 0.7) { const ang = rand(0, TAU), sx = e.x + Math.cos(ang) * 230, sy = e.y + Math.sin(ang) * 170, tx = e.x, ty = e.y - 140, l = Math.hypot(tx - sx, ty - sy); fx.push({ k: 'spark', x: sx, y: sy, vx: (tx - sx) / l * 520, vy: (ty - sy) / l * 520, t: 0, dur: 0.4, color: '#7fffd0', sz: 5 }); }   // 청룡의 힘: 기운이 모임
      if (c.stomp) e.lift = Math.sin(clamp(prog, 0, 1) * Math.PI) * 45;   // 발구르기: 말이 솟구쳤다가 내려찍음
      if (c.chase && prog < 0.75) { e.face = toP; e.walk += dt * 14; if (d > e.r + PT.r + 10) { e.x += Math.cos(toP) * c.chase * dt; e.y += Math.sin(toP) * c.chase * dt; } }   // 관우를 최대한 추적
      if (c.kind === 'leap') {   // 앞부분은 플레이어를 추적해 낙하 지점을 정하고, 뒷부분에 도약
        if (prog < c.track) { c.tx = PT.x; c.ty = PT.y; e.face = toP; }
        else {
          if (c.sx == null) { c.sx = e.x; c.sy = e.y; }
          const q = clamp((prog - c.track) / (1 - c.track), 0, 1), k = q * q * (3 - 2 * q);
          e.x = c.sx + (c.tx - c.sx) * k; e.y = c.sy + (c.ty - c.sy) * k; e.lift = Math.sin(q * Math.PI) * 120;
        }
      } else if (c.kind === 'rain') { if (prog < c.track) { c.tx = PT.x; c.ty = PT.y; } e.face = toP; }   // 낙뢰: 선딜 앞부분은 플레이어를 따라 낙하 지점을 정하고 뒷부분은 고정
      else if (c.kind !== 'circle' && e.t < c.windup * (c.track || 0.4)) e.face = toP;
      if (e.t >= c.windup) resolveAttack(e);
    } else if (e.state === 'dash') {
      e.t += dt; const c = e.cur, sp2 = c.len / c.dashT;
      e.x += Math.cos(e.face) * sp2 * dt; e.y += Math.sin(e.face) * sp2 * dt;
      if (Math.random() < 0.6) fx.push({ k: 'spark', x: e.x, y: e.y, vx: rand(-60, 60), vy: rand(-60, 60), t: 0, dur: 0.35, color: '#ff8a6a', sz: 6 });
      if (!e.dashSet) e.dashSet = new Set(); for (const u of friendsOf()) if (!e.dashSet.has(u) && dist(e, u) < (c.hitR || e.r) + u.r) { e.dashSet.add(u); foeHurt(e, u, c.dmg, c.stunP); }
      if (e.t >= c.dashT) {
        doShake(6);
        if (c.quakeR) {   // 충격 돌격: 급정지 지점 충격파
          for (const u of friendsOf()) if (dist(e, u) <= c.quakeR + u.r) foeHurt(e, u, c.dmg * 0.8);
          ring(e.x, e.y, c.quakeR, 0.45, '#ff6a4a', 12); ring(e.x, e.y, c.quakeR * 0.5, 0.3, '#fff', 6); sparks(e.x, e.y, 18, '#c9a46a', 450, 0.6); doShake(12); sfx('boom');
        }
        if (c.chain && c.step < c.chain - 1) { c.step++; c.len = c.lens[c.step]; c.windup = c.winds[c.step]; if (c.dashTs) c.dashT = c.dashTs[c.step]; const gp = c.gaps ? c.gaps[c.step - 1] : 0; if (gp) { c.delay = gp; e.state = 'pause'; } else e.state = 'wind'; e.t = 0; e.face = angTo(e, PT); }   // 연속 돌격: (간격이 있으면 잠시 멈춘 뒤) 말머리를 돌려 다시 조준
        else if (c.then) { e.cur = c.then; e.state = c.then.delay ? 'pause' : 'wind'; e.t = 0; e.face = angTo(e, PT); }   // 돌진이 끝나면 곧바로 후속 스킬(점프 공격)로
        else { e.state = 'recover'; e.t = 0; }
      }
    } else if (e.state === 'recover') {
      const pm = e.boss && e.mounted ? BOSS_POST_DELAY_MULT : 1;   // 여포 1페이즈(기마)만: 스킬이 끝난 뒤 후딜(recover)과 다음 스킬까지의 대기(글로벌 쿨타임)를 2배로. 하마 후(2페이즈)는 원래 값
      e.t += dt;
      if (e.t >= e.cur.recover * pm) {
        const cdv = e.cur.cd;
        e.state = 'chase'; e.cur = null;
        if (e.boss && (e.chainN || 0) < BOSS_CHAIN_MAX && Math.random() < bossChainP(e)) { e.chainN = (e.chainN || 0) + 1; e.atkCd = BOSS_CHAIN_GAP; }   // 패턴 연속 사용: 짧은 틈만 두고 바로 다음 스킬
        else { e.chainN = 0; e.atkCd = (cdv + rand(0, 0.6)) * (e.boss ? BOSS_GLOBAL_CD_MULT * (e.d.mb ? MB.cd[mbStage(e)] : e.d.zhao ? ZB.cd[zStage(e)] : e.d.dian ? DB.cd[dStage(e)] : e.d.foot ? 1 : bossTab(e).cd[bossStage(e)]) : 1) * pm; }
      }
    }
    e.x = clamp(e.x, 70, WORLD.w - 70); e.y = clamp(e.y, 80, WORLD.h - 70);
  }
  // 겹침 해소
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i]; if (a.dead) continue;
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j]; if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = a.r + b.r;
      if (d < min) { const k = (min - d) / 2 / d; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; }
    }
    const dx = a.x - P.x, dy = a.y - P.y, d = Math.hypot(dx, dy) || 0.01, min = a.r + P.r - 4;
    if (d < min && a.state !== 'dash' && !(P.act && P.act.type === 'zult')) { a.x += dx / d * (min - d); a.y += dy / d * (min - d); }
  }
  enemies = enemies.filter(e => !e.dead);
  if (mode === 'yeonui') for (const e of enemies) arenaClamp(e);   // 몬스터·보스도 원형 경기장 안에서만 움직임
}
function updateProjectiles(dt) {
  for (const p of projectiles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.team) { duelProjectile(p); continue; }   // 비무장 모드 AI 화살
    if (p.crystal && p.friendly) crystalStep(p);
    else if (p.friendly) {   // 관통 화살: 지나가는 모든 적에게 한 번씩 적중
      for (const e of enemies) if (!e.dead && e.spawnT <= 0 && !p.hit.has(e) && dist(p, { x: e.x, y: e.y - 14 }) < p.r + e.r) { p.hit.add(e); hitEnemy(e, p.far ? p.dmg * farMul(p.far, Math.hypot(p.x - p.x0, p.y - p.y0) - 150, p.farR) : p.dmg, { from: P, kb: 120 }); }
    }
    else for (const u of friendsOf()) { if (dist(p, { x: u.x, y: u.y - 18 }) >= p.r + u.r) continue; if (u === P) { if (P.inv > 0 || (P.act && (P.act.type === 'ult' || P.act.invul))) continue; hurtPlayer(p.dmg, null, p.boss); } else { if (u.invT > 0) continue; foeHurt({ x: p.x - p.vx * 0.05, y: p.y - p.vy * 0.05 }, u, p.dmg); } p.life = 0; break; }
    if (p.x < 40 || p.y < 40 || p.x > WORLD.w - 40 || p.y > WORLD.h - 40) p.life = 0;
  }
  projectiles = projectiles.filter(p => p.life > 0);
}
function updateFx(dt) {
  for (const f of fx) { f.t += dt; if (f.k === 'spark') { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.93; f.vy *= 0.93; } else if (f.k === 'horse') { f.x += f.vx * dt; f.y += f.vy * dt; } }
  fx = fx.filter(f => f.t < f.dur);
  for (const d of dts) { d.t += dt; d.y -= 55 * dt; }
  dts = dts.filter(d => d.t < 0.9);
}
function advanceWave() {   // 웨이브 클리어: 전원 +25%(강화로 증가 가능) 회복 (전투 불능 영웅도 복귀) -> 능력치 강화 선택 -> 다음 웨이브
  RS.waves++; const hr = 0.25 + RUN.heal; P.hp = Math.min(P.maxhp, P.hp + P.maxhp * hr); for (const id of TEAM) if (id !== HERO.pc) P.hpStore[id] = Math.min(heroMaxHp(id), P.hpStore[id] + heroMaxHp(id) * hr);
  dmgText(P.x, P.y - 70, '+HP', '#7dff9a', 26);
  const n = waveIdx + 1; if (n % UPGRADE_EVERY === 0) openUpgrade(n); else { projectiles = []; beginWave(n); }   // 능력치 강화 선택은 매 웨이브 클리어마다 (UPGRADE_EVERY)
}
function updateWaves(dt) {
  reinforceT = Math.max(0, reinforceT - dt);
  if (TUT) return;   // 튜토리얼 중에는 웨이브·보스 진행 없음
  if (pendingSpawn) { bannerT -= dt; spawnT -= dt; if (spawnT <= 0) { spawnWave(); pendingSpawn = false; } }
  else {
    bannerT = Math.max(0, bannerT - dt);
    if (curWave().bossWave) {   // 보스 웨이브: 보스를 쓰러뜨리면 승리. 증원은 없고 30초마다 보급품만 등장
      if (!enemies.some(e => e.boss && !e.dead)) { for (const e of enemies) if (!e.dead) { e.dead = true; sparks(e.x, e.y - e.r, 10, '#ffcf70', 300, 0.5); } if (RAID || waveIdx >= WAVES.length - 1) { state = 'win'; winT = 0; } else advanceWave(); return; }
      supplyT -= dt;
      if (supplyT <= 0) { spawnSupplies(); supplyT = SUPPLY_INTERVAL; reinforceT = 2.5; reinforceMsg = '보급품 등장! 만두'; }
      return;
    }
    respawnT -= dt;   // 리스폰: 필드 수가 최대치보다 적은 종류부터 하나씩
    if (respawnT <= 0) for (const q of spawnQ) if (q.left > 0 && enemies.filter(e => e.type === q.type && !e.dead).length < q.cap) { spawnOne(q.type); q.left--; respawnT = RESPAWN_INTERVAL; break; }
    if (!enemies.length && waveLeft() <= 0) {
      if (RAID || waveIdx >= WAVES.length - 1) { state = 'win'; winT = 0; }
      else advanceWave();   // 웨이브 클리어: 전원 +25% (전투 불능 영웅도 복귀)
    }
  }
}

