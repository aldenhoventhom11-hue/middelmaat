'use strict';

const { waitUntil, countdown, secs } = require('./_realtime');

// Minigame 18 — De 100 Meter (sprint).
// Ren 100 meter door afwisselend links/rechts te tikken (ritme = snelheid). De
// meest gemiddelde tijd wint; de snelste en de langzaamste verliezen.
const GOAL = 100;
const MAX_TIME = 60000; // ruim, want de race duurt nu ~4x langer
const BOOST = 2.3; // lager = je moet langer/meer tikken om te rennen
const DECAY = 0.9; // momentum-verlies per tick

module.exports = {
  id: 'sprint',
  title: 'De 100 Meter',
  theme: 'Sprint 100 meter — afwisselend links/rechts tikken!',
  rules: 'Tik afwisselend links en rechts om te rennen. Niet de snelste, niet de langzaamste — de gemiddelde tijd wint.',
  type: 'realtime',
  scoring: 'symmetric',

  async run(ctx) {
    if (!(await countdown(ctx, 'sprint'))) return { outcomes: {} };
    const start = ctx.now();
    const dist = {};
    const mom = {};
    const side = {};
    const finish = {};
    for (const id of ctx.ids) {
      dist[id] = 0;
      mom[id] = 0;
      side[id] = null;
    }

    const off = ctx.onEvent((pid, p) => {
      if (!ctx.ids.includes(pid) || !p || p.type !== 'tap') return;
      if (pid in finish) return;
      const s = p.side === 'r' ? 'r' : 'l';
      mom[pid] += side[pid] && side[pid] !== s ? BOOST : BOOST * 0.35;
      side[pid] = s;
    });

    let lastTick = ctx.now();
    await waitUntil(
      ctx,
      (el) => Object.keys(finish).length >= ctx.ids.length || el >= MAX_TIME,
      {
        pollMs: 70,
        maxMs: MAX_TIME + 500,
        onTick: (el) => {
          const now = ctx.now();
          const dt = Math.max(0.001, (now - lastTick) / 1000);
          lastTick = now;
          for (const id of ctx.ids) {
            if (id in finish) continue;
            mom[id] *= DECAY;
            dist[id] = Math.min(GOAL, dist[id] + mom[id] * dt);
            if (dist[id] >= GOAL) finish[id] = el;
          }
          ctx.patch({ phase: 'race', elapsed: el, dist: Object.assign({}, dist), goal: GOAL });
        },
      }
    );
    off();

    const outcomes = {};
    const reveal = {};
    for (const id of ctx.ids) {
      // Niet gehaald? Dan een tijd voorbij MAX_TIME naar rato van de afstand.
      const t = id in finish ? finish[id] : MAX_TIME + (GOAL - dist[id]) * 100;
      outcomes[id] = t;
      reveal[id] = {
        display: id in finish ? secs(t, 2) : 'niet gehaald (' + Math.round(dist[id]) + 'm)',
        finished: id in finish,
      };
    }
    return { outcomes, reveal };
  },
};
