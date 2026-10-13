'use strict';
// ===================================================================
// 온라인 레이드 (협동 · 방장 1 + 참가자 최대 2, 각자 장수 1명만 조작)
//  - 방장(host)이 레이드 전투 전체(보스·부하·모든 PC)를 계산한다. 모든 파티원은 '파이터' PC 이고, 각자 자기 영웅 1명을 입력으로 조작한다 (조작 영웅 변경·태그 없음).
//  - 참가자(guest)는 입력만 보내고, 방장이 20회/초로 보내는 상태(PC·보스·부하·투사체·이펙트)를 약 0.1초 늦춰 보간해서 그린다.
//  - 레벨·장비는 각자의 계정 값을 방장에게 보내 적용한다 (같은 영웅은 파티에서 중복 선택 불가). 경험치·장비는 각자 자기 계정에 저장된다.
//  - 보스 체력은 파티 인원에 맞춰 조정한다 (1명 x0.5 · 2명 x0.75 · 3명 x1.0).
// ===================================================================
const ONL_HP = [0, 0.5, 0.75, 1];
Object.assign(NET, { myReady: false, peerReady: false, rr: false, slot: 0, rp: [null, null, null], me: null, fl: [], emap: new Map(), eFull: {}, eLast: {}, enid: 0, inps: [null, null, null], autoS: [false, false, false], eqf: null, raid: false, myHero: null, abortMsg: '', pl: [] });
const netMyEq = id => { const o = equipRaw(id); return { hp: Math.round(o.hp), atk: +o.atk.toFixed(1), def: +o.def.toFixed(1) }; };
function netRaidEntry0() { const h = duelPick[0] || null; return { hero: h, lv: h ? (netMyLv()[h] || 1) : 1, eq: h ? netMyEq(h) : null, rd: !!(h && NET.myReady) }; }   // 내 선택
const netRaidView = () => { const v = NET.rp.slice(); if (NET.role === 'host' || !NET.ws) v[0] = netRaidEntry0(); else if (NET.slot > 0 && NET.paired) v[NET.slot] = netRaidEntry0(); return v; };   // 슬롯 0~2 의 파티원 (방장 · 참가자 1 · 참가자 2)
const mySlot = () => NET.role === 'guest' ? NET.slot : 0;
const netRaidTaken = id => netRaidView().some((e, s) => e && e.hero === id && s !== mySlot());
const netRaidCount = () => netRaidView().filter(Boolean).length;
const netRaidReadyN = () => netRaidView().filter((e, s) => e && s > 0 && e.rd).length, netRaidGuestN = () => netRaidView().filter((e, s) => e && s > 0).length;
const netRaidCanStart = () => NET.role === 'host' && !!NET.ws && NET.open && !!NET.code && netRaidView().every((e, s) => !e || (e.hero && (s === 0 || (e.rd && e.v === NET_VER))));   // 방장은 장수를 골랐고 모든 참가자가 준비해야 시작
function netRaidBroadcast() { if (NET.role === 'host' && NET.ws && NET.paired) netSend({ k: 'rparty', boss: raidBossId, list: netRaidView(), hv: NET_VER }); }
function netRaidSendMine() { const e = netRaidEntry0(); netSend({ k: 'rteam', hero: e.hero, lv: e.lv, eq: e.eq, rd: e.rd, v: NET_VER }); }
function netRaidMine() { if (!NET.ws) return; if (NET.role === 'host') netRaidBroadcast(); else if (NET.paired) netRaidSendMine(); }   // 내 선택이 바뀜
function netRaidPaired(m) {
  if (NET.role === 'host') { NET.paired = true; NET.rp[m.slot] = { hero: null, lv: 1, eq: null }; NET.status = '참가자가 입장했습니다 — 파티 ' + m.n + '명'; netRaidBroadcast(); }
  else { NET.paired = true; NET.slot = m.slot; NET.status = '방에 입장했습니다 (참가자 ' + m.slot + ') — 장수를 고르세요'; netRaidSendMine(); }
}
function netRaidLeft(m) {
  if (NET.role === 'host') {
    NET.rp[m.slot] = null; NET.paired = NET.rp.some(Boolean);
    if (NET.inMatch) { const f = allies.find(a => a.slot === m.slot); if (f) { f.human = false; f.inp = null; dmgText(f.x, f.y - 100, '연결 끊김 (AI)', '#ff9a8a', 20); } }
    else { NET.status = '참가자가 나갔습니다 — 파티 ' + netRaidCount() + '명'; netRaidBroadcast(); }
  } else {   // 방장이 방을 닫음
    if (NET.inMatch) { netMatchAbort('방장이 나갔습니다'); if (NET.ws) { try { NET.ws.onclose = null; NET.ws.close(); } catch (_) { } } NET.ws = null; NET.open = false; NET.paired = false; clearInterval(NET.hb); }
    else { NET.status = '방장이 방을 닫았습니다'; netClose(); }
  }
}
function netRaidData(d, from) {
  if (d.k === 'rteam' && NET.role === 'host' && from) {
    const h = HEROES[d.hero] && d.hero !== 'lubu2' ? d.hero : null, taken = h && netRaidView().some((e, s) => e && e.hero === h && s !== from), cl = (v, m) => Math.max(0, Math.min(m, +v || 0)), e = d.eq && typeof d.eq === 'object' ? { hp: cl(d.eq.hp, 400), atk: cl(d.eq.atk, 40), def: cl(d.eq.def, 30) } : null;
    if (d.v !== NET_VER) NET.status = '참가자의 게임 버전이 다릅니다 — 그 참가자가 페이지를 새로고침하거나 앱을 업데이트해야 합니다';
    NET.rp[from] = { v: d.v, hero: taken ? null : h, rd: !!d.rd && !!h && !taken, lv: Math.max(1, Math.min(MAX_LV, d.lv | 0 || 1)), eq: e }; netRaidBroadcast();
  }
  else if (d.k === 'rparty' && NET.role === 'guest' && (!NET.inMatch || state === 'win' || state === 'lose')) {
    NET.rp = Array.isArray(d.list) ? d.list.slice(0, 3).map(e => e && typeof e === 'object' ? e : null) : [null, null, null];
    if (d.boss && RAID_CFG[d.boss]) raidBossId = d.boss;
    if (d.hv !== NET_VER) NET.status = '방장의 게임 버전이 다릅니다 — 페이지를 새로고침하거나 앱을 최신으로 업데이트하세요';
    const c = duelPick[0]; if (c && NET.rp.some((e, s) => e && s !== NET.slot && e.hero === c)) { duelPick.length = 0; NET.myReady = false; NET.status = '같은 장수를 먼저 고른 파티원이 있습니다 — 다른 장수를 고르세요'; }
  }
  else if (d.k === 'rstart' && NET.role === 'guest' && (!NET.inMatch || state === 'win' || state === 'lose')) netBeginRaidGuest(d);
  else if (d.k === 'rin' && NET.role === 'host' && NET.inMatch && from && NET.inps[from]) { const i = NET.inps[from]; i.mx = d.mx || 0; i.my = d.my || 0; i.h = !!d.h; for (const n of (d.b || [])) if (n in i.b) i.b[n] = T; }
  else if (d.k === 'rauto' && NET.role === 'host' && from) NET.autoS[from] = !!d.on;
  else if (d.k === 'rsnap' && NET.role === 'guest' && NET.inMatch) {
    d.f = d.f.map((dl, i) => { const F = NET.full[i] || (NET.full[i] = {}), C = NET.acts[i] || (NET.acts[i] = {}); Object.assign(F, dl); if (dl.act && dl.act.def) { C[dl.act.id] = { def: dl.act.def, ev: dl.act.ev }; delete C[dl.act.id - 4]; } return Object.assign({}, F); });
    d.e = d.e.map(dl => { const F = NET.eFull[dl.i] || (NET.eFull[dl.i] = {}); Object.assign(F, dl); return Object.assign({}, F); });
    const live = new Set(d.e.map(q => q.i)); for (const k in NET.eFull) if (!live.has(+k)) delete NET.eFull[k];
    NET.snaps.push({ rt: performance.now(), d }); while (NET.snaps.length > 12) NET.snaps.shift(); if (d.st && d.st !== 'play') NET.lastEnd = d;
  }
}
// ---- 시작 ----
function netRaidStartHost() {
  if (NET.role !== 'host') return;
  if (!netRaidCanStart()) { NET.status = !NET.code ? '먼저 방을 만드세요' : !netRaidView()[0].hero ? '먼저 내 장수를 고르세요' : netRaidView().some(e => e && !e.hero) ? '모든 파티원이 장수를 골라야 합니다' : '모든 참가자가 준비해야 시작할 수 있습니다'; sfx('hit'); return; }
  const pl = []; netRaidView().forEach((e, s) => { if (e && e.hero) pl.push({ s, hero: e.hero, lv: e.lv, eq: e.eq }); });
  netRaw({ t: 'lock', on: true }); netSend({ k: 'rstart', boss: raidBossId, pl }); netBeginRaidHost(pl);
}
function netRaidSetup(pl) {
  NET.raid = true; NET.on = true; NET.inMatch = true; NET.pl = pl; NET.myHero = (pl.find(p => p.s === NET.slot) || pl[0]).hero;
  NET.lv = {}; NET.eqf = {}; for (const p of pl) { NET.lv[p.hero] = p.lv || 1; NET.eqf[p.hero] = p.eq || { hp: 0, atk: 0, def: 0 }; }
  selHero = NET.myHero; netResetWorld(true); applyHero(); P.dead = true; P.hp = 0;
  RAID_HEROES = pl.map(p => p.hero); TEAM = [RAID_HEROES[0]]; RD.order = RAID_HEROES.slice(); duel = null; TUT = null;
  const pos = [[0, 100], [-130, 170], [130, 170]];
  allies = pl.map((p, i) => { const f = makeFighter(p.hero, 'ally', WORLD.w / 2 + pos[i][0], WORLD.h / 2 + pos[i][1]); f.slot = p.s; f.face = -Math.PI / 2; f.human = true; return f; });
  NET.fl = allies; NET.me = allies.find(f => f.slot === NET.slot) || allies[0]; NET.mine = [NET.me]; NET.theirs = []; enemies = [];
  { const cfg = RAID_CFG[raidBossId] || RAID_CFG.raidBoss; TYPES[raidBossId].hpScale = cfg.hp * ONL_HP[Math.min(3, pl.length)]; RAID_WAVE.spawn = [[raidBossId, 1]]; RAID_WAVE.dmgMul = cfg.dmg; RAID_WAVE.name = 'RAID — ' + cfg.name; }
  state = 'play'; cam.x = NET.me.x - W / 2; cam.y = NET.me.y - H / 2; netSyncP();
}
function netBeginRaidHost(pl) {
  NET.role = 'host'; NET.slot = 0; netRaidSetup(pl);
  NET.inpH = netNewInp(); NET.inps[0] = NET.inpH; for (const p of pl) if (p.s > 0) NET.inps[p.s] = netNewInp();
  for (const f of allies) f.inp = NET.inps[f.slot];
  beginWave(0);
}
function netBeginRaidGuest(d) {
  if (!Array.isArray(d.pl) || !d.pl.length) return;
  if (d.boss && RAID_CFG[d.boss]) raidBossId = d.boss;
  NET.role = 'guest'; netRaidSetup(d.pl.filter(p => HEROES[p.hero]).slice(0, 3));
}
function netRaidBackToRoom() {   // 결과 화면 -> 대기실 (같은 방에서 다시 시작)
  NET.on = false; NET.inMatch = false; NET.raid = false; NET.eqf = null; NET.lv = null; NET.abortMsg = ''; paused = false; NET.myReady = false; NET.rp = NET.rp.map(e => e ? { ...e, rd: false } : e);
  netResetWorld(); P.dead = false; P.hp = P.maxhp; allies = []; enemies = []; duel = null; mode = 'yeonui'; applyGrowth('yeonui'); RAID = false; pickFor = 'raid'; pickOnline = true; pickFocus = null; duelPick = NET.myHero ? [NET.myHero] : []; state = 'pick';
  if (NET.ws && NET.open) { if (NET.role === 'host') { netRaw({ t: 'lock', on: false }); netRaidBroadcast(); } else netRaidSendMine(); }
  else NET.status = '연결이 끊어졌습니다 — 다시 방을 만들거나 참가하세요';
}
// ---- 방장: 매 프레임 끝에서 상태 전송 ----
const NET_CUR_KEYS = ['kind', 'windup', 'r', 'half', 'len', 'w', 'off', 'n', 'step', 'color', 'tx', 'ty', 'quakeR', 'ult', 'heavy', 'wave', 'rage', 'recover'];
function netCurOut(c) { const o = {}; for (const k of NET_CUR_KEYS) { const v = c[k]; if (typeof v === 'number') o[k] = nq(v); else if (typeof v === 'boolean' || typeof v === 'string') o[k] = v; } if (Array.isArray(c.shifts)) o.shifts = c.shifts.map(nq); return o; }
function netEnemyFull(e) {
  const sw = e.swing, c = e.cur;
  return { ty: e.type, x: r1(e.x), y: r1(e.y), fc: r2(e.face), hp: Math.round(e.hp), mh: Math.round(e.maxhp), st: e.state, t: r2(e.t), mt: e.mounted ? 1 : 0, lf: Math.round(e.lift || 0), fl: e.flash > 0 ? 1 : 0, ar: e.armor ? 1 : 0, sp: e.spawnT > 0 ? r1(e.spawnT) : 0, wk: r1(e.walk), r: e.r, p2: e.phase2 ? 1 : 0, rg: q4(e.rageT || 0), ft: q4(e.floorT || 0), sl: q4(e.slowT || 0), sg: e.stage || 0, ln: e.lean || 1, dn: e.drN || 0, dT: q4(e.drT || 0), dB: q4(e.drBusy || 0), ut: e.ultT != null ? r2(e.ultT) : -1, sw: sw ? [r2(sw.t), r2(sw.half), Math.round(sw.r)] : 0,
    cu: c && (e.state === 'wind' || (e.boss && (e.state === 'pause' || e.state === 'recover' || e.state === 'dash'))) ? JSON.stringify(netCurOut(c)) : 0 };
}
function netEnemyDelta(e) { const full = netEnemyFull(e), prev = NET.eLast[e.nid] || {}, d = { i: e.nid }; for (const k in full) if (full[k] !== prev[k]) d[k] = full[k]; NET.eLast[e.nid] = full; return d; }
function netRaidHostPost(rdt) {
  netSyncP();
  NET.sendT -= rdt; if (NET.sendT > 0 && state === NET.lastSt) return; NET.sendT = 0.05; NET.lastSt = state;
  if (!NET.paired) { NET.sfxQ.length = 0; return; }   // 혼자일 때는 보낼 곳이 없다
  const o = { k: 'rsnap', f: allies.map(netFighterDelta), e: [], pr: [], fx: [], dt: [], sx: [], it: [], sh: r1(shake), fl: r2(flashT), st: state, ck: r1(clock), kl: kills, bn: r2(bannerT), rt: r2(reinforceT), rm: reinforceT > 0 ? reinforceMsg : '', hm: allies.map(f => f.human ? 1 : 0) };
  const alive = new Set(); for (const e of enemies) { if (e.dead) continue; if (!e.nid) e.nid = ++NET.enid; alive.add(e.nid); o.e.push(netEnemyDelta(e)); }
  for (const k in NET.eLast) if (!alive.has(+k)) delete NET.eLast[k];
  for (const p of projectiles) if (o.pr.length < 40) o.pr.push({ x: r1(p.x), y: r1(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy), r: p.r, arrow: !!p.arrow, blade: !!p.blade, big: !!p.big, crystal: !!p.crystal, wave: !!p.wave, blue: !!p.blue, life: r2(p.life) });
  let nsp = 0, nfx = 0; for (const e of fx) if (!NET.fxSeen.has(e)) { NET.fxSeen.add(e); if (e.k === 'spark') { if (nsp++ >= 6) continue; } else if (nfx++ >= 40) continue; o.fx.push(netEv(e)); }
  for (const e of dts) if (!NET.dtSeen.has(e)) { NET.dtSeen.add(e); if (o.dt.length < 16) o.dt.push(netEv(e)); }
  for (const it of items) if (o.it.length < 8) o.it.push([it.kind === 'bun' ? 0 : 1, Math.round(it.x), Math.round(it.y), r1(it.life)]);
  if (state !== 'play') o.rs = { d: RS.dmg, b: RS.boss, k: RS.kills };
  o.sx = NET.sfxQ.splice(0).filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);
  netSend(o);
}
// ---- 참가자: 받은 스냅샷을 약 0.1초 늦춰 보간해서 반영 ----
function netGuestEnemies(A, B, u, el) {
  const d = A.d, list = [], seen = new Set();
  for (const s of d.e) {
    let o = NET.emap.get(s.i); if (!o) { o = makeEnemy(s.ty, s.x, s.y); o.nid = s.i; NET.emap.set(s.i, o); }
    seen.add(s.i);
    const s2 = B ? B.d.e.find(q => q.i === s.i) : null;
    o.hp = s.hp; o.maxhp = s.mh; o.state = s.st; o.mounted = !!s.mt; o.lift = s.lf; o.flash = s.fl ? 0.1 : 0; o.armor = !!s.ar; o.spawnT = s.sp; o.walk = s.wk; o.r = s.r; o.phase2 = !!s.p2; o.rageT = s.rg; o.floorT = s.ft; o.slowT = s.sl; o.stage = s.sg; o.lean = s.ln; o.drN = s.dn; o.drT = s.dT; o.drBusy = s.dB; o.ultT = s.ut >= 0 ? s.ut + el : null; o.dead = false;
    o.swing = s.sw ? { t: s.sw[0] + el, half: s.sw[1], r: s.sw[2] } : null;
    o.t = s.st === 'stun' || s.st === 'hit' ? Math.max(0, s.t - el) : s.t + el;
    if (o._cs !== s.cu) { o._cs = s.cu; o.cur = s.cu ? JSON.parse(s.cu) : null; }
    if (s2) { o.x = s.x + (s2.x - s.x) * u; o.y = s.y + (s2.y - s.y) * u; o.face = s.fc + (((s2.fc - s.fc + Math.PI) % TAU + TAU) % TAU - Math.PI) * u; } else { o.x = s.x; o.y = s.y; o.face = s.fc; }
    list.push(o);
  }
  enemies = list; for (const k of [...NET.emap.keys()]) if (!seen.has(k)) NET.emap.delete(k);
}
function netRaidGuestStep(rdt) {
  const S = NET.snaps; if (!S.length) { netSyncP(); return; }
  const rt = performance.now() - 120; let ai = 0; for (let i = S.length - 1; i >= 0; i--) if (S[i].rt <= rt) { ai = i; break; }
  const A = S[ai], B = S[ai + 1] || null, u = B ? clamp((rt - A.rt) / Math.max(1, B.rt - A.rt), 0, 1) : 0, el = Math.max(0, Math.min(0.15, (rt - A.rt) / 1000)), d = A.d;
  allies.forEach((o, i) => {
    const s = d.f[i], s2 = B ? B.d.f[i] : null; if (!s) return;
    const keep = { team: o.team, r: o.r, fighter: true, type: 'fighter', spawnT: 0, meta: o.meta, skills: o.skills, slot: o.slot };
    Object.assign(o, s, keep); o.cd = { s1: s.cs1, s2: s.cs2 }; o.dashCd = s.dc;
    if (s2 && s2.hero === s.hero) { o.x = s.x + (s2.x - s.x) * u; o.y = s.y + (s2.y - s.y) * u; o.face = s.face + (((s2.face - s.face + Math.PI) % TAU + TAU) % TAU - Math.PI) * u; }
    else if (!s2 && ai > 0) { const pv = S[ai - 1].d.f[i], dtp = (A.rt - S[ai - 1].rt) / 1000, ex = Math.min(0.12, (rt - A.rt) / 1000); if (pv && pv.hero === s.hero && dtp > 0.005 && !s.dead) { o.x = s.x + (s.x - pv.x) / dtp * ex; o.y = s.y + (s.y - pv.y) / dtp * ex; } }
    o.act = null; if (s.act) { const c = (NET.acts[i] || {})[s.act.id]; if (c) { for (let k = 0; k < c.ev.length && k < 30; k++) c.ev[k].done = !!(s.act.dn & (1 << k)); o.act = { def: c.def, t: s.act.t + el, ev: c.ev, rx: s.act.rx, ry: s.act.ry }; } }
    o.flash = s.flash ? 0.1 : 0; o.invT = s.invT ? 0.1 : 0; o.lungeT = s.lungeT ? 0.1 : 0; o.hitT = Math.max(0, s.hitT - el); o.d = { name: DUEL_NAME[o.hero], hitRec: 0.32 };
    o.human = !!(d.hm && d.hm[i]);
  });
  netGuestEnemies(A, B, u, el);
  if (NET.lastNew !== A) {   // 새 스냅샷마다 한 번: 이펙트·소리·투사체·타이머·승패
    NET.lastNew = A;
    for (const e of d.fx) fx.push(e); for (const e of d.dt) dts.push(e); for (const n of d.sx) sfx(n);
    shake = Math.max(shake, d.sh * 0.8); flashT = Math.max(flashT, d.fl);
    projectiles = d.pr.map(p => ({ ...p })); clock = d.ck; kills = d.kl; bannerT = d.bn; reinforceT = d.rt; reinforceMsg = d.rm || reinforceMsg;
    items = d.it.map(a => ({ kind: a[0] ? 'wine' : 'bun', x: a[1], y: a[2], life: a[3], t: T }));
  }
  const ed = NET.lastEnd;
  if (ed && state === 'play' && S[S.length - 1].d.st !== 'play') { if (ed.rs) { RS.dmg = ed.rs.d || {}; RS.boss = ed.rs.b || 0; RS.kills = ed.rs.k || 0; } state = ed.st; winT = 0; }
  for (const p of projectiles) { p.x += p.vx * rdt; p.y += p.vy * rdt; }
  for (const it of items) it.t = T;
  if (state === 'play') { bannerT = Math.max(0, bannerT - rdt); reinforceT = Math.max(0, reinforceT - rdt); } else winT += rdt;
  netSyncP(); updateFx(rdt); netGuestIn(rdt);
}
// ---- 화면 ----
function drawRaidNetHUD() {   // 왼쪽: 파티원 목록 (나 = 금색 테두리)
  allies.forEach((f, i) => {
    const x = DUEL_ROW.x, y = DUEL_ROW.y + i * DUEL_ROW.step; hudRow(f, f.hero, x, y, true, false);
    if (f === NET.me) { ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2.5; ctx.strokeRect(x, y, 200, 38); }
    text(f === NET.me ? '나' : !f.human ? 'AI' : f.slot === 0 ? '방장' : '참가자' + f.slot, x + 194, y + 12, 10, f === NET.me ? '#ffd34d' : '#9ad4ff', 'right');
  });
  text('온라인 레이드 · 파티 ' + allies.length + '명 · 각자 1명 조작', 10, 10 + allies.length * 42 + 8, 11, '#cfd3e6', 'left', false);
}
function drawRaidSlots() {   // 장수 선택 화면 아래: 파티 슬롯 (방장 · 참가자 1 · 참가자 2)
  const view = netRaidView();
  for (let i = 0; i < 3; i++) {
    const r = PK.slot(i), e = view[i], mine = mySlot() === i, lab = i === 0 ? '방장' : '참가자 ' + i;
    ctx.fillStyle = e ? 'rgba(30,24,44,.92)' : 'rgba(255,255,255,.04)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = e ? (mine ? '#ffd34d' : '#4fb0ff') : 'rgba(255,255,255,.25)'; ctx.lineWidth = e ? 2.5 : 1.5; if (!e) ctx.setLineDash([6, 5]); ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]);
    text(lab + (mine ? ' (나)' : ''), r.x + 10, r.y + 20, 12, mine ? '#ffd34d' : '#9ad4ff', 'left');
    if (e && i > 0 && e.v !== undefined && e.v !== NET_VER) text('버전 다름', r.x + r.w - 10, r.y + 20, 12, '#ff7a7a', 'right');
    else if (e && i > 0) text(e.rd ? '준비 완료' : '대기 중', r.x + r.w - 10, r.y + 20, 12, e.rd ? '#7dff9a' : '#8a90a6', 'right');
    if (e && e.hero) { ctx.save(); ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + 54, 22, 0, TAU); ctx.clip(); ctx.translate(r.x + r.w / 2, r.y + 58); ctx.scale(0.75, 0.75); drawPortraitIcon(HEROES[e.hero], 0, 0); ctx.restore(); text(PC_NAME[e.hero] + '  Lv ' + e.lv, r.x + r.w / 2, r.y + 92, 13, '#fff', 'center', false); }
    else if (e) text(mine ? '장수를 선택하세요' : '장수 선택 중...', r.x + r.w / 2, r.y + 62, 13, mine ? '#ffe9a0' : '#8a90a6', 'center', false);
    else text(i === 0 ? '장수를 고르세요' : NET.code ? '대기 중' : '—', r.x + r.w / 2, r.y + 62, 13, 'rgba(255,255,255,.35)', 'center', false);
  }
}
function drawPickRaidOnline() {   // 아래 가운데: 서버 · 방 만들기 · 방 참가 / 방 코드·상태 / 파티·보스
  const L = PK.on, busy = !!NET.ws, none = false;
  const bx = (r, label, col, dis, sz) => { ctx.globalAlpha = dis ? 0.45 : 1; ctx.fillStyle = 'rgba(10,12,20,.92)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(r.x, r.y, r.w, r.h); text(fitStr(label, r.w - 12, sz), r.x + r.w / 2, r.y + r.h / 2 + 5, sz, col, 'center'); ctx.globalAlpha = 1; };
  bx(L.url, '서버: ' + (NET.url ? NET.url.replace(/^wss?:\/\//, '') : '미설정 (눌러서 입력)'), '#9ad4ff', busy, 12); bx(L.create, '방 만들기', '#7dff9a', busy || none, 15); bx(L.join, '방 참가', '#4fb0ff', busy || none, 15);
  if (NET.code) { text('방 코드  ' + NET.code, 530, 662, 21, '#ffd34d', 'left'); if (NET.status) text(fitStr(NET.status, 240, 12), 706, 662, 12, '#ffe9a0', 'left', false); }
  else text(fitStr(NET.status || '방을 만들거나 친구의 방 코드로 참가하세요', 430, 13), 530, 660, 13, '#ffe9a0', 'left', false);
  text('파티 ' + netRaidCount() + ' / 3  ·  보스 ' + RAID_CFG[raidBossId].name + (NET.role === 'guest' ? ' (방장이 정함)' : ''), 530, 694, 13, '#ff9a8a', 'left');
  if (NET.role === 'guest' && NET.paired) text(NET.myReady ? '준비 완료 — 방장이 시작하기를 기다리는 중...' : '장수를 고른 뒤 오른쪽 아래 "준비"를 누르세요', 530, 714, 12, NET.myReady ? '#7dff9a' : '#ffe9a0', 'left', false);
  else if (NET.role === 'host' && NET.code) text(netRaidCanStart() ? '모든 참가자가 준비했습니다 — 레이드를 시작할 수 있습니다' : netRaidGuestN() ? '참가자 준비 ' + netRaidReadyN() + ' / ' + netRaidGuestN() + ' — 모두 준비하면 시작할 수 있습니다' : '장수를 고르면 혼자서도 시작할 수 있습니다 (참가자를 기다리는 중)', 530, 714, 12, netRaidCanStart() ? '#7dff9a' : '#cfd3e6', 'left', false);
}

