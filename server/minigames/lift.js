'use strict';

const { runSecret } = require('./_secret');

// Minigame 11 — De Lift (geheim een verdieping kiezen).
// Stop de lift in het geheim op een verdieping (1–20). De gemiddelde verdieping
// wint; de hoogste en de laagste verliezen.
const MIN = 1;
const MAX = 20;

module.exports = {
  id: 'lift',
  title: 'De Lift',
  theme: 'Op welke verdieping stap jij uit?',
  rules: 'Kies in het geheim een verdieping 1 t/m 20. Niet de hoogste, niet de laagste — de gemiddelde verdieping wint.',
  type: 'secret',
  scoring: 'symmetric',

  run(ctx) {
    return runSecret(ctx, {
      kind: 'lift',
      config: { min: MIN, max: MAX },
      validate(value) {
        const v = Math.round(Number(value));
        if (!Number.isFinite(v) || v < MIN || v > MAX) return null;
        return v;
      },
      compute(submissions) {
        const outcomes = {};
        const reveal = {};
        for (const id of Object.keys(submissions)) {
          outcomes[id] = submissions[id];
          reveal[id] = {
            display: 'verdieping ' + submissions[id],
            floor: submissions[id],
          };
        }
        return { outcomes, reveal };
      },
    });
  },
};
