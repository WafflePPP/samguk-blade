'use strict';
// ---------- 플레이테스트 계측: 판 결과 로그 + 결과 복사 (기획/명세/01) ----------
// 판이 끝나는 단일 진입점(90-draw-units.js update())에서 recordRun() 이 한 번 불린다. 저장은 별도 키(sgb_runlog_v1), 최근 200판.
// 개인정보(계정 이름·방 코드·서버 주소·상대 이름)는 기록·복사하지 않는다. 최상위에서는 상수만 만들고 게임 전역은 함수 안에서만 쓴다.
const RUNLOG_KEY = 'sgb_runlog_v1', RUNLOG_MAX = 200, RUNLOG_RECENT = 20;
const OVERLAY_COPY = { x: W / 2 + 262, y: 509, w: 160, h: 30 }, LOBBY_COPY = { x: W - 190, y: 70, w: 176, h: 30 };
const RL = { pending: null, msgT: 0, msgFor: '', pop: null };   // pending: 'last'|'recent' (pointerup 에서 복사), msgT: "복사됨!" 표시 시작 시각

function runLogLoad() { try { const a = JSON.parse(localStorage.getItem(RUNLOG_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } }
function runLogSave(a) { try { localStorage.setItem(RUNLOG_KEY, JSON.stringify(a)); } catch (_) { } }   // 쓰기 실패는 조용히 무시

function runPicks() {
  const sum = {}, order = [];
  for (const p of RUN.picks) { sum[p.id] = (sum[p.id] || 0) + p.val; order.push(p.id + ':' + p.rar); }
  return { sum, order };
}
function runCause(res) {
  if (res !== 'lose') return '';
  const l = RS.last;
  if (mode === 'duel') return l && l.hero && HEROES[l.hero] ? HEROES[l.hero].short : '시간종료';
  if (!l || !l.type) return '기타';
  const t = TYPES[l.type];
  return ((t && (t.short || (t.name || '').replace(/^적 /, ''))) || l.type) + (l.boss ? '(보스)' : '');
}
function recordRun(st) {
  if (RS.logged) return; RS.logged = true;
  try {
    const rogue = mode === 'yeonui' && !RAID, raid = !!RAID, onl = !!NET.on;
    const res = st === 'win' ? 'win' : RS.exited ? 'exit' : (mode === 'duel' && duel && duel.title === 'DRAW') ? 'draw' : 'lose';
    const r = { ver: GAME_VER, t: new Date().toISOString().slice(0, 16), mode: rogue ? 'rogue' : raid ? 'raid' : 'duel', auto: RS.usedAuto ? 1 : 0, result: res };
    if (raid) { r.boss = raidBossId; r.groggy = RS.groggy || 0; }
    r.online = onl ? { role: NET.role, n: raid ? (NET.pl ? NET.pl.length : 1) : 2 } : 0;
    r.heroes = rogue ? TEAM.slice() : raid ? (onl && NET.pl ? NET.pl.map(p => p.hero) : RAID_HEROES.slice()) : (duel && duel.order ? duel.order.slice() : (duelLast || []).slice());
    r.main = onl && raid && NET.myHero ? NET.myHero : (HERO && HERO.pc) || r.heroes[0];
    if (rogue) r.wave = { reach: waveIdx + 1, start: lastStartWave + 1, clear: RS.waves };
    else if (raid) { const b = enemies.find(e => e.boss && e.d && e.d.raid); if (b) r.wave = { stage: raidStage(b) + 1 }; }
    r.time = Math.round((mode === 'duel' && duel ? Math.max(0, DUEL_TIME - duel.t) : clock) * 10) / 10;
    r.speed = onl ? 1 : gameSpeed();
    if (mode !== 'duel') { r.kills = RS.kills; r.bossKills = RS.boss; }
    r.dmg = {}; for (const k in RS.dmg) r.dmg[k] = Math.round(RS.dmg[k]);
    r.cause = runCause(res);
    if (rogue) r.picks = runPicks();
    if (mode === 'duel' && duel) r.foe = { heroes: (duel.foes || []).map(f => f.hero), end: NET.aborted ? 'abort' : /시간 종료/.test(duel.sub || '') ? 'time' : 'wipe' };
    const a = runLogLoad(); a.push(r); while (a.length > RUNLOG_MAX) a.shift(); runLogSave(a);
  } catch (e) { try { errLog('runlog', e && e.message, '94-runlog.js', 0, 0, e && e.stack); } catch (_) { } }
}

const hn = id => (HEROES[id] && HEROES[id].short) || id;
const fmtT = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
function runLine(r) {
  const f = [r.t.replace('T', ' ')], res = { win: '승', lose: '패', exit: '나가기', draw: '무' }[r.result] || r.result;
  const onl = r.online ? '온라인(' + (r.online.role === 'host' ? '방장' : '게스트') + ' ' + r.online.n + '인)' : '오프라인', auto = r.auto ? 'AUTO있음' : 'AUTO없음';
  if (r.mode === 'rogue') {
    f.push('로그라이크', r.heroes.map(hn).join('·'), 'W' + r.wave.reach + ' 도달(시작 W' + r.wave.start + ')', fmtT(r.time), res);
    if (r.cause) f.push('사망:' + r.cause);
    if (r.picks) { const s = Object.keys(r.picks.sum).map(k => UPG[k] ? UPG[k].n + UPG[k].f(r.picks.sum[k]) : k).join(' '); f.push('강화: ' + (s || '없음')); }
    f.push('처치 ' + r.kills, auto, onl);
  } else if (r.mode === 'raid') {
    f.push('레이드 ' + (TYPES[r.boss] ? TYPES[r.boss].short : r.boss), r.heroes.map(hn).join('·'));
    if (r.wave) f.push('단계' + r.wave.stage);
    f.push(fmtT(r.time), res); if (r.cause) f.push('사망:' + r.cause);
    if (r.groggy != null) f.push('그로기 ' + r.groggy + '회');
    f.push('처치 ' + r.kills, '피해 ' + Object.keys(r.dmg).map(k => hn(k) + ' ' + r.dmg[k]).join(' '), auto, onl);
  } else {
    f.push('비무장', r.heroes.map(hn).join('·') + ' vs ' + ((r.foe && r.foe.heroes) || []).map(hn).join('·'), res + (r.foe && r.foe.end === 'time' ? '(시간종료)' : r.foe && r.foe.end === 'abort' ? '(상대 이탈)' : ''), fmtT(r.time));
    if (r.cause) f.push('마지막 피격:' + r.cause);
    f.push(auto, onl);
  }
  return f.join(' | ');
}
function runText(n) {
  const a = runLogLoad().slice(-n);
  return '[맹장전 기록 v' + GAME_VER + '] ' + a.length + '판 (시각 UTC)\n' + a.map(runLine).join('\n');
}

function runCopyPopup(txt) {   // 클립보드가 막힌 환경: 직접 선택·복사할 수 있는 텍스트 창
  try {
    if (RL.pop) RL.pop.remove();
    const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:5%;top:8%;width:90%;max-width:640px;background:#10121c;border:2px solid #ffd34d;padding:10px;z-index:99999;color:#fff;font:14px sans-serif;border-radius:6px';
    const m = document.createElement('div'); m.textContent = '자동 복사가 안 됩니다 — 아래 글을 길게 눌러 직접 복사해 주세요'; m.style.marginBottom = '6px';
    const ta = document.createElement('textarea'); ta.value = txt; ta.readOnly = true; ta.style.cssText = 'width:100%;height:240px;box-sizing:border-box;background:#fff;color:#000;font:12px monospace';
    const b = document.createElement('button'); b.textContent = '닫기'; b.style.cssText = 'margin-top:6px;padding:8px 24px;font-size:15px'; b.onclick = () => { d.remove(); RL.pop = null; };
    d.append(m, ta, b); document.body.appendChild(d); RL.pop = d; ta.focus(); ta.select();
  } catch (_) { }
}
function runCopy(kind) {   // 반드시 사용자 입력(pointerup) 안에서 호출
  const txt = runText(kind === 'last' ? 1 : RUNLOG_RECENT), done = () => { RL.msgT = Date.now(); RL.msgFor = kind; };
  const fallback = () => { let ok = false; try { const ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (_) { } if (ok) done(); else runCopyPopup(txt); };
  try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fallback); else fallback(); } catch (_) { fallback(); }
}
window.addEventListener('pointerup', () => { if (RL.pending) { const k = RL.pending; RL.pending = null; runCopy(k); } });   // 터치는 pointerup 이 사용자 동작으로 인정된다 (05-diag.js 와 같은 방식)

function drawCopyBtn(b, label, kind) {
  const on = Date.now() - RL.msgT < 1500 && RL.msgFor === kind;
  ctx.fillStyle = 'rgba(10,12,20,.85)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = on ? '#7dff9a' : '#9ad4ff'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h);
  text(on ? '복사됨!' : label, b.x + b.w / 2, b.y + b.h / 2 + 7, kind === 'last' ? 20 : 15, on ? '#7dff9a' : '#9ad4ff', 'center');
}
