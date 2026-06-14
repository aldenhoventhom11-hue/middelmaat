'use strict';

const { runSecret } = require('./_secret');

// Minigame 20 — De Kapper (knip de lange haren).
// Voor je zit een klant met lange haren. Trek een lijn en knip. Hoeveel je
// wegknipt is je uitkomst. Wie het meest én het minst wegknipt verliest; wie het
// dichtst bij het gemiddelde zit, wint.
module.exports = {
  id: 'kapper',
  title: 'De Kapper',
  theme: 'Knip de lange haren — maar hoeveel?',
  rules: 'Trek een knip-lijn door de haren. Niet te veel (kaal!), niet te weinig — het gemiddelde knipt wint.',
  type: 'secret',
  scoring: 'symmetric',

  run(ctx) {
    return runSecret(ctx, {
      kind: 'kapper',
      config: {},
      validate(value) {
        // value = hoeveelheid geknipt, 0..1
        const v = Number(value);
        if (!Number.isFinite(v) || v < 0 || v > 1) return null;
        return Math.round(v * 1000) / 1000;
      },
      compute(submissions) {
        const outcomes = {};
        const reveal = {};
        for (const id of Object.keys(submissions)) {
          const cut = submissions[id];
          outcomes[id] = cut;
          reveal[id] = { display: Math.round(cut * 100) + '% geknipt', cut };
        }
        return { outcomes, reveal };
      },
    });
  },
};
