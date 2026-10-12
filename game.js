'use strict';
/* ===================================================================
 * 삼국 맹장전 — 액션 RPG 인게임 전투 프로토타입
 *  - 영웅 관우: 3연타 콤보 / 스킬 2종 / 궁극기 / 회피 / 오토 전투
 *  - 적: 여포군 보병(근접), 궁병, 철기병(돌진), 장수, 보스 여포(슈퍼아머: 보스·관우 회전참 시전 중)
 *  - 웨이브 4단계 → 보스전 → 클리어
 * =================================================================== */

// ---------- 기본 설정 ----------
const W = 1280, H = 720;
const WORLD = { w: 2200, h: 1400 };
const cv = document.getElementById('game'); let ctx = cv.getContext('2d');   // ctx: 아웃라인 렌더링 때 잠시 오프스크린으로 교체
cv.width = W; cv.height = H;
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
function fit() {
  const vw = (window.visualViewport && visualViewport.width) || innerWidth, vh = (window.visualViewport && visualViewport.height) || innerHeight;
  const s = Math.min(vw / W, vh / H); cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px';
}
addEventListener('resize', fit); addEventListener('orientationchange', () => setTimeout(fit, 200)); fit();
// 모바일: 첫 터치에서 전체화면 + 가로 고정 시도 (지원 안 하는 브라우저는 무시)
let fsTried = false;
function tryFullscreen() {
  if (fsTried || !IS_TOUCH) return; fsTried = true;
  try {
    const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) Promise.resolve(req.call(el, { navigationUI: 'hide' })).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => { });
  } catch (_) { }
}
const FONT = '"Malgun Gothic","Apple SD Gothic Neo",sans-serif';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return Math.abs(d); };

// 온라인 대전 상태 (자세한 구현은 '온라인 대전' 블록)
const NET = { on: false, role: null, ws: null, open: false, code: '', status: '', peerHero: null, hero: 'guan', inMatch: false, paired: false, url: 'ws://localhost:8787', snaps: [], sendT: 0, inT: 0, sfxQ: [], fxSeen: new WeakSet(), dtSeen: new WeakSet(), me: null, opp: null, lastEnd: null, lastNew: null, aborted: false, lastSt: '' };
try { NET.url = localStorage.getItem('sgb_net_url') || NET.url; } catch (_) { }

// ---------- 사운드 (WebAudio 합성) ----------
let AC = null;
const SFX = { hit: ['square', 180, 60, .08, .1], swing: ['sawtooth', 520, 160, .07, .05], boom: ['sawtooth', 100, 28, .7, .3],
  hurt: ['square', 130, 50, .16, .14], heal: ['triangle', 420, 880, .2, .1], dash: ['triangle', 300, 760, .1, .07], skill: ['sawtooth', 320, 90, .28, .1], enemy: ['square', 90, 60, .1, .05] };
function sfx(k) {
  if (NET.on && NET.role === 'host') NET.sfxQ.push(k);   // 온라인 대전: 방장이 낸 소리를 게스트에게도 전달
  try {
    if (!AC) AC = new AudioContext();
    if (AC.state === 'suspended') AC.resume();
    const c = SFX[k], t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.type = c[0]; o.frequency.setValueAtTime(c[1], t); o.frequency.exponentialRampToValueAtTime(c[2], t + c[3]);
    g.gain.setValueAtTime(c[4], t); g.gain.exponentialRampToValueAtTime(0.001, t + c[3]);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + c[3] + .02);
  } catch (e) { }
}

// ---------- 입력 ----------
let T = 0;
const buf = { attack: -9, s1: -9, s2: -9, s3: -9, dash: -9, tag0: -9, tag1: -9, tag2: -9, tag3: -9 };
let TUT = null;   // 튜토리얼 진행 상태
const press = n => { buf[n] = T; if (TUT) tutEvent(n); }, want = n => T - buf[n] < 0.3, use = n => buf[n] = -9;
const holdSrc = {};
const attackHeld = () => Object.values(holdSrc).some(Boolean);
const keys = {};
let auto = false, state = 'account', joy = null;   // 시작 = 계정 선택 화면 (계정을 고른 뒤 로비)
const KEYMAP = { KeyJ: 'attack', KeyK: 's1', Digit1: 's1', KeyL: 's2', Digit2: 's2', Semicolon: 's3', Digit3: 's3', Space: 'dash', KeyU: 'dash', KeyZ: 'tag0', KeyX: 'tag1', KeyC: 'tag2', KeyV: 'tag3' };   // Z X C: 출전 순서대로 태그
addEventListener('keydown', e => {
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (state === 'account') { accountKey(e.code); return; }
  if (state === 'info') { infoKey(e.code); return; }
  if (state === 'title' && e.code === 'KeyI') { openInfo(); return; }
  if (state === 'title' && e.code === 'Escape') { if (helpOpen) helpOpen = false; else { state = 'account'; accPopup = false; } return; }
  if (state === 'title' && (e.code === 'KeyH' || e.code === 'Slash')) { helpOpen = !helpOpen; return; }
  if (state === 'title' && helpOpen) return;
  if (state === 'waves') { wavesKey(e.code); return; }
  if (state === 'duelMenu') { duelMenuKey(e.code); return; }
  if (state === 'raidMenu') { raidMenuKey(e.code); return; }
  if (state === 'raidBoss') { raidBossKey(e.code); return; }
  if (state === 'pick') { pickKey(e.code); return; }
  if (state === 'upgrade') { const m = /^Digit([1-3])$/.exec(e.code); if (m) pickUpgrade(+m[1] - 1); else if (e.code === 'Tab' || e.code === 'KeyT') auto = !auto; return; }
  if (state === 'title') {   // 로비: ← → (A D, 1 2) 로 모드를 고르고 Enter / Space 로 입장
    const sn = STAGE_HEROES.length + 1;   // 모드 카드 2개 + 장수 정보 배너
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') lobbySel = (lobbySel + sn - 1) % sn;
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') lobbySel = (lobbySel + 1) % sn;
    else if (/^Digit[1-4]$/.test(e.code)) { const k = +e.code.slice(5) - 1; if (k >= STAGE_HEROES.length) openInfo(); else { lobbySel = k; enterMode(k); } }
    else if (e.code === 'Enter' || e.code === 'Space') { if (lobbySel >= STAGE_HEROES.length) openInfo(); else enterMode(lobbySel); }
    return;
  }
  if ((state === 'win' || state === 'lose') && (e.code === 'KeyR' || e.code === 'Enter')) { restartMode(); return; }
  if ((state === 'win' || state === 'lose') && (e.code === 'KeyC' || e.code === 'Escape')) { if (NET.on) netLeave(); else state = 'title'; return; }
  if (paused) { if (e.code === 'KeyP' || e.code === 'Escape' || e.code === 'Enter') closePause(); return; }
  if (!TUT && mode === 'yeonui' && state === 'play' && (e.code === 'KeyP' || e.code === 'Escape')) { openPause('pause'); return; }
  if (TUT && state === 'play') { if (e.code === 'Escape') { tutEnd(true); return; } if (e.code === 'Enter') { tutEvent('ok'); return; } }
  if (e.code === 'KeyM' && mode === 'duel') { meterOn = !meterOn; return; }   // 비무장 미터기 접기/펴기
  if (e.code === 'KeyQ' && (mode === 'duel' || RAID) && state === 'play') { if (NET.on) netCycle(); else cycleControl(); return; }   // 비무장 모드: Q = 다음 아군으로 조작 변경
  if (CAM_FREE && (e.code === 'KeyG' || e.code === 'Home')) { centerCam(); return; }   // SC1 식 시점: 영웅 위치로 이동
  if (CAM_FREE && e.code === 'KeyH') { camLock = !camLock; if (camLock) centerCam(); return; }   // 영웅 추적 켜기 / 끄기
  if (e.code === 'Tab' || e.code === 'KeyT') { toggleAuto(); return; }
  const a = KEYMAP[e.code];
  if (a) { press(a); if (a === 'attack') holdSrc.key = true; }
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'KeyJ') holdSrc.key = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; for (const k in holdSrc) holdSrc[k] = false; });

const BTN = [   // 오른쪽 하단 조작 버튼 (이전보다 작게, 화면 가장자리에 모음)
  { id: 'attack', x: 1168, y: 614, r: 74, label: '공격' },   // 전투 버튼 확대 (공격 54->74 / 스킬 34->46 / 궁극기 38->52 / 회피 28->38 / AUTO 22->28)
  { id: 's1', x: 1028, y: 662, r: 46, label: '회전참', key: 'K' },
  { id: 's2', x: 1040, y: 556, r: 46, label: '청룡참', key: 'L' },
  { id: 's3', x: 1140, y: 462, r: 52, label: '청룡의 힘', key: ';' },
  { id: 'dash', x: 1232, y: 498, r: 38, label: '회피', key: 'Space' },
  { id: 'auto', x: 1224, y: 58, r: 46, label: 'AUTO', key: 'T' },   // AUTO 버튼 반지름 28 -> 46
];
// ===== 태그 시스템: 전투 중 관우 / 여포 / 조운으로 즉시 교체. 교체해 들어온 영웅은 태그 스킬을 발동 =====
const ULT_SLOW = 2.2;   // 궁극기 사용 시 일괄 슬로우 모션 시간(실시간 초): 플레이어·적·투사체·이펙트 전부 0.3배
const RUSH_SLOW = ULT_SLOW / 3;   // 적토 돌격: 질주 한 번마다 시작할 때 걸리는 슬로 모션(실시간 초) — 5회 합계 = ULT_SLOW
const BENCH_REGEN = 0.02;   // 대기 중인 영웅의 초당 생명력 회복 비율 (최대 생명력 기준)
const TAG_SLOW = 2.0;   // 태그 스킬 사용 시 일괄 슬로우 모션 시간(실시간 초) — 이전 1.0 + 1초
const TAG_CD = 6;   // 태그 재사용 대기시간(초): 전원 공통
const TAG_BTN_R = 38;   // 태그 버튼 반지름 24 -> 38 (터치하기 쉽게 확대)
const tagBtnPos = i => ({ x: 54, y: 262 + i * 108 });
function tagBtnAt(x, y) { if (state !== 'play' || mode === 'duel') return -1; for (let i = 0; i < TEAM.length; i++) { const b = tagBtnPos(i); if (Math.hypot(x - b.x, y - b.y) <= TAG_BTN_R + 12) return i; } return -1; }
let paused = false, pauseKind = 'pause';   // 로그라이크 일시정지 (pauseKind: 'pause' = 일시정지 / 'exit' = 나가기 확인)
const PAUSE_BTN = { x: 1146, y: 14, w: 122, h: 46 }, PAUSE_UI = { go: { x: W / 2 - 260, y: 500, w: 240, h: 56 }, exit: { x: W / 2 + 20, y: 500, w: 240, h: 56 } };
function openPause(kind) { if (TUT || mode !== 'yeonui' || state !== 'play') return; paused = true; pauseKind = kind; joy = null; for (const k in holdSrc) delete holdSrc[k]; for (const k in buf) buf[k] = -9; sfx('hit'); }
function closePause() { paused = false; for (const k in buf) buf[k] = -9; sfx('hit'); }
function pauseExit() { paused = false; RS.exited = true; state = 'lose'; winT = 0; sfx('skill'); }   // 나가기: 지금까지의 기록으로 경험치를 정산 (update 에서 settleRun)
function xpGains() {   // 지금 나가면 받게 될 경험치 (settleRun 의 패배 정산과 같은 식)
  const heroes = (RAID ? RAID_HEROES : TEAM).slice(), dmgOf = h => RS.dmg[h] || 0, pool = RS.waves * 50 + RS.boss * 250 + Math.floor(heroes.reduce((t, h) => t + dmgOf(h), 0) / 30) + RS.kills, sumD = heroes.reduce((t, h) => t + dmgOf(h), 0), n = heroes.length;
  return heroes.map(h => ({ hero: h, gain: Math.round(pool * (0.3 / n + 0.7 * (sumD ? dmgOf(h) / sumD : 1 / n))) }));
}
function pauseClick(x, y) { if (inRect(x, y, PAUSE_UI.go)) closePause(); else if (inRect(x, y, PAUSE_UI.exit)) pauseExit(); }
function drawPauseButton() { for (const [r, label, col, tc] of [[PAUSE_BTN, '정지', '#9ad4ff', '#cfe8ff']]) { ctx.fillStyle = 'rgba(10,12,20,.6)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.strokeRect(r.x, r.y, r.w, r.h); text(label, r.x + r.w / 2, r.y + r.h / 2 + 7, 20, tc, 'center'); } }   // 오른쪽 위: 정지 / 나가기 (AUTO 가 있던 자리)
function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(4,6,12,.78)'; ctx.fillRect(0, 0, W, H);
  text(pauseKind === 'exit' ? '나가시겠습니까?' : '일시정지', W / 2, 150, 54, pauseKind === 'exit' ? '#ff9a8a' : '#ffd34d', 'center');
  text('나가면 지금까지 획득한 경험치가 영웅 레벨에 한꺼번에 반영됩니다  (현재 WAVE ' + (waveIdx + 1) + ' · 처치 ' + kills + ')', W / 2, 196, 17, '#cfd3e6', 'center', false);
  const g = xpGains(); text('지금 나가면 받는 경험치', W / 2, 250, 20, '#ffe9a0', 'center');
  g.forEach((r, i) => { const y = 292 + i * 44, rec = ACC ? heroRec(ACC, r.hero) : { lv: 1, xp: 0 }; ctx.fillStyle = 'rgba(12,14,24,.9)'; ctx.fillRect(W / 2 - 260, y - 26, 520, 38); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.strokeRect(W / 2 - 260, y - 26, 520, 38); text(PC_NAME[r.hero], W / 2 - 240, y, 18, '#fff', 'left'); text('Lv ' + rec.lv, W / 2 - 120, y, 16, '#9ad4ff', 'left'); text('+' + r.gain + ' XP', W / 2 + 240, y, 18, '#9dff9d', 'right'); });
  const bt = (r, label, col) => { ctx.fillStyle = 'rgba(10,12,20,.92)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.strokeRect(r.x, r.y, r.w, r.h); text(label, r.x + r.w / 2, r.y + 37, 24, col, 'center'); };
  bt(PAUSE_UI.go, '계속하기' + (IS_TOUCH ? '' : '  (P)'), '#7dff9a'); bt(PAUSE_UI.exit, '나가기 · 경험치 정산', '#ff9a8a');
}
function toggleAuto() { auto = !auto; if (TUT && auto) tutEvent('auto'); if (NET.on && NET.role === 'guest') netSend({ k: 'auto', on: auto }); }   // 온라인 게스트는 방장에게 자동 전투 여부를 알림
function goLobby() { if (NET.on) { netLeave(); return; } state = 'title'; auto = false; joy = null; for (const k in holdSrc) delete holdSrc[k]; for (const k in buf) buf[k] = -9; }   // 로비(영웅 선택) 화면으로 이동
function pt(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
// 화면 상단의 웨이브 선택 버튼 (전투 중에도 눌러서 해당 웨이브의 시작 시점으로 즉시 이동)
const WAVE_BTN = { w: 46, h: 26, gap: 6, x: 12, y: 664 };   // 왼쪽 하단 가로 한 줄: W1 W2 W3 보스 로비 (로비 = 인덱스 WAVES.length)
function waveBtnRect(i) { return { x: WAVE_BTN.x + i * (WAVE_BTN.w + WAVE_BTN.gap), y: WAVE_BTN.y, w: WAVE_BTN.w, h: WAVE_BTN.h }; }
const lobbyBtnRect = () => waveBtnRect(0);   // 인게임에는 로비 버튼만 남김 (웨이브 이동 버튼 제거)
function waveBtnAt(x, y) { for (let i = 0; i < WAVES.length; i++) { const r = waveBtnRect(i); if (x >= r.x - 3 && x <= r.x + r.w + 3 && y >= r.y - 3 && y <= r.y + r.h + 3) return i; } return -1; }
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) { }
  tryFullscreen(); sfx('enemy');
  const { x, y } = pt(e);
  if (iconTip) { iconTip = null; return; }   // 아이콘 상세 팝업이 열려 있으면 어디를 눌러도 닫기만 한다
  { const hit = (state === 'play' || state === 'upgrade') ? ICON_HITS.find(r => inRect(x, y, r)) : null; if (hit) { iconTip = { tip: hit.tip, x: hit.x, y: hit.y, t0: T }; sfx('hit'); return; } }
  if (state === 'account') { accountClick(x, y); return; }
  if (state === 'info') { infoClick(x, y); return; }
  if (state === 'title') {
    if (helpOpen) { for (let i = 0; i < 3; i++) if (ACC && inRect(x, y, tutBtnRect(i))) { ACC.tut = ACC.tut || {}; ACC.tut[['yeonui', 'duel', 'raid'][i]] = false; helpOpen = false; lobbySel = i; enterMode(i); return; } helpOpen = false; return; }
    if (inRect(x, y, HELP_BTN)) { helpOpen = true; sfx('hit'); return; }
    if (inRect(x, y, ACC_BTN)) { state = 'account'; accPopup = true; return; }
    if (inRect(x, y, INFO_BTN)) { openInfo(); return; }
    if (inRect(x, y, LOBBY_HERO_BOX)) { lobbyHero = HERO_IDS[(Math.max(0, HERO_IDS.indexOf(lobbyHero || selHero)) + 1) % HERO_IDS.length]; lobbyHeroT = 0; sfx('hit'); return; }
  }
  if (state === 'waves') { wavesClick(x, y); return; }
  if (state === 'duelMenu') { duelMenuClick(x, y); return; }
  if (state === 'raidMenu') { raidMenuClick(x, y); return; }
  if (state === 'raidBoss') { raidBossClick(x, y); return; }
  if (state === 'pick') { pickClick(x, y); return; }
  if (state === 'upgrade') { upgradeClick(x, y); return; }
  if (paused) { pauseClick(x, y); return; }
  if (TUT && state === 'play' && tutClick(x, y)) return;
  if (mode === 'duel' && duel && (state === 'play' || state === 'win' || state === 'lose') && inRect(x, y, meterHdr())) { meterOn = !meterOn; return; }   // 미터기 제목 줄: 접기/펴기
  if (state === 'play' && MINIMAP_ON) { if (inRect(x, y, MM_LOCK)) { camLock = !camLock; if (camLock) centerCam(); return; } if (inRect(x, y, { x: MM.x - 3, y: MM.y - 3, w: MM.w + 6, h: MM.h + 6 })) { mmDrag = e.pointerId; mmJump(x, y); return; } }   // 미니맵: 누르면 그 위치로 시점 이동
  if (mode === 'yeonui' && state === 'play' && inRect(x, y, PAUSE_BTN)) { openPause('pause'); return; }   // 전투 멈춤
  if (state !== 'title') { const lr = lobbyBtnRect(); if (x >= lr.x - 3 && x <= lr.x + lr.w + 3 && y >= lr.y - 3 && y <= lr.y + lr.h + 3) { if (mode === 'yeonui' && state === 'play') return; goLobby(); return; }  }   // 웨이브 선택 버튼 (전투 중·승패 화면 모두)
  if (state === 'title') { const ci = cardAt(x, y); if (ci >= 0) { lobbySel = ci; enterMode(ci); } return; }   // 카드를 누르면 그 영웅으로 바로 시작
  if (state === 'win' || state === 'lose') {   // 결과 화면이 보일 때만, 두 버튼만 동작
    const vis = mode === 'duel' ? (state === 'win' ? winT > 1.0 : winT > 0.6) : (state === 'win' ? winT > 1.2 : true); if (!vis) return;
    if (inRect(x, y, OVERLAY_BTN)) { if (NET.on) netLeave(); else state = 'title'; } else if (inRect(x, y, OVERLAY_RETRY)) restartMode();
    return;
  }
  const di = duelRowAt(x, y); if (di >= 0) { if (NET.on) { netSwap(di); return; } const u = allies.find(a => pcId(a.hero) === (duel || RD).order[di]); if (u) swapControl(u); return; }   // 비무장 모드: 아군 초상화 클릭 = 조작 영웅 변경
  const ti = tagBtnAt(x, y); if (ti >= 0) { press('tag' + ti); return; }   // 태그 버튼 (왼쪽 화면)
  const b = BTN.find(b => Math.hypot(x - b.x, y - b.y) <= b.r + 6);
  if (b) {
    if (b.id === 'auto') toggleAuto(); else { press(b.id); if (b.id === 'attack') holdSrc['p' + e.pointerId] = true; }
    return;
  }
  if (e.pointerType !== 'mouse' && x < W * 0.5) { joy = { id: e.pointerId, cx: x, cy: y, x, y }; return; }
  press('attack'); holdSrc['p' + e.pointerId] = true;
});
cv.addEventListener('pointermove', e => { if (state === 'title' && e.pointerType === 'mouse') { const p = pt(e), ci = cardAt(p.x, p.y); if (ci >= 0) lobbySel = ci; } if (joy && joy.id === e.pointerId) { const p = pt(e); joy.x = p.x; joy.y = p.y; } });
const pup = e => { delete holdSrc['p' + e.pointerId]; if (joy && joy.id === e.pointerId) joy = null; if (mmDrag === e.pointerId) mmDrag = null; };
cv.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { const p = pt(e); mouseP.x = p.x; mouseP.y = p.y; mouseP.in = true; } if (mmDrag === e.pointerId) { const p = pt(e); mmJump(p.x, p.y); } });
cv.addEventListener('pointerleave', () => { mouseP.in = false; });
addEventListener('blur', () => { mouseP.in = false; });
cv.addEventListener('pointerup', pup); cv.addEventListener('pointercancel', pup);
cv.addEventListener('contextmenu', e => e.preventDefault());

function manualMove() {
  let mx = 0, my = 0;
  if (keys.KeyA || keys.ArrowLeft) mx--; if (keys.KeyD || keys.ArrowRight) mx++;
  if (keys.KeyW || keys.ArrowUp) my--; if (keys.KeyS || keys.ArrowDown) my++;
  if (joy) { const dx = joy.x - joy.cx, dy = joy.y - joy.cy, l = Math.hypot(dx, dy); if (l > 8) { const k = Math.min(1, l / 70); mx += dx / l * k; my += dy / l * k; } }
  return { mx, my };
}

// ---------- 월드 배경 (사전 렌더) ----------
const bg = document.createElement('canvas'); bg.width = WORLD.w; bg.height = WORLD.h;
(function buildBG() {
  const g = bg.getContext('2d'); let s = 12345; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#7a6a47'; g.fillRect(0, 0, WORLD.w, WORLD.h);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${90 + r() * 60 | 0},${70 + r() * 50 | 0},${40 + r() * 30 | 0},${0.12 + r() * 0.18})`; g.beginPath(); g.ellipse(r() * WORLD.w, r() * WORLD.h, 4 + r() * 16, 2 + r() * 8, 0, 0, TAU); g.fill(); }
  // 외곽 풀밭
  const eg = g.createRadialGradient(WORLD.w / 2, WORLD.h / 2, 430, WORLD.w / 2, WORLD.h / 2, 1100);
  eg.addColorStop(0, 'rgba(70,100,50,0)'); eg.addColorStop(1, 'rgba(70,100,50,.75)');
  g.fillStyle = eg; g.fillRect(0, 0, WORLD.w, WORLD.h);
  for (let i = 0; i < 700; i++) { const x = r() * WORLD.w, y = r() * WORLD.h; if (Math.hypot(x - WORLD.w / 2, (y - WORLD.h / 2) * 1.3) < 560) continue; g.strokeStyle = `rgba(40,${100 + r() * 50 | 0},40,.55)`; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y - 9); g.moveTo(x, y); g.lineTo(x + 4, y - 8); g.stroke(); }
  // 중앙 전장
  g.fillStyle = 'rgba(160,140,95,.35)'; g.beginPath(); g.ellipse(WORLD.w / 2, WORLD.h / 2, 560, 430, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(60,40,20,.55)'; g.lineWidth = 6; g.stroke();
  g.strokeStyle = 'rgba(60,40,20,.25)'; g.lineWidth = 3; g.beginPath(); g.ellipse(WORLD.w / 2, WORLD.h / 2, 400, 300, 0, 0, TAU); g.stroke();
  g.beginPath(); g.moveTo(WORLD.w / 2 - 560, WORLD.h / 2); g.lineTo(WORLD.w / 2 + 560, WORLD.h / 2); g.moveTo(WORLD.w / 2, WORLD.h / 2 - 430); g.lineTo(WORLD.w / 2, WORLD.h / 2 + 430); g.stroke();
  // SC1 식 지면: 32px 정사각 타일 (타일마다 밝기가 조금씩 다르고 이음매가 보임)
  for (let ty = 0; ty < WORLD.h; ty += 32) for (let tx = 0; tx < WORLD.w; tx += 32) { const v = r(); g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.02 + v * 0.09})` : `rgba(255,240,200,${0.012 + (v - 0.5) * 0.07})`; g.fillRect(tx, ty, 32, 32); }
  g.strokeStyle = 'rgba(0,0,0,.09)'; g.lineWidth = 1; g.beginPath(); for (let x = 0; x <= WORLD.w; x += 32) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, WORLD.h); } for (let y = 0; y <= WORLD.h; y += 32) { g.moveTo(0, y + 0.5); g.lineTo(WORLD.w, y + 0.5); } g.stroke();
  // 바위
  for (let i = 0; i < 60; i++) { let x = r() * WORLD.w, y = r() * WORLD.h; if (x > 140 && x < WORLD.w - 140 && y > 140 && y < WORLD.h - 140) { x = r() < .5 ? r() * 120 : WORLD.w - r() * 120; } const rr = 10 + r() * 22; g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x, y + rr * .5, rr * 1.2, rr * .5, 0, 0, TAU); g.fill(); g.fillStyle = `rgb(${110 + r() * 30 | 0},${105 + r() * 25 | 0},${95 + r() * 20 | 0})`; g.beginPath(); g.ellipse(x, y, rr, rr * .75, 0, 0, TAU); g.fill(); }
  // 경계 어둠 + 목책
  g.fillStyle = 'rgba(0,0,0,.55)'; const m = 60;
  g.fillRect(0, 0, WORLD.w, m); g.fillRect(0, WORLD.h - m, WORLD.w, m); g.fillRect(0, 0, m, WORLD.h); g.fillRect(WORLD.w - m, 0, m, WORLD.h);
  g.fillStyle = '#4a3320';
  for (let x = 0; x < WORLD.w; x += 34) { g.fillRect(x, 20, 12, 44); g.fillRect(x, WORLD.h - 64, 12, 44); }
  for (let y = 0; y < WORLD.h; y += 34) { g.fillRect(20, y, 44, 12); g.fillRect(WORLD.w - 64, y, 44, 12); }
})();

// ---------- 영웅 ----------
// 두 영웅은 능력치·쿨타임·피해 배율·범위가 완전히 동일하다 (밸런스 기조 동일). 달라지는 것은 외형·스킬 이름·연출뿐.
const HERO_STATS = { hp: 1200, atk: 60, speed: 270, r: 20 };
const HEROES = {
  guan: {
    id: 'guan', name: '관우 운장', short: '관우', sub: '3단 공격 성공 시 방어 +50% (10초)', sub2: '청룡의 힘 사용 시 방어 +50% (10초)', mounted: false,
    skills: { attack: '공격', s1: '회전참', s2: '청룡참', s3: '청룡의 힘' },
    info: [['J', '공격', '베기·베기·360° 회전베기'], ['K', '회전참', '제자리 3연속 회전 (슈퍼아머)'], ['L', '청룡참', '전방 돌진·폭발, 멀리 밀쳐냄'], [';', '청룡의 힘', '청룡 강림 · 범위 내 기절 · 방어 +50%']],
    style: { body: '#2f8f5b', trim: '#d4a73a', skin: '#c9553f', cape: '#1f6a42', beard: true, hat: true, weapon: 'glaive' },
    fx: { a: '#d8f4ff', s: '#bff6ff' },
    // 60초 DPS 균형 계수 (공격 a / 스킬1 s1 / 스킬2 s2 / 궁극기 u): 모든 영웅(여포는 상마·하마 각각)의 60초 단일 대상 DPS 와 카테고리별 피해가 모두 같아지도록 측정·보정한 값 — 플레이어·AI 공통
    bal: { a: 1.61, s1: 1.127, s2: 1.504, u: 1.234 },
    combo: 'guan', guard: { bonus: 0.5, dur: 10 }, ultGuard: 0.5, ultGuardDur: 10,   // 방어: 3단 공격 성공 시 방어력 +50% (10초) / 청룡의 힘 사용 시 방어력 +50% (10초)
    tag: { name: '청룡 강림', title: '관우 운장', rgb: '127,255,208' },
    ult: { a: '#7fffd0', b: '#bfffe6', c: '#3affc0', rgb: '127,255,208', light: '160,255,225', core: '220,255,240', bar: '#2fb892', barBg: '#12302a', tipH: 140 },
  },
  lubu: {
    id: 'lubu', name: '여포 봉선 (상마)', short: '여포', sub: '3단 공격 성공 시 질주 이속 +20% (10초)', sub2: '50 HIT부터 10 HIT마다 공속·피해 +1%', mounted: true,
    skills: { attack: '공격', s1: '하마 전환', s2: '돌격', s3: '적토 돌격' },
    info: [['J', '공격', '찌르기 · 베기 · 360° 회전 베기'], ['K', '하마 전환', '적토마에서 내려 하마 여포로 전환 + 360° 베기 1회 (찌르기를 대체) · 스킬2 쿨타임은 폼별'], ['L', '돌격', '전방 질주 1회 + 폭발 (쿨타임 7초)'], [';', '적토 돌격', '3연속 질주 · 무적 · 기절 · 후 공격 +30%']],
    bal: { a: 0.88, s1: 1.066, s2: 2.9, u: 1.422 }, pc: 'lubu', s1Switch: true, rush: true, ultRush: true, combo: 'lubu', atkSlow: 1, tag: { name: '적토 강습', title: '여포 (상마)', rgb: '255,110,60' }, hitBonus: { start: 50, step: 10, per: 0.01 }, runBonus: 1.2, postUltAtk: 1.3, postUltDur: 10, runTime: 1.5, runDur: 10, s2cdMul: 1, ultStyle: 'halberd',
    style: { body: '#2a2030', trim: '#c9302c', skin: '#e0b08a', helm: true, feathers: true, pauldrons: true, weapon: 'halberd' },
    horse: { horseCoat: '#a8321f', barding: '#2a2030' },
    fx: { a: '#ffc9a0', s: '#ffd9b0' },
    ult: { a: '#ff7a3a', b: '#ffd27a', c: '#ff3a2a', rgb: '255,110,60', light: '255,190,120', core: '255,240,210', bar: '#d9552a', barBg: '#3a1510', tipH: 150 },
  },
};
// 여포 하마: 적토마에서 내린 도보 영웅. 수치는 관우·여포(상마)와 동일하고 스킬 구성만 다르다.
HEROES.lubu2 = { ...HEROES.lubu, bal: { a: 1.34, s1: 0.854, s2: 2.4, u: 1.285 }, id: 'lubu2', name: '여포 봉선 (하마)', sub: '3단 콤보 완주 시 공격 +10% (10초)', sub2: '', mounted: false, rush: false, ultRush: false, shoot: true, lUlt: true, combo: 'lubu2', tag: { name: '방천 베기', title: '여포 (하마)', rgb: '255,160,60' }, runBonus: 0, hitBonus: null, atkSlow: 0, postUltAtk: 1.2, comboBuff: { atk: 1.1, dur: 10 }, s2cdMul: 1,
  skills: { attack: '공격', s1: '상마 전환', s2: '연사', s3: '천하무쌍' },
  info: [['J', '공격', '1단 찌르기 · 2~3단 좌우 베기'], ['K', '상마 전환', '적토마에 올라 상마 여포로 전환 + 360° 베기 1회 (방천 베기를 대체) · 스킬2 쿨타임은 폼별'], ['L', '연사', '3연속 관통 화살 일제 사격'], [';', '천하무쌍', '방천화극 360° 휘두르기 + 검기 연타 · 기절 · 후 공격 +20%']] };
// 조운 자룡: 도보 창술 영웅. 수치(체력·공격력·이동속도·쿨타임·피해 배율)는 다른 PC 와 동일. 창(lance)으로 찌르는 연타형 — 공격 3단 성공 시 공속 +10%(10초), 궁극기 후 공속 +10%(10초)
HEROES.zhao = {
  id: 'zhao', name: '조운 자룡', short: '조운', sub: '3단 공격 성공 시 공속 +10% (10초)', sub2: '백룡강림 후 공속 +10% (10초)', mounted: false,
  skills: { attack: '공격', s1: '칠진칠출', s2: '단기필마', s3: '백룡강림' },
  info: [['J', '공격', '찌르기 · 휘두르기 · 3연속 찌르기'], ['K', '칠진칠출', '전방 4연속 찌르기 (슈퍼아머)'], ['L', '단기필마', '빠르고 좁은 돌격 + 폭발'], [';', '백룡강림', '고속 이동 연속 찌르기 (범위 내 최대 5명) · 기절 · 후 공속 +10%']],
  style: { body: '#2b6a6e', trim: '#c9cfd8', skin: '#e0b08a', cape: '#1f4a50', hair: true, band: true, pauldrons: true, weapon: 'lance' },
  fx: { a: '#e6f6ff', s: '#cfeaff' },
  ult: { a: '#7fd0ff', b: '#d8f0ff', c: '#3aa0ff', rgb: '127,208,255', light: '170,225,255', core: '225,243,255', bar: '#3a9ad9', barBg: '#10283a', tipH: 150 },
  bal: { a: 0.72, s1: 1.4, s2: 1.4, u: 0.869 },
  combo: 'zhao', s1Flurry: true, rush: true, rushSpec: 'zhao', ultStyle: 'lance', zUlt: true, s1cdMul: 1.6, postUltAspd: 1.10, postUltDur: 10, aspdBuff: { mult: 1.10, dur: 10 }, s2cdMul: 1,
  tag: { name: '백룡 강습', title: '조운 자룡', rgb: '127,208,255' },
};
// 초선(貂蟬): 도보 힐러. 체력·공격력·이동속도·쿨타임·범위는 다른 PC 와 같고, 피해 대신 회복·지원을 맡는다 (피해 계수 bal 은 낮음)
//  K 연꽃 치유(범위 아군 회복 3회 + 적에게 약한 피해) / L 월하 축복(아군 전체 공격력·방어력 +10%) / ; 경국지색(큰 회복 + 적 기절)
HEROES.diao = {
  id: 'diao', name: '초선 (貂蟬)', short: '초선', sub: '3단 공격 성공 시 주변 아군 생명력 +1.5% 회복', sub2: '월하 축복: 아군 전체 공격력·방어력 +10% (10초)', mounted: false, pc: 'diao',
  skills: { attack: '공격', s1: '연꽃 치유', s2: '월하 축복', s3: '경국지색' },
  info: [['J', '공격', '부채 베기 · 반대 베기 · 360° 꽃잎 회전 (3단 성공 시 주변 아군 소량 회복)'], ['K', '연꽃 치유', '연꽃이 3번 피어나 범위 안 아군 생명력을 회복 + 적에게 약한 피해 (슈퍼아머)'], ['L', '월하 축복', '아군 전체 공격력·방어력 +10% (10초) + 주변 적 밀쳐냄'], [';', '경국지색', '범위 아군 생명력 대량 회복 + 범위 안 적 기절']],
  style: { body: '#c86aa8', trim: '#ffd34d', skin: '#f4d9bd', sleeves: '#f7b3d3', hairCap: true, longHair: true, crown: true, flower: true, weapon: 'fan' },
  fx: { a: '#ffd0e6', s: '#ffb3d6' },
  bal: { a: 0.95, s1: 0.8, s2: 1.0, u: 0.85 },
  combo: 'diao', s1Heal: true, bless: true, healUlt: true, comboHeal: true, ultStyle: 'lotus', s2cdMul: 2,
  tag: { name: '연꽃 강림', title: '초선 (貂蟬)', rgb: '255,150,200' },
  ult: { a: '#ff9ac8', b: '#ffd0e6', c: '#ff5aa8', rgb: '255,150,200', light: '255,200,225', core: '255,235,245', bar: '#d9558f', barBg: '#3a1028', tipH: 140 },
};
// 전위(典韋): 쌍철극을 쓰는 전위 돌격형 도보 영웅. 수치(체력·공격력·이동속도·쿨타임·범위)는 다른 PC 와 같다.
//  K 쌍극 투척(관통 극 2자루) / L 지축 강타(짧게 파고들어 내려찍음) / ; 불사의 광기 (트린다미어의 불사 컨셉: 전투당 1회 30초간 죽지 않음 / 시전마다 6초간 공격력 +30%·흡혈 25%)
HEROES.dian = {
  id: 'dian', name: '전위 (典韋)', short: '전위', sub: '3단 공격 성공 시 공격력 +12% (8초)', sub2: '불사의 광기: 전투당 1회 30초간 죽지 않음(생명력 1 보호) · 시전마다 6초간 공격력 +30% · 흡혈 25% · 고유: 상태 이상 저항(경직·스턴·둔화를 겪을수록 지속시간 감소, 5회 이후 20%, 60초 뒤 초기화)', mounted: false, pc: 'dian',
  skills: { attack: '공격', s1: '쌍극 투척', s2: '지축 강타', s3: '불사의 광기' },
  info: [['J', '공격', '쌍극 교차 베기 · 반대 베기 · 360° 회전 내려찍기 (3단 성공 시 공격력 +12%)'], ['K', '쌍극 투척', '쌍철극 두 자루를 던져 일직선의 적을 관통'], ['L', '지축 강타', '짧게 파고들어 쌍극으로 내려찍음 · 반경 240 · 멀리 밀쳐냄'], [';', '불사의 광기', '포효 폭발 + 6초간 공격력 +30%·흡혈 25% (시전마다) · 전투당 1회 30초간 죽지 않음 (생명력 1 보호)']],
  style: { body: '#8a3a22', trim: '#d4a73a', skin: '#c98a6a', beard: true, wrap: true, pauldrons: true, cape: '#5a2418', weapon: 'twin' },
  fx: { a: '#ffd9b8', s: '#ffb88a' },
  bal: { a: 3.02, s1: 2.08, s2: 3.78, u: 2.27 },   // 비무장(PvP) 계수: AI 가 피하기 쉬운 스킬(투척·내려찍기)이 많아 1대1 승률 50% 기준으로 맞춘 값
  combo: 'dian', s1Throw: true, slam: true, rageUlt: true, ultStyle: 'rage', comboBuff: { atk: 1.12, dur: 8 }, undy: { dur: 6, atk: 1.3, ls: 0.25, floor: 30 }, s2cdMul: 1,
  tag: { name: '악래 돌진', title: '전위 (典韋)', rgb: '255,90,60' },
  ult: { a: '#ff4a3a', b: '#ffb08a', c: '#c91f1f', rgb: '255,74,58', light: '255,150,120', core: '255,225,210', bar: '#c93a2a', barBg: '#3a1210', tipH: 140 },
};
// 황충(黃忠): 노장 궁수. 수치(체력·공격력·이동속도·쿨타임·공격 1~3단계 범위)는 다른 PC 와 같고, 스킬이 원거리 중심이다.
//  K 백보천양(관통 강궁) / L 화살비(지정 구역에 연속 낙하) / ; 마법의 수정화살 (롤 애쉬의 R: 아주 멀리 날아가 처음 맞은 적을 기절 — 멀리 날아갈수록 길게)
HEROES.huang = {
  id: 'huang', name: '황충 (黃忠)', short: '황충', sub: '원거리 저격: 멀리서 맞힐수록 피해 증가 (최대 +30~40%) · 이동하며 사격', sub2: '마법의 수정화살: 멀리 날아가 처음 맞은 적을 기절 (멀리 날수록 길게, 최대 3.5초)', mounted: false, pc: 'huang',
  skills: { attack: '공격', s1: '백보천양', s2: '화살비', s3: '수정화살' },
  info: [['J', '공격', '긴 사거리 화살 · 화살 · 3연사 — 이동하며 사격(이동속도 50%), 멀수록 피해 +30% (3단 성공 시 공속 +12%)'], ['K', '백보천양', '뒤로 물러나며 사거리 1400의 강궁 한 발 — 일직선의 적을 관통, 멀수록 피해 +40%'], ['L', '화살비', '지정한 구역(반경 185, 사거리 900)에 화살이 4번 연속 쏟아지며 적을 둔화(이동속도 -45%) · 시전 중 이동 가능'], [';', '마법의 수정화살', '아주 멀리(사거리 3000) 날아가 처음 맞은 적을 기절 (거리 비례 1~3.5초) + 주변 폭발 · 조준 중 이동 가능']],
  style: { body: '#5c5a3c', trim: '#d4a73a', skin: '#d9a98a', helm: true, helmColor: '#c9a24a', plume: 1, beard: true, beardColor: '#e8e4da', pauldrons: true, cape: '#a8321f', weapon: 'bow' },
  fx: { a: '#fff1c8', s: '#ffe08a' },
  bal: { a: 0.92, s1: 0.88, s2: 1.01, u: 0.88 },
  combo: 'huang', kite: true, aimR: 600, s1Snipe: true, rainS2: true, crystalUlt: true, ultStyle: 'crystal', aspdBuff: { mult: 1.12, dur: 8 }, s2cdMul: 1,
  tag: { name: '백발백중', title: '황충 (黃忠)', rgb: '255,220,120' },
  ult: { a: '#9fe8ff', b: '#e6faff', c: '#4ab8ff', rgb: '120,210,255', light: '190,235,255', core: '230,248,255', bar: '#3a9ad9', barBg: '#10283a', tipH: 140 },
};
// ===== 여포 = 하나의 PC. 상마(적토마)·하마(도보) 두 모습을 K 스킬로 전환 =====
//  상마 폼('lubu'): 공격 3단 콤보 / K 하마 전환 (찌르기를 대체) / L 돌격 / ; 적토 돌격
//  하마 폼('lubu2'): 공격 3단 콤보 / K 상마 전환 (방천 베기를 대체) / L 연사 / ; 천하무쌍
//  체력·태그·성장·경험치는 PC 하나(pc = 'lubu')로 공유하고, 폼마다 달라지는 것은 공격·스킬2·궁극기·버프.
const pcId = id => id === 'lubu2' ? 'lubu' : id;
let LUBU_FORM = 'lubu';   // 여포의 현재 폼 ('lubu' = 상마 / 'lubu2' = 하마)
const heroDef = pc => pc === 'lubu' ? HEROES[LUBU_FORM] : HEROES[pc];   // PC 의 현재 모습(폼)
const PC_NAME = { guan: '관우', lubu: '여포', zhao: '조운', diao: '초선', dian: '전위', huang: '황충' }, PC_TAG = { guan: '관우', lubu: '여포', zhao: '조운', diao: '초선', dian: '전위', huang: '황충' };
HEROES.guan.pc = 'guan'; HEROES.zhao.pc = 'zhao';
const BAL_BASE = {};
// 모드별 밸런스 계수: 로그라이크(PvE)와 비무장(PvP)은 상대가 다르므로(다수 몬스터 vs 회피하는 영웅) 각각 따로 측정해서 맞춘다.
//  PvE = 단일 대상·다수 상대 피해와 웨이브 생존이 비슷하도록 / PvD(비무장) = AI 1대1 승률이 40~60% 안에 들어오도록. 영웅 객체의 bal 은 현재 모드에 맞는 값을 돌려준다.
{
  const PVE = { guan: { a: 1.288, s1: 1.167, s2: 1.308, u: 1.234 }, lubu: { a: 1.303, s1: 1.066, s2: 1.505, u: 1.422 }, lubu2: { a: 1.443, s1: 0.854, s2: 0.933, u: 1.285 }, zhao: { a: 0.964, s1: 1.0, s2: 1.482, u: 0.999 }, diao: { a: 0.8, s1: 0.75, s2: 0.85, u: 0.75 }, dian: { a: 1.17, s1: 1.05, s2: 1.4, u: 0.58 }, huang: { a: 0.87, s1: 0.8, s2: 1.0, u: 0.72 } };
  for (const id in PVE) { const H = HEROES[id], duel = H.bal; BAL_BASE[id] = { pve: PVE[id], duel: { ...duel } }; H._balCur = { pve: PVE[id], duel }; Object.defineProperty(H, 'bal', { get() { return this._balCur[mode === 'duel' ? 'duel' : 'pve']; }, enumerable: true, configurable: true }); }
}
const HERO_IDS = ['lubu', 'zhao', 'guan', 'diao', 'dian', 'huang'];   // PC 4명 (여포는 상마·하마를 K 스킬로 전환하는 하나의 PC / 초선은 힐러)
let TEAM = ['guan', 'lubu', 'zhao'];   // 로그라이크 모드 출전 영웅 (1~3명, 선택 순서 = 태그 슬롯 Z / X / C). 첫 번째가 시작 영웅
const STAGE_HEROES = ['yeonui', 'duel', 'raid'];   // 로비 입장 버튼: 로그라이크 모드 / 비무장 모드   // 로비의 스테이지 버튼 순서: 여포 보스 스테이지(시작 영웅 관우) / 관우 보스 스테이지(시작 영웅 여포 상마)
const MOUNT_R = 28, RIDER_R = 22;   // 기마 영웅의 말·기수 그림 크기 (충돌 반경은 HERO_STATS.r 로 동일)
let selHero = 'guan';   // 스테이지 통합: 시작 영웅은 항상 관우 (전투 중 Z/X/C 태그로 교체)
let HERO = HEROES[selHero];
let curHero = selHero;   // 지금 조작 중인 영웅 id (태그로 바뀜). 로비에서 고른 영웅(selHero)이 시작 영웅
function selectHero(id) { if (!HEROES[id]) return; selHero = id; try { localStorage.setItem('sgb_hero', id); } catch (_) { } }
function applyLabels() { for (const b of BTN) if (HERO.skills[b.id]) b.label = HERO.skills[b.id]; try { refreshMeta(); } catch (_) { } }   // 영웅이 바뀔 때마다 그 영웅의 성장 보너스로 갱신
function applyHero() { HERO = heroDef(selHero); curHero = selHero; applyLabels(); applyFoeTheme(); }
// 시작 화면의 영웅 선택 카드 / 승패 화면의 '영웅 선택' 버튼
const CARD = { w: 380, h: 116, gap: 20, y: 214 };   // 로비 스테이지 입장 버튼 크기·위치
const cardRect = i => ({ x: W / 2 - 491 + i * 250, y: 616, w: 232, h: 84 });   // 로비 하단 내비게이션 항목 (0~2 = 모드, 3 = 장수 정보)
const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
function cardAt(x, y) { for (let i = 0; i < STAGE_HEROES.length; i++) if (inRect(x, y, cardRect(i))) return i; return -1; }
const OVERLAY_BTN = { x: W / 2 + 10, y: 500, w: 240, h: 48 }, OVERLAY_RETRY = { x: W / 2 - 250, y: 500, w: 240, h: 48 };   // 전투 종료 화면 버튼: 다시 시작(대기실) / 로비 — 버튼 이외의 화면을 눌러도 아무 일도 없다

// ---------- 게임 상태 ----------
const CD = { s1: 5, s2: 7, dash: 3 };
const DASH_CD_PVE = 2.5, DASH_INV_PVE = 0.42, DASH_DIST_PVE = 1.3;   // 로그라이크 회피: 쿨타임 3 -> 2.5초, 무적 0.26 -> 0.42초, 이동 거리 x1.3 (비무장은 기존 값)
const dashCdNow = () => mode === 'duel' ? CD.dash : DASH_CD_PVE, dashInvNow = () => mode === 'duel' ? 0.26 : DASH_INV_PVE, dashSpeedNow = () => mode === 'duel' ? 950 : 950 * DASH_DIST_PVE;   // 회피 쿨타임 3초 (모든 PC·AI 공통)
let P, enemies, projectiles, fx, dts, items;
const CAM_FREE = false;   // 자유 시점(SC1 식 방향키·가장자리 스크롤): 사용 안 함 — 카메라는 항상 영웅을 따라간다 (true 로 바꾸면 다시 켜짐)
let camLock = true, mmDrag = null;   // 시점 추적: PC 는 SC1 처럼 자유 시점(끔), 모바일은 영웅 추적(켬)
const MINIMAP_ON = false;   // 미니맵: 코드는 남겨 두되 사용하지 않음 (true 로 바꾸면 다시 켜짐)
const mouseP = { x: 0, y: 0, in: false }, MM = { x: 10, y: 534, w: 190, h: 121 }, MM_LOCK = { x: 156, y: 512, w: 44, h: 18 }, CAM_SPEED = 1100, EDGE_PX = 20;   // 마우스 위치 / 미니맵 / 추적 버튼 / 스크롤 속도(px/s) / 가장자리 스크롤 범위
let cam = { x: 0, y: 0 }, shake = 0, hitstop = 0, slowT = 0, flashT = 0;
let tagFx = null;   // 태그 연출 오버레이 { t, dur, id } (실시간)
let mode = 'yeonui', lobbySel = 0;   // mode: 'yeonui' = 로그라이크 모드(웨이브 스테이지) / 'duel' = 비무장 모드(3 vs 3)
let waveIdx, bannerT, spawnT, pendingSpawn, kills, winT, clock, autoDodgeCd;

const ENEMY_HP_MULT = 3, ENEMY_DMG_MULT = 2;   // 생명력 3배(=이전 2배 x 1.5)
const RANGED_ATK_RATE = 2;   // 원거리 공격(화살·투창 부채꼴) 공격속도 배율
const ENEMY_ATK_SLOW = 2;        // 적 공격 선딜·후딜·재공격 간격 배율 (2 = 공격속도 절반)
const ENEMY_ATK_SPEEDUP = 1.3;   // 일반 몬스터 공격속도 +30%
const BOSS_CAST_SPEEDUP = 1.62;  // 보스 여포 모든 스킬 시전 속도 (+35% 에서 다시 +20%: 1.35 x 1.2)
const COMBO_STEP = 50, COMBO_BONUS = 0.1, COMBO_MAX_TIER = 4;   // 콤보(HIT) 50마다 공격속도·피해량 +10% 누적, 200 HIT에서 최대(+40%). 3초간 적중이 없어 HIT 가 0으로 돌아가면 사라짐
const ULT_CD = 30;   // 궁극기 쿨타임(초): 모든 PC·AI 공통. 시간이 지나면 게이지(P.rage / f.rage 0~100)가 차오르고, 로그라이크 '궁극기 쿨타임 회복' 강화로 빨라진다 (피해로는 충전되지 않음)
const RAGE_PER_HIT = 1;                                  // 궁극기 게이지: 평타·회전참·청룡참이 적에게 적중할 때마다 +1 (처음 +4 -> +2 -> +1)
const SUPPLY_INTERVAL = 30;   // 보스 웨이브: 증원 없음. 30초마다 술·만두가 각각 1~2개씩 아레나 랜덤 위치에 등장
const BOSS_GLOBAL_CD_MULT = 0.4;                          // 여포 스킬 사용 후 다음 스킬까지의 글로벌 쿨타임 배율
const BOSS_AIM_LOCK = 0.45;   // 보스 돌진·부채꼴·도약: 시전 직전 이 시간(초) 동안은 플레이어를 따라가지 않음 (걷기 270px/s x 0.45초 = 122px > 돌진 판정 반폭 92)
const BOSS_WALK_WIND = 0.5;   // 보스 돌진·근거리 원형 선딜 하한(초): 대시(쿨타임 3초)가 없어도 걸어서 피할 수 있는 최소 시간
const BOSS_POST_DELAY_MULT = 1.5;                         // 여포 1페이즈(기마) 스킬이 끝난 뒤 딜레이(후딜 + 글로벌 쿨타임) 배율 — 1.5배 (2배에서 25% 감소, 2페이즈는 1배)
const S1_DMG_MULT = 1.5;                                  // 회전참 추가 피해 배율 (+50%, SKILL_DMG_MULT 위에 곱해짐)
const SKILL_DMG_MULT = 1.5;                              // 관우 회전참·청룡참·궁극기 피해량 배율 (+50%)
const PLAYER_STUN_BOSS = 1.0, PLAYER_STUN_CAV = 0.8;   // 여포 1페이즈 돌진 / 철기병 돌진에 맞았을 때 관우의 스턴 시간(초)
const PLAYER_HIT_RECOVERY_MULT = 1;                       // 관우의 평타·스킬에 맞은 적의 피격 경직 시간 배율 (2였던 것을 1/2로 줄임)
const BOSS_HIT_RECOVERY_MULT = 2;                         // 보스 스킬에 맞은 관우의 피격 경직 시간 배율
const DROP_CHANCE = 0.05, WINE_DROP_CHANCE = 0, BUN_HEAL_PCT = 0.10;   // WINE_DROP_CHANCE: 술 등장 확률 0% (몬스터 드랍·보스 보급품 모두 나오지 않음)
//            // 몬스터 처치 시 만두 / 술 각각의 드랍 확률, 만두의 즉시 회복 비율(최대 생명력 기준)
const WINE_ATK_SPEEDUP = 1.3, WINE_MOVE_SPEEDUP = 1.3, WINE_DURATION = 10;   // 술: 관우 공격속도 +30%, 이동속도 +30%, 10초
const WAVE_COUNT_CUT = 0.7;   // 각 웨이브 몬스터 수량 -30% (필드 동시 수와 리스폰 총수 모두 비례 감소)
const ENEMY_COUNT_MULT = 1.4;    // 웨이브 몬스터 수 배율 (보스 제외, 기존 수의 1.4배 = 이전 2.8배의 절반). 소수는 반올림
const BOSS_STAGE = {   // 보스 여포 단계별 난이도 (이전: 1페이즈 시전 배율 1.0 / 2페이즈 0.8 — 모든 단계가 이전보다 같거나 더 어려움)
  fast: [0.94, 0.88, 0.82, 0.70, 0.65, 0.60],   // 스킬 시전 시간 배율 (작을수록 빠름)
  dmg: [1.10, 1.18, 1.26, 1.55, 1.75, 1.95],    // 피해 배율
  cd: [0.95, 0.90, 0.85, 0.70, 0.62, 0.55],     // 스킬 사이 대기시간 배율
  chain: [0.25, 0.30, 0.35, 0.55, 0.62, 0.70], // 스킬이 끝난 뒤 곧바로 다음 스킬을 이어서 쓸 확률
};
// 보스 공통 (여포·관우): 선딜(windup) x0.88, 후딜(recover) x0.7 — 패턴 구성은 그대로 두고 속도만 상향. 이어쓰기: 후딜이 끝난 뒤 글로벌 대기 대신 BOSS_CHAIN_GAP 만 쉬고 바로 다음 스킬(최대 BOSS_CHAIN_MAX 번 연속 추가)
const BOSS_WINDUP_MUL = 0.88, BOSS_RECOVER_MUL = 0.7, BOSS_CHAIN_MAX = 2, BOSS_CHAIN_GAP = 0.12;
const bossChainP = e => e.d.mb ? MB.chain[mbStage(e)] : e.d.zhao ? ZB.chain[zStage(e)] : e.d.foot ? (e.phase2 ? 0.45 : 0.30) : bossTab(e).chain[bossStage(e)];
// 레이드 보스 여포 (8단계): 1페이즈(기마) 0~3단계(100~50%) / 2페이즈(하마) 4~7단계(50~0%). 기존 여포(6단계)를 세분화해 단계마다 패턴이 하나씩 늘고 빨라진다.
//  3단계: 화살 연사→돌진 · 도약 3연속 / 4단계: 하마 / 6단계(37%): 부하 소환 · 6단계(25%): 회전 폭풍·전쟁의 함성 / 7단계(12%): 최후의 광폭 (함성 → 돌진 → 점프)
const RAID_STAGE = {
  fast: [0.94, 0.90, 0.86, 0.82, 0.74, 0.68, 0.62, 0.56],
  dmg: [1.10, 1.16, 1.22, 1.30, 1.50, 1.66, 1.82, 2.00],
  cd: [0.95, 0.92, 0.88, 0.84, 0.72, 0.65, 0.58, 0.50],
  chain: [0.25, 0.28, 0.32, 0.36, 0.50, 0.56, 0.64, 0.72],
};
const raidStage = e => { const r = e.hp / e.maxhp; return r > 7 / 8 ? 0 : r > 6 / 8 ? 1 : r > 5 / 8 ? 2 : r > 0.5 ? 3 : r > 3 / 8 ? 4 : r > 2 / 8 ? 5 : r > 1 / 8 ? 6 : 7; };
const bossStage = e => { if (e.d.raid) return raidStage(e); const r = e.hp / e.maxhp; return r > 5 / 6 ? 0 : r > 4 / 6 ? 1 : r > 0.5 ? 2 : r > 2 / 6 ? 3 : r > 1 / 6 ? 4 : 5; };
const bossTab = e => e.d.raid ? RAID_STAGE : BOSS_STAGE;
const BOSS_MOUNTED_R = 56, BOSS_DISMOUNT_HP = 0.5;   // 보스 기마 상태의 충돌 반경 / 체력이 이 비율 아래가 되면 하마(2페이즈)
const WAVE_TOTAL_MULT = 3, RESPAWN_INTERVAL = 0.9;   // 일반 웨이브(W1~3): 웨이브 하나의 총 몬스터 수 3배. 필드에는 (기존 수)만큼만 있고, 쓰러지면 RESPAWN_INTERVAL 마다 하나씩 다시 등장
const TYPES = {
  soldier: { name: '적 보병', hitRec: 0.4, r: 22, hp: 150, speed: 120, body: '#4a2b33', trim: '#a02b2b', skin: '#d9a77e', helm: true, helmColor: '#34303a', plume: 1, pauldrons: true, weapon: 'spear' },
  archer: { name: '적 궁병', hitRec: 0.4, r: 19, hp: 90, speed: 105, body: '#3d3a46', trim: '#8a2a2a', skin: '#d9a77e', helm: true, helmColor: '#5a4332', plume: 0.7, weapon: 'bow' },
  captain: { name: '적 장수', hitRec: 0.3, r: 32, hp: 800, hpScale: 0.7, speed: 95, body: '#5a1c24', trim: '#e0b13a', skin: '#c9946a', helm: true, helmColor: '#24222c', plume: 1.6, pauldrons: true, weapon: 'axe' },
  cavalry: { name: '적 철기병', hitRec: 0.35, r: 30, hp: 200, speed: 150, body: '#3b3f4b', trim: '#c9302c', skin: '#d9a77e', helm: true, helmColor: '#2b2d36', plume: 1.2, pauldrons: true, weapon: 'spear', mounted: true },
  boss: { name: '여포 봉선', short: '여포', hitRec: 0, r: 46, riderR: 46, horseCoat: '#a8321f', barding: '#2a2030', hp: 5200, hpScale: 0.42, speed: 125, body: '#2a2030', trim: '#c9302c', skin: '#e0b08a', helm: true, feathers: true, weapon: 'halberd', armor: true, boss: true },
};

const FOE_BOSS_GUAN = { name: '관우 운장', short: '관우', foot: true, body: '#2f8f5b', trim: '#d4a73a', skin: '#c9553f', helm: false, hat: true, beard: true, cape: '#1f6a42', feathers: false, weapon: 'glaive', barding: '#1f6a42' };
const RAID_HP_SCALE = 6.0, RAID_HPMUL = 2.0, RAID_DMGMUL = 1.1;   // 레이드 보스 체력 배율(보스 기본 x) / 웨이브 배율
TYPES.raidBoss = { ...TYPES.boss, raid: true, name: '여포 봉선 · 레이드', short: '여포', hpScale: RAID_HP_SCALE };   // 레이드 모드 보스 (기마 → 하마, 8단계)
TYPES.guanBoss = { ...TYPES.boss, ...FOE_BOSS_GUAN };   // 보스 관우 운장 (W3): 여포(boss)와 같은 체력, 도보 단일 패턴
const FOE_BOSS_ZHAO = { name: '조운 자룡', short: '조운', foot: true, zhao: true, speed: 165, body: '#2b6a6e', trim: '#c9cfd8', skin: '#e0b08a', helm: false, hair: true, band: true, pauldrons: true, cape: '#1f4a50', feathers: false, weapon: 'lance', barding: '#1f4a50', auraCol: '#7fd0ff', fxCol: '#e6f6ff', p2msg: '조운이 백룡의 기운을 해방했다!  2페이즈' };
TYPES.zhaoBoss = { ...TYPES.boss, ...FOE_BOSS_ZHAO };   // 보스 조운 자룡 (W6): 관우 보스와 같은 체력, 도보, 빠른 찌르기·돌진 패턴
// ----- 신규 몬스터 3종 + 몬스터 보스 7종 -----
//  방패병: 느리고 단단함(경직 없음), 정면 피해 60% 감소 (스턴 걸리는 궁극기·돌격은 막지 못함) -> 옆·뒤로 돌아 공격
//  자객: 빠르고 약함, 멀리서 짧게 돌진해 찌름 / 술사: 거리를 두고 플레이어 위치에 낙뢰(원형 예고 후 폭발) -> 예고 원이 보이면 벗어나기
Object.assign(TYPES, {
  shield: { name: '적 방패병', hitRec: 0.45, r: 26, hp: 360, speed: 80, body: '#3a4a5a', trim: '#9aa7b8', skin: '#d9a77e', helm: true, helmColor: '#2c3340', plume: 0.5, pauldrons: true, weapon: 'axe', shield: true, guard: 0.4, armor: true },
  assassin: { name: '적 자객', hitRec: 0.3, r: 20, hp: 70, speed: 175, body: '#1f1a28', trim: '#7a55c0', skin: '#cfa07a', helm: true, helmColor: '#2a2038', plume: 0, weapon: 'spear' },
  caster: { name: '적 술사', hitRec: 0.35, r: 21, hp: 110, speed: 85, body: '#4a2a5a', trim: '#c77dff', skin: '#d9b08a', helm: true, helmColor: '#3a1f50', plume: 0.4, weapon: 'spear' },
});
const MBASE = { hitRec: 0, hp: 5200, boss: true, foot: true, mb: true, armor: true, feathers: false };
Object.assign(TYPES, {
  bossGeneral: { ...MBASE, name: '적 맹장', short: '맹장', r: 40, hpScale: 0.30, speed: 110, body: '#5a1c24', trim: '#e0b13a', skin: '#c9946a', helm: true, helmColor: '#24222c', plume: 1.8, pauldrons: true, weapon: 'axe', auraCol: '#ffb04d', fxCol: '#ffd9a0', p2msg: '맹장이 분노했다!  2페이즈', minion: 'soldier', minionN: 4, slamR: 210, ultR: 300,
    kit: { near: ['slam', 'combo', 'bash'], far: ['charge', 'leap'], s1: { near: ['sweep'], far: ['chain:2'] }, s2: { near: ['slam+combo', 'summon'], far: ['leap+slam', 'summon'] } } },
  bossCav: { ...MBASE, name: '적 철기대장', short: '철기대장', mounted: true, r: 42, riderR: 40, horseCoat: '#3a3f4b', barding: '#2a2d36', hpScale: 0.34, speed: 150, body: '#2b2f3b', trim: '#c9302c', skin: '#d9a77e', helm: true, helmColor: '#1f2129', plume: 1.6, pauldrons: true, weapon: 'spear', auraCol: '#ff6a4a', fxCol: '#ffb0a0', p2msg: '철기대장이 전군 돌격을 명령했다!  2페이즈', minion: 'cavalry', minionN: 2, slamR: 200,
    kit: { near: ['combo', 'slam', 'charge'], far: ['charge', 'chain:3', 'storm:2'], s1: { near: ['bash'], far: ['charge+leap', 'chain:3'] }, s2: { near: ['slam+charge', 'summon'], far: ['chain:4', 'summon', 'quake'] } } },
  bossShield: { ...MBASE, name: '방패 장군', short: '방패 장군', r: 46, hpScale: 0.38, speed: 90, guard: 0.5, shield: true, body: '#2f3d4d', trim: '#b8c4d4', skin: '#d9a77e', helm: true, helmColor: '#222a35', plume: 1.2, pauldrons: true, weapon: 'axe', auraCol: '#9ad4ff', fxCol: '#dff0ff', p2msg: '방패 장군이 철벽 진형을 펼쳤다!  2페이즈', minion: 'shield', minionN: 3, slamR: 220, ultR: 340,
    kit: { near: ['bash', 'slam', 'combo'], far: ['quake', 'summon'], s1: { near: ['bash+slam'], far: ['quake+leap'] }, s2: { near: ['ult', 'bash+combo'], far: ['chain:2', 'summon'] } } },
  bossCaster: { ...MBASE, name: '술사 장군', short: '술사', r: 34, hpScale: 0.42, speed: 100, body: '#3a1f50', trim: '#c77dff', skin: '#d9b08a', helm: true, helmColor: '#2a1540', plume: 1.4, weapon: 'spear', auraCol: '#c77dff', fxCol: '#ecd0ff', p2msg: '술사 장군이 주술을 해방했다!  2페이즈', minion: 'caster', minionN: 2, ultR: 360,
    kit: { near: ['slam', 'rain:2', 'combo'], far: ['rain:3', 'storm:2'], s1: { near: ['rain:3'], far: ['rain:4', 'storm:3'] }, s2: { near: ['ult', 'rain:3+slam'], far: ['rain:5', 'ult+rain:3', 'summon'] } } },
  bossAssassin: { ...MBASE, name: '자객 두목', short: '자객 두목', r: 30, hpScale: 0.46, speed: 190, body: '#14101c', trim: '#8a5ae0', skin: '#cfa07a', helm: true, helmColor: '#1a1426', plume: 0, weapon: 'spear', auraCol: '#8a5ae0', fxCol: '#d6c0ff', p2msg: '자객 두목이 그림자 속으로 사라졌다!  2페이즈', minion: 'assassin', minionN: 3,
    kit: { near: ['dash:3', 'combo'], far: ['dash:3', 'leap'], s1: { near: ['dash:4'], far: ['dash:5', 'dash:3+leap'] }, s2: { near: ['dash:5+slam', 'summon'], far: ['dash:6', 'summon'] } } },
  bossAlliance: { ...MBASE, name: '연합 장군', short: '연합 장군', r: 48, hpScale: 0.5, speed: 120, body: '#2a2f3d', trim: '#e0b13a', skin: '#c9946a', helm: true, helmColor: '#1c1f2a', plume: 2.0, pauldrons: true, weapon: 'axe', shield: true, auraCol: '#ffd34d', fxCol: '#fff0b0', p2msg: '연합군이 총공세를 시작했다!  2페이즈', minion: 'shield', minionN: 2, slamR: 230, ultR: 350,
    kit: { near: ['combo', 'bash', 'dash:3', 'slam'], far: ['rain:3', 'chain:3', 'storm:3', 'summon'], s1: { near: ['bash+rain:2'], far: ['quake+rain:3', 'dash:4'] }, s2: { near: ['ult', 'combo+dash:3'], far: ['ult+rain:4', 'chain:4'] } } },
  bossCommander: { ...MBASE, name: '총사령관', short: '총사령관', r: 50, hpScale: 0.54, speed: 130, body: '#3a1c1c', trim: '#ffd34d', skin: '#c9946a', helm: true, helmColor: '#201010', plume: 2.2, pauldrons: true, feathers: true, weapon: 'axe', auraCol: '#ff6a4a', fxCol: '#ffd0b0', p2msg: '총사령관이 전군에 진군 명령을 내렸다!  2페이즈', minion: 'captain', minionN: 2, slamR: 240, ultR: 380,
    kit: { near: ['combo', 'slam+combo', 'bash', 'ult'], far: ['rain:4', 'chain:4', 'storm:3', 'summon', 'dash:5'], s1: { near: ['slam+ult'], far: ['quake+storm:2'] }, s2: { near: ['ult+combo', 'dash:5+slam'], far: ['ult+rain:5', 'chain:5', 'quake+storm:3'] } } },
});
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
//  선택 가능: 이 계정이 도달한 최고 웨이브까지. 1층이 아닌 곳에서 시작하면 건너뛴 5웨이브 구간 수만큼(5·10·15…) 능력치 강화가 무작위로 자동 적용된다.
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
  text((ACC ? ACC.name : '') + '  ·  최고 도달 ' + accBest() + '웨이브까지 선택 가능  ·  1층이 아닌 곳에서 시작하면 건너뛴 5웨이브 구간마다(5·10·15…) 능력치 강화가 1개씩 무작위로 자동 적용', W / 2, 96, 14, '#cfd3e6', 'center', false);
  text('보스 : 5층마다 (10 관우 · 25 조운 · 50 여포는 PC 보스)  ·  신규 몬스터 : 방패병 7층 · 자객 12층 · 술사 17층', W / 2, 120, 13, '#ffb27a', 'center', false);
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
  text('난이도 ' + (w.tier + 1) + '단계  ·  몬스터 생명력 x' + w.hpMul.toFixed(2) + '  ·  피해 x' + w.dmgMul.toFixed(2) + (waveSel > UPGRADE_EVERY ? '  ·  자동 강화 ' + Math.floor((waveSel - 1) / UPGRADE_EVERY) + '개 (5웨이브마다)' : '  ·  자동 강화 없음'), W / 2 - 524, 642, 13, '#ffb27a', 'left', false);
  const g = WV_GO; ctx.fillStyle = 'rgba(10,12,20,.92)'; ctx.fillRect(g.x, g.y, g.w, g.h); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3; ctx.strokeRect(g.x, g.y, g.w, g.h); text('다음 : 장수 선택 (Enter)', g.x + g.w / 2, g.y + 36, 22, '#ffd34d', 'center');
  const b = WV_BACK; ctx.fillStyle = 'rgba(10,12,20,.9)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = '#cfd3e6'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h); text('뒤로', b.x + b.w / 2, b.y + 21, 15, '#cfd3e6', 'center');
}
const UPGRADE_EVERY = 5;   // 능력치 강화 선택 간격 (웨이브)
function catchUpUpgrades(n) {   // 웨이브 n 층에서 시작: 건너뛴 5웨이브 구간 수만큼 능력치 강화를 무작위로 자동 적용
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
  beginWave(nx);
}
const UPG_CARD = { w: 300, h: 290, gap: 24, y: 235 };
const upgCardRect = i => ({ x: W / 2 - (3 * UPG_CARD.w + 2 * UPG_CARD.gap) / 2 + i * (UPG_CARD.w + UPG_CARD.gap), y: UPG_CARD.y, w: UPG_CARD.w, h: UPG_CARD.h });
function upgradeClick(x, y) { if (!upg) return; for (let i = 0; i < upg.offers.length; i++) if (inRect(x, y, upgCardRect(i))) { pickUpgrade(i); return; } }
const UPG_TIME = 10;   // 선택 제한 시간(초): 직접 고르면 바로 진행, 10초가 지나면 랜덤으로 하나가 자동 선택됨
function updateUpgrade(rdt) { if (!upg) return; upg.t += rdt; if (upg.t >= UPG_TIME) pickUpgrade(Math.floor(Math.random() * upg.offers.length), true); }   // AUTO 와 무관하게 항상 10초 카운트 (직접 고르면 즉시 진행)
function drawUpgrade() {
  if (!upg) return;
  ctx.fillStyle = 'rgba(4,6,12,.74)'; ctx.fillRect(0, 0, W, H);
  text('WAVE ' + (upg.next) + ' 클리어', W / 2, 96, 22, '#ffe9a0', 'center');
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
function flatOf(id, lv) { const g = growthFx(id, lv); return { hp: g.hp, atk: g.atk, def: g.def }; }   // 능력치 성장(체력·공격력·방어력)만
function flatMode(id) { return ACC && (mode === 'yeonui' || mode === 'duel') && GROWTH[pcId(id)] ? flatOf(id, heroLv(id)) : zeroFlat(); }
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
  RS.summary = heroes.map(h => {
    const gain = Math.round(pool * (0.3 / n + 0.7 * (sumD ? dmgOf(h) / sumD : 1 / n))), r = addXp(ACC, h, gain), row = { hero: h, gain, before: r.before, after: r.after };
    if (r.after > r.before) {   // 레벨업: 기본 능력치에 더해지는 +N 이 이전 -> 현재 로 얼마나 늘었는지, 새로 풀린 고유 성장 효과
      const m0 = flatOf(h, r.before), m1 = flatOf(h, r.after);
      row.changes = FLAT_KEYS.filter(k => m1[k] > m0[k] + 1e-9).map(k => FLAT_NAME[k] + ' ' + fmtFlat(k, m0[k]) + ' → ' + fmtFlat(k, m1[k]) + ' (+' + (k === 'hp' ? Math.round(m1[k] - m0[k]) : +(m1[k] - m0[k]).toFixed(1)) + ')');
      row.perks = GROWTH[h].tiers.filter(t => t.lv > r.before && t.lv <= r.after).map(t => 'Lv ' + t.lv + ' [' + t.name + '] ' + fxText(h, t.fx)); const nt = GROWTH[h].tiers.find(t => t.lv > r.after); row.next = nt ? '다음 Lv ' + nt.lv + ' [' + nt.name + '] ' + fxText(h, nt.fx) : '고유 성장 단계를 모두 해금';
    }
    return row;
  });
  ACC.runs++; if (win) ACC.wins++; saveSave();
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
  lastStartWave = startWave;
  BTN.find(b => b.id === 'auto').y = 375;   // 로그라이크: AUTO 는 HIT 표시와 회피 버튼의 중간 (오른쪽 위에는 정지·나가기 버튼)
  resetRun(); resetRS(); if (team && team.length) TEAM = team.slice(0, 3); selHero = TEAM[0]; LUBU_FORM = 'lubu';
  mode = 'yeonui'; applyGrowth('yeonui'); allies = []; duel = null; applyHero(); resetPlayer(); enemies = []; projectiles = []; fx = []; dts = []; items = [];
  kills = 0; clock = 0; winT = 0; autoDodgeCd = 0; shake = 0; hitstop = 0; slowT = 0; flashT = 0; tagFx = null;
  cam.x = P.x - W / 2; cam.y = P.y - H / 2;
  state = 'play';
  if (tutNeeded('yeonui')) tutBegin('yeonui'); else { if (startWave > 0) catchUpUpgrades(startWave); beginWave(startWave); }
}
function startRaid(team) {   // 레이드 모드 (오프라인): 1~3명이 태그하며 보스 여포와 싸운다
  lastStartWave = 0;
  BTN.find(b => b.id === 'auto').y = 375;
  resetRun(); RAID = true; resetRS(); RAID_HEROES = (team && team.length ? team : TEAM).slice(0, 3); TEAM = [RAID_HEROES[0]]; selHero = TEAM[0]; LUBU_FORM = 'lubu';   // 태그 없음: 조작 PC 1명 + AI PC 최대 2명
  mode = 'yeonui'; applyGrowth('yeonui'); allies = []; duel = null; applyHero(); resetPlayer();
  RD.order = RAID_HEROES.slice(); RD.swapCd = 0; RD.cyc = 0;
  RAID_HEROES.slice(1).forEach((h, i) => allies.push(makeFighter(h, 'ally', P.x + (i ? 130 : -130), P.y + 70))); enemies = []; projectiles = []; fx = []; dts = []; items = [];
  kills = 0; clock = 0; winT = 0; autoDodgeCd = 0; shake = 0; hitstop = 0; slowT = 0; flashT = 0; tagFx = null; joy = null; auto = false; TUT = null;
  for (const k in buf) buf[k] = -9;
  cam.x = P.x - W / 2; cam.y = P.y - H / 2;
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
const bossTrailId = e => e.type === 'guanBoss' ? 'guan' : e.type === 'zhaoBoss' ? 'zhao' : e.type === 'boss' ? 'lubu' : e.d.weapon === 'spear' ? 'mbSpear' : 'mbAxe';   // 보스 몬스터의 무기 궤적 종류
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
  for (const it of items) {
    it.t += dt; it.life -= dt;
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
const DR_HEROES = ['dian'], DR_BOSS_TYPES = ['boss', 'raidBoss'];   // 고유 능력 '상태 이상 저항'을 가진 PC / 보스 (그 밖의 모든 유닛은 점감 없이 상태 이상이 그대로 적용)
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
const FORM_SLOW = 0.35;   // 폼 전환 슬로 모션(실시간 초)
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
    if (!a.s0) { a.s0 = 1; sfx('boom'); flashT = Math.max(flashT, 0.15); ring(u.x, u.y, 120, 0.3, H.ult.a, 8); if (u === P && mode !== 'duel') slowT = Math.max(slowT, 0.5); }
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
// ===== 튜토리얼: 각 모드에 처음 들어갈 때(또는 로비의 '튜토리얼 다시 보기') 진행 =====
//  전투 중 안내 패널에 따라 이동·공격·스킬·회피·궁극기·태그(또는 조작 변경)·AUTO 를 직접 해본다. 진행 중에는 무적이고 적은 가만히 서 있다.
//  끝나거나 건너뛰면 계정에 기록하고(ACC.tut) 전투를 처음부터 정상 시작한다.
const tutNeeded = m => !!ACC && !(ACC.tut && ACC.tut[m]);
function tutSteps(m) {
  const S = [
    { id: 'move', ev: 'move', n: 1.2, t: () => IS_TOUCH ? '왼쪽 화면을 드래그해서 이동하세요' : 'WASD 또는 방향키로 이동하세요', h: () => '이동하는 동안 영웅이 가는 방향을 바라봅니다. 이동은 적의 공격 범위를 피하는 기본 수단입니다.' },
    { id: 'attack', ev: 'attack', n: 3, btn: 'attack', t: () => '공격 버튼을 3번 눌러 3단 콤보를 해보세요' + (IS_TOUCH ? '' : '  (J / 클릭)'), h: () => '1 → 2 → 3단계로 이어지고, 3단 공격이 적에게 맞으면 영웅 고유 버프가 켜집니다. ' + HERO.sub },
    { id: 's1', ev: 's1', n: 1, btn: 's1', t: () => '스킬1 — ' + HERO.skills.s1 + (IS_TOUCH ? '' : '  (K)'), h: () => (HERO.info[1] ? HERO.info[1][2] : '') },
    { id: 's2', ev: 's2', n: 1, btn: 's2', t: () => '스킬2 — ' + HERO.skills.s2 + (IS_TOUCH ? '' : '  (L)'), h: () => (HERO.info[2] ? HERO.info[2][2] : '') },
    { id: 'dash', ev: 'dash', n: 1, btn: 'dash', t: () => '회피' + (IS_TOUCH ? ' 버튼을 눌러보세요' : '  (Space) 를 눌러보세요'), h: () => '짧게 무적이 되며 빠르게 이동합니다. 쿨타임 ' + dashCdNow() + '초 — 적의 붉은 범위가 보이면 먼저 이동으로 피하고, 급할 때 회피를 쓰세요.' },
    { id: 's3', ev: 's3', n: 1, btn: 's3', pre: () => { P.rage = 100; }, t: () => '궁극기 — ' + HERO.skills.s3 + (IS_TOUCH ? '' : '  ( ; )'), h: () => '궁극기는 쿨타임(' + ULT_CD + '초)마다 쓸 수 있습니다. 튜토리얼에서는 바로 쓸 수 있도록 충전해 두었습니다.' },
  ];
  if (m === 'yeonui' && TEAM.length >= 2) S.push({ id: 'tag', ev: 'tag', n: 1, btn: 'tag', t: () => '태그 — 다른 영웅으로 교체' + (IS_TOUCH ? ' (왼쪽 TAG 버튼)' : '  (Z / X / C)'), h: () => '체력과 궁극기 쿨타임은 함께 쓰고, 스킬 쿨타임은 영웅마다 따로 흐릅니다. 교체하면 태그 스킬이 바로 나갑니다.' });
  if ((m === 'duel' || m === 'raid') && allies.length) S.push({ id: 'swap', ev: 'swap', n: 1, btn: 'swap', t: () => '조작 영웅 변경 — 아군을 직접 조작' + (IS_TOUCH ? ' (왼쪽 위 초상화를 누르기)' : '  (Q 또는 왼쪽 위 초상화 클릭)'), h: () => '체력·궁극기 게이지·쿨타임은 그대로 넘어가고, 순서 목록은 바뀌지 않습니다.' });
  S.push({ id: 'auto', ev: 'auto', n: 1, btn: 'auto', t: () => 'AUTO' + (IS_TOUCH ? ' 버튼' : '  (T)') + ' — 자동 전투를 켜 보세요', h: () => m === 'duel' ? '자동 회피·공격·스킬·궁극기를 AI 영웅과 같은 규칙으로 사용합니다. 직접 움직이면 해제됩니다.' : '자동으로 적을 쫓아 공격·회피하며, 체력이 10% 이하가 되면 자동으로 태그합니다. 직접 움직이면 해제됩니다.', pre: () => { } });
  S.push({ id: 'info', ev: 'ok', n: 1, ok: true, pre: () => { auto = false; }, t: () => m === 'duel' ? '비무장 모드 규칙' : m === 'raid' ? '레이드 모드 규칙' : '로그라이크 모드 규칙', lines: () => m === 'raid'
    ? ['내가 1명을 직접 조작, 나머지 PC는 AI 동료입니다 (태그 없음). Q·초상화로 조작 변경', '여포 봉선은 체력이 줄수록 8단계로 강해지고, 50%에서 하마가 되며 부하를 부릅니다', '붉은 범위는 이동·회피(Space)로 피하세요. 범위 안의 AI 동료도 함께 맞습니다', '아이콘을 누르면 상세 정보 · 보스는 상태 이상 저항이 있어 스턴이 점점 짧아집니다']
    : m === 'duel'
    ? ['고른 인원수(1~3명)만큼 적도 같은 수가 나옵니다. 모든 AI 영웅은 같은 규칙으로 싸웁니다.', '제한 시간 3분 — 시간이 끝나면 남은 체력 합계로 승패가 갈립니다.', 'M 키 또는 미터기 제목을 누르면 주는 피해·받은 피해 표를 접고 펼 수 있습니다.', '레벨 보정은 같은 영웅끼리 같은 레벨(내 계정 기준)로 적용되며, 경험치는 얻지 않습니다.']
    : ['5웨이브마다(5·10·15…) 능력치 강화 3개 중 1개를 고릅니다 (10초 뒤 자동 선택).', '5층마다 보스가 나옵니다 (10 관우 · 25 조운 · 50 여포). 보스 공격의 붉은 범위는 이동이나 회피로 피할 수 있습니다.', '경험치와 레벨은 이 모드에서만 얻습니다. Lv 1·5·10·15·20·25·30 에 영웅 고유 성장 단계가 열립니다.', '여포는 K 로 상마 ↔ 하마를 전환합니다 (스킬2 쿨타임은 폼마다 따로 흐릅니다).'] });
  return S;
}
function tutBegin(m) {
  TUT = { mode: m, steps: tutSteps(m), i: 0, prog: 0, fade: 0 }; auto = false;
  if (m === 'yeonui' || m === 'raid') {   // 웨이브(보스)를 시작하지 않고, 가만히 서 있는 허수아비 3기만 둔다 (레이드는 동료 AI 도 가만히)
    enemies = []; spawnQ = []; pendingSpawn = false; spawnT = 99; bannerT = 0; projectiles = [];
    for (let k = 0; k < 3; k++) { const e = makeEnemy('soldier', P.x + 230 + (k % 2) * 60, P.y - 120 + k * 120); e.hp = e.maxhp = 1e9; e.freeze = 1e12; e.spawnT = 0; enemies.push(e); }
    if (m === 'raid') tutFreeze();
  } else tutFreeze();
  const s = TUT.steps[0]; if (s.pre) s.pre();
}
function tutFreeze() { for (const f of [...allies, ...enemies]) if (f.fighter) { f.freeze = 1e12; f.hp = f.maxhp = 1e9; } }
function tutEvent(name, v = 1) {
  const s = TUT && TUT.steps[TUT.i]; if (!s || TUT.fade > 0 || s.ev !== name) return;
  TUT.prog += v; if (TUT.prog >= s.n) { TUT.fade = 0.8; sfx('heal'); }
}
function tutUpdate(dt) {
  if (!TUT) return;
  if (mode === 'duel' || TUT.mode === 'raid') for (const f of [...allies, ...enemies]) if (f.fighter && f.freeze < 1e11) { f.freeze = 1e12; f.hp = f.maxhp = Math.max(f.maxhp, 1e9); }   // 조작 변경 뒤에도 가만히
  if (TUT.fade > 0) { TUT.fade -= dt; if (TUT.fade <= 0) { TUT.i++; TUT.prog = 0; const s = TUT.steps[TUT.i]; if (!s) tutEnd(false); else if (s.pre) s.pre(); } }
}
function tutEnd(skipped) {
  const m = TUT ? TUT.mode : mode; TUT = null; auto = false;
  if (ACC) { ACC.tut = ACC.tut || {}; ACC.tut[m] = true; saveSave(); }
  restartMode();
}
const TUT_SKIP = { x: W / 2 + 280, y: 92, w: 120, h: 26 }, TUT_OK = { x: W / 2 - 90, y: 312, w: 180, h: 36 };
function tutClick(x, y) {
  if (!TUT) return false;
  if (inRect(x, y, TUT_SKIP)) { tutEnd(true); return true; }
  const s = TUT.steps[TUT.i]; if (s && s.ok && inRect(x, y, TUT_OK)) { tutEvent('ok'); return true; }
  return false;
}
const tutBtnRect = i => ({ x: W / 2 - 140, y: 408 + i * 44, w: 280, h: 36 });   // 도움말 창 안의 튜토리얼 버튼
function drawTutorial() {
  if (!TUT || state !== 'play') return; const s = TUT.steps[TUT.i]; if (!s) return;
  const big = !!s.ok, pw = 900, px = W / 2 - pw / 2, py = 86, ph = big ? 270 : 92;
  ctx.save(); ctx.fillStyle = 'rgba(10,12,20,.9)'; ctx.fillRect(px, py, pw, ph); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2.5; ctx.strokeRect(px, py, pw, ph);
  text('튜토리얼  ' + (TUT.i + 1) + ' / ' + TUT.steps.length, px + 16, py + 22, 14, '#ffd34d', 'left');
  const b = TUT_SKIP; ctx.fillStyle = 'rgba(40,20,20,.9)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = '#ff9a8a'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x, b.y, b.w, b.h); text('건너뛰기' + (IS_TOUCH ? '' : ' (Esc)'), b.x + b.w / 2, b.y + 18, 13, '#ffb4a8', 'center');
  text(s.t(), W / 2, py + 54, big ? 26 : 24, '#fff', 'center');
  if (!big) {
    text(fitStr(s.h() || '', pw - 40, 13), W / 2, py + 80, 13, '#cfd3e6', 'center', false);
    if (s.n > 1) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(px + 16, py + ph - 8, pw - 32, 5); ctx.fillStyle = '#4fd36a'; ctx.fillRect(px + 16, py + ph - 8, (pw - 32) * clamp(TUT.prog / s.n, 0, 1), 5); }
  } else {
    s.lines().forEach((ln, k) => text(fitStr('•  ' + ln, pw - 60, 15), px + 30, py + 100 + k * 34, 15, '#dfe3f5', 'left', false));
    const o = TUT_OK; ctx.fillStyle = 'rgba(30,60,30,.95)'; ctx.fillRect(o.x, o.y, o.w, o.h); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 2.5; ctx.strokeRect(o.x, o.y, o.w, o.h); text('시작하기' + (IS_TOUCH ? '' : ' (Enter)'), o.x + o.w / 2, o.y + 27, 20, '#9dff9d', 'center');
  }
  // 눌러야 할 버튼 강조
  let hx = null, hy = null, hr = 40;
  if (s.btn && BTN.find(q => q.id === s.btn)) { const q = BTN.find(q2 => q2.id === s.btn); hx = q.x; hy = q.y; hr = q.r + 10; }
  else if (s.btn === 'tag' && TEAM.length > 1) { const q = tagBtnPos(1); hx = q.x; hy = q.y; hr = TAG_BTN_R + 10; }
  else if (s.btn === 'swap' && (duel || RAID)) { hx = DUEL_ROW.x + 100; hy = DUEL_ROW.y + DUEL_ROW.step + 19; hr = 34; }
  if (hx != null && TUT.fade <= 0) { const k = 0.5 + 0.5 * Math.sin(T * 8); ctx.strokeStyle = `rgba(255,243,120,${0.5 + 0.5 * k})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(hx, hy, hr + k * 8, 0, TAU); ctx.stroke(); text('▼ 여기', hx, hy - hr - 14, 15, '#ffe14a', 'center', true); }
  if (TUT.fade > 0) { text('✔ 완료!', W / 2, py + ph + 36, 30, '#7dff9a', 'center'); }
  ctx.restore();
}
// ===== 장수 정보 페이지 (로비 > 장수 정보): PC 별 능력치 · 스킬 · 고유 성장 단계를 한눈에 보고, 레벨을 바꿔 가며 성장 결과를 미리 본다 =====
const INFO_BTN = { x: W / 2 - 491 + 3 * 250, y: 616, w: 232, h: 84 }, INFO_BACK = { x: 12, y: 664, w: 80, h: 30 };
let infoSel = 0, infoLv = 1;
const infoPc = () => HERO_IDS[infoSel];
const infoTab = i => ({ x: 40 + i * 201, y: 82, w: 195, h: 46 });
const INFO_CTL = { m5: { x: 56, y: 304, w: 40, h: 30 }, m1: { x: 100, y: 304, w: 40, h: 30 }, box: { x: 144, y: 304, w: 90, h: 30 }, p1: { x: 238, y: 304, w: 40, h: 30 }, p5: { x: 282, y: 304, w: 40, h: 30 }, cur: { x: 326, y: 304, w: 54, h: 30 } };
function openInfo() { state = 'info'; mode = 'yeonui'; infoSel = Math.max(0, HERO_IDS.indexOf(curHero)); infoLv = ACC ? heroLv(infoPc()) : 1; }
function infoSetLv(v) { infoLv = clamp(v, 1, MAX_LV); }
function infoSelect(i) { infoSel = clamp(i, 0, HERO_IDS.length - 1); infoLv = ACC ? heroLv(infoPc()) : 1; sfx('hit'); }
function infoClick(x, y) {
  if (inRect(x, y, INFO_BACK)) { state = 'title'; return; }
  for (let i = 0; i < HERO_IDS.length; i++) if (inRect(x, y, infoTab(i))) { infoSelect(i); return; }
  const c = INFO_CTL;
  if (inRect(x, y, c.m5)) infoSetLv(infoLv - 5); else if (inRect(x, y, c.m1)) infoSetLv(infoLv - 1); else if (inRect(x, y, c.p1)) infoSetLv(infoLv + 1); else if (inRect(x, y, c.p5)) infoSetLv(infoLv + 5); else if (inRect(x, y, c.cur)) infoSetLv(ACC ? heroLv(infoPc()) : 1);
  else if (inRect(x, y, c.box)) infoSetLv(infoLv >= MAX_LV ? 1 : MAX_LV);   // 가운데 칸: 1 <-> 최대 레벨
}
function infoKey(code) {
  if (code === 'Escape' || code === 'Enter' || code === 'KeyI') { state = 'title'; return; }
  if (code === 'ArrowLeft' || code === 'KeyA') infoSelect(infoSel - 1); else if (code === 'ArrowRight' || code === 'KeyD') infoSelect(infoSel + 1);
  else if (/^Digit[1-6]$/.test(code)) infoSelect(+code.slice(5) - 1);
  else if (code === 'ArrowUp' || code === 'KeyW') infoSetLv(infoLv + 1); else if (code === 'ArrowDown' || code === 'KeyS') infoSetLv(infoLv - 1);
  else if (code === 'PageUp') infoSetLv(infoLv + 5); else if (code === 'PageDown') infoSetLv(infoLv - 5);
}
function infoBuffLines(id, lv) {   // 조건부 버프 (미리보기 레벨의 성장 수치가 적용된 값)
  const pc = (v, base = 1) => Math.round((v - base) * 100) + '%';
  if (id === 'guan') return ['3단 공격 성공: 방어력 +' + Math.round(HEROES.guan.guard.bonus * 100) + '% (' + HEROES.guan.guard.dur + '초)', '청룡의 힘 사용: 방어력 +' + Math.round(HEROES.guan.ultGuard * 100) + '% (' + HEROES.guan.ultGuardDur + '초)'];
  if (id === 'lubu') return ['(상마) 3단 공격 성공: 이동속도 +' + pc(HEROES.lubu.runBonus) + ' (' + HEROES.lubu.runDur + '초, 이동하면 유지)', '(상마) 적토 돌격 후: 공격력 +' + pc(HEROES.lubu.postUltAtk) + ' (' + HEROES.lubu.postUltDur + '초)', '(상마) 50 HIT부터 10 HIT마다 공속·피해 +1%', '(하마) 3단 콤보 완주: 공격력 +' + pc(HEROES.lubu2.comboBuff.atk) + ' (' + HEROES.lubu2.comboBuff.dur + '초)', '(하마) 천하무쌍 후: 공격력 +' + pc(HEROES.lubu2.postUltAtk) + ' (' + HEROES.lubu2.postUltDur + '초)'];
  if (id === 'huang') return ['3단 공격 성공: 공속 +' + Math.round((HEROES.huang.aspdBuff.mult - 1) * 100) + '% (' + HEROES.huang.aspdBuff.dur + '초)', '[고유] 저격: 멀수록 피해 증가 (공격 +' + Math.round(HUANG_FAR * 100) + '% · 백보천양 +40%)', '[고유] 이동 사격 (이동속도 50%) · 백보천양은 후퇴하며 시전', '화살비: 맞은 적 이동속도 -45% (1.5초)', '수정화살: 거리에 비례해 기절 1 ~ 3.5초 · 보스는 최대 2초'];
  if (id === 'dian') return ['3단 공격 성공: 공격력 +' + Math.round((HEROES.dian.comboBuff.atk - 1) * 100) + '% (' + HEROES.dian.comboBuff.dur + '초)', '불사의 광기: 전투당 1회 ' + HEROES.dian.undy.floor + '초간 죽지 않음 (생명력 1 보호)', '불사의 광기: 시전마다 ' + HEROES.dian.undy.dur.toFixed(1) + '초간 공격력 +' + Math.round((HEROES.dian.undy.atk - 1) * 100) + '% · 피해의 ' + Math.round(HEROES.dian.undy.ls * 100) + '% 생명력 흡수', '[고유] 상태 이상 저항: 경직·스턴·둔화의 지속시간 100→80→60→40→20%', '[고유] 저항은 5회째부터 60초 뒤 초기화 (보스 여포도 같은 고유 능력)'];
  if (id === 'diao') return ['3단 공격 성공: 주변 아군 생명력 +' + +(DIAO_HEAL.combo * HEAL_POW * 100).toFixed(1) + '% 회복', '연꽃 치유: 범위 아군 생명력 +' + +(DIAO_HEAL.pulse * HEAL_POW * 100).toFixed(1) + '% x ' + DIAO_S1_TIMES.length + '회 (비무장: 자신 x' + DUEL_HEAL_MUL + ' / 다른 아군 x' + DUEL_HEAL_OTHER + ')', '월하 축복: 아군 전체 공격력 +' + Math.round(BLESS_ATK * 100) + '% · 방어력 +' + Math.round(BLESS_DEF * 100) + '% (' + BLESS_DUR + '초)', '경국지색: 범위 아군 생명력 +' + +(DIAO_HEAL.ult * ULT_HEAL_POW * 100).toFixed(1) + '% 회복 + 적 기절'];
  return ['3단 공격 성공: 공속 +' + pc(HEROES.zhao.aspdBuff.mult) + ' (' + HEROES.zhao.aspdBuff.dur + '초)', '백룡강림 후: 공속 +' + pc(HEROES.zhao.postUltAspd) + ' (' + HEROES.zhao.postUltDur + '초)'];
}
function infoRows(id, m) { const sv = mode; mode = m; applyGrowth(m); try { return heroSkillRows(id); } finally { mode = sv; } }   // 모드(로그라이크 / 비무장)별 스킬 수치
function drawInfo() {
  drawLoginScene(); ctx.fillStyle = 'rgba(6,4,14,.78)'; ctx.fillRect(0, 0, W, H);
  text('장수 정보', W / 2, 54, 36, '#ffd34d', 'center');
  text('능력치 · 스킬 · 고유 능력 · 영웅 성장  —  ← → 장수 선택  ·  ↑ ↓ 레벨 미리보기 (PageUp / PageDown ±5)', W / 2, 76, 13, '#cfd3e6', 'center', false);
  const id = infoPc(), g = GROWTH[id], rec = ACC ? heroRec(ACC, id) : { lv: 1, xp: 0 }, curLv = rec.lv;
  HERO_IDS.forEach((pid, i) => {   // 장수 탭
    const r = infoTab(i), on = i === infoSel, lvp = ACC ? heroLv(pid) : 1;
    ctx.fillStyle = on ? 'rgba(40,34,18,.95)' : 'rgba(10,12,20,.85)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = on ? '#ffd34d' : 'rgba(255,255,255,.3)'; ctx.lineWidth = on ? 3 : 1.5; ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.save(); ctx.beginPath(); ctx.arc(r.x + 26, r.y + 23, 18, 0, TAU); ctx.clip(); ctx.translate(r.x + 26, r.y + 27); ctx.scale(0.6, 0.6); drawPortraitIcon(HEROES[pid], 0, 0); ctx.restore();
    text(PC_NAME[pid], r.x + 54, r.y + 29, 18, on ? '#ffe9a0' : '#cfd3e6', 'left'); text('Lv ' + lvp, r.x + r.w - 12, r.y + 29, 15, lvp >= MAX_LV ? '#ffd34d' : '#9dff9d', 'right');
  });
  // 미리보기 레벨의 성장 수치를 실제 값에 적용한 채로 그린다 (로그라이크 / 비무장 각각)
  const old = rec.lv; rec.lv = infoLv; applyGrowth('yeonui');
  try {
    const rowsP = infoRows(id, 'yeonui'), rowsD = infoRows(id, 'duel'); applyGrowth('yeonui');
    // ---- 왼쪽: 프로필 + 능력치 + 성장 진행 ----
    const L = { x: 40, y: 142, w: 344, h: 514 }; ctx.fillStyle = 'rgba(12,14,24,.92)'; ctx.fillRect(L.x, L.y, L.w, L.h); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2; ctx.strokeRect(L.x, L.y, L.w, L.h);
    ctx.save(); ctx.beginPath(); ctx.arc(104, 214, 46, 0, TAU); ctx.clip(); ctx.translate(104, 214 + 6); ctx.scale(1.55, 1.55); drawPortraitIcon(HEROES[id], 0, 0); ctx.restore(); ctx.strokeStyle = '#d4a73a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(104, 214, 46, 0, TAU); ctx.stroke();
    text(PC_NAME[id], 166, 200, 28, '#ffe9a0', 'left'); text(fitStr(g.theme, 200, 13), 166, 224, 13, '#ffb27a', 'left', false);
    text('현재 Lv ' + curLv + (curLv >= MAX_LV ? ' (최대)' : '  ·  ' + rec.xp + ' / ' + xpNeed(curLv) + ' XP'), 166, 246, 13, '#cfd3e6', 'left', false);
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(166, 254, 200, 8); ctx.fillStyle = '#4fd36a'; ctx.fillRect(167, 255, 198 * (curLv >= MAX_LV ? 1 : rec.xp / xpNeed(curLv)), 6);
    text('성장 미리보기  (실제 레벨은 바뀌지 않습니다)', 56, 296, 13, '#ffd34d', 'left');
    const C = INFO_CTL; for (const [k, lab] of [['m5', '-5'], ['m1', '◀'], ['p1', '▶'], ['p5', '+5'], ['cur', '현재']]) { const b = C[k]; ctx.fillStyle = 'rgba(10,12,20,.9)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = '#9ad4ff'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x, b.y, b.w, b.h); text(lab, b.x + b.w / 2, b.y + 21, 14, '#9ad4ff', 'center'); }
    const bx = C.box; ctx.fillStyle = 'rgba(40,34,18,.95)'; ctx.fillRect(bx.x, bx.y, bx.w, bx.h); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2; ctx.strokeRect(bx.x, bx.y, bx.w, bx.h); text('Lv ' + infoLv, bx.x + bx.w / 2, bx.y + 22, 17, infoLv >= MAX_LV ? '#ffd34d' : '#fff', 'center');
    const m = flatOf(id, infoLv), bs = { hp: HERO_STATS.hp, atk: HERO_STATS.atk, def: 0 };
    text('능력치', 56, 362, 14, '#ffd34d', 'left'); text('로그라이크·레이드', 262, 362, 12, '#ffb27a', 'right', false); text('비무장', 366, 362, 12, '#9ad4ff', 'right', false);
    FLAT_KEYS.forEach((k, j) => {
      const dv = k === 'hp' ? DUEL_HP + m.hp * DUEL_HP / HERO_STATS.hp : bs[k] + m[k], v = bs[k] + m[k], f = n => k === 'hp' ? fmtI(n) : +n.toFixed(1), yy = 388 + j * 26;
      text(FLAT_NAME[k], 56, yy, 15, '#fff', 'left', false); text(f(v), 262, yy, 16, m[k] > 0 ? '#9dff9d' : '#fff', 'right', false); text(f(dv), 366, yy, 16, m[k] > 0 ? '#9dff9d' : '#fff', 'right', false);
      text('기본 ' + (k === 'hp' ? fmtI(bs[k]) : bs[k]) + ' ' + fmtFlat(k, m[k]) + (k === 'hp' ? '   (비무장은 체력 기준 6,000)' : k === 'def' ? '   (받는 피해 -' + (100 - 100 / (1 + m.def / 100)).toFixed(1) + '%)' : ''), 56, yy + 13, 10.5, '#8a90a6', 'left', false);
    });
    text('성장하지 않는 능력치 (두 모드 공통)', 56, 496, 13, '#cfd3e6', 'left');
    [['치명타 확률 / 피해', Math.round(CRIT_BASE * 100) + '%  /  x' + CRIT_BASE_DMG], ['이동속도', String(HERO_STATS.speed)], ['회피율 / 적중', PC_EVA + '%  /  ' + PC_ACC], ['회피 쿨타임 · 무적 · 거리', DASH_CD_PVE + '초 · ' + DASH_INV_PVE + '초 · +' + Math.round((DASH_DIST_PVE - 1) * 100) + '%'], ['(비무장 회피)', CD.dash + '초 · 0.26초 · 기본']].forEach(([k, v], j) => { text(k, 56, 518 + j * 20, 13, '#aab3c8', 'left', false); text(v, 366, 518 + j * 20, 13, '#fff', 'right', false); });
    const nt = g.tiers.find(t => t.lv > infoLv);
    text(fitStr(nt ? '다음 성장 단계  Lv ' + nt.lv + ' [' + nt.name + ']' : '고유 성장 단계를 모두 해금', L.w - 32, 12), 56, 628, 12, nt ? '#9dff9d' : '#ffd34d', 'left', false);
    text('경험치: 로그라이크·레이드에서 획득 (판 종료 시 정산)', 56, 646, 11, '#7a8196', 'left', false);
    // ---- 가운데: 스킬 (로그라이크 / 비무장) ----
    const M = { x: 400, y: 142, w: 450, h: 514 }; ctx.fillStyle = 'rgba(12,14,24,.92)'; ctx.fillRect(M.x, M.y, M.w, M.h); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2; ctx.strokeRect(M.x, M.y, M.w, M.h);
    text('스킬  (Lv ' + infoLv + ' 성장 반영)', M.x + 16, M.y + 28, 16, '#ffd34d', 'left'); text('로그라이크·레이드 / 비무장 수치', M.x + M.w - 16, M.y + 28, 12, '#aab3c8', 'right', false);
    rowsP.forEach((row, j) => {
      const yy = M.y + 54 + j * 64, rd = rowsD[j] || row;
      text(fitStr(row.n, M.w - 32, 14), M.x + 16, yy, 14, j === 3 ? '#ffd34d' : '#ffe9a0', 'left');
      text(fitStr('로그라이크·레이드  ' + row.c1, M.w - 32, 12), M.x + 16, yy + 16, 12, '#fff', 'left', false);
      text(fitStr('비무장  ' + rd.c1, M.w - 32, 12), M.x + 16, yy + 31, 12, '#9ad4ff', 'left', false);
      text(fitStr(row.c2, M.w - 32, 11.5), M.x + 16, yy + 46, 11.5, '#ffb27a', 'left', false);
    });
    text('조건부 버프 · 고유 능력', M.x + 16, M.y + 322, 15, '#ffd34d', 'left');
    infoBuffLines(id, infoLv).forEach((ln, j) => text(fitStr('•  ' + ln, M.w - 32, 12.5), M.x + 16, M.y + 344 + j * 20, 12.5, '#dfe3f5', 'left', false));
    const HH = id === 'lubu' ? [HEROES.lubu, HEROES.lubu2] : [HEROES[id]];
    text('스킬 설명', M.x + 16, M.y + 470, 14, '#ffd34d', 'left');
    HH.forEach((h, hi) => text(fitStr((id === 'lubu' ? (hi ? '하마  ' : '상마  ') : '') + h.info.map(r => r[0] + ' ' + r[1]).join('  ·  '), M.w - 32, 11.5), M.x + 16, M.y + 490 + hi * 18, 11.5, '#aab3c8', 'left', false));
    // ---- 오른쪽: 영웅 성장 (고유 성장 단계) ----
    const R = { x: 866, y: 142, w: 374, h: 514 }; ctx.fillStyle = 'rgba(12,14,24,.92)'; ctx.fillRect(R.x, R.y, R.w, R.h); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2; ctx.strokeRect(R.x, R.y, R.w, R.h);
    text('영웅 성장  (Lv 1·5·10·15·20·25·30)', R.x + 16, R.y + 28, 15, '#ffd34d', 'left');
    text(fitStr('Lv ' + infoLv + ' 누적: 체력 +' + m.hp + ' · 공격력 +' + m.atk + ' · 방어력 +' + m.def + ' · 스킬 성장 ' + g.tiers.filter(t => infoLv >= t.lv && (t.fx.dmg || t.fx.hits || t.fx.buff)).length + '개', R.w - 32, 11.5), R.x + 16, R.y + 46, 11.5, '#9dff9d', 'left', false);
    g.tiers.forEach((t, j) => {
      const yy = R.y + 56 + j * 64, on = infoLv >= t.lv, cur = curLv >= t.lv, skill = !!(t.fx.dmg || t.fx.hits || t.fx.buff), stat = !!(t.fx.hp || t.fx.atk || t.fx.def);
      ctx.fillStyle = on ? 'rgba(60,200,90,.14)' : 'rgba(255,255,255,.04)'; ctx.fillRect(R.x + 10, yy, R.w - 20, 58); ctx.strokeStyle = on ? '#4fd36a' : 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.strokeRect(R.x + 10, yy, R.w - 20, 58);
      text('Lv ' + t.lv, R.x + 20, yy + 17, 13, on ? '#9dff9d' : '#7a8196', 'left'); text(t.name, R.x + 74, yy + 17, 14, on ? '#fff' : '#8a90a6', 'left');
      text((stat ? '능력치 ' : '') + (skill ? '스킬' : ''), R.x + R.w - 20, yy + 17, 11, on ? '#ffd34d' : '#6c7288', 'right');
      const parts = fxText(id, t.fx, '\n').split('\n'); parts.slice(0, 3).forEach((p, k) => text(fitStr(p, R.w - 40, 10.5), R.x + 20, yy + 31 + k * 12, 10.5, on ? '#cfeed6' : '#6c7288', 'left', false));
      if (cur) text('✔ 달성', R.x + R.w - 20, yy + 53, 10.5, '#7dff9a', 'right', false);
    });
  } finally { rec.lv = old; applyGrowth('yeonui'); mode = 'yeonui'; }
  const b = INFO_BACK; ctx.fillStyle = 'rgba(10,12,20,.9)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = '#cfd3e6'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h); text('뒤로', b.x + b.w / 2, b.y + 21, 15, '#cfd3e6', 'center');
}
function applyGrowth(m) {
  m = m || mode; const on = !!ACC && (m === 'yeonui' || m === 'duel'), G = pc => growthFx(pc, on ? heroLv(pc) : 0);
  const gg = G('guan'), gl = G('lubu'), gz = G('zhao'), gd = G('diao'), gdn = G('dian'), ghz = G('huang'), src = { guan: gg, lubu: gl, lubu2: gl, zhao: gz, diao: gd, dian: gdn, huang: ghz };
  for (const id in src) {   // 스킬 피해량 +%
    const d = src[id].dmg, sc = b => ({ a: b.a * (1 + (d.a || 0)), s1: b.s1 * (1 + (d.s1 || 0)), s2: b.s2 * (1 + (d.s2 || 0)), u: b.u * (1 + (d.u || 0)) });
    HEROES[id]._balCur = { pve: sc(BAL_BASE[id].pve), duel: sc(BAL_BASE[id].duel) };
  }
  // 조건부 버프 수치
  HEROES.guan.guard.bonus = 0.5 + (gg.buff.guard || 0); HEROES.guan.ultGuard = 0.5 + (gg.buff.ultGuard || 0);
  HEROES.lubu.runBonus = 1.2 + (gl.buff.runBonus || 0); HEROES.lubu2.comboBuff.atk = 1.1 + (gl.buff.comboBuff || 0);
  HEROES.zhao.aspdBuff.mult = 1.10 + (gz.buff.aspdBuff || 0); HEROES.zhao.postUltAspd = 1.10 + (gz.buff.postUltAspd || 0);
  BLESS_ATK = 0.1 + (gd.buff.blessAtk || 0); BLESS_DEF = 0.1 + (gd.buff.blessDef || 0); HEAL_POW = 1 + (gd.buff.healPow || 0); ULT_HEAL_POW = HEAL_POW + (gd.buff.ultHeal || 0);
  HEROES.dian.undy.dur = 6 * (1 + (gdn.buff.undyDur || 0)); HEROES.dian.undy.atk = 1.3 + (gdn.buff.undyAtk || 0); DIAN_BLADES = 2 + (gdn.hits.dianS1 || 0);
  HEROES.huang.aspdBuff.mult = 1.12 + (ghz.buff.huangAspd || 0); HUANG_K = 1 + (ghz.hits.huangS1 || 0); RAIN_N = 4 + (ghz.hits.huangRain || 0); CRYSTAL_STUN_UP = ghz.buff.crystalStun || 0;
  DIAO_S1_N = 3 + (gd.hits.diaoS1 || 0); DIAO_S1_TIMES = Array.from({ length: DIAO_S1_N }, (_, i) => 0.12 + 0.18 * i);
  // 공격 횟수 (한 번의 피해는 그대로이므로 횟수만큼 총 피해가 늘어난다)
  GUAN_S1_N = 3 + (gg.hits.guanS1 || 0); GUAN_S1_TIMES = Array.from({ length: GUAN_S1_N }, (_, i) => 0.12 + 0.15 * i);
  const fn = 4 + (gz.hits.zhaoS1 || 0); FLURRY_TIMES = Array.from({ length: fn }, (_, i) => 0.08 + 0.075 * (i)); FLURRY_DUR = 0.08 + 0.075 * (fn - 1) + 0.14;
  ZU_H = ZU_H0 + (gz.hits.zhaoU || 0);
  LU_N = LU_N0 + (gl.hits.lubuQi || 0); LU_END = LU_TICK0 + LU_N * LU_IV + 0.15;
  const rn = 3 + (gl.hits.lubuRush || 0), R3 = RUSH_SPECS.three, B3 = GROW_BASE.rush; R3.n = rn; R3.wind = Array.from({ length: rn }, (_, i) => B3.wind[Math.min(i, B3.wind.length - 1)]); R3.dash = Array.from({ length: rn }, (_, i) => B3.dash[Math.min(i, B3.dash.length - 1)]);
  SHOOT_N = 3 + (gl.hits.lubuVolley || 0); SHOOT_TIMES = Array.from({ length: SHOOT_N }, (_, i) => 0.1 + 0.12 * i);
  SKD_CLEAR();
}
function SKD_CLEAR() { for (const k in SKD) delete SKD[k]; }
const CRIT_BASE = 0.2, CRIT_BASE_DMG = 1.8;   // 표기용 (치명타는 레벨로 성장하지 않음)
function fitStr(s, w, size) { ctx.font = '500 ' + size + 'px ' + FONT; if (ctx.measureText(s).width <= w) return s; while (s.length > 2 && ctx.measureText(s + '…').width > w) s = s.slice(0, -1); return s + '…'; }
function zultInit(u, list) {
  const tg = list.filter(e => !e.dead && dist(u, e) < ULT_RADIUS + e.r).sort((a, b) => dist(u, a) - dist(u, b)).slice(0, ZU_MAX);
  return { tg, n: tg.length * ZU_H, i: 0, seg: null };
}
function zultHitFx(u, tg) {
  const ca = Math.cos(u.face), sa = Math.sin(u.face);
  fx.push({ k: 'beam', hid: fxHeroNow, x: u.x + ca * 60, y: u.y - 14 + sa * 60, ang: u.face, len: 60, w: 20, t: 0, dur: 0.12 }); sparks(tg.x, tg.y - 20, 3, '#d8f0ff', 300, 0.25); if (Math.random() < 0.5) sfx('swing');
}
function zultStep(u, a, z, hitFn) {   // 한 프레임 진행. 끝나면 true
  while (z.i < z.n) {
    const t0 = ZU_WIND + z.i * ZU_IV;
    if (!z.seg) {
      const bi = Math.floor(z.i / ZU_BLOCK); let tg = null;
      for (let k = 0; k < z.tg.length && !tg; k++) { const c = z.tg[(bi + k) % z.tg.length]; if (!c.dead) tg = c; }
      if (!tg) { z.i = z.n; break; }
      const ang = z.i * 2.4 + 1, tx = tg.x + Math.cos(ang) * ZU_STAND, ty = tg.y + Math.sin(ang) * ZU_STAND * 0.8;
      z.seg = { fx: u.x, fy: u.y, tx, ty, tg };
      if (u === P && mode !== 'duel') slowT = Math.max(slowT, ZU_SLOW);   // 찌르기를 시작할 때마다 짧은 슬로 모션
      const l = Math.hypot(tx - u.x, ty - u.y), an = Math.atan2(ty - u.y, tx - u.x); if (l > 30) streak(u.x, u.y - 6, an + Math.PI, Math.min(l, 320), 5, 0.5, '#bfe8ff');
    }
    const s = z.seg, f = clamp((a.t - t0) / ZU_IV, 0, 1);
    u.x = s.fx + (s.tx - s.fx) * f; u.y = s.fy + (s.ty - s.fy) * f; u.face = Math.atan2(s.tg.y - u.y, s.tg.x - u.x); arenaClamp(u);
    { const px = z.lx == null ? s.fx : z.lx, py = z.ly == null ? s.fy : z.ly, dd = Math.hypot(u.x - px, u.y - py), n = Math.min(4, Math.max(1, Math.round(dd / 60))); for (let k = 1; k <= n; k++) ghost(px + (u.x - px) * k / n, py + (u.y - py) * k / n, u.face, u === P ? undefined : u.hero, { dur: 0.4, a: 0.6, glow: 'rgba(150,215,255,1)' }); z.lx = u.x; z.ly = u.y; }
    if (f >= 1) { hitFn(s.tg); z.seg = null; z.i++; continue; }
    return false;
  }
  return true;
}
function zultEnd(u, H) {   // 마무리 연출 + 사용 후 버프
  ring(u.x, u.y, 170, 0.4, H.ult.a, 10); ring(u.x, u.y, 90, 0.3, '#fff', 6); sparks(u.x, u.y - 20, 24, H.ult.a, 600, 0.5); sfx('boom');
  u.postUltT = H.postUltDur; dmgText(u.x, u.y - 100, H.postUltAspd ? '공속 +' + Math.round((H.postUltAspd - 1) * 100) + '%' : '공격력 +' + Math.round(((H.postUltAtk || 1) - 1) * 100) + '%', '#ffb04d', 26);
}
function startAttack(m) {
  const chain = P.comboT > 0 || (P.act && P.act.type === 'atk');
  P.combo = chain ? (P.combo + 1) % (HERO.comboLen || 3) : 0;
  aim(m);
  P.act = { type: 'atk', t: 0, dur: comboTable()[P.combo].dur, c: P.combo, n: 0 };
  if (auto && mode === 'duel') P.comboT = 1.0;   // 비무장 AUTO: AI 와 같이 공격을 시작할 때 콤보 유지 시간 1.0초
  sfx('swing');
}
function startAct(type, dur, m) { aim(m); P.act = { type, t: 0, dur, hits: 0, set: new Set(), done: false }; }
// 방향 입력 없이 회피만 눌렀을 때의 자동 방향: 가장 임박한 공격을 읽고, 회피 이동(DASH_DIST) 후 위험 범위에서 가장 멀리 벗어나는 방향을 고른다.
//  (돌진은 진행 방향에 수직, 도약은 낙하 지점에서 멀어지는 쪽, 십자는 선이 없는 대각, 범위형은 반경/각도를 벗어나는 쪽. 투창은 공격자 반대쪽)
//  임박한 공격이 없으면 가장 가까운 적의 반대쪽으로 물러남 (적이 없으면 바라보는 방향의 반대)
const DASH_DIST = 209;   // 회피 이동 거리 (속도 950 x 0.22초)
function dashMargin(e, c, x, y) {   // (x,y) 가 공격 범위에서 얼마나 벗어나 있는가 (양수 = 안전, 음수 = 범위 안)
  const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
  switch (c.kind) {
    case 'circle': return d - (c.r + P.r);
    case 'cone': { const df = angDiff(e.face, a); return Math.max(d - (c.r + P.r), df > c.half ? d * Math.sin(Math.min(df - c.half, Math.PI / 2)) - P.r : -1); }
    case 'leap': case 'rain': return Math.hypot(x - c.tx, y - c.ty) - (c.r + P.r);
    case 'cross': { const ang = e.face + c.off, ca = Math.cos(ang), sa = Math.sin(ang), lx = Math.abs(dx * ca + dy * sa), ly = Math.abs(-dx * sa + dy * ca); return Math.max(Math.min(lx, ly) - (c.w / 2 + P.r), Math.max(lx, ly) - c.len); }
    case 'charge': { const cf = Math.cos(e.face), sf = Math.sin(e.face), al = dx * cf + dy * sf, lat = Math.abs(-dx * sf + dy * cf); return Math.max(lat - ((c.hitR || e.r) + P.r), -al - P.r, al - c.len - P.r); }
  }
  return 0;
}
function smartDashAngle() {
  let best = null, bt = 1e9;
  for (const e of enemies) {
    if (e.dead || e.state !== 'wind' || !e.cur) continue;
    const c = e.cur; if (c.kind === 'fan' ? dist(e, P) > 900 : !threatens(e)) continue;
    const rem = c.windup - e.t; if (rem < bt) { bt = rem; best = e; }
  }
  if (!best) { const t = nearest(520); return t ? angTo(t, P) : P.face + Math.PI; }
  const c = best.cur, away = angTo(best, P);
  if (c.kind === 'fan') return away;
  let base = away;
  if (c.kind === 'charge') base = best.face + (Math.sin(away - best.face) >= 0 ? 1 : -1) * Math.PI / 2;
  else if (c.kind === 'leap') base = Math.hypot(P.x - c.tx, P.y - c.ty) > 20 ? Math.atan2(P.y - c.ty, P.x - c.tx) : away;
  let bestA = base, bs = -1e9;
  for (let k = 0; k < 16; k++) {   // 기본 방향에서 ±22.5° 단위로 후보를 만들어 범위 이탈량이 가장 큰 방향 선택 (비슷하면 기본 방향에 가까운 쪽)
    const dev = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 8, ang = base + dev, ex = P.x + Math.cos(ang) * DASH_DIST * dashSpeedNow() / 950, ey = P.y + Math.sin(ang) * DASH_DIST * dashSpeedNow() / 950;
    const sc = Math.min(dashMargin(best, c, ex, ey), 120) - Math.abs(dev) * 6;
    if (sc > bs) { bs = sc; bestA = ang; }
  }
  return bestA;
}
function startDash(m) {
  P.cd.dash = dashCdNow(); P.inv = dashInvNow();
  let dx = m.mx, dy = m.my; const l = Math.hypot(dx, dy);
  if (l > 0.2) { P.face = Math.atan2(dy, dx); } else { P.face = smartDashAngle(); }
  P.act = { type: 'dash', t: 0, dur: 0.22 }; sfx('dash');
}
function canCancel(a) { return (a.type === 'atk' && a.t > a.dur * (a.c === 2 ? 0.75 : 0.6)) || (a.type === 'dash' && a.t > a.dur * 0.8); }

function updatePlayer(dt) {
  fxHeroNow = HERO.id;
  if (P.dead) return;
  const p = P;
  for (const k in p.cd) p.cd[k] = Math.max(0, p.cd[k] - dt);
  p.tagCd = Math.max(0, p.tagCd - dt); p.hitT = Math.max(0, (p.hitT || 0) - dt);
  p.rage = Math.min(100, p.rage + dt / ULT_CD * 100 * (1 + RUN.rage + META.rage));   // 궁극기 쿨타임
  for (const id of TEAM) if (id !== HERO.pc && p.hpStore[id] > 0) p.hpStore[id] = Math.min(heroMaxHp(id), p.hpStore[id] + heroMaxHp(id) * BENCH_REGEN * dt);   // 대기 중인 영웅은 천천히 회복 (전투 불능이면 회복 안 함)
  for (const id in p.cdStore) { const st = p.cdStore[id]; st.s1 = Math.max(0, st.s1 - dt); st.s2 = Math.max(0, st.s2 - dt); } for (const k in p.s2Store) p.s2Store[k] = Math.max(0, p.s2Store[k] - dt);   // 대기 중인 영웅의 스킬 쿨타임도 흐름
  p.inv = Math.max(0, p.inv - dt); p.flash = Math.max(0, p.flash - dt); p.comboT = Math.max(0, p.comboT - dt);
  if (p.hitsT > 0) { p.hitsT -= dt; if (p.hitsT <= 0) { p.hits = 0; p.hitTier = 0; } }
  if (p.freeze > 0) { p.freeze -= dt; return; }   // 역경직: 적중 직후 플레이어만 잠깐 정지
  let m = manualMove();
  if (auto) { if (Math.hypot(m.mx, m.my) > 0.3) auto = false; else m = autoInput(dt); }
  const ml = Math.hypot(m.mx, m.my); if (TUT && ml > 0.3) tutEvent('move', dt);
  const mv = ml > 1 ? { x: m.mx / ml, y: m.my / ml } : { x: m.mx, y: m.my };

  // 행동 시작 판정 (우선순위: 회피 > 궁극기 > 청룡참 > 회전참 > 공격)
  for (let i = 0; i < TEAM.length; i++) if (want('tag' + i)) { use('tag' + i); tryTag(TEAM[i]); }
  let a = p.act;
  if (want('dash') && p.cd.dash <= 0 && (!a || (a.type !== 'ult' && !a.invul && a.type !== 'dash' && a.type !== 'stun'))) { use('dash'); startDash(m); }
  else if (!a || canCancel(a)) {
    if (want('s3') && p.rage >= 100) { use('s3'); p.rage = 0; if (mode !== 'duel' && !HERO.ultRush && !HERO.zUlt && !HERO.lUlt && !HERO.rageUlt && !HERO.crystalUlt) slowT = Math.max(slowT, ULT_SLOW);   // 궁극기: 일괄 슬로우 모션 (실시간 2.2초)
      if (HERO.ultRush) startRush(m, RUSH_SPECS.three); else if (HERO.zUlt) { aim(m); P.act = { type: 'zult', t: 0, dur: 99, invul: true, set: new Set(), done: false }; } else if (HERO.lUlt) { aim(m); P.act = { type: 'lult', t: 0, dur: 99, invul: true, set: new Set(), done: false }; } else if (HERO.crystalUlt) { aim(m); startAct('crystal', 1.0, m); } else if (HERO.rageUlt) { aim(m); startAct('rage', 0.7, m); P.act.invul = true; } else startAct('ult', 1.3, m); sfx('skill'); if (!HERO.ultRush) flashT = 0.15; if (HERO.ultGuard) { p.ultGuardT = HERO.ultGuardDur; dmgText(p.x, p.y - 100, '방어력 +' + Math.round(HERO.ultGuard * 100) + '%', '#7fffd0', 24); } }
    else if (want('s2') && s2Ready()) { use('s2'); castS2(); if (HERO.rush) startRush(m, RUSH_SPECS[HERO.rushSpec || 'one']); else if (HERO.rainS2) { startAct('rain', RAIN_DUR(), m); P.act.rn = 0; rainZone(P, P.act); ring(P.act.rx, P.act.ry, RAIN_R, 0.7, '#ffe08a', 5); } else if (HERO.slam) startAct('slam', 0.5, m); else if (HERO.bless) startAct('bless', 0.55, m); else if (HERO.shoot) startAct('shoot', 0.5 + 0.12 * (SHOOT_N - 3), m); else startAct('s2', S2_DASH_END + 0.26, m); sfx('swing'); }
    else if (want('s1') && p.cd.s1 <= 0 && HERO.s1Switch) { use('s1'); p.cd.s1 = CD.s1 * (1 - (RUN.cd + META.cd)); doFormSwitch(); p.act = { type: 'switch', t: 0, dur: 0.3, set: new Set(), done: false }; }   // 여포: 상마 <-> 하마 전환 (찌르기·방천 베기를 대체)
    else if (want('s1') && p.cd.s1 <= 0) { use('s1'); p.cd.s1 = CD.s1 * (HERO.s1cdMul || 1) * (1 - (RUN.cd + META.cd)); startAct(HERO.s1Throw ? 'throw' : HERO.s1Snipe ? 'snipe' : 's1', HERO.s1Throw ? 0.6 : HERO.s1Snipe ? 0.7 : HERO.s1Heal ? DIAO_S1_DUR() : HERO.s1Cone ? CONE_DUR : HERO.s1Flurry ? FLURRY_DUR : HERO.thrust ? 0.45 : 0.7 + 0.15 * (GUAN_S1_N - 3), m); if (HERO.thrust) { const tg = nearest(THRUST_LEN); if (tg) P.face = angTo(P, tg); } sfx('swing'); }
    else if (want('attack')) { use('attack'); startAttack(m); }
  }
  a = p.act;

  // 질주(여포 상마): 공격 3단계(360° 베기)가 적중하면 발동 -> runDur 초 동안 이동속도 x runBonus. 이동하거나 돌격·적토 돌격을 쓰면 지속시간이 갱신됨
  if (HERO.runBonus) {
    if (p.runBuffT > 0 && ml > 0.2 && !a && Math.random() < 0.4) streak(p.x - Math.cos(p.face) * 34, p.y + 6 + rand(-8, 8), p.face + Math.PI, rand(50, 100), 2, 0.22, 'rgba(225,205,160,.9)');
    if (p.runBuffT > 0) { p.runBuffT = (ml > 0.2 || (a && a.type === 'rush')) ? HERO.runDur : Math.max(0, p.runBuffT - dt); if (ml > 0.2 && !a && Math.random() < 0.5) sparks(p.x, p.y + 14, 1, '#c9a46a', 140, 0.3); }   // 이동 중에는 지속시간이 가득 차게 갱신, 멈추면 감소
  }
  p.blessT = Math.max(0, p.blessT - dt); p.undyT = Math.max(0, (p.undyT || 0) - dt); p.floorT = Math.max(0, (p.floorT || 0) - dt); p.lungeT = Math.max(0, (p.lungeT || 0) - dt); p.aspdT = Math.max(0, p.aspdT - dt); p.postUltT = Math.max(0, p.postUltT - dt); p.comboBuffT = Math.max(0, p.comboBuffT - dt); p.ultGuardT = Math.max(0, p.ultGuardT - dt);
  if (HERO.guard && p.guardT > 0) p.guardT = Math.max(0, p.guardT - dt);   // 관우 방어: 3단계 공격 성공 시 켜지고 guard.dur(10초) 동안 지속
  if (p.slowT > 0) p.slowT -= dt; drTick(p, dt);
  const spd = p.speed * (HERO.runBonus && p.runBuffT > 0 ? HERO.runBonus : 1) * (p.buffT > 0 ? WINE_MOVE_SPEEDUP : 1) * (p.slowT > 0 ? 0.55 : 1);   // 술 버프 중 이동속도 +30%
  let vx = 0, vy = 0;
  if (!a) {
    vx = mv.x * spd; vy = mv.y * spd;
    p.mvAmt = ml > 0.2 ? Math.min(1, ml) * (spd / p.speed) : 0; p.mvAng = Math.atan2(mv.y, mv.x);
    if (ml > 0.2) { if (!(auto && mode === 'duel')) p.face = Math.atan2(mv.y, mv.x); p.walk += dt * 12 * (spd / p.speed); p.stepT = (p.stepT || 0) + dt; if (p.stepT > 0.2 / (spd / p.speed)) { p.stepT = 0; sparks(p.x - Math.cos(p.face) * 8, p.y + 12, 2, '#cdbf99', 70, 0.35); } }   // 발걸음 먼지
  } else {
    p.mvAmt = 0;
    // 공격속도 증가(술 버프 +30%, HIT 누적 보너스)는 평타·회전참·청룡참에만 적용하고, 청룡의 힘(ult)에는 적용하지 않는다.
    const atkSpeedBuff = (p.buffT > 0 ? WINE_ATK_SPEEDUP : 1) * comboMul() * (p.aspdT > 0 ? HERO.aspdBuff.mult : 1) * (HERO.postUltAspd && p.postUltT > 0 ? HERO.postUltAspd : 1) * (1 + (RUN.aspd + META.aspd));
    const rate = a.type === 'dash' || a.type === 'hurt' || a.type === 'stun' || a.type === 'rush' || a.type === 'tag' || a.type === 'switch' || a.type === 'zult' || a.type === 'lult' || a.type === 'rage' || a.type === 'crystal' ? 1 : ATK_SPEED * (a.type === 'ult' ? 1 : atkSpeedBuff) * (HERO.atkSlow && (a.type === 'atk' || a.type === 's1') ? HERO.atkSlow : 1);
    a.t += dt * rate;
    const f = p.face, cx = Math.cos(f), sy = Math.sin(f);
    if (a.type === 'atk') {
      const c = comboTable()[a.c];
      if (HERO.kite) { vx = mv.x * spd * 0.5; vy = mv.y * spd * 0.5; if (ml > 0.2) { p.walk += dt * 8; p.mvAmt = 0.5; p.mvAng = Math.atan2(mv.y, mv.x); } }   // 원거리 장수: 이동하며 사격
      if (a.t >= c.move[0] && a.t < c.move[1]) {
        const env = lungeEase((a.t - c.move[0]) / (c.move[1] - c.move[0]));   // 모든 PC: 공격 전진 속도를 부드럽게 가속·감속 (총 이동 거리는 그대로)
        vx = cx * c.move[2] * rate * env; vy = sy * c.move[2] * rate * env;
        p.lungeT = 0.22; p.walk += dt * 14 * env; p.mvAmt = 0.9 * Math.min(1, env); p.mvAng = f;   // 전진하는 동안 달리기 자세(기울임·걸음)
        if (Math.random() < 0.4 * Math.min(1, env)) sparks(p.x - cx * 20, p.y + 14, 1, '#c9a46a', 120, 0.35);
      }
      if (a.n < c.hits.length && a.t >= c.hits[a.n]) {
        const i = a.n++;
        if (c.span) {   // 3단계: 몸 주위를 한 바퀴 베는 회전베기 (적중 시점에 가까운 적 쪽으로 방향 보정)
          if (i > 0) { const tg = nearest(420); if (tg) p.face = angTo(p, tg); }
          arcFx(p.x, p.y, p.face, c.rad, 1.5, 0.2, HERO.fx.a, c.dirs[i]); arcFx(p.x, p.y, p.face + Math.PI, c.rad, 1.5, 0.2, HERO.fx.a, c.dirs[i]); sfx('swing');
        } else { if (c.ranged) arrowStreak(p, c.rad, c.fan ? c.fan[i] : 0); else arcFx(p.x, p.y, p.face, c.rad, c.half, 0.22, HERO.fx.a, c.dirs[i]); if (c.slam) { ring(p.x + Math.cos(p.face) * 110, p.y + Math.sin(p.face) * 110, 90, 0.3, '#ffb070', 10); sparks(p.x + Math.cos(p.face) * 120, p.y, 12, '#c9a46a', 420, 0.5); doShake(7); sfx('boom'); } }
        const hitN = doArc(c.rad, c.half, p.atk * c.mult[i] * HERO.bal.a, { kb: c.kb, far: c.far });
        if (a.c === 2 && hitN > 0) {   // 3단계(360° 베기)가 적에게 적중 = 공격 3단계 성공
          if (HERO.guard) { const wasOn = p.guardT > 0; p.guardT = HERO.guard.dur; if (!wasOn) { dmgText(p.x, p.y - 100, '방어력 +' + Math.round(HERO.guard.bonus * 100) + '%', '#8fb4ff', 24); ring(p.x, p.y, 60, 0.3, '#8fb4ff', 5); } }   // 관우: 방어력 증가 (10초, 다시 성공하면 갱신)
          if (HERO.runBonus) { if (p.runBuffT <= 0) { dmgText(p.x, p.y - 100, '이동속도 +' + Math.round((HERO.runBonus - 1) * 100) + '%', '#7fd0ff', 24); ring(p.x, p.y, 70, 0.3, '#7fd0ff', 5); } p.runBuffT = HERO.runDur; }   // 여포(상마): 질주 (10초)
        }
        if (a.c === 2 && hitN > 0 && HERO.comboHeal) comboHeal(p);   // 초선: 3단 공격 성공 시 주변 아군 회복
        if (a.c === 2 && HERO.aspdBuff) { if (p.aspdT <= 0) dmgText(p.x, p.y - 100, '공속 +' + Math.round((HERO.aspdBuff.mult - 1) * 100) + '%', '#bfe8ff', 24); p.aspdT = HERO.aspdBuff.dur; }   // 조운: 3단 공격 성공
        if (a.c === 2 && HERO.comboBuff) { if (p.comboBuffT <= 0) dmgText(p.x, p.y - 100, '공격력 +' + Math.round((HERO.comboBuff.atk - 1) * 100) + '%', '#ffd34d', 24); p.comboBuffT = HERO.comboBuff.dur; }   // 3단 콤보 완주
      }
      if (a.t >= a.dur) { p.act = null; if (!(auto && mode === 'duel')) p.comboT = 0.6; }
    } else if (a.type === 's1') {
      vx = mv.x * spd * 0.35; vy = mv.y * spd * 0.35;
      const times = HERO.s1Cone ? CONE_TIMES : HERO.s1Flurry ? FLURRY_TIMES : HERO.s1Heal ? DIAO_S1_TIMES : GUAN_S1_TIMES;
      if (a.hits < (HERO.thrust ? 1 : HERO.s1Flurry ? FLURRY_TIMES.length : HERO.s1Heal ? DIAO_S1_TIMES.length : GUAN_S1_N) && a.t >= times[a.hits]) {
        a.hits++; sfx('swing');
        if (HERO.s1Cone) coneSlam(a.hits);
        else if (HERO.s1Flurry) flurryHit(a.hits);
        else if (HERO.s1Heal) lotusPulse(p);   // 초선: 연꽃 치유
        else if (HERO.thrust) lineThrust();   // 여포(상마): 찌르기
        else {
          arcFx(p.x, p.y, p.face + a.hits * 2.1, S1_RADIUS, 1.5, 0.2, HERO.fx.s, 1); arcFx(p.x, p.y, p.face + a.hits * 2.1 + Math.PI, S1_RADIUS, 1.5, 0.2, HERO.fx.s, 1);
          doArc(S1_RADIUS, Math.PI, p.atk * 0.85 * SKILL_DMG_MULT * S1_DMG_MULT * HERO.bal.s1, { kb: 260, rec: 2 });
        }
      }
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 's2') {
      if (a.t >= 0.1 && a.t < S2_DASH_END) {
        if (HERO.mounted) { p.ghostT -= dt; if (p.ghostT <= 0) { ghost(p.x, p.y, p.face); p.ghostT = 0.03; } sparks(p.x, p.y + 12, 1, '#c9a46a', 140, 0.3); }   // 기마: 질주 잔상·흙먼지
        vx = cx * 1500 * S2_SPEED_MULT * rate; vy = sy * 1500 * S2_SPEED_MULT * rate; p.inv = Math.max(p.inv, 0.05);
        for (const e of enemies) if (!e.dead && !a.set.has(e) && dist(P, e) < e.r + S2_WIDTH) { a.set.add(e); hitEnemy(e, p.atk * 2.4 * SKILL_DMG_MULT * HERO.bal.s2, { from: P, kb: 600 * S2_KB_MULT }); }
      }
      if (a.t >= S2_DASH_END && !a.done) {   // 돌진 종료 지점 폭발
        a.done = true; arcFx(p.x, p.y, p.face, S2_BLAST, 1.5, 0.2, HERO.fx.s, 1); arcFx(p.x, p.y, p.face + Math.PI, S2_BLAST, 1.5, 0.2, HERO.fx.s, 1);
        doArc(S2_BLAST, Math.PI, p.atk * 1.0 * SKILL_DMG_MULT * HERO.bal.s2, { kb: 350 * S2_KB_MULT });
      }
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'snipe') {   // 황충 백보천양: 뒤로 물러나며 시위를 당겼다가 강궁 한 발
      if (a.t < 0.16) { vx = -cx * 1700 * rate; vy = -sy * 1700 * rate; p.inv = Math.max(p.inv, 0.2); p.walk += dt * 20; if (Math.random() < 0.7) sparks(p.x, p.y + 10, 1, '#e8dcc0', 120, 0.3); }
      else { vx = mv.x * spd * 0.5; vy = mv.y * spd * 0.5; }
      if (!a.done && a.t >= 0.3) { a.done = true; sniperShot(p); }
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'rain') {   // 황충 화살비: 지정 구역에 화살 N 번 낙하 (시전 중 슈퍼아머)
      vx = mv.x * spd * 0.6; vy = mv.y * spd * 0.6;
      while (a.rn < RAIN_N && a.t >= RAIN_T0 + a.rn * RAIN_IV) { a.rn++; rainPulse(p, a); }
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'crystal') {   // 황충 마법의 수정화살: 기운을 모으고 한 발 (시전 중 슈퍼아머)
      vx = mv.x * spd * 0.35; vy = mv.y * spd * 0.35;
      if (a.t < 0.5) { const tg = nearest(2200); if (tg) p.face = angTo(p, tg); }
      if (!a.done && a.t >= 0.5) { a.done = true; crystalFire(p); }
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'throw') {   // 전위 쌍극 투척
      vx = mv.x * spd * 0.35; vy = mv.y * spd * 0.35;
      if (!a.done && a.t >= 0.18) { a.done = true; throwBlades(p); }
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'slam') {   // 전위 지축 강타: 짧게 파고든 뒤 내려찍음
      if (a.t >= 0.08 && a.t < 0.18) { vx = cx * 1200 * rate; vy = sy * 1200 * rate; p.inv = Math.max(p.inv, 0.05); }
      if (!a.done && a.t >= 0.2) { a.done = true; slamHit(p); }
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'rage') {   // 전위 불사의 광기: 포효 (시전 중 무적) 뒤 불사 상태
      p.inv = Math.max(p.inv, 0.1);
      if (!a.done && a.t >= 0.25) { a.done = true; rageStart(p); }
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'bless') {   // 초선 월하 축복: 부채를 들어 올렸다가 내리며 아군 전체에 축복
      vx = mv.x * spd * 0.35; vy = mv.y * spd * 0.35;
      if (!a.done && a.t >= 0.2) { a.done = true; moonBless(p); }
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'shoot') {   // 화살 쏘기: 0.1 / 0.22 / 0.34 에 일제 사격, 이동은 느리게 가능
      vx = mv.x * spd * 0.35; vy = mv.y * spd * 0.35;
      const times = SHOOT_TIMES;
      if (a.hits < SHOOT_TIMES.length && a.t >= times[a.hits]) { a.hits++; fireArrows(); }
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'tag') {   // 태그 스킬 (진입 무적, 슬로우 모션 중에 발동)
      p.inv = Math.max(p.inv, 0.15);
      const dmgT = p.atk * 2.4 * SKILL_DMG_MULT, ca = Math.cos(p.face), sa = Math.sin(p.face);
      if (a.id === 'guan') {   // 관우: 청룡 강림 — 칼끝으로 기운이 모이고 청룡이 내려와 반경 380 폭발 (청룡 연출은 drawTagWorldFx)
        if (a.t < 0.2 && Math.random() < 0.8) { const ang = rand(0, TAU), sx = p.x + Math.cos(ang) * 230, sy2 = p.y + Math.sin(ang) * 170, tx = p.x, ty = p.y - HERO.ult.tipH, l = Math.hypot(tx - sx, ty - sy2); fx.push({ k: 'spark', x: sx, y: sy2, vx: (tx - sx) / l * 520, vy: (ty - sy2) / l * 520, t: 0, dur: 0.4, color: '#7fffd0', sz: 5 }); }
        if (!a.done && a.t >= 0.225) { a.done = true; ring(p.x, p.y, 380, 0.6, '#7fffd0', 18); ring(p.x, p.y, 260, 0.45, '#fff', 10); ring(p.x, p.y, 160, 0.35, '#3affc0', 12); sparks(p.x, p.y - 10, 60, '#7fffd0', 900, 0.8); doShake(20); hitstop = Math.max(hitstop, 0.12); flashT = Math.max(flashT, 0.3); sfx('boom'); doArc(380, Math.PI, dmgT, { kb: 800, rec: 2, shake: 10 }); }
      } else if (a.id === 'zhao') {   // 조운: 백룡 강습 — 짧게 파고들며 전방 직선(길이 560, 폭 120)을 꿰뚫음
        if (a.t >= 0.04 && a.t < 0.16) { vx = ca * 1600; vy = sa * 1600; for (let k = 0; k < 2; k++) { const off = rand(-40, 40); streak(p.x - Math.sin(p.face) * off, p.y + Math.cos(p.face) * off - 6, p.face + Math.PI, rand(100, 200), rand(2, 3), 0.22, '#d8f0ff'); } }
        if (!a.done && a.t >= 0.16) {
          a.done = true; fx.push({ k: 'beam', hid: fxHeroNow, x: p.x + ca * 280, y: p.y - 14 + sa * 280, ang: p.face, len: 280, w: 70, t: 0, dur: 0.35 }); ring(p.x + ca * 60, p.y + sa * 60, 100, 0.4, '#7fd0ff', 10); sparks(p.x + ca * 200, p.y - 10, 30, '#d8f0ff', 700, 0.5); doShake(10); sfx('boom');
          for (const e of enemies) { if (e.dead) continue; const dx = e.x - p.x, dy = e.y - p.y, lx = dx * ca + dy * sa, ly = Math.abs(-dx * sa + dy * ca); if (lx >= -e.r && lx <= 560 + e.r && ly <= 60 + e.r) hitEnemy(e, dmgT * 1.2, { from: P, kb: 700, rec: 2, shake: 8 }); }
        }
      } else if (a.id === 'diao') {   // 초선: 연꽃 강림 — 발밑에서 연꽃이 만개해 아군을 치유하고 주변 적을 밀쳐냄
        if (a.t < 0.2 && Math.random() < 0.8) sparks(p.x + rand(-70, 70), p.y + rand(-20, 20), 1, '#ffb3d6', 220, 0.5);
        if (!a.done && a.t >= 0.2) { a.done = true; ring(p.x, p.y, 380, 0.6, '#ff9ac8', 16); ring(p.x, p.y, 240, 0.45, '#fff', 9); ring(p.x, p.y, 140, 0.35, '#ff5aa8', 12); sparks(p.x, p.y - 10, 50, '#ffb3d6', 800, 0.8); doShake(12); flashT = Math.max(flashT, 0.2); sfx('boom'); healTeam(p, DIAO_HEAL.tag * HEAL_POW, HEAL_R); doArc(340, Math.PI, dmgT * 0.7, { kb: 700, rec: 2, shake: 6 }); }
      } else if (a.id === 'huang') {   // 황충: 백발백중 — 정면 부채꼴로 관통 화살 5발
        if (!a.done && a.t >= 0.2) { a.done = true; for (let k = -2; k <= 2; k++) { const ang = p.face + k * 0.16; projectiles.push({ x: p.x + ca * 30, y: p.y - 14 + sa * 30, vx: Math.cos(ang) * 1200, vy: Math.sin(ang) * 1200, dmg: dmgT * 0.45, life: 0.7, r: 14, arrow: true, friendly: true, hit: new Set() }); } ring(p.x, p.y, 140, 0.4, '#ffe08a', 8); sparks(p.x + ca * 40, p.y - 14, 24, '#fff1c8', 700, 0.5); doShake(8); sfx('boom'); }
      } else if (a.id === 'dian') {   // 전위: 악래 돌진 — 육중하게 돌진해 쌍극으로 내려찍음 (반경 300)
        if (a.t >= 0.02 && a.t < 0.2) { vx = ca * 1400; vy = sa * 1400; }
        if (!a.done && a.t >= 0.2) { a.done = true; ring(p.x, p.y, 300, 0.5, '#ff7a5a', 14); ring(p.x, p.y, 180, 0.4, '#fff', 8); sparks(p.x, p.y - 10, 40, '#ffb88a', 800, 0.7); doShake(16); hitstop = Math.max(hitstop, 0.08); sfx('boom'); doArc(300, Math.PI, dmgT * 1.1, { kb: 900, rec: 2, shake: 8 }); }
      } else if (a.id === 'lubu') {   // 여포(상마): 적토 강습 — 불꽃을 두르고 전방으로 질주 (길이 약 540, 폭 80) + 질주 발동
        if (!a.done) { a.done = true; p.runBuffT = HERO.runDur; ring(p.x, p.y, 140, 0.35, '#ff7a3a', 14); ring(p.x, p.y, 80, 0.3, '#fff', 8); sparks(p.x, p.y - 10, 26, '#ffd27a', 650, 0.5); sfx('boom'); }
        if (a.t >= 0.1 && a.t < 0.3) {
          vx = ca * 2700; vy = sa * 2700;
          p.ghostT -= dt; if (p.ghostT <= 0) { ghost(p.x, p.y, p.face); p.ghostT = 0.015; }
          for (let k = 0; k < 4; k++) { const off = rand(-70, 70); streak(p.x - Math.sin(p.face) * off, p.y + Math.cos(p.face) * off - 6, p.face + Math.PI, rand(140, 280), rand(2, 4), 0.28, k % 2 ? '#fff4d0' : '#ff9a4a'); }
          for (let k = 0; k < 2; k++) fx.push({ k: 'fire', x: p.x - ca * rand(0, 30), y: p.y + 10 - sa * rand(0, 30), r: rand(18, 30), t: 0, dur: rand(0.35, 0.6) });
          sparks(p.x, p.y + 10, 3, Math.random() < 0.5 ? '#ff7a3a' : '#ffd27a', 320, 0.45);
          for (const e of enemies) if (!e.dead && !a.set.has(e) && dist(P, e) < e.r + 80) { a.set.add(e); hitEnemy(e, dmgT, { from: P, kb: 900, rec: 2, shake: 6, stop: 0.05 }); }
        } else if (a.t >= 0.3 && !a.end) { a.end = true; ring(p.x, p.y, 170, 0.4, '#ff7a3a', 14); ring(p.x, p.y, 100, 0.3, '#fff', 8); sparks(p.x, p.y - 8, 28, '#ffd27a', 700, 0.5); doShake(12); }
      } else {   // 여포(하마): 방천 베기 — 거대한 방천화극이 전방에 내리꽂히고 부채꼴(반경 380, ±1.3)이 휩쓸림 (연출은 drawTagWorldFx)
        if (!a.done && a.t >= 0.233) { a.done = true; arcFx(p.x, p.y, p.face, 380, 1.3, 0.28, HERO.fx.a, 1); arcFx(p.x, p.y, p.face, 300, 1.3, 0.28, '#ffd27a', -1); ring(p.x + ca * 200, p.y + sa * 200, 150, 0.45, '#ff7a3a', 14); for (let k = 0; k < 10; k++) { const an = k / 10 * TAU; fx.push({ k: 'fire', x: p.x + ca * 200 + Math.cos(an) * 110, y: p.y + sa * 200 + Math.sin(an) * 70, r: rand(30, 46), t: 0, dur: rand(0.5, 0.9) }); } sparks(p.x + ca * 200, p.y - 10, 40, '#ffd27a', 800, 0.7); doShake(18); hitstop = Math.max(hitstop, 0.1); flashT = Math.max(flashT, 0.25); sfx('boom'); doArc(380, 1.3, dmgT * 1.1, { kb: 800, rec: 2, shake: 10 }); }
      }
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'rush') {
      const sp = a.sp;
      if (a.invul) p.inv = Math.max(p.inv, 0.2); else if (sp.inv) p.inv = Math.max(p.inv, 0.12);   // 단기필마: 돌격(선딜 + 질주) 동안 무적   // 적토 돌격(궁극기): 시전 내내 무적
      if (a.ph === 'wind') {
        a.pt += dt; if (a.pt < sp.wind[a.n] * 0.6) rushAim(m);   // 선딜 앞부분에 조준, 뒷부분은 고정
        if (sp.invul) {   // 궁극기: 질주 방향 뒤쪽으로 속도선이 흐르며 힘을 모음
          if (Math.random() < 0.8) { const off = rand(-sp.w, sp.w); streak(p.x - Math.sin(p.face) * off + Math.cos(p.face) * rand(20, 70), p.y + Math.cos(p.face) * off + Math.sin(p.face) * rand(20, 70) - 6, p.face + Math.PI, rand(60, 130), 2, 0.18, '#ffb070'); }
        }
        if (a.pt >= sp.wind[a.n]) { a.ph = 'dash'; a.pt = 0; a.set = new Set(); sfx('swing'); if (sp.invul) { for (let k = 0; k < 10; k++) { const off = rand(-sp.w, sp.w); streak(p.x - Math.sin(p.face) * off, p.y + Math.cos(p.face) * off - 6, p.face + Math.PI, rand(140, 260), rand(2, 4), 0.3, k % 2 ? '#fff4d0' : '#ff9a4a'); } sparks(p.x, p.y + 8, 10, '#ffd27a', 500, 0.3); } }
      } else {
        a.pt += dt; const v = RUSH_LEN / sp.dash[a.n];
        vx = cx * v; vy = sy * v; p.inv = Math.max(p.inv, 0.05);
        p.ghostT -= dt; if (p.ghostT <= 0) { ghost(p.x, p.y, p.face); p.ghostT = 0.03; }
        if (sp.invul) {   // 속도감: 뒤로 길게 흐르는 속도선 + 촘촘한 잔상 + 얇은 불꽃 꼬리
          const px = -Math.sin(p.face), py = Math.cos(p.face);
          for (let k = 0; k < 4; k++) { const off = rand(-sp.w, sp.w) * 0.9; streak(p.x + px * off - Math.cos(p.face) * rand(0, 30), p.y + py * off - Math.sin(p.face) * rand(0, 30) - 6, p.face + Math.PI, rand(110, 240), rand(1.5, 3.5), 0.22, k % 2 ? '#fff4d0' : '#ff9a4a'); }
          fx.push({ k: 'fire', x: p.x - Math.cos(p.face) * 20, y: p.y + 10 - Math.sin(p.face) * 20, r: rand(14, 22), t: 0, dur: 0.3 });
          p.ghostT = Math.min(p.ghostT, 0.015);
        } else sparks(p.x, p.y + 12, 1, '#c9a46a', 140, 0.3);
        for (const e of enemies) if (!e.dead && !a.set.has(e) && dist(P, e) < e.r + sp.w) { a.set.add(e); hitEnemy(e, p.atk * sp.dmg * SKILL_DMG_MULT * sp.mult * (sp.invul ? HERO.bal.u : HERO.bal.s2), { from: P, kb: sp.kb, stun: sp.stun, rage: sp.invul ? 0 : undefined, breakArmor: !!sp.stun, shake: sp.invul ? 4 : undefined, stop: sp.invul ? 0.03 : undefined }); }
        if (a.pt >= sp.dash[a.n]) {
          a.n++;
          if (sp.invul) sparks(p.x, p.y + 6, 8, '#ffd27a', 420, 0.3);
          if (a.n >= sp.n) {   // 마지막 질주 끝: 폭발
            arcFx(p.x, p.y, p.face, sp.blastR, 1.5, 0.2, HERO.fx.s, 1); arcFx(p.x, p.y, p.face + Math.PI, sp.blastR, 1.5, 0.2, HERO.fx.s, 1);
            doArc(sp.blastR, Math.PI, p.atk * 1.0 * SKILL_DMG_MULT * sp.mult * (sp.invul ? HERO.bal.u : HERO.bal.s2), { kb: sp.blastKb, stun: sp.stun, rage: sp.invul ? 0 : undefined, breakArmor: !!sp.stun });
            if (sp.invul) { ring(p.x, p.y, sp.blastR, 0.25, HERO.ult.a, 5); doShake(5); if (HERO.postUltAtk) { p.postUltT = HERO.postUltDur; dmgText(p.x, p.y - 100, '공격력 +' + Math.round((HERO.postUltAtk - 1) * 100) + '%', '#ffb04d', 26); } } else doShake(8);   // 적토 돌격 후 공격력 증가
            p.act = null;
          } else { a.ph = 'wind'; a.pt = 0; rushAim(m); if (sp.invul && mode !== 'duel') slowT = Math.max(slowT, RUSH_SLOW); }   // 다음 질주 시작: 다시 슬로 모션
        }
      }
    } else if (a.type === 'ult') {
      p.inv = Math.max(p.inv, 0.1);
      const tipX = p.x, tipY = p.y - HERO.ult.tipH;
      if (a.t < 0.15 && Math.random() < 0.8) {   // 주변 기운이 칼날로 빨려 들어감
        const ang = rand(0, TAU), sx = p.x + Math.cos(ang) * 230, sy = p.y + Math.sin(ang) * 170, dx = tipX - sx, dy = tipY - sy, l = Math.hypot(dx, dy);
        fx.push({ k: 'spark', x: sx, y: sy, vx: dx / l * 520, vy: dy / l * 520, t: 0, dur: 0.4, color: HERO.ult.a, sz: 5 });
      }
      if (HERO.ultStyle === 'lance' && a.t >= 0.12 && a.t < 0.55) lanceStreaks(p.x, p.y);   // 백룡강림: 몸 주변으로 흐르는 속도선
      if (a.t >= 0.15 && a.t < 0.55) {   // 칼날에서 청룡의 기운이 사방으로 분출
        for (let k = 0; k < 2; k++) { const ang = rand(0, TAU), sp = rand(180, 520); fx.push({ k: 'spark', x: tipX + rand(-20, 20), y: tipY + rand(-40, 40), vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 120, t: 0, dur: rand(0.3, 0.6), color: Math.random() < 0.5 ? HERO.ult.b : HERO.ult.a, sz: rand(3, 6) }); }
      }
      if (!a.done && a.t >= 0.55) {
        a.done = true; doShake(26); hitstop = Math.max(hitstop, 0.16); flashT = 0.35; sfx('boom');
        ring(p.x, p.y, ULT_RADIUS, 0.6, HERO.ult.a, 18); ring(p.x, p.y, 260, 0.45, '#fff', 10); ring(p.x, p.y, 160, 0.35, HERO.ult.c, 12);
        sparks(p.x, p.y - 10, 50, HERO.ult.a, 900, 0.8);
        if (HERO.healUlt) ultHeal(p);   // 초선: 범위 아군 대량 회복
        if ((HERO.postUltAtk || HERO.postUltAspd) && !HERO.ultRush) { p.postUltT = HERO.postUltDur; dmgText(p.x, p.y - 100, (HERO.postUltAspd ? '공속 +' + Math.round((HERO.postUltAspd - 1) * 100) : '공격력 +' + Math.round((HERO.postUltAtk - 1) * 100)) + '%', '#ffb04d', 26); }   // 천하무쌍: 사용 후 공격력 증가
        for (const e of enemies) if (!e.dead && dist(P, e) < ULT_RADIUS + e.r) hitEnemy(e, p.atk * 6.5 * SKILL_DMG_MULT * ULT_DMG_MULT * HERO.bal.u, { from: P, kb: 900, stun: 2.2, breakArmor: true, stop: 0.1, shake: 12, rage: 0 });
      }
      if ((HERO.ultStyle === 'halberd' || HERO.ultStyle === 'lance') && a.done && a.t < 0.9) for (let k = 0; k < 3; k++) { const ang = rand(0, TAU), rr = Math.sqrt(Math.random()) * ULT_RADIUS, lc = HERO.ultStyle === 'lance'; fx.push({ k: 'spark', x: p.x + Math.cos(ang) * rr, y: p.y + Math.sin(ang) * rr * 0.75, vx: rand(-30, 30), vy: rand(-260, -120), t: 0, dur: rand(0.4, 0.8), color: lc ? (Math.random() < 0.5 ? '#bfe8ff' : '#ffffff') : (Math.random() < 0.5 ? '#ff7a3a' : '#ffd27a'), sz: rand(4, 8) }); }   // 천하무쌍: 솟구치는 불꽃
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'zult') {   // 조운 백룡강림: 고속 이동 연속 찌르기 (이동 중 적과 충돌 없음, 무적)
      p.inv = Math.max(p.inv, 0.1);
      if (a.t < ZU_WIND) { lanceStreaks(p.x, p.y); const tg = nearest(ULT_RADIUS); if (tg) p.face = angTo(p, tg); }
      else {
        if (!a.z) { a.z = zultInit(P, enemies); flashT = Math.max(flashT, 0.12); sfx('boom'); ring(p.x, p.y, 120, 0.3, HERO.ult.a, 8); }
        const per = p.atk * 6.5 * SKILL_DMG_MULT * ULT_DMG_MULT * HERO.bal.u / ZU_H0;
        if (zultStep(p, a, a.z, tg => { hitEnemy(tg, per, { from: P, kb: 40, stun: 2.2, breakArmor: true, rage: 0, shake: 3 }); zultHitFx(P, tg); })) { zultEnd(p, HERO); p.act = null; }
      }
    } else if (a.type === 'lult') {   // 여포(하마) 천하무쌍: 360° 휘두르기 -> 검기 연타 (무적)
      p.inv = Math.max(p.inv, 0.1);
      if (a.t < LU_WIND) { const tg = nearest(ULT_RADIUS); if (tg) p.face = angTo(p, tg); }
      if (lultStep(p, a, HERO, (sh, o) => { const dm = p.atk * 6.5 * SKILL_DMG_MULT * ULT_DMG_MULT * HERO.bal.u * sh; for (const e of enemies) if (!e.dead && dist(P, e) < ULT_RADIUS + e.r) hitEnemy(e, dm, { from: P, kb: o.kb, stun: o.stun, breakArmor: true, rage: 0, shake: o.shake, stop: o.stop }); })) { zultEnd(p, HERO); p.act = null; }
    } else if (a.type === 'switch') {   // 폼 전환 직후 짧은 자세 (슈퍼아머 + 느린 이동)
      vx = mv.x * spd * 0.5; vy = mv.y * spd * 0.5; p.inv = Math.max(p.inv, 0.1);
      if (!a.done && a.t >= 0.2) { a.done = true; formSlash(P, HERO, true); }   // 360° 베기 1회
      if (a.t >= a.dur) p.act = null;
    } else if (a.type === 'stun') {
      if (a.t >= a.dur) { p.act = null; if (mode !== 'duel') p.inv = Math.max(p.inv, 0.6); }   // 스턴 해제 직후 짧은 무적(연속 스턴 방지)
    } else if (a.type === 'hurt') {
      if (a.t >= a.dur) { p.act = null; if (mode !== 'duel') p.inv = Math.max(p.inv, 0.4); }   // 회복 직후 짧은 무적(연속 경직 방지)
    } else if (a.type === 'dash') {
      vx = Math.cos(f) * dashSpeedNow(); vy = Math.sin(f) * dashSpeedNow();
      p.ghostT -= dt; if (p.ghostT <= 0) { ghost(p.x, p.y, p.face); p.ghostT = 0.04; }
      if (a.t >= a.dur) p.act = null;
    }
  }
  vx += p.kx; vy += p.ky; { const kf = Math.exp(-8 * dt); p.kx *= kf; p.ky *= kf; }
  p.x = clamp(p.x + vx * dt, 70, WORLD.w - 70); p.y = clamp(p.y + vy * dt, 80, WORLD.h - 70); arenaClamp(p);
}

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
  const room = a => { const px = u.x + Math.cos(a) * 209 - ARENA_C.x, py = u.y + Math.sin(a) * 209 - ARENA_C.y; return DUEL_R - 40 - Math.hypot(px, py); };
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
  if (mode !== 'duel' && P.hp <= P.maxhp * 0.1 && P.tagCd <= 0 && !(P.act && (P.act.type === 'ult' || P.act.type === 'stun' || P.act.invul))) {   // 자동 태그
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
    c2.dmg *= ENEMY_DMG_MULT * waveDmgMul() * (e.d.mb ? MB.dmg[mbStage(e)] : e.d.zhao ? ZB.dmg[zStage(e)] : e.boss && !e.d.foot ? bossTab(e).dmg[bossStage(e)] : 1);
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
  const fast = e.d.mb ? MB.fast[mbStage(e)] : e.d.zhao ? ZB.fast[zStage(e)] : e.boss && !e.d.foot ? bossTab(e).fast[bossStage(e)] : (e.boss && e.hp < e.maxhp * 0.5 ? 0.8 : 1);
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
    case 'boss': case 'raidBoss': case 'guanBoss': case 'zhaoBoss': case 'bossGeneral': case 'bossCav': case 'bossShield': case 'bossCaster': case 'bossAssassin': case 'bossAlliance': case 'bossCommander':
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
  if (e.d.foot) return e.d.zhao ? zhaoBossAttack(e, d, fast) : guanBossAttack(e, d, fast);
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
function foeHurt(e, u, dmg, stunT) { if (u === P) hurtPlayer(dmg, e, false, stunT); else if (!u.dead) hitEnemy(u, dmg * RAID_ALLY_TAKEN, { ai: true, from: e, kb: 260, stun: stunT || 0, nocrit: true, rec: 1.5 }); }
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
    if (e.boss && !e.d.foot) {   // 보스 여포 단계 상승 알림 (3단계 = 하마 연출이 따로 있음)
      const st = bossStage(e);
      if (e.stage == null) e.stage = st;
      else if (st > e.stage) { e.stage = st; if (e.d.raid) raidStageUp(e, st); else if (st !== 3) { ring(e.x, e.y, 240, 0.5, '#ff6a4a', 12); ring(e.x, e.y, 140, 0.4, '#fff', 8); sparks(e.x, e.y - 30, 30, '#ffcf70', 600, 0.7); doShake(12); flashT = Math.max(flashT, 0.15); sfx('boom'); reinforceMsg = '여포의 기세가 오른다!  (' + (st + 1) + '/6단계)'; reinforceT = 3; } }
    }
    e.x += e.kx * dt; e.y += e.ky * dt; const kf = Math.exp(-9 * dt); e.kx *= kf; e.ky *= kf;
    const PT = tgtOf(e), d = dist(e, PT), toP = angTo(e, PT), sp = e.speed * (e.boss ? (e.mounted ? 1.5 : 1.25) : 1) * (e.slowT > 0 ? (e.boss ? 0.75 : 0.55) : 1);
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
        else { e.chainN = 0; e.atkCd = (cdv + rand(0, 0.6)) * (e.boss ? BOSS_GLOBAL_CD_MULT * (e.d.mb ? MB.cd[mbStage(e)] : e.d.zhao ? ZB.cd[zStage(e)] : e.d.foot ? 1 : bossTab(e).cd[bossStage(e)]) : 1) * pm; }
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
  const n = waveIdx + 1; if (n % UPGRADE_EVERY === 0) openUpgrade(n); else { projectiles = []; beginWave(n); }   // 능력치 강화 선택은 5웨이브마다 (그 사이에는 바로 다음 웨이브)
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
function raidMenuPick(online) { if (online) { raidMsgT = 2.5; sfx('hit'); return; } openRaidBoss(); sfx('skill'); }
// 레이드 보스 선택 (지금은 여포 봉선만 열려 있음)
const RAID_BOSSES = [{ id: 'raidBoss', name: '여포 봉선', sub: '기마 → 하마 · 8단계', open: true }, { name: '관우 운장', sub: '준비 중', open: false }, { name: '조운 자룡', sub: '준비 중', open: false }];
let raidSel = 0;
const RB = { card: i => ({ x: W / 2 - 430 + i * 295, y: 130, w: 270, h: 320 }), go: { x: W / 2 - 160, y: 600, w: 320, h: 60 }, back: { x: 14, y: 14, w: 56, h: 56 } };
function openRaidBoss() { state = 'raidBoss'; mode = 'yeonui'; applyGrowth('yeonui'); raidSel = 0; }
function raidBossNext() { if (!RAID_BOSSES[raidSel].open) { raidMsgT = 2; sfx('hit'); return; } openPick('raid'); sfx('skill'); }
function raidBossClick(x, y) { if (inRect(x, y, RB.back)) { state = 'raidMenu'; return; } for (let i = 0; i < RAID_BOSSES.length; i++) if (inRect(x, y, RB.card(i))) { raidSel = i; if (!RAID_BOSSES[i].open) { raidMsgT = 2; sfx('hit'); } else sfx('hit'); return; } if (inRect(x, y, RB.go)) raidBossNext(); }
function raidBossKey(code) { if (code === 'Escape') state = 'raidMenu'; else if (code === 'ArrowLeft') raidSel = (raidSel + RAID_BOSSES.length - 1) % RAID_BOSSES.length; else if (code === 'ArrowRight') raidSel = (raidSel + 1) % RAID_BOSSES.length; else if (code === 'Enter' || code === 'Space') raidBossNext(); }
function drawRaidBoss() {
  drawLoginScene(); ctx.fillStyle = 'rgba(6,4,14,.55)'; ctx.fillRect(0, 0, W, H);
  backBtn(RB.back);
  text('레이드 보스 선택', W / 2, 62, 40, '#ff8a7a', 'center'); text('오프라인  ·  보스 한 마리를 쓰러뜨리는 협동 전투', W / 2, 96, 15, '#cfd3e6', 'center', false);
  RAID_BOSSES.forEach((b, i) => {
    const r = RB.card(i), sel = i === raidSel; ctx.save(); ctx.globalAlpha = b.open ? 1 : 0.55;
    ctx.fillStyle = sel ? 'rgba(62,26,22,.92)' : 'rgba(18,12,28,.88)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = sel ? '#ffd34d' : 'rgba(255,255,255,.28)'; ctx.lineWidth = sel ? 4 : 1.5; ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#e0504a'; ctx.fillRect(r.x, r.y, r.w, 4);
    if (b.open) { const sp = ctx.createRadialGradient(r.x + r.w / 2, r.y + 230, 8, r.x + r.w / 2, r.y + 230, 120); sp.addColorStop(0, 'rgba(255,214,140,.3)'); sp.addColorStop(1, 'rgba(255,214,140,0)'); ctx.fillStyle = sp; ctx.fillRect(r.x, r.y + 100, r.w, 220); ctx.save(); ctx.translate(r.x + r.w / 2, r.y + 250); ctx.scale(1.1, 1.1); drawCardFigure(HEROES.lubu, 0, 0); ctx.restore(); }
    else { text('🔒', r.x + r.w / 2, r.y + 190, 54, 'rgba(255,255,255,.4)', 'center'); }
    text(b.name, r.x + r.w / 2, r.y + 40, 26, sel ? '#ffe9a0' : '#fff', 'center'); text(b.sub, r.x + r.w / 2, r.y + 66, 14, b.open ? '#ffb27a' : '#8a90a6', 'center', false);
    ctx.restore();
  });
  const d = RAID_BOSSES[raidSel];
  ctx.fillStyle = 'rgba(12,8,22,.78)'; ctx.fillRect(W / 2 - 430, 470, 860, 112); ctx.strokeStyle = 'rgba(255,211,77,.4)'; ctx.lineWidth = 1.5; ctx.strokeRect(W / 2 - 430, 470, 860, 112);
  if (d.open) {
    text(d.name + '  ·  레이드 보스', W / 2 - 410, 500, 19, '#ffe9a0', 'left');
    ['체력이 줄수록 8단계로 강해지고 기마에서 하마로 변하는 보스', '3·6단계에서 부하 소환 · 하마 후 회전 폭풍 · 전쟁의 함성 · 최후의 광폭', '고유 능력: 상태 이상 저항 (경직·스턴·둔화가 거듭될수록 지속시간 감소)'].forEach((t, i) => text(t, W / 2 - 410, 528 + i * 21, 13.5, '#dfe3f5', 'left', false));
  } else text('아직 열리지 않은 보스입니다 (준비 중)', W / 2, 532, 18, '#9aa3b8', 'center');
  const g = RB.go; ctx.globalAlpha = d.open ? 1 : 0.4; ctx.fillStyle = 'rgba(10,12,20,.92)'; ctx.fillRect(g.x, g.y, g.w, g.h); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3; ctx.strokeRect(g.x, g.y, g.w, g.h); text('다음 : 장수 선택 (Enter)', g.x + g.w / 2, g.y + 38, 22, '#ffd34d', 'center'); ctx.globalAlpha = 1;
  if (raidMsgT > 0) { raidMsgT = Math.max(0, raidMsgT - 1 / 60); text('아직 열리지 않은 보스입니다', W / 2, 588, 16, '#ffe9a0', 'center'); }
}
function raidMenuClick(x, y) { if (inRect(x, y, DM.off)) raidMenuPick(false); else if (inRect(x, y, DM.on)) raidMenuPick(true); else if (inRect(x, y, DM.back)) state = 'title'; }
function raidMenuKey(code) { if (code === 'Digit1' || code === 'KeyA' || code === 'ArrowLeft') raidMenuPick(false); else if (code === 'Digit2' || code === 'KeyD' || code === 'ArrowRight') raidMenuPick(true); else if (code === 'Escape') state = 'title'; }
function drawRaidMenu() {
  ctx.drawImage(bg, WORLD.w / 2 - W / 2, WORLD.h / 2 - H / 2, W, H, 0, 0, W, H); ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(0, 0, W, H);
  text('레이드 모드', W / 2, 90, 44, '#ff8a7a', 'center'); text('여포 봉선 — 기마에서 하마까지 8단계로 변하는 보스를 쓰러뜨려라', W / 2, 132, 20, '#cfd3e6', 'center', false);
  const card = (r, key, title, col, lines, dim) => {
    ctx.globalAlpha = dim ? 0.55 : 1; ctx.fillStyle = 'rgba(10,12,20,.9)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.strokeRect(r.x, r.y, r.w, r.h);
    text(key, r.x + 20, r.y + 34, 20, col, 'left'); text(title, r.x + r.w / 2, r.y + 90, 40, col, 'center');
    lines.forEach((ln, i) => text(fitStr(ln, r.w - 40, 15), r.x + r.w / 2, r.y + 150 + i * 28, 15, i ? '#cfd3e6' : '#fff', 'center', false)); ctx.globalAlpha = 1;
  };
  card(DM.off, '1', '오프라인', '#ffd34d', ['PC 1 ~ 3명이 동시에 보스와 전투', '내가 1명을 직접 조작 · 나머지는 AI 동료 (태그 없음)', '내 계정의 영웅 레벨 성장 적용', '보스는 체력에 따라 8단계로 강해집니다']);
  card(DM.on, '2', '온라인', '#7dff9a', ['친구와 함께 보스를 토벌 (협동)', '준비 중입니다'], true);
  if (raidMsgT > 0) text('온라인 레이드는 준비 중입니다', W / 2, 560, 24, '#ffe9a0', 'center');
  const b = DM.back; ctx.fillStyle = 'rgba(10,12,20,.9)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = '#cfd3e6'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h); text('뒤로', b.x + b.w / 2, b.y + 21, 15, '#cfd3e6', 'center');
}
// 비무장 입장: 오프라인(AI 와 대전) / 온라인(친구와 대전) 선택
const DM = { off: { x: W / 2 - 450, y: 200, w: 430, h: 300 }, on: { x: W / 2 + 20, y: 200, w: 430, h: 300 }, back: { x: 12, y: 664, w: 80, h: 30 } };
function openDuelMenu() { state = 'duelMenu'; mode = 'duel'; applyGrowth('duel'); }
function duelMenuPick(online) { pickOnline = online; openPick('duel'); if (online) { if (NET.paired && NET.team.length) duelPick = NET.team; else NET.team = duelPick; } sfx('skill'); }   // 온라인: 선택한 팀(duelPick)이 곧 NET.team (같은 배열)
function duelMenuClick(x, y) { if (inRect(x, y, DM.off)) duelMenuPick(false); else if (inRect(x, y, DM.on)) duelMenuPick(true); else if (inRect(x, y, DM.back)) state = 'title'; }
function duelMenuKey(code) { if (code === 'Digit1' || code === 'KeyA' || code === 'ArrowLeft') duelMenuPick(false); else if (code === 'Digit2' || code === 'KeyD' || code === 'ArrowRight') duelMenuPick(true); else if (code === 'Escape') state = 'title'; }
function drawDuelMenu() {
  ctx.drawImage(bg, WORLD.w / 2 - W / 2, WORLD.h / 2 - H / 2, W, H, 0, 0, W, H); ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(0, 0, W, H);
  text('비무장 모드', W / 2, 90, 44, '#ffd34d', 'center'); text('어떻게 대전할까요?', W / 2, 132, 20, '#cfd3e6', 'center', false);
  const card = (r, key, title, col, lines) => {
    ctx.fillStyle = 'rgba(10,12,20,.9)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.strokeRect(r.x, r.y, r.w, r.h);
    text(key, r.x + 20, r.y + 34, 20, col, 'left'); text(title, r.x + r.w / 2, r.y + 90, 40, col, 'center');
    lines.forEach((ln, i) => text(fitStr(ln, r.w - 40, 15), r.x + r.w / 2, r.y + 150 + i * 28, 15, i ? '#cfd3e6' : '#fff', 'center', false));
  };
  card(DM.off, '1', '오프라인', '#ffd34d', ['AI 와 1 ~ 3명 대전 (적도 같은 인원)', '제한 시간 3분 · 태그 없이 시작부터 전투', '내 계정의 영웅 레벨 성장이 적용됩니다']);
  card(DM.on, '2', '온라인', '#7dff9a', ['방 코드로 친구와 대전 (1~3 vs 1~3)', '제한 시간 3분 · 비무장과 같은 규칙', '영웅 레벨 성장 적용', '(같은 영웅이 양 팀에 있으면 낮은 레벨로 맞춤)']);
  const b = DM.back; ctx.fillStyle = 'rgba(10,12,20,.9)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = '#cfd3e6'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h); text('뒤로', b.x + b.w / 2, b.y + 21, 15, '#cfd3e6', 'center');
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
  ctx.fillStyle = 'rgba(10,12,20,.82)'; ctx.fillRect(R.x, R.y, R.w, R.h); ctx.strokeStyle = '#ff6a5a'; ctx.lineWidth = 2; ctx.strokeRect(R.x, R.y, R.w, R.h);
  text(label, R.x + 12, R.y + 22, 15, '#ff9a8a', 'left'); text(fitStr(sub, 104, 10.5), R.x + 12, R.y + 40, 10.5, '#9aa3b8', 'left', false);
  if (!ids.length) { text(emptyMsg, R.x + R.w / 2 + 50, R.y + R.h / 2 + 6, 15, '#cfd3e6', 'center', false); return; }
  const x0 = R.x + 124, cw = (R.w - 134) / 3;
  ids.forEach((id, i) => {
    const x = x0 + i * cw, lv = lvOf(id), m = flatOf(id, lv), hp = DUEL_HP + m.hp * DUEL_HP / HERO_STATS.hp, atk = HERO_STATS.atk + m.atk, un = GROWTH[id].tiers.filter(t => t.lv > 1 && lv >= t.lv).length, cy = R.y + R.h / 2, raw = rawOf ? rawOf(id) : lv;
    ctx.save(); ctx.beginPath(); ctx.arc(x + 20, cy, 19, 0, TAU); ctx.clip(); ctx.translate(x + 20, cy + 4); ctx.scale(0.62, 0.62); drawPortraitIcon(HEROES[id], 0, 0); ctx.restore(); ctx.strokeStyle = '#ff6a5a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + 20, cy, 19, 0, TAU); ctx.stroke();
    text(PC_NAME[id], x + 46, cy - R.h * 0.24, 15, '#ffe9a0', 'left'); text('Lv ' + lv + (raw !== lv ? ' (상대 Lv ' + raw + ')' : ''), x + 46 + 52, cy - R.h * 0.24, 13, lv >= MAX_LV ? '#ffd34d' : '#9dff9d', 'left');
    text(fitStr('체력 ' + fmtI(hp) + ' · 공격 ' + f1n(atk) + ' · 방어 ' + f1n(m.def), cw - 54, 12), x + 46, cy + 3, 12, '#fff', 'left', false);
    text(fitStr(GROWTH[id].theme.replace(new RegExp(' \\(.*\\)'), '') + ' · 성장 ' + un + '/6', cw - 54, 10.5), x + 46, cy + R.h * 0.25, 10.5, '#ffb27a', 'left', false);
  });
}
const f1n = n => +n.toFixed(1);
function openPick(m) { const gm = m === 'raid' ? 'yeonui' : m; pickFor = m; state = 'pick'; mode = gm; applyGrowth(gm); pickTab = 0; pickFocus = null; duelFoes = []; duelPick = (m === 'duel' ? (duelLast ? duelLast.slice() : []) : TEAM.slice()); }
function togglePick(id) { const k = duelPick.indexOf(id); if (k >= 0) duelPick.splice(k, 1); else if (duelPick.length < 3) duelPick.push(id); if (pickFor === 'duel' && pickOnline) netSendTeam(); }
function pickBack() { if (pickFor === 'duel') { if (pickOnline) { netClose(); NET.status = ''; } state = 'duelMenu'; } else state = pickFor === 'raid' ? 'raidBoss' : 'waves'; }
// 온라인 방 조작 영역 (영웅 선택 화면 아래): 서버 · 방 만들기 · 방 참가 · 대전 시작 · 장수 정보 접기/펴기 + 상대 팀 정보
function onlineLayout() {
  const by = 130 + pickCardH() + 12, fd = pickFold;
  return { by, url: { x: 24, y: by, w: 300, h: 44 }, create: { x: 332, y: by, w: 120, h: 44 }, join: { x: 460, y: by, w: 120, h: 44 }, start: { x: 588, y: by, w: 130, h: 44 }, fold: { x: 726, y: by, w: 190, h: 44 }, strip: { x: 24, y: by + 54, w: 1232, h: fd ? 112 : 60 } };
}
function drawOnlinePanel() {
  const L = onlineLayout(), bx = (r, label, col, dis, sz = 17) => { ctx.globalAlpha = dis ? 0.4 : 1; ctx.fillStyle = 'rgba(10,12,20,.9)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.strokeRect(r.x, r.y, r.w, r.h); text(fitStr(label, r.w - 12, sz), r.x + r.w / 2, r.y + r.h / 2 + 6, sz, col, 'center'); ctx.globalAlpha = 1; };
  const busy = !!NET.ws, none = duelPick.length < 1;
  bx(L.url, '서버: ' + NET.url.replace(new RegExp('^wss?://'), ''), '#9ad4ff', busy, 14);
  bx(L.create, '방 만들기', '#7dff9a', busy || none); bx(L.join, '방 참가', '#4fb0ff', busy || none);
  if (NET.role === 'guest' && NET.paired) bx(L.start, '방장 대기 중', '#ffe9a0', true, 15); else bx(L.start, '대전 시작', '#ffd34d', !(NET.role === 'host' && NET.paired && netReady()));
  if (NET.code) text('방 코드  ' + NET.code, W - 24, L.by + 31, 24, '#ffd34d', 'right');
  if (NET.paired) { const lvT = netLvTable(NET.team, NET.peerTeam); drawFoeRow(L.strip, '상대 팀', NET.peerTeam.length ? '적용 레벨' : '', NET.peerTeam, id => lvT[id] || 1, id => (NET.peerLv || {})[id] || 1, '상대가 영웅을 고르는 중...'); }
  else drawFoeRow(L.strip, '상대 팀', '', [], id => 1, null, '상대가 방에 들어오면 상대 팀의 영웅과 레벨이 표시됩니다');
  if (pickFold) {
    const y = L.strip.y + L.strip.h + 30;
    text('같은 영웅이 양 팀에 있으면 낮은 쪽 레벨로 맞춰 적용됩니다  ·  선택 ' + duelPick.length + ' / 3 (첫 번째 영웅을 직접 조작)', W / 2, y, 14, '#cfd3e6', 'center', false);
    if (NET.role === 'guest' && NET.paired) text('방장이 대전을 시작하기를 기다리는 중...', W / 2, y + 34, 20, '#ffe9a0', 'center');
  }
}
const PICK_FOLD_BTN = { x: W - 220, y: 18, w: 196, h: 34 }, pickGoRect = () => ({ x: W / 2 - 125, y: 130 + pickCardH() + 12, w: 250, h: 48 });
function pickClick(x, y) {
  if (newPickUI()) { pickClickNew(x, y); return; }
  if (inRect(x, y, PICK_FOLD_BTN)) { pickFold = !pickFold; sfx('hit'); return; }
  if (pickFor === 'duel' && pickOnline) {
    const L = onlineLayout();
    if (inRect(x, y, L.url) && !NET.ws) { netPromptUrl(); return; }
    if (!NET.ws && duelPick.length >= 1 && inRect(x, y, L.create)) { netCreate(); return; }
    if (!NET.ws && duelPick.length >= 1 && inRect(x, y, L.join)) { netPromptJoin(); return; }
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
    const A = HERO_STATS.atk + (ACC ? flatOf(id, heroLv(id)).atk : 0), SK = A * SKILL_DMG_MULT, hm = HEROES.lubu.bal, hf = HEROES.lubu2.bal, sp = RUSH_SPECS.three, sum = tb => tb.reduce((t, c) => t + c.mult.reduce((x, y) => x + y, 0), 0);
    return [
      { n: 'J · 공격 (상마 / 하마)', c1: '3단 콤보 합계 ' + fmtI(sum(LUBU_ATK) * A * hm.a) + ' / ' + fmtI(sum(LUBU2_ATK) * A * hf.a), c2: '범위 ' + LUBU_ATK.map(c => Math.round(c.rad)).join('·') + ' / ' + LUBU2_ATK.map(c => Math.round(c.rad)).join('·') },
      { n: 'K · ' + HEROES.lubu.skills.s1 + ' / ' + HEROES.lubu2.skills.s1, c1: '상마 ↔ 하마 전환 (찌르기·방천 베기를 대체)', c2: '쿨 ' + CD.s1 + '초 · 체력·분노 유지 · 스킬2 쿨은 폼별' },
      { n: 'L · 돌격 (상마) / 연사 (하마)', c1: '돌격 피해 ' + fmtI(SK * 3.4 * hm.s2) + ' / 연사 합계 ' + fmtI(SK * 2.4 * S2_ARROW_MULT * 9 * hf.s2), c2: '쿨 ' + CD.s2 + '초 · 폼에 따라 스킬이 바뀜' },
      { n: '; · 적토 돌격 (상마) / 천하무쌍 (하마)', c1: '3연속 질주 합계 ' + fmtI((sp.dmg * sp.n + 1) * SK * sp.mult * hm.u) + ' / 범위 ' + ULT_RADIUS + ' 피해 ' + fmtI(A * 6.5 * SKILL_DMG_MULT * ULT_DMG_MULT * hf.u) + ' (360° + 검기 12연타)', c2: '둘 다 기절 2.2초 · 사용 후 공격 증가' },
    ];
  }
  if (id === 'huang') {   // 황충: 백보천양 · 화살비 · 마법의 수정화살
    const H = HEROES.huang, b = H.bal, A = HERO_STATS.atk + (ACC ? flatOf(id, heroLv(id)).atk : 0), SK = A * SKILL_DMG_MULT, sum = HUANG_ATK.reduce((t, c) => t + c.mult.reduce((x, y) => x + y, 0), 0);
    return [
      { n: 'J · ' + H.skills.attack, c1: '3단 콤보 합계 피해 ' + fmtI(sum * A * b.a) + ' (5발) · 먼 적 최대 +' + Math.round(HUANG_FAR * 100) + '%', c2: '사거리 ' + HUANG_ATK.map(c => Math.round(c.rad)).join('·') + ' · 이동 사격 · 3단 성공 시 공속 +' + Math.round((H.aspdBuff.mult - 1) * 100) + '% (' + H.aspdBuff.dur + '초)' },
      { n: 'K · ' + H.skills.s1, c1: '후퇴 사격 · 강궁 ' + HUANG_K + '발 관통 · 한 발 피해 ' + fmtI(A * 0.85 * SKILL_DMG_MULT * S1_DMG_MULT * 3.0 * b.s1) + ' (먼 적 최대 +40%)', c2: '사거리 ' + Math.round(SNIPE_SPD * SNIPE_LIFE) + ' · 쿨 ' + CD.s1 + '초' },
      { n: 'L · ' + H.skills.s2, c1: '구역 ' + RAIN_N + '회 낙하 · 한 번 피해 ' + fmtI(A * 0.75 * SKILL_DMG_MULT * 3.0 * b.s2), c2: '반경 ' + RAIN_R + ' · 사거리 900 · 둔화 -45% · 시전 중 슈퍼아머·이동 가능 · 쿨 ' + CD.s2 + '초' },
      { n: '; · ' + H.skills.s3, c1: '피해 ' + fmtI(A * 6.5 * SKILL_DMG_MULT * ULT_DMG_MULT * b.u) + ' · 기절 ' + (1 * (1 + CRYSTAL_STUN_UP)).toFixed(1) + ' ~ ' + Math.min(3.5 * (1 + CRYSTAL_STUN_UP), 7).toFixed(1) + '초 (멀수록 길게)', c2: '사거리 ' + Math.round(CRYSTAL_SPD * CRYSTAL_LIFE) + ' · 주변 폭발 피해 40% · 보스는 기절 최대 2초' }];
  }
  if (id === 'dian') {   // 전위: 쌍극 투척 · 지축 강타 · 불사의 광기
    const H = HEROES.dian, b = H.bal, A = HERO_STATS.atk + (ACC ? flatOf(id, heroLv(id)).atk : 0), SK = A * SKILL_DMG_MULT, sum = DIAN_ATK.reduce((t, c) => t + c.mult.reduce((x, y) => x + y, 0), 0), U = H.undy;
    return [
      { n: 'J · ' + H.skills.attack, c1: '3단 콤보 합계 피해 ' + fmtI(sum * A * b.a) + ' (3타)', c2: '범위 ' + DIAN_ATK.map(c => Math.round(c.rad)).join('·') + ' · 3단 성공 시 공격력 +' + Math.round((H.comboBuff.atk - 1) * 100) + '% (' + H.comboBuff.dur + '초)' },
      { n: 'K · ' + H.skills.s1, c1: '쌍극 ' + DIAN_BLADES + '자루 관통 · 한 자루 피해 ' + fmtI(A * 0.85 * SKILL_DMG_MULT * S1_DMG_MULT * 1.6 * b.s1), c2: '사거리 ' + Math.round(BLADE_SPEED * BLADE_LIFE) + ' · 쿨 ' + CD.s1 + '초' },
      { n: 'L · ' + H.skills.s2, c1: '파고들어 내려찍기 피해 ' + fmtI(SK * 3.0 * b.s2), c2: '반경 ' + SLAM_R + ' · 멀리 밀쳐냄 · 쿨 ' + CD.s2 + '초' },
      { n: '; · ' + H.skills.s3, c1: '시전마다 ' + U.dur.toFixed(1) + '초 공격력 +' + Math.round((U.atk - 1) * 100) + '% · 흡혈 ' + Math.round(U.ls * 100) + '%', c2: '전투당 1회 ' + U.floor + '초간 죽지 않음(생명력 1 보호) · 포효 폭발 ' + fmtI(SK * 2.0 * b.u) + ' (반경 240) · 시전 중 무적' }];
  }
  if (id === 'diao') {   // 초선(힐러): 회복량 중심 표기
    const H = HEROES.diao, b = H.bal, A = HERO_STATS.atk + (ACC ? flatOf(id, heroLv(id)).atk : 0), SK = A * SKILL_DMG_MULT, hm = healMul(), q = v => +(v * 100 * hm).toFixed(1), qo = v => +(v * 100 * (mode === 'duel' ? DUEL_HEAL_OTHER : hm)).toFixed(1), hs = v => mode === 'duel' ? '자신 +' + q(v) + '% / 다른 아군 +' + qo(v) + '%' : '아군 +' + q(v) + '%', n = DIAO_S1_TIMES.length, sum = DIAO_ATK.reduce((t, c) => t + c.mult.reduce((x, y) => x + y, 0), 0);
    return [
      { n: 'J · ' + H.skills.attack, c1: '3단 콤보 합계 피해 ' + fmtI(sum * A * b.a) + ' (3타)', c2: '범위 ' + DIAO_ATK.map(c => Math.round(c.rad)).join('·') + ' · 3단 성공 시 아군 생명력 +' + q(DIAO_HEAL.combo * HEAL_POW) + '%' },
      { n: 'K · ' + H.skills.s1, c1: '연꽃 ' + n + '회 · 매회 생명력 ' + hs(DIAO_HEAL.pulse * HEAL_POW), c2: '회복 범위 ' + HEAL_R + ' · 적 합계 피해 ' + fmtI(A * 0.85 * SKILL_DMG_MULT * S1_DMG_MULT * b.s1 * n) + ' · 쿨 ' + CD.s1 + '초 · 슈퍼아머' },
      { n: 'L · ' + H.skills.s2, c1: '아군 전체 공격력 +' + Math.round(BLESS_ATK * 100) + '% · 방어력 +' + Math.round(BLESS_DEF * 100) + '% (' + BLESS_DUR + '초)', c2: '주변 적 피해 ' + fmtI(SK * 1.2 * b.s2) + ' · 밀쳐냄 · 쿨 ' + CD.s2 * (H.s2cdMul || 1) + '초' },
      { n: '; · ' + H.skills.s3, c1: '범위 ' + ULT_HEAL_R + ' 생명력 ' + hs(DIAO_HEAL.ult * ULT_HEAL_POW) + ' · 적 피해 ' + fmtI(A * 6.5 * SKILL_DMG_MULT * ULT_DMG_MULT * b.u), c2: '범위 ' + ULT_RADIUS + ' 적 기절 2.2초 · 무적 연출' + (mode === 'duel' ? '' : ' · 대기 중인 동료도 회복') },
    ];
  }
  const H = HEROES[id], b = H.bal, A = HERO_STATS.atk + (ACC ? flatOf(id, heroLv(id)).atk : 0), S1U = A * 0.85 * SKILL_DMG_MULT * S1_DMG_MULT * b.s1, SK = A * SKILL_DMG_MULT;
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
const PK = { back: { x: 14, y: 14, w: 56, h: 56 }, list: i => ({ x: 22, y: 92 + i * 80, w: 184, h: 72 }), arrL: { x: 224, y: 270, w: 42, h: 84 }, arrR: { x: 598, y: 270, w: 42, h: 84 }, toggle: { x: 262, y: 520, w: 340, h: 46 }, tab: i => ({ x: 700 + i * 172, y: 184, w: 160, h: 38 }), slot: i => ({ x: 24 + i * 162, y: 604, w: 152, h: 100 }), go: { x: W - 304, y: 610, w: 280, h: 86 }, on: { url: { x: 530, y: 600, w: 200, h: 34 }, create: { x: 738, y: 600, w: 100, h: 34 }, join: { x: 846, y: 600, w: 100, h: 34 } }, panel: { x: 680, y: 92, w: 576, h: 484 } };
function backBtn(b) { ctx.fillStyle = 'rgba(10,8,20,.8)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2.5; ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(b.x + b.w / 2 + 7, b.y + 14); ctx.lineTo(b.x + b.w / 2 - 7, b.y + b.h / 2); ctx.lineTo(b.x + b.w / 2 + 7, b.y + b.h - 14); ctx.stroke(); }
const pickSlotLabels = () => (pickFor === 'duel' || pickFor === 'raid') ? ['조작', '아군 AI', '아군 AI'] : ['시작', '태그 Z', '태그 X'];
function pickCycleFocus(d) { const i = Math.max(0, HERO_IDS.indexOf(pickFocus || HERO_IDS[0])); pickFocus = HERO_IDS[(i + d + HERO_IDS.length) % HERO_IDS.length]; sfx('hit'); }
function pickClickNew(x, y) {
  if (inRect(x, y, PK.back)) { pickBack(); sfx('hit'); return; }
  for (let i = 0; i < HERO_IDS.length; i++) if (inRect(x, y, PK.list(i))) { if (pickFocus === HERO_IDS[i]) togglePick(HERO_IDS[i]); else pickFocus = HERO_IDS[i]; sfx('hit'); return; }
  if (inRect(x, y, PK.arrL)) { pickCycleFocus(-1); return; } if (inRect(x, y, PK.arrR)) { pickCycleFocus(1); return; }
  if (inRect(x, y, PK.toggle)) { togglePick(pickFocus || HERO_IDS[0]); sfx('hit'); return; }
  for (let i = 0; i < 2; i++) if (inRect(x, y, PK.tab(i))) { pickTab = i; sfx('hit'); return; }
  for (let i = 0; i < 3; i++) if (inRect(x, y, PK.slot(i))) { if (duelPick[i]) { pickFocus = duelPick[i]; if (duelPick.length > 0) { togglePick(duelPick[i]); } } sfx('hit'); return; }
  if (pickFor === 'duel' && pickOnline) {   // 온라인 대전: 서버 · 방 만들기 · 방 참가 · 대전 시작
    if (!NET.ws && inRect(x, y, PK.on.url)) { netPromptUrl(); return; }
    if (!NET.ws && duelPick.length >= 1 && inRect(x, y, PK.on.create)) { netCreate(); return; }
    if (!NET.ws && duelPick.length >= 1 && inRect(x, y, PK.on.join)) { netPromptJoin(); return; }
    if (NET.role === 'host' && inRect(x, y, PK.go)) netStartHost();
    return;
  }
  if (inRect(x, y, PK.go) && duelPick.length >= pickNeed()) pickStart();
}
function pickKeyNew(code) {
  const m = /^Digit([1-6])$/.exec(code); if (m) { pickFocus = HERO_IDS[+m[1] - 1]; togglePick(pickFocus); return; }
  if (code === 'ArrowLeft' || code === 'ArrowUp') pickCycleFocus(-1); else if (code === 'ArrowRight' || code === 'ArrowDown') pickCycleFocus(1);
  else if (code === 'Space') togglePick(pickFocus || HERO_IDS[0]); else if (code === 'Tab' || code === 'KeyF') pickTab = 1 - pickTab;
  else if (code === 'Enter') { if (pickFor === 'duel' && pickOnline) netStartHost(); else if (duelPick.length >= pickNeed()) pickStart(); } else if (code === 'Escape') pickBack();
}
function drawPickOnline() {   // 아래 가운데: 서버 · 방 만들기 · 방 참가 / 방 코드·상태 / 상대 팀(적용 레벨)
  const L = PK.on, busy = !!NET.ws, none = duelPick.length < 1;
  const bx = (r, label, col, dis, sz) => { ctx.globalAlpha = dis ? 0.45 : 1; ctx.fillStyle = 'rgba(10,12,20,.92)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(r.x, r.y, r.w, r.h); text(fitStr(label, r.w - 12, sz), r.x + r.w / 2, r.y + r.h / 2 + 5, sz, col, 'center'); ctx.globalAlpha = 1; };
  bx(L.url, '서버: ' + NET.url.replace(/^wss?:\/\//, ''), '#9ad4ff', busy, 12); bx(L.create, '방 만들기', '#7dff9a', busy || none, 15); bx(L.join, '방 참가', '#4fb0ff', busy || none, 15);
  if (NET.code) { text('방 코드  ' + NET.code, 530, 662, 21, '#ffd34d', 'left'); if (NET.status) text(fitStr(NET.status, 240, 12), 706, 662, 12, '#ffe9a0', 'left', false); }
  else text(fitStr(NET.status || '방을 만들거나 친구의 방 코드로 참가하세요', 430, 13), 530, 660, 13, '#ffe9a0', 'left', false);
  const lvT = NET.paired ? netLvTable(NET.team, NET.peerTeam) : {};
  text('상대 팀', 530, 694, 12, '#ff9a8a', 'left');
  if (NET.paired && NET.peerTeam.length) NET.peerTeam.forEach((fid, i) => { const x = 612 + i * 118, ap = lvT[fid] || 1, og = (NET.peerLv || {})[fid] || 1; ctx.save(); ctx.beginPath(); ctx.arc(x, 688, 17, 0, TAU); ctx.clip(); ctx.translate(x, 691); ctx.scale(0.6, 0.6); drawPortraitIcon(HEROES[fid], 0, 0); ctx.restore(); ctx.strokeStyle = '#ff6a5a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, 688, 17, 0, TAU); ctx.stroke(); text('Lv ' + ap, x + 22, 693, 13, '#fff', 'left'); if (og !== ap) text('(원 ' + og + ')', x + 22, 706, 10, '#9aa3b8', 'left', false); });
  else text(NET.paired ? '상대가 영웅을 고르는 중...' : '상대가 방에 들어오면 상대 팀의 영웅과 레벨이 표시됩니다', 612, 693, 12, '#8a90a6', 'left', false);
  if (NET.role === 'guest' && NET.paired) text('방장이 대전을 시작하기를 기다리는 중...', 530, 640, 13, '#ffe9a0', 'left', false);
}
function drawPickNew() {
  if (!pickFocus) pickFocus = duelPick[0] || HERO_IDS[0];
  drawLoginScene(); ctx.fillStyle = 'rgba(6,4,14,.62)'; ctx.fillRect(0, 0, W, H);
  const duelP = pickFor === 'duel', id = pickFocus, h = HEROES[id], inT = duelPick.indexOf(id), rec = ACC ? heroRec(ACC, id) : { lv: 1, xp: 0 }, lv = rec.lv;
  backBtn(PK.back);
  const ttl = pickFor === 'raid' ? '레이드  ·  여포 봉선' : pickFor === 'duel' ? '비무장 모드 (' + (pickOnline ? '온라인' : '오프라인') + ')' : '로그라이크  ·  W' + waveSel + '부터';
  text(ttl, 90, 40, 24, '#ffd34d', 'left'); text('장수 선택  —  최대 3명 · ' + (pickFor === 'yeonui' ? '선택한 순서대로 시작 영웅과 태그(Z/X/C)' : '첫 번째 영웅을 직접 조작, 나머지는 AI 동료') + (pickFor === 'duel' && pickOnline ? '  ·  같은 영웅이 양 팀에 있으면 낮은 쪽 레벨로 맞춰 적용' : ''), 90, 62, 13, '#cfd3e6', 'left', false);
  // 왼쪽 영웅 목록
  HERO_IDS.forEach((hid, i) => {
    const r = PK.list(i), hh = HEROES[hid], foc = hid === id, k = duelPick.indexOf(hid), rc = ACC ? heroRec(ACC, hid) : { lv: 1 };
    ctx.fillStyle = foc ? 'rgba(62,46,16,.92)' : 'rgba(14,10,26,.82)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = foc ? '#ffd34d' : k >= 0 ? '#4fb0ff' : 'rgba(255,255,255,.22)'; ctx.lineWidth = foc ? 3 : 1.5; ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.save(); ctx.beginPath(); ctx.arc(r.x + 40, r.y + 36, 26, 0, TAU); ctx.clip(); ctx.translate(r.x + 40, r.y + 40); ctx.scale(0.9, 0.9); drawPortraitIcon(hh, 0, 0); ctx.restore(); ctx.strokeStyle = '#d4a73a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x + 40, r.y + 36, 26, 0, TAU); ctx.stroke();
    text(PC_NAME[hid], r.x + 76, r.y + 32, 18, foc ? '#ffe9a0' : '#fff', 'left'); text('Lv ' + rc.lv, r.x + 76, r.y + 54, 13, rc.lv >= MAX_LV ? '#ffd34d' : '#9dff9d', 'left', false);
    if (k >= 0) { ctx.fillStyle = k === 0 ? '#ffd34d' : '#4fb0ff'; circle(r.x + r.w - 20, r.y + 20, 14); text(String(k + 1), r.x + r.w - 20, r.y + 26, 17, '#111', 'center'); }
  });
  // 가운데 영웅
  { const fx0 = 432, fy0 = 500, sp = ctx.createRadialGradient(fx0, fy0 + 8, 10, fx0, fy0 + 8, 200); sp.addColorStop(0, 'rgba(255,214,140,.4)'); sp.addColorStop(1, 'rgba(255,214,140,0)'); ctx.fillStyle = sp; ctx.save(); ctx.translate(fx0, fy0 + 8); ctx.scale(1, 0.26); ctx.translate(-fx0, -(fy0 + 8)); ctx.fillRect(fx0 - 220, fy0 - 220, 440, 440); ctx.restore();
    ctx.save(); ctx.translate(fx0, fy0); const sc = h.mounted ? 1.8 : 2.2; ctx.scale(sc, sc); drawCardFigure(h, 0, 0); ctx.restore();
    for (const [b, d] of [[PK.arrL, -1], [PK.arrR, 1]]) { ctx.fillStyle = 'rgba(10,8,20,.55)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(b.x + b.w / 2 - d * 6, b.y + 26); ctx.lineTo(b.x + b.w / 2 + d * 6, b.y + b.h / 2); ctx.lineTo(b.x + b.w / 2 - d * 6, b.y + b.h - 26); ctx.stroke(); }
    if (inT >= 0) { ctx.fillStyle = inT === 0 ? '#ffd34d' : '#4fb0ff'; ctx.fillRect(fx0 - 56, 112, 112, 30); text((inT + 1) + '번  ' + pickSlotLabels()[inT], fx0, 133, 15, '#111', 'center'); }
    const t = PK.toggle; ctx.fillStyle = inT >= 0 ? 'rgba(60,18,18,.9)' : 'rgba(18,40,24,.9)'; ctx.fillRect(t.x, t.y, t.w, t.h); ctx.strokeStyle = inT >= 0 ? '#ff9a8a' : '#7dff9a'; ctx.lineWidth = 2.5; ctx.strokeRect(t.x, t.y, t.w, t.h); text(inT >= 0 ? '파티에서 제외' : duelPick.length >= 3 ? '파티가 가득 찼습니다 (3/3)' : '파티에 추가', t.x + t.w / 2, t.y + 30, 19, inT >= 0 ? '#ff9a8a' : duelPick.length >= 3 ? '#8a90a6' : '#7dff9a', 'center'); }
  // 오른쪽 정보 패널
  { const p = PK.panel; ctx.fillStyle = 'rgba(14,10,26,.9)'; ctx.fillRect(p.x, p.y, p.w, p.h); ctx.strokeStyle = 'rgba(255,211,77,.55)'; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, p.w, p.h);
    text(PC_NAME[id], p.x + 22, p.y + 44, 32, '#ffe9a0', 'left'); text('Lv ' + lv, p.x + p.w - 22, p.y + 44, 30, lv >= MAX_LV ? '#ffd34d' : '#9dff9d', 'right'); text(GROWTH[id].theme, p.x + 22, p.y + 68, 14, '#ffb27a', 'left', false);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(p.x + 22, p.y + 80, p.w - 44, 12); ctx.fillStyle = '#4fd36a'; ctx.fillRect(p.x + 23, p.y + 81, (p.w - 46) * (lv >= MAX_LV ? 1 : rec.xp / xpNeed(lv)), 10); text(lv >= MAX_LV ? 'MAX' : 'EXP ' + rec.xp + ' / ' + xpNeed(lv), p.x + p.w - 22, p.y + 108, 11, '#9aa3b8', 'right', false);
    ['스테이터스', '스킬'].forEach((nm, i) => { const r = PK.tab(i), on = pickTab === i; ctx.fillStyle = on ? 'rgba(212,167,58,.9)' : 'rgba(30,24,44,.9)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = on ? '#ffd34d' : 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.5; ctx.strokeRect(r.x, r.y, r.w, r.h); text(nm, r.x + r.w / 2, r.y + 26, 17, on ? '#2a1c06' : '#cfd3e6', 'center'); });
    if (pickTab === 0) {
      const lf = ACC ? flatOf(id, lv) : zeroFlat(), hb = duelP ? DUEL_HP : HERO_STATS.hp, ha = duelP ? lf.hp * DUEL_HP / HERO_STATS.hp : lf.hp, atk = HERO_STATS.atk + lf.atk, df = lf.def;
      let refHp = 1, refAtk = 1, refDef = 1; for (const q of HERO_IDS) { const f = ACC ? flatOf(q, heroLv(q)) : zeroFlat(); refHp = Math.max(refHp, hb + (duelP ? f.hp * DUEL_HP / HERO_STATS.hp : f.hp)); refAtk = Math.max(refAtk, HERO_STATS.atk + f.atk); refDef = Math.max(refDef, f.def, 1); }
      const bars = [['체력', hb + ha, refHp, fmtI(hb + ha) + '  (기본 ' + fmtI(hb) + ' +' + fmtI(ha) + ')', '#ff5a6a'], ['공격력', atk, refAtk, (+atk.toFixed(1)) + '  (기본 ' + HERO_STATS.atk + ' +' + (+lf.atk.toFixed(1)) + ')', '#ff9a3a'], ['방어력', df, refDef, (+df.toFixed(1)) + '  ·  받는 피해 -' + (+(100 - 100 / (1 + df / 100)).toFixed(1)) + '%', '#5aa8ff']];
      bars.forEach((b, i) => { const y = p.y + 176 + i * 68; ctx.fillStyle = b[4]; circle(p.x + 44, y + 12, 18); text(b[0], p.x + 76, y + 6, 15, '#fff', 'left'); text(b[3], p.x + p.w - 22, y + 6, 13, '#dfe3f5', 'right', false); const bw = p.w - 98, n = 10, on = Math.max(b[1] > 0 ? 1 : 0, Math.round(clamp(b[1] / b[2], 0, 1) * n)); for (let k = 0; k < n; k++) { ctx.fillStyle = k < on ? b[4] : 'rgba(255,255,255,.12)'; ctx.fillRect(p.x + 76 + k * (bw / n), y + 16, bw / n - 4, 14); } });
      text('이동속도 ' + HERO_STATS.speed + '  ·  회피율 ' + PC_EVA + '%  ·  적중 ' + PC_ACC + '  ·  치명타 ' + Math.round(CRIT_BASE * 100) + '% (x' + CRIT_BASE_DMG + ')', p.x + 22, p.y + 400, 12, '#8a90a6', 'left', false);
      const nxt = GROWTH[id].tiers.find(t => t.lv > lv); text(fitStr(nxt ? '다음 성장  Lv ' + nxt.lv + ' [' + nxt.name + '] ' + fxText(id, nxt.fx) : '고유 성장 단계를 모두 해금했습니다', p.w - 44, 12), p.x + 22, p.y + 424, 12, nxt ? '#9dff9d' : '#ffd34d', 'left', false);
      wrapLeft(PICK_NOTE(id), p.x + 22, p.y + 448, p.w - 44, 11.5, '#aab3c8', 2, 15);
    } else {
      heroSkillRows(id).forEach((row, j) => { const y = p.y + 196 + j * 68; ctx.fillStyle = j === 3 ? 'rgba(255,211,77,.1)' : 'rgba(255,255,255,.04)'; ctx.fillRect(p.x + 14, y - 22, p.w - 28, 64); text(row.n, p.x + 26, y, 14, j === 3 ? '#ffd34d' : '#ffe9a0', 'left'); const ls = wrapStr(row.c1, p.w - 64, '500 12px ' + FONT).slice(0, 2); ls.forEach((l, q) => text(l, p.x + 26, y + 18 + q * 15, 12, '#fff', 'left', false)); text(fitStr(row.c2, p.w - 64, 11), p.x + 26, y + 18 + ls.length * 15 + 3, 11, '#ffb27a', 'left', false); });
    }
  }
  // 아래: 파티 슬롯 + 시작
  ctx.fillStyle = 'rgba(8,6,18,.82)'; ctx.fillRect(0, 590, W, H - 590); ctx.fillStyle = 'rgba(255,211,77,.5)'; ctx.fillRect(0, 590, W, 2);
  for (let i = 0; i < 3; i++) {
    const r = PK.slot(i), hid = duelPick[i], lab = pickSlotLabels()[i]; ctx.fillStyle = hid ? 'rgba(30,24,44,.92)' : 'rgba(255,255,255,.04)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = hid ? (i === 0 ? '#ffd34d' : '#4fb0ff') : 'rgba(255,255,255,.25)'; ctx.lineWidth = hid ? 2.5 : 1.5; if (!hid) ctx.setLineDash([6, 5]); ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]);
    text(String(i + 1) + '  ' + lab, r.x + 10, r.y + 20, 12, i === 0 ? '#ffd34d' : '#9ad4ff', 'left');
    if (hid) { ctx.save(); ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + 54, 22, 0, TAU); ctx.clip(); ctx.translate(r.x + r.w / 2, r.y + 58); ctx.scale(0.75, 0.75); drawPortraitIcon(HEROES[hid], 0, 0); ctx.restore(); text(PC_NAME[hid] + '  Lv ' + (ACC ? heroRec(ACC, hid).lv : 1), r.x + r.w / 2, r.y + 92, 13, '#fff', 'center', false); }
    else text('+', r.x + r.w / 2, r.y + 66, 38, 'rgba(255,255,255,.3)', 'center');
  }
  if (duelP && pickOnline) drawPickOnline();
  else if (duelP) { foeSync(); text('상대 (AI)', 560, 624, 12, '#ff9a8a', 'left'); duelFoes.forEach((fid, i) => { const x = 590 + i * 70; ctx.save(); ctx.beginPath(); ctx.arc(x, 664, 22, 0, TAU); ctx.clip(); ctx.translate(x, 668); ctx.scale(0.75, 0.75); drawPortraitIcon(HEROES[fid], 0, 0); ctx.restore(); ctx.strokeStyle = '#ff6a5a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, 664, 22, 0, TAU); ctx.stroke(); text('Lv ' + (ACC ? heroRec(ACC, fid).lv : 1), x, 702, 11, '#cfd3e6', 'center', false); }); if (!duelFoes.length) text('영웅을 고르면 상대 팀이 표시됩니다', 560, 664, 13, '#8a90a6', 'left', false); }
  else text(pickFor === 'raid' ? '보스 : 여포 봉선 (8단계)' : '시작 웨이브 W' + waveSel, 560, 650, 15, '#ffb27a', 'left', false);
  { const g = PK.go, on = duelP && pickOnline, ok = on ? (NET.role === 'host' && NET.paired && netReady()) : duelPick.length >= pickNeed(); ctx.globalAlpha = ok ? 1 : 0.4; ctx.fillStyle = 'rgba(80,24,18,.92)'; ctx.fillRect(g.x, g.y, g.w, g.h); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3.5; ctx.strokeRect(g.x, g.y, g.w, g.h);
    text(on ? (NET.role === 'guest' && NET.paired ? '방장 대기 중' : '대전 시작') : duelP ? '전투 시작' : pickFor === 'raid' ? '레이드 시작' : '출전', g.x + g.w / 2, g.y + 40, 30, '#ffe9a0', 'center'); text(duelPick.length + ' / 3 선택  ·  Enter', g.x + g.w / 2, g.y + 68, 13, '#ffd9a0', 'center', false); ctx.globalAlpha = 1; }
}
function drawPick() {
  if (newPickUI()) { drawPickNew(); return; }
  ctx.drawImage(bg, WORLD.w / 2 - W / 2, WORLD.h / 2 - H / 2, W, H, 0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(0, 0, W, H);
  const duelP = pickFor === 'duel';
  text((duelP ? (pickOnline ? '비무장 모드 (온라인)' : '비무장 모드 (오프라인)') : (pickFor === 'raid' ? '레이드 모드 (오프라인)' : '로그라이크 모드')) + '  ·  영웅 선택', W / 2, 56, 40, '#ffd34d', 'center');
  text(duelP ? (pickOnline ? '1~3명을 순서대로 고르세요 (상대 팀 인원은 상대가 정합니다)  —  첫 번째 영웅을 직접 조작합니다 (전투 중 초상화 · Q 로 변경)' : '1~3명을 순서대로 고르세요 (인원수만큼 적도 배치)  —  첫 번째 영웅을 직접 조작합니다 (전투 중 아군 초상화로 변경 가능)') : (pickFor === 'raid' ? '1~3명을 고르세요  —  첫 번째 영웅을 직접 조작하고 나머지는 AI 동료로 동시에 보스와 싸웁니다' : '최대 3명까지 고르세요 (1명 이상)  —  첫 번째 영웅으로 시작하고, 선택한 순서대로 Z / X / C 로 태그합니다'), W / 2, 90, 16, '#cfd3e6', 'center', false);
  text(duelP ? (pickOnline ? (NET.status || '방을 만들거나 친구의 방 코드로 참가하세요') : '적군은 같은 인원수의 PC (구성 랜덤)  ·  규칙 동일 · 레벨 보정은 같은 영웅끼리 같은 레벨(내 계정 기준)') : (pickFor === 'raid' ? '첫 번째 영웅을 직접 조작, 나머지 영웅은 AI 동료로 함께 싸웁니다 (태그 없음)  ·  보스 : 여포 봉선 (8단계)  ·  성장 레벨 적용  ·  보스 체력에 따라 패턴이 늘어납니다' : '웨이브 1 ~ 50  ·  5층마다 보스 (10 관우 · 25 조운 · 50 여포)  ·  다음 화면에서 웨이브 선택'), W / 2, 114, 14, duelP ? '#ff9a8a' : '#ffb27a', 'center', false);
  const text0 = text;
  HERO_IDS.forEach((id, i) => {
    const r = pickCardRect(i), h = HEROES[id], k = duelPick.indexOf(id), on = k >= 0, lv = ACC ? heroLv(id) : 1, g = GROWTH[id], mt = metaFull(id);
    const text = (s, x, y, sz, col, al = 'left', ...rest) => text0(al === 'left' && typeof s === 'string' ? fitStr(s, Math.max(40, r.x + r.w - 10 - x), sz) : s, x, y, sz, col, al, ...rest);   // 카드가 좁아져도 글자가 넘치지 않게 줄임
    ctx.save(); ctx.beginPath(); ctx.rect(r.x - 8, r.y - 8, r.w + 16, r.h + 8 + (r.h < PICK_CARD.h ? 3 : 8)); ctx.clip();   // 접힌 카드는 아래 정보를 잘라서 가림
    ctx.fillStyle = on ? 'rgba(40,34,18,.95)' : 'rgba(10,12,20,.88)'; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = on ? '#ffd34d' : 'rgba(255,255,255,.3)'; ctx.lineWidth = on ? 4 : 2; ctx.strokeRect(r.x, r.y, r.w, r.h);
    if (on) { ctx.strokeStyle = `rgba(255,211,77,${0.25 + 0.2 * Math.sin(T * 5)})`; ctx.lineWidth = 8; ctx.strokeRect(r.x - 5, r.y - 5, r.w + 10, r.h + 10); }
    // 머리: 초상 / 이름 / 레벨
    ctx.save(); ctx.beginPath(); ctx.arc(r.x + 50, r.y + 70, 30, 0, TAU); ctx.clip(); ctx.translate(r.x + 50, r.y + 75); ctx.scale(1.0, 1.0); drawPortraitIcon(h, 0, 0); ctx.restore(); ctx.strokeStyle = '#d4a73a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x + 50, r.y + 70, 30, 0, TAU); ctx.stroke();
    text(PC_NAME[id], r.x + 92, r.y + 64, 22, on ? '#ffe9a0' : '#dfe3f5', 'left'); text(g.theme, r.x + 92, r.y + 84, 12, '#ffb27a', 'left', false); text((i + 1) + ' 키', r.x + 92, r.y + 102, 11, 'rgba(255,255,255,.5)', 'left', false);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(r.x + r.w - 80, r.y + 10, 70, 24); ctx.strokeStyle = lv >= MAX_LV ? '#ffd34d' : 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.5; ctx.strokeRect(r.x + r.w - 80, r.y + 10, 70, 24); text('Lv ' + lv, r.x + r.w - 45, r.y + 28, 15, lv >= MAX_LV ? '#ffd34d' : '#9dff9d', 'center');
    // 능력치: 기본 능력치 + 레벨 성장 (+N). 성장하는 것은 체력·공격력·방어력뿐 (이동속도·공격속도는 성장 없음)
    const lf = ACC ? flatOf(id, lv) : zeroFlat(), hb = duelP ? DUEL_HP : HERO_STATS.hp, ha = duelP ? lf.hp * DUEL_HP / HERO_STATS.hp : lf.hp, f1 = n2 => +n2.toFixed(1);
    text(duelP ? '능력치 · 비무장 수치  (기본 + 레벨 ' + lv + ' 성장)' : '능력치  (기본 + 레벨 ' + lv + ' 성장 +N)', r.x + 14, r.y + 128, 12, duelP ? '#9ad4ff' : '#ffd34d', 'left');
    text('체력 ' + fmtI(hb + ha) + '   (기본 ' + fmtI(hb) + ' +' + fmtI(ha) + ')', r.x + 14, r.y + 145, 12, '#fff', 'left', false);
    text('공격력 ' + f1(HERO_STATS.atk + lf.atk) + '   (기본 ' + HERO_STATS.atk + ' +' + f1(lf.atk) + ')', r.x + 14, r.y + 161, 12, '#fff', 'left', false);
    text('방어력 ' + f1(lf.def) + '   (기본 0 +' + f1(lf.def) + ')   받는 피해 -' + f1(100 - 100 / (1 + lf.def / 100)) + '%', r.x + 14, r.y + 177, 12, '#fff', 'left', false);
    text('치명타 확률 ' + Math.round(CRIT_BASE * 100) + '% · 치명타 피해 x' + CRIT_BASE_DMG + ' (성장 없음)', r.x + 14, r.y + 192, 11, '#8a90a6', 'left', false);
    text('이동속도 ' + HERO_STATS.speed + ' · 회피율 ' + PC_EVA + '% · 적중 ' + PC_ACC + ' (성장 없음)', r.x + 14, r.y + 206, 11, '#8a90a6', 'left', false);
    const nxt = g.tiers.find(t => t.lv > lv);
    text(fitStr(nxt ? '다음 Lv ' + nxt.lv + ' [' + nxt.name + '] ' + fxText(id, nxt.fx) : '고유 성장 단계를 모두 해금했습니다', r.w - 28, 10.5), r.x + 14, r.y + 224, 10.5, nxt ? '#9dff9d' : '#ffd34d', 'left', false);
    text(duelP ? '▼ 스킬 · 비무장 수치' : '▼ 스킬 · 로그라이크 수치', r.x + r.w - 14, r.y + 236, 10, duelP ? '#9ad4ff' : '#ffb27a', 'right', false);
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r.x + 12, r.y + 238); ctx.lineTo(r.x + r.w - 12, r.y + 238); ctx.stroke();
    // 스킬 성능
    heroSkillRows(id).forEach((row, j) => { const yy = r.y + 254 + j * 44; text(row.n, r.x + 14, yy, 13, j === 3 ? '#ffd34d' : '#ffe9a0', 'left'); text(row.c1, r.x + 14, yy + 15, 11.5, '#fff', 'left', false); text(row.c2, r.x + 14, yy + 29, 11, '#ffb27a', 'left', false); });
    wrapLeft(PICK_NOTE(id), r.x + 14, r.y + 424, r.w - 28, 9.5, '#9aa3b8', 3, 11);
    if (on) { ctx.fillStyle = k === 0 ? '#ffd34d' : '#4fb0ff'; circle(r.x + 28, r.y + 28, 18); text(String(k + 1), r.x + 28, r.y + 35, 20, '#111', 'center'); text(k === 0 ? ((duelP || pickFor === 'raid') ? '조작' : '시작') : ((duelP || pickFor === 'raid') ? '아군' : '태그 ' + ['Z', 'X', 'C'][k - 1]), r.x + 52, r.y + 32, 14, k === 0 ? '#ffd34d' : '#9ad4ff', 'left'); }
    ctx.restore();
  });
  { const b = PICK_FOLD_BTN; ctx.fillStyle = 'rgba(10,12,20,.9)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = '#cfd3e6'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h); text(pickFold ? '스킬 정보 펴기 ▼ (F)' : '스킬 정보 접기 ▲ (F)', b.x + b.w / 2, b.y + 23, 14, '#cfd3e6', 'center'); }
  const btn = (r, label, col, dis) => { ctx.globalAlpha = dis ? 0.4 : 1; ctx.fillStyle = 'rgba(10,12,20,.9)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.strokeRect(r.x, r.y, r.w, r.h); text(label, r.x + r.w / 2, r.y + r.h / 2 + 8, 21, col, 'center'); ctx.globalAlpha = 1; };
  if (!(duelP && pickOnline)) btn(pickGoRect(), duelP ? '전투 시작  (Enter)' : pickFor === 'raid' ? '레이드 시작  (Enter)' : '다음 : 웨이브 선택  (Enter)', '#ffd34d', duelPick.length < pickNeed()); btn(PICK_BTN.back, '뒤로', '#cfd3e6', false);
  if (!(duelP && pickOnline)) text('선택 ' + duelPick.length + ' / 3', W / 2 + 160, pickGoRect().y + 32, 22, duelPick.length >= pickNeed() ? '#7dff9a' : '#ffe9a0', 'left');
  if (duelP) {
    if (pickOnline) drawOnlinePanel();
    else { foeSync(); drawFoeRow({ x: 24, y: pickGoRect().y + 60, w: 1232, h: pickFold ? 112 : 60 }, '상대 팀 (AI)', '같은 영웅은 내 레벨', duelFoes, id => ACC ? heroRec(ACC, id).lv : 1, null, '영웅을 고르면 상대 팀이 표시됩니다'); }
  } else text('카드를 누르면 선택 / 해제됩니다 · 선택한 순서가 곧 시작 영웅과 태그 순서입니다', W / 2, pickGoRect().y + 76, 14, '#cfd3e6', 'center', false);
}
function restartMode() { if (NET.on) { netBackToRoom(); return; } if (mode === 'duel') { duelFoes = []; startDuel(duelLast); } else if (RAID) startRaid(RAID_HEROES); else startGame(null, lastStartWave); }

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
const DUEL_ROW = { x: 10, y: 10, w: 200, h: 38, step: 42 };   // HUD 왼쪽 목록 (0 = 현재 조작 영웅, 1~2 = 아군 AI)
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
  const Hf = HEROES[f.hero];
  f.guardT = Math.max(0, f.guardT - dt); f.ultGuardT = Math.max(0, f.ultGuardT - dt); f.aspdT = Math.max(0, f.aspdT - dt); f.postUltT = Math.max(0, f.postUltT - dt); f.comboBuffT = Math.max(0, f.comboBuffT - dt); f.blessT = Math.max(0, f.blessT - dt); f.undyT = Math.max(0, (f.undyT || 0) - dt); f.floorT = Math.max(0, (f.floorT || 0) - dt);
  if (f.hitsT > 0) { f.hitsT -= dt; if (f.hitsT <= 0) { f.hits = 0; f.hitTier = 0; } }   // 3초간 적중이 없으면 HIT 초기화
  if (f.runT > 0) f.runT = (f.moving || (f.act && f.act.def.name === 'rush')) ? Hf.runDur : Math.max(0, f.runT - dt);   // 질주: 이동 중이거나 돌격 중이면 지속시간 갱신
  f.moving = false;
  f.lungeT = Math.max(0, (f.lungeT || 0) - dt); f.hitT = Math.max(0, f.hitT - dt); f.flash = Math.max(0, f.flash - dt); f.invT = Math.max(0, f.invT - dt); f.rage = Math.min(100, f.rage + dt / ULT_CD * 100 * (1 + f.meta.rage)); f.cd.s1 = Math.max(0, f.cd.s1 - dt); f.cd.s2 = Math.max(0, f.cd.s2 - dt); for (const k in f.s2Store) f.s2Store[k] = Math.max(0, f.s2Store[k] - dt); f.dashCd = Math.max(0, f.dashCd - dt); if (f.slowT > 0) f.slowT -= dt; drTick(f, dt); f.atkCd -= dt; f.comboT -= dt;
  f.x += f.kx * dt; f.y += f.ky * dt; const kf = Math.exp(-9 * dt); f.kx *= kf; f.ky *= kf;
  if (f.freeze > 0) { f.freeze -= dt; arenaClamp(f); return; }
  if ((!f.human || netAuto(f)) && f.state !== 'stun' && f.dashCd <= 0 && !(f.act && (f.act.def.invul || f.act.def.name === 'ult' || f.act.def.name === 'dodge'))) {   // 자동 회피 (AUTO 플레이어와 동일 규칙)
    const dg = RAID ? raidDodgeDir(f) : dodgeDir(f);
    if (dg != null) { f.dashCd = CD.dash; f.invT = 0.26; f.act = null; f.armor = false; beginAct(f, { name: 'dodge', dur: 0.26, ev: [{ t0: 0, t1: 0.22, fx: 'move', v: 950, ang: dg }] }, null); runAct(f, dt); arenaClamp(f); return; }
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
function drawFighter(f) {
  const H_ = HEROES[f.hero], ps = fighterPose(f), col = f.team === 'ally' ? '79,176,255' : '255,90,74', bow = f.act && f.act.def.name === 's2' && f.hero === 'lubu2';
  ctx.fillStyle = `rgba(${col},.22)`; ctx.beginPath(); ctx.ellipse(f.x, f.y + 6, f.r * 1.9, f.r * 0.9, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = `rgba(${col},.9)`; ctx.lineWidth = 2.5; ctx.stroke();   // 팀 표식 (아군 파랑 / 적 빨강)
  if (NET.on && f === netCur()) { ctx.strokeStyle = '#3cff3c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(f.x, f.y + 6, f.r * 2.2, f.r * 1.05, 0, 0, TAU); ctx.stroke(); }   // 온라인: 내가 조종 중인 영웅 표시
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
  const st = { ...H_.style, flash: f.flash > 0, alpha: 1, anim: pose, bob: pose.bob, weapon: { kind: bow ? 'bow' : H_.style.weapon, ang: smoothAng(f, hurt ? f.face + 2.0 : ps.ang + (f.act ? 0 : pose.wsw)), len: ps.len, dx: Math.cos(f.face) * ps.push, dy: Math.sin(f.face) * ps.push } };
  if (H_.mounted) { drawHorse({ x: f.x, y: f.y, r: MOUNT_R, face: f.face, flash: f.flash > 0 ? 1 : 0, state: f.dashing || (H_.runBonus && horseGalloping(f.runT, f.moving && !f.act)) || f.lungeT > 0 ? 'dash' : 'chase', walk: f.walk, spawnT: 0, alpha: 1, d: H_.horse }, 0); drawBody(f.x, f.y - MOUNT_R * 0.6, RIDER_R, f.face, { ...st, noShadow: true }); }
  else drawBody(f.x, f.y, f.r, f.face, st);
  drawBuffAura(f.x, f.y, bR, bl, 1);
  if (f.invT > 0 && !(f.act && f.act.def.invul)) { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y - 24, 40 + Math.sin(T * 20) * 3, 0, TAU); ctx.stroke(); }
  const top = f.y - f.r * 3.5 - (H_.mounted ? 22 : 0);
  drawHpBar(f.x, top, 52, f.hp, f.maxhp, f.team === 'ally' ? '#4fb0ff' : '#ff4a4a');
  if (f.floorT > 0) { ctx.strokeStyle = 'rgba(255,90,60,' + (0.5 + 0.4 * Math.sin(T * 14)) + ')'; ctx.lineWidth = 2.5; ctx.strokeRect(f.x - 28, top - 3, 56, 10); }   // 불사 중: 생명력 막대가 붉게 깜빡임
  text(DUEL_TAG[f.hero], f.x, top - 4, 12, f.team === 'ally' ? '#9ad4ff' : '#ff9a8a', 'center');
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
  text('미터기 ' + (meterOn ? '▾' : '▸') + ' (M)', m.x + 6, m.y + 15, 11, '#ffe9a0', 'left', true, false);
  if (!meterOn) return;
  cols.forEach((c, i) => text(c, x0 + cw * i + cw / 2, m.y + 15, 10, '#cfd3e6', 'center', false, false));
  const zero = () => ({ dealt: 0, taken: 0, healDone: 0, healTaken: 0 });
  const rows = [...duel.order.map(h => ({ team: 'ally', hero: h })), ...duel.foes.map(f => ({ team: 'foe', hero: pcId(f.hero) }))].map(r => ({ ...r, st: duel.stats[r.team + ':' + r.hero] || zero() }));
  const maxD = Math.max(1, ...rows.map(r => r.st.dealt)), tot = { ally: zero(), foe: zero() };
  let y = m.y + m.hh;
  for (const team of ['ally', 'foe']) {
    const col = team === 'ally' ? '79,176,255' : '255,90,74', list = rows.filter(r => r.team === team).sort((a, b) => b.st.dealt - a.st.dealt);
    for (const r of list) {
      ctx.fillStyle = 'rgba(10,12,20,.5)'; ctx.fillRect(m.x, y, m.w, m.rh);
      ctx.fillStyle = 'rgba(' + col + ',.35)'; ctx.fillRect(m.x, y, m.w * r.st.dealt / maxD, m.rh);   // 주는 피해 비율 막대
      text(PC_TAG[r.hero] + (team === 'ally' && r.hero === curHero ? '(나)' : ''), m.x + 6, y + 14, 11, team === 'ally' ? '#9ad4ff' : '#ff9a8a', 'left', true, false);
      keys.forEach((k, i) => { text(fmtN(r.st[k]), x0 + cw * i + cw / 2, y + 14, 11, k === 'taken' ? '#ffb4a8' : k.startsWith('heal') ? '#9dff9d' : '#fff', 'center', false, false); tot[team][k] += r.st[k]; });
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
const BCHIP_DESC = { '강': '체력이 줄어 보스가 강해진 단계입니다. 단계가 오를수록 아래 효과가 커집니다.', '피': '보스 공격의 피해가 증가했습니다.', '속': '보스 스킬의 시전(선딜·후딜)이 빨라졌습니다.', '쿨': '스킬과 스킬 사이의 대기 시간이 줄었습니다.', '연': '스킬이 끝난 뒤 곧바로 다음 스킬을 이어서 쓸 확률입니다.', '저': '고유 능력 — 상태 이상 저항: 경직·스턴·둔화를 겪을수록 지속시간이 줄어듭니다 (5회 이후 20%, 60초 뒤 초기화).', '갑': '슈퍼아머: 일반 공격에는 경직되지 않습니다 (스턴은 가능).', '난': '웨이브 난이도 단계입니다 (몬스터 체력·피해 배율).', '페': '보스 페이즈입니다.' };
// 아이콘을 누르면 상세 정보 팝업 (모든 모드 공통): 그리는 동안 탭 영역(ICON_HITS)을 모으고, 눌린 아이콘의 tip() 을 팝업으로 보여줌
let ICON_HITS = [], iconTip = null;
function wrapStr(str, w, font) { ctx.font = font; const out = []; let cur = ''; for (const ch of str) { if (ctx.measureText(cur + ch).width > w && cur) { out.push(cur); cur = ch; } else cur += ch; } if (cur) out.push(cur); return out; }
function drawIconTip() {
  if (!iconTip) return; if (T - iconTip.t0 > 6) { iconTip = null; return; }
  const tp = iconTip.tip(), w = 270, lines = []; for (const l of tp.lines) lines.push(...wrapStr(l, w - 28, '500 12.5px ' + FONT));
  const h = 40 + lines.length * 18 + 8; let x = clamp(iconTip.x, 8, W - w - 8), y = iconTip.y + 34; if (y + h > H - 8) y = iconTip.y - h - 6;
  ctx.save(); ctx.fillStyle = 'rgba(12,10,24,.96)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgb(' + (tp.col || '255,211,77') + ')'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h); ctx.fillStyle = 'rgb(' + (tp.col || '255,211,77') + ')'; ctx.fillRect(x, y, 5, h);
  ctx.restore(); text(tp.title, x + 16, y + 25, 15, '#ffe9a0', 'left'); lines.forEach((l, i) => text(l, x + 16, y + 46 + i * 18, 12.5, '#e6e9f5', 'left', false));
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

    const hero = isP ? HERO.id : u ? u.hero : hero0;   // 지금 모습(폼)으로 표시: 여포는 상마/하마
    const dead = isP ? P.dead : u.dead, hp = isP ? P.hp : u.hp, mx = isP ? P.maxhp : u.maxhp, rg = isP ? P.rage : u.rage, col = mine ? '#4fb0ff' : '#ff6a5a';
    ctx.fillStyle = 'rgba(10,12,20,.5)'; ctx.fillRect(x, y, 200, 38); ctx.strokeStyle = isP ? '#ffd34d' : col; ctx.lineWidth = isP ? 2.5 : 1.5; ctx.strokeRect(x, y, 200, 38);
    ctx.save(); ctx.beginPath(); ctx.arc(x + 20, y + 19, 16, 0, TAU); ctx.clip(); ctx.translate(x + 20, y + 22); ctx.scale(0.52, 0.52); drawPortraitIcon(HEROES[hero], 0, 0); ctx.restore();
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + 20, y + 19, 16, 0, TAU); ctx.stroke();
    text(DUEL_NAME[hero] + (isP ? '  (나)' : ''), x + 42, y + 14, 11, '#fff');
    const fr = clamp(hp / mx, 0, 1); ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x + 42, y + 18, 150, 9); ctx.fillStyle = fr > 0.5 ? '#4fd36a' : fr > 0.25 ? '#f0b030' : '#ff3a3a'; ctx.fillRect(x + 43, y + 19, 148 * fr, 7);
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x + 42, y + 29, 150, 5); ctx.fillStyle = rg >= 100 ? '#ffd34d' : '#e0902a'; ctx.fillRect(x + 43, y + 30, 148 * clamp(rg / 100, 0, 1), 3);
    if (!dead) drawRowBuffs(isP ? P : u, isP ? HERO : HEROES[u.hero], mine, x, y);
    if (dead) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x, y, 200, 38); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + 6, y + 4); ctx.lineTo(x + 36, y + 34); ctx.moveTo(x + 36, y + 4); ctx.lineTo(x + 6, y + 34); ctx.stroke(); }
};
function drawRaidHUD() {   // 레이드: 비무장과 같은 영웅 목록 (0 = 조작 영웅, 초상화를 누르거나 Q 로 변경)
  RD.order.forEach((h, i) => { const isP = h === curHero; hudRow(isP ? P : allies.find(a => pcId(a.hero) === h), h, DUEL_ROW.x, DUEL_ROW.y + i * DUEL_ROW.step, true, isP); });
  if (allies.length) text('초상화 클릭 · Q : 조작 영웅 변경', 10, 10 + RD.order.length * 42 + 8, 11, '#cfd3e6', 'left', false);
}
function drawDuelHUD() {
  const row = hudRow;
  if (allies.length) text('초상화 클릭 · Q : 조작 영웅 변경', 10, 10 + duel.order.length * 42 + 8, 11, '#cfd3e6', 'left', false);
  drawDamageMeter();
  duel.order.forEach((h, i) => { const isP = h === curHero; row(isP ? P : allies.find(a => pcId(a.hero) === h), h, 10, 10 + i * 42, true, isP); });
  duel.foes.forEach((u, i) => row(u, u.hero, W - 210, 10 + i * 42, false, false));
  // 남은 시간 (모래시계 + mm:ss)
  const tl = Math.max(0, duel.t), mm = Math.floor(tl / 60), ss = Math.floor(tl % 60), urgent = tl < 30;
  ctx.fillStyle = 'rgba(10,12,20,.6)'; ctx.fillRect(W / 2 - 74, 8, 148, 36); ctx.strokeStyle = urgent ? '#ff6a5a' : '#d4a73a'; ctx.lineWidth = 2; ctx.strokeRect(W / 2 - 74, 8, 148, 36);
  ctx.fillStyle = urgent ? '#ff8a7a' : '#ffd34d'; ctx.beginPath(); ctx.moveTo(W / 2 - 58, 15); ctx.lineTo(W / 2 - 40, 15); ctx.lineTo(W / 2 - 49, 26); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(W / 2 - 49, 26); ctx.lineTo(W / 2 - 58, 37); ctx.lineTo(W / 2 - 40, 37); ctx.closePath(); ctx.fill();
  text(String(mm).padStart(2, '0') + ' : ' + String(ss).padStart(2, '0'), W / 2 + 14, 35, 22, urgent ? '#ff8a7a' : '#fff', 'center');
  text('비무장 ' + duel.order.length + ' VS ' + duel.foes.length, W / 2, 60, 12, '#cfd3e6', 'center', false);
  if (duel.t0 < 2.4 && state === 'play') { const al = clamp(Math.min(duel.t0, 2.4 - duel.t0) * 3, 0, 1); ctx.globalAlpha = al; text('FIGHT!', W / 2, 300, 72, '#ffd34d', 'center'); ctx.globalAlpha = 1; }
}

// ---------- 메인 업데이트 ----------
function update(rdt) {
  T += rdt; if (TUT) tutUpdate(rdt);
  if (tagFx) { tagFx.t += rdt; if (tagFx.t >= tagFx.dur) tagFx = null; }
  let dt = rdt;
  if (slowT > 0) { slowT -= rdt; dt *= 0.3; }
  shake = Math.max(0, shake - rdt * 40); flashT = Math.max(0, flashT - rdt);
  if ((state === 'win' || state === 'lose') && !RS.done) settleRun(state);   // 한 판 경험치 정산
  if (state === 'upgrade') { updateUpgrade(rdt); return; }
  if (state === 'title' || state === 'pick' || state === 'account' || state === 'info' || state === 'waves' || state === 'net' || state === 'duelMenu' || state === 'raidMenu' || state === 'raidBoss') return;
  if (paused) { if (state === 'play' && mode === 'yeonui') { updateCamera(rdt); return; } paused = false; }   // 일시정지: 전투 계산 중단
  if (NET.on && NET.role === 'guest') { netGuestStep(rdt); updateCamera(rdt); return; }   // 온라인 게스트: 전투 계산 없이 받은 상태만 그림
  if (hitstop > 0) { hitstop -= rdt; dt = 0; }
  if (NET.on) netHostPre();
  if (dt > 0) {
    if (state === 'play') { clock += dt; updatePlayer(dt); if (mode === 'duel') updateDuel(dt); else { updateWaves(dt); if (RAID) updateRaidAllies(dt); } updateItems(dt); }
    else { winT += dt; }
    updateEnemies(dt); updateProjectiles(dt); updateFx(dt);
  }
  if (NET.on) netHostPost(rdt);
  updateCamera(rdt);
}

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
  else if (!b.d.foot) { st = bossStage(b); const tb = bossTab(b); n = b.d.raid ? 8 : 6; dmg = tb.dmg[st]; fast = tb.fast[st]; cdm = tb.cd[st]; chain = tb.chain[st]; }
  else { n = 2; st = b.phase2 ? 1 : 0; fast = b.phase2 || b.hp < b.maxhp * 0.5 ? 0.8 : 1; chain = b.phase2 ? 0.45 : 0.30; }
  if (n) o.push({ t: (n === 2 ? (b.phase2 ? '2페이즈' : '1페이즈') : '강화 ' + (st + 1) + '/' + n + '단계'), c: '255,233,160' });
  if (dmg > 1.001) o.push({ t: '피해 +' + Math.round((dmg - 1) * 100) + '%', c: '255,110,100' });
  if (fast < 0.999) o.push({ t: '시전속도 +' + Math.round((1 / fast - 1) * 100) + '%', c: '255,170,80' });
  if (cdm < 0.999) o.push({ t: '스킬 대기 -' + Math.round((1 - cdm) * 100) + '%', c: '255,200,90' });
  if (chain > 0) o.push({ t: '연속 패턴 ' + Math.round(chain * 100) + '%', c: '210,140,255' });
  if (b.armor) o.push({ t: '슈퍼아머', c: '140,190,255' });
  if (hasDR(b)) o.push({ t: '상태 이상 저항', c: '201,160,255' });
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
    const GL = [[/^강화 (\d+)\/(\d+)/, '강', m => m[1] + '/' + m[2]], [/^피해 (.+)$/, '피', m => m[1]], [/^시전속도 (.+)$/, '속', m => m[1]], [/^스킬 대기 (.+)$/, '쿨', m => m[1]], [/^연속 패턴 (.+)$/, '연', m => m[1]], [/^슈퍼아머/, '갑', () => ''], [/^상태 이상 저항/, '저', () => ''], [/^난이도 (\d+)/, '난', m => m[1]], [/^(\d)페이즈/, '페', m => m[1]]];
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
function drawHpBar(x, y, w, hp, max, col) {   // SC1 식 생명력 막대: 칸으로 나뉜 초록 -> 노랑 -> 빨강
  const fr = clamp(hp / max, 0, 1), n = Math.max(5, Math.round(w / 4)), bw = w / n, on = Math.ceil(fr * n - 1e-6), c = fr > 0.66 ? '#3cff3c' : fr > 0.33 ? '#ffd23c' : '#ff3c3c';
  ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 8);
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
  ctx.fillStyle = hp > 0.5 ? '#4fd36a' : hp > 0.25 ? '#f0b030' : '#ff3a3a'; ctx.fillRect(x, y, w * hp, 7);
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
      ctx.strokeStyle = '#3cff3c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(P.x, P.y + 6, P.r * 1.9, P.r * 0.9, 0, 0, TAU); ctx.stroke();   // SC1 식 선택 원 (조작 중인 영웅)
      drawPlayerUnit(P.x, P.y, P.face, playerStyle(null, P.face), 0, pcDashing(P.act)); ctx.globalAlpha = 1; drawBuffAura(P.x, P.y, bR, bl, 1);
      if (P.act && P.act.type === 'stun') { ctx.fillStyle = '#ffe14a'; for (let i = 0; i < 3; i++) { const a = T * 6 + i * 2.1; circle(P.x + Math.cos(a) * P.r * 0.9, P.y - P.r * 3.4 - (HERO.mounted ? 22 : 0) + Math.sin(a) * 4, 3.5); } }
    } else {
      const e = it.e, lift = e.lift || 0;
      if (e.boss && !e.d.foot && e.stage > 0) { const pr = 0.6 + 0.4 * Math.sin(T * 6), g = ctx.createRadialGradient(e.x, e.y, 10, e.x, e.y, e.r * 2.8); g.addColorStop(0, `rgba(255,80,50,${0.07 * e.stage * pr})`); g.addColorStop(1, 'rgba(255,80,50,0)'); ctx.fillStyle = g; circle(e.x, e.y - 10, e.r * 2.8); }   // 단계가 오를수록 붉은 기운이 짙어짐
      if (e.phase2 && e.d.foot) { const pr = 0.6 + 0.4 * Math.sin(T * 6), g = ctx.createRadialGradient(e.x, e.y, 10, e.x, e.y, e.r * 2.6); g.addColorStop(0, `rgba(${e.d.zhao ? '127,208,255' : '127,255,208'},${0.35 * pr})`); g.addColorStop(1, `rgba(${e.d.zhao ? '127,208,255' : '127,255,208'},0)`); ctx.fillStyle = g; circle(e.x, e.y - 10, e.r * 2.6); }   // 2페이즈 청룡의 기운
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
  if (mode === 'duel') { if (NET.on) drawNetHUD(); else drawDuelHUD(); } else if (RAID) drawRaidHUD(); else {
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
  let chipY = (mode === 'duel' || RAID) ? 160 : 66;
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
    if (boss.d.zhao) { ctx.fillStyle = 'rgba(255,255,255,.55)'; for (const f of [0.25, 0.75]) ctx.fillRect(bx + bw * f - 1, by, 2, bh); }   // 보스 조운: 4단계 경계
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
  if (!IS_TOUCH) text(`WASD 이동 · J/클릭 공격 · K ${HERO.skills.s1} · L ${HERO.skills.s2} · ; ${HERO.skills.s3} · Space 회피 · ${mode === 'duel' ? 'Q 조작 변경' : 'Z/X/C 태그'} · T 오토`, 12, H - 8, 12, 'rgba(255,255,255,.7)', 'left', false);
  else if (clock < 12 && !joy) text('◀ 왼쪽 화면을 누르고 드래그해서 이동', 100, H - 40, 14, 'rgba(255,255,255,.8)', 'left', false);
  if (auto) text(IS_TOUCH ? 'AUTO 전투 중 — 조이스틱을 움직이면 해제 · 생명력 10% 이하 자동 태그' : 'AUTO 전투 중 — 이동 입력 시 해제 · 생명력 10% 이하 자동 태그', W / 2, H - 44, 14, '#7dff9a', 'center');
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
}
// 시작 화면의 영웅 초상 (카드 안, 발 위치 기준 x, y)
function drawCardFigure(h, x, y) {
  if (h.mounted) {
    const r = 38, rr = 30;
    drawHorse({ x, y, r, face: 0, flash: 0, state: 'chase', walk: T * 2.2, spawnT: 0, alpha: 1, d: h.horse }, 0);
    drawBody(x, y - r * 0.6, rr, 0, { ...h.style, noShadow: true, bob: Math.abs(Math.sin(T * 2.2)) * 2, weapon: { kind: h.style.weapon, ang: -1.0, len: 120 } });
  } else drawBody(x, y, 40, Math.PI / 2, { ...h.style, bob: Math.abs(Math.sin(T * 2.2)) * 2, weapon: { kind: h.style.weapon, ang: -1.0, len: 120 } });
}
// ===== 로비(시작 화면): 프로젝트 이름 · 설명 · 보스 스테이지 입장 버튼 2개 · 조작 가이드 =====
//  여포 보스 스테이지 = 시작 영웅 관우(보스 여포 봉선) / 관우 보스 스테이지 = 시작 영웅 여포 상마(보스 관우 운장). 전투 중에는 3인을 태그로 교체.
const LOBBY_STAGES = [
  { title: '로그라이크 모드', line: 'W1~W50  ·  5층마다 보스  ·  5층마다 능력치 강화 선택', start: '최대 3명 선택  ·  Z / X / C 태그  ·  여포는 K 로 상마↔하마', col: '#d8a03a' },
  { title: '비무장 모드', line: '1~3명 PC 대전 (적도 같은 인원)  ·  제한 시간 3분', start: '1~3명 선택  ·  태그 없이 시작부터 전투  ·  레벨 보정 양쪽 동일', col: '#4fb0ff' },
  { title: '레이드 모드', line: '여포 봉선 8단계 보스전  ·  1~3명 동시 전투', start: '1명 조작 + AI 동료 2명  ·  태그 없음  ·  온라인은 준비 중', col: '#e0504a' },
];
// ===== 로비 (참고: 모바일 게임의 깔끔한 로비) — 위: 프로필 · 로고 · 도움말 / 가운데: 대표 영웅 + 말풍선 / 아래: 내비게이션 바 =====
const LOBBY_HERO_BOX = { x: W / 2 - 360, y: 96, w: 360, h: 500 };
const LOBBY_LINES = {
  guan: ['의리로 천하를 지키겠소.', '청룡언월도가 울고 있구려.'], lubu: ['천하무쌍, 나를 막을 자 누구냐!', '적토마가 달리고 싶어 하오.'], zhao: ['창 한 자루면 충분하오.', '백만 대군 속이라도 가겠소.'],
  diao: ['모두 무사히 돌아오세요.', '연꽃이 장군을 지켜줄 거예요.'], dian: ['주공께는 한 걸음도 못 갑니다!', '쌍철극이 피를 원하는군.'], huang: ['백 보 밖이라도 빗나가지 않소.', '노장의 활솜씨를 보여주지.'],
};
function navIcon(i, x, y, col) {   // 내비게이션 아이콘 (선으로 그린 약식): 0 깃발 / 1 교차한 검 / 2 방천화극 / 3 두루마리
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (i === 0) { ctx.beginPath(); ctx.moveTo(-9, 17); ctx.lineTo(-9, -16); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-9, -15); ctx.lineTo(15, -9 + Math.sin(T * 4) * 1.5); ctx.lineTo(-9, 1); ctx.closePath(); ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1; }
  else if (i === 1) { for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-14 * d, 16); ctx.lineTo(14 * d, -16); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-9 * d, 9); ctx.lineTo(-15 * d, 4); ctx.stroke(); } }
  else if (i === 2) { ctx.beginPath(); ctx.moveTo(-11, 18); ctx.lineTo(11, -15); ctx.stroke(); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(9, -9, 7, Math.PI * 0.2, Math.PI * 1.2); ctx.stroke(); ctx.beginPath(); ctx.arc(2, -1, 7, Math.PI * 1.2, Math.PI * 2.2); ctx.stroke(); }
  else { ctx.strokeRect(-11, -14, 22, 28); ctx.lineWidth = 2; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-6, -7 + k * 7); ctx.lineTo(6, -7 + k * 7); ctx.stroke(); } }
  ctx.restore();
}
const NAV_SHORT = ['웨이브 50 · 5층마다 보스', '1~3 대 1~3 · 3분 대전', '여포 봉선 8단계 보스전'];
const NAV_COL = ['#e0b13a', '#4fb0ff', '#ff6a5a', '#9dff9d'];
function drawLobbyNav() {
  const by = 596;   // 바 바탕
  { const g = ctx.createLinearGradient(0, by, 0, H); g.addColorStop(0, 'rgba(8,6,18,.72)'); g.addColorStop(1, 'rgba(4,3,10,.94)'); ctx.fillStyle = g; ctx.fillRect(0, by, W, H - by); }
  ctx.fillStyle = 'rgba(255,211,77,.55)'; ctx.fillRect(0, by, W, 2);
  const n = STAGE_HEROES.length + 1;
  for (let i = 0; i < n; i++) {
    const r = cardRect(i), sel = lobbySel === i, col = NAV_COL[i], title = i < STAGE_HEROES.length ? LOBBY_STAGES[i].title : '장수 정보';
    ctx.fillStyle = sel ? 'rgba(60,44,16,.88)' : 'rgba(18,14,30,.7)'; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = sel ? '#ffd34d' : 'rgba(255,255,255,.22)'; ctx.lineWidth = sel ? 3 : 1.5; ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = col; ctx.fillRect(r.x, r.y + r.h - 4, r.w, 4);
    if (sel) { ctx.strokeStyle = 'rgba(255,211,77,' + (0.2 + 0.18 * Math.sin(T * 5)) + ')'; ctx.lineWidth = 7; ctx.strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8); }
    navIcon(i, r.x + 38, r.y + 38, sel ? '#ffe9a0' : col);
    text(title, r.x + 72, r.y + 36, 21, sel ? '#ffe9a0' : '#e6e9f5', 'left');
    const sub = i < STAGE_HEROES.length ? NAV_SHORT[i] : '총 Lv ' + (ACC ? HERO_IDS.reduce((t, id) => t + heroRec(ACC, id).lv, 0) : 0) + (IS_TOUCH ? '' : '  ·  I');
    text(fitStr(sub, r.w - 82, 12.5), r.x + 72, r.y + 60, 12.5, sel ? '#ffd9a0' : '#aab3c8', 'left', false);
  }
  const sel = lobbySel;   // 선택한 항목의 한 줄 설명 (바 위쪽)
  if (sel < STAGE_HEROES.length) { const st = LOBBY_STAGES[sel]; text(st.start, W / 2, 586, 14, 'rgba(255,233,160,.9)', 'center', false); }
  text(IS_TOUCH ? '항목을 터치하면 입장합니다' : '← →  선택   ·   Enter  입장   ·   H  도움말', W / 2, 716, 11.5, 'rgba(255,255,255,.45)', 'center', false);
}
function drawLobbyHero() {   // 가운데 대표 영웅 (누르면 다음 영웅) + 말풍선
  const id = lobbyHero || selHero || HERO_IDS[0], h = HEROES[id]; lobbyHeroT += 1 / 60;
  const fx0 = W / 2 - 170, fy0 = 560;
  const sp = ctx.createRadialGradient(fx0, fy0 + 8, 10, fx0, fy0 + 8, 190); sp.addColorStop(0, 'rgba(255,214,140,.38)'); sp.addColorStop(1, 'rgba(255,214,140,0)'); ctx.fillStyle = sp; ctx.save(); ctx.translate(fx0, fy0 + 8); ctx.scale(1, 0.28); ctx.translate(-fx0, -(fy0 + 8)); ctx.fillRect(fx0 - 200, fy0 - 200, 400, 400); ctx.restore();
  ctx.save(); ctx.translate(fx0, fy0); const sc = h.mounted ? 1.7 : 2.1; ctx.scale(sc, sc); drawCardFigure(h, 0, 0); ctx.restore();
  // 이름표
  const nm = PC_NAME[id] + '  Lv ' + (ACC ? heroRec(ACC, id).lv : 1);
  ctx.font = '700 17px ' + FONT; const tw = ctx.measureText(nm).width + 34;
  ctx.fillStyle = 'rgba(10,8,20,.7)'; ctx.fillRect(fx0 - tw / 2, 232, tw, 30); ctx.fillStyle = '#ffd34d'; ctx.fillRect(fx0 - tw / 2, 232, 4, 30); text(nm, fx0 + 2, 253, 17, '#ffe9a0', 'center');
  // 말풍선
  const lines = LOBBY_LINES[id] || ['준비되었소.'], line = lines[Math.floor(lobbyHeroT / 6) % lines.length];
  ctx.font = '600 17px ' + FONT; const bw = ctx.measureText(line).width + 44, bx = fx0 + 130, by = 300;
  ctx.fillStyle = 'rgba(250,248,240,.93)'; ctx.beginPath(); ctx.moveTo(bx + 12, by); ctx.lineTo(bx + bw - 12, by); ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + 12); ctx.lineTo(bx + bw, by + 38); ctx.quadraticCurveTo(bx + bw, by + 50, bx + bw - 12, by + 50); ctx.lineTo(bx + 12, by + 50); ctx.quadraticCurveTo(bx, by + 50, bx, by + 38); ctx.lineTo(bx - 14, by + 40); ctx.lineTo(bx, by + 28); ctx.lineTo(bx, by + 12); ctx.quadraticCurveTo(bx, by, bx + 12, by); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2a2438'; ctx.font = '600 17px ' + FONT; ctx.textAlign = 'left'; ctx.fillText(line, bx + 22, by + 31); ctx.textAlign = 'left';
}
function drawLobbyAccount() {   // 왼쪽 위 프로필 카드 (누르면 계정 선택) / 오른쪽 위 도움말 버튼
  if (!ACC) return;
  const b = ACC_BTN, top = HERO_IDS.reduce((m, id) => heroRec(ACC, id).lv > heroRec(ACC, m).lv ? id : m, HERO_IDS[0]), tot = HERO_IDS.reduce((t, id) => t + heroRec(ACC, id).lv, 0);
  ctx.fillStyle = 'rgba(10,8,20,.72)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.fillStyle = '#ffd34d'; ctx.fillRect(b.x, b.y, 4, b.h); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.save(); ctx.beginPath(); ctx.arc(b.x + 40, b.y + 32, 24, 0, TAU); ctx.clip(); ctx.translate(b.x + 40, b.y + 37); ctx.scale(0.8, 0.8); drawPortraitIcon(HEROES[top], 0, 0); ctx.restore();
  ctx.strokeStyle = '#d4a73a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x + 40, b.y + 32, 24, 0, TAU); ctx.stroke();
  text(ACC.name, b.x + 76, b.y + 29, 20, '#fff', 'left'); text('총 Lv ' + tot + '   ·   최고 ' + (ACC.best || 0) + '층', b.x + 76, b.y + 51, 12.5, '#aab3c8', 'left', false);
  text('변경 ▾', b.x + b.w - 12, b.y + 22, 11.5, '#9ad4ff', 'right', false);
  const hb = HELP_BTN; ctx.fillStyle = 'rgba(10,8,20,.72)'; ctx.fillRect(hb.x, hb.y, hb.w, hb.h); ctx.strokeStyle = helpOpen ? '#ffd34d' : 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.strokeRect(hb.x, hb.y, hb.w, hb.h); text('?', hb.x + hb.w / 2, hb.y + 32, 26, '#ffe9a0', 'center');
}
function drawHelpPanel() {
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
  const p = HELP_PANEL; ctx.fillStyle = 'rgba(14,10,26,.96)'; ctx.fillRect(p.x, p.y, p.w, p.h); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3; ctx.strokeRect(p.x, p.y, p.w, p.h); ctx.strokeStyle = 'rgba(255,211,77,.3)'; ctx.lineWidth = 1; ctx.strokeRect(p.x + 8, p.y + 8, p.w - 16, p.h - 16);
  text('도움말 · 조작 가이드', W / 2, p.y + 46, 28, '#ffe9a0', 'center');
  const G = IS_TOUCH
    ? ['왼쪽 화면 드래그 : 이동 (가상 조이스틱)', '공격 버튼 : 누를 때마다 1 → 2 → 3단계', '스킬 · 궁극기(쿨타임 30초) · 회피 버튼', '왼쪽 TAG 버튼 : 선택한 영웅으로 교체 (로그라이크)', 'AUTO : 자동 전투 (생명력 10% 이하 자동 태그)', '붉은 범위 표시 = 적 공격 예고 — 회피로 피하세요!', '비무장·레이드 : 왼쪽 영웅 초상화를 눌러 조작 영웅 변경']
    : ['WASD / 방향키 : 이동      J / 마우스 클릭 : 공격 (1 → 2 → 3단계)', 'K · L : 스킬      ; : 궁극기 (쿨타임 30초)      Space : 회피 (무적)', 'Z · X · C : 선택한 영웅 순서대로 태그 (로그라이크)', 'T / Tab : 오토 전투 (생명력 10% 이하 자동 태그)', '붉은 범위 표시 = 적 공격 예고 — 회피로 피하세요!', '비무장·레이드 : 왼쪽 영웅 초상화를 누르거나 Q 로 조작 영웅 변경'];
  G.forEach((t, i) => text(t, W / 2, p.y + 92 + i * 28, 15, '#dfe3f5', 'center', false));
  text('튜토리얼 다시 보기', W / 2, p.y + 292, 17, '#ffd34d', 'center');
  [['로그라이크 모드', 'yeonui'], ['비무장 모드', 'duel'], ['레이드 모드', 'raid']].forEach(([nm, key], i) => { const r = tutBtnRect(i), done = ACC && ACC.tut && ACC.tut[key]; ctx.fillStyle = 'rgba(10,12,20,.9)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = done ? '#7a8aa0' : '#ffd34d'; ctx.lineWidth = 1.5; ctx.strokeRect(r.x, r.y, r.w, r.h); text('▶ ' + nm + (done ? '' : '  (처음 입장 시 진행)'), r.x + r.w / 2, r.y + 24, 15, done ? '#cfd3e6' : '#ffe9a0', 'center', false); });
  text('아무 곳이나 누르거나 Esc / H 로 닫기', W / 2, p.y + p.h - 22, 12.5, 'rgba(255,255,255,.55)', 'center', false);
}
function drawTitle() {
  drawLoginScene(); ctx.fillStyle = 'rgba(6,4,14,.22)'; ctx.fillRect(0, 0, W, H);   // 로그인 화면과 같은 노을 진 야영지 배경
  ctx.save(); ctx.shadowColor = 'rgba(255,170,60,.75)'; ctx.shadowBlur = 16; text('三國 猛將傳', W / 2, 54, 40, '#ffd34d', 'center'); ctx.restore();
  drawLobbyHero();
  drawLobbyNav();
  if (helpOpen) drawHelpPanel();
}
// 적토 돌격 질주 중 화면 가장자리에서 중심으로 흐르는 속도선
function drawSpeedLines() {
  const a = P.act; if (state !== 'play' || !a || !a.invul || !(a.ph === 'dash' || (a.type === 'tag' && a.id === 'lubu' && a.t >= 0.1 && a.t < 0.3))) return;
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const an = rand(0, TAU), r1 = rand(260, 420), r2 = r1 + rand(100, 260);
    ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(255,244,208,.32)' : 'rgba(255,154,74,.28)'; ctx.lineWidth = rand(1, 3);
    ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(an) * r1 * 1.5, H / 2 + Math.sin(an) * r1 * 0.9); ctx.lineTo(W / 2 + Math.cos(an) * r2 * 1.5, H / 2 + Math.sin(an) * r2 * 0.9); ctx.stroke();
  }
  ctx.restore();
}
function render() {
  ctx.clearRect(0, 0, W, H); ICON_HITS = []; if (iconTip && !(state === 'play' || state === 'upgrade')) iconTip = null;
  if (state === 'account') { drawAccount(); return; }
  if (state === 'info') { drawInfo(); return; }
  if (state === 'title') { drawTitle(); if (!helpOpen) drawLobbyAccount(); return; }
  if (state === 'pick') { drawPick(); return; }
  if (state === 'duelMenu') { drawDuelMenu(); return; }
  if (state === 'raidMenu') { raidMsgT = Math.max(0, raidMsgT - 1 / 60); drawRaidMenu(); return; }
  if (state === 'raidBoss') { drawRaidBoss(); return; }
  if (state === 'waves') { drawWaves(); return; }
  if (state === 'upgrade') { drawWorld(); drawHUD(); drawUpgrade(); return; }
  drawWorld(); drawSpeedLines(); drawTagOverlay(); drawHUD(); drawIconTip(); if (state === 'play') { if (MINIMAP_ON) drawMinimap(); drawHeroPointer(); drawTutorial(); }
  if (flashT > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, flashT * 2)})`; ctx.fillRect(0, 0, W, H); }
  if (paused && state === 'play') drawPauseOverlay();
  if (mode === 'duel' && duel) { if (state === 'win' && winT > 1.0 || state === 'lose' && winT > 0.6) drawOverlay(duel.title, duel.sub, duel.col); }
  else {
    if (state === 'win') { if (winT > 1.2) drawOverlay('VICTORY', TYPES.boss.short + '를 쓰러뜨렸습니다!', '#ffd34d'); }
    if (state === 'lose') { if (RS.exited) drawOverlay('나가기', '지금까지의 경험치를 정산했습니다', '#9ad4ff'); else drawOverlay('DEFEAT', HERO.short + '가 쓰러졌습니다...', '#ff5a5a'); }
  }
  if ((state === 'win' && winT > 1.2) || (state === 'lose' && winT > 0.7)) drawXpSummary();   // 이번 판 경험치·레벨업
}

// ===================================================================
// 온라인 대전 (비무장과 같은 규칙, 1~3 대 1~3 · 방 코드 + 중계 서버)
//  - 방장(host)이 전투를 계산한다: 양 팀 모두 '파이터'(비무장 AI 와 같은 규칙·수치·스킬)이고, 각 팀에서 사람이 조종하는 영웅 한 명은 입력이 AI 의 판단을 대신한다 (나머지는 AI, Q·초상화로 조작 변경).
//  - 게스트(guest)는 자기 입력만 보내고, 방장이 보낸 상태(스냅샷 20회/초)를 약 0.1초 늦춰 보간해서 그린다. 게스트는 전투 계산을 하지 않는다.
//  - 레벨 성장은 쓰지 않는다 (두 사람의 계정이 달라 공정하지 않으므로 기본 수치로만 대전).
// ===================================================================
Object.assign(NET, { team: ['guan'], peerTeam: [], hostTeam: [], guestTeam: [], mine: [], theirs: [], ci: [0, 0], inpH: null, inpG: null, swapT: [0, 0], retry: 0, hb: null, fold: true });
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const netNewInp = () => ({ mx: 0, my: 0, h: false, b: { attack: -9, s1: -9, s2: -9, s3: -9, dash: -9 } });
function netClose() { if (NET.ws) { try { NET.ws.onclose = null; NET.ws.close(); } catch (_) { } } NET.ws = null; NET.open = false; NET.paired = false; NET.code = ''; NET.peerTeam = []; NET.role = null; }
function netConnect(then, again) {
  const keep = NET.retry, role = NET.role; netClose(); NET.role = role; NET.retry = again ? keep : (/^wss:/i.test(NET.url) ? 8 : 0); NET.url = NET.url.trim(); if (!new RegExp('^wss?://', 'i').test(NET.url)) NET.url = 'ws://' + NET.url;   // 앞의 ws:// 를 빼먹어도 보정
  if (location.protocol === 'https:' && new RegExp('^ws://', 'i').test(NET.url)) { NET.status = '이 앱은 보안(https) 방식이라 ws:// 서버에 접속할 수 없습니다 — wss:// 주소를 쓰거나 LAN 테스트용 앱을 설치하세요'; return; }
  NET.status = '서버 연결 중...';
  let ws; try { ws = new WebSocket(NET.url); } catch (e) { NET.status = '서버 주소가 올바르지 않습니다'; return; }
  NET.ws = ws;
  ws.onopen = () => { NET.open = true; NET.retry = 0; NET.status = '서버에 연결됨'; if (then) then(); clearInterval(NET.hb); NET.hb = setInterval(() => netRaw({ t: 'ping' }), 20000); };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (_) { return; } netOnMsg(m); };
  ws.onclose = () => { const was = NET.open; clearInterval(NET.hb); if (!was && NET.retry > 0 && NET.ws === ws) { NET.retry--; NET.status = '서버를 깨우는 중... (무료 서버는 처음 접속에 최대 1분 걸립니다)'; setTimeout(() => { if (NET.ws === ws && !NET.open) netConnect(then, true); }, 6000); return; } NET.ws = null; NET.open = false; NET.paired = false; NET.peerTeam = []; NET.status = was ? '서버 연결이 끊어졌습니다' : '서버에 연결하지 못했습니다: ' + NET.url + (IS_TOUCH && /localhost|127.0.0.1/.test(NET.url) ? ' — localhost 는 이 폰 자신입니다. 서버 주소를 눌러 PC 의 IP(예: ws://192.168.1.9:8787)로 바꾸세요' : ' (같은 와이파이·서버 실행·방화벽 확인)'); if (NET.inMatch) netMatchAbort('서버 연결이 끊어졌습니다'); };
  ws.onerror = () => { };
}
const netRaw = o => { if (NET.ws && NET.open) NET.ws.send(JSON.stringify(o)); };
const netSend = d => netRaw({ t: 'r', d });
function netCreate() { NET.role = 'host'; netConnect(() => netRaw({ t: 'host' })); NET.role = 'host'; }
function netJoin(code) { if (!code) return; NET.role = 'guest'; netConnect(() => netRaw({ t: 'join', code })); NET.role = 'guest'; }
function netPromptJoin() { let c = null; try { c = window.prompt('친구에게 받은 방 코드(4글자)를 입력하세요', ''); } catch (_) { } if (c) netJoin(c.trim().toUpperCase()); }
function netPromptUrl() { let u = null; try { u = window.prompt('중계 서버 주소 (예: wss://내서버.onrender.com 또는 ws://192.168.0.5:8787)', NET.url); } catch (_) { } if (u) { NET.url = u.trim(); try { localStorage.setItem('sgb_net_url', NET.url); } catch (_) { } } }
function netOnMsg(m) {
  if (m.t === 'room') { NET.code = m.code; NET.status = '방 코드 ' + m.code + ' — 상대를 기다리는 중'; }
  else if (m.t === 'err') { NET.status = m.msg; netClose(); }
  else if (m.t === 'paired') { NET.paired = true; NET.status = '상대와 연결되었습니다'; netSendTeam(); }
  else if (m.t === 'left') {
    NET.peerTeam = []; NET.paired = false;
    if (NET.inMatch) netMatchAbort('상대가 나갔습니다');
    if (NET.role === 'guest') { NET.status = '방장이 방을 닫았습니다'; netClose(); } else NET.status = '상대가 나갔습니다 — 방 코드 ' + NET.code + ' 로 다시 기다리는 중';
  }
  else if (m.t === 'm') netOnData(m.d);
}
function netOnData(d) {
  if (!d) return;
  if (d.k === 'team') NET.peerLv = d.lv || {};
  if (d.k === 'team') NET.peerTeam = Array.isArray(d.team) ? d.team.filter(id => HEROES[id] && id !== 'lubu2').slice(0, 3) : [];
  else if (d.k === 'start' && NET.role === 'guest' && !NET.inMatch) netBeginGuest(d.ht, d.gt, d.lv);
  else if (d.k === 'in' && NET.role === 'host' && NET.inpG) { const i = NET.inpG; i.mx = d.mx || 0; i.my = d.my || 0; i.h = !!d.h; for (const n of (d.b || [])) if (n in i.b) i.b[n] = T; }
  else if (d.k === 'sw' && NET.role === 'host' && NET.inMatch) netSetCtl(1, d.i | 0);
  else if (d.k === 'auto' && NET.role === 'host') NET.autoG = !!d.on;
  else if (d.k === 'snap' && NET.role === 'guest' && NET.inMatch) {
    d.f = d.f.map((dl, i) => { const F = NET.full[i] || (NET.full[i] = {}), C = NET.acts[i] || (NET.acts[i] = {}); Object.assign(F, dl); if (dl.act && dl.act.def) { C[dl.act.id] = { def: dl.act.def, ev: dl.act.ev }; delete C[dl.act.id - 4]; } return Object.assign({}, F); });
    NET.snaps.push({ rt: performance.now(), d }); while (NET.snaps.length > 12) NET.snaps.shift(); if (d.st && d.st !== 'play') NET.lastEnd = d; }
}
const netMyLv = () => { const o = {}; for (const id of HERO_IDS) o[id] = ACC ? heroRec(ACC, id).lv : 1; return o; };
function netLvTable(ht, gt) {   // 같은 영웅이 양 팀에 있으면 낮은 쪽 레벨, 한 팀에만 있으면 그 사람의 레벨
  const me = netMyLv(), th = NET.peerLv || {}, o = {};
  for (const id of HERO_IDS) { const inH = ht.includes(id), inG = gt.includes(id); o[id] = inH && inG ? Math.min(me[id] || 1, th[id] || 1) : inH ? (me[id] || 1) : inG ? (th[id] || 1) : 1; }
  return o;
}
function netSendTeam() { if (NET.paired) netSend({ k: 'team', team: NET.team, lv: netMyLv() }); }
function netPickToggle(id) { const k = NET.team.indexOf(id); if (k >= 0) NET.team.splice(k, 1); else if (NET.team.length < 3) NET.team.push(id); netSendTeam(); sfx('hit'); }
function netReady() { return NET.team.length >= 1 && NET.peerTeam.length >= 1; }
function netStartHost() { if (NET.role !== 'host' || !NET.paired || !netReady()) return; const ht = NET.team.slice(), gt = NET.peerTeam.slice(), lv = netLvTable(ht, gt); netSend({ k: 'start', ht, gt, lv }); netBeginHost(ht, gt, lv); }
const netAuto = f => !!f.human && (f.team === 'ally' ? auto : NET.autoG);   // 온라인: 사람이 조종하는 영웅이 자동 전투 중인가 (방장 = 내 AUTO / 게스트 = 받은 신호)
function netResetWorld() {
  BTN.find(b => b.id === 'auto').y = 375; NET.autoG = false;
  resetRun(); resetRS(); mode = 'duel'; applyGrowth('duel'); LUBU_FORM = 'lubu'; resetPlayer(); P.dead = true; P.hp = 0; P.act = null;
  enemies = []; allies = []; projectiles = []; fx = []; dts = []; items = [];
  kills = 0; clock = 0; winT = 0; autoDodgeCd = 0; shake = 0; hitstop = 0; slowT = 0; flashT = 0; tagFx = null; joy = null; auto = false; waveIdx = 0; bannerT = 0; pendingSpawn = false; spawnQ = []; TUT = null;
  for (const k in buf) buf[k] = -9; NET.snaps = []; NET.sfxQ.length = 0; NET.fxSeen = new WeakSet(); NET.dtSeen = new WeakSet(); NET.lastEnd = null; NET.lastNew = null; NET.sendT = 0; NET.inT = 0; NET.aborted = false;
  NET.mine = []; NET.theirs = []; NET.hostTeam = []; NET.guestTeam = []; NET.ci = [0, 0]; NET.swapT = [0, 0]; NET.lastOut = []; NET.full = []; NET.acts = [{}, {}, {}, {}, {}, {}];
}
const NET_POS_H = n => n === 1 ? [[-420, 0]] : n === 2 ? [[-420, 0], [-470, -150]] : [[-420, 0], [-470, -150], [-470, 150]];   // 비무장과 같은 배치 (첫 번째 = 조작 영웅)
const NET_POS_G = n => n === 1 ? [[420, 0]] : n === 2 ? [[420, 0], [470, -150]] : [[420, 0], [470, -150], [470, 150]];
function netBuildTeams(ht, gt, hostSide) {   // 방장 시점: 방장 팀 = 'ally', 게스트 팀 = 'foe' / 게스트 시점: 게스트 팀 = 'ally', 방장 팀 = 'foe'
  const ph = NET_POS_H(ht.length), pg = NET_POS_G(gt.length);
  NET.hostTeam = ht.map((h, i) => { const f = makeFighter(h, hostSide ? 'ally' : 'foe', ARENA_C.x + ph[i][0], ARENA_C.y + ph[i][1]); f.face = 0; return f; });
  NET.guestTeam = gt.map((h, i) => { const f = makeFighter(h, hostSide ? 'foe' : 'ally', ARENA_C.x + pg[i][0], ARENA_C.y + pg[i][1]); f.face = Math.PI; return f; });
  NET.mine = hostSide ? NET.hostTeam : NET.guestTeam; NET.theirs = hostSide ? NET.guestTeam : NET.hostTeam;
  allies = NET.mine; enemies = NET.theirs;
  duel = { stats: {}, order: (hostSide ? ht : gt).slice(), t: DUEL_TIME, t0: 0, swapCd: 0, cyc: 0, foes: NET.theirs.slice(), title: '', sub: '', col: '' };
}
const netSide = () => NET.role === 'host' ? 0 : 1;
const netCur = () => NET.mine[NET.ci[netSide()]] || NET.mine[0];
function netBeginHost(ht, gt, lv) {
  NET.lv = lv; NET.on = true; NET.role = 'host'; NET.inMatch = true; selHero = ht[0]; netResetWorld(); applyHero(); P.dead = true;
  netBuildTeams(ht, gt, true);
  NET.inpH = netNewInp(); NET.inpG = netNewInp();
  NET.hostTeam[0].human = true; NET.hostTeam[0].inp = NET.inpH; NET.guestTeam[0].human = true; NET.guestTeam[0].inp = NET.inpG;
  state = 'play'; const c = netCur(); cam.x = c.x - W / 2; cam.y = c.y - H / 2; netSyncP();
}
function netBeginGuest(ht, gt, lv) {
  NET.lv = lv || {}; NET.on = true; NET.role = 'guest'; NET.inMatch = true; selHero = gt[0]; netResetWorld(); applyHero(); P.dead = true;
  netBuildTeams(ht, gt, false);
  state = 'play'; const c = netCur(); cam.x = c.x - W / 2; cam.y = c.y - H / 2; netSyncP();
}
function netSetCtl(side, idx) {   // 한 팀에서 사람이 조종하는 영웅을 바꿈 (나머지는 AI) — 방장이 계산
  const team = side === 0 ? NET.hostTeam : NET.guestTeam, f = team[idx];
  if (!f || f.dead || NET.ci[side] === idx || NET.swapT[side] > 0) return false;
  const old = team[NET.ci[side]], inp = side === 0 ? NET.inpH : NET.inpG;
  if (old) { old.human = false; old.inp = null; old.atkCd = 0.3; }
  for (const k in inp.b) inp.b[k] = -9;
  f.human = true; f.inp = inp; NET.ci[side] = idx; NET.swapT[side] = 1.0; ring(f.x, f.y, 90, 0.4, side === 0 ? '#4fb0ff' : '#ff9a6a', 8); sfx('skill'); return true;
}
function netSwap(i) { if (NET.role === 'host') netSetCtl(0, i); else if (NET.mine[i] && !NET.mine[i].dead) netSend({ k: 'sw', i }); }
function netCycle() { const n = NET.mine.length, c = NET.ci[netSide()]; for (let k = 1; k < n; k++) { const i = (c + k) % n; if (NET.mine[i] && !NET.mine[i].dead) return netSwap(i); } }
function netSyncP() {   // 조작·버튼 HUD 가 쓰는 P 를 지금 조종 중인 영웅에 맞춰 둔다 (P 는 그려지지 않는 허수)
  const f = netCur(); if (!f) return;
  P.dead = true; P.x = f.x; P.y = f.y; P.face = f.face; P.hp = f.hp; P.maxhp = f.maxhp; P.rage = f.rage; P.cd.s1 = f.cd.s1; P.cd.s2 = f.cd.s2; P.cd.dash = f.dashCd;
  P.act = f.act && f.act.def.name === 'atk' ? { type: 'atk', c: f.combo } : null; P.comboT = f.comboT; P.combo = f.combo; P.hits = 0;
  if (!HERO || HERO.id !== f.hero) { HERO = HEROES[f.hero]; curHero = pcId(f.hero); applyLabels(); P.dead = true; P.hp = f.hp; P.maxhp = f.maxhp; }
}
function netLocalInp() { const m = manualMove(), b = []; for (const n of ['attack', 's1', 's2', 's3', 'dash']) if (want(n)) { use(n); b.push(n); } return { mx: m.mx, my: m.my, h: attackHeld(), b }; }
const nq = v => Math.abs(v) < 10 ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10, q4 = v => Math.round(v * 4) / 4;   // 숫자 반올림 / 0.25 단위 양자화 (바뀌는 횟수를 줄여 전송량 절약)
function netEv(e) { const o = {}; for (const k in e) { const v = e[k]; if (typeof v === 'number') o[k] = nq(v); else if (typeof v === 'boolean' || typeof v === 'string') o[k] = v; } return o; }
function netActOut(f) {   // 동작: 새 동작이면 정의(def·ev)를 한 번만 보내고, 그 뒤에는 id·진행 시간·완료한 이벤트 비트마스크만
  const a = f.act; if (!a) return null;
  if (f._na !== a) { f._na = a; f._nid = (f._nid || 0) + 1; f._nsent = false; }
  let dn = 0; for (let k = 0; k < a.ev.length && k < 30; k++) if (a.ev[k].done) dn |= (1 << k);
  const o = { id: f._nid, t: r2(a.t), dn }; if (a.rx != null) { o.rx = Math.round(a.rx); o.ry = Math.round(a.ry); }
  if (!f._nsent) { f._nsent = true; o.def = { name: a.def.name, lult: !!a.def.lult, zult: !!a.def.zult, invul: !!a.def.invul, dur: a.def.dur, ev: a.def.name === 'ult' ? a.def.ev.map(netEv) : [] }; o.ev = a.ev.map(netEv); }
  return o;
}
function netFighterFull(f) {   // 바뀌는 값은 거칠게 양자화해서 변화량(전송량)을 줄인다
  return { hero: f.hero, x: r1(f.x), y: r1(f.y), face: r2(f.face), hp: Math.round(f.hp), maxhp: f.maxhp, rage: Math.round(f.rage), cs1: q4(f.cd.s1), cs2: q4(f.cd.s2), dc: q4(f.dashCd), state: f.state, t: r1(f.t), dead: !!f.dead, flash: f.flash > 0 ? 1 : 0, hitT: r1(f.hitT), hitAng: r1(f.hitAng), hitMag: f.hitMag, walk: r1(f.walk), moving: !!f.moving, dashing: !!f.dashing, invT: f.invT > 0 ? 1 : 0, armor: !!f.armor, mounted: !!f.mounted,
    guardT: q4(f.guardT), ultGuardT: q4(f.ultGuardT), runT: q4(f.runT), aspdT: q4(f.aspdT), postUltT: q4(f.postUltT), comboBuffT: q4(f.comboBuffT), blessT: q4(f.blessT), undyT: q4(f.undyT || 0), floorT: q4(f.floorT || 0), lungeT: f.lungeT > 0 ? 1 : 0, combo: f.combo, comboT: q4(f.comboT), hits: f.hits };
}
function netFighterDelta(f, i) {   // 이전에 보낸 값과 다른 항목만 (첫 전송은 전부) + 동작은 항상
  const full = netFighterFull(f), prev = NET.lastOut[i] || {}, d = {}; for (const k in full) if (full[k] !== prev[k]) d[k] = full[k];
  NET.lastOut[i] = full; d.act = netActOut(f); return d;
}
function netHostPre() {   // 방장의 입력을 방장이 조종 중인 영웅에 적용 (게스트 입력은 메시지가 올 때 이미 적용됨)
  const i = NET.inpH; if (!i) return; const li = netLocalInp(); if (auto && Math.hypot(li.mx, li.my) > 0.3) auto = false;   // 직접 움직이면 자동 전투 해제
  i.mx = li.mx; i.my = li.my; i.h = li.h; for (const n of li.b) i.b[n] = T;
}
function netHostPost(rdt) {
  NET.swapT[0] = Math.max(0, NET.swapT[0] - rdt); NET.swapT[1] = Math.max(0, NET.swapT[1] - rdt);
  for (const side of [0, 1]) { const team = side === 0 ? NET.hostTeam : NET.guestTeam, cur = team[NET.ci[side]]; if (cur && cur.dead) { NET.swapT[side] = 0; const nx = team.findIndex(f => !f.dead); if (nx >= 0) netSetCtl(side, nx); } }   // 조종하던 영웅이 쓰러지면 남은 영웅으로 자동 교체
  netSyncP();
  if ((state === 'win' || state === 'lose') && duel && !duel.netFix) { duel.netFix = true; duel.sub = duel.title === 'VICTORY' ? '상대 팀을 쓰러뜨렸습니다!' : duel.title === 'DRAW' ? '무승부입니다' : '패배했습니다...'; }
  NET.sendT -= rdt; if (NET.sendT > 0 && state === NET.lastSt) return; NET.sendT = 0.05; NET.lastSt = state;
  const o = { k: 'snap', f: [...NET.hostTeam, ...NET.guestTeam].map(netFighterDelta), c: NET.ci.slice(), pr: [], fx: [], dt: [], sx: [], sh: r1(shake), fl: r2(flashT), du: [r1(duel.t), r1(duel.t0)], st: state, ti: duel.title, su: duel.sub };
  for (const p of projectiles) if (o.pr.length < 24) o.pr.push({ x: r1(p.x), y: r1(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy), r: p.r, arrow: !!p.arrow, blade: !!p.blade, big: !!p.big, crystal: !!p.crystal, wave: !!p.wave, blue: !!p.blue, life: r2(p.life) });
  let nsp = 0, nfx = 0; for (const e of fx) if (!NET.fxSeen.has(e)) { NET.fxSeen.add(e); if (e.k === 'spark') { if (nsp++ >= 6) continue; } else if (nfx++ >= 36) continue; o.fx.push(netEv(e)); }   // 불꽃 입자는 장면당 6개까지만 (나머지는 생략)
  for (const e of dts) if (!NET.dtSeen.has(e)) { NET.dtSeen.add(e); if (o.dt.length < 14) o.dt.push(netEv(e)); }
  o.sx = NET.sfxQ.splice(0).filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);
  netSend(o);
}
function humanFighter(f, dt, tgt) {   // 사람이 조종하는 파이터: AI 의 판단 대신 입력으로 같은 행동(beginAct)을 시작
  const inp = f.inp, Hf = HEROES[f.hero], sk = f.skills, has = n => T - inp.b[n] < 0.3, eat = n => { inp.b[n] = -9; };
  const ml = Math.hypot(inp.mx, inp.my), mvx = ml > 1 ? inp.mx / ml : inp.mx, mvy = ml > 1 ? inp.my / ml : inp.my;
  if (tgt && dist(f, tgt) < 560) f.face = angTo(f, tgt); else if (ml > 0.2) f.face = Math.atan2(inp.my, inp.mx);
  if (has('dash') && f.dashCd <= 0) {
    eat('dash'); const dg = ml > 0.2 ? Math.atan2(inp.my, inp.mx) : tgt ? angTo(tgt, f) : f.face + Math.PI;
    f.dashCd = CD.dash; f.invT = 0.26; f.act = null; f.armor = false; beginAct(f, { name: 'dodge', dur: 0.26, ev: [{ t0: 0, t1: 0.22, fx: 'move', v: 950, ang: dg }] }, null); sfx('dash'); runAct(f, dt); return;
  }
  if (has('s3') && f.rage >= 100) { eat('s3'); f.rage = 0; beginAct(f, sk.ult, tgt); sfx('skill'); return; }
  if (has('s2') && f.cd.s2 <= 0) { eat('s2'); f.cd.s2 = CD.s2 * (Hf.s2cdMul || 1) * (1 - f.meta.cd); beginAct(f, sk.s2, tgt); return; }
  if (has('s1') && f.cd.s1 <= 0) { eat('s1'); f.cd.s1 = CD.s1 * (Hf.s1cdMul || 1) * (1 - f.meta.cd); beginAct(f, sk.s1, tgt); return; }
  if (has('attack') || inp.h) { eat('attack'); const st = f.comboT > 0 ? (f.combo + 1) % 3 : 0; f.combo = st; f.comboT = 1.0; beginAct(f, comboDef(f.hero, st), tgt); sfx('swing'); return; }
  const sp = f.speed * (Hf.runBonus && f.runT > 0 ? Hf.runBonus : 1) * (f.slowT > 0 ? 0.55 : 1);
  if (ml > 0.2) { f.moving = true; f.x += mvx * sp * dt; f.y += mvy * sp * dt; f.walk += dt * 12 * Math.min(1, ml); }
}
function netMatchAbort(msg) {   // 상대가 나가거나 연결이 끊김: 남은 사람이 승리 처리
  if (!NET.inMatch || NET.aborted) return; NET.aborted = true;
  if (state === 'play' && duel) { state = 'win'; winT = 0; duel.title = 'VICTORY'; duel.sub = msg + ' — 부전승'; duel.col = '#ffd34d'; duel.netFix = true; }
}
function netBackToRoom() {   // 결과 화면 -> 대기실 (연결이 살아 있으면 팀을 다시 고르고 방장이 다시 시작)
  NET.on = false; NET.inMatch = false; NET.lv = null; netResetWorld(); P.dead = false; P.hp = P.maxhp; allies = []; enemies = []; duel = null; mode = 'duel'; pickFor = 'duel'; pickOnline = true; duelPick = NET.team; state = 'pick';
  if (NET.paired) netSendTeam(); else if (!NET.ws) NET.status = '연결이 끊어졌습니다 — 다시 방을 만들거나 참가하세요';
}
function netLeave() { netClose(); NET.on = false; NET.inMatch = false; NET.lv = null; NET.status = ''; netResetWorld(); P.dead = false; allies = []; enemies = []; duel = null; state = 'title'; }
// ---- 게스트: 받은 스냅샷을 약 0.1초 늦춰 보간해서 반영 ----
function netGuestStep(rdt) {
  const S = NET.snaps; if (!S.length) return;
  const rt = performance.now() - 120; let ai = 0; for (let i = S.length - 1; i >= 0; i--) if (S[i].rt <= rt) { ai = i; break; }
  const A = S[ai], B = S[ai + 1] || null, u = B ? clamp((rt - A.rt) / Math.max(1, B.rt - A.rt), 0, 1) : 0, el = Math.max(0, Math.min(0.15, (rt - A.rt) / 1000)), d = A.d;
  [...NET.hostTeam, ...NET.guestTeam].forEach((o, i) => {
    const s = d.f[i], s2 = B ? B.d.f[i] : null; if (!s) return;
    const keep = { team: o.team, r: o.r, fighter: true, type: 'fighter', spawnT: 0, meta: o.meta, skills: o.skills };
    Object.assign(o, s, keep); o.cd = { s1: s.cs1, s2: s.cs2 }; o.dashCd = s.dc;
    if (s2 && s2.hero === s.hero) { o.x = s.x + (s2.x - s.x) * u; o.y = s.y + (s2.y - s.y) * u; o.face = s.face + (((s2.face - s.face + Math.PI) % TAU + TAU) % TAU - Math.PI) * u; }
    else if (!s2 && ai > 0) { const pv = S[ai - 1].d.f[i], dtp = (A.rt - S[ai - 1].rt) / 1000, ex = Math.min(0.12, (rt - A.rt) / 1000); if (pv && pv.hero === s.hero && dtp > 0.005 && !s.dead) { o.x = s.x + (s.x - pv.x) / dtp * ex; o.y = s.y + (s.y - pv.y) / dtp * ex; } }   // 새 스냅샷이 늦으면 짧게(0.12초) 이동을 이어서 추정
    o.act = null; if (s.act) { const c = (NET.acts[i] || {})[s.act.id]; if (c) { for (let k = 0; k < c.ev.length && k < 30; k++) c.ev[k].done = !!(s.act.dn & (1 << k)); o.act = { def: c.def, t: s.act.t + el, ev: c.ev, rx: s.act.rx, ry: s.act.ry }; } }
    o.flash = s.flash ? 0.1 : 0; o.invT = s.invT ? 0.1 : 0; o.lungeT = s.lungeT ? 0.1 : 0; o.hitT = Math.max(0, s.hitT - el); o.d = { name: DUEL_NAME[o.hero], hitRec: 0.32 };
  });
  NET.ci = d.c.slice();
  if (NET.lastNew !== A) {   // 새 스냅샷마다 한 번: 이펙트·소리·투사체·타이머·승패
    NET.lastNew = A;
    for (const e of d.fx) fx.push(e); for (const e of d.dt) dts.push(e); for (const n of d.sx) sfx(n);
    shake = Math.max(shake, d.sh * 0.8); flashT = Math.max(flashT, d.fl); duel.t = d.du[0]; duel.t0 = d.du[1];
    projectiles = d.pr.map(p => ({ ...p }));
  }
  const ed = NET.lastEnd;
  if (ed && state === 'play' && S[S.length - 1].d.st !== 'play') { const t = ed.ti; state = t === 'VICTORY' ? 'lose' : 'win'; winT = 0; duel.title = t === 'VICTORY' ? 'DEFEAT' : t === 'DEFEAT' ? 'VICTORY' : 'DRAW'; duel.sub = t === 'VICTORY' ? '패배했습니다...' : t === 'DRAW' ? '무승부입니다' : '상대 팀을 쓰러뜨렸습니다!'; duel.col = t === 'VICTORY' ? '#ff5a5a' : t === 'DRAW' ? '#ff9a5a' : '#ffd34d'; }
  for (const p of projectiles) { p.x += p.vx * rdt; p.y += p.vy * rdt; }
  if (state === 'play') duel.t0 += rdt; else winT += rdt;
  netSyncP(); updateFx(rdt); netGuestIn(rdt);
}
function netGuestIn(rdt) {   // 게스트 입력 전송 (버튼은 즉시, 이동은 30회/초)
  const li = netLocalInp(); if (auto && Math.hypot(li.mx, li.my) > 0.3) { auto = false; netSend({ k: 'auto', on: false }); }
  NET.inT -= rdt; if (!li.b.length && NET.inT > 0 && !li.h) return false; NET.inT = 0.033;
  netSend({ k: 'in', mx: r2(li.mx), my: r2(li.my), h: li.h, b: li.b }); return true;
}
// ---- 화면 ----
function drawNetHUD() {
  if (!NET.mine.length) return;
  const cur = netCur(), row = (u, x, y, mine) => {
    const col = mine ? '#4fb0ff' : '#ff6a5a', fr = clamp(u.hp / u.maxhp, 0, 1), isCur = u === cur;
    ctx.fillStyle = 'rgba(10,12,20,.5)'; ctx.fillRect(x, y, 200, 38); ctx.strokeStyle = isCur ? '#ffd34d' : col; ctx.lineWidth = isCur ? 2.5 : 1.5; ctx.strokeRect(x, y, 200, 38);
    ctx.save(); ctx.beginPath(); ctx.arc(x + 20, y + 19, 16, 0, TAU); ctx.clip(); ctx.translate(x + 20, y + 22); ctx.scale(0.52, 0.52); drawPortraitIcon(HEROES[u.hero], 0, 0); ctx.restore();
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + 20, y + 19, 16, 0, TAU); ctx.stroke();
    text(DUEL_NAME[u.hero] + (isCur ? '  (나)' : ''), x + 42, y + 14, 11, '#fff');
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x + 42, y + 18, 150, 9); ctx.fillStyle = fr > 0.5 ? '#4fd36a' : fr > 0.25 ? '#f0b030' : '#ff3a3a'; ctx.fillRect(x + 43, y + 19, 148 * fr, 7);
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x + 42, y + 29, 150, 5); ctx.fillStyle = u.rage >= 100 ? '#ffd34d' : '#e0902a'; ctx.fillRect(x + 43, y + 30, 148 * clamp(u.rage / 100, 0, 1), 3);
    if (!u.dead) drawRowBuffs(u, HEROES[u.hero], mine, x, y);
    else { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x, y, 200, 38); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + 6, y + 4); ctx.lineTo(x + 36, y + 34); ctx.moveTo(x + 36, y + 4); ctx.lineTo(x + 6, y + 34); ctx.stroke(); }
  };
  NET.mine.forEach((u, i) => row(u, 10, 10 + i * 42, true)); NET.theirs.forEach((u, i) => row(u, W - 210, 10 + i * 42, false));
  if (NET.mine.length > 1) text('초상화 클릭 · Q : 조작 영웅 변경', 10, 10 + NET.mine.length * 42 + 8, 11, '#cfd3e6', 'left', false);
  const tl = Math.max(0, duel.t), mm = Math.floor(tl / 60), ss = Math.floor(tl % 60), urgent = tl < 30;
  ctx.fillStyle = 'rgba(10,12,20,.6)'; ctx.fillRect(W / 2 - 74, 8, 148, 36); ctx.strokeStyle = urgent ? '#ff6a5a' : '#d4a73a'; ctx.lineWidth = 2; ctx.strokeRect(W / 2 - 74, 8, 148, 36);
  text(String(mm).padStart(2, '0') + ' : ' + String(ss).padStart(2, '0'), W / 2, 35, 22, urgent ? '#ff8a7a' : '#fff', 'center');
  text('온라인 ' + NET.mine.length + ' VS ' + NET.theirs.length + ' · ' + (NET.role === 'host' ? '방장' : '게스트'), W / 2, 60, 12, '#cfd3e6', 'center', false);
  if (duel.t0 < 2.4 && state === 'play') { const al = clamp(Math.min(duel.t0, 2.4 - duel.t0) * 3, 0, 1); ctx.globalAlpha = al; text('FIGHT!', W / 2, 300, 72, '#ffd34d', 'center'); ctx.globalAlpha = 1; }
}

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
  update(dt); render();
  requestAnimationFrame(frame);
}
loadSave(); ACC = SAVE.accounts.find(a => a.id === SAVE.last) || null;
resetPlayer(); enemies = []; projectiles = []; fx = []; dts = []; items = []; waveIdx = 0; bannerT = 0; kills = 0; clock = 0; winT = 0; autoDodgeCd = 0;
requestAnimationFrame(frame);
