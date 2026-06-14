'use strict';

const { waitUntil, countdown } = require('./_realtime');

// Minigame 16 — Dobbelen (pure mazzel).
// Gooi twee dobbelstenen. De server bepaalt de worp. Hoogste en laagste som
// verliezen; het gemiddelde wint. Puur geluk!
const WINDOW = 8000;

module.exports = {
  id: 'dobbel',
  title: 'Dobbelen',
  theme: 'Gooi twee dobbelstenen — pure mazzel!',
  rules: 'Gooi twee dobbelstenen. Niet de hoogste, niet de laagste som — het gemiddelde wint. Puur geluk.',
  type: 'realtime',
  scoring: 'symmetric',

  async run(ctx) {
    if (!(await countdown(ctx, 'dobbel'))) return { outcomes: {} };
    const start = ctx.now();
    const results = {};
    const dice = {};

    const off = ctx.onEvent((pid, p) => {
      if (!ctx.ids.includes(pid)) return;
      if (pid in results) return;
      if (!p || p.type !== 'roll') return;
      const d1 = 1 + Math.floor(ctx.rng() * 6);
      const d2 = 1 + Math.floor(ctx.rng() * 6);
      dice[pid] = [d1, d2];
      results[pid] = d1 + d2;
      // dice meesturen (pure mazzel; geen strategie om te lekken).
      ctx.patch({ rolled: Object.keys(results), dice: Object.assign({}, dice) });
    });

    ctx.publish({ kind: 'dobbel', phase: 'roll', deadline: start + WINDOW, total: ctx.ids.length, rolled: [] });

    await waitUntil(
      ctx,
      (el) => Object.keys(results).length >= ctx.ids.length || el >= WINDOW,
      { pollMs: 150, maxMs: WINDOW + 400 }
    );
    off();

    const reveal = {};
    for (const id of Object.keys(results)) {
      reveal[id] = { display: dice[id][0] + ' + ' + dice[id][1] + ' = ' + results[id], dice: dice[id] };
    }
    return { outcomes: results, reveal };
  },
};
