'use strict';
// ---------- 이펙트 ----------
function ring(x, y, r, dur, color, lw = 8) { fx.push({ k: 'ring', x, y, r, t: 0, dur, color, lw }); }
let fxHeroNow = '';   // 지금 연출을 만드는 장수(무기 컨셉별 궤적 표시용): updatePlayer / execEv 시작 시 갱신
function arcFx(x, y, face, r, half, dur, color, dir, hid) { fx.push({ k: 'arc', x, y, face, r, half, t: 0, dur, color, dir, hid: hid != null ? hid : fxHeroNow }); }
function sparks(x, y, n, color, spd = 300, life = 0.4) { for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(spd * .3, spd); fx.push({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, dur: rand(life * .5, life), color, sz: rand(2, 5) }); } }
function ghost(x, y, face, hero, extra) { fx.push({ k: 'ghost', x, y, face, hero, t: 0, dur: 0.3, ...extra }); }
// ---------- 타격 이펙트: 장수의 무기·주문 컨셉별 HIT 연출 ----------
//  관우 청룡언월도 = 비취빛 초승달 베기 / 상마 방천화극 = 붉은 사선 난도 + 균열 / 하마·조운 창·화극 = 관통 직선 / 초선 = 꽃잎 소용돌이 / 전위 쌍철극 = 엑스(X) 참격 + 충격파 / 황충 활 = 금빛 방사형 화살 충격
const HIT_SCALE = 0.5;   // 타격 이펙트 전체 크기 배율
const HIT_STYLE = { guan: 'blade', lubu: 'heavy', lubu2: 'pierce', zhao: 'pierce', diao: 'petal', dian: 'twin', huang: 'arrow', mbAxe: 'heavy', mbSpear: 'pierce' };   // mbAxe / mbSpear = 몬스터 보스(도끼·창)의 궤적
const HIT_COL = { mbAxe: ['#ffd9a0', '#e0602c'], mbSpear: ['#ece4ff', '#8a5ae0'], guan: ['#aaffe6', '#2fd0a0'], lubu: ['#ffb27a', '#c9302c'], lubu2: ['#ff8a7a', '#9a1c1c'], zhao: ['#f4fbff', '#7fd0ff'], diao: ['#ffd0ea', '#ff6aa8'], dian: ['#ffd29a', '#ff6a2a'], huang: ['#fff0b0', '#ffb030'] };
const bossTrailId = e => e.type === 'dianBoss' ? 'dian' : e.type === 'guanBoss' ? 'guan' : e.type === 'zhaoBoss' ? 'zhao' : e.type === 'boss' ? 'lubu' : e.d.weapon === 'spear' ? 'mbSpear' : 'mbAxe';   // 보스 몬스터의 무기 궤적 종류
function hitFx(e, o, crit, big) {
  const hid = o.ai ? (o.by && o.by.hero) : HERO.id, st = HIT_STYLE[hid]; if (!st || fx.length > 260) return;
  const ang = o.from ? angTo(o.from, e) : 0, c = HIT_COL[hid], x = e.x, y = e.y - e.r, sz = HIT_SCALE * (big ? 1.45 : 1) * (crit ? 1.2 : 1) * Math.max(0.8, Math.min(1.6, e.r / 26));
  fx.push({ k: 'hfx', st, x, y, ang, t: 0, dur: big ? 0.36 : 0.27, sz, c1: c[0], c2: c[1], sd: Math.random() * TAU });
  const n = big ? 9 : 5, fwd = o.from ? ang : rand(0, TAU);
  if (st === 'heavy' || st === 'twin') { for (let i = 0; i < n; i++) { const a = fwd + rand(-0.9, 0.9), sp = rand(200, 520) * HIT_SCALE; fx.push({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, dur: rand(0.25, 0.5), color: i % 2 ? c[0] : c[1], sz: rand(3, 6) * HIT_SCALE + 1 }); } if (big) ring(e.x, e.y, 70 * sz, 0.28, c[1], 6); if (!o.ai) { P.freeze = Math.max(P.freeze, big ? 0.075 : 0.05); doShake(big ? 6 : 4); } }
  else if (st === 'pierce') { for (let i = 0; i < n; i++) { const a = fwd + rand(-0.25, 0.25), sp = rand(380, 780) * HIT_SCALE; fx.push({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, dur: rand(0.2, 0.4), color: i % 2 ? c[0] : c[1], sz: rand(2, 4) * HIT_SCALE + 1 }); } streak(x - Math.cos(ang) * 30, y - Math.sin(ang) * 30, ang, 110 * sz, 4, 0.2, c[0]); }
  else if (st === 'blade') { for (let i = 0; i < n; i++) { const a = ang + Math.PI / 2 * (i % 2 ? 1 : -1) + rand(-0.4, 0.4), sp = rand(240, 520) * HIT_SCALE; fx.push({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, dur: rand(0.25, 0.45), color: i % 2 ? c[0] : c[1], sz: rand(2, 5) * HIT_SCALE + 1 }); } }
  else if (st === 'petal') { for (let i = 0; i < n; i++) { const a = rand(0, TAU), sp = rand(80, 260) * HIT_SCALE; fx.push({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, t: 0, dur: rand(0.4, 0.7), color: i % 2 ? c[0] : c[1], sz: rand(3, 6) * HIT_SCALE + 1 }); } }
  else { for (let i = 0; i < n; i++) { const a = rand(0, TAU), sp = rand(260, 560) * HIT_SCALE; fx.push({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, dur: rand(0.2, 0.4), color: i % 2 ? c[0] : c[1], sz: rand(2, 4) * HIT_SCALE + 1 }); } if (big) ring(e.x, e.y, 60 * sz, 0.25, c[1], 4); }
}
const TRAIL_A = 0.25;   // 무기 궤적 이펙트 진하기 (1 = 원래)
// 공격 궤적: 무기별 모양으로 범위(부채꼴 윤곽)와 휘두르는 궤적을 보여줌
function drawArcFx(f, p) {
  const st = HIT_STYLE[f.hid], c = HIT_COL[f.hid], sw = Math.min(1, p * 3.5), a1 = -f.half, a2 = -f.half + 2 * f.half * sw, R = f.r, fade = 1 - p;
  ctx.save(); ctx.translate(f.x, f.y - 14); ctx.rotate(f.face); ctx.scale(1, f.dir);
  if (!st) {
    ctx.globalAlpha = fade * 0.9;
    const g = ctx.createRadialGradient(0, 0, R * 0.5, 0, 0, R); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.75, f.color); g.addColorStop(1, 'rgba(255,255,255,.95)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, a1, a2); ctx.arc(0, 0, R * 0.55, a2, a1, true); ctx.closePath(); ctx.fill(); ctx.restore(); return;
  }
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  ctx.globalAlpha = TRAIL_A * (Math.max(0, 0.5 * (1 - p * 1.5))); ctx.strokeStyle = c[0]; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, R, -f.half, f.half);   // 범위 윤곽 (바깥 호 + 좌우 경계)
  if (f.half < 1.4) { ctx.moveTo(0, 0); ctx.lineTo(Math.cos(-f.half) * R, Math.sin(-f.half) * R); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(f.half) * R, Math.sin(f.half) * R); } ctx.stroke();
  const trail = (ri, col, aMul) => { const n = 12; for (let i = 0; i < n; i++) { const s0 = a1 + (a2 - a1) * i / n, s1 = a1 + (a2 - a1) * (i + 1) / n + 0.02; ctx.globalAlpha = TRAIL_A * (fade * Math.pow((i + 1) / n, 2) * (aMul || 0.9)); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, R, s0, s1); ctx.arc(0, 0, R * ri, s1, s0, true); ctx.closePath(); ctx.fill(); } };
  const head = (ri, w, col) => { ctx.globalAlpha = TRAIL_A * (fade); ctx.strokeStyle = col; ctx.lineWidth = w * fade + 1; ctx.beginPath(); ctx.moveTo(Math.cos(a2) * R * ri, Math.sin(a2) * R * ri); ctx.lineTo(Math.cos(a2) * R, Math.sin(a2) * R); ctx.stroke(); };
  switch (st) {
    case 'blade': trail(0.7, c[1], 0.8); trail(0.9, c[0], 0.9); head(0.6, 5, c[0]); break;
    case 'heavy': trail(0.3, c[1], 0.85); trail(0.7, c[0], 0.6); head(0.3, 9, c[0]); break;
    case 'pierce':
      if (f.half < 0.5) { const len = R * Math.min(1, sw * 1.4), w = Math.max(6, R * 0.05); ctx.globalAlpha = TRAIL_A * (fade); ctx.fillStyle = c[1]; ctx.beginPath(); ctx.moveTo(R * 0.1, -w); ctx.lineTo(len, 0); ctx.lineTo(R * 0.1, w); ctx.closePath(); ctx.fill(); ctx.strokeStyle = c[0]; ctx.lineWidth = 3 * fade + 1; ctx.beginPath(); ctx.moveTo(R * 0.1, 0); ctx.lineTo(len, 0); ctx.stroke(); ctx.lineWidth = 1.5; for (const sy of [-2.4, 2.4]) { ctx.beginPath(); ctx.moveTo(R * 0.2, sy * w); ctx.lineTo(len * 0.8, sy * w); ctx.stroke(); } }
      else { trail(0.9, c[1], 0.8); trail(0.97, c[0], 0.95); head(0.8, 3, c[0]); } break;
    case 'petal': trail(0.55, c[1], 0.45); for (let i = 0; i < 8; i++) { const a = a1 + (a2 - a1) * (i + 0.5) / 8, r = R * (0.78 + 0.18 * Math.sin(i * 2.1 + f.x)); ctx.save(); ctx.translate(Math.cos(a) * r, Math.sin(a) * r); ctx.rotate(a + 1.1); ctx.globalAlpha = TRAIL_A * (fade * (0.35 + 0.65 * (i + 1) / 8)); ctx.fillStyle = i % 2 ? c[0] : c[1]; ctx.beginPath(); ctx.ellipse(0, 0, 11, 5, 0, 0, TAU); ctx.fill(); ctx.restore(); } break;
    case 'twin': trail(0.8, c[1], 0.85); trail(0.94, c[0], 0.95); { ctx.globalAlpha = TRAIL_A * (fade); ctx.strokeStyle = c[1]; ctx.lineWidth = 6 * fade + 1; ctx.beginPath(); ctx.arc(0, 0, R * 0.84, a1, a2); ctx.stroke(); ctx.strokeStyle = c[0]; ctx.lineWidth = 3 * fade + 1; ctx.beginPath(); ctx.arc(0, 0, R, a1, a2); ctx.stroke(); } head(0.78, 7, c[0]); break;
    default: trail(0.85, c[1], 0.8); head(0.75, 4, c[0]);
  }
  ctx.restore();
}
function drawBeamFx(f, p) {
  const st = HIT_STYLE[f.hid], c = HIT_COL[f.hid];
  ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ang); ctx.globalAlpha = 1 - p;
  if (!st) { ctx.fillStyle = '#fff3b0'; const w = f.w * (1 - p * 0.6); ctx.fillRect(-f.len, -w / 2, f.len * 2, w); ctx.restore(); return; }
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.globalAlpha *= TRAIL_A;
  const L = f.len, ext = Math.min(1, 0.3 + p * 5), w = f.w * (1 - p * 0.5);
  ctx.translate(-L, 0); ctx.scale(ext, 1);
  if (st === 'arrow') {   // 황충: 금빛 화살 (화살촉 + 깃 + 잔광)
    const g = ctx.createLinearGradient(0, 0, 2 * L, 0); g.addColorStop(0, 'rgba(255,224,138,0)'); g.addColorStop(1, c[0]); ctx.strokeStyle = g; ctx.lineWidth = Math.max(3, w * 0.5); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(2 * L - 14, 0); ctx.stroke();
    ctx.fillStyle = c[0]; ctx.beginPath(); ctx.moveTo(2 * L, 0); ctx.lineTo(2 * L - 22, -7); ctx.lineTo(2 * L - 22, 7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = c[1]; ctx.lineWidth = 2; for (const sy of [-1, 1]) { ctx.beginPath(); ctx.moveTo(L * 0.1, 0); ctx.lineTo(L * 0.1 - 10, sy * 7); ctx.stroke(); } ctx.restore(); return;
  }
  const ww = Math.max(7, w * (st === 'heavy' ? 0.55 : 0.4));   // 창·화극: 끝이 뾰족한 창날 궤적
  ctx.fillStyle = c[1]; ctx.beginPath(); ctx.moveTo(0, -ww * 0.2); ctx.lineTo(L * 1.1, -ww); ctx.lineTo(2 * L, 0); ctx.lineTo(L * 1.1, ww); ctx.lineTo(0, ww * 0.2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = c[0]; ctx.lineWidth = 3 * (1 - p) + 1; ctx.beginPath(); ctx.moveTo(L * 0.2, 0); ctx.lineTo(2 * L, 0); ctx.stroke();
  ctx.lineWidth = 1.5; for (const sy of [-1.9, 1.9]) { ctx.beginPath(); ctx.moveTo(L * 0.5, sy * ww); ctx.lineTo(L * 1.5, sy * ww * 0.7); ctx.stroke(); }
  ctx.restore();
}
function drawHitFx(f, p) {
  const s = f.sz, e = 1 - (1 - p) * (1 - p);
  ctx.save(); ctx.translate(f.x, f.y); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.globalAlpha = 1 - p;
  const line = (x0, y0, x1, y1, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, w); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  if (p < 0.35) { ctx.globalAlpha = (1 - p / 0.35) * 0.9; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 20 * s * (1 - p), 0, TAU); ctx.fill(); ctx.globalAlpha = 1 - p; }
  switch (f.st) {
    case 'blade': ctx.rotate(f.ang); ctx.strokeStyle = f.c2; ctx.lineWidth = 9 * s * (1 - p) + 1; ctx.beginPath(); ctx.arc(-34 * s, 0, 66 * s * (0.55 + 0.45 * e), -0.95, 0.95); ctx.stroke(); ctx.strokeStyle = f.c1; ctx.lineWidth = 3.5 * s * (1 - p) + 1; ctx.beginPath(); ctx.arc(-34 * s, 0, 66 * s * (0.55 + 0.45 * e), -0.8, 0.8); ctx.stroke(); break;
    case 'heavy': ctx.rotate(f.ang); { const L = 70 * s * (0.4 + 0.6 * e); line(-L, -L * 0.8, L, L * 0.8, 11 * s * (1 - p), f.c2); line(-L * 0.8, -L * 0.6, L * 0.8, L * 0.6, 4 * s * (1 - p), f.c1); line(-L * 0.55, L * 0.7, L * 0.55, -L * 0.2, 6 * s * (1 - p), f.c2); } break;
    case 'pierce': ctx.rotate(f.ang); { const L = 150 * s * e; line(-26 * s, 0, L, 0, 7 * s * (1 - p), f.c2); line(-14 * s, 0, L * 0.9, 0, 3 * s * (1 - p), f.c1); line(-4 * s, -11 * s, L * 0.55, -11 * s, 2.5 * s * (1 - p), f.c2); line(-4 * s, 11 * s, L * 0.55, 11 * s, 2.5 * s * (1 - p), f.c2); } break;
    case 'petal': for (let i = 0; i < 8; i++) { const a = f.sd + i * 0.785 + p * 2.4, r = (14 + 64 * e) * s, px = Math.cos(a) * r, py = Math.sin(a) * r; ctx.save(); ctx.translate(px, py); ctx.rotate(a + 1.2); ctx.fillStyle = i % 2 ? f.c1 : f.c2; ctx.beginPath(); ctx.ellipse(0, 0, 11 * s * (1 - p * 0.5), 5 * s * (1 - p * 0.5), 0, 0, TAU); ctx.fill(); ctx.restore(); } line(-16 * s * (1 - p), 0, 16 * s * (1 - p), 0, 3, '#fff'); line(0, -16 * s * (1 - p), 0, 16 * s * (1 - p), 3, '#fff'); break;
    case 'twin': ctx.rotate(f.ang + Math.PI / 4); { const L = 78 * s * (0.45 + 0.55 * e); line(-L, 0, L, 0, 10 * s * (1 - p), f.c2); line(0, -L, 0, L, 10 * s * (1 - p), f.c2); line(-L * 0.85, 0, L * 0.85, 0, 3.5 * s * (1 - p), f.c1); line(0, -L * 0.85, 0, L * 0.85, 3.5 * s * (1 - p), f.c1); } break;
    default: for (let i = 0; i < 10; i++) { const a = f.sd + i * (TAU / 10), r0 = (10 + 22 * e) * s, r1 = r0 + (i % 2 ? 26 : 50) * s * (1 - p * 0.5); line(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1, (i % 2 ? 2.5 : 4) * s * (1 - p), i % 2 ? f.c1 : f.c2); }
  }
  ctx.restore();
}
function dmgText(x, y, txt, col, size = 22) { dts.push({ x: x + rand(-12, 12), y, txt, col, size, t: 0 }); }
function doShake(n) { shake = Math.max(shake, n); }

// ---------- 전투 ----------
// ===== 비무장 미터기: 영웅(팀:영웅 id)별 주는 피해 / 받은 피해 / 주는 회복 / 받은 회복 =====
const statKey = u => u === P ? 'ally:' + curHero : u.team + ':' + pcId(u.hero);
function statRow(k) { const st = duel.stats; return st[k] || (st[k] = { dealt: 0, taken: 0, healDone: 0, healTaken: 0 }); }
function recStat(att, tgt, v) { if (!duel || !duel.stats || !(v > 0)) return; statRow(statKey(tgt)).taken += v; if (att) statRow(statKey(att)).dealt += v; }   // 실제로 깎인 생명력만 기록 (초과 피해 제외)
function recHeal(src, tgt, v) { if (!duel || !duel.stats || !(v > 0)) return; statRow(statKey(tgt)).healTaken += v; if (src) statRow(statKey(src)).healDone += v; }   // 회복이 생기면 호출 (현재 비무장에는 회복 수단이 없음)
function hurtPlayer(dmg, src, bossHit, stunT, rec, kb) {
  if (TUT) return;   // 튜토리얼 중에는 무적
  const a = P.act;
  if (P.inv > 0 || P.dead || (a && (a.type === 'ult' || a.invul)) || state !== 'play') return;
  if (!stunT && !rollHit(src, P)) { dmgText(P.x, P.y - 60, '회피!', '#7fd0ff', 24); sparks(P.x, P.y - 20, 6, '#7fd0ff', 220, 0.3); return; }   // 회피율: 공격이 빗나감
  dmg = Math.max(1, Math.round(dmg / defMul())); if (mode === 'duel') recStat(src, P, Math.min(dmg, Math.max(0, P.hp))); P.hp -= dmg; if (P.floorT > 0 && P.hp < 1) P.hp = 1; P.flash = 0.18;   // 불사: 생명력 1 밑으로 내려가지 않음 (죽지 않음)
   P.hitT = 0.42; P.hitMag = dmg >= 100 ? 1.35 : 1; P.hitAng = src ? angTo(src, P) : P.face + Math.PI;   // 피격 애니메이션 시작 doShake(8); sfx('hurt');
  // 히트 리커버리: 맞으면 하던 행동이 끊기고 피격 경직 + 넉백. 예외: 회전참 시전 중에는 슈퍼아머(피해만 받음), 청룡의 힘 시전 중에는 무적(위에서 반환)
  const armor = a && (a.type === 's1' || a.type === 'rush' || a.type === 'switch' || a.type === 'bless' || a.type === 'slam' || a.type === 'rain' || a.type === 'crystal' || (a.type === 'atk' && HERO.s1Flurry && a.c === 2));   // 조운 공격 3단(3연속 찌르기)도 슈퍼아머
  const hurtFull = (mode === 'duel' ? 0.32 * (rec || 1) : (dmg >= 100 ? 0.5 : 0.32)) * ((src && src.boss) || bossHit ? BOSS_HIT_RECOVERY_MULT : 1), stunFull = stunT || 0;
  const hurts = !armor && !(a && a.type === 'stun'), drp = hurts || stunFull ? drTake(P, Math.max(stunFull, hurts ? hurtFull : 0)) : 1; stunT = stunFull * drp;   // 상태 이상 점감 (경직·스턴)
  if (!armor && !(a && a.type === 'stun') && drp > 0) P.act = { type: 'hurt', t: 0, dur: Math.max(0.08, hurtFull * drp) };
  P.inv = mode === 'duel' ? 0 : armor ? 0.12 : 0.25;   // 비무장 모드: 피격 직후 무적 보정 없음 (AI 와 동일)
  if (src) { const ang = angTo(src, P), k = kb != null ? kb * (armor ? 0.25 : 1) : armor ? 60 : 320; P.kx = Math.cos(ang) * k; P.ky = Math.sin(ang) * k; if (src.freeze !== undefined) src.freeze = Math.max(src.freeze, 0.12); }   // 공격자 역경직
  dmgText(P.x, P.y - 60, dmg, '#ff5a5a', 26); sparks(P.x, P.y - 20, 8, '#ff6a5a', 260);
  if (stunFull && drp > 0) { P.act = { type: 'stun', t: 0, dur: Math.max(0.1, stunT) }; if (mode !== 'duel') P.inv = Math.max(P.inv, 0.25); dmgText(P.x, P.y - 100, '스턴!' + drTag(drp), '#ffe14a', 28); }
  if (mode !== 'duel' && ((src && src.boss) || bossHit)) P.inv = Math.max(P.inv, P.act && (P.act.type === 'hurt' || P.act.type === 'stun') ? (stunFull || hurtFull) : 0.5);   // 보스에게 맞은 경직·스턴 시간 동안은 연계 공격이 겹쳐 맞지 않음 (피격 후 한 대씩만)   // 스턴: 슈퍼아머와 무관, 이동·공격·회피 불가
  if (P.hp <= 0) {
    P.hp = 0;
    if (mode === 'duel' || (RAID && allies.some(a => !a.dead))) { P.dead = true; P.act = null; ring(P.x, P.y, 100, 0.5, '#ffd34d', 10); sparks(P.x, P.y - 20, 30, '#ffcf70', 600, 0.7); dmgText(P.x, P.y - 70, 'K.O.', '#ffd34d', 34); doShake(12); sfx('boom'); }   // 비무장 모드: 쓰러지면 관전 (아군 AI 가 계속 싸움)
    else if (!downToTag()) { state = 'lose'; slowT = 1.2; }
  }
}
// 드랍: 한 번 굴려서 [0, 5%) 만두, [5%, 10%) 술
function rollDrop(e) {
  const dc = DROP_CHANCE + RUN.drop, r = Math.random(), kind = r < dc ? 'bun' : r >= dc && r < dc + WINE_DROP_CHANCE ? 'wine' : null;
  if (kind) items.push({ kind, x: clamp(e.x, 100, WORLD.w - 100), y: clamp(e.y, 110, WORLD.h - 100), t: 0, life: 25 });
}
function updateItems(dt) {
  P.buffT = Math.max(0, P.buffT - dt);
  const onl = NET.on && NET.raid;
  for (const it of items) {
    it.t += dt; it.life -= dt;
    if (onl) {   // 온라인 레이드: 가까이 간 사람 PC 가 만두를 먹는다
      const f = allies.find(a => a.human && !a.dead && dist(it, a) < a.r + 24); if (!f) continue; it.life = 0;
      const before = f.hp; f.hp = Math.min(f.maxhp, f.hp + f.maxhp * BUN_HEAL_PCT); dmgText(f.x, f.y - 70, f.hp > before ? '+' + Math.round(f.hp - before) : 'MAX', '#7dff9a', 28); sparks(f.x, f.y - 20, 12, '#7dff9a', 240, 0.5); ring(f.x, f.y, 60, 0.35, '#7dff9a', 4); sfx('heal'); continue;
    }
    if (dist(it, P) >= P.r + 24) continue;   // 관우가 아이템 위에 닿으면 즉시 적용
    it.life = 0;
    if (it.kind === 'bun') {
      const before = P.hp; P.hp = Math.min(P.maxhp, P.hp + P.maxhp * BUN_HEAL_PCT);
      dmgText(P.x, P.y - 70, P.hp > before ? '+' + Math.round(P.hp - before) : 'MAX', '#7dff9a', 28); sparks(P.x, P.y - 20, 12, '#7dff9a', 240, 0.5); ring(P.x, P.y, 60, 0.35, '#7dff9a', 4); sfx('heal');
    } else {
      P.buffT = WINE_DURATION;   // 이미 취했다면 지속시간만 갱신 (중첩 없음)
      dmgText(P.x, P.y - 70, '공속·이속 +30%', '#ffc04d', 26); sparks(P.x, P.y - 20, 14, '#ffc04d', 260, 0.5); ring(P.x, P.y, 60, 0.35, '#ffc04d', 4); sfx('skill');
    }
  }
  items = items.filter(it => it.life > 0);
}
function drawItems() {
  for (const it of items) {
    if (it.life < 5 && Math.floor(T * 8) % 2 === 0) continue;   // 사라지기 직전 깜빡임
    const x = it.x, y = it.y, bob = Math.sin(it.t * 4) * 3, bun = it.kind === 'bun', rgb = bun ? '125,255,154' : '255,192,77';
    const g = ctx.createRadialGradient(x, y, 2, x, y, 36); g.addColorStop(0, `rgba(${rgb},.55)`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; circle(x, y, 36);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 4, 12, 5, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(x, y - 14 + bob);
    if (bun) {   // 만두: 하얀 찐만두 + 윗면 주름 + 김
      ctx.fillStyle = '#e3cf9f'; ctx.beginPath(); ctx.ellipse(0, 3, 14, 10, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff8e8'; ctx.beginPath(); ctx.ellipse(0, -1, 13, 9.5, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#d8c08a'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
      for (let i = 0; i < 9; i++) { const a = i * TAU / 9; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 2, -6 + Math.sin(a) * 1.5); ctx.quadraticCurveTo(Math.cos(a + 0.4) * 6, -5 + Math.sin(a + 0.4) * 4, Math.cos(a + 0.2) * 10, -3 + Math.sin(a + 0.2) * 6.5); ctx.stroke(); }
      ctx.fillStyle = '#f0dfb5'; circle(0, -6.5, 2.2);
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) { const ph = it.t * 3 + i * 1.7; ctx.beginPath(); ctx.moveTo(i * 6, -13); ctx.bezierCurveTo(i * 6 + Math.sin(ph) * 4, -18, i * 6 - Math.sin(ph) * 4, -22, i * 6 + Math.sin(ph + 1) * 3, -27); ctx.stroke(); }
    } else {     // 술: 호리병
      ctx.fillStyle = '#b8651b'; circle(0, 6, 11); circle(0, -8, 7.5); ctx.fillRect(-4.5, -7, 9, 9);
      ctx.fillStyle = 'rgba(255,225,170,.55)'; ctx.beginPath(); ctx.ellipse(-4, 4, 3, 5.5, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#eadba6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5.5, -2); ctx.lineTo(5.5, -2); ctx.stroke();
      ctx.fillStyle = '#d9b27a'; ctx.fillRect(-3, -19, 6, 5);
    }
    ctx.restore();
    text(bun ? '만두' : '술', x, y - 44 + bob, 13, bun ? '#7dff9a' : '#ffc04d', 'center');
  }
}
const atkBuffMul = () => (P.blessT > 0 ? 1 + BLESS_ATK : 1) * (P.undyT > 0 && HERO.undy ? HERO.undy.atk : 1) * (HERO.postUltAtk && P.postUltT > 0 ? HERO.postUltAtk : 1) * (HERO.comboBuff && P.comboBuffT > 0 ? HERO.comboBuff.atk : 1) * (1 + (RUN.atk + META.atk));   // 공격력 버프: 적토 돌격 후(여포 상마) / 3단 콤보 완주 후(여포 하마)
const defMul = () => 1 + (P.blessT > 0 ? BLESS_DEF : 0) + (HERO.guard && P.guardT > 0 ? HERO.guard.bonus : 0) + (HERO.ultGuard && P.ultGuardT > 0 ? HERO.ultGuard : 0) + (RUN.def + FLAT.def / 100);   // 방어력 배율 (받는 피해 = 피해 / defMul)
const comboTier = () => HERO.hitBonus ? (P.hits >= HERO.hitBonus.start ? Math.floor((P.hits - HERO.hitBonus.start) / HERO.hitBonus.step) + 1 : 0) : Math.min(COMBO_MAX_TIER, Math.floor(P.hits / COMBO_STEP));   // 현재 HIT 효과 단계
const comboPct = () => comboTier() * (HERO.hitBonus ? HERO.hitBonus.per : COMBO_BONUS);   // 공속·피해 증가율 (0.1 = +10%)
const tierHits = t => HERO.hitBonus ? HERO.hitBonus.start + (t - 1) * HERO.hitBonus.step : t * COMBO_STEP;   // t 단계가 되는 HIT 수
const comboMul = () => 1 + comboPct();
// 상태 이상 점감: 횟수는 '타격 수'가 아니라 '상태 이상이 걸린 횟수'다. 경직·스턴·둔화가 걸려 있는 동안 또 맞아도(같은 상태 이상의 연장) 횟수는 오르지 않고,
//  (걸려 있는 동안의 추가 타격은 상태 이상을 연장하지 않는다) 걸려 있던 상태 이상이 모두 끝난 뒤에 새로 걸릴 때 비로소 다음 횟수가 된다. 1~5번째 지속시간 효율 = 100/80/60/40/20%, 5번째가 시작되면 60초 뒤 횟수가 초기화된다 (피격자마다 따로)
const DR_STEPS = [1, 0.8, 0.6, 0.4, 0.2], DR_RESET = 60;
const DR_HEROES = ['dian'], DR_BOSS_TYPES = ['boss', 'raidBoss', 'dianBoss'];   // 고유 능력 '상태 이상 저항'을 가진 PC / 보스 (그 밖의 모든 유닛은 점감 없이 상태 이상이 그대로 적용)
const hasDR = u => u === P ? DR_HEROES.includes(pcId(curHero)) : u.fighter ? DR_HEROES.includes(pcId(u.hero)) : DR_BOSS_TYPES.includes(u.type);
function drTake(u, base) {   // base = 이번 타격이 거는 상태 이상 중 가장 긴 지속시간(점감 전). 반환 = 이번에 적용할 효율
  if (!hasDR(u)) return 1;   // 저항 능력이 없는 유닛: 상태 이상 그대로
  let m;
  if (u.drBusy > 0) return 0;   // 진행 중인 상태 이상이 있으면 새로 걸리지도, 연장되지도 않는다 (횟수도 오르지 않음)
  else { const n = u.drN || 0; m = DR_STEPS[Math.min(n, DR_STEPS.length - 1)]; u.drN = n + 1; u.drCur = m; if (u.drN >= DR_STEPS.length && !(u.drT > 0)) u.drT = DR_RESET; }
  u.drBusy = Math.max(u.drBusy || 0, base * m);
  return m;
}
const drPeek = u => !hasDR(u) ? 1 : u.drBusy > 0 ? 0 : DR_STEPS[Math.min(u.drN || 0, DR_STEPS.length - 1)];
function drTick(u, dt) { if (u.drBusy > 0) u.drBusy -= dt; if (u.drT > 0) { u.drT -= dt; if (u.drT <= 0) { u.drT = 0; u.drN = 0; } } }
const drTag = m => m < 0.999 ? ' (' + Math.round(m * 100) + '%)' : '';
function hitEnemy(e, dmg, o = {}) {
  if (e.dead || e.spawnT > 0 || e.invT > 0) return false;   // invT: 파이터(비무장 모드)의 무적 시간
  if (!o.stun && !rollHit(o.ai ? (o.by || null) : P, e)) { dmgText(e.x, e.y - e.r * 2.6, 'MISS', '#aab3c8', 20); sparks(e.x, e.y - e.r, 4, '#aab3c8', 180, 0.25); return false; }   // 적중률: 공격이 빗나감 (스턴 공격은 항상 적중)
  const crit = !o.nocrit && Math.random() < 0.2 + (o.ai ? (o.by && o.by.meta ? o.by.meta.crit : 0) : (RUN.crit + META.crit));
  const gm = (e.d && e.d.guard && o.from && !o.stun && !o.ai && angDiff(e.face, angTo(e, o.from)) < 1.0) ? e.d.guard : 1;   // 방패병·방패 장군: 정면 막기
  const d = Math.round(gm * dmg * (o.ai ? (o.by ? fAtkMul(o.by) : 1) : comboMul() * atkBuffMul()) * (crit ? 1.8 + (o.ai ? (o.by && o.by.meta ? o.by.meta.critDmg : 0) : (RUN.critDmg + META.critDmg)) : 1) / (e.fighter ? fDef(e) : 1) * rand(0.92, 1.08));
  if (mode === 'duel' && e.fighter) recStat(o.ai ? o.by : P, e, Math.min(d, Math.max(0, e.hp)));
  e.hp -= d; if (e.floorT > 0 && e.hp < 1) e.hp = 1; e.flash = 0.1; if (e.fighter) { e.hitT = 0.42; e.hitMag = d >= 100 ? 1.35 : 1; e.hitAng = o.from ? angTo(o.from, e) : 0; }
  const ang = o.from ? angTo(o.from, e) : 0, kb = (o.kb || 0) * (e.armor ? 0.25 : 1);
  e.kx += Math.cos(ang) * kb; e.ky += Math.sin(ang) * kb;
  // 기절(stun): 궁극기 전용. 별 표시, 길게 행동 불가. 슈퍼아머(보스)여도 스턴은 항상 적용됨 (슈퍼아머는 일반 타격의 피격 경직만 막음).
  // 피격 경직(hit): 일반 타격. d.hitRec(초) 동안 움찔하며 행동 불가, 슈퍼아머면 없음. 기절 중에는 기절이 우선.
  let stunT = o.stun || 0, recT = e.armor ? 0 : e.d.hitRec * (o.rec || 1) * PLAYER_HIT_RECOVERY_MULT, slowD = o.slow || 0, drm = 1;
  if (stunT > 0 || recT > 0 || slowD > 0) { drm = drTake(e, Math.max(stunT, recT, slowD)); stunT *= drm; recT *= drm; slowD *= drm; }   // 상태 이상 점감
  if (slowD > 0.05) { e.slowT = Math.max(e.slowT || 0, e.boss ? slowD * 0.6 : slowD); sparks(e.x, e.y + 8, 2, '#9fe8ff', 120, 0.4); }
  e.lean = Math.cos(ang) >= 0 ? 1 : -1;
  if (stunT > 0.05) { if (e.state !== 'stun') dmgText(e.x, e.y - e.r * 3.4, '스턴!' + drTag(drm), '#ffe14a', 24); e.t = e.state === 'stun' ? Math.max(e.t, stunT) : stunT; e.state = 'stun'; e.cur = null; }
  else if (recT > 0.02 && e.state !== 'stun') { e.t = e.state === 'hit' ? Math.max(e.t, recT) : recT; e.state = 'hit'; e.cur = null; }
  dmgText(e.x, e.y - e.r * 2.6, d, crit ? '#ffe14a' : '#ffffff', crit ? 32 : 22);
  sparks(e.x, e.y - e.r, crit ? 10 : 6, crit ? '#ffe14a' : '#fff4d0', 280);
  hitFx(e, o, crit, crit || d >= 100 || !!o.stun || (o.kb || 0) >= 500);
  if (!o.ai) {   // (플레이어가 때렸을 때만) 분노·HIT·역경직·화면 흔들림. 비무장 모드에서는 분노 획득 x4
  if (mode === 'yeonui') RS.dmg[curHero] = (RS.dmg[curHero] || 0) + d;
  P.hits++; P.hitsT = 3; P.bestHits = Math.max(P.bestHits, P.hits);
  const lsv = RUN.ls + META.ls + (P.undyT > 0 && HERO.undy ? HERO.undy.ls : 0); if (lsv > 0) { const hv = Math.min(P.maxhp - P.hp, d * lsv); if (hv > 0) { P.hp += hv; if (mode === 'duel') recHeal(P, P, hv); P.lsAcc = (P.lsAcc || 0) + hv; if (P.lsAcc >= 12) { dmgText(P.x, P.y - 80, '+' + Math.round(P.lsAcc), '#7dff9a', 16); P.lsAcc = 0; } } }   // 흡혈
  { const tier = comboTier(); if (tier > P.hitTier) { P.hitTier = tier; if (HERO.hitBonus) { if (tier === 1) { dmgText(P.x, P.y - 100, '공속·피해 +' + Math.round(comboPct() * 100) + '%', '#ffb04d', 24); ring(P.x, P.y, 80, 0.35, '#ffb04d', 4); sfx('skill'); } } else { dmgText(P.x, P.y - 100, '공속·피해 +' + Math.round(comboPct() * 100) + '%', '#ffb04d', 26); ring(P.x, P.y, 90, 0.4, '#ffb04d', 5); sfx('skill'); } } }
  P.freeze = Math.max(P.freeze, o.stop || (crit ? 0.06 : 0.04)); doShake(o.shake || (crit ? 5 : 3)); sfx('hit');
  } else if (Math.random() < 0.5) sfx('hit');
  if (RAID && o.ai && o.by && o.by.team === 'ally' && !e.fighter) { const hid = pcId(o.by.hero); RS.dmg[hid] = (RS.dmg[hid] || 0) + d; }   // 레이드: AI 동료의 피해도 경험치 정산에 포함
  if (e.hp <= 0) killEnemy(e);
  return true;
}
function killEnemy(e) {
  if (e.fighter) { e.dead = true; e.act = null; ring(e.x, e.y, 90, 0.5, e.team === 'ally' ? '#4fb0ff' : '#ff6a5a', 10); sparks(e.x, e.y - 20, 30, '#ffcf70', 600, 0.7); dmgText(e.x, e.y - 70, 'K.O.', '#ffd34d', 34); doShake(10); sfx('boom'); return; }
  e.dead = true; kills++; RS.kills++; if (e.boss) RS.boss++;
  rollDrop(e);
  sparks(e.x, e.y - e.r, e.boss ? 60 : 16, '#ffcf70', e.boss ? 700 : 400, 0.7); ring(e.x, e.y, e.r * 2.4, 0.4, '#fff');
  if (e.boss) { slowT = 1.6; doShake(24); flashT = 0.5; sfx('boom'); }
}
const farMul = (far, over, span) => 1 + far * clamp(over / Math.max(1, span), 0, 1);   // 먼 적일수록 피해 증가 (150px 부터 사거리 끝까지 선형)
function doArc(radius, half, dmg, o) {
  let n = 0;
  for (const e of enemies) {
    if (e.dead) continue;
    const d = dist(P, e);
    if (d - e.r > radius) continue;
    if (half < Math.PI && d > e.r + 24 && angDiff(P.face, angTo(P, e)) > half + Math.atan2(e.r, Math.max(d, 1))) continue;
    if (hitEnemy(e, o && o.far ? dmg * farMul(o.far, d - 150, radius - 150) : dmg, { ...o, from: P })) n++;
  }
  return n;
}

// ---------- 플레이어 행동 ----------
function nearest(maxD = Infinity) {
  let b = null, bd = maxD;
  for (const e of enemies) { if (e.dead || e.spawnT > 0) continue; const d = dist(P, e); if (d < bd) { bd = d; b = e; } }
  return b;
}
function aim(m) {
  const t = nearest(HERO.aimR || 320);
  if (t) P.face = angTo(P, t);
  else if (Math.hypot(m.mx, m.my) > 0.2) P.face = Math.atan2(m.my, m.mx);
}
// 기본 콤보: 1·2단계는 같은 속도(0.30s)로 서로 반대 방향(dirs) 베기, 3단계는 360° 회전베기 1회.
// hits: 타격 시점(초), dirs: 베는 방향(+1 / -1), move: [시작, 끝, 초당 전진 거리]
const ATK_SPEED = 0.5;        // 플레이어 공격 동작 속도 배율 (0.5 = 절반 속도). dash 제외, 평타·스킬·궁극기 전부 적용
const ATK = [
  { dur: 0.30, hits: [0.10], dirs: [1], mult: [1.0], rad: 135, half: 1.15, kb: 140, move: [0, 0.14, 570] },
  { dur: 0.30, hits: [0.10], dirs: [-1], mult: [1.0], rad: 135, half: 1.15, kb: 140, move: [0, 0.14, 570] },
  // 3단계: 360° 회전베기 1회(피니셔, 피해 1.5배) + 짧은 전방 이동, 범위는 1·2단계와 동일(135)
  { dur: 0.50, hits: [0.16], dirs: [1], mult: [1.5], rad: 135, half: Math.PI, span: Math.PI, kb: 320, move: [0.03, 0.3, 430], swing: 0.2 },
];
// 여포(상마) 콤보: 1단 찌르기(좁고 긴 전방, 피해 1.2배) -> 2단 베기 -> 3단 360° 베기 (2·3단은 기본 콤보와 동일)
// 관우 콤보: 단계가 오를수록 범위와 선딜이 계단식으로 커짐 — 1단 반경 120 · 선딜 0.08 / 2단 반경 150 · 선딜 0.12 / 3단 반경 185 · 선딜 0.20 (회전베기, 피해 1.5배)
const AB = { rad: [190, 200, 230], dur: [0.30, 0.34, 0.46], hit: [0.10, 0.12, 0.16] };   // 모든 PC 공통: 공격 1~3단계 반경 / 지속시간 / 타격 시점 (기준 = 이전 조운)
const GUAN_ATK = [
  { dur: AB.dur[0], hits: [AB.hit[0]], dirs: [1], mult: [1.0], rad: AB.rad[0], half: 1.15, kb: 140, move: [0, 0.14, 570] },
  { dur: AB.dur[1], hits: [AB.hit[1]], dirs: [-1], mult: [1.0], rad: AB.rad[1], half: 1.15, kb: 160, move: [0, 0.14, 570] },
  { dur: AB.dur[2], hits: [AB.hit[2]], dirs: [1], mult: [1.5], rad: AB.rad[2], half: Math.PI, span: Math.PI, kb: 320, move: [0.03, 0.3, 430], swing: 0.2 }];
// ===== 모든 PC 공격 1~3단계: 컨셉(모양)은 유지하고 범위·속도는 모두 같은 기준(AB: 이전 조운)으로 맞춘다 =====
const LUBU_RANGE = 1.1;   // (옛 K 찌르기 길이 계산용)
//  여포(상마): 1단 찌르기 -> 2단 베기 -> 3단 360° 회전 베기
const LUBU_ATK = [
  { dur: AB.dur[0], hits: [AB.hit[0]], dirs: [1], mult: [1.2], rad: AB.rad[0], half: 0.38, kb: 220, move: [0, 0.14, 570], thrust: true },
  { dur: AB.dur[1], hits: [AB.hit[1]], dirs: [-1], mult: [1.0], rad: AB.rad[1], half: 1.15, kb: 160, move: [0, 0.14, 570] },
  { dur: AB.dur[2], hits: [AB.hit[2]], dirs: [1], mult: [1.5], rad: AB.rad[2], half: Math.PI, span: Math.PI, kb: 320, move: [0.03, 0.3, 430], swing: 0.2 }];
//  여포(하마): 1단 찌르기 1회 -> 2단 왼쪽에서 오른쪽 베기 -> 3단 오른쪽에서 왼쪽 베기 (강한 넉백)
const LUBU2_ATK = [
  { dur: AB.dur[0], hits: [AB.hit[0]], dirs: [1], mult: [1.2], rad: AB.rad[0], half: 0.38, kb: 200, move: [0, 0.14, 570], thrust: true },
  { dur: AB.dur[1], hits: [AB.hit[1]], dirs: [1], mult: [1.3], rad: AB.rad[1], half: 1.15, kb: 170, move: [0, 0.14, 480] },
  { dur: AB.dur[2], hits: [AB.hit[2]], dirs: [-1], mult: [1.5], rad: AB.rad[2], half: 1.15, kb: 520, move: [0.03, 0.3, 520], swing: 0.22, slam: true }];
//  조운: 1단 찌르기(좁고 긴 전방) -> 2단 휘두르기(넓은 부채꼴) -> 3단 3연속 찌르기(한 단계 안에 3타, 합계 피해 1.5배)
const ZHAO_ATK = [
  { dur: AB.dur[0], hits: [AB.hit[0]], dirs: [1], mult: [1.0], rad: AB.rad[0], half: 0.33, kb: 160, move: [0, 0.14, 570], thrust: true },
  { dur: AB.dur[1], hits: [AB.hit[1]], dirs: [-1], mult: [1.0], rad: AB.rad[1], half: 1.7, kb: 180, move: [0, 0.14, 450] },
  { dur: AB.dur[2], hits: [0.08, 0.16, 0.24], dirs: [1, -1, 1], mult: [0.5, 0.5, 0.5], rad: AB.rad[2], half: 0.75, kb: 200, move: [0, 0.3, 400], thrust: true }];
//  초선: 1단 부채 휘두르기 -> 2단 반대로 휘두르기 -> 3단 360° 꽃잎 회전 (3단이 적중하면 주변 아군을 조금 회복)
const DIAO_ATK = [
  { dur: AB.dur[0], hits: [AB.hit[0]], dirs: [1], mult: [1.0], rad: AB.rad[0], half: 1.15, kb: 140, move: [0, 0.14, 570] },
  { dur: AB.dur[1], hits: [AB.hit[1]], dirs: [-1], mult: [1.0], rad: AB.rad[1], half: 1.15, kb: 160, move: [0, 0.14, 570] },
  { dur: AB.dur[2], hits: [AB.hit[2]], dirs: [1], mult: [1.5], rad: AB.rad[2], half: Math.PI, span: Math.PI, kb: 320, move: [0.03, 0.3, 430], swing: 0.2 }];
//  전위: 1단 쌍극 교차 베기 -> 2단 반대 방향 베기 -> 3단 360° 회전 내려찍기 (3단이 적중하면 공격력 +12%)
const DIAN_ATK = [
  { dur: AB.dur[0], hits: [AB.hit[0]], dirs: [1], mult: [1.0], rad: AB.rad[0], half: 1.15, kb: 150, move: [0, 0.14, 570] },
  { dur: AB.dur[1], hits: [AB.hit[1]], dirs: [-1], mult: [1.0], rad: AB.rad[1], half: 1.15, kb: 170, move: [0, 0.14, 570] },
  { dur: AB.dur[2], hits: [AB.hit[2]], dirs: [1], mult: [1.5], rad: AB.rad[2], half: Math.PI, span: Math.PI, kb: 380, move: [0.03, 0.3, 430], swing: 0.2, slam: true }];
//  황충: 1단 화살 -> 2단 화살 -> 3단 3연사 (공격 범위는 모든 PC 공통 AB — 화살이 날아가는 연출만 다르다). 3단이 적중하면 공속 +12%
const HUANG_RANGE = [400, 420, 460], HUANG_FAR = 0.3;   // 황충 공격 사거리(1~3단) / 먼 적일수록 피해 증가율 (사거리 끝에서 +30%)
const HUANG_ATK = [
  { dur: AB.dur[0], hits: [AB.hit[0]], dirs: [1], mult: [1.0], rad: HUANG_RANGE[0], half: 0.3, kb: 120, move: [0, 0, 0], thrust: true, ranged: true, far: HUANG_FAR },
  { dur: AB.dur[1], hits: [AB.hit[1]], dirs: [1], mult: [1.0], rad: HUANG_RANGE[1], half: 0.3, kb: 140, move: [0, 0, 0], thrust: true, ranged: true, far: HUANG_FAR },
  { dur: AB.dur[2], hits: [0.08, 0.16, 0.24], dirs: [1, 1, 1], mult: [0.5, 0.5, 0.5], rad: HUANG_RANGE[2], half: 0.45, kb: 160, move: [0, 0, 0], thrust: true, ranged: true, fan: [-0.2, 0, 0.2], far: HUANG_FAR }];
const comboTable = () => HERO.combo === 'zhao' ? ZHAO_ATK : HERO.combo === 'lubu' ? LUBU_ATK : HERO.combo === 'lubu2' ? LUBU2_ATK : HERO.combo === 'guan' ? GUAN_ATK : HERO.combo === 'diao' ? DIAO_ATK : HERO.combo === 'dian' ? DIAN_ATK : HERO.combo === 'huang' ? HUANG_ATK : ATK;
const S1_RADIUS = 215, S2_WIDTH = 85, S2_BLAST = 170;   // 회전참 반경(+10%) / 청룡참 돌진 폭 / 청룡참 종료 폭발 반경
const S2_SPEED_MULT = 1.5, S2_KB_MULT = 3;               // 청룡참: 돌진 이동 속도 +50%, 적 넉백 3배
const S2_DASH_END = 0.22;                                // 청룡참 돌진 구간 0.1 ~ 이 값(행동 시간). 0.34였던 것을 0.22로 줄여 돌진 길이 약 50% 감소
const ULT_RADIUS = 320;   // 궁극기 범위 380 -> 320 (비무장 경기장 반경 560 의 절반을 넘지 않게)
const ARROW_LIFE = 0.65;   // 화살 비행 시간 0.8 -> 0.65 (사거리 약 760 -> 620)
const ULT_DMG_MULT = 1.4;                                // 청룡의 힘 추가 피해 배율 (+40%, SKILL_DMG_MULT 위에 곱해짐)
const ULT_TIP_H = 140;   // 치켜든 청룡언월도 칼날 중심(청룡이 분출되는 지점)의 관우 기준 높이(px)                                  // 청룡의 힘 범위   // 회전참 반경 / 청룡참 돌진 폭 / 청룡참 종료 폭발 반경
// 스킬2 쿨타임 (여포 상마의 적토 돌격은 s2cdMul = 2.5배)
function s2Ready() { return P.cd.s2 <= 0; }
function castS2() { P.cd.s2 = CD.s2 * (HERO.s2cdMul || 1) * (1 - (RUN.cd + META.cd)); }
// 찌르기: 정면 한 방향으로만 길게 찌름 (전방 직사각형: 길이 THRUST_LEN, 폭 THRUST_W). 피해 = 회전참 1타 x 3 (회전참은 3타)
const THRUST_LEN = 420 * LUBU_RANGE, THRUST_W = 115 * LUBU_RANGE;   // 찌르기 길이 572 -> 462, 폭 143 -> 127
// 방천 베기 (여포 하마 스킬1): 전방 넓은 부채꼴(반경 CONE_R, 각도 ±CONE_HALF)을 좌·우로 번갈아 3번 베어냄. 한 번의 피해 = 회전참 1타 x 1.1 (360°가 아니라 전방이라 범위가 좁은 대신)
// 타수별 선딜(행동 시간 초): 1타 0.10 / 2타 0.18 / 3타 0.26 — 선딜이 길수록 범위(반경 150+700x선딜, 각도 0.8+2.0x선딜)와 피해가 커짐
//  타격 시각(누적) 0.10 / 0.28 / 0.54 → 마지막 타 뒤 후딜 0.26 (후딜도 마지막 타가 가장 김)
const CONE_PRE = [0.10, 0.18, 0.26];
const CONE_HITS = CONE_PRE.map((p, i) => ({ r: Math.round(150 + 500 * p), half: +(0.8 + 2.0 * p).toFixed(2), mult: [0.95, 1.1, 1.25][i] }));   // 반경 220/276/332, 각도 1.0/1.16/1.32(rad), 피해 x0.95/1.1/1.25
const CONE_TIMES = CONE_PRE.map((p, i) => CONE_PRE.slice(0, i + 1).reduce((a, b) => a + b, 0)), CONE_DUR = CONE_TIMES[2] + 0.26;
const CONE_R = CONE_HITS[2].r;
function coneSlam(n) {   // n = 1, 2, 3 번째 타
  const h = CONE_HITS[n - 1], dmg = P.atk * 0.85 * SKILL_DMG_MULT * S1_DMG_MULT * h.mult * HERO.bal.s1, dir = n % 2 ? 1 : -1;
  arcFx(P.x, P.y, P.face, h.r, h.half, 0.24, HERO.fx.s, dir); sparks(P.x + Math.cos(P.face) * h.r * 0.6, P.y - 8, 6 + n * 3, '#fff4d0', 300 + n * 100, 0.3);
  doArc(h.r, h.half, dmg, { kb: 240 + n * 60, rec: 2 }); doShake(3 + n * 2); sfx('swing');
}
// 칠진칠출 (조운 스킬1): 전방 직선(길이 FLURRY_LEN, 폭 FLURRY_W)을 4번 빠르게 찌름 — 슈퍼아머. 한 번의 피해 = 회전참 1타 x 0.42 (7타 합계 = 회전참 3타와 비슷)
let FLURRY_TIMES = [0.08, 0.155, 0.23, 0.305], FLURRY_DUR = 0.45; const FLURRY_LEN = 380, FLURRY_W = 190, FLURRY_MULT = 0.42 * 7 / 4, FLURRY_OFFS = [-0.3, 0.3, -0.1, 0.1];   // 찌르기마다 방향을 좌우로 벌려 전방 부채꼴을 훑음   // 4번 찌름 (이전 7번의 절반) — 1회 사용 총 피해는 그대로, 쿨타임은 2배 (HEROES.zhao.s1cdMul)
function flurryHit(n) {
  const tg = nearest(FLURRY_LEN); if (tg) P.face = angTo(P, tg);
  const fa = P.face + FLURRY_OFFS[(n - 1) % FLURRY_OFFS.length], ca = Math.cos(fa), sa = Math.sin(fa), dmg = P.atk * 0.85 * SKILL_DMG_MULT * S1_DMG_MULT * FLURRY_MULT * HERO.bal.s1;
  for (const e of enemies) { if (e.dead) continue; const dx = e.x - P.x, dy = e.y - P.y, lx = dx * ca + dy * sa, ly = Math.abs(-dx * sa + dy * ca); if (lx >= -e.r && lx <= FLURRY_LEN + e.r && ly <= FLURRY_W / 2 + e.r) hitEnemy(e, dmg, { from: P, kb: 120, rec: 1, shake: 2 }); }
  fx.push({ k: 'beam', hid: fxHeroNow, x: P.x + ca * FLURRY_LEN / 2, y: P.y - 14 + sa * FLURRY_LEN / 2, ang: fa, len: FLURRY_LEN / 2, w: FLURRY_W * 0.3, t: 0, dur: 0.18 }); sfx('swing');
}
function lineThrust() {
  const ca = Math.cos(P.face), sa = Math.sin(P.face), dmg = P.atk * 0.85 * SKILL_DMG_MULT * S1_DMG_MULT * 3 * HERO.bal.s1;
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.x - P.x, dy = e.y - P.y, lx = dx * ca + dy * sa, ly = Math.abs(-dx * sa + dy * ca);
    if (lx >= -e.r && lx <= THRUST_LEN + e.r && ly <= THRUST_W / 2 + e.r) hitEnemy(e, dmg, { from: P, kb: 260, rec: 2 });
  }
  fx.push({ k: 'beam', hid: fxHeroNow, x: P.x + ca * THRUST_LEN / 2, y: P.y - 14 + sa * THRUST_LEN / 2, ang: P.face, len: THRUST_LEN / 2, w: THRUST_W * 0.5, t: 0, dur: 0.3 });
  ring(P.x + ca * 40, P.y + sa * 40, 60, 0.25, HERO.fx.s, 6); doShake(5); sfx('swing');
}
// 화살 쏘기 (여포 하마 스킬2): 3회 일제 사격 x 3발(관통). 한 발 피해 = 청룡참 돌진 타격 x 0.3 (근접하면 9발이 한 마리에 모두 적중 약 청룡참의 1.6배, 멀리서는 한 발씩 3발 약 0.6배, 쿨타임 7초)
const S2_ARROW_MULT = 0.3;
function fireArrows() {
  const tg = nearest(900); if (tg) P.face = angTo(P, tg);
  for (const off of [-0.18, 0, 0.18]) { const ang = P.face + off; projectiles.push({ x: P.x + Math.cos(P.face) * 30, y: P.y - 14 + Math.sin(P.face) * 30, vx: Math.cos(ang) * 950, vy: Math.sin(ang) * 950, dmg: P.atk * 2.4 * SKILL_DMG_MULT * S2_ARROW_MULT * HERO.bal.s2, life: ARROW_LIFE, r: 12, arrow: true, friendly: true, hit: new Set() }); }
  sparks(P.x + Math.cos(P.face) * 30, P.y - 14, 4, '#f2e7c9', 200, 0.25); sfx('swing');
}
// 적토 돌격 (보스 여포의 돌격과 같은 방식): 조준(선딜) -> 일직선 질주를 3연속, 횟수가 갈수록 선딜이 짧고 속도가 빨라진다. 질주마다 매번 다시 적을 조준.
//  질주 중 닿은 적에게 청룡참 돌진과 같은 피해, 마지막 질주 끝에서 폭발. 시전 중 슈퍼아머. (3회 합계 피해 = 청룡참 x 약 2.4, 쿨타임 2.5배)
const RUSH_LEN = 460;   // 질주 한 번의 길이
const RUSH_SPECS = {
  one: { n: 1, wind: [0.35], dash: [0.30], w: 55, dmg: 2.4, mult: 1, stun: 0, blastR: S2_BLAST, kb: 700 * 2, blastKb: 350 * S2_KB_MULT * 2 },   // 돌격: 밀쳐내기 2배 (질주 700 -> 1400, 폭발 1050 -> 2100)   // 돌격 (스킬2): 질주 1회 + 폭발
  zhao: { n: 1, inv: true, wind: [0.22], dash: [0.18], w: 60, dmg: 2.4, mult: 1, stun: 0, blastR: 240, kb: 800, blastKb: 900 },   // 조운 단기필마: 선딜이 짧고 폭이 좁은 돌격 + 작은 폭발
  three: { n: 3, wind: [0.35, 0.28, 0.23], dash: [0.30, 0.24, 0.20], w: 90, dmg: 2.17, mult: ULT_DMG_MULT, stun: 2.2, invul: true, blastR: 280, kb: 700 * 3, blastKb: 350 * S2_KB_MULT * 3 },   // 적토 돌격: 밀쳐내기 3배 (질주 700 -> 2100, 폭발 1050 -> 3150)
  // 적토 돌격 (궁극기): 5연속, 무적, 적 기절. 질주 5번 합계 = 이전 3연속과 동일 (2.17 x 3 = 6.5, 한 번 = 1.3). 질주마다 시작 때 슬로 모션 (RUSH_SLOW x 5 = 기존 궁극기 슬로우 총 시간)
};
function streak(x, y, ang, len, w, dur, color) { fx.push({ k: 'streak', x, y, ang, len, w, t: 0, dur, color }); }   // 속도선 (월드 좌표, ang 방향으로 len 만큼 뻗음)
function rushAim(m) { const tg = nearest(720); if (tg) P.face = angTo(P, tg); else if (Math.hypot(m.mx, m.my) > 0.2) P.face = Math.atan2(m.my, m.mx); }
function startRush(m, sp) { P.act = { type: 'rush', t: 0, dur: 99, n: 0, ph: 'wind', pt: 0, set: new Set(), sp, invul: !!sp.invul }; rushAim(m); if (sp.invul && mode !== 'duel') slowT = Math.max(slowT, RUSH_SLOW); }
// 태그: id 영웅으로 즉시 교체 (HP·분노·HIT 는 공유, 스킬1·2 쿨타임은 영웅별로 보관). 교체 직후 0.55초 무적 + 태그 스킬
// forced = 전투 불능으로 강제 교체 (쿨타임·상태 제한 무시)
function tryTag(id, forced) {
  const a = P.act;
  if (state !== 'play' || id === HERO.pc || mode === 'duel') return false;   // 비무장 모드: 태그 없음
  if (!forced) {
    if (P.tagCd > 0 || P.hpStore[id] <= 0) return false;   // 재사용 대기 중이거나 전투 불능인 영웅으로는 교체 불가
    if (a && (a.type === 'ult' || a.type === 'stun' || a.invul)) return false;   // 궁극기·스턴·무적 연출 중에는 교체 불가
  }
  P.hpStore[HERO.pc] = P.hp; P.hp = P.hpStore[id];   // 영웅별 생명력: 나가는 영웅의 체력을 보관하고 들어오는 영웅의 체력을 불러옴
  P.cdStore[HERO.pc] = { s1: P.cd.s1, s2: P.cd.s2 };
  HERO = heroDef(id); curHero = id; applyLabels();
  const st = P.cdStore[id] || { s1: 0, s2: 0 }; P.cd.s1 = st.s1; P.cd.s2 = st.s2;
  P.combo = 0; P.comboT = 0; P.runT = 0; P.runBuffT = 0; P.guardT = 0; P.ultGuardT = 0; P.postUltT = 0; P.comboBuffT = 0; P.aspdT = 0; P.undyT = 0; P.floorT = 0; P.hitTier = comboTier();   // 영웅 고유 버프 초기화
  P.tagCd = forced ? Math.max(P.tagCd, 2) : TAG_CD * (1 - RUN.tag);
  const tg = nearest(600); if (tg) P.face = angTo(P, tg);
  P.act = { type: 'tag', id: HERO.id, t: 0, dur: 0.55, invul: true, set: new Set(), done: false };
  tagFx = { t: 0, dur: 1.1, id: HERO.id }; slowT = Math.max(slowT, TAG_SLOW);   // 모든 태그 스킬: 일괄 슬로우 모션 (실시간 1초 동안 시간 0.3배) + 이름 연출
  ring(P.x, P.y, 90, 0.35, HERO.ult.a, 8); ring(P.x, P.y, 160, 0.5, HERO.ult.a, 5); sparks(P.x, P.y - 20, 30, HERO.ult.a, 700, 0.6); sfx('skill'); flashT = Math.max(flashT, 0.12);
  if (TUT) tutEvent('tag');
  return true;
}
const FORM_SLOW = ULT_SLOW;   // 폼 전환 슬로 모션(실시간 초)
const FORM_SLASH_R = 185, FORM_SLASH_MULT = 1.2;   // 폼 전환 360° 베기: 반경(관우 3단과 같음) / 피해 배율(1단 찌르기와 같음)
function formSlash(u, H, isP) {   // 상마 <-> 하마 전환 때 몸 주위를 한 바퀴 베는 1회 베기 (플레이어·AI 공통)
  arcFx(u.x, u.y, u.face, FORM_SLASH_R, 1.5, 0.25, H.fx.a, 1); arcFx(u.x, u.y, u.face + Math.PI, FORM_SLASH_R, 1.5, 0.25, H.fx.a, 1); ring(u.x, u.y, FORM_SLASH_R, 0.3, H.ult.a, 7); sparks(u.x, u.y - 10, 16, H.ult.a, 520, 0.4); sfx('swing'); if (isP || dist(u, P) < 700) doShake(6);
  if (isP) doArc(FORM_SLASH_R, Math.PI, P.atk * FORM_SLASH_MULT * H.bal.a, { kb: 300, rec: 1 }); else arcHit(u, FORM_SLASH_R, Math.PI, u.atk * FORM_SLASH_MULT * H.bal.a, { kb: 300 });
}
function doFormSwitch() {   // 여포 K 스킬: 상마 <-> 하마 (체력·분노·HIT 유지, 스킬2 쿨타임은 폼별로 따로 흐름)
  const to = HERO.id === 'lubu' ? 'lubu2' : 'lubu';
  P.s2Store[HERO.id] = P.cd.s2; LUBU_FORM = to; HERO = HEROES[to]; applyLabels();
  P.cd.s2 = P.s2Store[to] || 0; P.combo = 0; P.comboT = 0; P.hitTier = comboTier();
  ring(P.x, P.y, 110, 0.4, HERO.ult.a, 10); ring(P.x, P.y, 170, 0.5, '#fff', 6); sparks(P.x, P.y - 20, 26, HERO.ult.a, 600, 0.5); sfx('skill');
  if (mode !== 'duel') slowT = Math.max(slowT, FORM_SLOW);   // 전환할 때 짧은 슬로 모션 (상마·하마 공통)
  dmgText(P.x, P.y - 100, to === 'lubu' ? '상마 전환' : '하마 전환', HERO.ult.a, 26);
}
// 조작 중인 영웅이 쓰러졌을 때: 다른 영웅 중 생명력이 남은 영웅이 있으면 강제 교체(전투 불능 처리), 없으면 패배
function downToTag() {
  if (RAID) return false;   // 레이드: 태그 없음 (동료가 남았으면 관전, 모두 쓰러지면 패배)
  let best = null, bh = 0;
  for (const id of TEAM) if (id !== HERO.pc && P.hpStore[id] > bh) { bh = P.hpStore[id]; best = id; }
  if (!best) return false;
  P.hp = 0; return tryTag(best, true);
}
// ===== 조운 백룡강림: 범위 안의 적(최대 5명)을 고속으로 오가며 연속 찌르기. 찌르는 동안만 적과 충돌 판정 없이 이동하고 무적 =====
let ZU_H = 5;
const ZU_WIND = 0.4, ZU_IV = 0.065, ZU_H0 = 5, ZU_MAX = 7, ZU_STAND = 85, ZU_BLOCK = 1, ZU_SLOW = 0.08;   // 준비 시간 / 찌르기 한 번 간격 / 대상당 찌르기 수 / 최대 대상 수 / 적과의 거리 / 한 대상에게 연속으로 찌르는 수
// ===== 여포(하마) 천하무쌍: 방천화극을 크게 360° 휘두른 뒤, 검기가 휘몰아쳐 범위 안을 연타. 피해 합계는 이전 궁극기 한 방과 같음 (휘두르기 30% + 검기 12연타 70%) =====
let LU_N = 12, LU_END = 2.25;
const LU_WIND = 0.35, LU_SWING = 0.45, LU_TICK0 = 0.9, LU_N0 = 12, LU_IV = 0.1, LU_SHARE = 0.3;   // 준비 / 휘두르기 시간 / 검기 시작 / 검기 횟수 / 간격 / 전체 길이 / 휘두르기 피해 비율
function lultAng(t, face) {   // 방천화극의 각도: 치켜들기 -> 360° 휘두르기 -> 검기를 일으키며 계속 회전
  if (t < LU_WIND) return { ang: -Math.PI / 2, len: 140 };
  if (t < LU_WIND + LU_SWING) { const p = (t - LU_WIND) / LU_SWING; return { ang: face + p * p * (3 - 2 * p) * TAU, len: 180 }; }
  return { ang: face + (t - LU_WIND - LU_SWING) * 16, len: 150 };
}
function lultStep(u, a, H, hitFn) {   // 한 프레임 진행. 끝나면 true. hitFn(피해 비율, 옵션) = 범위 안 전원에게 피해
  const t = a.t, QC = ['#ff7a3a', '#ffd27a', '#ffffff'];
  if (t < LU_WIND) {
    if (Math.random() < 0.8) { const ang = rand(0, TAU), sx = u.x + Math.cos(ang) * 230, sy = u.y + Math.sin(ang) * 170, tx = u.x, ty = u.y - H.ult.tipH, l = Math.hypot(tx - sx, ty - sy); fx.push({ k: 'spark', x: sx, y: sy, vx: (tx - sx) / l * 520, vy: (ty - sy) / l * 520, t: 0, dur: 0.4, color: H.ult.a, sz: 5 }); }
  } else if (t < LU_WIND + LU_SWING) {
    if (!a.s0) { a.s0 = 1; sfx('boom'); flashT = Math.max(flashT, 0.15); ring(u.x, u.y, 120, 0.3, H.ult.a, 8); if (u === P && mode !== 'duel') slowT = Math.max(slowT, ULT_SLOW); }
    if (a.tr == null || t - a.tr > 0.04) { a.tr = t; const an = lultAng(t, u.face).ang; arcFx(u.x, u.y, an, 300, 0.32, 0.22, '#ffd27a', 1); sparks(u.x + Math.cos(an) * 150, u.y + Math.sin(an) * 110, 3, '#ff9a4a', 380, 0.3); }
  }
  if (t >= LU_WIND + LU_SWING * 0.55 && !a.hit0) {   // 휘두르기 적중: 전방위 + 기절
    a.hit0 = 1; doShake(24); hitstop = Math.max(hitstop, 0.12); sfx('boom');
    arcFx(u.x, u.y, u.face, ULT_RADIUS, 1.5, 0.35, H.fx.a, 1); arcFx(u.x, u.y, u.face + Math.PI, ULT_RADIUS, 1.5, 0.35, H.fx.a, 1);
    ring(u.x, u.y, ULT_RADIUS, 0.5, H.ult.a, 16); ring(u.x, u.y, 200, 0.4, '#fff', 9); sparks(u.x, u.y - 10, 40, H.ult.a, 800, 0.7);
    hitFn(LU_SHARE, { kb: 800, stun: 2.2, shake: 10, stop: 0.08 });
  }
  if (t >= LU_TICK0) {   // 검기 연타: 몸 주위로 휘몰아치는 검기 + 범위 안 연속 피해 (기절 유지)
    a.k = a.k || 0; const idx = Math.min(LU_N - 1, Math.floor((t - LU_TICK0) / LU_IV));
    while (a.k <= idx) {
      const j = a.k++, base = j * 0.9;
      for (let m = 0; m < 3; m++) arcFx(u.x, u.y, base + m * TAU / 3, 130 + ((j + m) % 4) * 60, 0.55, 0.3, QC[m], j % 2 ? 1 : -1);
      for (let m = 0; m < 2; m++) { const an = rand(0, TAU), rr = rand(60, ULT_RADIUS); fx.push({ k: 'fire', x: u.x + Math.cos(an) * rr, y: u.y + Math.sin(an) * rr * 0.75, r: rand(16, 28), t: 0, dur: rand(0.3, 0.5) }); }
      sparks(u.x, u.y - 10, 6, QC[j % 3], 520, 0.4); if (u === P || dist(u, P) < 700) doShake(4); if (j % 2 === 0) sfx('swing');
      hitFn((1 - LU_SHARE) / LU_N0, { kb: 60, stun: 0.7, shake: 2 });
    }
  }
  return t >= LU_END;
}
// ===== 고유 성장 적용: 계정의 영웅 레벨에 따라 스킬 피해·공격 횟수·버프 수치를 실제 값에 반영 (로그라이크·비무장 공통, 같은 영웅은 아군·적군 모두 같은 레벨) =====
let GUAN_S1_N = 3, GUAN_S1_TIMES = [0.12, 0.27, 0.42], SHOOT_N = 3, SHOOT_TIMES = [0.1, 0.22, 0.34];
// ===== 초선 (힐러): 연꽃 치유(K) · 월하 축복(L) · 경국지색(;) =====
//  회복량 = 대상 최대 생명력의 %. 로그라이크는 조작 영웅 + 대기 중인 동료 전원, 비무장은 범위 안의 같은 팀(자신 포함). 쓰러진 영웅은 되살리지 못함.
//  비무장은 체력이 5배라 회복량이 너무 커지지 않도록 DUEL_HEAL_MUL 을 곱한다. 월하 축복은 팀 버프(blessT)라 태그·조작 변경을 해도 남는다.
const HEAL_R = 380, LOTUS_DMG_R = 300, ULT_HEAL_R = 460, BLESS_DUR = 10, DIAO_HEAL = { pulse: 0.04, ult: 0.25, combo: 0.015, tag: 0.08 };
let DUEL_HEAL_MUL = 0.43, DUEL_HEAL_OTHER = 0.12;   // 비무장 회복량 배율: 자기 자신 / 다른 아군 (여럿을 한꺼번에 치유하는 이점을 줄여 팀 승률을 맞춤)
let DIAO_S1_N = 3, DIAO_S1_TIMES = [0.12, 0.30, 0.48], HEAL_POW = 1, ULT_HEAL_POW = 1, BLESS_ATK = 0.1, BLESS_DEF = 0.1;
const DIAO_S1_DUR = () => DIAO_S1_TIMES[DIAO_S1_TIMES.length - 1] + 0.3;
const healMul = () => mode === 'duel' ? DUEL_HEAL_MUL : 1;
const sideAlly = u => u === P || u.team === 'ally';
function teamOf(u) { return sideAlly(u) ? [...(P.dead ? [] : [P]), ...allies.filter(a => !a.dead)] : enemies.filter(e => e.fighter && !e.dead && e.spawnT <= 0); }   // u 와 같은 편의 살아있는 유닛
function healUnit(src, u, pct) {   // u 의 최대 생명력의 pct 만큼 회복 (쓰러진 유닛 제외). 실제 회복량 반환
  const mx = u.maxhp, before = u.hp; if (u.dead || before <= 0) return 0;
  u.hp = Math.max(before, Math.min(mx, before + mx * pct * (mode === 'duel' && u !== src ? DUEL_HEAL_OTHER : healMul()))); const got = u.hp - before;
  if (got > 0.5) { if (mode === 'duel') recHeal(src, u, got); else if (mode === 'yeonui' && src === P) RS.dmg[curHero] = (RS.dmg[curHero] || 0) + got; dmgText(u.x, u.y - 84, '+' + Math.round(got), '#7dff9a', 20); sparks(u.x, u.y - 20, 6, '#ffb3d6', 200, 0.5); ring(u.x, u.y, 38, 0.3, '#ff9ac8', 4); }
  return got;
}
function healTeam(src, pct, r) {   // src 의 편: 범위 r 안 유닛 + (로그라이크) 대기 중인 동료 전원
  let n = 0;
  for (const u of teamOf(src)) if (u === src || dist(src, u) <= r + u.r) { if (healUnit(src, u, pct) > 0) n++; }
  if (mode !== 'duel' && src === P) for (const id of TEAM) if (id !== HERO.pc && P.hpStore[id] > 0) { const mx = heroMaxHp(id), b = P.hpStore[id]; P.hpStore[id] = Math.min(mx, b + mx * pct * healMul()); const got = P.hpStore[id] - b; if (got > 0) { n++; if (mode === 'yeonui') RS.dmg[curHero] = (RS.dmg[curHero] || 0) + got; } }
  return n;
}
function lotusWanted(u) {   // 범위 안(대기 동료 포함)에 15% 이상 다친 아군이 있는가
  let need = 0; for (const a of teamOf(u)) if (a === u || dist(u, a) <= HEAL_R + a.r) need = Math.max(need, 1 - a.hp / a.maxhp);
  if (u === P && mode !== 'duel') for (const id of TEAM) if (id !== HERO.pc && P.hpStore[id] > 0) need = Math.max(need, 1 - P.hpStore[id] / heroMaxHp(id));
  return need >= 0.15;
}
const blastAt = (u, r, half, dmg, o) => u === P ? doArc(r, half, dmg, o) : arcHit(u, r, half, dmg, o);
function lotusPulse(u) {   // 연꽃 치유 한 번 (플레이어·AI 공통): 범위 안 아군 회복 + 주변 적에게 약한 피해
  const H = HEROES.diao, isP = u === P, dmg = (isP ? P.atk : u.atk) * 0.85 * SKILL_DMG_MULT * S1_DMG_MULT * H.bal.s1;
  ring(u.x, u.y, HEAL_R * 0.9, 0.5, '#ff9ac8', 6); ring(u.x, u.y, LOTUS_DMG_R * 0.6, 0.35, '#fff', 4); arcFx(u.x, u.y, u.face, LOTUS_DMG_R, 1.5, 0.3, H.fx.s, 1); arcFx(u.x, u.y, u.face + Math.PI, LOTUS_DMG_R, 1.5, 0.3, H.fx.s, 1);
  for (let k = 0; k < 10; k++) { const a = rand(0, TAU), rr = rand(40, LOTUS_DMG_R); fx.push({ k: 'spark', x: u.x + Math.cos(a) * rr, y: u.y + Math.sin(a) * rr * 0.75, vx: rand(-30, 30), vy: rand(-200, -90), t: 0, dur: rand(0.5, 0.9), color: k % 2 ? '#ffb3d6' : '#ffffff', sz: rand(4, 7) }); }
  sfx('heal'); if (isP || dist(u, P) < 700) doShake(3);
  healTeam(u, DIAO_HEAL.pulse * HEAL_POW, HEAL_R);
  blastAt(u, LOTUS_DMG_R, Math.PI, dmg, { kb: 140, rec: 1, shake: 2 });
}
function moonBless(u) {   // 월하 축복: 아군 전체 공격력·방어력 증가 + 주변 적 밀쳐냄
  const H = HEROES.diao, isP = u === P, dmg = (isP ? P.atk : u.atk) * 1.2 * SKILL_DMG_MULT * H.bal.s2;
  for (const a of teamOf(u)) { const was = a.blessT > 0; a.blessT = BLESS_DUR; ring(a.x, a.y, 56, 0.4, '#ffd0e6', 5); if (!was) dmgText(a.x, a.y - 104, '공격·방어 +' + Math.round(BLESS_ATK * 100) + '%', '#ffb3d6', 22); }
  ring(u.x, u.y, 260, 0.5, '#ffe9a0', 10); ring(u.x, u.y, 170, 0.4, '#ff9ac8', 7); sparks(u.x, u.y - 20, 22, '#fff0b0', 520, 0.6); arcFx(u.x, u.y, u.face, 260, 1.5, 0.25, H.fx.a, 1); arcFx(u.x, u.y, u.face + Math.PI, 260, 1.5, 0.25, H.fx.a, 1); sfx('skill'); if (isP || dist(u, P) < 700) doShake(5);
  blastAt(u, 260, Math.PI, dmg, { kb: 520, rec: 2, shake: 4 });
}
function ultHeal(u) { healTeam(u, DIAO_HEAL.ult * ULT_HEAL_POW, ULT_HEAL_R); ring(u.x, u.y, ULT_HEAL_R, 0.7, '#ff9ac8', 12); }   // 경국지색: 큰 회복 (적 기절·피해는 일반 궁극기 처리)
function comboHeal(u) { healTeam(u, DIAO_HEAL.combo * HEAL_POW, HEAL_R); }   // 공격 3단계 성공: 주변 아군 소량 회복
// ===== 전위: 쌍극 투척(K) · 지축 강타(L) · 불사의 광기(;) =====
//  불사의 광기 = 트린다미어의 불사: undy.dur 초 동안 생명력이 1 밑으로 내려가지 않고(죽지 않음), 공격력 +30%·흡혈 25%. 끝나면 보호가 사라진다.
const SLAM_R = 240, BLADE_SPEED = 1100, BLADE_LIFE = 0.58; let DIAN_BLADES = 2;
function throwBlades(u) {   // 쌍철극 투척: 앞쪽 부채꼴로 관통하는 극 DIAN_BLADES 자루 (플레이어·AI 공통)
  const H = HEROES.dian, isP = u === P, tg = isP ? nearest(900) : nearestOpp(u), dmg = (isP ? P.atk : u.atk) * 0.85 * SKILL_DMG_MULT * S1_DMG_MULT * 1.6 * H.bal.s1;
  if (tg) u.face = angTo(u, tg);
  for (let k = 0; k < DIAN_BLADES; k++) {
    const ang = u.face + (k - (DIAN_BLADES - 1) / 2) * 0.22, pr = { x: u.x + Math.cos(u.face) * 30, y: u.y - 14 + Math.sin(u.face) * 30, vx: Math.cos(ang) * BLADE_SPEED, vy: Math.sin(ang) * BLADE_SPEED, dmg, life: BLADE_LIFE, r: 24, arrow: true, blade: true, hit: new Set() };
    if (isP) pr.friendly = true; else { pr.team = u.team; pr.owner = u; }
    projectiles.push(pr);
  }
  sparks(u.x + Math.cos(u.face) * 30, u.y - 14, 6, '#e8ecf4', 260, 0.3); sfx('swing');
}
function slamHit(u) {   // 지축 강타: 내려찍는 충격파 (반경 SLAM_R, 멀리 밀쳐냄)
  const H = HEROES.dian, isP = u === P, dmg = (isP ? P.atk : u.atk) * 3.0 * SKILL_DMG_MULT * H.bal.s2;
  ring(u.x, u.y, SLAM_R, 0.45, '#ffb88a', 14); ring(u.x, u.y, SLAM_R * 0.6, 0.35, '#fff', 8); arcFx(u.x, u.y, u.face, SLAM_R, 1.5, 0.25, H.fx.a, 1); arcFx(u.x, u.y, u.face + Math.PI, SLAM_R, 1.5, 0.25, H.fx.a, 1);
  for (let k = 0; k < 14; k++) { const a = rand(0, TAU), rr = rand(30, SLAM_R); fx.push({ k: 'spark', x: u.x + Math.cos(a) * rr, y: u.y + Math.sin(a) * rr * 0.75, vx: Math.cos(a) * 120, vy: rand(-260, -120), t: 0, dur: rand(0.4, 0.7), color: k % 2 ? '#c9a46a' : '#ffd9b8', sz: rand(4, 8) }); }
  sfx('boom'); if (isP || dist(u, P) < 700) doShake(14);
  blastAt(u, SLAM_R, Math.PI, dmg, { kb: 900, rec: 2, shake: 8 });
}
function rageStart(u) {   // 불사의 광기 발동: 포효 폭발 + 불사 상태 시작
  const H = HEROES.dian, isP = u === P, dmg = (isP ? P.atk : u.atk) * 2.0 * SKILL_DMG_MULT * H.bal.u;
  u.undyT = H.undy.dur; dmgText(u.x, u.y - 110, '불사의 광기!', '#ff6a5a', 28);   // 공격력·흡혈은 시전마다 undy.dur 초
  if (!u.floorUsed) { u.floorUsed = true; u.floorT = H.undy.floor; dmgText(u.x, u.y - 140, '불사 ' + H.undy.floor + '초!', '#ffd34d', 30); }   // 죽지 않는 보호는 전투당 1회, floor 초
  ring(u.x, u.y, 240, 0.6, '#ff4a3a', 16); ring(u.x, u.y, 150, 0.45, '#ffb08a', 10); ring(u.x, u.y, 80, 0.3, '#fff', 6); sparks(u.x, u.y - 20, 36, '#ff7a5a', 760, 0.7); sfx('boom'); flashT = Math.max(flashT, 0.2); if (isP || dist(u, P) < 700) doShake(16);
  blastAt(u, 240, Math.PI, dmg, { kb: 600, rec: 2, shake: 8 });
}
// ===== 황충: 백보천양(K) · 화살비(L) · 마법의 수정화살(;) =====
const SNIPE_SPD = 1400, SNIPE_LIFE = 1.0, RAIN_R = 185, RAIN_T0 = 0.2, RAIN_IV = 0.15, CRYSTAL_SPD = 1500, CRYSTAL_LIFE = 2.0, CRYSTAL_RANGE_REF = 1200; let HUANG_K = 1, RAIN_N = 4, CRYSTAL_STUN_UP = 0;
const RAIN_DUR = () => RAIN_T0 + (RAIN_N - 1) * RAIN_IV + 0.25;   // 화살비 시전 시간(행동 시간)
function arrowStreak(u, len, off) {   // 근접 공격 판정 위치에 화살이 날아가는 연출 (황충의 공격 1~3단)
  const a = u.face + (off || 0); fx.push({ k: 'beam', hid: fxHeroNow, x: u.x + Math.cos(a) * len / 2, y: u.y - 14 + Math.sin(a) * len / 2, ang: a, len: len / 2, w: 9, t: 0, dur: 0.2 }); sparks(u.x + Math.cos(a) * 36, u.y - 14 + Math.sin(a) * 36, 3, '#fff1c8', 220, 0.25); sfx('swing');
}
function areaHit(u, x, y, r, dmg, o) {   // 임의의 지점 (x, y) 반경 r 안의 적에게 피해 (플레이어·AI 공통)
  if (u === P) { for (const e of enemies) if (!e.dead && e.spawnT <= 0 && dist(e, { x, y }) - e.r <= r) hitEnemy(e, dmg, { from: { x, y }, ...o }); }
  else for (const t of oppUnits(u)) if (dist(t, { x, y }) - t.r <= r) dmgUnit(u, t, dmg, o);
}
function sniperShot(u) {   // 백보천양: 긴 사거리의 강궁 — 일직선 관통 (HUANG_K 발)
  const H = HEROES.huang, isP = u === P, tg = isP ? nearest(1400) : nearestOpp(u), dmg = (isP ? P.atk : u.atk) * 0.85 * SKILL_DMG_MULT * S1_DMG_MULT * 3.0 * H.bal.s1;
  if (tg) u.face = angTo(u, tg);
  for (let k = 0; k < HUANG_K; k++) {
    const ang = u.face + (k - (HUANG_K - 1) / 2) * 0.12, pr = { x: u.x + Math.cos(u.face) * 30, y: u.y - 14 + Math.sin(u.face) * 30, vx: Math.cos(ang) * SNIPE_SPD, vy: Math.sin(ang) * SNIPE_SPD, dmg, life: SNIPE_LIFE, r: 16, arrow: true, big: true, hit: new Set(), far: 0.4, farR: 1000, x0: u.x, y0: u.y };
    if (isP) pr.friendly = true; else { pr.team = u.team; pr.owner = u; }
    projectiles.push(pr);
  }
  sparks(u.x + Math.cos(u.face) * 30, u.y - 14, 8, '#fff1c8', 320, 0.3); sfx('swing');
}
function rainZone(u, a) {   // 화살비가 떨어질 지점: 가장 가까운 적의 위치 (없으면 정면 350)
  if (a.rx != null) return; const t = u === P ? nearest(900) : (a.target && !a.target.dead ? a.target : nearestOpp(u));
  a.rx = t ? t.x : u.x + Math.cos(u.face) * 350; a.ry = t ? t.y : u.y + Math.sin(u.face) * 350;
}
function rainPulse(u, a) {   // 화살비 한 번: 구역 안의 적에게 피해 + 위에서 쏟아지는 화살 연출
  rainZone(u, a); const H = HEROES.huang, isP = u === P, dmg = (isP ? P.atk : u.atk) * 0.75 * SKILL_DMG_MULT * 3.0 * H.bal.s2 / 1.0;
  ring(a.rx, a.ry, RAIN_R, 0.35, '#ffe08a', 6);
  for (let k = 0; k < 9; k++) { const ox = rand(-RAIN_R, RAIN_R) * 0.9, oy = rand(-RAIN_R, RAIN_R) * 0.6; streak(a.rx + ox, a.ry + oy - 300, Math.PI / 2, 300, 3, 0.22, k % 2 ? '#fff1c8' : '#ffd27a'); sparks(a.rx + ox, a.ry + oy, 2, '#ffe08a', 200, 0.3); }
  sfx('swing'); if (isP || dist(u, P) < 700) doShake(3);
  areaHit(u, a.rx, a.ry, RAIN_R, dmg, { kb: 80, rec: 1, shake: 2, slow: 1.5 });
}
function crystalFire(u) {   // 마법의 수정화살: 아주 멀리까지 날아가는 거대한 화살 (처음 맞은 적에서 멈춤)
  const H = HEROES.huang, isP = u === P, tg = isP ? nearest(2200) : nearestOpp(u);
  if (tg) u.face = angTo(u, tg);
  const pr = { x: u.x + Math.cos(u.face) * 36, y: u.y - 14 + Math.sin(u.face) * 36, vx: Math.cos(u.face) * CRYSTAL_SPD, vy: Math.sin(u.face) * CRYSTAL_SPD, dmg: (isP ? P.atk : u.atk) * 6.5 * SKILL_DMG_MULT * ULT_DMG_MULT * H.bal.u, life: CRYSTAL_LIFE, r: 36, arrow: true, crystal: true, x0: u.x, y0: u.y, hit: new Set() };
  if (isP) pr.friendly = true; else { pr.team = u.team; pr.owner = u; }
  projectiles.push(pr); ring(u.x, u.y, 90, 0.4, '#9fe8ff', 8); sparks(u.x + Math.cos(u.face) * 36, u.y - 14, 18, '#9fe8ff', 520, 0.5); flashT = Math.max(flashT, 0.15); sfx('boom'); if (isP || dist(u, P) < 700) doShake(8);
}
function crystalImpact(p, u) {   // 맞은 적을 기절 (날아온 거리에 비례: 1초 ~ 3.5초) + 주변 폭발 (피해 40%, 기절 1초)
  const trav = Math.hypot(p.x - p.x0, p.y - p.y0), st = clamp(1.0 + 2.5 * trav / CRYSTAL_RANGE_REF, 1.0, 3.5) * (1 + CRYSTAL_STUN_UP), stun = u.boss ? Math.min(st, 2.0) : st;
  ring(u.x, u.y, 290, 0.5, '#9fe8ff', 14); ring(u.x, u.y, 120, 0.35, '#fff', 8); sparks(u.x, u.y - 20, 40, '#bff2ff', 800, 0.7); sfx('boom'); doShake(14); hitstop = Math.max(hitstop, 0.08); flashT = Math.max(flashT, 0.2);
  dmgText(u.x, u.y - u.r * 3.6, '수정화살 ' + stun.toFixed(1) + '초 기절!', '#bff2ff', 26);
  const foes = p.friendly ? enemies.filter(e => !e.dead && e.spawnT <= 0) : oppUnits({ team: p.team });
  const hit = (t, mult, sd) => { if (p.friendly) hitEnemy(t, p.dmg * mult, { from: P, kb: 220, stun: sd, breakArmor: true, stop: 0.1, shake: 10, rage: 0 }); else dmgUnit(p.owner, t, p.dmg * mult, { kb: 220, stun: sd, rage: 0 }); };
  hit(u, 1, stun); for (const t of foes) if (t !== u && dist(t, u) < 290 + t.r) hit(t, 0.4, 1.0);
}
function crystalStep(p) {   // 수정화살의 충돌 판정: 처음 닿는 적에게서 멈춤
  const foes = p.friendly ? enemies.filter(e => !e.dead && e.spawnT <= 0) : oppUnits({ team: p.team });
  for (const u of foes) if (dist(p, { x: u.x, y: u.y - 14 }) < p.r + u.r) { crystalImpact(p, u); p.life = 0; return; }
  if (Math.random() < 0.6) sparks(p.x, p.y, 1, '#bff2ff', 120, 0.3);
}
const GROW_BASE = { rush: { wind: RUSH_SPECS.three.wind.slice(), dash: RUSH_SPECS.three.dash.slice() } };
