'use strict';

const { runSecret } = require('./_secret');

// Minigame 13 — Schatten in de Pot (geheim schatten).
// Schat in het geheim hoeveel snoepjes in de pot zitten (0–100). Niet de hoogste,
// niet de laagste schatting — de gemiddelde schatting wint.
const MIN = 0;
const MAX = 100;

module.exports = {
  id: 'schatten',
  title: 'Schatten in de Pot',
  theme: 'Hoeveel snoepjes zitten er in de pot?',
  rules: 'Schat in het geheim 0 t/m 100. Niet de hoogste of de laagste schatting — de gemiddelde schatting wint.',
  type: 'secret',
  scoring: 'symmetric',

  run(ctx) {
    return runSecret(ctx, {
      kind: 'schatten',
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
          reveal[id] = { display: submissions[id] + ' snoepjes', guess: submissions[id] };
        }
        return { outcomes, reveal };
      },
    });
  },
};
