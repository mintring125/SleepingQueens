# 슬리핑퀸즈 디지털 보드게임 - 업그레이드 계획서 v2.0

> **목표**: 로컬 전용 → Vercel 배포, UI 대폭 개선, Z-Image Turbo로 카드 이미지 업그레이드, PWA 앱 아이콘 추가
> **작성일**: 2026-02-21
> **현재 버전**: 1.1 (로컬 전용)

---

## 📋 목차

1. [현재 상태 분석](#1-현재-상태-분석)
2. [Phase 1: Vercel 배포 전환](#2-phase-1-vercel-배포-전환)
3. [Phase 2: UI 개선 (Gemini 3.1)](#3-phase-2-ui-개선)
4. [Phase 3: Z-Image Turbo 카드 이미지 생성](#4-phase-3-z-image-turbo-카드-이미지-생성)
5. [Phase 4: PWA 앱 아이콘 (홈화면 추가)](#5-phase-4-pwa-앱-아이콘)
6. [새 프로젝트 구조](#6-새-프로젝트-구조)
7. [실행 순서 및 체크리스트](#7-실행-순서-및-체크리스트)

---

## 1. 현재 상태 분석

### 현재 아키텍처
```
[교사 노트북 서버]
    ├── Express + Socket.IO (WebSocket)
    ├── 정적 파일 서빙 (client/)
    └── 게임 로직 (server/game/)

[테이블 태블릿] ←→ WebSocket ←→ [서버]
[플레이어 태블릿] ←→ WebSocket ←→ [서버]
```

### 핵심 의존성
| 구성 요소 | 기술 | Vercel 호환성 |
|-----------|------|:------------:|
| HTTP 서버 | Express | ⚠️ Serverless Functions로 가능 |
| 실시간 통신 | Socket.IO (WebSocket) | ❌ **불가** - Vercel은 영구 연결 미지원 |
| 정적 파일 | HTML/CSS/JS | ✅ 문제 없음 |
| QR 생성 | qrcode 라이브러리 | ✅ 가능 |
| 게임 상태 | 서버 메모리 (Map) | ❌ Serverless는 상태 유지 불가 |

### ⚠️ 핵심 문제: WebSocket
> **Vercel의 Serverless Functions는 영구적 WebSocket 연결을 지원하지 않습니다.**
> 현재 게임은 Socket.IO 기반 실시간 통신에 완전히 의존하고 있어,
> 단순히 Vercel에 올리는 것만으로는 동작하지 않습니다.

---

## 2. Phase 1: Vercel 배포 전환

### 2-1. 아키텍처 선택지

#### 옵션 A: 하이브리드 배포 ⭐ **권장**
```
[Vercel] ─── 프론트엔드 (정적 파일)
[Render/Railway] ─── 백엔드 (Socket.IO 서버)
```
- **장점**: 코드 변경 최소, Socket.IO 그대로 사용, 무료 티어 활용 가능
- **단점**: 두 서비스 관리 필요, 백엔드 cold start (Render 무료)
- **비용**: Vercel 무료 + Render 무료 (cold start 있음) 또는 $7/월 (상시 가동)

#### 옵션 B: Vercel + PartyKit (WebSocket 전문 서비스)
```
[Vercel] ─── 프론트엔드 + API
[PartyKit] ─── 실시간 통신 (WebSocket)
```
- **장점**: WebSocket 전용 최적화, Edge 배포로 빠른 응답
- **단점**: Socket.IO → PartyKit API로 **대규모 리팩터링** 필요
- **비용**: PartyKit 무료 티어 있음

#### 옵션 C: Vercel + Supabase Realtime
```
[Vercel] ─── 프론트엔드 + API
[Supabase] ─── DB + Realtime (WebSocket 대체)
```
- **장점**: DB 지속성 확보, 게임 기록 자동 저장
- **단점**: 실시간 게임용 최적화 아님, 지연 가능성, 큰 리팩터링
- **비용**: 무료 티어 (500MB DB, 동시접속 200)

#### 옵션 D: 전체 Next.js 리빌드
```
[Vercel + Next.js] ─── SSR + API Routes
[별도 WebSocket 서비스] ─── 실시간 통신
```
- **단점**: 사실상 처음부터 다시 만드는 수준

### 2-2. 권장안: 옵션 A (하이브리드 배포) 상세

#### 변경 사항 요약
| 영역 | 현재 | 변경 후 |
|------|------|---------|
| 프론트엔드 호스팅 | Express 정적 서빙 | **Vercel** (정적 사이트) |
| 백엔드 호스팅 | 로컬 Node.js | **Render** (Node.js 서비스) |
| Socket.IO 연결 | 같은 호스트 (`/`) | **환경변수로 백엔드 URL 지정** |
| QR 코드 URL | 로컬 IP 기반 | **Vercel 도메인 기반** |
| 게임 결과 기록 | 로컬 파일 (result.md) | **서버 메모리 또는 DB** |

#### 프론트엔드 변경 (Vercel 배포용)

**1. `socket.js` 수정 - 원격 서버 연결**
```javascript
// 현재: 같은 호스트에 연결
this.socket = io({ reconnection: true, ... });

// 변경: 환경변수로 백엔드 URL 지정
const BACKEND_URL = window.__ENV__?.BACKEND_URL || 'http://localhost:3000';
this.socket = io(BACKEND_URL, { reconnection: true, ... });
```

**2. Vercel 설정 파일 생성 (`vercel.json`)**
```json
{
  "rewrites": [
    { "source": "/table", "destination": "/table/index.html" },
    { "source": "/player", "destination": "/player/index.html" },
    { "source": "/player/join", "destination": "/player/join.html" },
    { "source": "/join", "destination": "/player/join.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=3600" }
      ]
    }
  ]
}
```

**3. 환경변수 주입 스크립트**
```html
<!-- 각 HTML 파일의 <head>에 추가 -->
<script>
  window.__ENV__ = {
    BACKEND_URL: '%VITE_BACKEND_URL%' // 빌드 시 치환 또는 Vercel 환경변수
  };
</script>
```
> 또는 빌드 도구 없이 하드코딩 후 배포 시 수정

#### 백엔드 변경 (Render 배포용)

**1. `server/index.js` 수정 - CORS 설정**
```javascript
const io = new Server(server, {
  cors: {
    origin: [
      'https://sleeping-queens.vercel.app',  // Vercel 프론트엔드
      'http://localhost:3000'                  // 로컬 개발
    ],
    methods: ['GET', 'POST']
  }
});
```

**2. QR 코드 URL 변경**
```javascript
// 현재: 로컬 IP
const joinUrl = `http://${this.localIP}:${this.port}/player/join.html?session=${sessionId}`;

// 변경: Vercel 도메인
const FRONTEND_URL = process.env.FRONTEND_URL || `http://${this.localIP}:${this.port}`;
const joinUrl = `${FRONTEND_URL}/player/join.html?session=${sessionId}`;
```

**3. 게임 결과 기록 변경**
```javascript
// 현재: 로컬 파일 쓰기 (Render에서는 재배포 시 소실)
fs.appendFileSync('../result.md', resultText);

// 변경 옵션 1: 콘솔 로그만 (간단)
console.log('[GAME RESULT]', resultText);

// 변경 옵션 2: 외부 DB (Supabase, MongoDB Atlas 등)
// await supabase.from('game_results').insert({ ... });
```

**4. Render 배포 설정**
- `render.yaml` 또는 대시보드에서 설정:
  - Build Command: `cd server && npm install`
  - Start Command: `cd server && node index.js`
  - Environment: `FRONTEND_URL=https://sleeping-queens.vercel.app`

#### 배포 흐름
```
1. GitHub 리포지토리에 코드 푸시
2. Vercel: client/ 폴더를 정적 사이트로 배포
3. Render: server/ 폴더를 Node.js 서비스로 배포
4. 환경변수 설정:
   - Vercel: BACKEND_URL → Render 서비스 URL
   - Render: FRONTEND_URL → Vercel 도메인
5. 프론트엔드에서 Socket.IO가 Render 서버에 연결
```

---

## 3. Phase 2: UI 개선

### 3-1. 현재 UI 평가

| 항목 | 현재 상태 | 개선 방향 |
|------|-----------|-----------|
| 전체 톤 | 보라-파랑 그라데이션 | 더 따뜻하고 동화적인 톤 |
| 폰트 | Nunito | 유지 (적합) |
| 카드 디자인 | 이미지 + 이모지 폴백 | 이미지 카드에 프레임/광택 효과 추가 |
| 애니메이션 | 기본 hover/transition | 카드 뒤집기, 퀸 깨우기 이펙트 추가 |
| 레이아웃 | 세로 스크롤 | 핵심 정보 한 화면에 보이도록 |
| 반응형 | 기본 대응 | 태블릿 가로모드 최적화 강화 |

### 3-2. UI 개선 상세 계획

#### A. 디자인 시스템 업데이트 (`common.css`)

**새로운 색상 팔레트 (동화풍 + 프리미엄)**
```css
:root {
  /* 메인 팔레트 - 마법의 숲 테마 */
  --primary: #6D28D9;        /* 딥 퍼플 */
  --primary-light: #A78BFA;
  --primary-glow: rgba(109, 40, 217, 0.4);

  --magic-gold: #F59E0B;
  --magic-rose: #EC4899;
  --magic-emerald: #10B981;
  --magic-sapphire: #3B82F6;

  /* 배경 - 별이 빛나는 밤하늘 */
  --bg-start: #0F0A2E;
  --bg-mid: #1A1145;
  --bg-end: #2D1B69;

  /* 글래스모피즘 강화 */
  --glass-bg: rgba(255, 255, 255, 0.08);
  --glass-border: rgba(255, 255, 255, 0.12);
  --glass-glow: rgba(167, 139, 250, 0.15);
}
```

**별 파티클 배경 효과**
```css
body::after {
  content: '';
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-image:
    radial-gradient(2px 2px at 20px 30px, #fff, transparent),
    radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.8), transparent),
    radial-gradient(1px 1px at 90px 40px, #fff, transparent);
  background-size: 200px 200px;
  animation: twinkle 4s ease-in-out infinite alternate;
  pointer-events: none;
  z-index: 0;
}
```

#### B. 카드 UI 개선 (`cards.css`)

**카드 뒤집기 애니메이션 (3D)**
```css
.card-flip {
  animation: cardFlip 0.6s ease-in-out;
  transform-style: preserve-3d;
}

@keyframes cardFlip {
  0% { transform: perspective(600px) rotateY(0deg); }
  50% { transform: perspective(600px) rotateY(90deg); }
  100% { transform: perspective(600px) rotateY(0deg); }
}
```

**카드 홀로그래피 효과 (호버 시)**
```css
.card:hover .card-image {
  filter: brightness(1.1);
}

.card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    115deg,
    transparent 20%,
    rgba(255,255,255,0.15) 40%,
    rgba(255,255,255,0.3) 50%,
    rgba(255,255,255,0.15) 60%,
    transparent 80%
  );
  border-radius: var(--radius-md);
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}
.card:hover::after {
  opacity: 1;
  animation: holoShift 1.5s ease infinite;
}
```

**퀸 깨우기 이펙트**
```css
.queen-wake-effect {
  animation: queenWake 1.2s ease-out;
}

@keyframes queenWake {
  0% { transform: scale(0.5) rotateY(180deg); opacity: 0; filter: blur(10px); }
  50% { transform: scale(1.2) rotateY(0deg); opacity: 1; filter: blur(0); }
  70% { transform: scale(0.95); }
  100% { transform: scale(1); }
}
```

#### C. 테이블 화면 개선 (`table.css` / `table.html`)

- **WIP 원형 레이아웃**: 플레이어 정보를 원형으로 배치 (보드게임 느낌)
- **잠자는 퀸 그리드**: 3D 카드 뒤집기 효과 + 깨울 때 파티클 이펙트
- **턴 표시**: 현재 플레이어에 스포트라이트 효과
- **로그 패널**: 반투명 사이드 패널로 변경

#### D. 플레이어 화면 개선 (`player.css` / `player.html`)

- **카드 손패**: 부채꼴(fan) 배치 강화
- **내 턴 알림**: 화면 전체 펄스 + 진동 (Vibration API)
- **드래그 카드 사용**: 카드를 슬라이드해서 사용 (터치 친화적)
- **퀸 컬렉션**: 아래쪽에 수집한 퀸 아이콘 표시

#### E. 참가 화면 개선 (`join.html`)

- **풀스크린 환영 화면**: 동화풍 일러스트 배경
- **캐릭터 아바타 선택**: 이름 옆에 아바타 아이콘
- **입장 애니메이션**: 참가 시 마법 포탈 이펙트

---

## 4. Phase 3: Z-Image Turbo 카드 이미지 생성

### 4-1. 현재 카드 이미지 현황

#### 보유 이미지 (39장)
```
✅ 액션 카드 (5종): king, knight, dragon, potion, wand
✅ 킹 변종 (7종): bubblegum, chess, cookie, fire, puzzle, tiedye, turtle
✅ 기사 변종 (4종): dark, jester, red, robot
✅ 숫자 카드 (10종): number_1 ~ number_10
✅ 퀸 카드 (12종): rose, cat, dog, pancake, sunflower, rainbow, moon,
                    starfish, heart, ladybug, cake, peacock
```

### 4-2. Z-Image Turbo 이미지 생성 계획

#### ComfyUI 워크플로우 설정
- **모델**: Z-Image Turbo (BF16, RTX 4070 Super 12GB)
- **해상도**: 768×1024 (3:4) → process_cards.py로 180×252 크로핑
- **방식**: txt2img 또는 img2img (기존 이미지를 참조 이미지로 활용)

#### 공통 프롬프트 스타일
```
Style keywords: children's fairy tale illustration, soft watercolor,
whimsical cartoon style, vibrant colors, cute character design,
fantasy card game art, bordered card frame, clean background,
high quality, detailed
```

#### 카드별 프롬프트 목록

##### 액션 카드 (새로 생성하여 품질 향상)
| 카드 | 프롬프트 | 참조 이미지 |
|------|---------|------------|
| king.png | `A majestic fairy tale king with golden crown, royal purple robe, friendly smile, standing pose, children's book illustration style` | 기존 king.png |
| knight.png | `A brave cartoon knight in shining silver armor with sword, friendly heroic pose, children's fairy tale illustration` | 기존 knight.png |
| dragon.png | `A cute friendly green/red dragon with small wings, protective stance, children's fairy tale illustration, adorable` | 기존 dragon.png |
| potion.png | `A magical purple sleeping potion in a crystal bottle, sparkling, swirling mist, children's fairy tale illustration` | 기존 potion.png |
| wand.png | `A sparkling magic wand with star tip, trails of golden sparkles, children's fairy tale illustration` | 기존 wand.png |

##### 퀸 카드 (새로 생성하여 통일된 스타일)
| 카드 | 프롬프트 |
|------|---------|
| queen_rose.png | `A beautiful Rose Queen with rose crown, pink dress adorned with roses, holding a red rose, gentle smile, fairy tale princess` |
| queen_cat.png | `A playful Cat Queen wearing purple crown with cat ears, elegant purple dress, holding a kitten, fairy tale princess` |
| queen_dog.png | `A cheerful Dog Queen wearing brown crown with puppy ears, warm brown dress, holding a puppy, fairy tale princess` |
| queen_pancake.png | `A sweet Pancake Queen with golden crown shaped like pancakes, apron dress, holding a stack of pancakes, fairy tale princess` |
| queen_sunflower.png | `A radiant Sunflower Queen with sunflower crown, yellow sun dress, surrounded by sunflowers, fairy tale princess` |
| queen_rainbow.png | `A magical Rainbow Queen with rainbow crown, dress of seven colors, rainbow arc behind her, fairy tale princess` |
| queen_moon.png | `A mystical Moon Queen with crescent moon crown, dark blue dress with stars, glowing moonlight, fairy tale princess` |
| queen_starfish.png | `A oceanic Starfish Queen with starfish crown, turquoise mer-dress, holding a golden starfish, fairy tale princess` |
| queen_heart.png | `A loving Heart Queen with heart-shaped crown, red and pink dress, surrounded by floating hearts, fairy tale princess, most beautiful` |
| queen_ladybug.png | `A cute Ladybug Queen with red crown with black dots, red and black polka dot dress, ladybug wings, fairy tale princess` |
| queen_cake.png | `A sweet Cake Queen with cake-shaped crown, pastel frosting dress, holding a decorated birthday cake, fairy tale princess` |
| queen_peacock.png | `A elegant Peacock Queen with feathered crown, iridescent teal dress, peacock feathers fan, fairy tale princess` |

##### 숫자 카드 (스타일 통일)
| 카드 | 프롬프트 |
|------|---------|
| number_1~10 | `A whimsical number [N] in a magical forest setting, decorated with flowers and sparkles, children's storybook illustration, the number is large and centered` |

##### 킹 변종 (7종 - 기존 스타일 업그레이드)
| 카드 | 프롬프트 요약 |
|------|-------------|
| king_bubblegum | 풍선껌 왕 - 분홍 로브, 풍선껌 왕관 |
| king_chess | 체스 왕 - 체크무늬 로브, 체스 왕관 |
| king_cookie | 쿠키 왕 - 갈색 로브, 쿠키 왕관 |
| king_fire | 불의 왕 - 불꽃 로브, 화염 왕관 |
| king_puzzle | 퍼즐 왕 - 다색 퍼즐 로브 |
| king_tiedye | 타이다이 왕 - 무지개 로브 |
| king_turtle | 거북 왕 - 초록 로브, 거북 등딱지 왕관 |

### 4-3. 이미지 생성 워크플로우

```
1. ComfyUI 실행 (로컬)
2. Z-Image Turbo 워크플로우 로드
3. 각 카드별 프롬프트 입력 → 생성 (768×1024)
4. 생성된 이미지 → assets/images/cards/raw/ 에 저장
5. process_cards.py 실행 → 180×252로 리사이즈 + 트리밍
6. 결과물 → assets/images/cards/ 에 배치
7. 브라우저에서 확인 및 미세 조정
```

### 4-4. img2img 접근법 (스타일 일관성 확보)

기존 이미지를 참조하되 새로운 스타일로 개선:
```
- Denoise Strength: 0.5~0.65 (원본 구도 유지 + 스타일 변경)
- Steps: 4 (Z-Image Turbo 기본)
- CFG: 1.0 (Turbo 모델 권장)
- Sampler: euler / euler_ancestral
```

---

## 5. Phase 4: PWA 앱 아이콘 (홈화면 추가)

### 5-1. 목적

삼성 인터넷 등 모바일 브라우저에서 **"홈 화면에 추가"** 시 표시되는 앱 아이콘을 만들어,
네이티브 앱처럼 바로 게임에 접속할 수 있도록 합니다.

- **테이블용 아이콘**: 교사/테이블 태블릿 → `/table` 바로가기
- **플레이어용 아이콘**: 학생 태블릿 → `/player/join.html` 바로가기

### 5-2. Web App Manifest 설정

각 페이지(table, player)에 별도 manifest를 적용하거나, 공통 manifest 하나를 사용합니다.

**`client/manifest.json` (공통)**
```json
{
  "name": "슬리핑 퀸즈",
  "short_name": "퀸즈",
  "description": "슬리핑 퀸즈 디지털 보드게임",
  "start_url": "/player/join.html",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#1A1145",
  "theme_color": "#6D28D9",
  "icons": [
    {
      "src": "/icons/icon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

**`client/manifest-table.json` (테이블 전용)**
```json
{
  "name": "슬리핑 퀸즈 - 테이블",
  "short_name": "퀸즈 테이블",
  "start_url": "/table",
  "display": "standalone",
  "orientation": "landscape",
  "background_color": "#1A1145",
  "theme_color": "#6D28D9",
  "icons": [
    { "src": "/icons/icon.svg", "sizes": "any", "type": "image/svg+xml" },
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

### 5-3. HTML에 manifest 연결

각 HTML 파일의 `<head>`에 추가:
```html
<!-- player/index.html, player/join.html -->
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#6D28D9">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/icon-192.png">

<!-- table/index.html -->
<link rel="manifest" href="/manifest-table.json">
<meta name="theme-color" content="#6D28D9">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/icon-192.png">
```

### 5-4. SVG 아이콘 디자인

**디자인 컨셉**: 잠자는 왕관을 쓴 퀸 + 별/달 장식

**`client/icons/icon.svg`**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <!-- 배경: 보라색 원형 그라데이션 -->
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7C3AED"/>
      <stop offset="100%" stop-color="#4C1D95"/>
    </linearGradient>
    <linearGradient id="crown" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCD34D"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>
  </defs>

  <!-- 둥근 배경 -->
  <rect width="512" height="512" rx="108" fill="url(#bg)"/>

  <!-- 왕관 아이콘 -->
  <g transform="translate(96, 100) scale(2)">
    <path d="M 20 120 L 40 60 L 80 90 L 120 40 L 160 90 L 200 60 L 220 120 Z"
          fill="url(#crown)" stroke="#D97706" stroke-width="3"/>
    <!-- 왕관 보석 -->
    <circle cx="80" cy="85" r="8" fill="#EC4899"/>
    <circle cx="120" cy="55" r="10" fill="#3B82F6"/>
    <circle cx="160" cy="85" r="8" fill="#10B981"/>
  </g>

  <!-- 잠자는 Z 표시 -->
  <text x="370" y="180" font-size="60" font-weight="800" fill="rgba(255,255,255,0.6)"
        font-family="sans-serif">Z</text>
  <text x="400" y="140" font-size="40" font-weight="800" fill="rgba(255,255,255,0.4)"
        font-family="sans-serif">z</text>

  <!-- 하단 텍스트 -->
  <text x="256" y="430" text-anchor="middle" font-size="48" font-weight="800"
        fill="white" font-family="sans-serif" letter-spacing="2">
    QUEENS
  </text>
</svg>
```

> ⚠️ 위 SVG는 초안입니다. 실제 구현 시 Gemini generate_image 등으로 디자인을 먼저 확정한 후,
> 해당 디자인을 SVG로 트레이싱하거나, SVG 코드를 직접 정교하게 작성합니다.

### 5-5. PNG 폴백 생성

SVG에서 PNG를 생성하는 방법:
```bash
# 방법 1: Inkscape CLI (설치 필요)
inkscape icon.svg --export-type=png --export-width=192 -o icon-192.png
inkscape icon.svg --export-type=png --export-width=512 -o icon-512.png

# 방법 2: sharp (Node.js)
npm install sharp
node -e "const sharp = require('sharp'); sharp('icon.svg').resize(192).png().toFile('icon-192.png'); sharp('icon.svg').resize(512).png().toFile('icon-512.png');"

# 방법 3: 온라인 변환기 사용
```

### 5-6. 삼성 인터넷 최적화 참고

| 항목 | 요구사항 |
|------|----------|
| manifest.json | 필수 - `name`, `icons`, `start_url`, `display` |
| 아이콘 최소 크기 | 192×192 PNG (삼성 인터넷 기본) |
| 권장 아이콘 크기 | 512×512 PNG (고해상도 디바이스) |
| SVG 아이콘 | 지원됨 (삼성 인터넷 14+) |
| maskable 아이콘 | `purpose: "maskable"` 설정 시 안전 영역(아이콘의 80% 중앙) 내에 핵심 요소 배치 |
| theme-color | 상태바 색상 - `#6D28D9` (보라색) |
| display: standalone | 브라우저 UI 숨기고 앱처럼 표시 |

### 5-7. 파일 구조
```
client/
├── icons/
│   ├── icon.svg           # 🆕 벡터 앱 아이콘 (메인)
│   ├── icon-192.png       # 🆕 192×192 PNG 폴백
│   ├── icon-512.png       # 🆕 512×512 PNG 폴백
│   └── favicon.ico        # 🆕 브라우저 탭 아이콘 (선택)
├── manifest.json          # 🆕 플레이어용 PWA manifest
├── manifest-table.json    # 🆕 테이블용 PWA manifest
└── ...
```

---

## 6. 새 프로젝트 구조

### Vercel 배포 후 구조
```
TableGame/
├── client/                    # ← Vercel에 배포 (정적 사이트)
│   ├── icons/                 # 🆕 PWA 앱 아이콘
│   │   ├── icon.svg           # 🆕 벡터 앱 아이콘
│   │   ├── icon-192.png       # 🆕 192px PNG
│   │   └── icon-512.png       # 🆕 512px PNG
│   ├── manifest.json          # 🆕 플레이어용 PWA manifest
│   ├── manifest-table.json    # 🆕 테이블용 PWA manifest
│   ├── shared/
│   │   ├── socket.js          # 🔧 원격 서버 URL 연결로 수정
│   │   ├── cards.js
│   │   ├── env.js             # 🆕 환경변수 관리
│   │   └── styles/
│   │       ├── common.css     # 🔧 디자인 시스템 대폭 업데이트
│   │       ├── cards.css      # 🔧 카드 효과 추가
│   │       └── animations.css # 🔧 새 애니메이션 추가
│   ├── table/
│   │   ├── index.html         # 🔧 UI 구조 + manifest 연결
│   │   ├── table.js           # 🔧 새 효과 로직
│   │   └── table.css          # 🔧 레이아웃 개선
│   └── player/
│       ├── index.html         # 🔧 UI 구조 + manifest 연결
│       ├── join.html          # 🔧 환영 화면 + manifest 연결
│       ├── player.js          # 🔧 새 인터랙션
│       └── player.css         # 🔧 레이아웃 개선
│
├── server/                    # ← Render에 배포 (Node.js 서비스)
│   ├── index.js               # 🔧 CORS, URL 설정 변경
│   ├── game/
│   │   ├── GameManager.js     # 🔧 QR URL, 결과 기록 방식 변경
│   │   ├── GameState.js
│   │   ├── CardDeck.js
│   │   └── GameRules.js
│   └── package.json
│
├── assets/
│   └── images/
│       └── cards/
│           ├── raw/           # Z-Image Turbo 원본
│           ├── processed/     # 처리된 이미지
│           └── *.png          # 🔧 Z-Image Turbo로 전체 재생성
│
├── vercel.json                # 🆕 Vercel 배포 설정
├── render.yaml                # 🆕 Render 배포 설정 (선택)
└── SLEEPING_QUEENS_PLAN.md    # 이 문서
```

---

## 7. 실행 순서 및 체크리스트

### Step 1: Z-Image Turbo 카드 이미지 생성 (가장 먼저)
> 이미지 생성은 시간이 걸리므로 먼저 시작

- [ ] ComfyUI + Z-Image Turbo 실행 확인
- [ ] 공통 스타일 프롬프트 확정 (테스트 이미지 2~3장)
- [ ] 퀸 카드 12장 생성
- [ ] 액션 카드 5장 생성
- [ ] 숫자 카드 10장 생성
- [ ] 킹/기사 변종 11장 생성
- [ ] process_cards.py로 일괄 리사이즈
- [ ] 결과물 확인 및 교체

### Step 2: 서버 코드 Vercel/Render 호환 수정
- [ ] `server/index.js` CORS 설정 추가
- [ ] `GameManager.js` QR URL을 환경변수 기반으로 변경
- [ ] `GameManager.js` 결과 기록 방식 변경 (파일→로그/DB)
- [ ] `server/` 정적 파일 서빙 코드 제거 (Vercel이 담당)
- [ ] 로컬 테스트로 백엔드 단독 동작 확인

### Step 3: 프론트엔드 Vercel 배포 준비
- [ ] `socket.js` 원격 서버 연결 코드로 수정
- [ ] `vercel.json` 생성 (라우팅 설정)
- [ ] 환경변수 주입 방식 결정 및 구현
- [ ] HTML 파일들의 정적 리소스 경로 확인
- [ ] Vercel에 프로젝트 연결 및 배포

### Step 4: 백엔드 Render 배포
- [ ] Render 계정 생성 및 서비스 설정
- [ ] GitHub 연결 → 자동 배포
- [ ] 환경변수 설정 (FRONTEND_URL)
- [ ] WebSocket 연결 테스트

### Step 5: UI 개선 적용
- [ ] `common.css` 디자인 시스템 업데이트 (다크 배경 테마)
- [ ] `cards.css` 카드 효과 추가 (홀로그래피, 3D 뒤집기)
- [ ] `animations.css` 새 애니메이션 추가 (퀸 깨우기 등)
- [ ] 테이블 화면 레이아웃 개선
- [ ] 플레이어 화면 레이아웃 개선
- [ ] 참가 화면 디자인 개선
- [ ] 모바일/태블릿 반응형 테스트

### Step 5.5: PWA 앱 아이콘 추가
- [ ] `icon.svg` 디자인 및 제작 (왕관 + 잠자는 Z 컨셉)
- [ ] SVG → PNG 변환 (192px, 512px)
- [ ] `manifest.json` 생성 (플레이어용)
- [ ] `manifest-table.json` 생성 (테이블용)
- [ ] 모든 HTML `<head>`에 manifest, theme-color, apple-touch-icon 연결
- [ ] 삼성 인터넷에서 "홈 화면에 추가" 테스트
- [ ] 아이콘이 maskable 안전 영역 내에 잘 표시되는지 확인

### Step 6: 통합 테스트
- [ ] Vercel 프론트 + Render 백엔드 연결 확인
- [ ] 멀티 디바이스 게임 진행 테스트
- [ ] QR 코드 스캔 → 참가 → 게임 완료 풀 플로우
- [ ] 재접속 복구 테스트
- [ ] 새 카드 이미지 로딩 확인

---

## 8. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| Render 무료 cold start (30~60초) | 첫 연결 대기 시간 | 사전에 ping 보내기, 또는 $7/월 상시 가동 |
| Z-Image Turbo 스타일 불일치 | 카드 간 톤 차이 | img2img로 기존 이미지 참조, seed 고정 |
| Socket.IO 크로스 도메인 이슈 | 연결 실패 | CORS 정확히 설정, credentials 처리 |
| 로컬 모드 필요 시 | 인터넷 없는 교실 | 기존 로컬 모드 코드 분기로 유지 |

---

## 9. 로컬/온라인 듀얼 모드 (보너스)

교실에서 인터넷 없이도 사용할 수 있도록 **듀얼 모드** 유지:

```javascript
// env.js - 모드 감지
const isLocal = window.location.hostname === 'localhost'
             || window.location.hostname.startsWith('192.168');

const BACKEND_URL = isLocal
  ? `http://${window.location.hostname}:3000`
  : 'https://sleeping-queens-server.onrender.com';
```

이렇게 하면:
- **교실**: `start.bat` 실행 → 로컬 IP로 접속 (기존과 동일)
- **온라인**: Vercel URL로 접속 → Render 서버에 자동 연결

---

*최종 수정: 2026-02-21*
*버전: 2.0*
