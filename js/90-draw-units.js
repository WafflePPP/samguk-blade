'use strict';
// ---------- 그리기 ----------
function fighterPose(f) {
  let ang = f.face + 0.9, len = 105, push = 0; const a = f.act;
  if (a) {
    const nx = a.ev.find(e => !e.done && e.fx !== 'aim' && e.fx !== 'dash' && e.fx !== 'move' && e.fx !== 'windfx' && e.fx !== 'form'), ds = a.ev.find(e => e.fx === 'dash' && a.t >= e.t0 && a.t < e.t1);
    if (a.def.lult) { const w = lultAng(a.t, f.face); ang = w.ang; len = w.len; }
    else if (a.def.zult) { ang = a.t < ZU_WIND ? -Math.PI / 2 : f.face; len = 130; push = a.t < ZU_WIND ? 0 : 40 * Math.abs(Math.sin(a.t * 45)); }
    else if (ds) ang = f.face;
    else if (a.def.name === 'ult') { ang = a.t < a.def.ev[0].t ? -Math.PI / 2 : f.face + (a.t - a.def.ev[0].t) * ATK_SPEED * 8; len = 130; }
    else if (nx && nx.t != null) {
      const p = clamp((a.t - (nx.t - 0.14)) / 0.18, 0, 1);
      if (nx.thrust || nx.fx === 'line') { ang = f.face; push = 42 * Math.sin(Math.PI * p); }
      else if (nx.fx === 'arrows') ang = f.face;
      else { const span = nx.spin ? Math.PI : Math.min(1.3, (nx.half || 1) + 0.2); ang = f.face + (nx.dir || 1) * (-span + 2 * span * p); if (nx.r > 140) len = 150; }
    } else ang = f.face + 0.6;
  }
  return { ang, len, push };
}
// ===== 조건부 버프 강화 효과: 버프가 켜져 있는 동안 영웅 주변에 색과 모양이 다른 강화 오라 (플레이어·AI 공통) =====
//  방어 = 푸른 방패 / 궁극기 방어 = 청록 방패 / 질주 = 주황 불꽃 / 공격력 = 금색·붉은 화살표 / 공속 = 하늘색 속도선
const BUFF_AURA = { guard: { rgb: '143,180,255', k: 'def' }, ultGuard: { rgb: '127,255,208', k: 'def' }, run: { rgb: '255,140,60', k: 'run' }, atk: { rgb: '255,211,77', k: 'atk' }, postAtk: { rgb: '255,110,70', k: 'atk' }, spd: { rgb: '159,220,255', k: 'spd' }, aspd: { rgb: '191,232,255', k: 'spd' }, bless: { rgb: '255,150,200', k: 'bless' }, undy: { rgb: '255,70,50', k: 'atk' }, floor: { rgb: '255,205,90', k: 'def' } };
function buffListOf(u, H) {   // u = P 또는 AI 파이터(guardT·ultGuardT·runT/runBuffT·comboBuffT·postUltT·aspdT), H = 지금 모습(폼)의 영웅 정의
  const o = [], run = u === P ? u.runBuffT : u.runT;
  if (H.guard && u.guardT > 0) o.push('guard'); if (H.ultGuard && u.ultGuardT > 0) o.push('ultGuard'); if (H.runBonus && run > 0) o.push('run');
  if (u.blessT > 0) o.push('bless'); if (u.undyT > 0) o.push('undy'); if (u.floorT > 0) o.push('floor');
  if (H.comboBuff && u.comboBuffT > 0) o.push('atk'); if (H.postUltAtk && u.postUltT > 0) o.push('postAtk'); if (H.postUltAspd && u.postUltT > 0) o.push('spd'); if (H.aspdBuff && u.aspdT > 0) o.push('aspd');
  return o;
}
function drawBuffAura(x, y, r, list, layer) {   // layer 0 = 발밑(캐릭터 뒤), 1 = 어깨 높이의 작은 입자(캐릭터 앞) — 크기는 몸 크기에 맞춰 은은하게
  if (!list.length) return; ctx.save();
  list.forEach((id, i) => {
    const b = BUFF_AURA[id], rr = r * 1.86 + i * 6, dir = i % 2 ? -1 : 1;
    if (layer === 0) {
      ctx.setLineDash([8, 7]); ctx.lineDashOffset = -T * (26 + i * 10) * dir; ctx.strokeStyle = `rgba(${b.rgb},${0.5 + 0.2 * Math.sin(T * 6 + i)})`; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.ellipse(x, y + 4, rr, rr * 0.48, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    } else {
      for (let k = 0; k < 5; k++) {
        const ph = (T * 0.8 + k / 5 + i * 0.17) % 1, ang = T * 1.5 * dir + k * TAU / 5 + i, px = x + Math.cos(ang) * rr * 0.85, py = y - r * 1.85 + Math.sin(ang) * rr * 0.4 - ph * 26, al = Math.sin(ph * Math.PI) * 0.85;
        ctx.fillStyle = `rgba(${b.rgb},${al})`; ctx.strokeStyle = `rgba(${b.rgb},${al})`; ctx.lineWidth = 1.8; ctx.beginPath();
        if (b.k === 'atk') { ctx.moveTo(px, py - 6); ctx.lineTo(px + 4.2, py + 2.4); ctx.lineTo(px, py); ctx.lineTo(px - 4.2, py + 2.4); ctx.closePath(); ctx.fill(); }
        else if (b.k === 'def') { ctx.rect(px - 3, py - 3, 6, 6); ctx.stroke(); }
        else if (b.k === 'spd') { ctx.moveTo(px - 9.6, py); ctx.lineTo(px + 2.4, py); ctx.stroke(); }
        else if (b.k === 'bless') { ctx.arc(px, py, 3.2, 0, TAU); ctx.fill(); }
        else { ctx.ellipse(px, py, 3, 5, 0, 0, TAU); ctx.fill(); }
      }
    }
  });
  ctx.restore();
}
// ---- 비무장 팀 표시 (아군 = 하늘청 · 둥근 실선 · ▼ / 적군 = 주홍 · 점선 · ◆ — 색과 모양 두 가지로 구분) ----
function drawTeamRing(x, y, r, ally) {   // 발밑 팀 링: 아군 실선 / 적군 점선 + 안쪽 가는 링
  const c = ally ? '79,176,255' : '255,90,74';
  ctx.save(); ctx.fillStyle = `rgba(${c},.35)`; ctx.beginPath(); ctx.ellipse(x, y + 6, r * 2.1, r * 1.0, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(${c},.95)`; ctx.lineWidth = 4; if (!ally) ctx.setLineDash([10, 6]); ctx.stroke(); ctx.setLineDash([]);
  if (!ally) { ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y + 6, r * 1.45, r * 0.7, 0, 0, TAU); ctx.stroke(); }
  ctx.restore();
}
function drawTeamMark(x, yb, team, pc) {   // 머리 위 팀 마커 (yb = 아래 끝). 아군 ▼ / 적군 ◆ / 내 영웅 금색 ▼(크게). 위쪽 y 를 돌려줌
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = COLORS.outline; ctx.beginPath(); let h;
  if (team === 'foe') { h = 16; ctx.moveTo(x, yb - h); ctx.lineTo(x + 8, yb - h / 2); ctx.lineTo(x, yb); ctx.lineTo(x - 8, yb - h / 2); ctx.closePath(); ctx.fillStyle = COLORS.foe; }
  else { const w = pc ? 20 : 16; h = pc ? 15 : 12; ctx.moveTo(x - w / 2, yb - h); ctx.lineTo(x + w / 2, yb - h); ctx.lineTo(x, yb); ctx.closePath(); ctx.fillStyle = pc ? COLORS.gold : COLORS.ally; }
  ctx.fill(); ctx.stroke(); ctx.restore(); return yb - h;
}
function drawPcMark() {   // 비무장: 조작 중인 내 영웅 머리 위 금색 ▼ + "나" (오프라인 PC)
  const top = P.y - P.r * 3.5 - (HERO.mounted ? 22 : 0), t = drawTeamMark(P.x, top + 2, 'ally', true);
  text('나', P.x, t - 3, 16, COLORS.gold, 'center');
}
function drawFighter(f) {
  const H_ = HEROES[f.hero], ps = fighterPose(f), col = f.team === 'ally' ? '79,176,255' : '255,90,74', bow = f.act && f.act.def.name === 's2' && f.hero === 'lubu2';
  const dm = mode === 'duel', ally = f.team === 'ally', myNet = NET.on && f === netCur();   // dm: 비무장일 때만 새 팀 표시 (레이드 아군 AI 는 그대로)
  if (dm) drawTeamRing(f.x, f.y, H_.mounted ? MOUNT_R : f.r, ally);
  else { ctx.fillStyle = `rgba(${col},.22)`; ctx.beginPath(); ctx.ellipse(f.x, f.y + 6, f.r * 1.9, f.r * 0.9, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = `rgba(${col},.9)`; ctx.lineWidth = 2.5; ctx.stroke(); }   // 팀 표식 (아군 파랑 / 적 빨강)
  if (myNet) { const gr = dm ? (H_.mounted ? MOUNT_R : f.r) * 2.4 : f.r * 2.2; ctx.strokeStyle = '#3cff3c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(f.x, f.y + 6, gr, dm ? gr * 0.48 : f.r * 1.05, 0, 0, TAU); ctx.stroke(); }   // 온라인: 내가 조종 중인 영웅 표시
  const bl = buffListOf(f, H_), bR = H_.mounted ? MOUNT_R + 4 : f.r; drawBuffAura(f.x, f.y, bR, bl, 0);
  if (fDef(f) > 1) { ctx.strokeStyle = `rgba(143,180,255,${0.35 + 0.15 * Math.sin(T * 6)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(f.x, f.y + 4, f.r * 2.1, f.r * 1.0, 0, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(143,180,255,.12)'; ctx.fill(); }   // 방어력 증가 중: 발밑 방어막
  if (f.act && f.act.def.invul) { ctx.fillStyle = `rgba(${H_.ult.rgb},.25)`; circle(f.x, f.y - 20, 60 + Math.sin(T * 30) * 6); if (f.act.def.name === 'rush') for (let k = 0; k < 10; k++) { const an = T * 7 + k * TAU / 10; ctx.fillStyle = `rgba(255,${120 + (k % 3) * 45},50,.55)`; circle(f.x + Math.cos(an) * 46, f.y - 14 + Math.sin(an) * 30 - 8 * Math.abs(Math.sin(T * 12 + k)), 9 - (k % 3) * 2); } }   // 궁극기·적토 돌격 중 기운
  const pose = animPose(f.moving ? 1 : 0, f.face, f.walk, f.hitT / 0.42, f.hitAng, f.hitMag, f.dashing, f.face, f.state === 'stun'), hurt = f.state === 'hit';
  if (f.act && f.state === 'act') {   // 스킬 동작 보조 애니메이션 (플레이어와 같은 곡선)
    const a = f.act, nm = a.def.name;
    if (nm === 'ult') addAnim(pose, actAnim('ult', a.t * ATK_SPEED, 0, f.face));
    else if (nm === 'rush') { const d0 = a.ev.find(e => e.fx === 'dash'); if (d0 && a.t < d0.t0) addAnim(pose, actAnim('swing', a.t, d0.t0, f.face)); }
    else if (a.def.zult) addAnim(pose, actAnim('swing', a.t, ZU_WIND, f.face));
    else if (a.def.lult) addAnim(pose, actAnim('swing', a.t, LU_WIND, f.face));
    else if (nm !== 'dodge') { const e0 = a.ev.find(e => e.t != null && e.fx !== 'aim'); if (e0) addAnim(pose, actAnim('swing', a.t * ATK_SPEED, e0.t * ATK_SPEED, f.face)); }
  }
  const st = { ...H_.style, flag: dm ? (ally ? COLORS.ally : COLORS.foe) : null, flash: f.flash > 0, alpha: 1, anim: pose, bob: pose.bob, weapon: { kind: bow ? 'bow' : H_.style.weapon, ang: smoothAng(f, hurt ? f.face + 2.0 : ps.ang + (f.act ? 0 : pose.wsw)), len: ps.len, dx: Math.cos(f.face) * ps.push, dy: Math.sin(f.face) * ps.push } };
  if (H_.mounted) { drawHorse({ x: f.x, y: f.y, r: MOUNT_R, face: f.face, flash: f.flash > 0 ? 1 : 0, state: f.dashing || (H_.runBonus && horseGalloping(f.runT, f.moving && !f.act)) || f.lungeT > 0 ? 'dash' : 'chase', walk: f.walk, spawnT: 0, alpha: 1, d: H_.horse }, 0); drawBody(f.x, f.y - MOUNT_R * 0.6, RIDER_R, f.face, { ...st, noShadow: true }); }
  else drawBody(f.x, f.y, f.r, f.face, st);
  drawBuffAura(f.x, f.y, bR, bl, 1);
  if (f.invT > 0 && !(f.act && f.act.def.invul)) { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y - 24, 40 + Math.sin(T * 20) * 3, 0, TAU); ctx.stroke(); }
  const top = f.y - f.r * 3.5 - (H_.mounted ? 22 : 0);
  if (dm) drawHpBar(f.x, top, 60, f.hp, f.maxhp, ally ? COLORS.ally : COLORS.foe, true); else drawHpBar(f.x, top, 52, f.hp, f.maxhp, f.team === 'ally' ? COLORS.ally : '#ff4a4a');
  if (f.floorT > 0) { ctx.strokeStyle = 'rgba(255,90,60,' + (0.5 + 0.4 * Math.sin(T * 14)) + ')'; ctx.lineWidth = 2.5; ctx.strokeRect(dm ? f.x - 34 : f.x - 28, top - 3, dm ? 68 : 56, 10); }   // 불사 중: 생명력 막대가 붉게 깜빡임
  if (dm) {   // 팀 마커 (HP 막대 바로 위) + 이름표 16px (내 영웅은 금색 ▼ + "나")
    const t = drawTeamMark(f.x, top - 6, ally ? 'ally' : 'foe', myNet);
    if (myNet) text('나', f.x, t - 3, 16, COLORS.gold, 'center'); else text(DUEL_TAG[f.hero], f.x, t - 3, 16, ally ? '#9ad4ff' : '#ff9a8a', 'center');
  } else text(DUEL_TAG[f.hero], f.x, top - 4, 12, f.team === 'ally' ? '#9ad4ff' : '#ff9a8a', 'center');
}
// AI 가 쓰는 궁극기 연출은 플레이어와 같은 그리기 함수를 쓴다 (잠시 P 의 위치·영웅을 AI 로 바꿔서 그림)
function asUnit(f, fn) { const sx = P.x, sy = P.y, sf = P.face, sh = HERO; P.x = f.x; P.y = f.y; P.face = f.face; HERO = HEROES[f.hero]; try { fn(); } finally { P.x = sx; P.y = sy; P.face = sf; HERO = sh; } }
function drawUltLotus(t) {   // 경국지색(초선): 발밑에서 겹겹의 연꽃잎이 피어나 퍼지고, 꽃잎이 흩날림
  drawUltAura(t);
  if (t < 0.12 || t > 1.4) return;
  const g = clamp((t - 0.12) / 0.45, 0, 1), fade = clamp((1.4 - t) / 0.4, 0, 1), R = ULT_RADIUS * (0.3 + 0.7 * (1 - (1 - g) * (1 - g)));
  ctx.save();
  for (let layer = 0; layer < 3; layer++) {
    const n = 8 + layer * 2, rr = R * (1 - layer * 0.22), rot = T * (layer % 2 ? -0.7 : 0.7) + layer * 0.3;
    for (let k = 0; k < n; k++) {
      const a = rot + k * TAU / n; ctx.save(); ctx.translate(P.x + Math.cos(a) * rr * 0.55, P.y - 6 + Math.sin(a) * rr * 0.55 * 0.75); ctx.rotate(a);
      ctx.globalAlpha = fade * (0.5 - layer * 0.08); ctx.fillStyle = layer === 0 ? '#ff7ab4' : layer === 1 ? '#ffa8cf' : '#ffe0ee';
      ctx.beginPath(); ctx.ellipse(0, 0, rr * 0.4, rr * 0.15, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
  }
  ctx.globalAlpha = fade; for (let k = 0; k < 24; k++) { const ph = (T * 0.6 + k * 0.137) % 1, an = k * 2.4 + T * 0.8, rr = (0.2 + 0.8 * ((k * 0.381) % 1)) * ULT_HEAL_R; ctx.fillStyle = k % 2 ? 'rgba(255,170,205,.85)' : 'rgba(255,240,250,.85)'; ctx.beginPath(); ctx.ellipse(P.x + Math.cos(an) * rr, P.y - ph * 160 + Math.sin(an) * rr * 0.7, 5, 2.6, an, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function drawUltRage(t) {   // 불사의 광기: 붉은 기운이 솟구치고 불꽃이 피어오름
  drawUltAura(t);
  if (t < 0.4 || t > 1.7) return;
  const g = clamp((t - 0.4) / 0.5, 0, 1), fade = clamp((1.7 - t) / 0.5, 0, 1), R = 120 + 140 * g;
  ctx.save(); const gr = ctx.createRadialGradient(P.x, P.y - 10, 10, P.x, P.y - 10, R); gr.addColorStop(0, 'rgba(255,90,60,' + (0.55 * fade) + ')'); gr.addColorStop(1, 'rgba(255,60,40,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(P.x, P.y - 10, R, R * 0.75, 0, 0, TAU); ctx.fill();
  for (let k = 0; k < 18; k++) { const ph = (T * 1.3 + k * 0.173) % 1, an = k * 2.4, rr = (0.25 + 0.75 * ((k * 0.381) % 1)) * R * 0.9, fx0 = P.x + Math.cos(an) * rr, fy0 = P.y + Math.sin(an) * rr * 0.6 - ph * 150; ctx.globalAlpha = Math.sin(ph * Math.PI) * fade; ctx.fillStyle = k % 3 ? '#ff7a3a' : '#ffd27a'; ctx.beginPath(); ctx.moveTo(fx0, fy0 - 18); ctx.quadraticCurveTo(fx0 + 10, fy0, fx0, fy0 + 8); ctx.quadraticCurveTo(fx0 - 10, fy0, fx0, fy0 - 18); ctx.fill(); }
  ctx.restore();
}
function drawUltCrystal(pr) {   // 마법의 수정화살: 활 앞에 수정 기운이 모여 커지고, 조준선이 길게 뻗음
  drawUltAura(pr * 0.5);
  const ox = P.x + Math.cos(P.face) * 52, oy = P.y - 30 + Math.sin(P.face) * 52, R = 12 + 30 * pr;
  ctx.save(); const g = ctx.createRadialGradient(ox, oy, 2, ox, oy, R * 2.2); g.addColorStop(0, 'rgba(235,252,255,' + (0.95 * pr) + ')'); g.addColorStop(1, 'rgba(120,210,255,0)'); ctx.fillStyle = g; circle(ox, oy, R * 2.2);
  ctx.strokeStyle = 'rgba(190,240,255,' + (0.25 + 0.4 * pr) + ')'; ctx.lineWidth = 2; ctx.setLineDash([14, 10]); ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(P.face) * 1400, oy + Math.sin(P.face) * 1400); ctx.stroke(); ctx.setLineDash([]);
  for (let k = 0; k < 8; k++) { const an = T * 6 + k * TAU / 8, rr = R * (1.3 + 0.4 * Math.sin(T * 9 + k)); ctx.fillStyle = 'rgba(210,246,255,' + (0.8 * pr) + ')'; circle(ox + Math.cos(an) * rr, oy + Math.sin(an) * rr * 0.8, 2.5); }
  ctx.restore();
}
function drawUltFx(t) { const s = HERO.ultStyle; if (s === 'crystal') drawUltCrystal(clamp(t / 0.35, 0, 1)); else if (s === 'rage') drawUltRage(0.4 + t * 2.2); else if (s === 'lance') drawUltLance(t); else if (s === 'halberd') drawUltHalberd(t); else if (s === 'lotus') drawUltLotus(t); else drawDragon(t); }
function drawFighterUlts() {
  for (const f of allies.concat(enemies)) if (f.fighter && !f.dead && f.act && f.act.def.name === 'ult') { const t = f.act.t * ATK_SPEED; asUnit(f, () => drawUltFx(t)); }
}
// 백룡강림 (조운): 속도감 강조 연출 — 중심으로 빨려드는 속도선 / 번개처럼 쏟아지는 분신 창 16자루 (간격이 점점 짧아지는 연속 꽂힘) /
//  본 창이 한 줄기 섬광이 되어 급강하(0.55 피해 판정) / 사방으로 터지는 섬광과 속도선. 피해·판정 시점은 그대로.
function lanceStreaks(x, y) {   // 백룡강림 시전 중 몸 주변으로 흐르는 속도선 (플레이어·AI 공통)
  for (let k = 0; k < 3; k++) { const a = rand(0, TAU), r = rand(200, 340); streak(x + Math.cos(a) * r, y - 10 + Math.sin(a) * r * 0.75, a + Math.PI, rand(120, 230), rand(1.5, 3), 0.16, k % 2 ? '#ffffff' : '#bfe8ff'); }
}
function drawUltLance(t, noAura) {
  if (!noAura) drawUltAura(t);
  if (t < 0.12 || t > 1.0) return;
  const ease = u => u * u * (3 - 2 * u), U = HERO.ult, L = 330, tipLen = 1.5 * L, fade = clamp((1.0 - t) / 0.3, 0, 1);
  ctx.save(); ctx.lineCap = 'round';
  // 1) 중심으로 빨려드는 속도선 (줌 라인)
  if (t < 0.6) {
    const g = clamp((t - 0.12) / 0.1, 0, 1) * (t < 0.5 ? 1 : 1 - (t - 0.5) / 0.1);
    for (let k = 0; k < 30; k++) {
      const an = k * TAU / 30 + Math.sin(k * 7.1) * 0.2, ph = (t * 5.5 + k * 0.173) % 1, r0 = 40 + (1 - ph) * (ULT_RADIUS + 40), len = 40 + 90 * ph;
      ctx.strokeStyle = `rgba(${U.core},${(1 - ph) * 0.75 * g})`; ctx.lineWidth = 1.5 + 2 * (1 - ph);
      ctx.beginPath(); ctx.moveTo(P.x + Math.cos(an) * (r0 + len), P.y - 10 + Math.sin(an) * (r0 + len) * 0.75); ctx.lineTo(P.x + Math.cos(an) * r0, P.y - 10 + Math.sin(an) * r0 * 0.75); ctx.stroke();
    }
  }
  // 2) 분신 창 16자루: 위에서 비스듬히 번개처럼 날아와 꽂힘 (점점 빨라지는 간격)
  for (let k = 0; k < 16; k++) {
    const x = k / 15, st = 0.16 + 0.37 * (1 - Math.pow(1 - x, 1.6)), ft = 0.065, u = clamp((t - st) / ft, 0, 1); if (u <= 0) continue;
    const an = k * 2.399, rad = ULT_RADIUS * (0.25 + 0.6 * ((k * 0.618) % 1)), gx = P.x + Math.cos(an) * rad, gy = P.y + Math.sin(an) * rad * 0.75;
    const da = 0.9 + ((k % 3) - 1) * 0.14, dx = Math.cos(da), dy = Math.sin(da), L2 = 105, D = 560, px = gx - (1 - u) * D * dx, py = gy - (1 - u) * D * dy;
    if (u < 1) { const tr = 300, g = ctx.createLinearGradient(px - dx * tr, py - dy * tr, px, py); g.addColorStop(0, `rgba(${U.core},0)`); g.addColorStop(1, `rgba(${U.core},.85)`); ctx.strokeStyle = g; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(px - dx * tr, py - dy * tr); ctx.lineTo(px, py); ctx.stroke(); }
    ctx.globalAlpha = fade * (u < 1 ? 1 : 0.9); drawLance(px - dx * 1.5 * L2, py - dy * 1.5 * L2, da, L2); ctx.globalAlpha = 1;
    if (u >= 1) {
      const p = clamp((t - st - ft) / 0.18, 0, 1);
      ctx.strokeStyle = `rgba(${U.core},${(1 - p) * 0.9 * fade})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(gx, gy, 10 + 46 * p, (10 + 46 * p) * 0.45, 0, 0, TAU); ctx.stroke();
      for (let j = 0; j < 6; j++) { const a2 = j * TAU / 6 + k; ctx.strokeStyle = `rgba(255,255,255,${(1 - p) * 0.8 * fade})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx + Math.cos(a2) * (8 + 30 * p), gy + Math.sin(a2) * (8 + 30 * p) * 0.5); ctx.lineTo(gx + Math.cos(a2) * (16 + 60 * p), gy + Math.sin(a2) * (16 + 60 * p) * 0.5); ctx.stroke(); }
    }
  }
  // 3) 본 창: 낙하 지점으로 가는 섬광선 -> 0.43~0.55 사이 번개처럼 급강하 -> 꽂힌 채 사라짐
  if (t >= 0.3 && t < 0.43) { ctx.strokeStyle = `rgba(255,255,255,${0.3 + 0.25 * Math.sin(t * 120)})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(P.x, P.y - 900); ctx.lineTo(P.x, P.y); ctx.stroke(); }
  if (t >= 0.43) {
    const fu = clamp((t - 0.43) / 0.12, 0, 1), fall = fu * fu * fu, tipY = P.y - 6 - (1 - fall) * 820, topY = tipY - tipLen;
    ctx.globalAlpha = fade;
    if (fu < 1) {
      const tg = ctx.createLinearGradient(P.x, topY - 760, P.x, topY); tg.addColorStop(0, 'rgba(255,255,255,0)'); tg.addColorStop(1, `rgba(${U.core},.9)`); ctx.fillStyle = tg; ctx.fillRect(P.x - 20, topY - 760, 40, 760);   // 섬광 꼬리
      for (const [off, al] of [[90, 0.35], [180, 0.22], [270, 0.12]]) { ctx.globalAlpha = al * fade; drawLance(P.x, topY - off, Math.PI / 2, L); } ctx.globalAlpha = fade;
    }
    drawLance(P.x, topY, Math.PI / 2, L);
    // 창대를 감아 도는 흰 용 (빠르게 회전)
    for (const ph of [0, Math.PI]) for (const [w, c] of [[8, `rgba(${U.rgb},.35)`], [3.5, 'rgba(255,255,255,.9)']]) {
      ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath();
      for (let i = 0; i <= 28; i++) { const s = i / 28, xx = P.x + Math.sin(s * 15 + T * 20 + ph) * (14 + 12 * s), yy = topY + s * tipLen * 0.95; if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // 4) 충돌: 섬광 + 사방으로 뻗는 빛줄기와 속도선
  if (t >= 0.55) {
    const u = clamp((t - 0.55) / 0.35, 0, 1), r1 = 40 + (ULT_RADIUS - 40) * ease(Math.min(1, u * 2));
    const fl = ctx.createRadialGradient(P.x, P.y - 10, 4, P.x, P.y - 10, 150); fl.addColorStop(0, `rgba(255,255,255,${0.85 * (1 - u)})`); fl.addColorStop(1, `rgba(${U.rgb},0)`); ctx.fillStyle = fl; circle(P.x, P.y - 10, 150);
    for (let k = 0; k < 12; k++) {
      const an = k * TAU / 12 + (k % 2 ? 0 : 0.13), x1 = P.x + Math.cos(an) * 30, y1 = P.y - 10 + Math.sin(an) * 30 * 0.75, rr = r1 * (k % 2 ? 1 : 0.8), x2 = P.x + Math.cos(an) * rr, y2 = P.y - 10 + Math.sin(an) * rr * 0.75, g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, `rgba(255,255,255,${0.95 * (1 - u)})`); g.addColorStop(1, `rgba(${U.rgb},0)`); ctx.strokeStyle = g; ctx.lineWidth = 14 * (1 - u) + 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  }
  ctx.restore();
}
function drawUnit(e, lift) { if (e.fighter) drawFighter(e); else drawEnemyUnit(e, lift); }
function drawFighterTele(f) {   // AI(아군·적 모두 동일)의 공격은 직전에 붉은 범위 예고
  if (!f.fighter || !f.act || f.dead) return;
  const a = f.act, nx = a.ev.find(e => !e.done && e.fx !== 'aim' && e.fx !== 'move' && e.fx !== 'windfx' && ((e.t != null ? e.t : e.t0) - a.t) < 0.5 && ((e.t != null ? e.t : e.t0) - a.t) > -0.05);
  if (!nx || a.def.name === 'dodge') return;
  const pr = 1 - clamp(((nx.t != null ? nx.t : nx.t0) - a.t) / 0.5, 0, 1);
  if (nx.fx === 'rain') {   // 황충 화살비: 떨어질 구역을 붉은 원으로 예고
    const zx = a.rx != null ? a.rx : (a.target ? a.target.x : f.x), zy = a.ry != null ? a.ry : (a.target ? a.target.y : f.y);
    ctx.save(); ctx.fillStyle = `rgba(255,60,50,${0.12 + 0.2 * pr})`; ctx.strokeStyle = 'rgba(255,90,70,.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(zx, zy, nx.r, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); return;
  }
  ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.face); ctx.fillStyle = `rgba(255,60,50,${0.1 + 0.2 * pr})`;
  if (nx.fx === 'cone' || nx.fx === 'blast' || nx.fx === 'ult' || nx.fx === 'lotus' || nx.fx === 'bless' || nx.fx === 'rage') { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, nx.r, -Math.min(nx.half, Math.PI), Math.min(nx.half, Math.PI)); ctx.closePath(); ctx.fill(); }
  else if (nx.fx === 'line' || nx.fx === 'snipe' || nx.fx === 'crystal') ctx.fillRect(0, -nx.w / 2, nx.len, nx.w);
  else if (nx.fx === 'dash') ctx.fillRect(0, -nx.w, nx.v * (nx.t1 - nx.t0), nx.w * 2);
  ctx.restore();
}
function drawArena(R = DUEL_R) {   // 경기장: 금색 테두리 원 + 바깥 어둡게
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.rect(-600, -600, WORLD.w + 1200, WORLD.h + 1200); ctx.arc(ARENA_C.x, ARENA_C.y, R, 0, TAU, true); ctx.fill('evenodd');
  ctx.strokeStyle = 'rgba(212,167,58,.85)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(ARENA_C.x, ARENA_C.y, R, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 3; ctx.setLineDash([18, 14]); ctx.beginPath(); ctx.arc(ARENA_C.x, ARENA_C.y, R * 0.55, 0, TAU); ctx.stroke(); ctx.restore();
}
// 비무장 모드 HUD: 왼쪽 = 아군 3명, 오른쪽 = 적 3명 (초상 + 생명력 + 궁극기 게이지, 쓰러지면 X), 가운데 위 = 남은 시간
let meterOn = true;
const METER = { x: 10, y: 372, w: 340, hh: 22, rh: 20 };
const meterHdr = () => ({ x: METER.x, y: METER.y, w: METER.w, h: METER.hh });
function fmtN(n) { n = Math.round(n); return n >= 100000 ? Math.round(n / 1000) + 'k' : n.toLocaleString('en-US'); }
function drawDamageMeter() {   // 왼쪽: 팀별(아군 / 적) 영웅의 주는 피해 · 받은 피해 · 주는 회복 · 받은 회복. 제목 줄을 누르거나 M 키로 접기/펴기
  const m = METER, cols = ['주는 피해', '받은 피해', '주는 회복', '받은 회복'], keys = ['dealt', 'taken', 'healDone', 'healTaken'], x0 = m.x + 76, cw = (m.w - 76) / 4;
  ctx.fillStyle = 'rgba(10,12,20,.62)'; ctx.fillRect(m.x, m.y, m.w, m.hh); ctx.strokeStyle = 'rgba(212,167,58,.7)'; ctx.lineWidth = 1.5; ctx.strokeRect(m.x, m.y, m.w, m.hh);
  text('미터기 ' + (meterOn ? '▾' : '▸') + ' (M)', m.x + 6, m.y + 15, 11, COLORS.goldText, 'left', true, false);
  if (!meterOn) return;
  cols.forEach((c, i) => text(c, x0 + cw * i + cw / 2, m.y + 15, 10, COLORS.silver, 'center', false, false));
  const zero = () => ({ dealt: 0, taken: 0, healDone: 0, healTaken: 0 });
  const rows = [...duel.order.map(h => ({ team: 'ally', hero: h })), ...duel.foes.map(f => ({ team: 'foe', hero: pcId(f.hero) }))].map(r => ({ ...r, st: duel.stats[r.team + ':' + r.hero] || zero() }));
  const maxD = Math.max(1, ...rows.map(r => r.st.dealt)), tot = { ally: zero(), foe: zero() };
  let y = m.y + m.hh;
  for (const team of ['ally', 'foe']) {
    const col = team === 'ally' ? '79,176,255' : '255,90,74', list = rows.filter(r => r.team === team).sort((a, b) => b.st.dealt - a.st.dealt);
    for (const r of list) {
      ctx.fillStyle = COLORS.panel50; ctx.fillRect(m.x, y, m.w, m.rh);
      ctx.fillStyle = 'rgba(' + col + ',.35)'; ctx.fillRect(m.x, y, m.w * r.st.dealt / maxD, m.rh);   // 주는 피해 비율 막대
      text(PC_TAG[r.hero] + (team === 'ally' && r.hero === curHero ? '(나)' : ''), m.x + 6, y + 14, 11, team === 'ally' ? '#9ad4ff' : '#ff9a8a', 'left', true, false);
      keys.forEach((k, i) => { text(fmtN(r.st[k]), x0 + cw * i + cw / 2, y + 14, 11, k === 'taken' ? '#ffb4a8' : k.startsWith('heal') ? COLORS.goodAlt : '#fff', 'center', false, false); tot[team][k] += r.st[k]; });
      y += m.rh;
    }
    ctx.fillStyle = 'rgba(' + col + ',.18)'; ctx.fillRect(m.x, y, m.w, m.rh - 2);
    text(team === 'ally' ? '아군 합계' : '적군 합계', m.x + 6, y + 13, 10, '#e8ecf8', 'left', true, false);
    keys.forEach((k, i) => text(fmtN(tot[team][k]), x0 + cw * i + cw / 2, y + 13, 10, '#e8ecf8', 'center', true, false));
    y += m.rh;
  }
  ctx.strokeStyle = 'rgba(212,167,58,.5)'; ctx.lineWidth = 1; ctx.strokeRect(m.x, m.y + m.hh, m.w, y - m.y - m.hh);
}
// 버프 이름·수치·남은 시간 (플레이어 P 또는 AI 파이터 f). 오라 표시(buffListOf)와 같은 판정.
function buffInfoOf(u, H) {
  const isP = u === P, o = [], pct = (v, base = 0) => '+' + Math.round((v - base) * 100) + '%';
  for (const id of buffListOf(u, H)) {
    const b = BUFF_AURA[id];
    if (id === 'guard') o.push({ id, rgb: b.rgb, t: '방어 ' + pct(H.guard.bonus), left: u.guardT });
    else if (id === 'ultGuard') o.push({ id, rgb: b.rgb, t: '궁극 방어 ' + pct(H.ultGuard), left: u.ultGuardT });
    else if (id === 'run') o.push({ id, rgb: b.rgb, t: '질주 ' + pct(H.runBonus, 1), left: isP ? u.runBuffT : u.runT });
    else if (id === 'atk') o.push({ id, rgb: b.rgb, t: '공격 ' + pct(H.comboBuff.atk, 1), left: u.comboBuffT });
    else if (id === 'postAtk') o.push({ id, rgb: b.rgb, t: '궁극 후 공격 ' + pct(H.postUltAtk, 1), left: u.postUltT });
    else if (id === 'spd') o.push({ id, rgb: b.rgb, t: '궁극 후 공속 ' + pct(H.postUltAspd, 1), left: u.postUltT });
    else if (id === 'aspd') o.push({ id, rgb: b.rgb, t: '공속 ' + pct(H.aspdBuff.mult, 1), left: u.aspdT });
    else if (id === 'floor') o.push({ id, rgb: b.rgb, t: '불사 보호', left: u.floorT });
    else if (id === 'undy') o.push({ id, rgb: b.rgb, t: '불사 · 공격 +' + Math.round((H.undy.atk - 1) * 100) + '%', left: u.undyT });
    else if (id === 'bless') o.push({ id, rgb: b.rgb, t: '월하 축복 +' + Math.round(BLESS_ATK * 100) + '%', left: u.blessT });
  }
  return o;
}
// 받은 디버프 (약식 아이콘): 스턴 / 경직 / 둔화 / 저항(상태 이상 점감 횟수)
function debuffList(u) {
  const o = [], isP = u === P, a = isP ? u.act : null;
  const stun = isP ? (a && a.type === 'stun' ? Math.max(0, a.dur - a.t) : 0) : (u.state === 'stun' ? Math.max(0, u.t) : 0);
  const hurt = isP ? (a && a.type === 'hurt' ? Math.max(0, a.dur - a.t) : 0) : (u.state === 'hit' ? Math.max(0, u.t) : 0);
  const remS = () => isP ? (u.act && u.act.type === 'stun' ? Math.max(0, u.act.dur - u.act.t) : 0) : (u.state === 'stun' ? Math.max(0, u.t) : 0), remH = () => isP ? (u.act && u.act.type === 'hurt' ? Math.max(0, u.act.dur - u.act.t) : 0) : (u.state === 'hit' ? Math.max(0, u.t) : 0);
  if (stun > 0) o.push({ k: 'stun', t: stun, tip: () => ({ title: '스턴', col: '255,225,74', lines: ['이동·공격·회피를 할 수 없는 상태입니다.', '남은 시간 ' + remS().toFixed(1) + '초'] }) });
  else if (hurt > 0) o.push({ k: 'hurt', t: hurt, tip: () => ({ title: '경직 (히트 리커버리)', col: '255,154,74', lines: ['공격을 맞아 잠시 행동할 수 없는 상태입니다.', '남은 시간 ' + remH().toFixed(1) + '초'] }) });
  if (u.slowT > 0) o.push({ k: 'slow', t: u.slowT, tip: () => ({ title: '둔화', col: '127,208,255', lines: ['이동속도가 감소했습니다.', '남은 시간 ' + Math.max(0, u.slowT).toFixed(1) + '초'] }) });
  if (hasDR(u) && (u.drN || 0) > 0) o.push({ k: 'resist', n: Math.min(u.drN, DR_STEPS.length), t: u.drN >= DR_STEPS.length ? Math.max(0, u.drT || 0) : 0, busy: u.drBusy > 0, tip: () => { const n = Math.min(u.drN || 0, DR_STEPS.length); return { title: '상태 이상 저항 (고유)  ' + n + ' / ' + DR_STEPS.length + '회', col: '201,160,255', lines: ['경직·스턴·둔화를 겪을수록 지속시간이 줄어듭니다.', '효율  1회 100% → 2회 80% → 3회 60% → 4회 40% → 5회 이후 20%', '다음 상태 이상의 효율  ' + Math.round(DR_STEPS[Math.min(u.drN || 0, DR_STEPS.length - 1)] * 100) + '%', (u.drN || 0) >= DR_STEPS.length ? '초기화까지 ' + Math.ceil(Math.max(0, u.drT || 0)) + '초' : '5회가 되면 60초 뒤 초기화됩니다', u.drBusy > 0 ? '지금 걸린 상태 이상이 끝난 뒤 새로 걸릴 때 다음 횟수로 넘어갑니다.' : ''].filter(Boolean) }; } });
  return o;
}
const DEBUFF_W = 26;
const BUFF_DESC = { guard: '3단 공격이 적중하면 방어력이 올라갑니다 (관우).', ultGuard: '궁극기를 쓰는 동안과 그 직후 방어력이 올라갑니다.', run: '3단 공격 성공 시 이동속도가 올라갑니다 (여포 상마 · 질주).', atk: '3단 콤보를 끝까지 성공시키면 공격력이 올라갑니다 (전위).', postAtk: '궁극기 사용 후 공격력이 올라갑니다.', spd: '궁극기 사용 후 공격속도가 올라갑니다.', aspd: '3단 공격이 성공하면 공격속도가 올라갑니다.', floor: '전투당 1회, 지속 시간 동안 생명력이 1 밑으로 내려가지 않습니다 (전위).', undy: '불사의 광기: 공격력 증가와 흡혈 (전위).', bless: '월하 축복: 아군의 공격력·방어력이 올라갑니다 (초선).' };
const BCHIP_DESC = { '강': '체력이 줄어 보스가 강해진 단계입니다. 단계가 오를수록 아래 효과가 커집니다.', '피': '보스 공격의 피해가 증가했습니다.', '속': '보스 스킬의 시전(선딜·후딜)이 빨라졌습니다.', '쿨': '스킬과 스킬 사이의 대기 시간이 줄었습니다.', '연': '스킬이 끝난 뒤 곧바로 다음 스킬을 이어서 쓸 확률입니다.', '불': '불사 보호: 지속 시간 동안 생명력 1 밑으로 내려가지 않습니다 (전투당 1회).', '광': '광폭: 피해와 이동속도가 증가한 상태입니다.', '저': '고유 능력 — 상태 이상 저항: 경직·스턴·둔화를 겪을수록 지속시간이 줄어듭니다 (5회 이후 20%, 60초 뒤 초기화).', '갑': '슈퍼아머: 일반 공격에는 경직되지 않습니다 (스턴은 가능).', '난': '웨이브 난이도 단계입니다 (몬스터 체력·피해 배율).', '페': '보스 페이즈입니다.' };
// 아이콘을 누르면 상세 정보 팝업 (모든 모드 공통): 그리는 동안 탭 영역(ICON_HITS)을 모으고, 눌린 아이콘의 tip() 을 팝업으로 보여줌
let ICON_HITS = [], iconTip = null;
function wrapStr(str, w, font) { ctx.font = font; const out = []; let cur = ''; for (const ch of str) { if (ctx.measureText(cur + ch).width > w && cur) { out.push(cur); cur = ch; } else cur += ch; } if (cur) out.push(cur); return out; }
function drawIconTip() {
  if (!iconTip) return; if (T - iconTip.t0 > 6) { iconTip = null; return; }
  const tp = iconTip.tip(), w = 270, lines = []; for (const l of tp.lines) lines.push(...wrapStr(l, w - 28, '500 12.5px ' + FONT));
  const h = 40 + lines.length * 18 + 8; let x = clamp(iconTip.x, 8, W - w - 8), y = iconTip.y + 34; if (y + h > H - 8) y = iconTip.y - h - 6;
  ctx.save(); ctx.fillStyle = 'rgba(12,10,24,.96)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgb(' + (tp.col || '255,211,77') + ')'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h); ctx.fillStyle = 'rgb(' + (tp.col || '255,211,77') + ')'; ctx.fillRect(x, y, 5, h);
  ctx.restore(); text(tp.title, x + 16, y + 25, 15, COLORS.goldText, 'left'); lines.forEach((l, i) => text(l, x + 16, y + 46 + i * 18, 12.5, '#e6e9f5', 'left', false));
  text('아무 곳이나 누르면 닫힙니다', x + w - 8, y + h - 6, 9.5, 'rgba(255,255,255,.4)', 'right', false);
}
const BUFF_GLYPH = { wine: '술', hit: '연', guard: '방', ultGuard: '방', run: '질', atk: '공', postAtk: '공', spd: '속', aspd: '속', floor: '불', undy: '광', bless: '복' };   // 버프 아이콘 글자
function drawIconItems(list, x, y, noLabel) {   // (x, y) 부터 오른쪽으로 21px 아이콘(버프·디버프) + 남은 시간(작은 글씨)
  if (!list.length) return 0;
  list.forEach((d, i) => {
    const ix = x + i * DEBUFF_W, cx = ix + 10, cy = y + 10;
    const col = (d.k === 'buff' || d.k === 'bchip') ? 'rgb(' + d.rgb + ')' : d.k === 'stun' ? '#ffe14a' : d.k === 'hurt' ? '#ff9a4a' : d.k === 'slow' ? '#7fd0ff' : '#c9a0ff';
    if (d.tip) ICON_HITS.push({ x: ix - 3, y: y - 3, w: 27, h: 27, tip: d.tip });
    ctx.fillStyle = 'rgba(10,12,20,.82)'; ctx.fillRect(ix, y, 21, 21); ctx.strokeStyle = col; ctx.lineWidth = d.k === 'resist' && d.busy ? 2.2 : 1.4; ctx.strokeRect(ix + 0.5, y + 0.5, 20, 20);
    ctx.save(); ctx.translate(cx + 0.5, cy + 0.5); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    if (d.k === 'buff' || d.k === 'bchip') { ctx.globalAlpha = 0.3; ctx.fillRect(-8.5, -8.5, 17, 17); ctx.globalAlpha = 1; ctx.font = '800 12px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(d.g || BUFF_GLYPH[d.id] || '+', 0, 4.2); }
    else if (d.k === 'stun') { ctx.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 3.2 : 7.4, a = -Math.PI / 2 + k * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }   // ★
    else if (d.k === 'hurt') { ctx.fillRect(-1.6, -7, 3.2, 9); ctx.beginPath(); ctx.arc(0, 5.6, 1.9, 0, TAU); ctx.fill(); }   // !
    else if (d.k === 'slow') { for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 7.5, Math.sin(a) * 7.5); ctx.lineTo(-Math.cos(a) * 7.5, -Math.sin(a) * 7.5); ctx.stroke(); } }   // ❄
    else { ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(6, -6); ctx.lineTo(6, 1); ctx.quadraticCurveTo(6, 6, 0, 8); ctx.quadraticCurveTo(-6, 6, -6, 1); ctx.closePath(); ctx.globalAlpha = 0.28; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke(); ctx.font = '800 9px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(String(d.n), 0, 3.6); }   // 방패 + 횟수
    ctx.restore();
    const lab = noLabel ? '' : d.k === 'bchip' ? (d.lab || '') : d.k === 'resist' ? (d.t > 0 ? Math.ceil(d.t) + 's' : '') : d.t.toFixed(1);
    if (lab) { ctx.font = '700 9px ' + FONT; ctx.textAlign = 'center'; ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(lab, cx, y + 31); ctx.fillStyle = '#fff'; ctx.fillText(lab, cx, y + 31); ctx.textAlign = 'left'; }
  });
  return list.length * DEBUFF_W;
}
const drawDebuffIcons = (u, x, y) => drawIconItems(debuffList(u), x, y);
function drawRowBuffs(u, H, mine, x, y) {   // 영웅 줄 옆: 버프·디버프 아이콘 + 남은 시간만 (모든 영웅 동일)
  const bl = buffInfoOf(u, H), items = [...debuffList(u), ...bl.map(b => ({ k: 'buff', id: b.id, rgb: b.rgb, t: b.left, tip: () => { const cur = buffInfoOf(u, H).find(q => q.id === b.id) || b; return { title: cur.t, col: b.rgb, lines: [BUFF_DESC[b.id] || '', '남은 시간 ' + Math.max(0, cur.left).toFixed(1) + '초'].filter(Boolean) }; } }))], dw = items.length * DEBUFF_W;
  if (items.length) drawIconItems(items, mine ? x + 206 : x - 6 - dw, y + 1);
  // 상세 버프 설명(텍스트)은 하단 상세 정보에서 (조작 영웅)
}
const hudRow = (u, hero0, x, y, mine, isP) => {   // 영웅 목록 한 줄 (비무장·레이드 공용): 초상 · 이름 · 생명력 · 분노 · 버프 알약
  if (!isP && !u) return;

    const hero = isP ? HERO.id : u ? u.hero : hero0;   // 지금 모습(폼)으로 표시: 여포는 상마/하마
    const dead = isP ? P.dead : u.dead, hp = isP ? P.hp : u.hp, mx = isP ? P.maxhp : u.maxhp, rg = isP ? P.rage : u.rage; let col = mine ? COLORS.ally : COLORS.dangerText;
    const dh = mode === 'duel'; if (dh) col = mine ? COLORS.ally : COLORS.foe;
    ctx.fillStyle = COLORS.panel50; ctx.fillRect(x, y, 200, 38); ctx.strokeStyle = isP ? COLORS.gold : col; ctx.lineWidth = isP ? 2.5 : dh ? 2 : 1.5; ctx.strokeRect(x, y, 200, 38); if (dh) { ctx.fillStyle = col; ctx.fillRect(x, y, 6, 38); }   // 비무장: 왼쪽 팀색 띠
    ctx.save(); ctx.beginPath(); ctx.arc(x + 20, y + 19, 16, 0, TAU); ctx.clip(); ctx.translate(x + 20, y + 22); ctx.scale(0.52, 0.52); drawPortraitIcon(HEROES[hero], 0, 0); ctx.restore();
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + 20, y + 19, 16, 0, TAU); ctx.stroke();
    if (dh) text(fitStr(DUEL_NAME[hero] + (isP ? '  (나)' : ''), 150, 14), x + 42, y + 15, 14, '#fff'); else text(DUEL_NAME[hero] + (isP ? '  (나)' : ''), x + 42, y + 14, 11, '#fff');
    const fr = clamp(hp / mx, 0, 1); ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x + 42, y + 18, 150, 9); ctx.fillStyle = fr > 0.5 ? '#4fd36a' : fr > 0.25 ? '#f0b030' : '#ff3a3a'; ctx.fillRect(x + 43, y + 19, 148 * fr, 7);
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x + 42, y + 29, 150, 5); ctx.fillStyle = rg >= 100 ? COLORS.gold : '#e0902a'; ctx.fillRect(x + 43, y + 30, 148 * clamp(rg / 100, 0, 1), 3);
    if (!dead) drawRowBuffs(isP ? P : u, isP ? HERO : HEROES[u.hero], mine, x, y);
    if (dead) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x, y, 200, 38); ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + 6, y + 4); ctx.lineTo(x + 36, y + 34); ctx.moveTo(x + 36, y + 4); ctx.lineTo(x + 6, y + 34); ctx.stroke(); }
};
function drawRaidHUD() {   // 레이드: 비무장과 같은 영웅 목록 (0 = 조작 영웅, 초상화를 누르거나 Q 로 변경)
  RD.order.forEach((h, i) => { const isP = h === curHero; hudRow(isP ? P : allies.find(a => pcId(a.hero) === h), h, DUEL_ROW.x, DUEL_ROW.y + i * DUEL_ROW.step, true, isP); });
  if (allies.length) text('초상화 클릭 · Q : 조작 영웅 변경', 10, 10 + RD.order.length * 42 + 8, 11, COLORS.silver, 'left', false);
}
function drawTeamHead() {   // 비무장 HUD 열 머리글: 왼쪽 "아군"(하늘청) / 오른쪽 "적군"(주홍)
  text('아군', 10, 27, 16, COLORS.ally, 'left'); text('적군', W - 10, 27, 16, COLORS.dangerText, 'right');
}
function drawVsTag(pre, a, b, suf) {   // 가운데 위 "비무장 3 VS 3": 아군 수 하늘청 · VS 은백 · 적군 수 주홍 (18px)
  const parts = [[pre, COLORS.silver], [String(a), COLORS.ally], [' VS ', COLORS.silver], [String(b), COLORS.dangerText], [suf, COLORS.silver]].filter(p => p[0]);
  ctx.font = '800 18px ' + FONT; const ws = parts.map(p => ctx.measureText(p[0]).width); let x = W / 2 - ws.reduce((s, v) => s + v, 0) / 2;
  parts.forEach((p, i) => { text(p[0], x, 66, 18, p[1], 'left'); x += ws[i]; });
}
function drawDuelHUD() {
  const row = hudRow;
  if (allies.length) text('초상화 클릭 · Q : 조작 영웅 변경', 10, DUEL_ROW.y + duel.order.length * 42 + 8, 11, COLORS.silver, 'left', false);
  drawDamageMeter(); drawTeamHead();
  duel.order.forEach((h, i) => { const isP = h === curHero; row(isP ? P : allies.find(a => pcId(a.hero) === h), h, 10, DUEL_ROW.y + i * 42, true, isP); });
  duel.foes.forEach((u, i) => row(u, u.hero, W - 210, DUEL_ROW.y + i * 42, false, false));
  // 남은 시간 (모래시계 + mm:ss)
  const tl = Math.max(0, duel.t), mm = Math.floor(tl / 60), ss = Math.floor(tl % 60), urgent = tl < 30;
  ctx.fillStyle = COLORS.panel60; ctx.fillRect(W / 2 - 74, 8, 148, 36); ctx.strokeStyle = urgent ? COLORS.dangerText : COLORS.goldTrim; ctx.lineWidth = 2; ctx.strokeRect(W / 2 - 74, 8, 148, 36);
  ctx.fillStyle = urgent ? '#ff8a7a' : COLORS.gold; ctx.beginPath(); ctx.moveTo(W / 2 - 58, 15); ctx.lineTo(W / 2 - 40, 15); ctx.lineTo(W / 2 - 49, 26); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(W / 2 - 49, 26); ctx.lineTo(W / 2 - 58, 37); ctx.lineTo(W / 2 - 40, 37); ctx.closePath(); ctx.fill();
  text(String(mm).padStart(2, '0') + ' : ' + String(ss).padStart(2, '0'), W / 2 + 14, 35, 22, urgent ? '#ff8a7a' : '#fff', 'center');
  drawVsTag('비무장 ', duel.order.length, duel.foes.length, '');
  if (duel.t0 < 2.4 && state === 'play') { const al = clamp(Math.min(duel.t0, 2.4 - duel.t0) * 3, 0, 1); ctx.globalAlpha = al; text('FIGHT!', W / 2, 300, 72, COLORS.gold, 'center'); ctx.globalAlpha = 1; }
}

// ---------- 전투 속도 조절 ----------
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3], SPEED_1X = 3; let speedIdx = SPEED_1X;   // 0.25배속 단위, 0.25 ~ 3배속   // 1배속에서 시작 (전투를 시작할 때마다 1배속으로 되돌림)
const BASE_SPEED = 0.9;   // 모든 모드의 1배속 = 이전 속도의 90% (10% 감소). 배속 버튼·온라인 모두 이 기준에서 곱해짐
const gameSpeed = () => BASE_SPEED * (NET.on ? 1 : SPEEDS[speedIdx]);
const SPD = { l: { x: W / 2 - 92, y: H - 96, w: 52, h: 36 }, c: { x: W / 2 - 36, y: H - 96, w: 72, h: 36 }, r: { x: W / 2 + 40, y: H - 96, w: 52, h: 36 } };   // 아래 안내 문구(AUTO 전투 중 등)를 가리지 않게 위쪽에
const speedCtlOn = () => state === 'play' && !NET.on && !TUT && !paused;
function speedStep(d) { const n = clamp(speedIdx + d, 0, SPEEDS.length - 1); if (n !== speedIdx) { speedIdx = n; sfx('hit'); } }
function speedTap(x, y) { if (!speedCtlOn()) return false; if (inRect(x, y, SPD.l)) { speedStep(-1); return true; } if (inRect(x, y, SPD.r)) { speedStep(1); return true; } if (inRect(x, y, SPD.c)) { if (speedIdx !== SPEED_1X) { speedIdx = SPEED_1X; sfx('hit'); } return true; } return false; }
function drawSpeedCtl() {
  if (!speedCtlOn()) return; const sp = SPEEDS[speedIdx], slow = sp < 1, fast = sp > 1;
  const box = (r, col, on) => { ctx.fillStyle = on ? 'rgba(40,34,18,.85)' : 'rgba(10,8,20,.72)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = col; ctx.lineWidth = on ? 2.5 : 1.5; ctx.strokeRect(r.x, r.y, r.w, r.h); };
  const arrow = (r, d, col, dis) => { ctx.save(); ctx.globalAlpha = dis ? 0.35 : 1; ctx.fillStyle = col; const cx = r.x + r.w / 2, cy = r.y + r.h / 2; for (const o of [-6, 6]) { ctx.beginPath(); ctx.moveTo(cx + o + d * 6, cy); ctx.lineTo(cx + o - d * 5, cy - 8); ctx.lineTo(cx + o - d * 5, cy + 8); ctx.closePath(); ctx.fill(); } ctx.restore(); };
  box(SPD.l, '#7fb8ff', slow); box(SPD.c, sp === 1 ? 'rgba(255,255,255,.4)' : COLORS.gold, sp !== 1); box(SPD.r, '#ff9a4a', fast);
  arrow(SPD.l, -1, '#7fb8ff', speedIdx === 0); arrow(SPD.r, 1, '#ff9a4a', speedIdx === SPEEDS.length - 1);
  text(sp + '배속', SPD.c.x + SPD.c.w / 2, SPD.c.y + 25, 16, sp === 1 ? COLORS.silver : COLORS.goldText, 'center');
}
// ---------- 메인 업데이트 ----------
function update(rdt) {
  if (CAP.on && CAP.freeze) return;   // 캡처 모드: 화면 정지 (F7)
  T += rdt; if (TUT) tutUpdate(rdt);
  if (tagFx) { tagFx.t += rdt; if (tagFx.t >= tagFx.dur) tagFx = null; }
  let dt = rdt;
  if (slowT > 0) { slowT -= rdt; dt *= SLOWMO_MULT; }
  dt *= gameSpeed();   // 전투 속도 (오프라인 전용)
  shake = Math.max(0, shake - rdt * 40); flashT = Math.max(0, flashT - rdt);
  if (auto) RS.usedAuto = true;
  if ((state === 'win' || state === 'lose') && !RS.done) { recordRun(state); settleRun(state); }   // 한 판 경험치 정산
  if (state === 'upgrade') { updateUpgrade(rdt); return; }
  if (state === 'title' || state === 'pick' || state === 'account' || state === 'info' || state === 'waves' || state === 'net' || state === 'duelMenu' || state === 'raidMenu' || state === 'raidBoss') return;
  if (paused && !NET.on) { if (state === 'play' && mode === 'yeonui') { updateCamera(rdt); return; } paused = false; }   // 일시정지: 전투 계산 중단
  else if (paused && state !== 'play') paused = false;   // 온라인: 정지 화면은 확인창일 뿐 전투는 계속
  if (NET.on && NET.role === 'guest') { if (NET.raid) netRaidGuestStep(rdt); else netGuestStep(rdt); updateCamera(rdt); return; }   // 온라인 게스트: 전투 계산 없이 받은 상태만 그림
  if (hitstop > 0) { hitstop -= rdt; dt = 0; }
  if (NET.on) netHostPre();
  const sub = Math.max(1, Math.ceil(dt / 0.034)); dt /= sub;   // 빠른 배속에서는 한 프레임을 여러 번 나눠 계산 (충돌·판정이 건너뛰지 않게)
  for (let k = 0; k < sub; k++) if (dt > 0) {
    if (state === 'play') { clock += dt; updatePlayer(dt); if (mode === 'duel') updateDuel(dt); else { updateWaves(dt); if (RAID) updateRaidAllies(dt); } updateItems(dt); }
    else { winT += dt; }
    updateEnemies(dt); updateProjectiles(dt); updateFx(dt);
  }
  if (NET.on) { if (NET.raid) netRaidHostPost(rdt); else netHostPost(rdt); }
  updateCamera(rdt);
}

