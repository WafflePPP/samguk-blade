'use strict';
// 팔레트 상수 (아트 요청 01 · 아트방향.md §2). 값은 6자리 '#rrggbb' 문자열 유지 — drawHUD 의 `col + '4d'` 같은 알파 이어붙이기가 있다.
// 영웅 고유색(HEROES.style/ult)·전투 이펙트색은 UI 팔레트가 아니므로 여기에 두지 않는다. 새 색은 아트방향.md 표를 먼저 갱신한 뒤 추가한다.
// 알파가 붙은 패널색은 매 프레임 문자열을 만들지 않도록 상수 문자열로 둔다 (읽기만 할 것).
const COLORS = Object.freeze({
  // 금: 강조 · 선택 · 확정 ("지금 중요한 것")
  gold: '#ffd34d', goldTrim: '#d4a73a', goldText: '#ffe9a0',
  // 은백: 본문 · 보조 · 비활성
  silver: '#cfd3e6', silverDim: '#aab3c8', silverOff: '#8a90a6',
  // 주홍: 장식 / 경고·위험 글자
  danger: '#c9302c', dangerText: '#ff6a5a',
  // 하늘청: 아군 · 비무장 · 희귀 등급. foe: 비무장 적군 팀색 (요청 03)
  ally: '#4fb0ff', foe: '#ff5a4a',
  // 회복·성공 (goodAlt 는 2단계에서 good 으로 통합 예정 — 1단계에서는 별도 유지)
  good: '#7dff9a', goodAlt: '#9dff9d',
  // 영웅 등급(보라)
  epic: '#c77dff',
  // 먹 · 외곽선
  ink: '#0a0c14', inkViolet: '#1a1228', outline: '#0c0814',
  // 로그인 노을 하늘 · 달
  duskTop: '#080b24', duskMid: '#2b1a42', duskLow: '#8c3a48', duskGlow: '#e58a4a', moon: '#f6edcf',
  // 전장 바닥
  field: '#7a6a47',
  // 알파 패널 (숫자 = 알파 .NN)
  panel90: 'rgba(10,12,20,.9)', panel92: 'rgba(10,12,20,.92)', panel85: 'rgba(10,12,20,.85)', panel60: 'rgba(10,12,20,.6)', panel50: 'rgba(10,12,20,.5)',
  panelHi92: 'rgba(30,24,44,.92)', panelHi90: 'rgba(30,24,44,.9)', panelModal: 'rgba(14,10,26,.97)',
  goldGlow55: 'rgba(255,211,77,.55)',
});
