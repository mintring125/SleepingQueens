# Halli Galli Digital Tabletop Game — Spec

## Summary
A standalone browser-based digital version of Halli Galli with Sanrio-style characters.
Designed for one tablet with 4 players sitting around it.

## Tech Stack
- Vanilla HTML5 + CSS3 + JavaScript (no framework, no build step)
- Touch Events API (multi-touch bell detection)
- CSS 3D Transforms (card flip animation)
- Web Audio API (synthesized sound effects — no external audio files)
- Vibration API, Screen Wake Lock API, Fullscreen API

## Characters (replacing fruits)
| Character | Color |
|-----------|-------|
| 키티냥 (Kitty Nyang) | Red |
| 푸딩독 (Pudding Dog) | Yellow |
| 멜로디번 (Melody Bun) | Pink |
| 시나롤 (Cinna Roll) | Sky blue |

## Deck: 56 cards (4 chars × 14 cards each)
Each character: 3×1, 3×2, 3×3, 3×4, 2×5 copies

## Layout
- P1: bottom (0°), Red
- P2: left (90°), Blue
- P3: top (180°), Green
- P4: right (-90°), Purple
- Center: Bell + 4 colored triangular zones

## Win Condition
Ring bell when any character's sum across all top revealed cards = exactly 5.
Last player with cards wins.
