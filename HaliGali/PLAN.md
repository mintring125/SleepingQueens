# 🎀 할리갈리 테이블탑 디지털 게임 - 구현 계획서 (산리오 테마)

> 태블릿을 바닥에 놓고 4명이 둘러앉아 플레이하는 디지털 할리갈리
> 
> **최종 목표**: `D:\TableGame` 프로젝트에 3번째 게임으로 통합

---

## 0. D:\TableGame 프로젝트 통합 계획

### 0.1 기존 프로젝트 구조 (참고)

`D:\TableGame`은 **서버-클라이언트 구조**의 멀티 게임 플랫폼입니다:
- **슬리핑 퀸즈**: 테이블 + 플레이어 화면 분리 (멀티 디바이스)
- **카리바**: 테이블 + 플레이어 화면 분리 (멀티 디바이스)
- **공통**: Node.js + Express + Socket.IO, 바닐라 HTML/CSS/JS

```
D:\TableGame\
├── server/
│   ├── index.js              ← Express 서버 + Socket.IO (라우팅 & 네임스페이스)
│   └── game/
│       ├── GameManager.js       (슬리핑퀸즈)
│       ├── GameState.js
│       ├── GameRules.js
│       ├── CardDeck.js
│       └── kariba/
│           ├── KaribaGameManager.js
│           ├── KaribaGame.js
│           ├── KaribaDeck.js
│           └── KaribaRules.js
├── client/
│   ├── index.html            ← 게임 선택 메뉴 (여기에 할리갈리 추가)
│   ├── shared/               ← 공용 스타일, 유틸
│   ├── table/                ← 슬리핑퀸즈 테이블 화면
│   ├── player/               ← 슬리핑퀸즈 플레이어 화면
│   └── kariba/
│       ├── table/
│       ├── player/
│       ├── shared/
│       └── assets/
└── assets/                   ← 슬리핑퀸즈 에셋
```

### 0.2 할리갈리의 차별점

할리갈리는 기존 게임들과 **구조적으로 다릅니다**:

| | 슬리핑퀸즈 / 카리바 | 할리갈리 |
|---|---|---|
| **디바이스** | 테이블 1대 + 플레이어 각자 디바이스 | **태블릿 1대에서 모든 것** |
| **화면** | table + player 분리 | **단일 화면 (테이블탑 모드)** |
| **서버 역할** | 게임 상태 관리, 동기화 | **최소한** (게임 기록 정도) |
| **인터랙션** | 각자 디바이스에서 터치 | **한 태블릿에서 멀티터치** |

### 0.3 통합 시 추가할 파일 구조

```
D:\TableGame\
├── server/
│   ├── index.js              ← 할리갈리 라우팅 추가
│   └── game/
│       └── halli/            ← 신규
│           ├── HalliGameManager.js   (세션 관리: 게임 생성/목록/기록)
│           └── HalliRules.js         (과일 합산 판정 - 서버 검증용)
├── client/
│   ├── index.html            ← 할리갈리 카드 추가
│   └── halli/                ← 신규 (메인 게임 폴더)
│       ├── index.html           (게임 메인 화면 - 설정 + 게임)
│       ├── css/
│       │   ├── main.css         (레이아웃, 디자인 토큰)
│       │   ├── bell.css         (종 + 색상 영역)
│       │   ├── card.css         (카드 + 플립 애니메이션)
│       │   └── effects.css      (파티클, 글로우)
│       ├── js/
│       │   ├── main.js          (앱 진입점)
│       │   ├── game.js          (게임 FSM + 상태 관리)
│       │   ├── deck.js          (카드 덱 생성/셔플/배분)
│       │   ├── bell.js          (멀티터치 종치기 판정)
│       │   ├── swipe.js         (스와이프 제스처 감지)
│       │   ├── judge.js         (과일 합산 판정)
│       │   ├── animation.js     (애니메이션 제어)
│       │   └── sound.js         (효과음 + 진동)
│       ├── assets/
│       │   ├── cards/           (카드 이미지 SVG)
│       │   ├── bell/            (종 이미지)
│       │   └── sounds/          (효과음 mp3)
│       └── shared/              (할리갈리 내부 공유 모듈)
```

### 0.4 server/index.js 수정 사항 (통합 시)

```javascript
// 추가할 코드:

// --- Halli Galli ---
const HalliGameManager = require('./game/halli/HalliGameManager');

// Serve static files - Halli Galli
app.use('/halli', express.static(path.join(__dirname, '..', 'client', 'halli')));
app.use('/halli/assets', express.static(path.join(__dirname, '..', 'client', 'halli', 'assets')));

// Routes
app.get('/halli', (req, res) => res.redirect('/halli/'));

// Socket.IO namespace (게임 기록, 통계용 - 실시간 게임은 클라이언트 자체 처리)
const halliNamespace = io.of('/halli');
const halliGameManager = new HalliGameManager(halliNamespace);

// 서버 시작 로그에 추가:
console.log(`할리갈리:      http://${localIP}:${PORT}/halli`);
```

### 0.5 client/index.html 수정 사항 (게임 선택 메뉴)

```html
<!-- 기존 게임 카드(슬리핑퀸즈, 카리바) 뒤에 추가 -->
<a href="/halli" class="game-card halli">
  <span class="game-icon">🔔</span>
  <h2>할리갈리</h2>
  <p>2~4명 · 약 15분<br>과일이 5개면 종을 쳐라!</p>
  <span class="badge">테이블 열기</span>
</a>

<!-- CSS 추가 -->
<style>
  .game-card.halli { border-top: 4px solid #10B981; }
  .game-card.halli .badge { background: linear-gradient(135deg,#10B981,#34D399); color:white; }
</style>
```

### 0.6 개발 전략

1. **먼저 `f:\HaliGali`에서 독립 개발** (현재 프로젝트)
   - 순수 클라이언트 단독으로 완전한 게임 구현
   - 로컬에서 바로 `index.html`을 열어 테스트 가능
2. **완성 후 `D:\TableGame\client\halli\`로 이동**
   - 서버 연동 코드 추가 (게임 기록/통계)
   - 라우팅 & 게임 선택 메뉴 통합

---

## 1. 게임 규칙 요약

### 기본 규칙
- **플레이어**: 2~4명
- **카드**: 56장 (산리오풍 캐릭터 4종 × 1~5마리 × 각 수량)
- **목표**: 공개된 카드들의 **같은 캐릭터 합이 정확히 5마리**일 때 종을 치기
- **승리**: 모든 카드를 획득한 플레이어 승리 (카드가 없으면 탈락)

### 🎨 테마: 산리오풍 오리지널 캐릭터 (과일 → 캐릭터 대체)

| 기존 과일 | 산리오풍 캐릭터 | 설명 | 메인 색상 |
|-----------|----------------|------|----------|
| 🍓 딸기 | **키티냥 (Kitty Nyang)** | 빨간 리본의 하얀 고양이 | 🔴 빨강 + 흰색 |
| 🍌 바나나 | **푸딩독 (Pudding Dog)** | 베레모를 쓴 황금색 강아지 | 🟡 노랑 + 갈색 |
| 🫐 자두 | **멜로디번 (Melody Bun)** | 분홍 후드를 쓴 하얀 토끼 | 🩷 핑크 + 흰색 |
| 🍋 라임 | **시나롤 (Cinna Roll)** | 큰 귀가 달린 하얀 강아지 | 🔵 하늘색 + 흰색 |

> 이미지 생성 프롬프트는 `prompt.md` 참고

### 카드 구성 (총 56장)
| 캐릭터 | 1마리 | 2마리 | 3마리 | 4마리 | 5마리 |
|--------|-------|-------|-------|-------|-------|
| 키티냥 🐱🎀 | 3장 | 3장 | 3장 | 3장 | 2장 |
| 푸딩독 🐶🍮 | 3장 | 3장 | 3장 | 3장 | 2장 |
| 멜로디번 🐰🩷 | 3장 | 3장 | 3장 | 3장 | 2장 |
| 시나롤 🐕☁️ | 3장 | 3장 | 3장 | 3장 | 2장 |

### 게임 진행
1. 카드를 균등 배분
2. 시계방향으로 돌아가며 카드 1장씩 공개
3. 공개된 카드 중 같은 캐릭터 합이 **정확히 5**이면 종 치기!
4. 정답: 공개된 모든 카드를 가져감
5. 오답: 각 플레이어에게 카드 1장씩 지불

---

## 2. 화면 레이아웃

### 2.1 전체 구조 (태블릿 가로/세로 자동 대응)

```
┌──────────────────────────────────────────────┐
│                                              │
│          [P3 뒷면더미]  [P3 공개카드]           │
│               (180° 회전)                     │
│                                              │
│  [P2 공개]      ┌──────┐      [P4 공개]       │
│  [P2 뒷면]      │      │      [P4 뒷면]       │
│  (90° 회전)     │  🔔  │      (-90° 회전)     │
│                 │  종  │                      │
│                 └──────┘                      │
│                                              │
│          [P1 뒷면더미]  [P1 공개카드]           │
│               (0° 회전, 기본)                  │
│                                              │
└──────────────────────────────────────────────┘
```

### 2.2 종 + 플레이어 색상 영역 (핵심!)

종 주변을 **4등분**하여 각 플레이어의 **고유 색상 터치 영역** 배치:

```
              ┌─────────┐
              │ P3 (초록)│
              │  GREEN   │
         ┌────┼─────────┼────┐
         │ P2 │         │ P4 │
         │파랑│   🔔    │보라│
         │BLUE│   종    │PURPLE
         └────┼─────────┼────┘
              │ P1 (빨강)│
              │   RED    │
              └─────────┘
```

- 각 영역은 **부채꼴 또는 사각형** 형태
- 평소에는 **은은한 색상 (10~20% opacity)**
- 터치 시 **해당 영역이 밝게 점등** (100% opacity + 글로우 효과)
- **가장 먼저 터치한 플레이어만** 점등됨 (나머지는 점등 안 됨)

### 2.3 플레이어별 색상 & 방향

| 플레이어 | 위치 | 색상 | 회전각 | 카드 방향 |
|----------|------|------|--------|-----------|
| P1 | 하단 (가까운 쪽) | 🔴 빨강 `#FF4757` | 0° | 스와이프 ↑ |
| P2 | 왼쪽 | 🔵 파랑 `#3742FA` | 90° | 스와이프 → |
| P3 | 상단 (먼 쪽) | 🟢 초록 `#2ED573` | 180° | 스와이프 ↓ |
| P4 | 오른쪽 | 🟣 보라 `#A55EEA` | -90° | 스와이프 ← |

---

## 3. 인터랙션 상세 설계

### 3.1 🔔 종치기 인터랙션

#### 터치 감지 방식
```
이벤트: touchstart (가장 빠른 반응을 위해)
판정: 첫 번째 터치의 timestamp 기준
영역: 중앙 종 주변의 각 플레이어 영역
```

#### 동작 흐름
```
1. 플레이어가 자기 색상 영역 터치
   ↓
2. touchstart 이벤트 발생 → timestamp 기록
   ↓
3. 200ms 윈도우 내 모든 터치 수집 (동시 누름 대비)
   ↓
4. 가장 빠른 timestamp의 플레이어 선정
   ↓
5. 해당 플레이어 영역 밝게 점등 (글로우 애니메이션)
   ↓
6. 종 눌림 애니메이션 + 종소리 효과음 + 진동
   ↓
7. 과일 합산 판정
   ├─ 정답 → 성공 이펙트 + 카드 수집 애니메이션
   └─ 오답 → 실패 이펙트 + 패널티 카드 분배
   ↓
8. 1.5초 후 색상 리셋, 다음 라운드
```

#### 시각 피드백 상세
```css
/* 평소 상태 - 은은한 색상 */
.bell-zone-p1 { background: rgba(255, 71, 87, 0.15); }

/* 터치 시 - 밝게 점등 */
.bell-zone-p1.active {
  background: rgba(255, 71, 87, 0.8);
  box-shadow: 0 0 30px rgba(255, 71, 87, 0.6);  /* 글로우 */
  animation: pulse 0.3s ease-out;
}

/* 정답 시 */
.bell-zone-p1.correct {
  background: rgba(255, 71, 87, 1.0);
  animation: flash-success 0.5s;
}

/* 오답 시 */
.bell-zone-p1.wrong {
  animation: shake 0.5s;
}
```

### 3.2 🃏 카드 넘기기 인터랙션

#### 스와이프 방식
- **방향**: 각 플레이어 기준 "아래에서 위로" (= 자기 몸쪽에서 종 방향으로)
- **대상**: 뒷면 카드 더미 위를 스와이프
- **결과**: 맨 위 1장이 뒤집히며 공개 카드 영역으로 이동

#### 플레이어별 스와이프 방향 (절대 좌표 기준)
| 플레이어 | 상대 방향 "아래→위" | 절대 방향 |
|----------|-------------------|-----------|
| P1 (하단) | 아래→위 | ↑ (Y 감소) |
| P2 (왼쪽) | 아래→위 | → (X 증가) |
| P3 (상단) | 아래→위 | ↓ (Y 증가) |
| P4 (오른쪽) | 아래→위 | ← (X 감소) |

#### 동작 흐름
```
1. 플레이어가 자기 뒷면 카드 더미에서 touchstart
   ↓
2. 스와이프 제스처 감지 (최소 50px 이동, 올바른 방향)
   ↓
3. 스와이프 중 - 카드가 손가락을 따라 살짝 올라옴 (인터랙티브)
   ├─ 카드 기울기 변화 (perspective + rotateX)
   └─ 뒷면이 서서히 앞면으로 전환
   ↓
4. 스와이프 완료 (충분한 거리 이동)
   ├─ 카드가 공개 영역으로 날아감 (ease-out 애니메이션)
   └─ 3D 플립 효과로 앞면 공개
   ↓
5. 스와이프 취소 (거리 부족 or 반대 방향)
   └─ 카드가 원래 위치로 돌아감 (snap back)
```

#### 카드 플립 애니메이션 상세
```
프레임 1 (0ms):     카드 뒷면, 원래 위치
프레임 2 (0~200ms): 카드가 위로 이동하면서 Y축 기준 회전 시작
프레임 3 (200ms):   카드 90° 회전 (측면, 가장 얇은 상태)
프레임 4 (200~400ms): 카드 앞면이 보이기 시작, 공개 영역으로 이동
프레임 5 (400ms):   카드 앞면 완전히 보임, 공개 영역에 착지

CSS keyframes:
  0%   → transform: translateY(0) rotateY(0deg) scale(1)
  50%  → transform: translateY(-30px) rotateY(90deg) scale(1.1)
  100% → transform: translateY(targetY) rotateY(180deg) scale(1)
```

#### 턴 표시
- **현재 턴인 플레이어**의 카드 더미 영역이 **살짝 빛남** (펄스 애니메이션)
- 다른 플레이어의 카드는 스와이프 **비활성화** (터치해도 반응 없음)
- 턴이 아닌데 스와이프 시도 시 **살짝 흔들림** 효과로 알림

---

## 4. 기술 스택

### 4.1 프론트엔드
```
├── HTML5 + CSS3 + Vanilla JavaScript
├── Touch Events API (멀티터치, 스와이프 감지)
├── CSS 3D Transforms (카드 플립)
├── CSS Animations + Keyframes (이펙트)
├── Web Audio API (효과음)
├── Vibration API (진동 피드백)
├── Screen Wake Lock API (태블릿 절전 방지)
└── Fullscreen API (전체화면 모드)
```

### 4.2 게임 엔진 구조
```
src/
├── index.html              # 메인 HTML
├── css/
│   ├── main.css            # 전체 레이아웃, 변수
│   ├── bell.css            # 종 + 색상 영역 스타일
│   ├── card.css            # 카드 스타일 + 플립 애니메이션
│   └── effects.css         # 파티클, 글로우, 이펙트
├── js/
│   ├── main.js             # 앱 진입점
│   ├── game.js             # 게임 상태 관리 (FSM)
│   ├── deck.js             # 카드 덱 생성, 셔플, 배분
│   ├── bell.js             # 종치기 판정 + 멀티터치 처리
│   ├── swipe.js            # 스와이프 제스처 감지
│   ├── judge.js            # 과일 합산 판정 로직
│   ├── animation.js        # 애니메이션 제어
│   ├── sound.js            # 효과음 관리
│   └── haptic.js           # 진동 피드백
├── assets/
│   ├── cards/              # 카드 이미지 (PNG/SVG)
│   │   ├── back.png        # 뒷면 (산리오풍 패턴)
│   │   ├── frame.png       # 카드 프레임
│   │   ├── kitty-1~5.png   # 키티냥 1~5마리
│   │   ├── pudding-1~5.png # 푸딩독 1~5마리
│   │   ├── melody-1~5.png  # 멜로디번 1~5마리
│   │   └── cinna-1~5.png   # 시나롤 1~5마리
│   ├── bell/               # 종 이미지 (산리오풍 리본 달린 종)
│   ├── ui/                 # UI 에셋 (배경, 이펙트, 아이콘)
│   └── sounds/             # 효과음 파일
│       ├── bell.mp3
│       ├── card-flip.mp3
│       ├── correct.mp3
│       ├── wrong.mp3
│       └── card-collect.mp3
└── README.md
```

---

## 5. 게임 상태 머신 (FSM)

```
[SETUP] 플레이어 수 선택 (2~4명)
   ↓
[DEAL] 카드 셔플 & 배분
   ↓
[PLAYING] ←──────────────────────┐
   ↓                             │
[WAIT_FOR_FLIP] 현재 턴 플레이어의 스와이프 대기
   ↓ (스와이프 완료)              │
[CARD_REVEALED] 카드 공개 + 판정 대기
   ↓                             │
   ├── 종 안 침 (2초 타임아웃)     │
   │   → 다음 턴으로 ────────────┘
   │                              
   └── 종 침!                    
       ↓                         
[JUDGING] 과일 합산 판정           
   ├── 정답 → [COLLECT] 카드 수집 → [CHECK_WIN] ──→ [PLAYING]
   └── 오답 → [PENALTY] 카드 분배 → [CHECK_LOSE] ─→ [PLAYING]
                                     ↓ (패배)
                                  [ELIMINATED] 탈락 처리
                                     
[CHECK_WIN]
   ├── 1명만 남음 → [GAME_OVER] 승자 발표
   └── 계속 → [PLAYING]
```

---

## 6. 핵심 알고리즘

### 6.1 캐릭터 합산 판정
```javascript
// 각 플레이어의 공개 카드 맨 위만 확인 (최신 공개 카드)
function checkCharacterSum(players) {
  const topCards = players
    .filter(p => p.openPile.length > 0)
    .map(p => p.openPile[p.openPile.length - 1]);
  
  const charCount = { kitty: 0, pudding: 0, melody: 0, cinna: 0 };
  
  for (const card of topCards) {
    charCount[card.character] += card.count;
  }
  
  // 어떤 캐릭터든 합이 정확히 5이면 종을 쳐야 함
  return Object.values(charCount).some(count => count === 5);
}
```

### 6.2 멀티터치 선착순 판별
```javascript
// 200ms 윈도우 내 가장 빠른 터치 판별
let bellTouches = [];
let bellTimeout = null;

function onBellTouch(playerId, timestamp) {
  bellTouches.push({ playerId, timestamp });
  
  if (!bellTimeout) {
    bellTimeout = setTimeout(() => {
      // 가장 빠른 터치 선정
      bellTouches.sort((a, b) => a.timestamp - b.timestamp);
      const winner = bellTouches[0];
      processBellRing(winner.playerId);
      bellTouches = [];
      bellTimeout = null;
    }, 200); // 200ms 윈도우
  }
}
```

### 6.3 스와이프 방향 감지
```javascript
// 플레이어 위치별 유효 스와이프 방향 판별
const SWIPE_DIRECTIONS = {
  P1: { axis: 'Y', sign: -1 },  // ↑ (Y 감소)
  P2: { axis: 'X', sign: +1 },  // → (X 증가)
  P3: { axis: 'Y', sign: +1 },  // ↓ (Y 증가)
  P4: { axis: 'X', sign: -1 },  // ← (X 감소)
};

function isValidSwipe(playerId, deltaX, deltaY) {
  const dir = SWIPE_DIRECTIONS[playerId];
  const distance = dir.axis === 'X' ? deltaX : deltaY;
  return (distance * dir.sign) > MIN_SWIPE_DISTANCE; // 50px
}
```

---

## 7. 시각 효과 & 피드백

### 7.1 종 치기 이펙트
| 상황 | 시각 | 소리 | 진동 |
|------|------|------|------|
| 종 터치 | 색상 영역 점등 + 종 눌림 | 🔔 "딩!" | 짧은 진동 50ms |
| 정답 | 파티클 폭발 + 금빛 글로우 | 🎉 팡파레 | 성공 패턴 |
| 오답 | 빨간 X 표시 + 화면 흔들림 | 😣 "부우" | 경고 패턴 |

### 7.2 카드 이펙트
| 상황 | 시각 | 소리 |
|------|------|------|
| 스와이프 시작 | 카드 들림 + 그림자 | - |
| 카드 뒤집기 | 3D 플립 + 날아감 | 🃏 "촤악" |
| 카드 착지 | 바운스 효과 | 🃏 "탁" |
| 카드 수집 | 카드들이 종 치는 사람에게 날아감 | 💨 "슈울" |

### 7.3 턴 표시
- 현재 턴 플레이어: 카드 영역 **부드러운 펄스 글로우**
- 비활성 플레이어: 약간 어두움 (opacity 0.7)

---

## 8. 개발 단계 (Phase)

### Phase 1: 기본 레이아웃 & 게임 설정 화면
- [ ] 전체화면 레이아웃 (4방향 대칭)
- [ ] 플레이어 수 선택 화면 (2/3/4명)
- [ ] 종 + 4등분 색상 영역 배치
- [ ] 각 플레이어 카드 영역 배치 (회전 적용)
- [ ] 기본 CSS 변수 & 디자인 토큰

### Phase 2: 카드 시스템 & 스와이프
- [ ] 카드 덱 생성 (56장) & 셔플
- [ ] 카드 균등 배분
- [ ] 카드 뒷면 렌더링 (더미 표시)
- [ ] 스와이프 제스처 감지 (방향별)
- [ ] 카드 3D 플립 애니메이션
- [ ] 공개 카드 영역에 착지

### Phase 3: 종 치기 & 게임 로직
- [ ] 멀티터치 이벤트 처리
- [ ] 색상 영역 터치 감지 & 점등
- [ ] 선착순 판별 (200ms 윈도우)
- [ ] 과일 합산 판정 로직
- [ ] 정답/오답 처리 (카드 수집/패널티)
- [ ] 턴 관리 시스템

### Phase 4: 효과음 & 피드백
- [ ] 종소리 효과음
- [ ] 카드 넘기기 효과음
- [ ] 정답/오답 효과음
- [ ] 진동 피드백 (Vibration API)
- [ ] 파티클 이펙트

### Phase 5: 폴리싱 & 산리오 에셋
- [ ] ChatGPT로 산리오풍 캐릭터 카드 이미지 생성 (prompt.md 참고)
- [ ] 카드 프레임, 뒷면 디자인 생성
- [ ] 종 이미지 (리본 달린 산리오풍) 생성
- [ ] 배경, 이펙트, 플레이어 아이콘 생성
- [ ] 결과 화면 (승자 발표 - 산리오풍 축하)
- [ ] 게임 재시작
- [ ] 반응형 레이아웃 (다양한 태블릿 크기)
- [ ] PWA 설정 (오프라인, 홈 화면 추가)

---

## 9. 추가 고려사항

### 성능
- DOM 기반 + CSS 애니메이션 (Canvas보다 터치 이벤트 처리 용이)
- requestAnimationFrame으로 부드러운 인터랙티브 애니메이션
- GPU 가속: `transform`, `opacity`만 애니메이션 (will-change 적용)

### 접근성 & UX
- 색상만으로 구분하지 않고 아이콘/텍스트 보조
- 큰 터치 영역 (최소 44px)
- 화면 잠금 방지 (Screen Wake Lock API)
- 전체화면 자동 진입

### 확장 가능성
- 온라인 멀티플레이 (WebSocket) - 향후
- AI 플레이어 추가 - 향후
- 커스텀 카드덱 - 향후
