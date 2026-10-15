'use strict';
// ---------- 레이드 보스 그로기 (기획/명세/03) ----------
// 레이드 보스 2종(여포 raidBoss · 전위 dianBoss)에만 적용. 게이지 e.gg(0~100, 단계별 필요량 대비 %), 상태 e.gk('g' 그로기 · 'i' 면역 · null), 남은 시간 e.gT.
// 방장(또는 오프라인)만 계산하고 게스트는 스냅샷 gg/gs 로 받아 그리기만 한다. 상태 이상 점감(drTake)과 무관 (e.drN 을 건드리지 않음).
const GROGGY = {
  raidBoss: { need: [100, 100, 110, 110, 125, 125, 140, 140], dur: [3.5, 3.5, 3.2, 3.2, 3.0, 3.0, 2.6, 2.6] },
  dianBoss: { need: [100, 110, 125, 140, 150], dur: [3.5, 3.2, 3.0, 2.6, 2.4] },
  dmg: 1.5, imm: 6, rec: 0.6,             // 그로기 중 받는 피해 배율 / 종료 후 면역 시간 / 종료 후 후딜
  precise: 10, skill: 6, ult: 20, fin: 2, ai: 0.5,   // 게이지 얻는 양 (AI 동료·AUTO 사람 = x0.5)
};
const isRB = e => !!e && (e.type === 'raidBoss' || e.type === 'dianBoss');
const ggStage = e => e.type === 'dianBoss' ? dStage(e) : raidStage(e);
function ggReset(e) { e.gg = 0; e.gk = null; e.gT = 0; }   // 단계 상승(포효·부하 소환) 때
function ggAdd(e, pts, mul) {
  if (!isRB(e) || e.dead || e.hp <= 0 || e.gk || e.floorT > 0 || e.spawnT > 0) return false;   // 그로기·면역 중, 전위 불사 보호 중에는 불변
  const t = GROGGY[e.type], s = ggStage(e);
  e.gg = Math.min(100, (e.gg || 0) + pts * (mul == null ? 1 : mul) * 100 / t.need[s]);
  if (e.gg >= 100) ggStart(e, t.dur[s]);
  return true;
}
function ggStart(e, dur) {
  e.gk = 'g'; e.gT = e.gD = dur; e.gg = 100; e.state = 'stun'; e.t = 1; e.cur = null; e.lift = 0; e.chainN = 0; RS.groggy = (RS.groggy || 0) + 1;
  dmgText(e.x, e.y - e.r * 3.4, '그로기!', COLORS.gold, 28); ring(e.x, e.y, 200, 0.5, COLORS.gold, 10); ring(e.x, e.y, 110, 0.4, '#fff', 6); sparks(e.x, e.y - e.r, 24, COLORS.gold, 520, 0.7); doShake(8); flashT = Math.max(flashT, 0.08); sfx('skill');
}
function ggTick(e, dt) {   // updateEnemies 에서 레이드 보스마다 매 프레임 (상태 기계보다 먼저)
  if (e.ggTh > 0) e.ggTh -= dt;
  if (e.gk === 'g') {
    e.state = 'stun'; e.t = 1; e.cur = null; e.gT -= dt;   // 기절 상태를 유지 (다른 스턴이 와도 그로기 시간이 우선)
    if (e.gT <= 0) { e.gk = 'i'; e.gT = GROGGY.imm; e.gg = 0; e.state = 'recover'; e.cur = { recover: GROGGY.rec, cd: 0.4 }; e.t = 0; }
  } else if (e.gk === 'i') { e.gT -= dt; if (e.gT <= 0) { e.gk = null; e.gT = 0; } }
}
// 정밀 회피: u 가 대시 무적으로 보스 src 의 공격 판정을 피한 순간 (보스 공격 모션·연속 베기 한 타당 1회)
function ggPrecise(src, u, hum) {
  const k = src.cur; if (!isRB(src) || !k || src.gk) return;
  const s = k.step || 0; if (src.ggPm === k && src.ggPs === s) return; src.ggPm = k; src.ggPs = s;
  if (ggAdd(src, GROGGY.precise, hum ? 1 : GROGGY.ai)) { dmgText(u.x, u.y - 100, '정밀 회피!', '#7fd0ff', 24); ring(u.x, u.y, 70, 0.3, '#7fd0ff', 5); sparks(u.x, u.y - 20, 8, '#bfe8ff', 260, 0.35); }
}
// 적중으로 얻기: 스킬 1·2 = +6 (시전당 1회) · 궁극기 = +20 (시전당 1회) · 3단 마무리 = +2. hitEnemy 가 레이드 보스를 맞힐 때 부른다.
const GG_ULT = ['ult', 'zult', 'lult', 'rage', 'crystal'];
function ggFromHit(e, o) {
  let a, kind, mul = 1;
  if (o.ai) {
    const f = o.by; if (!f) return; a = f.act; const nm = a && a.def.name;
    if (!(f.human && !netAuto(f))) mul = GROGGY.ai;
    kind = !a ? 'skill' : nm === 'atk' ? (a.def.ev[0] && a.def.ev[0].stg === 2 ? 'fin' : null) : GG_ULT.includes(nm) || (nm === 'rush' && a.def.invul) ? 'ult' : nm === 'dodge' ? null : 'skill';
  } else {
    a = P.act; const ty = a && a.type;
    kind = !a ? 'skill' : ty === 'atk' ? (a.c === 2 ? 'fin' : null) : GG_ULT.includes(ty) || (ty === 'rush' && a.invul) ? 'ult' : ty === 'dash' || ty === 'hurt' || ty === 'stun' ? null : 'skill';
  }
  if (!kind) return;
  if (a) { if (a.gg) return; a.gg = true; } else { if (e.ggTh > 0) return; e.ggTh = 0.7; }   // 시전당 1회 (행동이 끝난 뒤 날아온 투사체는 0.7초에 1회)
  ggAdd(e, GROGGY[kind], mul);
}
function drawGroggyBar(b, x, y, w) {   // 보스 체력바 바로 아래 얇은 게이지 (금색 / 그로기 중 남은 시간 / 면역 중 회색)
  const g = b.gk, h = 5; let f = (b.gg || 0) / 100, col = COLORS.goldTrim;
  if (g === 'g') { f = b.gT / (b.gD || b.gT || 1); col = Math.floor(T * 8) % 2 ? COLORS.gold : '#fff'; } else if (g === 'i') { f = b.gT / GROGGY.imm; col = COLORS.silverOff; }
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.fillStyle = 'rgba(40,36,24,.9)'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x, y, w * clamp(f, 0, 1), h); ctx.strokeStyle = g === 'i' ? COLORS.silverOff : COLORS.goldTrim; ctx.lineWidth = 1; ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
  if (g) text(g === 'g' ? '그로기' : '면역', x + w + 8, y + 7, 11, g === 'g' ? COLORS.gold : COLORS.silverOff, 'left');
}
