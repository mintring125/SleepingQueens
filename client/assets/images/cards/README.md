# Sleeping Queens 카드 이미지 가이드

## 📁 폴더 구조
```
assets/images/cards/
├── raw/           # 원본 이미지 저장 폴더
├── processed/     # 처리된 이미지 저장 폴더
├── king.png
├── knight.png
├── dragon.png
├── potion.png
├── wand.png
├── queen_rose.png
├── queen_cat.png
├── queen_dog.png
├── queen_pancake.png
├── queen_sunflower.png
├── queen_rainbow.png
├── queen_moon.png
├── queen_star.png
├── queen_heart.png
├── queen_ladybug.png
├── queen_icecream.png
├── queen_book.png
├── queen_cake.png
├── queen_peacock.png
└── queen_starfish.png
```

## 🖼️ 이미지 규격
- **권장 크기**: 180 x 252 픽셀 (5:7 비율)
- **파일 형식**: PNG (투명 배경 가능)
- **해상도**: 72-150 dpi

## 🔧 이미지 처리 방법

### 방법 1: Python 스크립트 사용
1. 원본 이미지를 `assets/images/cards/raw/` 폴더에 저장
2. 파일명을 위 규칙에 맞게 변경 (예: `king.png`, `queen_rose.png`)
3. 터미널에서 실행:
   ```
   cd TableGame
   python process_cards.py
   ```
4. `assets/images/cards/processed/` 폴더에서 결과 확인
5. 처리된 이미지를 `assets/images/cards/` 폴더로 이동

### 방법 2: 수동 처리
1. 이미지 편집기(포토샵, GIMP, 미리캔버스 등)에서 열기
2. 불필요한 배경/여백 자르기
3. 180 x 252 픽셀로 리사이즈
4. PNG로 저장
5. `assets/images/cards/` 폴더에 올바른 이름으로 저장

## 📋 카드 타입별 파일명

### 액션 카드
| 타입 | 파일명 | 설명 |
|------|--------|------|
| 킹 | king.png | 잠자는 퀸 깨우기 |
| 기사 | knight.png | 다른 플레이어 퀸 훔치기 |
| 드래곤 | dragon.png | 기사 막기 |
| 포션 | potion.png | 퀸 재우기 |
| 마법봉 | wand.png | 포션 막기 |

### 퀸 카드
| 이름 | 파일명 | 점수 |
|------|--------|------|
| Rose Queen | queen_rose.png | 5점 |
| Cat Queen | queen_cat.png | 15점 |
| Dog Queen | queen_dog.png | 15점 |
| Pancake Queen | queen_pancake.png | 15점 |
| Sunflower Queen | queen_sunflower.png | 10점 |
| Rainbow Queen | queen_rainbow.png | 10점 |
| Moon Queen | queen_moon.png | 10점 |
| Star Queen | queen_star.png | 10점 |
| Heart Queen | queen_heart.png | 20점 |
| Ladybug Queen | queen_ladybug.png | 10점 |
| Ice Cream Queen | queen_icecream.png | 10점 |
| Book Queen | queen_book.png | 10점 |
| Cake Queen | queen_cake.png | 5점 |
| Peacock Queen | queen_peacock.png | 15점 |
| Starfish Queen | queen_starfish.png | 5점 |

## ⚠️ 참고 사항
- 이미지가 없으면 자동으로 이모지 기반 카드가 표시됩니다
- 파일명은 소문자로 정확히 맞춰주세요
- 서버 재시작 없이 브라우저 새로고침으로 확인 가능
