/**
 * CardDeck - Manages the card deck for Sleeping Queens game
 * Total cards: 64
 * - King: 8
 * - Knight: 4
 * - Sleeping Potion: 4
 * - Magic Wand: 4
 * - Dragon: 4
 * - Number cards (1-10): 40 (4 of each)
 */

class CardDeck {
  constructor() {
    this.drawPile = [];
    this.discardPile = [];
    this.createDeck();
    this.shuffle();
  }

  /**
   * Generate all 64 cards with unique IDs
   */
  createDeck() {
    const cards = [];

    // King cards (8)
    const kingVariants = ['bubblegum', 'chess', 'cookie', 'fire', 'puzzle', 'tiedye', 'turtle', 'bubblegum'];
    for (let i = 0; i < 8; i++) {
      cards.push({
        id: `king_${i + 1}`,
        type: 'king',
        value: null,
        variant: kingVariants[i],
        name: `King ${kingVariants[i].charAt(0).toUpperCase() + kingVariants[i].slice(1)}`
      });
    }

    // Knight cards (4)
    const knightVariants = ['dark', 'jester', 'red', 'robot'];
    for (let i = 0; i < 4; i++) {
      cards.push({
        id: `knight_${i + 1}`,
        type: 'knight',
        value: null,
        variant: knightVariants[i],
        name: `Knight ${knightVariants[i].charAt(0).toUpperCase() + knightVariants[i].slice(1)}`
      });
    }

    // Sleeping Potion cards (4)
    for (let i = 1; i <= 4; i++) {
      cards.push({
        id: `potion_${i}`,
        type: 'potion',
        value: null,
        name: 'Sleeping Potion'
      });
    }

    // Magic Wand cards (4)
    for (let i = 1; i <= 4; i++) {
      cards.push({
        id: `wand_${i}`,
        type: 'wand',
        value: null,
        name: 'Magic Wand'
      });
    }

    // Dragon cards (4)
    for (let i = 1; i <= 4; i++) {
      cards.push({
        id: `dragon_${i}`,
        type: 'dragon',
        value: null,
        name: 'Dragon'
      });
    }

    // Number cards (1-10, 4 of each = 40)
    for (let num = 1; num <= 10; num++) {
      for (let i = 1; i <= 4; i++) {
        cards.push({
          id: `number_${num}_${i}`,
          type: 'number',
          value: num,
          name: `Number ${num}`
        });
      }
    }

    this.drawPile = cards;
  }

  /**
   * Fisher-Yates shuffle the drawPile
   */
  shuffle() {
    for (let i = this.drawPile.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.drawPile[i], this.drawPile[j]] = [this.drawPile[j], this.drawPile[i]];
    }
  }

  /**
   * Draw cards from top of drawPile
   * @param {number} count - Number of cards to draw
   * @returns {Array} Array of drawn cards
   */
  draw(count = 1) {
    const drawnCards = [];

    for (let i = 0; i < count; i++) {
      // If draw pile is empty, reshuffle discard pile
      if (this.drawPile.length === 0) {
        this.reshuffleDiscard();

        // If still empty after reshuffle, no more cards available
        if (this.drawPile.length === 0) {
          break;
        }
      }

      // Draw from end (top) of pile
      const card = this.drawPile.pop();
      drawnCards.push(card);
    }

    return drawnCards;
  }

  /**
   * Add cards to discardPile
   * @param {Array|Object} cards - Single card or array of cards
   */
  discard(cards) {
    const cardsToDiscard = Array.isArray(cards) ? cards : [cards];
    this.discardPile.push(...cardsToDiscard);
  }

  /**
   * Move discardPile to drawPile and shuffle
   */
  reshuffleDiscard() {
    if (this.discardPile.length === 0) {
      return;
    }

    this.drawPile = [...this.discardPile];
    this.discardPile = [];
    this.shuffle();
  }

  /**
   * Get number of remaining cards in draw pile
   * @returns {number}
   */
  getDrawCount() {
    return this.drawPile.length;
  }

  /**
   * Get number of cards in discard pile
   * @returns {number}
   */
  getDiscardCount() {
    return this.discardPile.length;
  }

  /**
   * Return serializable state
   * @returns {Object} State object with counts
   */
  getState() {
    return {
      drawCount: this.getDrawCount(),
      discardCount: this.getDiscardCount()
    };
  }
}

module.exports = CardDeck;
