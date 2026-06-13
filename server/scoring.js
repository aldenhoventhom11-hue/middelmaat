'use strict';

/**
 * Het hart van Middelmaat: middelmaat is goud.
 *
 * Elke minigame levert per speler één uitkomstwaarde (een getal). De score
 * wordt volledig server-side berekend op basis van die uitkomstwaarden.
 *
 * Twee scoringsmodellen:
 *
 *  1. 'symmetric' (de standaard, 9 van de 10 games):
 *     Beide extremen (hoogste én laagste uitkomst) verliezen, het midden wint.
 *     score(i) = min(i, N-1-i) na sorteren.
 *       3 spelers -> [0,1,0]
 *       4 spelers -> [0,1,1,0]
 *       5 spelers -> [0,1,2,1,0]
 *       6 spelers -> [0,1,2,2,1,0]
 *       7 spelers -> [0,1,2,3,2,1,0]
 *
 *  2. 'closest' (minigame 5, Het Gemiddelde Getal):
 *     De uitkomstwaarde is een AFSTAND tot het groepsgemiddelde. Lager = beter.
 *     De dichtstbijzijnde wint de meeste punten, de verste krijgen 0.
 *     score(i) = max(0, N-2-i) na oplopend sorteren op afstand.
 *       3 spelers -> [1,0,0]
 *       4 spelers -> [2,1,0,0]
 *       5 spelers -> [3,2,1,0,0]
 *
 * Ties (gelijke uitkomstwaarden) krijgen allemaal het HOOGSTE hele punt van hun
 * gezamenlijke posities (gul, en altijd een heel getal). Daardoor is de uitslag
 * deterministisch en onafhankelijk van de toevallige sorteervolgorde.
 */

function rawSymmetric(i, n) {
  return Math.min(i, n - 1 - i);
}

function rawClosest(i, n) {
  return Math.max(0, n - 2 - i);
}

/**
 * Bereken scores voor een ronde.
 *
 * @param {Array<{id:string, value:number}>} entries  uitkomst per speler
 * @param {'symmetric'|'closest'} model
 * @returns {Object<string, number>} map van speler-id naar rondescore
 */
function scoreRound(entries, model = 'symmetric') {
  const n = entries.length;
  const result = {};
  if (n === 0) return result;
  if (n === 1) {
    // Eén speler: geen midden, geen punten.
    result[entries[0].id] = 0;
    return result;
  }

  const rawFn = model === 'closest' ? rawClosest : rawSymmetric;

  // Sorteer oplopend op uitkomstwaarde. Stabiel maakt niet uit: ties worden
  // hieronder gemiddeld, dus de volgorde binnen een tie heeft geen effect.
  const sorted = [...entries].sort((a, b) => a.value - b.value);

  // Voorlopige punten per positie.
  const rawScores = sorted.map((_, i) => rawFn(i, n));

  // Groepeer gelijke uitkomstwaarden en geef ze allemaal het HOOGSTE punt van hun
  // gezamenlijke posities (gul; blijft een heel getal).
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && sorted[j + 1].value === sorted[i].value) j++;
    if (j > i) {
      let best = rawScores[i];
      for (let k = i; k <= j; k++) best = Math.max(best, rawScores[k]);
      for (let k = i; k <= j; k++) rawScores[k] = best;
    }
    i = j + 1;
  }

  sorted.forEach((entry, idx) => {
    result[entry.id] = rawScores[idx];
  });
  return result;
}

module.exports = { scoreRound, rawSymmetric, rawClosest };
