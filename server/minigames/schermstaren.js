'use strict';

const { waitUntil, secs } = require('./_realtime');

// Minigame 6 — Schermstaren (vinger loslaten, zenuw-timing).
// Geen klok in beeld. Iedereen legt een vinger neer; zodra je loslaat stopt je
// tijd. Eerste los (zenuwachtig) en laatste los (koppig) = extreem -> 0 punten.
const SAFETY = 30000;
const WAIT_ALL = 15000;

module.exports = {
  id: 'schermstaren',
  title: 'Schermstaren',
  theme: 'Zenuwslopende timing, géén klok in beeld.',
  rules: 'Houd je vinger op het scherm. Laat los op gevoel — niet als eerste, niet als laatste. Het midden wint.',
  type: 'realtime',
  scoring: 'symmetric',

  async run(ctx) {
    const ready = new Set();
    const results = {};

    // Fase 1: wacht tot iedereen een vinger heeft neergelegd.
    ctx.publish({
      kind: 'schermstaren',
      phase: 'wait',
      readyCount: 0,
      total: ctx.ids.length,
    });
    const offReady = ctx.onEvent((pid, p) => {
      if (!ctx.ids.includes(pid)) return;
      if (p && p.type === 'down') {
        ready.add(pid);
        ctx.patch({ readyCount: ready.size });
      }
    });
    await waitUntil(ctx, () => ready.size >= ctx.ids.length, {
      pollMs: 150,
      maxMs: WAIT_ALL,
    });
    offReady();
    if (ctx.isAborted()) return { outcomes: {} };

    // Fase 2: meten begint (geen zichtbare klok).
    const start = ctx.now();
    const off = ctx.onEvent((pid, p) => {
      if (!ctx.ids.includes(pid)) return;
      if (pid in results) return;
      if (p && p.type === 'up') {
        results[pid] = ctx.now() - start;
        ctx.patch({ releasedCount: Object.keys(results).length });
      }
    });
    ctx.publish({
      kind: 'schermstaren',
      phase: 'hold',
      total: ctx.ids.length,
      releasedCount: 0,
    });
    await waitUntil(
      ctx,
      (el) => Object.keys(results).length >= ctx.ids.length || el >= SAFETY,
      { pollMs: 150, maxMs: SAFETY + 500 }
    );
    off();

    const reveal = {};
    for (const id of Object.keys(results)) {
      reveal[id] = { display: secs(results[id], 2) };
    }
    return { outcomes: results, reveal };
  },
};
