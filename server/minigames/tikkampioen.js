'use strict';

const { waitUntil, countdown } = require('./_realtime');

// Minigame 7 — De Tikkampioen (snelheid doseren).
// 5 seconden zo vaak tikken als je wilt. Server telt de tikken.
// Meeste tikken en minste tikken = extreem -> 0 punten. Het midden wint.
const DURATION = 5000;

module.exports = {
  id: 'tikkampioen',
  title: 'De Tikkampioen',
  theme: 'Doseer je tempo.',
  rules: 'Tik 5 seconden lang. Niet de meeste, niet de minste — het gemiddelde aantal tikken wint.',
  type: 'realtime',
  scoring: 'symmetric',

  async run(ctx) {
    const counts = {};
    for (const id of ctx.ids) counts[id] = 0;

    if (!(await countdown(ctx, 'tikkampioen'))) return { outcomes: {} };

    const start = ctx.now();
    const off = ctx.onEvent((pid, p) => {
      if (!ctx.ids.includes(pid)) return;
      if (!p || p.type !== 'tap') return;
      if (ctx.now() - start > DURATION) return; // negeer late tikken
      counts[pid] = (counts[pid] || 0) + 1;
    });

    ctx.publish({
      kind: 'tikkampioen',
      phase: 'tap',
      deadline: start + DURATION,
      duration: DURATION,
      counts,
    });

    await waitUntil(ctx, (el) => el >= DURATION, {
      pollMs: 120,
      maxMs: DURATION + 500,
      onTick: (el) => ctx.patch({ elapsed: el, counts }),
    });
    off();

    const reveal = {};
    for (const id of ctx.ids) {
      reveal[id] = { display: counts[id] + ' tikken', taps: counts[id] };
    }
    return { outcomes: counts, reveal };
  },
};
