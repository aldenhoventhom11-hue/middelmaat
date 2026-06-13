'use strict';

const { runSecret } = require('./_secret');

// Minigame 5 — Het Gemiddelde Getal (0–100).
// Kies in het geheim 0–100. Uitkomst = afstand tot het groepsgemiddelde.
// Dichtstbij wint de meeste punten; de versten krijgen 0 (scoring 'closest').
const MIN = 0;
const MAX = 100;

module.exports = {
  id: 'gemiddeldgetal',
  title: 'Het Gemiddelde Getal',
  theme: 'Kies een getal zo dicht mogelijk bij het groepsgemiddelde.',
  rules: 'Kies in het geheim 0 t/m 100. Wie het dichtst bij het groepsgemiddelde zit, wint. De versten verliezen.',
  type: 'secret',
  scoring: 'closest',

  run(ctx) {
    return runSecret(ctx, {
      kind: 'gemiddeldgetal',
      config: { min: MIN, max: MAX },
      validate(value) {
        const v = Math.round(Number(value));
        if (!Number.isFinite(v) || v < MIN || v > MAX) return null;
        return v;
      },
      compute(submissions) {
        const ids = Object.keys(submissions);
        const outcomes = {};
        const reveal = {};
        if (ids.length === 0) {
          return { outcomes, reveal: { _meta: { mean: 0 } } };
        }
        const mean =
          ids.reduce((s, id) => s + submissions[id], 0) / ids.length;
        for (const id of ids) {
          const dist = Math.abs(submissions[id] - mean);
          outcomes[id] = dist; // lager = dichter bij = beter
          reveal[id] = {
            display: submissions[id] + ' (afstand ' + dist.toFixed(1) + ')',
            choice: submissions[id],
            distance: Number(dist.toFixed(2)),
          };
        }
        reveal._meta = { mean: Number(mean.toFixed(2)) };
        return { outcomes, reveal };
      },
    });
  },
};
