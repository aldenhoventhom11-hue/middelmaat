'use strict';

const { waitUntil, countdown } = require('./_realtime');

// Minigame 12 — De Toren (reflex-timing).
// De toren groeit vanzelf; druk op "STOP!" om te stoppen. Je hoogte = uitkomst.
// Te hoog (valt om) of te laag = extreem; de gemiddelde hoogte wint.
const RISE = 9000; // tijd tot maximale hoogte / veiligheidsnet

module.exports = {
  id: 'toren',
  title: 'De Toren',
  theme: 'Stapel blokken — maar stop op tijd!',
  rules: 'De toren groeit vanzelf. Druk op "STOP!". Niet de hoogste, niet de laagste — de gemiddelde hoogte wint.',
  type: 'realtime',
  scoring: 'symmetric',

  async run(ctx) {
    if (!(await countdown(ctx, 'toren'))) return { outcomes: {} };
    const start = ctx.now();
    const results = {}; // pid -> ms (hoogte)

    const off = ctx.onEvent((pid, p) => {
      if (!ctx.ids.includes(pid)) return;
      if (pid in results) return;
      if (!p || p.type !== 'stop') return;
      results[pid] = Math.min(RISE, ctx.now() - start);
    });

    await waitUntil(
      ctx,
      (el) => Object.keys(results).length >= ctx.ids.length || el >= RISE,
      {
        pollMs: 100,
        maxMs: RISE + 500,
        onTick: (el) =>
          ctx.patch({ phase: 'rise', elapsed: el, rise: RISE, stopped: Object.keys(results) }),
      }
    );
    off();

    const reveal = {};
    for (const id of Object.keys(results)) {
      const blocks = Math.max(1, Math.round((results[id] / RISE) * 20));
      reveal[id] = { display: blocks + ' blokken hoog', blocks };
    }
    return { outcomes: results, reveal };
  },
};
