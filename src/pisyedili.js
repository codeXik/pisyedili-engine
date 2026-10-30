// Pis Yedili rules without any DOM. 2 to 4 players, one 52-card deck, no jokers; a card is 'S14' = suit + rank
// (J 11, Q 12, K 13, A 14). Seats are 0..n-1 in the order of play; with 4 players seat 0 is bottom, 1 right, 2 top, 3 left.
//
// Rules (CLAUDE.md §6): 7 cards each, the next card opens the table. The first card played must be a club
// (no club in hand: draw until one comes) and has no special effect. Then play the same suit (the current colour)
// or the same rank, else draw 1. Jack: always playable, the player picks the colour. 7: the next player draws 3
// (a 7 on a 7 stacks, count x 3). 8: next player is skipped. 10: direction reverses. Ace: everyone else draws 1.
// With 2 cards in hand call TEK before playing one, otherwise draw 2. First to empty their hand wins the hand.

export const SUITS = ['S', 'H', 'D', 'C'];
export const suitOf = (c) => c[0];
export const rankOf = (c) => Number(c.slice(1));
export const isJack = (c) => rankOf(c) === 11;

export const HAND_SIZE = 7;
export const SEVEN_PENALTY = 3;
export const TEK_PENALTY = 2;
export const DEFAULT_TARGET = 101;

export const newDeck = () => SUITS.flatMap((s) => Array.from({ length: 13 }, (_, i) => `${s}${i + 2}`));

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Penalty points of a card left in hand (scored mode): ace 11, jack 25, king and queen 10, 2-10 their number.
export function cardPenalty(c) {
  const r = rankOf(c);
  if (r === 14) return 11;
  if (r === 11) return 25;
  if (r === 12 || r === 13) return 10;
  return r;
}
export const penaltyPoints = (cards) => cards.reduce((n, c) => n + cardPenalty(c), 0);

export class PisYediliHand {
  // `seats` are the seat numbers still in the match (all of them unless some were knocked out);
  // `dealer` deals and the next seat leads. `state` restores a saved hand.
  constructor({ players = 2, seats, dealer, rng = Math.random, state } = {}) {
    if (state) {
      Object.assign(this, structuredClone(state));
      this.rng = rng;
      return;
    }
    this.rng = rng;
    this.n = players;
    this.seats = seats ? seats.slice().sort((a, b) => a - b) : Array.from({ length: players }, (_, i) => i);
    this.dealer = dealer ?? this.seats[this.seats.length - 1];
    this.deck = shuffle(newDeck(), rng);
    this.hands = Array.from({ length: players }, () => []);
    this.discard = [];
    this.dir = 1; // +1 clockwise, -1 after a 10
    this.pending = 0; // stacked 7s waiting for the next player
    this.tekCalled = new Array(players).fill(false);
    this.phase = 'play';
    this.opening = true; // the first card played must be a club and does nothing special
    this.seq = 0; // actions so far
    this.lastAction = null; // { seq, seat, type: 'play'|'draw', card, color, drew: [cards drawn per seat], tekPenalty }
    this.winner = null;
    this.penalties = null; // points left in each seat's hand when the hand ends
    this.deal();
  }

  deal() {
    const order = this.fromSeat(this.dealer, 1);
    for (let i = 0; i < HAND_SIZE; i++) for (const s of order) this.hands[s].push(this.deck.shift());
    const open = this.deck.shift();
    this.discard.push(open);
    this.color = suitOf(open);
    this.turn = order[0];
  }

  // Active seats in play order starting with the one `steps` after `seat` (a full lap).
  fromSeat(seat, steps = 1) {
    const k = this.seats.length;
    const at = this.seats.indexOf(seat);
    return Array.from({ length: k }, (_, i) => this.seats[(((at + this.dir * (steps + i)) % k) + k) % k]);
  }
  nextSeat(seat, steps = 1) { return this.fromSeat(seat, steps)[0]; }

  get top() { return this.discard[this.discard.length - 1]; }

  legalCards(seat) {
    if (this.phase !== 'play' || this.turn !== seat) return [];
    const hand = this.hands[seat];
    if (this.opening) return hand.filter((c) => suitOf(c) === 'C');
    if (this.pending) return hand.filter((c) => rankOf(c) === 7);
    const top = this.top;
    return hand.filter((c) => isJack(c) || suitOf(c) === this.color || rankOf(c) === rankOf(top));
  }

  // Takes up to `k` cards from the deck for `seat`; when the deck runs dry the discard pile (but its top) is reshuffled.
  drawFor(seat, k) {
    const got = [];
    while (got.length < k) {
      if (!this.deck.length) {
        if (this.discard.length < 2) break;
        const top = this.discard.pop();
        this.deck = shuffle(this.discard, this.rng);
        this.discard = [top];
      }
      got.push(this.deck.shift());
    }
    this.hands[seat].push(...got);
    this.tekCalled[seat] = false;
    return got;
  }

  // Plays a card; a jack needs the colour (S, H, D or C) it turns the table into.
  // Returns { ok, drew } where drew counts the cards every seat had to draw because of this card.
  play(seat, card, color) {
    if (this.phase !== 'play') return { ok: false, error: 'done' };
    if (seat !== this.turn) return { ok: false, error: 'notYourTurn' };
    if (!this.hands[seat].includes(card)) return { ok: false, error: 'noCard' };
    if (!this.legalCards(seat).includes(card)) return { ok: false, error: 'illegal' };
    if (isJack(card) && !SUITS.includes(color)) return { ok: false, error: 'needColor' };

    const hand = this.hands[seat];
    hand.splice(hand.indexOf(card), 1);
    this.discard.push(card);
    this.color = isJack(card) ? color : suitOf(card);
    const drew = new Array(this.n).fill(0);
    let steps = 1;
    if (!this.opening) {
      const r = rankOf(card);
      if (r === 7) this.pending++;
      else if (r === 8) steps = 2;
      else if (r === 10) this.dir = -this.dir;
      else if (r === 14) for (const s of this.fromSeat(seat, 1)) if (s !== seat) drew[s] += this.drawFor(s, 1).length;
    }
    this.opening = false;

    let tekPenalty = 0;
    if (hand.length === 1 && !this.tekCalled[seat]) tekPenalty = (drew[seat] = this.drawFor(seat, TEK_PENALTY).length);
    this.tekCalled[seat] = false;

    this.lastAction = { seq: ++this.seq, seat, type: 'play', card, color: this.color, drew, tekPenalty };
    if (hand.length === 0) this.finish(seat);
    else this.turn = this.nextSeat(seat, steps);
    return { ok: true, drew, tekPenalty };
  }

  // The player on turn has nothing to play (or must take the stacked 7s, or has no club yet) and draws.
  // Returns { ok, cards } with the cards the player received.
  draw(seat) {
    if (this.phase !== 'play') return { ok: false, error: 'done' };
    if (seat !== this.turn) return { ok: false, error: 'notYourTurn' };
    const drew = new Array(this.n).fill(0);
    let cards;
    if (this.opening) {
      if (this.hands[seat].some((c) => suitOf(c) === 'C')) return { ok: false, error: 'hasPlay' };
      cards = [];
      while (!cards.some((c) => suitOf(c) === 'C')) { // keep drawing until a club shows up
        const one = this.drawFor(seat, 1);
        if (!one.length) break;
        cards.push(...one);
      }
      drew[seat] = cards.length;
      this.lastAction = { seq: ++this.seq, seat, type: 'draw', card: null, color: this.color, drew, tekPenalty: 0 };
      if (!cards.some((c) => suitOf(c) === 'C')) this.turn = this.nextSeat(seat); // no club left anywhere: do not stall
      return { ok: true, cards };
    }
    if (this.pending) {
      cards = this.drawFor(seat, this.pending * SEVEN_PENALTY);
      this.pending = 0;
    } else {
      if (this.legalCards(seat).length) return { ok: false, error: 'hasPlay' };
      cards = this.drawFor(seat, 1);
    }
    drew[seat] = cards.length;
    this.lastAction = { seq: ++this.seq, seat, type: 'draw', card: null, color: this.color, drew, tekPenalty: 0 };
    this.turn = this.nextSeat(seat);
    return { ok: true, cards };
  }

  // "TEK": announce the last-but-one card. Only valid while holding exactly 2 cards.
  tek(seat) {
    if (this.phase !== 'play') return { ok: false, error: 'done' };
    if (this.hands[seat].length !== 2) return { ok: false, error: 'notTwo' };
    this.tekCalled[seat] = true;
    return { ok: true };
  }

  finish(winner) {
    this.phase = 'done';
    this.winner = winner;
    this.penalties = this.hands.map((h, s) => (s === winner ? 0 : penaltyPoints(h)));
  }

  // What `seat` may see: its own cards, the top of the table, sizes of everything else.
  view(seat) {
    const done = this.phase === 'done';
    return {
      n: this.n,
      seats: this.seats.slice(),
      phase: this.phase,
      turn: this.turn,
      dealer: this.dealer,
      dir: this.dir,
      seq: this.seq,
      hand: this.hands[seat].slice(),
      handSizes: this.hands.map((h) => h.length),
      top: this.top,
      color: this.color,
      pending: this.pending,
      opening: this.opening,
      deckCount: this.deck.length,
      discardCount: this.discard.length,
      tek: this.tekCalled.slice(),
      legal: this.legalCards(seat),
      lastAction: this.lastAction && { ...this.lastAction, drew: this.lastAction.drew.slice() },
      winner: this.winner,
      penalties: done ? this.penalties.slice() : null,
      hands: done ? this.hands.map((h) => h.slice()) : null, // everybody shows their leftovers at the end
    };
  }

  toJSON() {
    const { rng, ...rest } = this;
    return structuredClone(rest);
  }
  static fromJSON(state, rng) { return new PisYediliHand({ state, rng }); }
}

export class PisYediliMatch {
  // settings: { players: 2..4, scored, targetScore }. Unscored: one hand decides. Scored: the points left in hand
  // are added up and whoever reaches the target drops out; the last one in (the lowest score) wins.
  constructor({ settings = {}, rng = Math.random, state } = {}) {
    this.rng = rng;
    if (state) {
      Object.assign(this, structuredClone(state), { rng });
      this.hand = state.hand ? PisYediliHand.fromJSON(state.hand, rng) : null;
      return;
    }
    const players = Math.min(4, Math.max(2, settings.players | 0 || 2));
    this.settings = { players, scored: !!settings.scored, targetScore: settings.targetScore ?? DEFAULT_TARGET };
    this.scores = new Array(players).fill(0);
    this.out = new Array(players).fill(false);
    this.rounds = []; // { winner, penalties } per finished hand
    this.ended = false; // the match was stopped early (the human dropped out: nobody is left to play for)
    this.dealer = players - 1; // so seat 0, the human who made the room, leads the first hand
    this.hand = null;
  }

  get n() { return this.settings.players; }
  get active() { return this.out.map((o, s) => (o ? -1 : s)).filter((s) => s >= 0); }

  startRound() {
    const seats = this.active;
    // the dealer is the previous active seat, so the lead moves on by one each hand
    this.hand = new PisYediliHand({ players: this.n, seats, dealer: this.dealer, rng: this.rng });
    return this.hand;
  }

  // Adds the finished hand to the totals.
  finishRound() {
    const h = this.hand;
    if (!h || h.phase !== 'done') return false;
    this.rounds.push({ winner: h.winner, penalties: h.penalties.slice() });
    if (this.settings.scored) {
      h.penalties.forEach((p, s) => {
        this.scores[s] += p;
        if (this.scores[s] >= this.settings.targetScore) this.out[s] = true;
      });
    }
    const seats = this.active;
    this.dealer = seats.length ? seats[(seats.indexOf(this.dealer) + 1) % seats.length] ?? seats[0] : this.dealer;
    this.hand = null;
    return true;
  }

  get over() {
    if (!this.rounds.length) return false;
    return this.settings.scored ? this.ended || this.active.length <= 1 : true;
  }
  // Stops a scored match now; the lowest score wins.
  endNow() { this.ended = true; }
  // The winning seat.
  get winner() {
    if (!this.over) return null;
    if (!this.settings.scored) return this.rounds[this.rounds.length - 1].winner;
    const left = this.active;
    if (left.length === 1 && !this.ended) return left[0];
    return this.scores.indexOf(Math.min(...this.scores)); // everybody dropped out at once, or it was stopped early
  }
  // Standings, best first: [{ seat, score, out, place }]
  get standings() {
    const w = this.winner;
    const last = this.rounds.length ? this.rounds[this.rounds.length - 1].penalties : this.scores;
    const key = (s) => (this.settings.scored ? this.scores[s] : last[s]);
    const list = this.scores.map((score, seat) => ({ seat, score, out: this.out[seat] }))
      .sort((a, b) => (a.seat === w ? -1 : b.seat === w ? 1 : key(a.seat) - key(b.seat) || a.seat - b.seat));
    return list.map((x, i) => ({ ...x, place: i + 1 }));
  }

  view(seat) {
    return {
      settings: { ...this.settings },
      scores: this.scores.slice(),
      out: this.out.slice(),
      rounds: this.rounds.map((r) => ({ winner: r.winner, penalties: r.penalties.slice() })),
      over: this.over,
      winner: this.winner,
      standings: this.standings,
      hand: this.hand ? this.hand.view(seat) : null,
    };
  }

  toJSON() {
    const { rng, hand, ...rest } = this;
    return structuredClone({ ...rest, hand: hand ? hand.toJSON() : null });
  }
  static fromJSON(state, rng) { return new PisYediliMatch({ state, rng }); }
}
