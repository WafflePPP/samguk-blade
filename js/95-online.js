'use strict';
// ===================================================================
// 온라인 대전 (비무장과 같은 규칙, 1~3 대 1~3 · 방 코드 + 중계 서버)
//  - 방장(host)이 전투를 계산한다: 양 팀 모두 '파이터'(비무장 AI 와 같은 규칙·수치·스킬)이고, 각 팀에서 사람이 조종하는 영웅 한 명은 입력이 AI 의 판단을 대신한다 (나머지는 AI, Q·초상화로 조작 변경).
//  - 게스트(guest)는 자기 입력만 보내고, 방장이 보낸 상태(스냅샷 20회/초)를 약 0.1초 늦춰 보간해서 그린다. 게스트는 전투 계산을 하지 않는다.
//  - 레벨 성장은 쓰지 않는다 (두 사람의 계정이 달라 공정하지 않으므로 기본 수치로만 대전).
// ===================================================================
Object.assign(NET, { team: ['guan'], peerTeam: [], hostTeam: [], guestTeam: [], mine: [], theirs: [], ci: [0, 0], inpH: null, inpG: null, swapT: [0, 0], retry: 0, hb: null, fold: true });
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const netNewInp = () => ({ mx: 0, my: 0, h: false, b: { attack: -9, s1: -9, s2: -9, s3: -9, dash: -9 } });
function netClose() { if (NET.ws) { try { NET.ws.onclose = null; NET.ws.close(); } catch (_) { } } NET.ws = null; NET.open = false; NET.paired = false; NET.code = ''; NET.peerTeam = []; NET.role = null; NET.rr = false; NET.rp = [null, null, null]; NET.slot = 0; NET.myReady = false; NET.peerReady = false; }
// 배포 페이지의 server.json({ url: 'wss://...' })에서 서버 주소를 받아 온다 — 서버가 바뀌어도 앱을 다시 설치할 필요 없음
const NET_CFG_URL = 'https://waffleppp.github.io/samguk-blade/server.json';
if (!NET_DEV && typeof fetch === 'function') fetch(NET_CFG_URL + '?t=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).then(j => { if (j && /^wss?:\/\//.test(j.url || '') && !NET.urlManual) NET.url = j.url; NET.cfgMsg = (j && j.msg) || ''; }).catch(() => { });
function netConnect(then, again) {
  if (!NET.url && !(again && NET.ws)) { NET.status = '서버 주소가 아직 설정되지 않았습니다 — 아래 "서버" 버튼을 눌러 주소를 입력하세요'; return; }
  const keep = NET.retry, role = NET.role, rr = NET.rr; netClose(); NET.role = role; NET.rr = rr; NET.retry = again ? keep : (/^wss:/i.test(NET.url) ? 8 : 0); NET.url = NET.url.trim(); if (!new RegExp('^wss?://', 'i').test(NET.url)) NET.url = 'ws://' + NET.url;   // 앞의 ws:// 를 빼먹어도 보정
  if (location.protocol === 'https:' && new RegExp('^ws://', 'i').test(NET.url)) { NET.status = '이 앱은 보안(https) 방식이라 ws:// 서버에 접속할 수 없습니다 — wss:// 주소를 쓰거나 LAN 테스트용 앱을 설치하세요'; return; }
  NET.status = '서버 연결 중...';
  let ws; try { ws = new WebSocket(NET.url); } catch (e) { NET.status = '서버 주소가 올바르지 않습니다'; return; }
  NET.ws = ws;
  ws.onopen = () => { NET.open = true; NET.retry = 0; NET.status = '서버에 연결됨'; if (then) then(); clearInterval(NET.hb); NET.hb = setInterval(() => netRaw({ t: 'ping' }), 20000); };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (_) { return; } netOnMsg(m); };
  ws.onclose = () => { const was = NET.open; clearInterval(NET.hb); if (!was && NET.retry > 0 && NET.ws === ws) { NET.retry--; NET.status = '서버를 깨우는 중... (무료 서버는 처음 접속에 최대 1분 걸립니다)'; setTimeout(() => { if (NET.ws === ws && !NET.open) netConnect(then, true); }, 6000); return; } NET.ws = null; NET.open = false; NET.paired = false; NET.peerTeam = []; NET.rp = [null, null, null]; NET.status = was ? '서버 연결이 끊어졌습니다' : '서버에 연결하지 못했습니다: ' + NET.url + (IS_TOUCH && /localhost|127.0.0.1/.test(NET.url) ? ' — localhost 는 이 폰 자신입니다. 서버 주소를 눌러 PC 의 IP(예: ws://192.168.1.9:8787)로 바꾸세요' : ' (같은 와이파이·서버 실행·방화벽 확인)'); if (NET.inMatch) netMatchAbort('서버 연결이 끊어졌습니다'); };
  ws.onerror = () => { };
}
const netRaw = o => { if (NET.ws && NET.open) NET.ws.send(JSON.stringify(o)); };
const netSend = d => netRaw({ t: 'r', d });
const netSendTo = (slot, d) => netRaw({ t: 'r', d, to: slot });
function netCreate() { const raid = rOn(); NET.role = 'host'; netConnect(() => netRaw(raid ? { t: 'host', max: 2, kind: 'raid' } : { t: 'host', kind: 'duel' })); NET.role = 'host'; NET.rr = raid; NET.slot = 0; }
function netJoin(code) { if (!code) return; const raid = rOn(); NET.role = 'guest'; netConnect(() => netRaw({ t: 'join', code, kind: raid ? 'raid' : 'duel' })); NET.role = 'guest'; NET.rr = raid; }
function netPromptJoin() { let c = null; try { c = window.prompt('친구에게 받은 방 코드(4글자)를 입력하세요', ''); } catch (_) { } if (c) netJoin(c.trim().toUpperCase()); }
function netPromptUrl() { let u = null; try { u = window.prompt('중계 서버 주소 (예: wss://내서버.onrender.com 또는 ws://192.168.0.5:8787)', NET.url); } catch (_) { } if (u) { NET.url = u.trim(); NET.urlManual = true; try { localStorage.setItem('sgb_net_url_manual', NET.url); } catch (_) { } } }
function netOnMsg(m) {
  if (m.t === 'pong') dbgPong();   // 디버그 표시용 왕복 지연
  else if (m.t === 'room') { NET.code = m.code; NET.status = '방 코드 ' + m.code + (NET.rr ? ' — 참가자를 기다리는 중 (최대 3명)' : ' — 상대를 기다리는 중'); }
  else if (m.t === 'err') { NET.status = m.msg; netClose(); }
  else if (m.t === 'paired') { if (m.kind && m.kind !== (NET.rr ? 'raid' : 'duel')) { NET.status = m.kind === 'raid' ? '레이드 모드 방입니다 — 레이드 > 온라인에서 참가하세요' : '비무장 모드 방입니다 — 비무장 > 온라인에서 참가하세요'; netClose(); return; } NET.peerReady = false; if (NET.rr) netRaidPaired(m); else { NET.paired = true; NET.status = '상대와 연결되었습니다'; netSendTeam(); } }
  else if (m.t === 'party') { if (NET.rr) NET.status = '파티 ' + m.n + '명 입장'; }
  else if (m.t === 'left') {
    if (NET.rr) { netRaidLeft(m); return; }
    NET.peerTeam = []; NET.paired = false;
    if (NET.inMatch) netMatchAbort('상대가 나갔습니다');
    if (NET.role === 'guest') { NET.status = '방장이 방을 닫았습니다'; netClose(); } else NET.status = '상대가 나갔습니다 — 방 코드 ' + NET.code + ' 로 다시 기다리는 중';
  }
  else if (m.t === 'm') netOnData(m.d, m.from);
}
function netOnData(d, from) {
  if (!d) return;
  if (typeof d.k === 'string' && d.k[0] === 'r') { netRaidData(d, from); return; }   // 온라인 레이드 메시지
  if (d.k === 'team') { NET.peerLv = d.lv || {}; NET.peerReady = !!d.rd; NET.peerVer = d.v; if (d.v !== NET_VER) NET.status = '상대의 게임 버전이 다릅니다 — 페이지를 새로고침하거나 앱을 최신으로 업데이트하세요'; }
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
function netSendTeam() { if (NET.paired) netSend({ k: 'team', team: NET.team, lv: netMyLv(), rd: NET.myReady, v: NET_VER }); }
function netPickToggle(id) { const k = NET.team.indexOf(id); if (k >= 0) NET.team.splice(k, 1); else if (NET.team.length < 3) NET.team.push(id); netSendTeam(); sfx('hit'); }
function netReady() { return NET.team.length >= 1 && NET.peerTeam.length >= 1 && (NET.role !== 'host' || (NET.peerReady && NET.peerVer === NET_VER)); }   // 방장은 참가자가 '준비'를 눌러야 시작할 수 있다
function netToggleReady() {   // 참가자: 준비 / 준비 취소
  if (NET.role !== 'guest' || !NET.paired || !NET.ws) return;
  if (duelPick.length < 1) { NET.status = '먼저 장수를 고르세요'; sfx('hit'); return; }
  NET.myReady = !NET.myReady; sfx(NET.myReady ? 'skill' : 'hit'); if (NET.rr) netRaidSendMine(); else netSendTeam();
}
function netStartHost() { if (NET.role !== 'host' || !NET.paired || !netReady()) return; const ht = NET.team.slice(), gt = NET.peerTeam.slice(), lv = netLvTable(ht, gt); netSend({ k: 'start', ht, gt, lv }); netBeginHost(ht, gt, lv); }
const netAuto = f => !!f.human && (NET.raid ? (f.slot === 0 ? auto : !!NET.autoS[f.slot]) : (f.team === 'ally' ? auto : NET.autoG));   // 온라인: 사람이 조종하는 영웅이 자동 전투 중인가 (방장 = 내 AUTO / 게스트 = 받은 신호)
function netResetWorld(raid) {
  BTN.find(b => b.id === 'auto').y = 375; NET.autoG = false;
  resetRun(); resetRS(); mode = raid ? 'yeonui' : 'duel'; applyGrowth(raid ? 'yeonui' : 'duel'); RAID = !!raid; NET.me = null; NET.fl = []; NET.emap = new Map(); NET.eFull = {}; NET.eLast = {}; NET.enid = 0; NET.inps = [null, null, null]; NET.autoS = [false, false, false]; LUBU_FORM = 'lubu'; resetPlayer(); P.dead = true; P.hp = 0; P.act = null;
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
const netCur = () => NET.raid ? NET.me : NET.mine[NET.ci[netSide()]] || NET.mine[0];
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
function netSwap(i) { if (NET.raid) return; if (NET.role === 'host') netSetCtl(0, i); else if (NET.mine[i] && !NET.mine[i].dead) netSend({ k: 'sw', i }); }
function netCycle() { const n = NET.mine.length, c = NET.ci[netSide()]; for (let k = 1; k < n; k++) { const i = (c + k) % n; if (NET.mine[i] && !NET.mine[i].dead) return netSwap(i); } }
function netSyncP() {   // 조작·버튼 HUD 가 쓰는 P 를 지금 조종 중인 영웅에 맞춰 둔다 (P 는 그려지지 않는 허수)
  const f = netCur(); if (!f) return;
  P.dead = true; P.x = f.x; P.y = f.y; P.face = f.face; P.hp = f.hp; P.maxhp = f.maxhp; P.rage = f.rage; P.cd.s1 = f.cd.s1; P.cd.s2 = f.cd.s2; P.cd.dash = f.dashCd;
  P.act = f.act && f.act.def.name === 'atk' ? { type: 'atk', c: f.combo } : null; P.comboT = f.comboT; P.combo = f.combo; P.hits = 0;
  if (!HERO || HERO.id !== f.hero) { HERO = HEROES[f.hero]; curHero = pcId(f.hero); applyLabels(); P.dead = true; P.hp = f.hp; P.maxhp = f.maxhp; }
}
function netLocalInp() { if (paused) return { mx: 0, my: 0, h: false, b: [] }; const m = manualMove(), b = []; for (const n of ['attack', 's1', 's2', 's3', 'dash']) if (want(n)) { use(n); b.push(n); } return { mx: m.mx, my: m.my, h: attackHeld(), b }; }
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
    guardT: q4(f.guardT), ultGuardT: q4(f.ultGuardT), runT: q4(f.runT), aspdT: q4(f.aspdT), postUltT: q4(f.postUltT), comboBuffT: q4(f.comboBuffT), blessT: q4(f.blessT), undyT: q4(f.undyT || 0), floorT: q4(f.floorT || 0), slowT: q4(f.slowT || 0), drN: f.drN || 0, drT: q4(f.drT || 0), drBusy: q4(f.drBusy || 0), lungeT: f.lungeT > 0 ? 1 : 0, combo: f.combo, comboT: q4(f.comboT), hits: f.hits };
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
    f.dashCd = dashCdNow(); f.invT = dashInvNow(); f.act = null; f.armor = false; beginAct(f, { name: 'dodge', dur: 0.26, ev: [{ t0: 0, t1: 0.22, fx: 'move', v: dashSpeedNow(), ang: dg }] }, null); sfx('dash'); runAct(f, dt); return;
  }
  if (has('s3') && f.rage >= 100) { eat('s3'); f.rage = 0; beginAct(f, sk.ult, tgt); sfx('skill'); return; }
  if (has('s2') && f.cd.s2 <= 0) { eat('s2'); f.cd.s2 = CD.s2 * (Hf.s2cdMul || 1) * (1 - f.meta.cd); beginAct(f, sk.s2, tgt); return; }
  if (has('s1') && f.cd.s1 <= 0) { eat('s1'); f.cd.s1 = CD.s1 * (Hf.s1cdMul || 1) * (1 - f.meta.cd); beginAct(f, sk.s1, tgt); return; }
  if (has('attack') || inp.h) { eat('attack'); const st = f.comboT > 0 ? (f.combo + 1) % 3 : 0; f.combo = st; f.comboT = 1.0; beginAct(f, comboDef(f.hero, st), tgt); sfx('swing'); return; }
  const sp = f.speed * (Hf.runBonus && f.runT > 0 ? Hf.runBonus : 1) * (f.slowT > 0 ? 0.55 : 1);
  if (ml > 0.2) { f.moving = true; f.x += mvx * sp * dt; f.y += mvy * sp * dt; f.walk += dt * 12 * Math.min(1, ml); }
}
function netMatchAbort(msg) {   // 상대가 나가거나 연결이 끊김: 남은 사람이 승리 처리
  if (!NET.inMatch || NET.aborted) return;
  if (NET.raid) { if (NET.role === 'host') { NET.status = '서버 연결이 끊어졌습니다 — 혼자 계속 진행합니다'; return; } NET.aborted = true; NET.abortMsg = msg; if (state === 'play') { RS.exited = true; state = 'lose'; winT = 0; } return; }   // 레이드: 방장 연결이 끊긴 게스트는 전투 종료 (방장은 혼자 계속)
  NET.aborted = true;
  if (state === 'play' && duel) { state = 'win'; winT = 0; duel.title = 'VICTORY'; duel.sub = msg + ' — 부전승'; duel.col = '#ffd34d'; duel.netFix = true; }
}
function netBackToRoom() {   // 결과 화면 -> 대기실 (연결이 살아 있으면 팀을 다시 고르고 방장이 다시 시작)
  NET.myReady = false; NET.peerReady = false; NET.on = false; NET.inMatch = false; NET.lv = null; netResetWorld(); P.dead = false; P.hp = P.maxhp; allies = []; enemies = []; duel = null; mode = 'duel'; pickFor = 'duel'; pickOnline = true; duelPick = NET.team; state = 'pick';
  if (NET.paired) netSendTeam(); else if (!NET.ws) NET.status = '연결이 끊어졌습니다 — 다시 방을 만들거나 참가하세요';
}
function netLeave() { netClose(); NET.on = false; NET.inMatch = false; NET.raid = false; NET.eqf = null; NET.lv = null; NET.status = ''; NET.abortMsg = ''; netResetWorld(); P.dead = false; allies = []; enemies = []; duel = null; paused = false; state = 'title'; }
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
  const li = netLocalInp(); if (auto && Math.hypot(li.mx, li.my) > 0.3) { auto = false; netSend({ k: NET.raid ? 'rauto' : 'auto', on: false }); }
  NET.inT -= rdt; if (!li.b.length && NET.inT > 0 && !li.h) return false; NET.inT = 0.033;
  netSend({ k: NET.raid ? 'rin' : 'in', mx: r2(li.mx), my: r2(li.my), h: li.h, b: li.b }); return true;
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

