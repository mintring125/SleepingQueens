# 슬리핑퀸즈 디지털 보드게임 개발 계획서

## 목적
슬리핑퀸즈(Sleeping Queens)를 교실 내 로컬 네트워크에서 동작하는 멀티 디바이스 디지털 보드게임으로 구현한다.

## 범위
- 포함: 테이블 태블릿 1대 + 플레이어 태블릿 2~4대, QR 기반 참가, 기본 규칙(킹/기사/드래곤/포션/마법봉/숫자카드), 승리 조건, 상태 복구
- 제외: 온라인 매칭, 계정/로그인, 결제, 원격 서버 운영

## 핵심 컨셉
- 테이블 태블릿: 중앙 보드/전체 상태 표시, 세션 생성, QR 코드 표시
- 플레이어 태블릿: 손패/행동 UI, QR 스캔으로 참가

## 기술 스택
| 구분 | 기술 |
|------|------|
| Frontend | HTML5, CSS3, JavaScript (Vanilla) |
| 실시간 통신 | WebSocket (Socket.IO) |
| Backend | Node.js + Express |
| QR 코드 | qrcode.js (생성), html5-qrcode (스캔) |
| 배포 방식 | 교실 내 로컬 서버 (인터넷 불필요) |

---

## 환경 가정
- 교실 내 동일 WiFi(모바일 핫스팟/공유기)
- 인터넷 불필요, 모든 리소스 로컬 포함
- 기기: 태블릿 기준 768px 이상, 가로 모드 권장

---

## 사용자 흐름 (MVP)
1. 교사 노트북에서 서버 실행
2. 테이블 태블릿에서 세션 생성 및 QR 표시
3. 플레이어 태블릿이 QR 스캔 → 이름 입력 → 참가
4. 최소 인원 충족 시 교사가 게임 시작
5. 각 플레이어가 자신의 턴에 행동
6. 승리 조건 충족 시 결과 표시

---

## 기능 정의 (정확히 무엇을 해야 하는지)

### 1) 세션
- `createGame`: 세션 ID 생성, 테이블 화면에 QR 표시
- `joinGame`: 플레이어 참가, 중복 이름 거부, 인원 상한 4명
- `startGame`: 인원 2~4명, 게임 초기화 후 시작

### 2) 턴/행동
- 턴 제한 30초, 미행동 시 자동 무효 처리(손패 버리기 또는 턴 스킵 중 하나를 정책으로 명시)
- 행동 종류
  - 숫자 카드 버리기: 단일/페어/수식(합 10) 허용
  - 킹: 잠자는 퀸 깨우기
  - 기사: 상대 퀸 훔치기
  - 수면포션: 상대 퀸 재우기
  - 제스터: MVP에서는 제외
- 반격
  - 기사에 드래곤
  - 포션에 마법봉

### 3) 승리 조건
- 2~3명: 5명 또는 50점
- 4명: 4명 또는 40점

---

## 데이터 모델 (서버 기준)

### GameState
- `phase`: waiting | playing | ended
- `turnPhase`: action | counter | draw
- `players`: [{ id, name, hand, awakenedQueens, score, connected }]
- `sleepingQueens`: [{ id, name, score, ability, isAwake, ownerId? }]
- `drawPile`, `discardPile`
- `currentPlayerIndex`
- `sessionId`

### PlayerAction
- `type`: playCard | discardCards | counterAction | drawCard
- `cardId(s)`
- `targetQueenId?`
- `targetPlayerId?`

---

## Socket.IO 이벤트 계약 (검증 가능한 형태로 명시)

### 서버 -> 클라이언트
- `gameState`: { phase, turnPhase, currentPlayerId, sleepingQueens, deckCount, discardCount, playersSummary }
- `playerHand`: { cards }
- `playerJoined`: { playerId, playerName, playerCount }
- `turnStart`: { playerId, timeLimit }
- `actionResult`: { action, success, message }
- `counterRequest`: { type: 'dragon'|'wand', targetPlayerId, timeLimit }
- `gameEnd`: { winnerId, scores }

### 클라이언트 -> 서버
- `createGame`: { playerCount }
- `joinGame`: { sessionId, playerName }
- `startGame`: {}
- `playCard`: { cardId, targetQueenId?, targetPlayerId? }
- `discardCards`: { cardIds }
- `counterAction`: { cardId, accept: boolean }
- `drawCard`: {}

---

## 규칙 구현에서 애매한 부분 정리 (버그 방지)
- 숫자카드 조합
  - 단일: 같은 숫자 1장
  - 페어: 같은 숫자 2장
  - 수식: 2~5장, 합이 10 (예: 1+2+3+4)
- 카드 사용 후
  - 성공 시: 사용 카드들은 버림
  - 실패 시(반격): 사용 카드들은 버림, 효과 없음
- 왕(킹) 사용 시
  - 장미 퀸이면 추가로 1명 더 깨움 (즉시 연속 처리)
- 고양이 퀸/강아지 퀸
  - 동일 플레이어 소유 불가, 후행 카드 무효(상황 메시지 노출)
- 덱 소진
  - 버림 더미를 셔플해 덱으로 사용

---

## UX 규격
- 버튼 최소 터치 60px
- 상태 변화는 애니메이션/사운드로 즉시 피드백
- 테이블은 QR 항상 표시, 플레이어는 자신의 턴 강조
- 연결 끊김 시 재접속 및 상태 복구

---

## 프로젝트 구조

```
TableGame/
├── server/
│   ├── index.js
│   ├── game/
│   │   ├── GameManager.js
│   │   ├── GameState.js
│   │   ├── CardDeck.js
│   │   └── GameRules.js
│   └── package.json
│
├── client/
│   ├── shared/
│   │   ├── socket.js
│   │   ├── cards.js
│   │   └── styles/
│   │       ├── common.css
│   │       ├── cards.css
│   │       └── animations.css
│   ├── table/
│   │   ├── index.html
│   │   ├── table.js
│   │   └── table.css
│   └── player/
│       ├── index.html
│       ├── join.html
│       ├── player.js
│       └── player.css
│
├── assets/
│   ├── images/
│   ├── sounds/
│   └── fonts/
│
├── SLEEPING_QUEENS_PLAN.md
└── README.md
```

---

## 단계별 개발 계획 (완료 기준 포함)

### Phase 1: 인프라 (1주)
- 서버/클라 기본 구조 생성
- Socket.IO 연결 확인
- 완료 기준: 테이블/플레이어 간 연결 로그 확인

### Phase 2: 코어 로직 (2주)
- GameState, CardDeck, GameRules 구현
- 턴/덱/버림 로직 완료
- 완료 기준: 로컬 테스트로 턴 진행 가능

### Phase 3: 테이블 UI (1주)
- 세션 생성 및 QR 표시
- 잠자는 퀸 그리드
- 완료 기준: QR 스캔으로 참가 가능

### Phase 4: 플레이어 UI (1주)
- 손패/행동 UI
- 카드 선택/버리기
- 완료 기준: 플레이어가 실제 턴 행동 가능

### Phase 5: 게임플레이 완성 (2주)
- 액션 카드/반격 카드 구현
- 특수 퀸 규칙 반영
- 완료 기준: 승리 조건까지 게임 1판 가능

### Phase 6: 폴리싱 (1주)
- 애니메이션/사운드
- 반응형 최적화
- 완료 기준: 태블릿 2종 이상에서 문제 없음

### Phase 7: 테스트 & 배포 (1주)
- 멀티 디바이스 테스트
- 네트워크 끊김 복구 테스트
- 완료 기준: 교실 시연 가능

---

## 테스트 체크리스트
- [ ] 2,3,4인 모두 게임 시작 가능
- [ ] 숫자카드 버리기 규칙 일치
- [ ] 킹/기사/포션 사용 시 반격 정상
- [ ] 고양이/강아지 퀸 충돌 처리
- [ ] 덱 소진 시 재셔플
- [ ] 연결 끊김 후 재접속 복구

---

## 리스크 및 대응
- 네트워크 불안정: 자동 재접속, 상태 저장
- 규칙 오해: 규칙 문서에 애매한 부분 명확화(위 섹션)
- 태블릿 성능: 애니메이션 최소화 옵션 제공

---

## 실행 스크립트

```
@echo off
cd server
node index.js
pause
```

---

*최종 수정: 2026-02-07*
*버전: 1.1*
