'use strict';

const { waitUntil, countdown, secs } = require('./_realtime');

// Minigame 1 — De Berenrace (durf-timing).
// Een beer komt dichterbij. Druk op tijd op "VERSTOP JE!". Je tijd = uitkomst.
// Te vroeg (de lafaard) of te laat (de uitslover) = extreem -> 0 punten.
const SAFETY = 20000;

module.exports = {
  id: 'berenrace',
  title: 'De Berenrace',
  theme: 'Een boze beer zit achter je aan!',
  rules: 'Druk op tijd op "VERSTOP JE!". Niet te snel (lafaard), niet te laat (uitslover). Het midden wint.',
  type: 'realtime',
  scoring: 'symmetric',

  async run(ctx) {
    if (!(await countdown(ctx, 'berenrace'))) return { outcomes: {} };

    const start = ctx.now();
    const results = {}; // pid -> ms

    const off = ctx.onEvent((pid, p) => {
      if (!ctx.ids.includes(pid)) return;
      if (pid in results) return;
      if (!p || p.type !== 'hide') return;
      results[pid] = ctx.now() - start;
    });

    await waitUntil(
      ctx,
      (el) => Object.keys(results).length >= ctx.ids.length || el >= SAFETY,
      {
        pollMs: 100,
        maxMs: SAFETY + 500,
        onTick: (el) => {
          ctx.patch({
            phase: 'run',
            elapsed: el,
            bear: Math.min(1, el / SAFETY),
            safety: SAFETY,
            hidden: Object.keys(results),
          });
        },
      }
    );
    off();

    const reveal = {};
    for (const id of Object.keys(results)) {
      reveal[id] = { display: secs(results[id]) };
    }
    return { outcomes: results, reveal };
  },
};
