'use strict';
// ---------- HUD ----------
function text(s, x, y, size, col, align = 'left', bold = true, stroke = true) {
  ctx.font = `${bold ? 800 : 500} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  if (stroke) { ctx.lineWidth = Math.max(2.5, Math.min(4, size / 5)); ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function drawButton(b) {
  const pressed = b.id === 'attack' && attackHeld();
  let ready = true, frac = 0;
  if (b.id === 's1' || b.id === 's2' || b.id === 'dash') { frac = clamp(P.cd[b.id] / ((b.id === 'dash' ? dashCdNow() : CD[b.id]) * (b.id === 's2' ? HERO.s2cdMul || 1 : b.id === 's1' ? HERO.s1cdMul || 1 : 1)), 0, 1); ready = frac <= 0; }
  if (b.id === 's3') { frac = 1 - P.rage / 100; ready = P.rage >= 100; }
  if (b.id === 'auto') ready = auto;
  ctx.save();
  ctx.globalAlpha = (b.id === 's3' && ready) ? 0.8 : pressed ? 0.75 : 0.5;   // 반투명: 버튼 뒤의 전투 상황이 비쳐 보임 (궁극기 사용 가능 시에만 선명)
  const g = ctx.createRadialGradient(b.x, b.y - b.r * .3, b.r * .2, b.x, b.y, b.r);
  g.addColorStop(0, b.id === 's3' && ready ? '#ffe28a' : '#4a5066'); g.addColorStop(1, b.id === 's3' && ready ? '#d4811f' : '#1d2030');
  ctx.fillStyle = g; circle(b.x, b.y, b.r * (pressed ? 0.94 : 1));
  if (b.id === 'auto') { ctx.fillStyle = auto ? '#3a9a5a' : '#2a2e40'; circle(b.x, b.y, b.r); }
  ctx.lineWidth = 3; ctx.strokeStyle = ready ? (b.id === 's3' ? '#fff3b0' : '#ffd34d') : '#555a70'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke();
  if (b.id === 's3' && ready) { ctx.strokeStyle = `rgba(255,243,176,${0.5 + 0.5 * Math.sin(T * 8)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 5, 0, TAU); ctx.stroke(); }
  if (frac > 0 && b.id !== 'auto') { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.arc(b.x, b.y, b.r - 2, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  if (b.id === 'attack') {   // 콤보 단계 표시: 현재 단계까지 점등, 다음 입력이 몇 단계인지 안내
    const cur = P.act && P.act.type === 'atk' ? P.act.c + 1 : P.comboT > 0 ? P.combo + 1 : 0;
    const nc = HERO.comboLen || 3;
    for (let i = 0; i < nc; i++) {
      const x = b.x + (i - (nc - 1) / 2) * 26, y = b.y - b.r - 12;
      ctx.fillStyle = i < cur ? (i === 2 ? '#ff9a3a' : '#ffd34d') : 'rgba(255,255,255,.25)'; circle(x, y, i === 2 ? 9 : 7);
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, i === 2 ? 9 : 7, 0, TAU); ctx.stroke();
    }
  }
  text(b.label, b.x, b.y + (b.id === 'attack' ? 7 : 4), b.id === 'attack' ? 28 : b.id === 'auto' ? 22 : Math.round(clamp(b.r * 0.36, 12, 19)), '#fff', 'center');
  if (b.key && b.id !== 'auto') text(b.key, b.x + b.r * 0.62 * (b.id === 'dash' ? -1 : 1), b.y - b.r * 0.62, 13, '#ffd34d', 'center', true);
  if (b.id === 's1' || b.id === 's2' || b.id === 'dash') { if (P.cd[b.id] > 0) text(P.cd[b.id].toFixed(1), b.x, b.y - b.r - 5, 16, '#fff', 'center'); }
  if (b.id === 's3' && !ready) text(((100 - P.rage) / 100 * ULT_CD / (1 + RUN.rage + META.rage)).toFixed(1), b.x, b.y - b.r - 5, 16, '#ffd34d', 'center');
}
// HUD 의 둥근 초상 아이콘
function drawPortraitIcon(h, x, y) {
  if (h.id === 'huang') {   // 황충: 금빛 투구와 붉은 깃, 흰 수염
    ctx.fillStyle = '#5c5a3c'; circle(x, y, 30); ctx.fillStyle = '#d9a98a'; circle(x, y - 5, 18);
    ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.arc(x, y - 7, 20, Math.PI, TAU); ctx.fill(); ctx.fillRect(x - 20, y - 9, 40, 4);
    ctx.strokeStyle = '#c9302c'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 2, y - 26); ctx.quadraticCurveTo(x - 14, y - 44, x + 6, y - 54); ctx.stroke();
    ctx.fillStyle = '#e8e4da'; ctx.beginPath(); ctx.moveTo(x - 14, y - 1); ctx.quadraticCurveTo(x, y + 30, x + 14, y - 1); ctx.quadraticCurveTo(x, y + 6, x - 14, y - 1); ctx.fill();
    ctx.fillStyle = '#111'; circle(x - 6, y - 4, 1.8); circle(x + 6, y - 4, 1.8);
    return;
  }  if (h.id === 'dian') {   // 전위: 붉은 두건, 수염, 부릅뜬 눈
    ctx.fillStyle = '#8a3a22'; circle(x, y, 30); ctx.fillStyle = '#c98a6a'; circle(x, y - 5, 18);
    ctx.fillStyle = '#b3281f'; ctx.beginPath(); ctx.arc(x, y - 8, 19, Math.PI, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + 14, y - 16); ctx.quadraticCurveTo(x + 30, y - 22, x + 32, y - 8); ctx.quadraticCurveTo(x + 24, y - 12, x + 12, y - 8); ctx.fill();
    ctx.fillStyle = '#17171b'; ctx.beginPath(); ctx.moveTo(x - 14, y - 1); ctx.quadraticCurveTo(x, y + 28, x + 14, y - 1); ctx.quadraticCurveTo(x, y + 6, x - 14, y - 1); ctx.fill();
    ctx.strokeStyle = '#17171b'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 11, y - 9); ctx.lineTo(x - 3, y - 6); ctx.moveTo(x + 11, y - 9); ctx.lineTo(x + 3, y - 6); ctx.stroke(); ctx.fillStyle = '#111'; circle(x - 6, y - 4, 1.8); circle(x + 6, y - 4, 1.8);
    return;
  }  if (h.id === 'diao') {   // 초선: 분홍·보라 한복, 금관, 분홍 꽃 장식, 긴 머리
    ctx.fillStyle = '#b8579a'; circle(x, y, 30); ctx.fillStyle = '#1e1624'; ctx.beginPath(); ctx.ellipse(x, y - 1, 22, 26, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f4d9bd'; circle(x, y - 5, 17); ctx.fillStyle = '#1e1624'; ctx.beginPath(); ctx.arc(x, y - 7, 18, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(x - 12, y - 19); ctx.lineTo(x - 10, y - 31); ctx.lineTo(x - 5, y - 24); ctx.lineTo(x, y - 34); ctx.lineTo(x + 5, y - 24); ctx.lineTo(x + 10, y - 31); ctx.lineTo(x + 12, y - 19); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff9ac8'; for (let k = 0; k < 5; k++) { const an = k * TAU / 5 - 1.2; circle(x + 14 + Math.cos(an) * 5, y - 16 + Math.sin(an) * 5, 4.2); } ctx.fillStyle = '#fff0b0'; circle(x + 14, y - 16, 2.4);
    ctx.fillStyle = '#111'; circle(x - 6, y - 4, 1.8); circle(x + 6, y - 4, 1.8); ctx.fillStyle = '#e0608a'; ctx.beginPath(); ctx.ellipse(x, y + 4, 3.5, 1.8, 0, 0, TAU); ctx.fill();
    return;
  }
  if (h.id === 'zhao') { ctx.fillStyle = '#2b6a6e'; circle(x, y, 30); ctx.fillStyle = '#e0b08a'; circle(x, y - 5, 18); ctx.fillStyle = '#2b2433'; ctx.beginPath(); ctx.arc(x, y - 7, 19, Math.PI, TAU); ctx.fill(); ctx.fillStyle = '#c9cfd8'; ctx.fillRect(x - 17, y - 12, 34, 5); ctx.fillStyle = '#3a8be0'; circle(x, y - 9.5, 3); return; }
  if (h.id === 'guan') { ctx.fillStyle = '#2f8f5b'; circle(x, y, 30); ctx.fillStyle = '#c9553f'; circle(x, y - 5, 18); ctx.fillStyle = '#17171b'; ctx.beginPath(); ctx.moveTo(x - 12, y - 1); ctx.quadraticCurveTo(x, y + 31, x + 12, y - 1); ctx.fill(); return; }
  ctx.fillStyle = '#2a2030'; circle(x, y, 30); ctx.fillStyle = '#e0b08a'; circle(x, y - 5, 18); ctx.fillStyle = '#1c1c26'; ctx.beginPath(); ctx.arc(x, y - 6, 20, Math.PI, TAU); ctx.fill();
  ctx.strokeStyle = '#c9302c'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 6, y - 22); ctx.quadraticCurveTo(x - 22, y - 44, x - 12, y - 56); ctx.moveTo(x + 6, y - 22); ctx.quadraticCurveTo(x + 22, y - 44, x + 12, y - 56); ctx.stroke();
}
// 태그 버튼: 왼쪽 화면 세로 (출전한 PC 최대 3명: 관우 / 여포 / 조운). 현재 영웅은 금색 테두리, 재사용 대기 중이면 어둡게 + 남은 시간
function drawTagButtons() {
  if (state !== 'play' || mode === 'duel') return;
  const hot = ['Z', 'X', 'C'];
  if (TEAM.length < 2) return;   // 혼자 출전하면 태그 없음
  text('TAG', 54, tagBtnPos(0).y - TAG_BTN_R - 10, 15, '#ffd34d', 'center');
  TEAM.forEach((id, i) => {
    const h = heroDef(id), b = tagBtnPos(i), cur = id === HERO.pc, cd = P.tagCd;
    ctx.save(); ctx.globalAlpha = 0.78; ctx.fillStyle = 'rgba(10,12,20,.85)'; circle(b.x, b.y, TAG_BTN_R);
    ctx.save(); ctx.beginPath(); ctx.arc(b.x, b.y, TAG_BTN_R - 2, 0, TAU); ctx.clip(); ctx.translate(b.x, b.y + 5); ctx.scale(1.1, 1.1); drawPortraitIcon(h, 0, 0); ctx.restore();
    if (!cur && cd > 0) { ctx.fillStyle = 'rgba(0,0,0,.62)'; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.arc(b.x, b.y, TAG_BTN_R - 2, -Math.PI / 2, -Math.PI / 2 + TAU * (cd / TAG_CD)); ctx.closePath(); ctx.fill(); }
    ctx.lineWidth = cur ? 5 : 3.5; ctx.strokeStyle = cur ? '#ffd34d' : (cd > 0 ? '#555a70' : '#cfe8ff'); ctx.beginPath(); ctx.arc(b.x, b.y, TAG_BTN_R, 0, TAU); ctx.stroke(); ctx.restore();
    const hpv = cur ? P.hp : P.hpStore[id], fr = clamp(hpv / heroMaxHp(id), 0, 1), down = hpv <= 0;
    if (down) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.65)'; circle(b.x, b.y, TAG_BTN_R - 2); ctx.restore(); text('불능', b.x, b.y + 6, 17, '#ff7a7a', 'center'); }
    text(PC_TAG[id], b.x, b.y + TAG_BTN_R + 17, 15, cur ? '#ffe9a0' : down ? '#888' : '#fff', 'center');
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(b.x - 32, b.y + TAG_BTN_R + 23, 64, 9); ctx.fillStyle = fr > 0.5 ? '#4fd36a' : fr > 0.25 ? '#f0b030' : '#ff3a3a'; ctx.fillRect(b.x - 31, b.y + TAG_BTN_R + 24, 62 * fr, 7);   // 영웅별 생명력
    if (!IS_TOUCH) text(hot[i], b.x - TAG_BTN_R + 4, b.y - TAG_BTN_R + 11, 14, '#ffd34d', 'center', true);
    if (!cur && cd > 0) text(cd.toFixed(1), b.x, b.y + 6, 18, '#fff', 'center');
  });
}
function drawHUD() {
  if (mode === 'duel') { if (NET.on) drawNetHUD(); else drawDuelHUD(); } else if (RAID) { if (NET.on) drawRaidNetHUD(); else drawRaidHUD(); } else {
  // ===== 영웅 정보 (컴팩트: 가려지는 면적 최소화) =====
  ctx.fillStyle = 'rgba(10,12,20,.5)'; ctx.fillRect(10, 10, 262, 50); ctx.strokeStyle = 'rgba(212,167,58,.8)'; ctx.lineWidth = 1.5; ctx.strokeRect(10, 10, 262, 50);
  ctx.save(); ctx.translate(34, 35); ctx.scale(0.62, 0.62); ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.clip(); drawPortraitIcon(HERO, 0, 0); ctx.restore();
  text(HERO.name + (ACC && mode === 'yeonui' ? '   Lv ' + heroLv(HERO.pc) : ''), 60, 25, 14, '#ffe9a0');
  ctx.fillStyle = '#300'; ctx.fillRect(60, 30, 204, 13); ctx.fillStyle = P.hp / P.maxhp > .3 ? '#d83a3a' : '#ff2a2a'; ctx.fillRect(60, 30, 204 * P.hp / P.maxhp, 13);
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.strokeRect(60, 30, 204, 13);
  text(`${Math.ceil(P.hp)} / ${P.maxhp}`, 162, 41, 10, '#fff', 'center');
  drawDebuffIcons(P, 278, 12);
  ctx.fillStyle = '#222'; ctx.fillRect(60, 47, 204, 6); ctx.fillStyle = P.rage >= 100 ? '#ffd34d' : '#e0902a'; ctx.fillRect(60, 47, 204 * P.rage / 100, 6); ctx.strokeStyle = '#000'; ctx.strokeRect(60, 47, 204, 6);

  }
  // ===== 버프 칸 (위에서부터 쌓임) =====
  // 표기 규칙: 칸 = '효과명 +N% (출처)' + 남은 시간(초) / 발동 글자 = '효과명 +N%'. 효과명은 방어력 · 공격력 · 이동속도 · 공속·피해 로 통일, 출처는 괄호 안에 스킬 이름.
  let chipY = mode === 'duel' ? 182 : RAID ? 160 : 66;   // 비무장은 HUD 목록이 22px 아래로 내려가 있음
  const chip = (col, label, t, dur, showTime = true, icon) => {   // icon = 버프 id(문자열) 또는 디버프 { k: 'stun' | 'hurt' | 'slow' | 'resist', n }
    const cw = 262, rgb = col.replace('#', '').match(/../g).map(h => parseInt(h, 16)).join(',');
    ctx.fillStyle = 'rgba(10,12,20,.5)'; ctx.fillRect(10, chipY, cw, 21); ctx.fillStyle = col + '4d'; ctx.fillRect(10, chipY, cw * clamp(t / dur, 0, 1), 21);
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(10, chipY, cw, 21);
    if (icon) drawIconItems([typeof icon === 'string' ? { k: 'buff', id: icon, rgb, t } : { ...icon, t }], 10, chipY, true); else { ctx.fillStyle = col; circle(21, chipY + 10, 4); }
    text(fitStr(label, cw - 76, 12), 36, chipY + 15, 12, '#fff'); if (showTime) text(t.toFixed(1) + 's', 10 + cw - 6, chipY + 15, 12, '#fff', 'right');
    chipY += 24;
  };
  const pc = v => Math.round(v * 100);
  { const pa = P.act;   // 받은 디버프 (상세): 스턴 / 경직 / 둔화 / 상태 이상 저항
    if (pa && pa.type === 'stun') chip('#ffe14a', '스턴 — 이동·공격·회피 불가', Math.max(0, pa.dur - pa.t), pa.dur, true, { k: 'stun' });
    else if (pa && pa.type === 'hurt') chip('#ff9a4a', '경직 — 피격 중 행동 불가', Math.max(0, pa.dur - pa.t), pa.dur, true, { k: 'hurt' });
    if (P.slowT > 0) chip('#7fd0ff', '둔화 — 이동속도 -45%', P.slowT, 1.5, true, { k: 'slow' });
    if (hasDR(P) && (P.drN || 0) > 0) { const n = Math.min(P.drN, DR_STEPS.length); chip('#c9a0ff', '상태 이상 저항 ' + n + '회 (다음 ' + pc(DR_STEPS[Math.min(P.drN, DR_STEPS.length - 1)]) + '%)', P.drN >= DR_STEPS.length ? Math.max(0, P.drT || 0) : 1, P.drN >= DR_STEPS.length ? DR_RESET : 1, P.drN >= DR_STEPS.length, { k: 'resist', n, busy: P.drBusy > 0 }); } }
  if (P.buffT > 0) chip('#ffc04d', '공속·이속 +30% (술)', P.buffT, WINE_DURATION, true, 'wine');
  if (HERO.guard && P.guardT > 0) chip('#8fb4ff', '방어력 +' + pc(HERO.guard.bonus) + '% (3단 공격)', P.guardT, HERO.guard.dur, true, 'guard');
  if (HERO.ultGuard && P.ultGuardT > 0) chip('#7fffd0', '방어력 +' + pc(HERO.ultGuard) + '% (' + HERO.skills.s3 + ')', P.ultGuardT, HERO.ultGuardDur, true, 'ultGuard');
  if (HERO.postUltAtk && P.postUltT > 0) chip('#ff9a4a', '공격력 +' + pc(HERO.postUltAtk - 1) + '% (' + HERO.skills.s3 + ')', P.postUltT, HERO.postUltDur, true, 'postAtk');
  if (HERO.postUltAspd && P.postUltT > 0) chip('#9fdcff', '공속 +' + pc(HERO.postUltAspd - 1) + '% (' + HERO.skills.s3 + ')', P.postUltT, HERO.postUltDur, true, 'spd');
  if (HERO.aspdBuff && P.aspdT > 0) chip('#9fdcff', '공속 +' + pc(HERO.aspdBuff.mult - 1) + '% (3단 공격)', P.aspdT, HERO.aspdBuff.dur, true, 'aspd');
  if (HERO.comboBuff && P.comboBuffT > 0) chip('#ffd34d', '공격력 +' + pc(HERO.comboBuff.atk - 1) + '% (3단 공격)', P.comboBuffT, HERO.comboBuff.dur, true, 'atk');
  if (HERO.runBonus && P.runBuffT > 0) chip('#7fd0ff', '이동속도 +' + pc(HERO.runBonus - 1) + '% (질주)', P.runBuffT, HERO.runDur, true, 'run');
  if (P.floorT > 0) chip('#ffcd5a', '불사 보호 · 생명력 1 밑으로 내려가지 않음 (전투당 1회)', P.floorT, HEROES.dian.undy.floor, true, 'floor');
  if (P.undyT > 0 && HERO.undy) chip('#ff5a4a', '불사 · 공격 +' + pc(HERO.undy.atk - 1) + '% · 흡혈 ' + pc(HERO.undy.ls) + '% (' + HERO.skills.s3 + ')', P.undyT, HERO.undy.dur, true, 'undy');
  if (P.blessT > 0) chip('#ff9ac8', '공격력 +' + pc(BLESS_ATK) + '% · 방어력 +' + pc(BLESS_DEF) + '% (월하 축복)', P.blessT, BLESS_DUR, true, 'bless');
  if (comboTier() > 0) chip('#ff9a3a', '공속·피해 +' + pc(comboPct()) + '% (' + P.hits + ' HIT)', P.hitsT, 3, false, 'hit');   // HIT 누적 효과: 3초 안에 적중하면 갱신 (막대 = 남은 유지 시간)

  // 로그라이크 강화 효과: HIT 효과처럼 어떤 영웅으로 싸우든(태그로 바꿔도) 공통으로 적용 — 2열로 모아서 표시
  if (mode !== 'duel') { const ks = Object.keys(UPG).filter(k => RUN[k] > 0); if (ks.length) { text('강화 효과 · 전 영웅 공통', 12, chipY + 9, 10, '#ffd9a0', 'left', true, false); chipY += 13; ks.forEach((k, i) => { const x = 10 + (i % 2) * 121, y = chipY + Math.floor(i / 2) * 19; ctx.fillStyle = 'rgba(10,12,20,.5)'; ctx.fillRect(x, y, 119, 17); ctx.strokeStyle = '#d8a03a'; ctx.lineWidth = 1.2; ctx.strokeRect(x, y, 119, 17); text(UPG_SHORT[k] + ' ' + UPG[k].f(RUN[k]), x + 5, y + 13, 10, '#fff', 'left', false, false); }); chipY += Math.ceil(ks.length / 2) * 19 + 4; } }

  // ===== 웨이브 / 처치 / 웨이브·로비 버튼 =====
  if (!(mode === 'yeonui' && state === 'play')) { const r = lobbyBtnRect(); ctx.fillStyle = 'rgba(10,12,20,.55)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 1.5; ctx.strokeRect(r.x, r.y, r.w, r.h); text(mode === 'yeonui' && state === 'play' ? '나가기' : '로비', r.x + r.w / 2, r.y + r.h / 2 + 5, 13, '#ffe9a0', 'center'); }   // 로비 버튼 (보스 버튼 옆) — 로그라이크 전투 중에는 '나가기'(경험치 정산)
  if (mode === 'yeonui' && state === 'play') drawPauseButton();
  // ===== 보스 체력바 (얇게) =====
  const boss = enemies.find(e => e.boss);
  if (mode !== 'duel') drawTopInfo(boss);   // 위 가운데 한 줄: 모드·웨이브 / 보스 이름·강화 / 처치·시간
  if (boss) {
    const bw = 420, bx = W / 2 - bw / 2, by = 36, bh = 12;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    ctx.fillStyle = '#4a1010'; ctx.fillRect(bx, by, bw, bh); ctx.fillStyle = '#d82a2a'; ctx.fillRect(bx, by, bw * boss.hp / boss.maxhp, bh);
    ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(bx, by, bw * boss.hp / boss.maxhp, 4);
    ctx.strokeStyle = '#d4a73a'; ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(bx + bw * 0.5 - 1, by, 2, bh);   // 50% = 2페이즈 경계
    if (boss.d.mb) { ctx.fillStyle = 'rgba(255,255,255,.55)'; for (const f of [1 / 3, 2 / 3]) ctx.fillRect(bx + bw * f - 1, by, 2, bh); }   // 몬스터 보스: 3단계 경계
    if (boss.d.zhao) { ctx.fillStyle = 'rgba(255,255,255,.55)'; for (const f of [0.25, 0.75]) ctx.fillRect(bx + bw * f - 1, by, 2, bh); }
    if (boss.d.dian) { ctx.fillStyle = 'rgba(255,255,255,.55)'; for (const f of [0.2, 0.4, 0.6, 0.8]) ctx.fillRect(bx + bw * f - 1, by, 2, bh); }   // 보스 조운: 4단계 경계
    if (!boss.d.foot) { ctx.fillStyle = 'rgba(255,255,255,.4)'; for (const f of (boss.d.raid ? [1 / 8, 2 / 8, 3 / 8, 5 / 8, 6 / 8, 7 / 8] : [1 / 6, 2 / 6, 4 / 6, 5 / 6])) ctx.fillRect(bx + bw * f - 1, by, 2, bh); }   // 보스 여포: 6단계 경계
  }
  // 콤보
  if (P.hits >= 2) {
    const s = 1 + Math.min(0.3, (P.hitsT > 2.8 ? (P.hitsT - 2.8) * 3 : 0));
    const hy = mode === 'duel' ? 200 : 190; ctx.save(); ctx.translate(W - 30, hy); ctx.scale(s, s); text(String(P.hits), 0, 0, 54, '#ffe14a', 'right'); text('HITS', 0, 26, 20, '#fff', 'right'); ctx.restore();
    const tier = comboTier();
    if (HERO.hitBonus || tier < COMBO_MAX_TIER) text('다음 ' + tierHits(tier + 1) + ' HIT', W - 40, hy + 96, 14, 'rgba(255,255,255,.7)', 'right', false);   // 보너스 자체는 왼쪽 상단 버프 정보에 표시
  }
  // 조이스틱
  if (joy) { ctx.globalAlpha = .5; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(joy.cx, joy.cy, 70, 0, TAU); ctx.stroke(); const dx = joy.x - joy.cx, dy = joy.y - joy.cy, l = Math.hypot(dx, dy), k = l > 70 ? 70 / l : 1; circle(joy.cx + dx * k, joy.cy + dy * k, 30); ctx.globalAlpha = 1; }
  for (const b of BTN) drawButton(b);
  drawTagButtons();
  if (!IS_TOUCH) text(`WASD 이동 · J/클릭 공격 · K ${HERO.skills.s1} · L ${HERO.skills.s2} · ; ${HERO.skills.s3} · Space 회피 · ${mode === 'duel' ? 'Q 조작 변경' : RAID ? (NET.on ? '온라인 협동' : 'Q 조작 변경') : 'Z/X/C 태그'} · T 오토`, 12, H - 8, 12, 'rgba(255,255,255,.7)', 'left', false);
  else if (clock < 12 && !joy) text('◀ 왼쪽 화면을 누르고 드래그해서 이동', 100, H - 40, 14, 'rgba(255,255,255,.8)', 'left', false);
  if (auto) text(RAID ? (IS_TOUCH ? 'AUTO 전투 중 — 조이스틱을 움직이면 해제' : 'AUTO 전투 중 — 이동 입력 시 해제') : IS_TOUCH ? 'AUTO 전투 중 — 조이스틱을 움직이면 해제 · 생명력 10% 이하 자동 태그' : 'AUTO 전투 중 — 이동 입력 시 해제 · 생명력 10% 이하 자동 태그', W / 2, H - 44, 14, '#7dff9a', 'center');
  if (reinforceT > 0 && state === 'play') text(reinforceMsg, W / 2, 168, 26, `rgba(255,214,120,${Math.min(1, reinforceT * 2)})`, 'center');
  // 웨이브 배너
  if (bannerT > 0 && state === 'play') {
    const a = clamp(Math.min(bannerT, 2.6 - bannerT) * 3, 0, 1);
    const boss = !!curWave().bossWave;
    ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 230, W, 132);
    text(boss ? 'WARNING' : `WAVE ${waveIdx + 1}`, W / 2, 280, 28, boss ? '#ff5a5a' : '#ffd34d', 'center');
    text(curWave().name, W / 2, 322, 40, '#fff', 'center');
    if (!boss) text('위험도 ' + '★'.repeat(1 + Math.floor(waveIdx / 10)) + '☆'.repeat(4 - Math.floor(waveIdx / 10)), W / 2, 352, 16, '#ffb27a', 'center');   // 계단식 난이도 표시
    ctx.globalAlpha = 1;
  }
  // 저체력 비네팅
  if (P.hp / P.maxhp < 0.3 && state === 'play') { const g = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 720); g.addColorStop(0, 'rgba(200,0,0,0)'); g.addColorStop(1, `rgba(200,0,0,${0.3 + 0.15 * Math.sin(T * 6)})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
}
function drawOverlay(title, sub, col) {
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H);
  text(title, W / 2, 300, 84, col, 'center'); text(sub, W / 2, 360, 24, '#fff', 'center');
  if (!NET.on) text(`처치 ${kills}  ·  최대 콤보 ${P.bestHits}  ·  시간 ${Math.floor(clock / 60)}:${String(Math.floor(clock % 60)).padStart(2, '0')}`, W / 2, 410, 20, '#cfd3e6', 'center', false);
  if (!IS_TOUCH) text('R / Enter : ' + (NET.on ? '대기실로' : '다시 시작') + '    ·    C : 로비', W / 2, 470, 16, '#9aa3b8', 'center', false);
  for (const [b, label, col] of [[OVERLAY_RETRY, NET.on ? '대기실로' : '다시 시작', '#7dff9a'], [OVERLAY_BTN, '로비', '#ffd34d']]) { ctx.fillStyle = 'rgba(10,12,20,.85)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.strokeRect(b.x, b.y, b.w, b.h); text(label, b.x + b.w / 2, b.y + 31, 22, col, 'center'); }
  drawCopyBtn(OVERLAY_COPY, '결과 복사', 'last');
}
// 시작 화면의 영웅 초상 (카드 안, 발 위치 기준 x, y)
function drawCardFigure(h, x, y) {
  if (h.mounted) {
    const r = 38, rr = 30;
    drawHorse({ x, y, r, face: 0, flash: 0, state: 'chase', walk: T * 2.2, spawnT: 0, alpha: 1, d: h.horse }, 0);
    drawBody(x, y - r * 0.6, rr, 0, { ...h.style, noShadow: true, bob: Math.abs(Math.sin(T * 2.2)) * 2, weapon: { kind: h.style.weapon, ang: -1.0, len: 120 } });
  } else drawBody(x, y, 40, Math.PI / 2, { ...h.style, bob: Math.abs(Math.sin(T * 2.2)) * 2, weapon: { kind: h.style.weapon, ang: -1.0, len: 120 } });
}
