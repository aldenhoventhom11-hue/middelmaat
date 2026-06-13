'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { scoreRound } = require('../server/scoring');

// Hulp: maak entries met oplopende waarden en lees de scores in inputvolgorde uit.
function scores(values, model = 'symmetric') {
  const entries = values.map((v, i) => ({ id: 'p' + i, value: v }));
  const res = scoreRound(entries, model);
  return values.map((_, i) => res['p' + i]);
}

test('symmetric: exacte voorbeelden uit de spec (sectie 5)', () => {
  assert.deepStrictEqual(scores([10, 20, 30]), [0, 1, 0]);
  assert.deepStrictEqual(scores([10, 20, 30, 40]), [0, 1, 1, 0]);
  assert.deepStrictEqual(scores([10, 20, 30, 40, 50]), [0, 1, 2, 1, 0]);
  assert.deepStrictEqual(scores([1, 2, 3, 4, 5, 6]), [0, 1, 2, 2, 1, 0]);
  assert.deepStrictEqual(scores([1, 2, 3, 4, 5, 6, 7]), [0, 1, 2, 3, 2, 1, 0]);
});

test('symmetric: ongesorteerde input geeft hetzelfde resultaat', () => {
  // Waarden door elkaar; scores horen bij de waarde, niet bij de inputvolgorde.
  // 30->pos2->2, 10->pos0->0, 50->pos4->0, 40->pos3->1, 20->pos1->1.
  assert.deepStrictEqual(scores([30, 10, 50, 40, 20]), [2, 0, 0, 1, 1]);
});

test('symmetric: tie krijgt gemiddelde van de posities', () => {
  // Twee laagsten gelijk: posities 0 en 1 -> raw 0 en 1 -> gemiddeld 0.5 elk.
  // 5 spelers, posities raw = [0,1,2,1,0].
  assert.deepStrictEqual(scores([10, 10, 30, 40, 50]), [0.5, 0.5, 2, 1, 0]);
});

test('symmetric: alle gelijk -> iedereen hetzelfde gemiddelde', () => {
  // 4 spelers raw [0,1,1,0] -> som 2 / 4 = 0.5 elk.
  assert.deepStrictEqual(scores([7, 7, 7, 7]), [0.5, 0.5, 0.5, 0.5]);
});

test('symmetric: drie gelijk in het midden', () => {
  // 5 spelers, middelste 3 gelijk: posities 1,2,3 raw [1,2,1] -> gem 4/3.
  const r = scores([10, 20, 20, 20, 50]);
  assert.strictEqual(r[0], 0);
  assert.ok(Math.abs(r[1] - 4 / 3) < 1e-9);
  assert.ok(Math.abs(r[2] - 4 / 3) < 1e-9);
  assert.ok(Math.abs(r[3] - 4 / 3) < 1e-9);
  assert.strictEqual(r[4], 0);
});

test('closest (minigame 5): dichtstbij wint, versten krijgen 0', () => {
  // afstanden oplopend: [3,2,1,0,0] na sorteren.
  assert.deepStrictEqual(scores([1, 2, 3], 'closest'), [1, 0, 0]);
  assert.deepStrictEqual(scores([1, 2, 3, 4], 'closest'), [2, 1, 0, 0]);
  assert.deepStrictEqual(scores([1, 2, 3, 4, 5], 'closest'), [3, 2, 1, 0, 0]);
});

test('closest: tie op de dichtstbijzijnde afstand deelt de punten', () => {
  // 5 spelers, twee dichtstbij gelijk: posities 0,1 raw [3,2] -> 2.5 elk.
  const r = scores([5, 5, 10, 20, 30], 'closest');
  assert.strictEqual(r[0], 2.5);
  assert.strictEqual(r[1], 2.5);
  assert.strictEqual(r[2], 1);
  assert.strictEqual(r[3], 0);
  assert.strictEqual(r[4], 0);
});

test('randgevallen: 0 en 1 speler', () => {
  assert.deepStrictEqual(scoreRound([], 'symmetric'), {});
  assert.deepStrictEqual(scoreRound([{ id: 'a', value: 5 }], 'symmetric'), { a: 0 });
});

test('totaalscore: som van rondes bepaalt eindstand', () => {
  // Simuleer 3 rondes voor 3 spelers, tel op.
  const rondes = [
    scores([10, 20, 30]), // [0,1,0]
    scores([30, 20, 10]), // [0,1,0]
    scores([20, 10, 30]), // [1,0,0]
  ];
  const totalen = [0, 1, 2].map((i) => rondes.reduce((s, r) => s + r[i], 0));
  assert.deepStrictEqual(totalen, [1, 2, 0]);
});
