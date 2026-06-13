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

test('symmetric: tie krijgt het hoogste punt van de posities (heel getal)', () => {
  // Twee laagsten gelijk: posities 0 en 1 -> raw 0 en 1 -> beiden 1 (hoogste).
  // 5 spelers, posities raw = [0,1,2,1,0].
  assert.deepStrictEqual(scores([10, 10, 30, 40, 50]), [1, 1, 2, 1, 0]);
});

test('symmetric: alle gelijk -> iedereen het hoogste punt', () => {
  // 4 spelers raw [0,1,1,0] -> hoogste = 1 -> iedereen 1.
  assert.deepStrictEqual(scores([7, 7, 7, 7]), [1, 1, 1, 1]);
});

test('symmetric: drie gelijk in het midden krijgen het hoogste (2)', () => {
  // 5 spelers, middelste 3 gelijk: posities 1,2,3 raw [1,2,1] -> hoogste 2.
  assert.deepStrictEqual(scores([10, 20, 20, 20, 50]), [0, 2, 2, 2, 0]);
});

test('scores zijn altijd hele getallen', () => {
  [scores([10, 10, 30, 40, 50]), scores([7, 7, 7, 7]), scores([10, 20, 20, 20, 50])]
    .forEach((r) => r.forEach((v) => assert.ok(Number.isInteger(v), v + ' is heel')));
});

test('closest (minigame 5): dichtstbij wint, versten krijgen 0', () => {
  // afstanden oplopend: [3,2,1,0,0] na sorteren.
  assert.deepStrictEqual(scores([1, 2, 3], 'closest'), [1, 0, 0]);
  assert.deepStrictEqual(scores([1, 2, 3, 4], 'closest'), [2, 1, 0, 0]);
  assert.deepStrictEqual(scores([1, 2, 3, 4, 5], 'closest'), [3, 2, 1, 0, 0]);
});

test('closest: tie op de dichtstbijzijnde afstand -> hoogste punt', () => {
  // 5 spelers, twee dichtstbij gelijk: posities 0,1 raw [3,2] -> beiden 3.
  const r = scores([5, 5, 10, 20, 30], 'closest');
  assert.deepStrictEqual(r, [3, 3, 1, 0, 0]);
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
