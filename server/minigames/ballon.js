'use strict';

const { runSecret } = require('./_secret');

// Minigame 3 — De Ballon (geheim oppompen).
// Kies in het geheim 1–20 pompslagen. Hoogste laat de ballon knappen
// (de overdrijver), laagste is de profiteur. Beide extremen -> 0 punten.
const MIN = 1;
const MAX = 20;

module.exports = {
  id: 'ballon',
  title: 'De Ballon',
  theme: 'Pomp de ballon op zonder hem te laten knappen.',
  rules: 'Kies in het geheim 1 t/m 20 pompslagen. Niet te veel (knal!), niet te weinig (profiteur). Het midden wint.',
  type: 'secret',
  scoring: 'symmetric',

  run(ctx) {
    return runSecret(ctx, {
      kind: 'ballon',
      config: { min: MIN, max: MAX },
      validate(value) {
        const v = Math.round(Number(value));
        if (!Number.isFinite(v) || v < MIN || v > MAX) return null;
        return v;
      },
      compute(submissions) {
        const outcomes = {};
        const reveal = {};
        const ids = Object.keys(submissions);
        let maxVal = -Infinity;
        for (const id of ids) maxVal = Math.max(maxVal, submissions[id]);
        for (const id of ids) {
          outcomes[id] = submissions[id];
          reveal[id] = {
            display: submissions[id] + ' slagen',
            pumps: submissions[id],
            popped: submissions[id] === maxVal,
          };
        }
        reveal._meta = { maxPumps: ids.length ? maxVal : 0 };
        return { outcomes, reveal };
      },
    });
  },
};
