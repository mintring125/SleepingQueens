/**
 * KaribaRules.js - 사냥 로직, 생쥐 특수 규칙, 게임 종료 판정
 */
class KaribaRules {
  /**
   * 사냥 대상 타입을 반환 (없으면 null)
   * - 생쥐(1): 코끼리(8)만 사냥 가능
   * - 일반: 자기보다 낮은 번호 중 가장 가까운 카드 있는 슬롯
   */
  static getHuntTarget(cardType, wateringHole) {
    if (wateringHole[cardType].length < 3) return null;

    // 생쥐 특수 규칙: 코끼리만 사냥
    if (cardType === 1) {
      return wateringHole[8].length > 0 ? 8 : null;
    }

    // 일반 규칙: 바로 아래 번호부터 탐색
    for (let target = cardType - 1; target >= 1; target--) {
      if (wateringHole[target].length > 0) {
        return target;
      }
    }

    return null;
  }

  /**
   * 게임 종료 조건: 덱 소진 + 어떤 플레이어의 손패가 0장
   */
  static isGameOver(deck, players) {
    if (deck.remaining > 0) return false;
    return players.some(p => p.hand.length === 0);
  }

  /**
   * 획득 카드 장수가 가장 많은 플레이어 반환
   */
  static getWinner(players) {
    let winner = null;
    let max = -1;
    for (const p of players) {
      if (p.collected.length > max) {
        max = p.collected.length;
        winner = p;
      }
    }
    return winner;
  }

  /**
   * 모든 플레이어 점수 배열 반환 (장수 기준)
   */
  static getScores(players) {
    return players
      .map(p => ({ id: p.id, name: p.name, score: p.collected.length }))
      .sort((a, b) => b.score - a.score);
  }
}

module.exports = KaribaRules;
