'use strict';
// ---------- 월드 배경 (사전 렌더) ----------
const bg = document.createElement('canvas'); bg.width = WORLD.w; bg.height = WORLD.h;
(function buildBG() {
  const g = bg.getContext('2d'); let s = 12345; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.fillStyle = COLORS.field; g.fillRect(0, 0, WORLD.w, WORLD.h);
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
    info: [['J', '공격', '찌르기 · 베기 · 360° 회전 베기'], ['K', '하마 전환', '적토마에서 내려 하마 여포로 전환 + 360° 베기 1회 · 스킬2 쿨타임은 폼별'], ['L', '돌격', '전방 질주 1회 + 폭발 (쿨타임 7초)'], [';', '적토 돌격', '3연속 질주 · 무적 · 기절 · 후 공격 +30%']],
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
  info: [['J', '공격', '1단 찌르기 · 2~3단 좌우 베기'], ['K', '상마 전환', '적토마에 올라 상마 여포로 전환 + 360° 베기 1회 · 스킬2 쿨타임은 폼별'], ['L', '연사', '3연속 관통 화살 일제 사격'], [';', '천하무쌍', '방천화극 360° 휘두르기 + 검기 연타 · 기절 · 후 공격 +20%']] };
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
const DASH_CD_PVE = 2.5, DASH_INV_PVE = 0.42, DASH_DIST_PVE = 1.3;   // 회피(모든 모드 공통, PC·AI 동일): 쿨타임 2.5초 · 무적 0.42초 · 이동 거리 x1.3 (약 272px)
const dashCdNow = () => DASH_CD_PVE, dashInvNow = () => DASH_INV_PVE, dashSpeedNow = () => 950 * DASH_DIST_PVE;
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
const bossChainP = e => e.d.mb ? MB.chain[mbStage(e)] : e.d.zhao ? ZB.chain[zStage(e)] : e.d.dian ? DB.chain[dStage(e)] : e.d.foot ? (e.phase2 ? 0.45 : 0.30) : bossTab(e).chain[bossStage(e)];
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
const FOE_BOSS_DIAN = { name: '전위 악래', short: '전위', foot: true, dian: true, speed: 140, r: 44, body: '#8a3a22', trim: '#d4a73a', skin: '#c98a6a', helm: false, beard: true, wrap: true, pauldrons: true, cape: '#5a2418', feathers: false, weapon: 'twin', barding: '#5a2418', auraCol: '#ff7a4a', fxCol: '#ffd9a0', p2msg: '전위의 광기가 폭발했다!  2페이즈' };
const DIAN_HP_SCALE = 3.5, DIAN_DMGMUL = 0.8;   // 레이드 보스 전위: 체력 배율 / 피해 배율 (여포 봉선보다 낮음)
TYPES.dianBoss = { ...TYPES.boss, ...FOE_BOSS_DIAN, hpScale: DIAN_HP_SCALE };   // 레이드 보스 전위 악래: 도보, 쌍철극 · 투척 · 지축 강타 · 불사의 광기
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
