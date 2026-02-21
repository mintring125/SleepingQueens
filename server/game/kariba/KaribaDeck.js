/**
 * KaribaDeck.js - 64장 카리바 덱 (8종 × 8장)
 */
class KaribaDeck {
  constructor() {
    this.cards = [];
    this._buildDeck();
    this._shuffle();
  }

  _buildDeck() {
    for (let type = 1; type <= 8; type++) {
      for (let i = 0; i < 8; i++) {
        this.cards.push({ type, id: `${type}_${i}` });
      }
    }
  }

  _shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw(count = 1) {
    const drawn = [];
    for (let i = 0; i < count && this.cards.length > 0; i++) {
      drawn.push(this.cards.pop());
    }
    return drawn;
  }

  get remaining() {
    return this.cards.length;
  }
}

module.exports = KaribaDeck;
