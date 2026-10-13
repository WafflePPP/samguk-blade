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
// 서버 주소: 직접 입력한 주소(sgb_net_url_manual)가 있으면 그것, 없으면 배포 페이지의 server.json 에 적힌 주소 (95-online.js 에서 불러옴). 개발용 localhost 에서는 로컬 중계 서버.
const NET_VER = 1;   // 온라인 규칙 버전: 파티원끼리 같아야 시작할 수 있다 (온라인 동기화 형식이 바뀌면 올림)
const NET_DEV = /^(localhost|127\.0\.0\.1|192\.168\.|10\.)/.test(location.hostname);
try { const m = localStorage.getItem('sgb_net_url_manual'); NET.urlManual = !!m; if (m) NET.url = m; else if (!NET_DEV) NET.url = ''; } catch (_) { if (!NET_DEV) NET.url = ''; }

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
  if (speedCtlOn() && (e.code === 'BracketLeft' || e.code === 'BracketRight')) { speedStep(e.code === 'BracketLeft' ? -1 : 1); return; }   // [ ] : 전투 속도
  if (e.code === 'KeyM' && mode === 'duel') { meterOn = !meterOn; return; }   // 비무장 미터기 접기/펴기
  if (e.code === 'KeyQ' && (mode === 'duel' || RAID) && state === 'play') { if (NET.on) { if (!NET.raid) netCycle(); } else cycleControl(); return; }   // 비무장 모드: Q = 다음 아군으로 조작 변경 (온라인 레이드는 각자 1명만 조작)
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
function openPause(kind) { if (TUT || mode !== 'yeonui' || state !== 'play') return; paused = true; pauseKind = NET.on ? 'exit' : kind; joy = null; for (const k in holdSrc) delete holdSrc[k]; for (const k in buf) buf[k] = -9; sfx('hit'); }
function closePause() { paused = false; for (const k in buf) buf[k] = -9; sfx('hit'); }
function pauseExit() { if (NET.on) { paused = false; netLeave(); return; } paused = false; RS.exited = true; state = 'lose'; winT = 0; sfx('skill'); }   // 나가기: 지금까지의 기록으로 경험치를 정산 (update 에서 settleRun)
function xpGains() {   // 지금 나가면 받게 될 경험치 (settleRun 의 패배 정산과 같은 식)
  const heroes = (RAID ? RAID_HEROES : TEAM).slice(), dmgOf = h => RS.dmg[h] || 0, pool = RS.waves * 50 + RS.boss * 250 + Math.floor(heroes.reduce((t, h) => t + dmgOf(h), 0) / 30) + RS.kills, sumD = heroes.reduce((t, h) => t + dmgOf(h), 0), n = heroes.length;
  return heroes.map(h => ({ hero: h, gain: Math.round(pool * (0.3 / n + 0.7 * (sumD ? dmgOf(h) / sumD : 1 / n))) }));
}
function pauseClick(x, y) { if (inRect(x, y, PAUSE_UI.go)) closePause(); else if (inRect(x, y, PAUSE_UI.exit)) pauseExit(); }
function drawPauseButton() { for (const [r, label, col, tc] of [[PAUSE_BTN, NET.on ? '나가기' : '정지', '#9ad4ff', '#cfe8ff']]) { ctx.fillStyle = 'rgba(10,12,20,.6)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.strokeRect(r.x, r.y, r.w, r.h); text(label, r.x + r.w / 2, r.y + r.h / 2 + 7, 20, tc, 'center'); } }   // 오른쪽 위: 정지 / 나가기 (AUTO 가 있던 자리)
function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(4,6,12,.78)'; ctx.fillRect(0, 0, W, H);
  if (NET.on) {   // 온라인: 전투는 멈추지 않는다
    text('나가시겠습니까?', W / 2, 190, 54, '#ff9a8a', 'center'); text('온라인 전투는 멈추지 않습니다 — 나가면 이 전투에서 빠지고 경험치·장비를 받지 못합니다', W / 2, 240, 17, '#cfd3e6', 'center', false); text('(방장이 나가면 파티의 전투가 끝납니다)', W / 2, 270, 15, '#9aa3b8', 'center', false);
    for (const [r, label, col] of [[PAUSE_UI.go, '계속하기' + (IS_TOUCH ? '' : '  (P)'), '#7dff9a'], [PAUSE_UI.exit, '나가기', '#ff9a8a']]) { ctx.fillStyle = 'rgba(10,12,20,.92)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.strokeRect(r.x, r.y, r.w, r.h); text(label, r.x + r.w / 2, r.y + 37, 24, col, 'center'); }
    return;
  }
  text(pauseKind === 'exit' ? '나가시겠습니까?' : '일시정지', W / 2, 150, 54, pauseKind === 'exit' ? '#ff9a8a' : '#ffd34d', 'center');
  text('나가면 지금까지 획득한 경험치가 영웅 레벨에 한꺼번에 반영됩니다  (현재 WAVE ' + (waveIdx + 1) + ' · 처치 ' + kills + ')', W / 2, 196, 17, '#cfd3e6', 'center', false);
  const g = xpGains(); text('지금 나가면 받는 경험치', W / 2, 250, 20, '#ffe9a0', 'center');
  g.forEach((r, i) => { const y = 292 + i * 44, rec = ACC ? heroRec(ACC, r.hero) : { lv: 1, xp: 0 }; ctx.fillStyle = 'rgba(12,14,24,.9)'; ctx.fillRect(W / 2 - 260, y - 26, 520, 38); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.strokeRect(W / 2 - 260, y - 26, 520, 38); text(PC_NAME[r.hero], W / 2 - 240, y, 18, '#fff', 'left'); text('Lv ' + rec.lv, W / 2 - 120, y, 16, '#9ad4ff', 'left'); text('+' + r.gain + ' XP', W / 2 + 240, y, 18, '#9dff9d', 'right'); });
  const bt = (r, label, col) => { ctx.fillStyle = 'rgba(10,12,20,.92)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.strokeRect(r.x, r.y, r.w, r.h); text(label, r.x + r.w / 2, r.y + 37, 24, col, 'center'); };
  bt(PAUSE_UI.go, '계속하기' + (IS_TOUCH ? '' : '  (P)'), '#7dff9a'); bt(PAUSE_UI.exit, '나가기 · 경험치 정산', '#ff9a8a');
}
function toggleAuto() { auto = !auto; if (TUT && auto) tutEvent('auto'); if (NET.on && NET.role === 'guest') netSend({ k: NET.raid ? 'rauto' : 'auto', on: auto }); }   // 온라인 게스트는 방장에게 자동 전투 여부를 알림
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
  if (speedTap(x, y)) return;   // 전투 속도 버튼
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

