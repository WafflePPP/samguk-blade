'use strict';
// ---------- 루프 ----------
let last = performance.now();
// ===== 스타크래프트1 식 시점: 자유 카메라(방향키 · 화면 가장자리 스크롤) + 미니맵 =====
//  PC 는 영웅을 자동으로 따라가지 않는다 (G = 영웅 위치로 이동, H = 영웅 추적 켜기/끄기). 모바일은 추적이 기본이고 미니맵을 눌러 시점을 옮길 수 있다.
function camTarget() { if (NET.on && NET.mine.length) { const c = netCur(); return c && !c.dead ? c : (NET.mine.find(a => !a.dead) || P); } return P.dead ? (allies.find(a => !a.dead) || P) : P; }
function centerCam() { const c = camTarget(); cam.x = clamp(c.x - W / 2, 0, WORLD.w - W); cam.y = clamp(c.y - H / 2, 0, WORLD.h - H); }
function mmJump(x, y) { cam.x = clamp((x - MM.x) / MM.w * WORLD.w - W / 2, 0, WORLD.w - W); cam.y = clamp((y - MM.y) / MM.h * WORLD.h - H / 2, 0, WORLD.h - H); camLock = false; }
function updateCamera(rdt) {
  const cf = camTarget();
  if (camLock || !CAM_FREE) { const tx = cf.x - W / 2, ty = cf.y - H / 2, k = 1 - Math.exp(-10 * rdt); cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; return; }
  let sx = 0, sy = 0;
  if (keys.ArrowLeft) sx--; if (keys.ArrowRight) sx++; if (keys.ArrowUp) sy--; if (keys.ArrowDown) sy++;
  if (mouseP.in && mmDrag == null) { if (mouseP.x < EDGE_PX) sx--; else if (mouseP.x > W - EDGE_PX) sx++; if (mouseP.y < EDGE_PX) sy--; else if (mouseP.y > H - EDGE_PX) sy++; }
  cam.x = clamp(cam.x + sx * CAM_SPEED * rdt, 0, WORLD.w - W); cam.y = clamp(cam.y + sy * CAM_SPEED * rdt, 0, WORLD.h - H);
}
function drawMinimap() {
  const m = MM, sx = m.w / WORLD.w, sy = m.h / WORLD.h, X = x => m.x + x * sx, Y = y => m.y + y * sy;
  ctx.save();
  ctx.fillStyle = 'rgba(6,8,12,.9)'; ctx.fillRect(m.x - 3, m.y - 3, m.w + 6, m.h + 6); ctx.strokeStyle = '#6f7a8a'; ctx.lineWidth = 2; ctx.strokeRect(m.x - 3, m.y - 3, m.w + 6, m.h + 6);
  ctx.globalAlpha = 0.85; ctx.drawImage(bg, 0, 0, WORLD.w, WORLD.h, m.x, m.y, m.w, m.h); ctx.globalAlpha = 1;
  ctx.save(); ctx.beginPath(); ctx.rect(m.x, m.y, m.w, m.h); ctx.clip();
  if (mode === 'duel') { ctx.strokeStyle = 'rgba(212,167,58,.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(X(ARENA_C.x), Y(ARENA_C.y), DUEL_R * sx, DUEL_R * sy, 0, 0, TAU); ctx.stroke(); }
  for (const it of items) { ctx.fillStyle = it.kind === 'bun' ? '#7dff9a' : '#ffc04d'; ctx.fillRect(X(it.x) - 1.5, Y(it.y) - 1.5, 3, 3); }
  for (const e of enemies) { if (e.dead || e.spawnT > 0) continue; const s = e.boss ? 7 : e.fighter ? 5 : 3; ctx.fillStyle = e.boss ? '#ff2a2a' : '#ff5a4a'; ctx.fillRect(X(e.x) - s / 2, Y(e.y) - s / 2, s, s); }
  for (const a of allies) { if (a.dead) continue; ctx.fillStyle = '#4fb0ff'; ctx.fillRect(X(a.x) - 2.5, Y(a.y) - 2.5, 5, 5); }
  if (!P.dead) { ctx.fillStyle = '#3cff3c'; ctx.fillRect(X(P.x) - 3, Y(P.y) - 3, 6, 6); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(X(P.x) - 3, Y(P.y) - 3, 6, 6); }
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(m.x + cam.x * sx, m.y + cam.y * sy, W * sx, H * sy);   // 현재 시점 (흰 사각형)
  ctx.restore();
  const b = MM_LOCK; ctx.fillStyle = camLock ? 'rgba(60,200,60,.85)' : 'rgba(10,12,20,.85)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = camLock ? '#9dff9d' : '#6f7a8a'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x, b.y, b.w, b.h);
  text(camLock ? '추적' : '자유', b.x + b.w / 2, b.y + 15, 12, '#fff', 'center');
  ctx.restore();
}
function drawHeroPointer() {   // 영웅이 화면 밖이면 가장자리에 방향 화살표 (미니맵과 별개)
  const c = camTarget(), px = c.x - cam.x, py = c.y - cam.y;
  if (px < -10 || px > W + 10 || py < -10 || py > H + 10) {
    const cx = W / 2, cy = H / 2, dx = px - cx, dy = py - cy, k = Math.min((W / 2 - 34) / Math.abs(dx || 1e-6), (H / 2 - 34) / Math.abs(dy || 1e-6)), ax = cx + dx * k, ay = cy + dy * k, an = Math.atan2(dy, dx);
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(an); ctx.fillStyle = 'rgba(60,255,60,.9)'; ctx.strokeStyle = '#052'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-4, 0); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
}
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  try {
    if (DBG.on) { const t0 = performance.now(); update(dt); const t1 = performance.now(); render(); drawDebug(); dbgFrame(now, t1 - t0, performance.now() - t1); }   // 디버그 표시가 켜졌을 때만 시간을 잰다
    else { update(dt); render(); }
  } catch (e) { errLog('frame', e && e.message, '', 0, 0, e && e.stack); console.error(e); }   // 한 프레임에서 오류가 나도 화면이 멈추지 않게 다음 프레임을 이어서 그린다
  requestAnimationFrame(frame);
}
loadSave(); ACC = SAVE.accounts.find(a => a.id === SAVE.last) || null;
resetPlayer(); enemies = []; projectiles = []; fx = []; dts = []; items = []; waveIdx = 0; bannerT = 0; kills = 0; clock = 0; winT = 0; autoDodgeCd = 0;
requestAnimationFrame(frame);
