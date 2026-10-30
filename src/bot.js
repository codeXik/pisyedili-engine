// The computer player. It only gets what a real player sees (PisYediliHand.view(seat)): its own cards, the top of the
// table, the colour, and how many cards everybody else holds.
import { SUITS, suitOf, rankOf, isJack, cardPenalty } from './pisyedili.js';

export const LEVELS = { kolay: 'Kolay', normal: 'Normal', zor: 'Zor' };
// chance of remembering to call TEK with two cards left
const TEK_CHANCE = { kolay: 0.5, normal: 0.92, zor: 1 };

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

// The colour a jack should turn the table into: the suit the rest of the hand holds most of.
function bestColor(rest, rng) {
  const count = Object.fromEntries(SUITS.map((s) => [s, 0]));
  for (const c of rest) count[suitOf(c)]++;
  const top = Math.max(...Object.values(count));
  return pick(SUITS.filter((s) => count[s] === top), rng);
}

// Hand sizes of the player who moves next and the one who moved before, in the current direction.
function neighbours(view, seat) {
  const seats = view.seats;
  const at = seats.indexOf(seat);
  const k = seats.length;
  return {
    next: view.handSizes[seats[(((at + view.dir) % k) + k) % k]],
    prev: view.handSizes[seats[(((at - view.dir) % k) + k) % k]],
  };
}

function scoreCard(c, view, seat, level) {
  const rest = view.hand.filter((x) => x !== c);
  const r = rankOf(c);
  const others = view.seats.length - 1;
  const { next, prev } = neighbours(view, seat);
  const aware = level === 'zor'; // the strong level reads the opponents' hand sizes
  let s = cardPenalty(c) * 0.12; // rid of the expensive cards first
  s += rest.filter((x) => suitOf(x) === suitOf(c)).length * 0.3; // keep a run of one suit going
  s += rest.filter((x) => rankOf(x) === r).length * 0.2;
  if (view.opening) return s; // nothing special happens on the first card
  const danger = aware && next <= 2 ? 3 : 0; // the next player is about to win: hit them
  if (isJack(c)) s += rest.length <= 1 ? 3 : -3; // a jack is the way out of a bad hand, keep it
  else if (r === 7) s += 2 + danger + (view.pending ? 2 : 0);
  else if (r === 8) s += 1 + danger;
  else if (r === 14) s += 0.8 * others + (aware && Math.min(...view.handSizes.filter((_, i) => i !== seat && view.seats.includes(i))) <= 2 ? 1.5 : 0);
  else if (r === 10) s += 0.4 + (aware && others > 1 ? (prev - next) * 0.3 : 0);
  return s;
}

// Returns { action: 'draw' } or { action: 'play', card, color, tek } where tek says to call TEK before playing.
export function botAction(view, { level = 'normal', seat = 1, rng = Math.random } = {}) {
  const legal = view.legal;
  if (!legal.length) return { action: 'draw' };
  const tek = view.hand.length === 2 && rng() < (TEK_CHANCE[level] ?? 1);

  let card;
  if (level === 'kolay') {
    card = pick(legal, rng);
  } else {
    let bestScore = -Infinity;
    for (const c of legal) {
      const s = scoreCard(c, view, seat, level) + 0.001 * rng(); // break ties without a pattern
      if (s > bestScore) { bestScore = s; card = c; }
    }
  }
  const rest = view.hand.filter((x) => x !== card);
  const color = isJack(card) ? (level === 'kolay' ? pick(SUITS, rng) : bestColor(rest, rng)) : undefined;
  return { action: 'play', card, color, tek };
}
