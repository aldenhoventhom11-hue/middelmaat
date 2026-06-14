'use strict';

const { runSecret } = require('./_secret');

// Minigame 19 — Mini Golf (richten + kracht, één lange hole).
// Sla de bal in zo min mogelijk... nee: in de GEMIDDELDE hoeveelheid slagen! De
// client speelt de hole (fysica) en stuurt het aantal slagen. De meeste en de
// minste slagen verliezen; het gemiddelde wint.
const MAX_STROKES = 40;

module.exports = {
  id: 'golf',
  title: 'Mini Golf',
  theme: 'Sla de bal in de hole — in zo gemiddeld mogelijk veel slagen.',
  rules: 'Richt met een lijn en kies je kracht. Sla de bal in de hole. Niet de minste, niet de meeste slagen — het gemiddelde aantal wint.',
  type: 'secret',
  scoring: 'symmetric',
  duration: 45000,

  run(ctx) {
    return runSecret(ctx, {
      kind: 'golf',
      duration: 45000,
      config: {},
      validate(value) {
        const v = Math.round(Number(value));
        if (!Number.isFinite(v) || v < 1 || v > MAX_STROKES) return null;
        return v;
      },
      compute(submissions) {
        const outcomes = {};
        const reveal = {};
        for (const id of Object.keys(submissions)) {
          outcomes[id] = submissions[id];
          reveal[id] = { display: submissions[id] + ' slag' + (submissions[id] === 1 ? '' : 'en'), strokes: submissions[id] };
        }
        return { outcomes, reveal };
      },
    });
  },
};
