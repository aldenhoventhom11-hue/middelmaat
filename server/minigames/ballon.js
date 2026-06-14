'use strict';

const { runSecret } = require('./_secret');

// Minigame 3 — De Ballon (geheim opblazen).
// Sleep de balk om je ballon op te blazen (geen getallen). De grootte van je
// ballon is je uitkomst: de grootste knapt (overdrijver), de kleinste is de
// profiteur — beide verliezen. Het midden wint.

module.exports = {
  id: 'ballon',
  title: 'De Ballon',
  theme: 'Blaas de ballon op zonder hem te laten knappen.',
  rules: 'Sleep de balk om je ballon op te blazen. Niet de grootste (knal!), niet de kleinste (profiteur). De middelste grootte wint.',
  type: 'secret',
  scoring: 'symmetric',

  run(ctx) {
    return runSecret(ctx, {
      kind: 'ballon',
      config: {},
      validate(value) {
        const v = Number(value); // 0..1 = ballongrootte
        if (!Number.isFinite(v) || v < 0 || v > 1) return null;
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
            display: Math.round(submissions[id] * 100) + '% opgeblazen',
            size: submissions[id],
            popped: submissions[id] === maxVal,
          };
        }
        reveal._meta = { maxSize: ids.length ? maxVal : 0 };
        return { outcomes, reveal };
      },
    });
  },
};
