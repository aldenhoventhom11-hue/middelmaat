'use strict';

const { runSecret } = require('./_secret');

// Minigame 8 — De Pizzapunt (geheim claimen).
// Claim in het geheim hoeveel stukken pizza je wilt (0–12). Meeste (hebberig)
// en minste (bescheiden) = extreem -> 0 punten. De gemiddelde claim wint.
const MIN = 0;
const MAX = 12;

module.exports = {
  id: 'pizzapunt',
  title: 'De Pizzapunt',
  theme: 'Hoeveel stukken pizza claim je?',
  rules: 'Claim in het geheim 0 t/m 12 stukken. Niet te hebberig, niet te bescheiden. De gemiddelde claim wint.',
  type: 'secret',
  scoring: 'symmetric',

  run(ctx) {
    return runSecret(ctx, {
      kind: 'pizzapunt',
      config: { min: MIN, max: MAX },
      validate(value) {
        const v = Math.round(Number(value));
        if (!Number.isFinite(v) || v < MIN || v > MAX) return null;
        return v;
      },
      compute(submissions) {
        const outcomes = {};
        const reveal = {};
        let total = 0;
        for (const id of Object.keys(submissions)) {
          outcomes[id] = submissions[id];
          total += submissions[id];
          reveal[id] = {
            display: submissions[id] + ' stuk' + (submissions[id] === 1 ? '' : 'ken'),
            slices: submissions[id],
          };
        }
        reveal._meta = { totalClaimed: total };
        return { outcomes, reveal };
      },
    });
  },
};
