import test from 'node:test';
import assert from 'node:assert/strict';
import { PisYediliHand, PisYediliMatch, newDeck, cardPenalty } from '../src/pisyedili.js';

const seeded = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

// A hand past the opening, with the table and every seat's cards set by hand. Seat 0 is on turn.
function rigged({ top = 'H5', color, hands, deck, players = hands.length, seats, opening = false }) {
  const h = new PisYediliHand({ players, seats, rng: seeded(1) });
  h.hands = Array.from({ length: players }, (_, i) => (hands[i] || []).slice());
  h.deck = deck ?? ['S2', 'S3', 'S4', 'S5', 'S6', 'S9', 'D2', 'D3', 'D4', 'D6'];
  h.discard = [top];
  h.color = color ?? top[0];
  h.turn = seats ? seats[0] : 0;
  h.opening = opening;
  h.pending = 0;
  h.dir = 1;
  return h;
}

test('deck has 52 distinct cards', () => {
  assert.equal(new Set(newDeck()).size, 52);
});

test('a deal: 7 each, one card opens the table, the rest is the deck, the next seat leads', () => {
  for (let players = 2; players <= 4; players++) {
    const h = new PisYediliHand({ players, dealer: players - 1, rng: seeded(players) });
    assert.ok(h.hands.every((x) => x.length === 7));
    assert.equal(h.discard.length, 1);
    assert.equal(h.deck.length, 52 - 7 * players - 1);
    assert.equal(h.turn, 0);
    assert.equal(h.color, h.top[0]);
    assert.ok(h.opening);
  }
});

test('opening: only a club may start, and it has no special effect', () => {
  const h = rigged({ opening: true, hands: [['C7', 'H7'], ['D2', 'D3']] });
  assert.deepEqual(h.legalCards(0), ['C7']);
  assert.equal(h.play(0, 'H7').ok, false);
  const r = h.play(0, 'C7');
  assert.ok(r.ok);
  assert.equal(h.pending, 0); // the 7 did nothing
  assert.equal(h.turn, 1);
  assert.equal(h.color, 'C');
  assert.equal(h.opening, false);
});

test('opening: without a club you draw until one comes, then still hold the turn', () => {
  const h = rigged({ opening: true, hands: [['H2', 'H3'], ['D2']], deck: ['S2', 'D9', 'C6', 'S8'] });
  assert.equal(h.legalCards(0).length, 0);
  const r = h.draw(0);
  assert.deepEqual(r.cards, ['S2', 'D9', 'C6']);
  assert.equal(h.turn, 0);
  assert.deepEqual(h.legalCards(0), ['C6']);
  assert.equal(h.draw(0).ok, false); // now it has a club
});

test('same suit or same rank may be played, anything else not', () => {
  const h = rigged({ top: 'H5', hands: [['H9', 'S5', 'S9', 'D12'], ['C2']] });
  assert.deepEqual(h.legalCards(0).sort(), ['H9', 'S5']);
  assert.equal(h.play(0, 'S9').error, 'illegal');
  assert.equal(h.play(1, 'C2').error, 'notYourTurn');
  assert.equal(h.play(0, 'C3').error, 'noCard');
});

test('no playable card: draw exactly 1 and the turn passes; drawing is refused when you can play', () => {
  let h = rigged({ top: 'H5', hands: [['S9', 'D8'], ['C2']] });
  const r = h.draw(0);
  assert.equal(r.cards.length, 1);
  assert.equal(h.hands[0].length, 3);
  assert.equal(h.turn, 1);
  h = rigged({ top: 'H5', hands: [['H9', 'D8'], ['C2']] });
  assert.equal(h.draw(0).error, 'hasPlay');
});

test('jack is always playable and sets the colour', () => {
  const h = rigged({ top: 'H5', hands: [['S11', 'D2'], ['D9', 'C9']] });
  assert.ok(h.legalCards(0).includes('S11'));
  assert.equal(h.play(0, 'S11').error, 'needColor');
  assert.ok(h.play(0, 'S11', 'D').ok);
  assert.equal(h.color, 'D');
  assert.deepEqual(h.legalCards(1), ['D9']);
});

test('7: the next player draws 3 and 7s stack (count x 3); only a 7 may be played on it', () => {
  const h = rigged({ top: 'H5', hands: [['H7', 'D2', 'D3'], ['S7', 'H9', 'D4'], ['C2', 'C3', 'C4']], players: 3 });
  h.play(0, 'H7');
  assert.equal(h.pending, 1);
  assert.deepEqual(h.legalCards(1), ['S7']);
  assert.equal(h.draw(1).cards.length, 3); // takes the penalty, not 1
  assert.equal(h.pending, 0);
  assert.equal(h.turn, 2);

  const g = rigged({ top: 'H5', hands: [['H7', 'D2', 'D3'], ['S7', 'H9', 'D4'], ['C2', 'C3', 'C4']], players: 3 });
  g.play(0, 'H7');
  g.play(1, 'S7');
  assert.equal(g.pending, 2);
  assert.equal(g.draw(2).cards.length, 6);
  assert.equal(g.pending, 0);
});

test('8 skips the next player; with two players the same player goes again', () => {
  let h = rigged({ top: 'H5', hands: [['H8', 'D2', 'D3'], ['S7'], ['C2']], players: 3 });
  h.play(0, 'H8');
  assert.equal(h.turn, 2);
  h = rigged({ top: 'H5', hands: [['H8', 'D2', 'D3'], ['S7']] });
  h.play(0, 'H8');
  assert.equal(h.turn, 0);
});

test('10 reverses the direction', () => {
  const h = rigged({ top: 'H5', hands: [['H10', 'D2', 'D3'], ['S7'], ['C2'], ['C3']], players: 4 });
  h.play(0, 'H10');
  assert.equal(h.dir, -1);
  assert.equal(h.turn, 3);
});

test('ace: everybody else draws 1, the player does not', () => {
  const h = rigged({ top: 'H5', hands: [['H14', 'D2', 'D3'], ['S7'], ['C2']], players: 3 });
  const r = h.play(0, 'H14');
  assert.deepEqual(r.drew, [0, 1, 1]);
  assert.deepEqual(h.hands.map((x) => x.length), [2, 2, 2]);
  assert.equal(h.turn, 1);
});

test('TEK: playing down to 1 card without calling draws 2, calling avoids it', () => {
  let h = rigged({ top: 'H5', hands: [['H9', 'D2'], ['S7']] });
  let r = h.play(0, 'H9');
  assert.equal(r.tekPenalty, 2);
  assert.equal(h.hands[0].length, 3);
  h = rigged({ top: 'H5', hands: [['H9', 'D2'], ['S7']] });
  assert.ok(h.tek(0).ok);
  r = h.play(0, 'H9');
  assert.equal(r.tekPenalty, 0);
  assert.equal(h.hands[0].length, 1);
  h = rigged({ top: 'H5', hands: [['H9', 'D2', 'D3'], ['S7']] });
  assert.equal(h.tek(0).error, 'notTwo');
});

test('emptying the hand wins and the others show their leftovers as penalty points', () => {
  const h = rigged({ top: 'H5', hands: [['H9'], ['S14', 'S11', 'D12', 'D4'], ['C2']], players: 3 });
  h.tekCalled[0] = true;
  h.play(0, 'H9');
  assert.equal(h.phase, 'done');
  assert.equal(h.winner, 0);
  assert.deepEqual(h.penalties, [0, 11 + 25 + 10 + 4, 2]);
  assert.equal(h.play(1, 'S14').error, 'done');
});

test('card penalty values', () => {
  assert.deepEqual(['S14', 'S11', 'S12', 'S13', 'S10', 'S2'].map(cardPenalty), [11, 25, 10, 10, 10, 2]);
});

test('empty deck: the discard pile (minus its top) is reshuffled, nothing is lost', () => {
  const h = rigged({ top: 'H5', hands: [['S9', 'D8'], ['C2']], deck: ['S2'] });
  h.discard = ['C3', 'C4', 'C6', 'H5'];
  const r = h.draw(0); // draws S2, deck empty now
  assert.deepEqual(r.cards, ['S2']);
  const g = rigged({ top: 'H5', hands: [['S9', 'D8'], ['C2']], deck: [] });
  g.discard = ['C3', 'C4', 'C6', 'H5'];
  const q = g.draw(0);
  assert.equal(q.cards.length, 1);
  assert.deepEqual(g.discard, ['H5']);
  assert.equal(g.deck.length + g.hands.flat().length + g.discard.length, 2 + 1 + 3 + 1);
});

test('a full random game of random legal moves always ends and keeps all 52 cards', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const rng = seeded(seed);
    const players = 2 + (seed % 3);
    const h = new PisYediliHand({ players, rng });
    let guard = 0;
    while (h.phase === 'play' && guard++ < 5000) {
      const seat = h.turn;
      if (h.hands[seat].length === 2 && rng() < 0.9) h.tek(seat);
      const legal = h.legalCards(seat);
      if (!legal.length) { assert.ok(h.draw(seat).ok); continue; }
      const card = legal[Math.floor(rng() * legal.length)];
      assert.ok(h.play(seat, card, 'SHDC'[Math.floor(rng() * 4)]).ok);
      assert.equal(h.deck.length + h.discard.length + h.hands.flat().length, 52);
    }
    assert.equal(h.phase, 'done', `seed ${seed} did not finish`);
  }
});

test('unscored match: one hand decides', () => {
  const m = new PisYediliMatch({ settings: { players: 2 }, rng: seeded(3) });
  const h = m.startRound();
  h.hands[0] = ['H9']; h.tekCalled[0] = true; h.discard = ['H5']; h.color = 'H'; h.opening = false; h.turn = 0;
  h.play(0, 'H9');
  assert.ok(m.finishRound());
  assert.ok(m.over);
  assert.equal(m.winner, 0);
});

test('scored match: reaching the target drops a player, the last one in wins', () => {
  const m = new PisYediliMatch({ settings: { players: 3, scored: true, targetScore: 30 }, rng: seeded(5) });
  const play = (winner, left) => {
    const h = m.startRound();
    const seat = h.turn;
    h.opening = false; h.discard = ['H5']; h.color = 'H';
    h.hands = h.hands.map((_, s) => (s === seat ? ['H9'] : (left[s] || []).slice()));
    h.hands[winner === undefined ? seat : winner] = ['H9'];
    h.turn = h.hands.findIndex((x) => x.length === 1 && x[0] === 'H9');
    h.tekCalled[h.turn] = true;
    h.play(h.turn, 'H9');
    m.finishRound();
  };
  play(0, { 1: ['S14', 'S13'], 2: ['S5'] }); // 1: 21, 2: 5
  assert.ok(!m.over);
  assert.deepEqual(m.scores, [0, 21, 5]);
  play(0, { 1: ['S14'], 2: ['S11'] }); // 1: 32 out, 2: 30 out
  assert.deepEqual(m.out, [false, true, true]);
  assert.ok(m.over);
  assert.equal(m.winner, 0);
  assert.equal(m.standings[0].seat, 0);
});

test('a scored match can be stopped early: the lowest score wins', () => {
  const m = new PisYediliMatch({ settings: { players: 3, scored: true, targetScore: 30 }, rng: seeded(6) });
  const h = m.startRound();
  h.hands = [['S14', 'S13', 'S12'], ['H9'], ['C2']];
  h.opening = false; h.discard = ['H5']; h.color = 'H'; h.turn = 1; h.tekCalled[1] = true;
  h.play(1, 'H9');
  m.finishRound();
  assert.deepEqual(m.scores, [31, 0, 2]);
  assert.deepEqual(m.out, [true, false, false]);
  assert.ok(!m.over); // two still in
  m.endNow();
  assert.ok(m.over);
  assert.equal(m.winner, 1);
});

test('a hand and a match survive a JSON round trip', () => {
  const m = new PisYediliMatch({ settings: { players: 4, scored: true }, rng: seeded(9) });
  m.startRound();
  m.hand.play(m.hand.turn, m.hand.legalCards(m.hand.turn)[0] ?? 'X', 'H');
  const copy = PisYediliMatch.fromJSON(JSON.parse(JSON.stringify(m.toJSON())), seeded(9));
  assert.deepEqual(copy.view(0), m.view(0));
});

// ---- computer player ----
import { botAction } from '../src/bot.js';

// Plays one whole hand with `levels[seat]` deciding for each seat; returns the winner.
function botGame(levels, rng) {
  const h = new PisYediliHand({ players: levels.length, rng });
  let guard = 0;
  while (h.phase === 'play' && guard++ < 5000) {
    const seat = h.turn;
    const a = botAction(h.view(seat), { level: levels[seat], seat, rng });
    if (a.action === 'draw') { assert.ok(h.draw(seat).ok, 'bot drew when it could not'); continue; }
    if (a.tek) assert.ok(h.tek(seat).ok);
    assert.ok(h.play(seat, a.card, a.color).ok, `illegal bot move ${a.card}`);
  }
  assert.equal(h.phase, 'done');
  return h.winner;
}

test('bots of every level only make legal moves and always finish, for 2 to 4 players', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const rng = seeded(seed);
    const levels = ['kolay', 'normal', 'zor', 'normal'].slice(0, 2 + (seed % 3));
    botGame(levels, rng);
  }
});

test('the bot draws when it has nothing to play and takes stacked 7s', () => {
  const h = rigged({ top: 'H5', hands: [['S9', 'D8'], ['C2']] });
  assert.equal(botAction(h.view(0), { seat: 0 }).action, 'draw');
  const g = rigged({ top: 'H7', hands: [['S9', 'D8'], ['C2']] });
  g.pending = 1;
  assert.equal(botAction(g.view(0), { seat: 0 }).action, 'draw');
});

test('the bot calls TEK with two cards, picks the colour it holds most of, and does not peek', () => {
  const h = rigged({ top: 'H5', hands: [['H9', 'D2'], ['C2', 'C3']] });
  const a = botAction(h.view(0), { level: 'zor', seat: 0 });
  assert.equal(a.tek, true);
  const j = rigged({ top: 'H5', hands: [['S11', 'D2', 'D3', 'D9'], ['C2']] });
  const b = botAction(j.view(0), { level: 'normal', seat: 0, rng: seeded(2) });
  assert.equal(b.card, 'S11');
  assert.equal(b.color, 'D');
  assert.equal('hands' in h.view(0) && h.view(0).hands !== null, false); // others' cards are not in the view
});

test('the strong level beats the easy one clearly over many games', () => {
  const rng = seeded(77);
  let zor = 0;
  const games = 400;
  for (let i = 0; i < games; i++) {
    const zorFirst = i % 2 === 0;
    const winner = botGame(zorFirst ? ['zor', 'kolay'] : ['kolay', 'zor'], rng);
    if ((winner === 0) === zorFirst) zor++;
  }
  assert.ok(zor / games > 0.6, `zor won only ${zor}/${games}`);
});
