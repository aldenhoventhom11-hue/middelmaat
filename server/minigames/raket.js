'use strict';

const { waitUntil, countdown, secs } = require('./_realtime');

// Minigame 15 — De Raket (durf-timing).
// De motor loopt warm. Druk op "LANCEER!". Te vroeg (bange schijterd) of te laat
// (de raket ontploft bijna) = extreem; het gemiddelde moment wint.
const SAFETY = 12000;

module.exports = {
  id: 'raket',
  title: 'De Raket',
  theme: 'Lanceer je raket — maar wanneer?',
  rules: 'Druk op "LANCEER!". Niet als eerste (bang), niet als laatste (te koppig). Het gemiddelde moment wint.',
  type: 'realtime',
  scoring: 'symmetric',

  async run(ctx) {
    if (!(await countdown(ctx, 'raket'))) return { outcomes: {} };
    const start = ctx.now();
    const results = {};

    const off = ctx.onEvent((pid, p) => {
      if (!ctx.ids.includes(pid)) return;
      if (pid in results) return;
      if (!p || p.type !== 'launch') return;
      results[pid] = ctx.now() - start;
    });

    await waitUntil(
      ctx,
      (el) => Object.keys(results).length >= ctx.ids.length || el >= SAFETY,
      {
        pollMs: 100,
        maxMs: SAFETY + 500,
        onTick: (el) =>
          ctx.patch({ phase: 'fly', elapsed: el, safety: SAFETY, launched: Object.keys(results) }),
      }
    );
    off();

    const reveal = {};
    for (const id of Object.keys(results)) reveal[id] = { display: secs(results[id]) };
    return { outcomes: results, reveal };
  },
};
