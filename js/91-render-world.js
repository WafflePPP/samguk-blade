'use strict';
// ===================================================================
// 렌더링
// ===================================================================
function circ(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
// 청룡언월도(glaive)·방천화극(halberd): 손잡이를 원점, 무기 방향을 +x 로 놓고 그린다. L = 무기 길이
//  청룡언월도: 갈색 자루 + 금장 마개, 금빛 용머리(입에서 칼이 나옴), 위로 휘는 검청록 칼날(윗날 은빛 날, 밑동 가시, 금색 물결 문양)
//  방천화극: 검은 자루 + 은빛 긴 창날, 사각 틀로 고정된 대칭 초승달 날(월아) 한 쌍
// 조운의 창: 어두운 자루 + 금장 마디, 나뭇잎 모양 은빛 창날, 창날 아래 보라색 술
function drawLance(x, y, ang, L) {
  const k = v => v * L;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#34363e'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(k(-0.3), 0); ctx.lineTo(k(1.02), 0); ctx.stroke();
  ctx.strokeStyle = '#6b6f7a'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(k(-0.28), -1.3); ctx.lineTo(k(1.0), -1.3); ctx.stroke();
  ctx.fillStyle = '#c8aa4a'; for (const v of [0.18, 0.52]) ctx.fillRect(k(v), -3.4, k(0.03), 6.8);
  ctx.fillStyle = '#6a58b8'; ctx.strokeStyle = '#463a86'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(k(0.97), 0); ctx.bezierCurveTo(k(0.86), -k(0.13), k(0.7), -k(0.04), k(0.62), k(0.08)); ctx.bezierCurveTo(k(0.74), k(0.11), k(0.87), k(0.1), k(0.97), k(0.02)); ctx.closePath(); ctx.fill(); ctx.stroke();   // 보라 술
  ctx.fillStyle = '#c8aa4a'; ctx.fillRect(k(0.94), -4, k(0.05), 8);
  const g = ctx.createLinearGradient(0, -k(0.07), 0, k(0.07)); g.addColorStop(0, '#f3f5f8'); g.addColorStop(0.5, '#b4bac5'); g.addColorStop(1, '#7c828f');
  ctx.fillStyle = g; ctx.strokeStyle = '#4a4f5a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(k(1.0), 0); ctx.quadraticCurveTo(k(1.12), -k(0.085), k(1.5), 0); ctx.quadraticCurveTo(k(1.12), k(0.085), k(1.0), 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(k(1.04), 0); ctx.lineTo(k(1.44), 0); ctx.stroke();
  ctx.restore();
}
function drawPolearm(kind, x, y, ang, L) {
  if (kind === 'lance') { drawLance(x, y, ang, L); return; }
  const gl = kind === 'glaive', k = v => v * L;
  const gold = '#f0b323', goldDk = '#a8760f';
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (gl) {
    // 자루
    ctx.strokeStyle = '#4b2f14'; ctx.lineWidth = 5.5; ctx.beginPath(); ctx.moveTo(k(-0.21), 0); ctx.lineTo(k(0.64), 0); ctx.stroke();
    ctx.strokeStyle = '#7b5230'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(k(-0.2), -1.4); ctx.lineTo(k(0.62), -1.4); ctx.stroke();
    ctx.fillStyle = gold; ctx.strokeStyle = goldDk; ctx.lineWidth = 1; ctx.beginPath(); ctx.rect(k(-0.255), -3.8, k(0.045), 7.6); ctx.fill(); ctx.stroke();   // 끝 금장 마개
    // 칼날 (등: 축에 가까운 아랫면, 날: 위로 불룩한 윗면 = -y 쪽)
    const g = ctx.createLinearGradient(k(0.74), k(-0.3), k(1.25), k(0)); g.addColorStop(0, '#41624d'); g.addColorStop(0.6, '#25402f'); g.addColorStop(1, '#1b2f23');
    ctx.fillStyle = g; ctx.strokeStyle = '#122019'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(k(0.74), k(0.008)); ctx.quadraticCurveTo(k(1.05), k(0.03), k(1.38), k(-0.1)); ctx.quadraticCurveTo(k(1.12), k(-0.31), k(0.8), k(-0.17)); ctx.quadraticCurveTo(k(0.76), k(-0.1), k(0.74), k(-0.03)); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#27422f'; ctx.strokeStyle = '#122019'; ctx.beginPath(); ctx.moveTo(k(0.865), k(-0.193)); ctx.lineTo(k(1.06), k(-0.37)); ctx.lineTo(k(0.95), k(-0.222)); ctx.closePath(); ctx.fill(); ctx.stroke();   // 밑동 가시
    ctx.strokeStyle = '#dfe3e8'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(k(1.38), k(-0.1)); ctx.quadraticCurveTo(k(1.12), k(-0.31), k(0.8), k(-0.17)); ctx.stroke();   // 윗날(은빛 날 선)
    ctx.strokeStyle = '#f2b01e'; ctx.lineWidth = 2.2;   // 금색 용 문양(물결)
    ctx.beginPath(); ctx.moveTo(k(0.82), k(-0.025)); ctx.bezierCurveTo(k(0.92), k(-0.1), k(1.0), k(0.0), k(1.12), k(-0.08)); ctx.bezierCurveTo(k(1.17), k(-0.115), k(1.22), k(-0.1), k(1.27), k(-0.12)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(k(0.88), k(-0.1)); ctx.bezierCurveTo(k(0.96), k(-0.16), k(1.03), k(-0.07), k(1.13), k(-0.15)); ctx.stroke();
    // 용머리 + 목 장식 고리
    ctx.fillStyle = gold; ctx.strokeStyle = goldDk; ctx.lineWidth = 1;
    for (const v of [0.545, 0.585, 0.625]) { ctx.beginPath(); ctx.rect(k(v), k(-0.045), k(0.026), k(0.09)); ctx.fill(); ctx.stroke(); }
    for (const [mx, my, tx, ty] of [[0.64, -0.06, 0.65, -0.14], [0.68, -0.075, 0.7, -0.155], [0.72, -0.075, 0.76, -0.14]]) { ctx.beginPath(); ctx.moveTo(k(mx), k(my)); ctx.lineTo(k(tx), k(ty)); ctx.lineTo(k(mx + 0.045), k(my + 0.005)); ctx.closePath(); ctx.fill(); ctx.stroke(); }   // 갈기
    ctx.beginPath(); ctx.moveTo(k(0.66), k(-0.05)); ctx.quadraticCurveTo(k(0.7), k(-0.092), k(0.78), k(-0.07)); ctx.lineTo(k(0.845), k(-0.04)); ctx.lineTo(k(0.8), k(-0.012)); ctx.lineTo(k(0.72), k(-0.01)); ctx.lineTo(k(0.66), k(-0.02)); ctx.closePath(); ctx.fill(); ctx.stroke();   // 위턱
    ctx.fillStyle = '#d99a14'; ctx.beginPath(); ctx.moveTo(k(0.66), k(0.02)); ctx.lineTo(k(0.72), k(0.012)); ctx.lineTo(k(0.79), k(0.02)); ctx.lineTo(k(0.83), k(0.05)); ctx.lineTo(k(0.77), k(0.06)); ctx.lineTo(k(0.7), k(0.055)); ctx.lineTo(k(0.66), k(0.045)); ctx.closePath(); ctx.fill(); ctx.stroke();   // 아래턱
    ctx.fillStyle = '#fff'; for (const v of [0.745, 0.785]) { ctx.beginPath(); ctx.moveTo(k(v), k(-0.012)); ctx.lineTo(k(v + 0.012), k(0.0)); ctx.lineTo(k(v + 0.024), k(-0.012)); ctx.closePath(); ctx.fill(); }   // 송곳니
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(k(0.735), k(-0.052), k(0.014), 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(k(0.74), k(-0.052), k(0.008), 0, TAU); ctx.fill();   // 눈
  } else {
    // 자루 (검정) + 뒤쪽 석점
    ctx.strokeStyle = '#17171c'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(k(-0.22), 0); ctx.lineTo(k(0.8), 0); ctx.stroke();
    ctx.strokeStyle = '#43434d'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(k(-0.2), -1.3); ctx.lineTo(k(0.78), -1.3); ctx.stroke();
    ctx.fillStyle = '#2a2a31'; ctx.beginPath(); ctx.moveTo(k(-0.22), -3); ctx.lineTo(k(-0.32), 0); ctx.lineTo(k(-0.22), 3); ctx.closePath(); ctx.fill();
    const g = ctx.createLinearGradient(0, k(-0.3), 0, k(0.3)); g.addColorStop(0, '#f3f5f8'); g.addColorStop(0.5, '#b4bac5'); g.addColorStop(1, '#7c828f');
    ctx.fillStyle = g; ctx.strokeStyle = '#4a4f5a'; ctx.lineWidth = 1.4;
    // 사각 고정 틀 (자루에서 양쪽 초승달 날로)
    for (const sd of [1, -1]) for (const bx of [0.755, 0.875]) { ctx.beginPath(); ctx.rect(k(bx), sd > 0 ? k(0.03) : k(-0.17), k(0.018), k(0.14)); ctx.fill(); ctx.stroke(); }
    // 초승달 날(월아): 바깥으로 불룩, 뿔 끝은 자루 쪽
    for (const sd of [1, -1]) {
      ctx.beginPath(); ctx.moveTo(k(0.69), sd * k(0.12)); ctx.quadraticCurveTo(k(0.82), sd * k(0.46), k(0.96), sd * k(0.12)); ctx.quadraticCurveTo(k(0.83), sd * k(0.23), k(0.69), sd * k(0.12)); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // 중앙 소켓(고리 마디) + 창날
    ctx.beginPath(); ctx.rect(k(0.72), k(-0.034), k(0.2), k(0.068)); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#4a4f5a'; ctx.lineWidth = 1; for (const v of [0.76, 0.8, 0.84, 0.88]) { ctx.beginPath(); ctx.moveTo(k(v), k(-0.034)); ctx.lineTo(k(v), k(0.034)); ctx.stroke(); }
    ctx.fillStyle = g; ctx.strokeStyle = '#4a4f5a'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(k(0.92), k(-0.032)); ctx.lineTo(k(1.1), k(-0.042)); ctx.lineTo(k(1.36), 0); ctx.lineTo(k(1.1), k(0.042)); ctx.lineTo(k(0.92), k(0.032)); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(k(0.95), 0); ctx.lineTo(k(1.3), 0); ctx.stroke();
  }
  ctx.restore();
}
function drawWeapon(kind, x, y, ang, len, r) {
  if (kind === 'glaive' || kind === 'halberd' || kind === 'lance') { drawPolearm(kind, x, y, ang, len); return; }
  if (kind === 'fan') {   // 초선의 부채: 손잡이 끝에서 부채살이 펼쳐짐
    const fdx = Math.cos(ang), fdy = Math.sin(ang), hl = len * 0.42, hx = x + fdx * hl, hy2 = y + fdy * hl, R = 22; ctx.lineCap = 'round';
    ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(hx, hy2); ctx.stroke();
    ctx.fillStyle = '#ff9ac8'; ctx.beginPath(); ctx.moveTo(hx, hy2); ctx.arc(hx, hy2, R, ang - 0.95, ang + 0.95); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,250,.55)'; ctx.beginPath(); ctx.moveTo(hx, hy2); ctx.arc(hx, hy2, R * 0.55, ang - 0.95, ang + 0.95); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(hx, hy2, R, ang - 0.95, ang + 0.95); ctx.stroke();
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(hx, hy2); ctx.lineTo(hx + Math.cos(ang + k * 0.38) * R, hy2 + Math.sin(ang + k * 0.38) * R); ctx.stroke(); }
    return;
  }
  if (kind === 'twin') {   // 전위의 쌍철극: 양손에 쥔 짧은 월아극 두 자루
    const L2 = len * 0.62; ctx.lineCap = 'round';
    for (const sd of [-1, 1]) {
      const a2 = ang + sd * 0.42, c2 = Math.cos(a2), s2 = Math.sin(a2), n2x = -s2, n2y = c2, bx2 = x + Math.cos(ang + Math.PI / 2) * sd * 7, by2 = y + Math.sin(ang + Math.PI / 2) * sd * 7, tx2 = bx2 + c2 * L2, ty2 = by2 + s2 * L2;
      ctx.strokeStyle = '#3a2a1e'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(bx2 - c2 * 8, by2 - s2 * 8); ctx.lineTo(tx2, ty2); ctx.stroke();
      ctx.fillStyle = '#d6dbe3'; ctx.strokeStyle = '#6b7080'; ctx.lineWidth = 1;
      for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(tx2 - c2 * 10, ty2 - s2 * 10); ctx.quadraticCurveTo(tx2 - c2 * 2 + n2x * sg * 20, ty2 - s2 * 2 + n2y * sg * 20, tx2 + c2 * 12 + n2x * sg * 6, ty2 + s2 * 12 + n2y * sg * 6); ctx.quadraticCurveTo(tx2 + n2x * sg * 9, ty2 + n2y * sg * 9, tx2 - c2 * 10, ty2 - s2 * 10); ctx.fill(); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(tx2 + c2 * 4 + n2x * 3, ty2 + s2 * 4 + n2y * 3); ctx.lineTo(tx2 + c2 * 24, ty2 + s2 * 24); ctx.lineTo(tx2 + c2 * 4 - n2x * 3, ty2 + s2 * 4 - n2y * 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    return;
  }
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  const bx = x - dx * len * 0.22, by = y - dy * len * 0.22, tx = x + dx * len, ty = y + dy * len;
  ctx.lineCap = 'round';
  if (kind === 'bow') {
    ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x + dx * 14, y + dy * 14, r * 1.1, ang - 1.2, ang + 1.2); ctx.stroke();
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + dx * 14 + Math.cos(ang - 1.2) * r * 1.1, y + dy * 14 + Math.sin(ang - 1.2) * r * 1.1); ctx.lineTo(x + dx * 14 + Math.cos(ang + 1.2) * r * 1.1, y + dy * 14 + Math.sin(ang + 1.2) * r * 1.1); ctx.stroke(); return;
  }
  ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = kind === 'glaive' || kind === 'halberd' ? 6 : 5; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.fillStyle = kind === 'glaive' ? '#cfe8ff' : '#d8d8d8';
  const bl = kind === 'glaive' ? len * 0.32 : kind === 'halberd' ? len * 0.26 : len * 0.2;
  ctx.beginPath();
  if (kind === 'glaive') { // 청룡언월도: 넓은 초승달 날
    ctx.moveTo(tx - dx * bl, ty - dy * bl); ctx.quadraticCurveTo(tx + nx * bl * 1.1 - dx * bl * 0.2, ty + ny * bl * 1.1 - dy * bl * 0.2, tx + dx * bl * 0.7, ty + dy * bl * 0.7);
    ctx.quadraticCurveTo(tx + nx * bl * 0.3, ty + ny * bl * 0.3, tx - dx * bl, ty - dy * bl);
  } else if (kind === 'halberd') { // 방천화극: 양날
    ctx.moveTo(tx - dx * bl, ty - dy * bl); ctx.lineTo(tx + dx * bl * 0.9, ty + dy * bl * 0.9); ctx.lineTo(tx - dx * bl * 0.3 + nx * bl * 0.7, ty - dy * bl * 0.3 + ny * bl * 0.7);
    ctx.moveTo(tx - dx * bl, ty - dy * bl); ctx.lineTo(tx - dx * bl * 0.3 - nx * bl * 0.7, ty - dy * bl * 0.3 - ny * bl * 0.7); ctx.lineTo(tx + dx * bl * 0.9, ty + dy * bl * 0.9);
  } else if (kind === 'axe') {
    ctx.moveTo(tx - dx * bl * 0.6, ty - dy * bl * 0.6); ctx.lineTo(tx + nx * bl * 1.1, ty + ny * bl * 1.1); ctx.lineTo(tx + dx * bl * 0.6, ty + dy * bl * 0.6);
  } else { ctx.moveTo(tx - dx * bl, ty - dy * bl); ctx.lineTo(tx + dx * bl * 0.6, ty + dy * bl * 0.6); ctx.lineTo(tx - dx * bl + nx * 4, ty - dy * bl + ny * 4); }
  ctx.fill();
}
// ===== 스킬 동작 보조 애니메이션 (몸통): 예비 동작(웅크림) -> 시전(앞으로 기울며 뻗음) -> 부드러운 복귀. 궁극기는 떠오르며 기를 모았다가 내리꽂는 순간 눌림 =====
//  type: 'swing' (공격·스킬 공통) / 'ult' / 'charge'(태그·축복 등 짧은 기 모으기). t = 행동 시간(플레이어 기준 단위), hitT = 첫 시전 시점
const smooth01 = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
function actAnim(type, t, hitT, face) {
  const o = { tilt: 0, sqx: 1, sqy: 1, offx: 0, offy: 0, bob: 0 }, cf = Math.cos(face), sf = Math.sin(face);
  if (type === 'ult') {
    const up = smooth01(t / 0.5), slam = t >= 0.55 ? 1 - smooth01((t - 0.55) / 0.3) : 0, hold = t < 0.55 ? up : 0;
    o.bob = 9 * hold + Math.sin(t * 18) * 1.2 * hold; o.sqy = 1 + 0.05 * hold - 0.14 * slam; o.sqx = 1 - 0.03 * hold + 0.1 * slam; o.tilt = -cf * 0.1 * hold + cf * 0.12 * slam;
    return o;
  }
  const w = smooth01(t / Math.max(0.06, hitT)), rel = smooth01((t - hitT) / 0.12), back = smooth01((t - hitT - 0.12) / 0.3), c = w * (1 - rel), st = rel * (1 - back);   // c = 웅크림, st = 뻗음
  o.sqy = 1 - 0.07 * c + 0.05 * st; o.sqx = 1 + 0.05 * c - 0.03 * st; o.offx = cf * (-3 * c + 7 * st); o.offy = sf * (-2 * c + 4 * st); o.tilt = cf * (-0.08 * c + 0.16 * st);
  return o;
}
function addAnim(pose, o) { pose.tilt += o.tilt; pose.sqx *= o.sqx; pose.sqy *= o.sqy; pose.offx += o.offx; pose.offy += o.offy; pose.bob += o.bob; }
function smoothAng(o, target) {   // 무기 각도는 프레임당 변화량을 제한해 갑자기 튀지 않게 (빠른 회전 베기는 그대로 통과)
  const dt = clamp(T - (o.wT == null ? T : o.wT), 0, 0.05); o.wT = T;
  if (o.wA == null) o.wA = target;
  else if (dt > 0) { const d = ((target - o.wA + Math.PI) % TAU + TAU) % TAU - Math.PI, m = 45 * dt; o.wA += clamp(d, -m, m); }
  return o.wA;
}
function animPose(mv, mvAng, walk, hitK, hitAng, hitMag, dashing, face, stun) {   // PC(플레이어·AI 영웅) 이동·피격 애니메이션의 몸 변형값
  const o = { tilt: 0, sqx: 1, sqy: 1, offx: 0, offy: 0, bob: 0, wsw: 0 }, ph = Math.sin(walk), ap = Math.abs(ph), m = Math.min(1.2, mv);
  if (m > 0.05) {   // 달리기: 이동 방향으로 기울이고, 걸음마다 좌우로 흔들리며 발이 닿을 때 살짝 눌림
    o.tilt += clamp(Math.cos(mvAng) * 0.15 * m, -0.2, 0.2) + ph * 0.05 * m; o.sqy = 1 - 0.05 * (1 - ap) * m; o.sqx = 1 + 0.04 * (1 - ap) * m;
    o.offx += Math.cos(mvAng) * 3 * m; o.offy += Math.sin(mvAng) * 2 * m; o.bob = ap * (2.5 + 2 * m); o.wsw = ph * 0.2 * m;
  } else { const br = Math.sin(T * 2.4); o.bob = (br + 1) * 0.6; o.sqy = 1 + br * 0.012; }   // 가만히 있을 때: 숨쉬기
  if (dashing) { o.tilt += Math.cos(face) * 0.3; o.offx += Math.cos(face) * 7; o.offy += Math.sin(face) * 4; o.sqx *= 1.1; o.sqy *= 0.94; }
  if (hitK > 0) {   // 피격: 맞은 방향으로 밀리며 위쪽이 뒤로 젖혀졌다가 되돌아오고, 몸이 움찔 눌리며 잠깐 떨림
    const e = hitK, ds = Math.cos(hitAng) >= 0 ? 1 : -1;
    o.tilt += ds * 0.5 * hitMag * e * Math.cos((1 - e) * 6); o.sqy *= 1 - 0.13 * hitMag * e; o.sqx *= 1 + 0.09 * hitMag * e;
    o.offx += Math.cos(hitAng) * 7 * hitMag * e + Math.sin(T * 100) * 2.5 * e; o.offy += Math.sin(hitAng) * 5 * hitMag * e; o.wsw -= 0.9 * hitMag * e;
  }
  if (stun) o.tilt += Math.sin(T * 8) * 0.16;   // 스턴: 휘청거림
  return o;
}
function drawBody(x, y, r, face, o) {
  const cx = Math.cos(face), sy = Math.sin(face), f = o.flash;
  ctx.save(); if (o.alpha != null) ctx.globalAlpha = o.alpha;
  if (!o.noShadow && !shadowOff) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, (o.shY != null ? o.shY : y) + r * 0.35, r * 1.15, r * 0.55, 0, 0, TAU); ctx.fill(); }
  if (o.anim) { const an = o.anim; ctx.translate(x + an.offx, y + an.offy); ctx.rotate(an.tilt); ctx.scale(an.sqx, an.sqy); ctx.translate(-x, -y); }   // 발끝을 축으로 기울이고 눌림
  const by = y - r * 0.9 - (o.bob || 0), hy = by - r * 1.15;
  const wp = o.weapon;
  if (o.flag) {   // 비무장 팀 깃발: 몸 뒤(왼쪽)에 꽂은 깃대와 제비꼬리 깃 — 같은 영웅끼리 맞붙어도 팀이 읽힘
    const px = x - r * 0.95, py0 = by + r * 0.8, py1 = hy - r * 1.2, fw = r * 0.9, fh = r * 1.1, wv = Math.sin(T * 3 + x * 0.01) * r * 0.08;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0c0814'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px, py0); ctx.lineTo(px, py1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px, py1); ctx.lineTo(px + fw, py1 + wv); ctx.lineTo(px + fw * 0.76, py1 + fh * 0.5 + wv); ctx.lineTo(px + fw, py1 + fh + wv); ctx.lineTo(px, py1 + fh); ctx.closePath(); ctx.fillStyle = o.flag; ctx.fill();
    ctx.fillStyle = '#d4a73a'; ctx.fillRect(px, py1, fw * 0.96, fh * 0.25); ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }
  if (wp && sy < 0) drawWeapon(wp.kind, x + cx * r * 0.3 + (wp.dx || 0), by + r * 0.2 + (wp.dy || 0), wp.ang, wp.len, r);
  if (o.longHair) { ctx.fillStyle = f ? '#fff' : '#1e1624'; ctx.beginPath(); ctx.ellipse(x - cx * r * 0.1, hy + r * 1.0, r * 0.72, r * 1.45, 0, 0, TAU); ctx.fill(); }   // 길게 늘어뜨린 머리 (몸 뒤)
  // 몸통
  ctx.fillStyle = f ? '#fff' : o.body; ctx.beginPath(); ctx.ellipse(x, by, r * 0.9, r * 1.15, 0, 0, TAU); ctx.fill();
  if (o.pauldrons) { ctx.fillStyle = f ? '#fff' : o.trim; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + sd * r * 0.82, by - r * 0.45, r * 0.34, r * 0.26, sd * 0.4, 0, TAU); ctx.fill(); } }   // 어깨 갑옷
  if (o.cape) { ctx.fillStyle = f ? '#fff' : o.cape; ctx.beginPath(); ctx.moveTo(x - r * 0.9, by - r * 0.3); ctx.quadraticCurveTo(x - cx * r * 1.4, by + r * 1.6, x, by + r * 1.3); ctx.quadraticCurveTo(x + cx * r * 1.4, by + r * 1.6, x + r * 0.9, by - r * 0.3); ctx.fill(); }
  ctx.fillStyle = f ? '#fff' : o.trim; ctx.fillRect(x - r * 0.88, by + r * 0.05, r * 1.76, r * 0.24);
  if (o.sleeves) { const sw = Math.sin(T * 3) * r * 0.25; ctx.lineCap = 'round'; for (const sd of [-1, 1]) { ctx.strokeStyle = f ? '#fff' : o.sleeves; ctx.lineWidth = r * 0.42; ctx.beginPath(); ctx.moveTo(x + sd * r * 0.85, by - r * 0.35); ctx.quadraticCurveTo(x + sd * r * 1.75, by + r * 0.2 + sw * sd, x + sd * r * 1.4, by + r * 1.35 + sw * sd * 0.5); ctx.stroke(); ctx.strokeStyle = f ? '#fff' : o.trim; ctx.lineWidth = 1.4; ctx.stroke(); } }   // 길게 늘어진 비단 소매 (살랑거림)
  // 머리
  ctx.fillStyle = f ? '#fff' : o.skin; circle(x, hy, r * 0.6);
  if (o.helm) {
    ctx.fillStyle = f ? '#fff' : (o.helmColor || '#1c1c26'); ctx.beginPath(); ctx.arc(x, hy, r * 0.66, Math.PI, TAU); ctx.fill();
    if (o.helmColor) { ctx.fillStyle = f ? '#fff' : o.trim; ctx.fillRect(x - r * 0.66, hy - r * 0.1, r * 1.32, r * 0.1); }   // 투구 테
    if (o.plume) { const q = o.plume; ctx.fillStyle = f ? '#fff' : '#c9302c'; ctx.beginPath(); ctx.moveTo(x - r * 0.14, hy - r * 0.62); ctx.quadraticCurveTo(x - r * 0.55 * q, hy - r * 1.05 * q, x + r * 0.02, hy - r * (0.7 + 0.65 * q)); ctx.quadraticCurveTo(x + r * 0.08, hy - r * 0.95, x + r * 0.16, hy - r * 0.62); ctx.closePath(); ctx.fill(); }   // 붉은 깃털 장식
    if (o.feathers) { ctx.strokeStyle = f ? '#fff' : '#c9302c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - r * 0.3, hy - r * 0.5); ctx.quadraticCurveTo(x - r * 1.2, hy - r * 2.2, x - r * 0.6, hy - r * 2.9); ctx.moveTo(x + r * 0.3, hy - r * 0.5); ctx.quadraticCurveTo(x + r * 1.2, hy - r * 2.2, x + r * 0.6, hy - r * 2.9); ctx.stroke(); }
  }
  if (o.beard) { ctx.fillStyle = f ? '#fff' : (o.beardColor || '#17171b'); ctx.beginPath(); ctx.moveTo(x - r * 0.5, hy + r * 0.1); ctx.quadraticCurveTo(x, hy + r * 1.7, x + r * 0.5, hy + r * 0.1); ctx.quadraticCurveTo(x, hy + r * 0.35, x - r * 0.5, hy + r * 0.1); ctx.fill(); }
  if (o.hair) { ctx.fillStyle = f ? '#fff' : '#2b2433'; ctx.beginPath(); ctx.arc(x, hy - r * 0.04, r * 0.64, Math.PI * 1.0, TAU); ctx.fill(); ctx.strokeStyle = f ? '#fff' : '#2b2433'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - cx * r * 0.2, hy - r * 0.3); ctx.quadraticCurveTo(x - cx * r * 1.1, hy - r * 0.1, x - cx * r * 1.3, hy + r * 0.7); ctx.stroke(); }   // 머리카락 + 뒤로 묶은 머리
  if (o.shield) { ctx.fillStyle = f ? '#fff' : (o.trim || '#9aa7b8'); ctx.strokeStyle = '#1c2230'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x + cx * r * 0.95, by + 2, r * 0.5, r * 1.0, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = f ? '#fff' : '#e8ecf4'; circle(x + cx * r * 0.95, by + 2, r * 0.16); }   // 방패
  if (o.band) { ctx.fillStyle = f ? '#fff' : '#c9cfd8'; ctx.fillRect(x - r * 0.62, hy - r * 0.3, r * 1.24, r * 0.15); ctx.fillStyle = f ? '#fff' : '#3a8be0'; circle(x, hy - r * 0.225, r * 0.1); }   // 머리띠 + 푸른 보석
  if (o.hat) { ctx.fillStyle = f ? '#fff' : '#2a6b44'; ctx.beginPath(); ctx.arc(x, hy - r * 0.1, r * 0.64, Math.PI * 1.02, TAU * 0.999); ctx.fill(); ctx.fillStyle = f ? '#fff' : '#d4a73a'; ctx.fillRect(x - r * 0.64, hy - r * 0.18, r * 1.28, r * 0.12); }
  if (o.wrap) { ctx.fillStyle = f ? '#fff' : '#b3281f'; ctx.beginPath(); ctx.arc(x, hy - r * 0.08, r * 0.68, Math.PI * 0.98, TAU * 1.0 + 0.04); ctx.fill(); const fl = Math.sin(T * 6) * r * 0.15; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + sd * r * 0.5, hy - r * 0.5); ctx.quadraticCurveTo(x + sd * r * 1.5, hy - r * 0.9 + fl, x + sd * r * 1.75, hy - r * 0.2); ctx.quadraticCurveTo(x + sd * r * 1.1, hy - r * 0.5, x + sd * r * 0.4, hy - r * 0.2); ctx.fill(); } }   // 붉은 머리 두건 (펄럭이는 끝자락)
  if (o.hairCap) { ctx.fillStyle = f ? '#fff' : '#1e1624'; ctx.beginPath(); ctx.arc(x, hy - r * 0.04, r * 0.66, Math.PI * 0.95, TAU * 1.0 + 0.05); ctx.fill(); for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + sd * r * 0.6, hy + r * 0.3, r * 0.16, r * 0.55, sd * -0.15, 0, TAU); ctx.fill(); } }   // 앞머리 + 옆머리
  if (o.crown) { ctx.fillStyle = f ? '#fff' : '#ffd34d'; ctx.beginPath(); ctx.moveTo(x - r * 0.5, hy - r * 0.5); ctx.lineTo(x - r * 0.42, hy - r * 1.0); ctx.lineTo(x - r * 0.2, hy - r * 0.72); ctx.lineTo(x, hy - r * 1.14); ctx.lineTo(x + r * 0.2, hy - r * 0.72); ctx.lineTo(x + r * 0.42, hy - r * 1.0); ctx.lineTo(x + r * 0.5, hy - r * 0.5); ctx.closePath(); ctx.fill(); ctx.fillStyle = f ? '#fff' : '#ff4a7a'; circle(x, hy - r * 0.62, r * 0.09); }   // 금관
  if (o.flower) { const fxp = x + r * 0.58, fyp = hy - r * 0.4; ctx.fillStyle = f ? '#fff' : '#ff9ac8'; for (let k = 0; k < 5; k++) { const an = k * TAU / 5 - 1.2; circle(fxp + Math.cos(an) * r * 0.2, fyp + Math.sin(an) * r * 0.2, r * 0.17); } ctx.fillStyle = f ? '#fff' : '#fff0b0'; circle(fxp, fyp, r * 0.1); }   // 분홍 꽃 머리 장식
  ctx.fillStyle = '#111'; for (const s of [-1, 1]) circle(x + s * r * 0.24 + cx * r * 0.14, hy + sy * r * 0.1 + r * 0.02, r * 0.075);
  if (wp && sy >= 0) drawWeapon(wp.kind, x + cx * r * 0.3 + (wp.dx || 0), by + r * 0.2 + (wp.dy || 0), wp.ang, wp.len, r);
  ctx.restore();
}
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }

function playerStyle(alpha, face) {
  const a = P.act; let ang = face + 0.9, len = 105, push = 0;
  if (a) {
    if (a.type === 'atk') {
      const c = comboTable()[a.c], sw = c.swing || 0.24;
      // 현재(또는 직전) 타격에 맞춰 무기를 휘두르는 진행도: 타격 시점을 중심으로 sw 동안 -span ~ +span rad 스윙 (3단계는 한 바퀴)
      let i = 0; while (i + 1 < c.hits.length && a.t >= c.hits[i + 1] - sw * 0.6) i++;
      const p = clamp((a.t - (c.hits[i] - sw * 0.6)) / sw, 0, 1);
      const span = c.span || 1.3;
      ang = face + c.dirs[i] * (-span + 2 * span * p);
      if (a.c === 2) len = 150;
      if (c.thrust) { ang = face; push = 42 * Math.sin(p * Math.PI); }   // 찌르기: 창을 앞으로 내지름
    }
    else if (a.type === 's1') { if (HERO.s1Heal) { ang = face + Math.sin(a.t * 16) * 1.0; } else if (HERO.thrust) { ang = face; const lt = a.hits > 0 ? a.t - [0.12, 0.27, 0.42][a.hits - 1] : 9; push = lt < 0.12 ? 42 * Math.sin(Math.PI * lt / 0.12) : 0; } else if (HERO.s1Flurry) { ang = face; push = 36 * Math.abs(Math.sin(a.t * 40)); } else if (HERO.s1Cone) { const k = Math.min(2, a.hits), hf = CONE_HITS[k].half + 0.2, pp = clamp((a.t - (CONE_TIMES[k] - 0.14)) / 0.18, 0, 1); ang = face + (k % 2 ? -1 : 1) * (-hf + 2 * hf * pp); } else ang = face + a.t * 26; }   // 방천 베기: 좌우로 번갈아 휘두름
   // 방천 강타: 창을 위에서 아래로 내려찍는 동작 반복
   // 십자 찌르기: 정면 -> 대각 -> 정면으로 내지름
    else if (a.type === 'bless') ang = a.t < 0.2 ? -Math.PI / 2 : face + (a.t - 0.2) * 10;
    else if (a.type === 'throw' || a.type === 'snipe' || a.type === 'crystal') ang = face;
    else if (a.type === 'rain') ang = face - 0.5;
    else if (a.type === 'slam') ang = a.t < 0.3 ? -Math.PI / 2 : face;
    else if (a.type === 'rage') ang = a.t < 0.25 ? -Math.PI / 2 : face + (a.t - 0.25) * 6, len = 130;
    else if (a.type === 's2' || a.type === 'rush' || a.type === 'shoot') ang = face;
    else if (a.type === 'tag') ang = a.id === 'lubu' || a.id === 'zhao' ? face : face + a.t * 24;   // 태그 스킬: 상마는 창을 앞으로, 그 외는 크게 휘두름
    else if (a.type === 'ult') ang = a.t < 0.55 ? -Math.PI / 2 : face + (a.t - 0.55) * 8, len = 130;
    else if (a.type === 'lult') { const w = lultAng(a.t, face); ang = w.ang; len = w.len; }
    else if (a.type === 'zult') { ang = a.t < ZU_WIND ? -Math.PI / 2 : face; len = 130; push = a.t < ZU_WIND ? 0 : 40 * Math.abs(Math.sin(a.t * 45)); }
    else if (a.type === 'dash') ang = face + Math.PI - 0.4;
  }
  const pose = animPose(P.mvAmt || 0, P.mvAng || 0, P.walk, (P.hitT || 0) / 0.42, P.hitAng || 0, P.hitMag || 1, pcDashing(a), face, !!(a && a.type === 'stun'));
  if (!a || a.type === 'hurt' || a.type === 'stun') ang += pose.wsw;
  if (a && a.type === 'hurt') { ang = face + 2.0; }   // 피격 중 무기가 뒤로 젖혀짐
  if (a) {   // 스킬 동작 보조 애니메이션
    let ht = null, t = a.t;
    if (a.type === 'atk') ht = comboTable()[a.c].hits[0];
    else if (a.type === 's1') ht = HERO.s1Heal ? DIAO_S1_TIMES[0] : HERO.s1Cone ? CONE_TIMES[0] : HERO.s1Flurry ? FLURRY_TIMES[0] : HERO.thrust ? 0.12 : GUAN_S1_TIMES[0];
    else if (a.type === 's2') ht = 0.1; else if (a.type === 'bless') ht = 0.2; else if (a.type === 'throw') ht = 0.18; else if (a.type === 'snipe') ht = 0.35; else if (a.type === 'rain') ht = 0.2; else if (a.type === 'crystal') ht = 0.5; else if (a.type === 'slam') ht = 0.2; else if (a.type === 'rage') ht = 0.25; else if (a.type === 'shoot') ht = SHOOT_TIMES[0]; else if (a.type === 'switch') ht = 0.2; else if (a.type === 'tag') ht = 0.2;
    else if (a.type === 'rush' && a.ph === 'wind') { ht = a.sp.wind[a.n]; t = a.pt; }
    else if (a.type === 'zult') ht = ZU_WIND; else if (a.type === 'lult') ht = LU_WIND;
    if (a.type === 'ult') addAnim(pose, actAnim('ult', a.t, 0, face)); else if (ht != null) addAnim(pose, actAnim('swing', t, ht, face));
  }
  ang = smoothAng(P, ang);
  return { ...HERO.style, flash: P.flash > 0, alpha, anim: pose, bob: pose.bob, weapon: { kind: a && a.type === 'shoot' ? 'bow' : HERO.style.weapon, ang, len, dx: Math.cos(face) * push, dy: Math.sin(face) * push } };
}
// 영웅 본체 그리기: 보병은 몸만, 기마(여포)는 적토마 + 기수. lift = 말이 솟구친 높이
// PC 아웃라인: 영웅(말·무기 포함)을 오프스크린에 그려 실루엣을 만들고, 바깥으로 OUTLINE_W 만큼 번진 테두리만 남겨서 모든 유닛 위에 덧그림 → 몬스터와 구분되고 몬스터에 가려져도 테두리는 보인다.
const OUTLINE_W = 3, OUTLINE_COLOR = '#ffffff', OUTLINE_ALPHA = 1, OLN = 440;
let shadowOff = false;
const olA = document.createElement('canvas'), olB = document.createElement('canvas'); olA.width = olA.height = olB.width = olB.height = OLN;
function drawPcOutline() {
  const a = olA.getContext('2d'), b = olB.getContext('2d'), main = ctx, px = Math.round(P.x), py = Math.round(P.y), act = P.act;
  a.setTransform(1, 0, 0, 1, 0, 0); a.clearRect(0, 0, OLN, OLN); a.globalAlpha = 1;
  ctx = a; shadowOff = true; a.save(); a.translate(OLN / 2 - px, OLN / 2 - py);
  drawPlayerUnit(P.x, P.y, P.face, playerStyle(1, P.face), 0, pcDashing(act));
  a.restore(); shadowOff = false; ctx = main;
  b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'source-over'; b.clearRect(0, 0, OLN, OLN);
  for (let i = 0; i < 16; i++) { const an = i / 16 * TAU; b.drawImage(olA, Math.cos(an) * OUTLINE_W, Math.sin(an) * OUTLINE_W); }
  b.globalCompositeOperation = 'source-in'; b.fillStyle = OUTLINE_COLOR; b.fillRect(0, 0, OLN, OLN);
  b.globalCompositeOperation = 'destination-out'; b.drawImage(olA, 0, 0); b.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.globalAlpha = OUTLINE_ALPHA * (state === 'lose' ? 0.6 : 1); ctx.drawImage(olB, px - OLN / 2, py - OLN / 2); ctx.restore();
}
function pcDashing(a) { return !!(a && (a.type === 'dash' || a.type === 's2' || (a.type === 'rush' && a.ph === 'dash') || (a.type === 'zult' && a.t >= ZU_WIND) || (a.type === 'tag' && a.id === 'lubu' && a.t >= 0.1 && a.t < 0.3))); }
const lungeEase = p => Math.PI / 2 * Math.sin(Math.PI * clamp(p, 0, 1));   // 속도 곡선: 0 -> 최대 -> 0 (평균 1)
const horseGalloping = (buff, moving) => !!(buff > 0 && moving);   // 여포(상마) 질주 버프 중 이동하면 말이 질주 모션으로 달린다
function drawPlayerUnit(x, y, face, st, lift = 0, dashing = false) {
  if (!HERO.mounted) { drawBody(x, y, P.r, face, st); return; }
  const gal = !dashing && ((HERO.runBonus && horseGalloping(P.runBuffT, !P.act && (P.mvAmt || 0) > 0.2)) || P.lungeT > 0);
  if (gal) lift += Math.abs(Math.sin(T * 11)) * 4;
  drawHorse({ x, y, r: MOUNT_R, face, flash: st.flash ? 1 : 0, state: dashing || gal ? 'dash' : 'chase', walk: P.walk, spawnT: 0, alpha: st.alpha != null ? st.alpha : ctx.globalAlpha, d: HERO.horse }, lift);
  drawBody(x, y - lift - MOUNT_R * 0.6, RIDER_R, face, { ...st, noShadow: true });
}
// 철기병의 말: 몸통·네 다리(보행/질주 애니메이션)·목과 머리·갈기·꼬리·붉은 마갑
function drawHorse(e, lift) {
  const x = e.x, y = e.y - lift, r = e.r, f = e.face, c = Math.cos(f), s = Math.sin(f), fl = e.flash > 0;
  const gallop = e.state === 'dash' ? T * 22 : e.walk * 1.2, coat = fl ? '#fff' : (e.d.horseCoat || '#3a2b24'), dark = fl ? '#fff' : '#1d1614';
  ctx.save(); ctx.globalAlpha = e.alpha != null ? e.alpha : (e.spawnT > 0 ? 1 - e.spawnT / 0.7 : 1);
  if (!shadowOff) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, e.y + r * 0.45, r * 1.6, r * 0.65, 0, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = dark; ctx.lineWidth = r * 0.17; ctx.lineCap = 'round';
  for (const [a, l, ph] of [[0.75, 0.35, 0], [0.75, -0.35, 2.4], [-0.75, 0.35, 3.1], [-0.75, -0.35, 5.5]]) {
    const bx = x + (a * c - l * s) * r, by = y + (a * s + l * c) * r * 0.9 - r * 0.2, sw = Math.sin(gallop + ph) * r * 0.38;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + c * sw, by + r * 0.8 + s * sw * 0.5); ctx.stroke();
  }
  ctx.translate(x, y - r * 0.35); ctx.rotate(f);
  ctx.strokeStyle = dark; ctx.lineWidth = r * 0.16; ctx.beginPath(); ctx.moveTo(-r * 1.3, 0); ctx.quadraticCurveTo(-r * 1.9, Math.sin(T * 8 + e.walk) * r * 0.35, -r * 2.15, r * 0.25 * Math.sin(T * 6)); ctx.stroke();   // 꼬리
  ctx.fillStyle = coat; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.35, r * 0.62, 0, 0, TAU); ctx.fill();                                  // 몸통
  ctx.beginPath(); ctx.moveTo(r * 0.9, -r * 0.25); ctx.quadraticCurveTo(r * 1.5, -r * 0.55, r * 1.75, -r * 0.2); ctx.lineTo(r * 1.7, r * 0.25); ctx.quadraticCurveTo(r * 1.4, r * 0.3, r * 0.9, r * 0.3); ctx.closePath(); ctx.fill();   // 목
  ctx.beginPath(); ctx.ellipse(r * 1.95, 0, r * 0.5, r * 0.27, 0.15, 0, TAU); ctx.fill();                                                // 머리
  ctx.strokeStyle = dark; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.moveTo(r * 0.95, -r * 0.3); ctx.quadraticCurveTo(r * 1.4, -r * 0.62, r * 1.72, -r * 0.26); ctx.stroke();   // 갈기
  ctx.fillStyle = fl ? '#fff' : '#111'; ctx.beginPath(); ctx.arc(r * 2.0, -r * 0.1, r * 0.06, 0, TAU); ctx.fill();                       // 눈
  ctx.fillStyle = fl ? '#fff' : (e.d.barding || '#7a1f26'); ctx.strokeStyle = fl ? '#fff' : '#d4a73a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(-r * 0.25, 0, r * 0.85, r * 0.62, 0, 0, TAU); ctx.fill(); ctx.stroke();   // 마갑
  ctx.restore();
}
function drawEnemyUnit(e, lift) {
  if (e.mounted) { drawHorse(e, lift); const st = enemyStyle(e); st.noShadow = true; drawBody(e.x, e.y - lift - e.r * 0.6, e.d.riderR || e.r * 0.8, e.face, st); }
  else drawBody(e.x, e.y - lift, e.r, e.face, enemyStyle(e));
}
function enemyStyle(e) {
  const d = e.d; let ang = e.face + 0.8, len = e.boss ? 150 : e.type === 'captain' ? 100 : e.type === 'cavalry' ? 115 : 80;
  if (e.state === 'wind' && e.cur) { const p = clamp(e.t / e.cur.windup, 0, 1); ang = e.face - 0.4 - p * 1.2; }
  else if (e.state === 'recover') ang = e.face + 0.6;
  else if (e.state === 'dash') ang = e.face;
  if (e.d.foot) {   // 보스 관우: 청룡언월도를 베기 범위(각도 half · 반경 r)에 맞춰 휘두름 — 선딜에 -half 로 젖히고, 판정 순간 -half -> +half 로 베고, 끝 자세를 잠시 유지
    const c = e.cur, sw = e.swing, cone = c && c.kind === 'cone';
    len = clamp((((e.state === 'wind' && cone) ? c.r : sw ? sw.r : cone ? c.r : 215) - 14) / 1.38, 120, 230);   // 칼끝이 베기 반경에 닿는 길이
    if (sw && sw.t < 0.2) ang = e.face - sw.half + 2 * sw.half * (sw.t / 0.2);
    else if (sw && sw.t < 0.7 && (e.state === 'recover' || e.state === 'pause')) ang = e.face + sw.half;
    else if (e.state === 'wind' && cone) { const p = clamp(e.t / c.windup, 0, 1), from = sw ? sw.half : 0.8; ang = sw && c.half >= 3 ? e.face + Math.PI : e.face + from + p * (-c.half - from); }
    else if (c && c.ult && (e.state === 'wind' || (e.state === 'recover' && e.t < 1.3))) ang = -Math.PI / 2;   // 청룡의 힘: 칼을 높이 치켜듦
  }
  let zpush = 0;
  if (e.d.zhao) { const c = e.cur; ang = c && c.ult && (e.state === 'wind' || (e.state === 'recover' && e.t < 1.3)) ? -Math.PI / 2 : e.face; len = 150; if (e.swing && e.swing.t < 0.2) zpush = 42 * Math.sin(Math.PI * e.swing.t / 0.2); else if (e.state === 'dash') zpush = 30; }   // 조운 보스: 창을 앞으로 내지름
  if (e.type === 'archer') ang = e.face;
  const bow = e.boss && e.cur && e.cur.kind === 'fan' && !e.cur.wave && (e.state === 'wind' || e.state === 'recover' || e.state === 'pause'); if (bow) ang = e.face;
  // 모든 보스(PC 기반 여포·관우·조운 + 몬스터 보스)는 PC 와 같은 몸동작: 걷기·돌진 기울임·스턴 휘청 + 선딜에 웅크렸다가 시전 때 뻗는 동작 + 궁극기는 떠올라 기를 모았다가 내리꽂음 + 무기 각도 보간
  let anim = null, bobv = Math.abs(Math.sin(e.walk)) * 2;
  if (e.boss) {
    anim = animPose(e.state === 'chase' ? 1 : 0, e.face, e.walk, 0, 0, 1, e.state === 'dash', e.face, e.state === 'stun');
    const c = e.cur; let ao = null;
    if (c && e.state === 'wind') ao = c.ult ? actAnim('ult', 0.55 * clamp(e.t / c.windup, 0, 1), 0, e.face) : actAnim('swing', e.t, c.windup, e.face);
    else if (c && (e.state === 'recover' || e.state === 'pause')) ao = c.ult ? actAnim('ult', 0.55 + Math.min(e.t, 1.3) * 0.5, 0, e.face) : actAnim('swing', c.windup + e.t, c.windup, e.face);
    if (ao) addAnim(anim, ao);
    ang = smoothAng(e, ang); bobv = anim.bob;
  }
  return { anim, shY: e.lift > 0 ? e.y : null, body: d.body, trim: d.trim, skin: d.skin, helm: d.helm, helmColor: d.helmColor, plume: d.plume, pauldrons: d.pauldrons, feathers: d.feathers, beard: d.beard, hat: d.hat, hair: d.hair, band: d.band, shield: d.shield, cape: d.cape, flash: e.flash > 0, alpha: e.spawnT > 0 ? 1 - e.spawnT / 0.7 : 1, bob: bobv, weapon: { kind: bow ? 'bow' : d.weapon, ang, len, dx: Math.cos(e.face) * zpush, dy: Math.sin(e.face) * zpush } };
}
// 적토 돌격 선딜: 질주 경로(폭 = 돌진 판정)를 주황색으로 예고
function drawRushTele() {
  const a = P.act; if (!a || a.type !== 'rush' || a.ph !== 'wind') return;
  const sp = a.sp, RW = sp.w, pr = clamp(a.pt / sp.wind[a.n], 0, 1);
  ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.face);
  ctx.fillStyle = `rgba(255,150,80,${0.10 + 0.12 * pr})`; ctx.fillRect(0, -RW, RUSH_LEN, RW * 2);
  ctx.fillStyle = `rgba(255,150,80,${0.22 + 0.3 * pr})`; ctx.fillRect(0, -RW, RUSH_LEN * pr, RW * 2);
  ctx.restore();
}
function drawTele(e) {
  if (e.state !== 'wind' || !e.cur) return;
  if (!e.boss && (e.cur.kind === 'cone' || e.cur.kind === 'circle')) return;   // 일반 몬스터의 근접 공격은 사전 이펙트 없음 (궁수 화살·보스 패턴만 표시)
  const c = e.cur, p = clamp(e.t / c.windup, 0, 1), col = c.color || '255,50,40';
  ctx.save(); ctx.translate(e.x, e.y);
  ctx.fillStyle = `rgba(${col},${0.12 + 0.12 * p})`; ctx.strokeStyle = `rgba(${col},.85)`; ctx.lineWidth = 2;
  const inner = `rgba(${col},${0.25 + 0.3 * p})`;
  if (c.kind === 'circle') { ctx.beginPath(); ctx.arc(0, 0, c.r, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = inner; ctx.beginPath(); ctx.arc(0, 0, c.r * p, 0, TAU); ctx.fill(); }
  else if (c.kind === 'cone') { ctx.rotate(e.face); ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, c.r, -c.half, c.half); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = inner; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, c.r * p, -c.half, c.half); ctx.closePath(); ctx.fill(); }
  else if (c.kind === 'charge') { const tw = e.boss ? c.w : 14; ctx.rotate(e.face); ctx.fillRect(0, -tw / 2, c.len, tw); ctx.strokeRect(0, -tw / 2, c.len, tw); ctx.fillStyle = inner; ctx.fillRect(0, -tw / 2, c.len * p, tw);
    if (c.quakeR) { ctx.fillStyle = `rgba(${col},${0.12 + 0.12 * p})`; ctx.beginPath(); ctx.arc(c.len, 0, c.quakeR, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = inner; ctx.beginPath(); ctx.arc(c.len, 0, c.quakeR * p, 0, TAU); ctx.fill(); } }
  else if (c.kind === 'leap' || c.kind === 'rain') { ctx.translate((c.tx != null ? c.tx : e.x) - e.x, (c.ty != null ? c.ty : e.y) - e.y); ctx.beginPath(); ctx.arc(0, 0, c.r, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = inner; ctx.beginPath(); ctx.arc(0, 0, c.r * p, 0, TAU); ctx.fill(); }
  else if (c.kind === 'fan') { ctx.rotate(e.face); for (let i = 0; i < c.n; i++) { ctx.save(); ctx.rotate((c.shifts ? c.shifts[c.step || 0] : 0) + (i / (c.n - 1) - 0.5) * 2 * c.half); ctx.fillStyle = `rgba(${col},${0.18 + 0.3 * p})`; ctx.fillRect(0, -3, 560, 6); ctx.fillStyle = inner; ctx.fillRect(0, -3, 560 * p, 6); ctx.restore(); } }   // 투창 한 발마다 직선 예고
  else if (c.kind === 'cross') { ctx.rotate(e.face + c.off); for (const r of [0, Math.PI / 2]) { ctx.save(); ctx.rotate(r); ctx.fillStyle = `rgba(${col},${0.12 + 0.12 * p})`; ctx.fillRect(-c.len, -c.w / 2, c.len * 2, c.w); ctx.strokeRect(-c.len, -c.w / 2, c.len * 2, c.w); ctx.fillStyle = inner; ctx.fillRect(-c.len * p, -c.w / 2, c.len * 2 * p, c.w); ctx.restore(); } }
  else if (c.kind === 'arrow') { ctx.rotate(e.face); ctx.fillStyle = `rgba(${col},${0.2 + 0.4 * p})`; ctx.fillRect(0, -4, 560, 8); }
  ctx.restore();
}
// ===== 보스 버프 표시: 생명력바 아래에 지금 보스에게 걸려 있는 강화 효과(단계·피해·시전 속도·연속 패턴·슈퍼아머·웨이브 난이도)를 작은 알약 모양으로 나열 =====
function bossBuffChips(b) {
  const o = []; let st = 0, n = 0, dmg = 1, fast = 1, cdm = 1, chain = 0;
  if (b.d.mb) { st = mbStage(b); n = 3; dmg = MB.dmg[st]; fast = MB.fast[st]; cdm = MB.cd[st]; chain = MB.chain[st]; }
  else if (b.d.zhao) { st = zStage(b); n = 4; dmg = ZB.dmg[st]; fast = ZB.fast[st]; cdm = ZB.cd[st]; chain = ZB.chain[st]; }
  else if (b.d.dian) { st = dStage(b); n = 5; dmg = DB.dmg[st]; fast = DB.fast[st]; cdm = DB.cd[st]; chain = DB.chain[st]; }
  else if (!b.d.foot) { st = bossStage(b); const tb = bossTab(b); n = b.d.raid ? 8 : 6; dmg = tb.dmg[st]; fast = tb.fast[st]; cdm = tb.cd[st]; chain = tb.chain[st]; }
  else { n = 2; st = b.phase2 ? 1 : 0; fast = b.phase2 || b.hp < b.maxhp * 0.5 ? 0.8 : 1; chain = b.phase2 ? 0.45 : 0.30; }
  if (n) o.push({ t: (n === 2 ? (b.phase2 ? '2페이즈' : '1페이즈') : '강화 ' + (st + 1) + '/' + n + '단계'), c: '255,233,160' });
  if (dmg > 1.001) o.push({ t: '피해 +' + Math.round((dmg - 1) * 100) + '%', c: '255,110,100' });
  if (fast < 0.999) o.push({ t: '시전속도 +' + Math.round((1 / fast - 1) * 100) + '%', c: '255,170,80' });
  if (cdm < 0.999) o.push({ t: '스킬 대기 -' + Math.round((1 - cdm) * 100) + '%', c: '255,200,90' });
  if (chain > 0) o.push({ t: '연속 패턴 ' + Math.round(chain * 100) + '%', c: '210,140,255' });
  if (b.armor) o.push({ t: '슈퍼아머', c: '140,190,255' });
  if (hasDR(b)) o.push({ t: '상태 이상 저항', c: '201,160,255' });
  if (b.floorT > 0) o.push({ t: '불사 보호 ' + Math.ceil(b.floorT) + '초', c: '255,205,90' });
  if (b.rageT > 0) o.push({ t: '광폭 ' + Math.ceil(b.rageT) + '초', c: '255,90,74' });
  const w = curWave(); if (w && w.tier != null) o.push({ t: '난이도 ' + (w.tier + 1) + '단계 (체 x' + w.hpMul.toFixed(1) + ' · 피 x' + w.dmgMul.toFixed(1) + ')', c: '160,200,160' });
  return o;
}
// 위 가운데 한 줄 정보: [모드·웨이브] | [보스 이름] [보스 강화·버프 알약] | [처치 · (남은 적) · 시간]
function drawTopInfo(boss) {
  const short = t => t.replace('단계', '').replace('시전속도', '시전').replace('스킬 대기', '대기').replace('연속 패턴', '연속').replace(/^난이도 (\d+)단계.*$/, '난이도 $1').replace(/^강화 /, '강화 ');
  const segs = [];
  segs.push({ k: 'txt', t: RAID ? '레이드' : '로그라이크 W' + (waveIdx + 1) + '/' + WAVES.length, f: '700 14px ' + FONT, c: '#fff' });
  if (boss) {
    segs.push({ k: 'sep' }); segs.push({ k: 'txt', t: boss.d.name, f: '700 15px ' + FONT, c: '#ffe9a0' });
  }
  segs.push({ k: 'sep' });
  const w = curWave(), mm = Math.floor(clock / 60), ss = String(Math.floor(clock % 60)).padStart(2, '0');
  segs.push({ k: 'txt', t: '처치 ' + kills + (w.bossWave ? '' : '  ·  남은 적 ' + (enemies.length + waveLeft())) + '  ·  ' + mm + ':' + ss, f: '600 12px ' + FONT, c: '#cfd3e6' });
  ctx.save(); const gap = 8, h = 18, y = 13;
  for (const sg of segs) { ctx.font = sg.k === 'pill' ? '600 11px ' + FONT : sg.f || '12px ' + FONT; sg.w = sg.k === 'sep' ? 1 : ctx.measureText(sg.t).width + (sg.k === 'pill' ? 12 : 0); }
  const tot = segs.reduce((a, g) => a + g.w, 0) + gap * (segs.length - 1); let x = W / 2 - tot / 2;
  ctx.textBaseline = 'alphabetic';
  for (const sg of segs) {
    if (sg.k === 'sep') { ctx.fillStyle = 'rgba(255,211,77,.55)'; ctx.fillRect(x, y + 1, 1, h - 2); }
    else if (sg.k === 'pill') { ctx.fillStyle = 'rgba(10,12,20,.78)'; ctx.fillRect(x, y, sg.w, h); ctx.strokeStyle = 'rgba(' + sg.c + ',.85)'; ctx.lineWidth = 1.2; ctx.strokeRect(x + 0.5, y + 0.5, sg.w - 1, h - 1); ctx.font = '600 11px ' + FONT; ctx.fillStyle = 'rgb(' + sg.c + ')'; ctx.textAlign = 'center'; ctx.fillText(sg.t, x + sg.w / 2, y + 13); ctx.textAlign = 'left'; }
    else { ctx.font = sg.f; ctx.textAlign = 'left'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(sg.t, x, y + 14); ctx.fillStyle = sg.c; ctx.fillText(sg.t, x, y + 14); }
    x += sg.w + gap;
  }
  ctx.restore();
  if (boss) {   // 2번째 줄: 보스가 받은 디버프 + 보스 강화·버프 — 약식 아이콘 (아이콘 아래 = 수치 / 남은 시간)
    const GL = [[/^강화 (\d+)\/(\d+)/, '강', m => m[1] + '/' + m[2]], [/^피해 (.+)$/, '피', m => m[1]], [/^시전속도 (.+)$/, '속', m => m[1]], [/^스킬 대기 (.+)$/, '쿨', m => m[1]], [/^연속 패턴 (.+)$/, '연', m => m[1]], [/^슈퍼아머/, '갑', () => ''], [/^상태 이상 저항/, '저', () => ''], [/^불사 보호 (\d+)/, '불', m => m[1] + 's'], [/^광폭 (\d+)/, '광', m => m[1] + 's'], [/^난이도 (\d+)/, '난', m => m[1]], [/^(\d)페이즈/, '페', m => m[1]]];
    const bi = bossBuffChips(boss).map(c => { for (const [re, g, f] of GL) { const m = re.exec(c.t); if (m) return { k: 'bchip', g, lab: f(m), rgb: c.c, t: 0, tip: () => { const cc = bossBuffChips(boss).find(q => re.test(q.t)) || c; return { title: '보스 · ' + cc.t, col: c.c, lines: [BCHIP_DESC[g] || ''].filter(Boolean) }; } }; } return { k: 'bchip', g: '+', lab: '', rgb: c.c, t: 0, tip: () => ({ title: c.t, col: c.c, lines: [] }) }; });
    const items = [...debuffList(boss), ...bi], wI = items.length * DEBUFF_W - (DEBUFF_W - 21);
    drawIconItems(items, W / 2 - wI / 2, 53);
  }
}
function drawBossBuffs(b, cx, y) {
  const chips = bossBuffChips(b); if (!chips.length) return;
  ctx.save(); ctx.font = '600 11px ' + FONT; const pad = 7, gap = 5, h = 18, ws = chips.map(c => ctx.measureText(c.t).width + pad * 2), tot = ws.reduce((a, v) => a + v, 0) + gap * (chips.length - 1);
  let x = cx - tot / 2;
  chips.forEach((c, i) => { ctx.fillStyle = 'rgba(10,12,20,.78)'; ctx.fillRect(x, y, ws[i], h); ctx.strokeStyle = 'rgba(' + c.c + ',.85)'; ctx.lineWidth = 1.2; ctx.strokeRect(x + 0.5, y + 0.5, ws[i] - 1, h - 1); ctx.fillStyle = 'rgb(' + c.c + ')'; ctx.textAlign = 'center'; ctx.fillText(c.t, x + ws[i] / 2, y + 13); x += ws[i] + gap; });
  ctx.restore();
}
function drawHpBar(x, y, w, hp, max, col, byTeam) {   // SC1 식 생명력 막대: 칸으로 나뉜 초록 -> 노랑 -> 빨강 (byTeam: 비무장 영웅 — col = 팀색, 33% 미만이면 금색 깜빡임)
  const fr = clamp(hp / max, 0, 1), n = Math.max(5, Math.round(w / 4)), bw = w / n, on = Math.ceil(fr * n - 1e-6), c = byTeam ? (fr >= 0.33 ? col : (Math.floor(T / 0.25) % 2 ? '#ffd23c' : '#9a7416')) : fr > 0.66 ? '#3cff3c' : fr > 0.33 ? '#ffd23c' : '#ff3c3c';
  ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 8); if (byTeam) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(x - w / 2 - 2, y - 2, w + 4, 10); }
  for (let i = 0; i < n; i++) { ctx.fillStyle = i < on ? c : 'rgba(45,45,45,.95)'; ctx.fillRect(x - w / 2 + i * bw + 0.5, y, Math.max(1, bw - 1), 6); }
}
function drawFx(layer) {
  for (const f of fx) {
    const p = f.t / f.dur;
    if (f.k === 'ring' && layer === 0) { ctx.strokeStyle = f.color; ctx.globalAlpha = 1 - p; ctx.lineWidth = f.lw * (1 - p) + 1; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.25 + 0.75 * Math.sqrt(p)), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    else if (f.k === 'arc' && layer === 1) drawArcFx(f, p);
    else if (f.k === 'spark' && layer === 1) { ctx.globalAlpha = 1 - p; ctx.fillStyle = f.color; ctx.fillRect(f.x - f.sz / 2, f.y - f.sz / 2, f.sz, f.sz); ctx.globalAlpha = 1; }
    else if (f.k === 'horse' && layer === 1) drawHorse({ x: f.x, y: f.y, r: f.r, face: Math.atan2(f.vy, f.vx), flash: 0, state: 'chase', walk: f.t * 14, spawnT: 0, alpha: 1 - clamp((f.t - 0.9) / 0.7, 0, 1), d: f.d || TYPES.boss }, 0);
    else if (f.k === 'hfx' && layer === 1) drawHitFx(f, p);
    else if (f.k === 'beam' && layer === 1) drawBeamFx(f, p);
    else if (f.k === 'streak' && layer === 1) { ctx.globalAlpha = (1 - p) * 0.9; ctx.strokeStyle = f.color; ctx.lineWidth = f.w; ctx.lineCap = 'round'; const ln = f.len * (0.6 + 0.4 * p); ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(f.ang) * ln, f.y + Math.sin(f.ang) * ln); ctx.stroke(); ctx.globalAlpha = 1; }
    else if (f.k === 'fire' && layer === 1) {   // 바닥 불길: 커졌다가 위로 일렁이며 사라짐
      const fy = f.y - p * 34, fr = f.r * (0.7 + 0.5 * Math.sin(Math.min(1, p * 2) * Math.PI / 2)), g = ctx.createRadialGradient(f.x, fy, 2, f.x, fy, fr);
      g.addColorStop(0, 'rgba(255,240,170,.95)'); g.addColorStop(0.4, 'rgba(255,140,50,.8)'); g.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.globalAlpha = (1 - p) * 0.95; ctx.fillStyle = g; circle(f.x, fy, fr); ctx.globalAlpha = 1;
    }
    else if (f.k === 'ghost' && layer === 0) { const sv = HERO, swA = P.wA, swT = P.wT; if (f.hero) HERO = HEROES[f.hero]; try { drawPlayerUnit(f.x, f.y, f.face, { ...playerStyle((f.a || 0.35) * (1 - p), f.face), flash: false, weapon: null }, 0, true); } finally { HERO = sv; P.wA = swA; P.wT = swT; } if (f.glow) { ctx.save(); ctx.globalAlpha = (1 - p) * 0.4; ctx.fillStyle = f.glow; ctx.beginPath(); ctx.ellipse(f.x, f.y - 18, 30, 42, 0, 0, TAU); ctx.fill(); ctx.restore(); } }
  }
}
// 청룡의 힘 연출 (행동 시간 t 기준)
//  t 0~0.15  : 치켜든 청룡언월도 칼날로 기운이 모이며 빛남
//  t 0.15~0.45: 칼날에서 청룡이 분출 — 몸이 칼날에서 풀려 나오며 나선으로 범위(ULT_RADIUS) 바깥으로 퍼짐
//  t 0.45~0.55: 관우 쪽으로 내리꽂음 (0.55 = 피해 판정) / 이후 충격파 링, 청룡이 다시 선회하며 사라짐
function dragonPos(t) {
  const ease = u => u * u * (3 - 2 * u);
  const th = -Math.PI / 2 + 8 * (t - 0.15);
  let r, z;
  if (t < 0.45) { const u = clamp((t - 0.15) / 0.3, 0, 1); r = (ULT_RADIUS - 40) * ease(u); z = (ULT_TIP_H - 10) * (1 - ease(u)) + 76 * ease(u) + 40 * Math.sin(Math.PI * u); }
  else if (t < 0.55) { const u = clamp((t - 0.45) / 0.1, 0, 1); r = (ULT_RADIUS - 40) - (ULT_RADIUS - 80) * ease(u); z = 76 - 56 * ease(u); }
  else { const u = clamp((t - 0.55) / 0.5, 0, 1); r = 40 + (ULT_RADIUS - 120) * ease(u); z = 20 + 70 * ease(u); }
  return { x: P.x + Math.cos(th) * r, y: P.y - 10 + Math.sin(th) * r * 0.75 - z, z };
}
// 궁극기 공통 오라: 적중 범위(ULT_RADIUS) 표시 + 무기 끝으로 모이는 빛 / 하늘로 솟는 빛줄기 (색은 영웅별)
function drawUltAura(t) {
  const u = HERO.ult;
  if (t < 0.8) {
    const fade = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.25;
    ctx.save(); ctx.globalAlpha = fade; ctx.fillStyle = `rgba(${u.rgb},.07)`; circle(P.x, P.y, ULT_RADIUS);
    ctx.strokeStyle = `rgba(${u.rgb},${0.45 + 0.25 * Math.sin(T * 14)})`; ctx.lineWidth = 4; ctx.setLineDash([16, 12]); ctx.beginPath(); ctx.arc(P.x, P.y, ULT_RADIUS, 0, TAU); ctx.stroke(); ctx.restore();
  }
  if (t < 0.62) {
    const tx = P.x, ty = P.y - u.tipH, gi = clamp(t / 0.15, 0, 1) * (t < 0.5 ? 1 : 1 - (t - 0.5) / 0.12);
    ctx.save();
    const gl = ctx.createRadialGradient(tx, ty, 4, tx, ty, 40 + 70 * gi); gl.addColorStop(0, `rgba(${u.core},${0.9 * gi})`); gl.addColorStop(0.4, `rgba(${u.rgb},${0.5 * gi})`); gl.addColorStop(1, `rgba(${u.rgb},0)`);
    ctx.fillStyle = gl; circle(tx, ty, 110);
    if (t >= 0.1) { const bw = 10 + 26 * gi, bg = ctx.createLinearGradient(0, ty, 0, ty - 420); bg.addColorStop(0, `rgba(${u.light},${0.55 * gi})`); bg.addColorStop(1, `rgba(${u.light},0)`); ctx.fillStyle = bg; ctx.fillRect(tx - bw / 2, ty - 420, bw, 420); }
    ctx.lineWidth = 3; for (const k of [0, 0.5]) { const ph = (T * 2.4 + k) % 1; ctx.strokeStyle = `rgba(${u.rgb},${(1 - ph) * 0.8 * gi})`; ctx.beginPath(); ctx.ellipse(tx, ty, 20 + 70 * ph, (20 + 70 * ph) * 0.45, 0, 0, TAU); ctx.stroke(); }   // 퍼지는 기운 고리
    ctx.restore();
  }
}
// 천하무쌍 연출 (행동 시간 t 기준): 0~0.2 방천화극에 불꽃이 모임 / 0.2~0.55 거대한 방천화극이 하늘에서 내려옴 / 0.55 내리꽂혀 폭발(피해 판정) / 이후 불꽃이 솟구치며 사라짐
function drawUltHalberd(t, noAura) {   // 천하무쌍(방천화극) / 백룡강림(조운의 거대한 창)
  if (!noAura) drawUltAura(t);
  if (t < 0.2 || t > 1.05) return;
  const ease = u => u * u * (3 - 2 * u), L = 330, tipLen = (HERO.ultStyle === 'lance' ? 1.5 : 1.36) * L;
  const alpha = Math.min(clamp((t - 0.2) / 0.1, 0, 1), clamp((1.05 - t) / 0.3, 0, 1)), fall = ease(clamp((t - 0.2) / 0.35, 0, 1));
  const tipY = P.y - 6 - (1 - fall) * 640;   // 창끝: 하늘 -> 관우(여포) 자리
  ctx.save(); ctx.globalAlpha = alpha;
  const sh = 40 + 60 * fall; ctx.fillStyle = 'rgba(255,90,40,.2)'; ctx.beginPath(); ctx.ellipse(P.x, P.y, sh, sh * 0.45, 0, 0, TAU); ctx.fill();   // 낙하 지점 표식
  const g = ctx.createLinearGradient(P.x, tipY - tipLen, P.x, tipY); g.addColorStop(0, 'rgba(255,120,50,0)'); g.addColorStop(1, 'rgba(255,170,80,.55)');
  ctx.fillStyle = g; ctx.fillRect(P.x - 46, tipY - tipLen, 92, tipLen);   // 불꽃 오라
  drawPolearm(HERO.ultStyle === 'lance' ? 'lance' : 'halberd', P.x, tipY - tipLen, Math.PI / 2, L);
  for (let k = 0; k < 7; k++) { ctx.fillStyle = `rgba(255,${150 + k * 12},60,.5)`; circle(P.x + Math.sin(T * 9 + k * 2) * 20, tipY - tipLen * (k / 7) - 10, 15 - k); }   // 일렁이는 불꽃
  ctx.restore();
}
function drawDragon(t) {
  drawUltAura(t);
  if (t < 0.15 || t > 1.22) return;
  const alpha = Math.min(clamp((t - 0.15) / 0.08, 0, 1), clamp((1.22 - t) / 0.2, 0, 1)), N = 30, grow = tt => 0.45 + 0.55 * clamp((tt - 0.15) / 0.2, 0, 1);   // 분출 직후엔 작고 점점 커짐
  ctx.save(); ctx.globalAlpha = alpha;
  // 몸통: 꼬리 -> 머리 순서 (머리가 맨 위). 꼬리쪽 마디일수록 늦게 풀려 나오므로 칼날에서 길게 이어져 나오는 모양이 된다.
  for (let i = N; i >= 1; i--) {
    const ti = t - i * 0.012; if (ti < 0.15) continue;
    const p = dragonPos(ti), rad = (27 * (1 - i / N * 0.72) + 4) * grow(ti);
    ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + p.z, rad * 1.2, rad * 0.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1d6b46'; ctx.beginPath(); ctx.moveTo(p.x - rad * 0.5, p.y - rad * 0.7); ctx.lineTo(p.x, p.y - rad * 1.7); ctx.lineTo(p.x + rad * 0.5, p.y - rad * 0.7); ctx.closePath(); ctx.fill();   // 등지느러미
    const g = ctx.createRadialGradient(p.x - rad * 0.3, p.y - rad * 0.4, rad * 0.1, p.x, p.y, rad);
    g.addColorStop(0, '#8ff0bd'); g.addColorStop(0.45, '#2fa06b'); g.addColorStop(1, '#1b6a47');
    ctx.fillStyle = g; circle(p.x, p.y, rad);
    ctx.strokeStyle = 'rgba(10,50,30,.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, rad * 0.62, 0.2, 2.6); ctx.stroke();   // 비늘 무늬
  }
  // 머리
  const h = dragonPos(t), h0 = dragonPos(t - 0.012), dir = Math.atan2(h.y - h0.y, h.x - h0.x), hs = 1.5 * grow(t);
  const glow = ctx.createRadialGradient(h.x, h.y, 6, h.x, h.y, 90 * hs / 1.5); glow.addColorStop(0, 'rgba(127,255,208,.55)'); glow.addColorStop(1, 'rgba(127,255,208,0)');
  ctx.fillStyle = glow; circle(h.x, h.y, 90 * hs / 1.5);
  ctx.translate(h.x, h.y); ctx.rotate(dir); ctx.scale(hs, hs); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,236,160,.95)'; ctx.lineWidth = 3;   // 수염
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(34, sd * 6); ctx.bezierCurveTo(52, sd * 22, 30, sd * 40, -10, sd * 38 + Math.sin(T * 9) * 4 * sd); ctx.stroke(); }
  ctx.strokeStyle = '#efe3b0'; ctx.lineWidth = 6;   // 뿔
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-2, sd * 14); ctx.quadraticCurveTo(-24, sd * 30, -48, sd * 24); ctx.stroke(); }
  ctx.fillStyle = '#26905f'; ctx.strokeStyle = '#124a31'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 30, 20, 0, 0, TAU); ctx.fill(); ctx.stroke();   // 두개골
  ctx.fillStyle = '#2fa06b'; ctx.beginPath(); ctx.ellipse(30, -2, 20, 11, 0, 0, TAU); ctx.fill(); ctx.stroke();   // 윗주둥이
  ctx.fillStyle = '#1b7a50'; ctx.beginPath(); ctx.moveTo(18, 6); ctx.lineTo(50, 12); ctx.lineTo(48, 20); ctx.lineTo(14, 17); ctx.closePath(); ctx.fill(); ctx.stroke();   // 아래턱 (입을 벌림)
  ctx.fillStyle = '#fff'; for (const v of [26, 34, 42]) { ctx.beginPath(); ctx.moveTo(v, 4); ctx.lineTo(v + 3, 12); ctx.lineTo(v + 6, 4); ctx.closePath(); ctx.fill(); }   // 송곳니
  ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.ellipse(10, -9, 6, 5, 0.3, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(11, -9, 2, 4, 0, 0, TAU); ctx.fill();   // 황금빛 눈
  ctx.fillStyle = 'rgba(127,255,208,.8)'; ctx.beginPath(); ctx.arc(52, 2, 4, 0, TAU); ctx.fill();   // 입김
  ctx.restore();
}
// 영웅 발밑의 약식 게이지: 생명력(위) + 궁극기(아래). 가득 차면 깜빡이고 궁극기 이름 표시
function drawPlayerMiniBars() {
  const w = 66, x = P.x - w / 2, y = P.y + 30 + (HERO.mounted ? 18 : 0), hp = clamp(P.hp / P.maxhp, 0, 1), rg = clamp(P.rage / 100, 0, 1), ready = P.rage >= 100;
  ctx.save(); if (state === 'lose') ctx.globalAlpha = 0.6;
  ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x - 1, y - 1, w + 2, 9);
  ctx.fillStyle = '#3a1010'; ctx.fillRect(x, y, w, 7);
  ctx.fillStyle = mode === 'duel' ? (hp >= 0.33 ? '#4fb0ff' : (Math.floor(T / 0.25) % 2 ? '#ffd23c' : '#9a7416')) : hp > 0.5 ? '#4fd36a' : hp > 0.25 ? '#f0b030' : '#ff3a3a'; ctx.fillRect(x, y, w * hp, 7);
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(x, y, w * hp, 2);
  ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x - 1, y + 9, w + 2, 7);
  ctx.fillStyle = HERO.ult.barBg; ctx.fillRect(x, y + 10, w, 5);
  ctx.fillStyle = ready ? `rgba(${HERO.ult.rgb},${0.7 + 0.3 * Math.sin(T * 10)})` : HERO.ult.bar; ctx.fillRect(x, y + 10, w * rg, 5);
  if (ready) text(HERO.skills.s3, P.x, y + 31, 12, HERO.ult.a, 'center');
  ctx.restore();
}
// 보스 관우의 청룡의 힘: 플레이어용 청룡 연출(drawDragon)을 보스 위치에서 재생 (시전 시간 전체 = 연출 0~0.55, 판정 시점에 내리꽂음)
// 태그 스킬 월드 연출: 관우 = 청룡이 내려옴(청룡의 힘 연출), 여포(하마) = 전방에 거대한 방천화극이 내리꽂힘
function drawTagWorldFx(a) {
  if (a.id === 'guan') drawDragon(0.1 + a.t * 2);
  else if (a.id === 'lubu2') { const sv = { x: P.x, y: P.y }; P.x += Math.cos(P.face) * 200; P.y += Math.sin(P.face) * 200; drawUltHalberd(0.2 + a.t * 1.5, true); P.x = sv.x; P.y = sv.y; }
}
// 태그 화면 연출: 어두운 비네팅 + 영웅 색 속도선 (글자·사선 띠 연출 없음)
function drawTagOverlay() {
  if (!tagFx || state !== 'play') return;
  const h = HEROES[tagFx.id], rgb = h.tag.rgb, t = tagFx.t, p = t / tagFx.dur, al = p < 0.12 ? p / 0.12 : 1 - (p - 0.12) / 0.88, sw = clamp(t / 0.22, 0, 1), ease = 1 - (1 - sw) * (1 - sw);
  ctx.save();
  const g = ctx.createRadialGradient(W / 2, H / 2, 180, W / 2, H / 2, 800); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.65 * al})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 22; i++) { const yy = rand(0, H), len = rand(160, 420), xx = rand(0, W); ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,.5)' : `rgba(${rgb},.6)`; ctx.lineWidth = rand(1, 3); ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + len, yy); ctx.stroke(); }
  ctx.globalAlpha = al;
  ctx.restore();
}
function drawBossUlt() {
  for (const e of enemies) {
    const c = e.cur; if (e.dead || !e.d.foot || e.d.mb) continue;
    let t = -1;
    if (e.state === 'wind' && c && c.ult) t = 0.55 * clamp(e.t / c.windup, 0, 1);
    else if (e.ultT != null && e.ultT < 1.3) t = 0.55 + e.ultT * 0.5;
    if (t < 0) continue;
    const sv = { x: P.x, y: P.y }, hv = HERO; P.x = e.x; P.y = e.y; HERO = e.d.zhao ? HEROES.zhao : HEROES.guan;
    if (e.d.zhao) drawUltLance(t); else drawDragon(t);
    P.x = sv.x; P.y = sv.y; HERO = hv;
  }
}
function drawWorld() {
  ctx.save();
  const sx = shake ? rand(-shake, shake) : 0, sy2 = shake ? rand(-shake, shake) : 0;
  ctx.translate(-Math.round(cam.x) + sx, -Math.round(cam.y) + sy2);
  ctx.drawImage(bg, 0, 0);
  drawArena(mode === 'duel' ? DUEL_R : ROGUE_R);
  drawFx(0);
  drawItems();
  for (const e of enemies) drawTele(e);
  drawRushTele();
  for (const f of enemies) drawFighterTele(f); for (const f of allies) drawFighterTele(f);
  // y 정렬 유닛
  const list = enemies.concat(allies).filter(e => !(e.fighter && e.dead)).map(e => ({ y: e.y, e })); if (!P.dead) list.push({ y: P.y, p: true });   // 쓰러진 영웅(비무장)은 그리지 않음
  list.sort((a, b) => a.y - b.y);
  for (const it of list) {
    if (it.p) {
      if (state === 'lose') ctx.globalAlpha = 0.6;
      const bl = buffListOf(P, HERO), bR = HERO.mounted ? MOUNT_R + 4 : P.r; drawBuffAura(P.x, P.y, bR, bl, 0);
      if (defMul() > 1) { ctx.strokeStyle = `rgba(143,180,255,${0.35 + 0.15 * Math.sin(T * 6)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(P.x, P.y + 4, P.r * 2.1, P.r * 1.0, 0, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(143,180,255,.12)'; ctx.fill(); }   // 방어력 증가 중: 발밑 방어막
      if (P.act && (P.act.type === 'ult' || P.act.invul)) { ctx.fillStyle = `rgba(${HERO.ult.rgb},.25)`; circle(P.x, P.y - 20, 60 + Math.sin(T * 30) * 6); if (P.act.invul && P.act.type !== 'zult') for (let k = 0; k < 10; k++) { const an = T * 7 + k * TAU / 10; ctx.fillStyle = `rgba(255,${120 + (k % 3) * 45},50,.55)`; circle(P.x + Math.cos(an) * 46, P.y - 14 + Math.sin(an) * 30 - 8 * Math.abs(Math.sin(T * 12 + k)), 9 - (k % 3) * 2); } }
      const pdm = mode === 'duel', pr = HERO.mounted ? MOUNT_R : P.r; if (pdm) drawTeamRing(P.x, P.y, pr, true);   // 비무장: 아군 팀 링 + 바깥에 초록 선택원
      ctx.strokeStyle = '#3cff3c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(P.x, P.y + 6, pdm ? pr * 2.4 : P.r * 1.9, pdm ? pr * 1.15 : P.r * 0.9, 0, 0, TAU); ctx.stroke();   // SC1 식 선택 원 (조작 중인 영웅)
      const pst = playerStyle(null, P.face); if (pdm) pst.flag = '#4fb0ff';
      drawPlayerUnit(P.x, P.y, P.face, pst, 0, pcDashing(P.act)); ctx.globalAlpha = 1; drawBuffAura(P.x, P.y, bR, bl, 1); if (pdm) drawPcMark();
      if (P.act && P.act.type === 'stun') { ctx.fillStyle = '#ffe14a'; for (let i = 0; i < 3; i++) { const a = T * 6 + i * 2.1; circle(P.x + Math.cos(a) * P.r * 0.9, P.y - P.r * 3.4 - (HERO.mounted ? 22 : 0) + Math.sin(a) * 4, 3.5); } }
    } else {
      const e = it.e, lift = e.lift || 0;
      if (e.boss && !e.d.foot && e.stage > 0) { const pr = 0.6 + 0.4 * Math.sin(T * 6), g = ctx.createRadialGradient(e.x, e.y, 10, e.x, e.y, e.r * 2.8); g.addColorStop(0, `rgba(255,80,50,${0.07 * e.stage * pr})`); g.addColorStop(1, 'rgba(255,80,50,0)'); ctx.fillStyle = g; circle(e.x, e.y - 10, e.r * 2.8); }   // 단계가 오를수록 붉은 기운이 짙어짐
      if (e.phase2 && e.d.foot) { const pr = 0.6 + 0.4 * Math.sin(T * 6), g = ctx.createRadialGradient(e.x, e.y, 10, e.x, e.y, e.r * 2.6); g.addColorStop(0, `rgba(${e.d.zhao ? '127,208,255' : e.d.dian ? '255,122,74' : '127,255,208'},${0.35 * pr})`); g.addColorStop(1, `rgba(${e.d.zhao ? '127,208,255' : e.d.dian ? '255,122,74' : '127,255,208'},0)`); ctx.fillStyle = g; circle(e.x, e.y - 10, e.r * 2.6); }   // 2페이즈 청룡의 기운
      if (e.state === 'hit') { ctx.save(); ctx.translate(e.x + Math.sin(T * 80) * 2, e.y); ctx.rotate(e.lean * 0.28 * Math.min(1, e.t / 0.12 + 0.3)); ctx.translate(-e.x, -e.y); drawUnit(e, 0); ctx.restore(); }
      else drawUnit(e, lift);
      if (e.state === 'stun') { ctx.fillStyle = '#ffe14a'; for (let i = 0; i < 3; i++) { const a = T * 6 + i * 2.1; circle(e.x + Math.cos(a) * e.r * 0.8, e.y - e.r * 3.6 + Math.sin(a) * 4, 3); } }
      if (!e.boss && !e.fighter && e.spawnT <= 0) drawHpBar(e.x, e.y - e.r * 3.5, e.r * 2.2, e.hp, e.maxhp, e.type === 'captain' ? '#ff9a3a' : '#ff4a4a');
    }
  }
  if (!P.dead) { drawPcOutline(); drawPlayerMiniBars(); }
  // 투사체
  for (const p of projectiles) {
    const a = Math.atan2(p.vy, p.vx);
    if (p.blade) {   // 전위의 투척 쌍극: 회전하는 십자 극날
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(T * 24); ctx.lineCap = 'round';
      const gl = ctx.createRadialGradient(0, 0, 2, 0, 0, 40); gl.addColorStop(0, 'rgba(255,230,200,.45)'); gl.addColorStop(1, 'rgba(255,230,200,0)'); ctx.fillStyle = gl; circle(0, 0, 40);
      ctx.strokeStyle = '#3a2a1e'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(26, 0); ctx.stroke();
      ctx.fillStyle = '#e4e8ef'; ctx.strokeStyle = '#6b7080'; ctx.lineWidth = 1.2;
      for (const sd of [-1, 1]) for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 20, 0); ctx.quadraticCurveTo(sd * 24, sg * 20, sd * 6, sg * 22); ctx.quadraticCurveTo(sd * 14, sg * 10, sd * 20, 0); ctx.fill(); ctx.stroke(); }
      ctx.restore();
    } else if (p.wave) {   // 청룡 참격: 초록 초승달 기운
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.lineCap = 'round';
      const gl = ctx.createRadialGradient(0, 0, 2, 0, 0, 34); const wc = p.blue ? '127,208,255' : '127,255,208'; gl.addColorStop(0, 'rgba(' + wc + ',.5)'); gl.addColorStop(1, 'rgba(' + wc + ',0)'); ctx.fillStyle = gl; circle(0, 0, 34);
      ctx.strokeStyle = p.blue ? '#3a9ad9' : '#2fb892'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(-14, 0, 24, -1.0, 1.0); ctx.stroke();
      ctx.strokeStyle = p.blue ? '#e6f6ff' : '#d8fff0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-14, 0, 24, -0.9, 0.9); ctx.stroke();
      ctx.restore();
    } else if (p.crystal) {   // 마법의 수정화살: 푸른 수정 화살촉과 긴 빛줄기
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.lineCap = 'round';
      const gl = ctx.createRadialGradient(0, 0, 4, 0, 0, 90); gl.addColorStop(0, 'rgba(190,240,255,.65)'); gl.addColorStop(1, 'rgba(120,210,255,0)'); ctx.fillStyle = gl; circle(0, 0, 90);
      const tr = ctx.createLinearGradient(-260, 0, 0, 0); tr.addColorStop(0, 'rgba(120,210,255,0)'); tr.addColorStop(1, 'rgba(210,246,255,.9)'); ctx.fillStyle = tr; ctx.fillRect(-260, -9, 260, 18);
      ctx.strokeStyle = '#e6faff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(40, 0); ctx.stroke();
      ctx.fillStyle = '#9fe8ff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(78, 0); ctx.lineTo(34, -22); ctx.lineTo(42, 0); ctx.lineTo(34, 22); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    } else if (p.arrow) {   // 보스의 화살: 화살대 + 쇠 화살촉 + 붉은 깃
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.lineCap = 'round'; if (p.big) ctx.scale(1.5, 1.25);
      ctx.strokeStyle = '#d6c18e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-36, 0); ctx.lineTo(9, 0); ctx.stroke();
      ctx.fillStyle = '#dfe3ea'; ctx.strokeStyle = '#6b7080'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(7, -6); ctx.lineTo(10, 0); ctx.lineTo(7, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#d2412f'; ctx.lineWidth = 2.2; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-36, 0); ctx.lineTo(-43, sd * 6); ctx.moveTo(-29, 0); ctx.lineTo(-36, sd * 6); ctx.stroke(); }
      ctx.restore();
    } else { ctx.strokeStyle = '#f2e7c9'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x - Math.cos(a) * 26, p.y - Math.sin(a) * 26); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.fillStyle = '#ff6a4a'; circle(p.x, p.y, 4); }
  }
  if (P.act && P.act.type === 'ult') drawUltFx(P.act.t); else if (P.act && P.act.type === 'rage') drawUltRage(0.4 + P.act.t * 1.4); else if (P.act && P.act.type === 'crystal') drawUltCrystal(clamp(P.act.t / 0.5, 0, 1));
  drawFighterUlts();
  if (P.act && P.act.type === 'tag') drawTagWorldFx(P.act);   // 궁극기 연출: 관우 = 청룡 / 여포 = 내리꽂히는 방천화극
  drawBossUlt();
  drawFx(1);
  for (const d of dts) { const a = 1 - Math.max(0, (d.t - 0.5) / 0.4), s = d.size * (d.t < 0.12 ? 1.5 - d.t * 4 : 1); ctx.globalAlpha = a; ctx.font = `900 ${s}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(d.txt, d.x, d.y); ctx.fillStyle = d.col; ctx.fillText(d.txt, d.x, d.y); ctx.globalAlpha = 1; }
  ctx.restore();
}

