'use strict';

const { waitUntil, countdown, secs } = require('./_realtime');

// Minigame 21 — Bal Hooghouden (plateau + stuiterende bal).
// Beweeg het plateau (volgt je vinger) en houd de bal hoog. De client simuleert
// de bal-fysica en meldt wanneer je 'm laat vallen; de server bewaart je
// overlevingstijd. Wie als eerste én als laatste de bal laat vallen, verliest;
// de middelste overlevingstijd wint.
const MAX_TIME = 30000;

module.exports = {
  id: 'hooghouden',
  title: 'Bal Hooghouden',
  theme: 'Houd de bal hoog met je plateau — niet te kort, niet te lang!',
  rules: 'Beweeg het plateau met je vinger en houd de bal hoog. De bal versnelt langzaam. Niet als eerste of laatste laten vallen — de middelste tijd wint.',
  type: 'realtime',
  scoring: 'symmetric',

  async run(ctx) {
    if (!(await countdown(ctx, 'hooghouden'))) return { outcomes: {} };
    const start = ctx.now();
    const results = {}; // pid -> overlevingstijd (ms)

    const off = ctx.onEvent((pid, p) => {
      if (!ctx.ids.includes(pid)) return;
      if (pid in results) return;
      if (!p || p.type !== 'drop') return;
      results[pid] = Math.min(MAX_TIME, ctx.now() - start);
    });

    await waitUntil(
      ctx,
      (el) => Object.keys(results).length >= ctx.ids.length || el >= MAX_TIME,
      {
        pollMs: 200,
        maxMs: MAX_TIME + 500,
        onTick: (el) => ctx.patch({ phase: 'play', elapsed: el, dropped: Object.keys(results) }),
      }
    );
    off();

    // Wie niet liet vallen, hield vol tot de max -> hoogste tijd (extreem).
    const outcomes = {};
    const reveal = {};
    for (const id of ctx.ids) {
      const fell = id in results;
      const t = fell ? results[id] : MAX_TIME;
      outcomes[id] = t;
      reveal[id] = { display: fell ? secs(t) + ' hooggehouden' : 'hield vol! (max)', fell };
    }
    return { outcomes, reveal };
  },
};
