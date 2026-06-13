'use strict';

const { runSecret } = require('./_secret');

// Minigame 4 — Verdeel & Heers (strafpunten uitdelen).
// Iedereen verdeelt in het geheim 5 strafpunten over de anderen (niet zichzelf).
// Uitkomst = totaal ontvangen strafpunten. Meeste én minste ontvangen = extreem.
const POINTS = 5;

module.exports = {
  id: 'verdeelheers',
  title: 'Verdeel & Heers',
  theme: 'Verdeel je strafpunten over de groep.',
  rules: 'Verdeel in het geheim 5 strafpunten over de anderen. Wie de meeste of de minste krijgt verliest. Het midden wint.',
  type: 'secret',
  scoring: 'symmetric',

  run(ctx) {
    const targets = ctx.players.map((p) => ({ id: p.id, name: p.name }));
    return runSecret(ctx, {
      kind: 'verdeelheers',
      config: { points: POINTS, targets },
      validate(value, pid, c) {
        // value = { targetId: aantal } voor anderen, som = 5, gehele getallen >= 0.
        if (!value || typeof value !== 'object') return null;
        const alloc = {};
        let sum = 0;
        for (const key of Object.keys(value)) {
          if (key === pid) return null; // niet aan jezelf
          if (!c.ids.includes(key)) return null; // alleen actieve spelers
          const n = Math.round(Number(value[key]));
          if (!Number.isFinite(n) || n < 0) return null;
          if (n > 0) alloc[key] = n;
          sum += n;
        }
        if (sum !== POINTS) return null;
        return alloc;
      },
      compute(submissions, c) {
        // Ontvangen totalen voor iedereen die meedeed.
        const received = {};
        for (const id of c.ids) received[id] = 0;
        for (const giver of Object.keys(submissions)) {
          const alloc = submissions[giver];
          for (const target of Object.keys(alloc)) {
            received[target] = (received[target] || 0) + alloc[target];
          }
        }
        const outcomes = {};
        const reveal = {};
        // Alleen inleveraars krijgen een uitkomst; non-inleveraars -> WORST (engine).
        for (const id of Object.keys(submissions)) {
          outcomes[id] = received[id];
        }
        for (const id of c.ids) {
          reveal[id] = {
            display: received[id] + ' strafpunten',
            received: received[id],
          };
        }
        return { outcomes, reveal };
      },
    });
  },
};
