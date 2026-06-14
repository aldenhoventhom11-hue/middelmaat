'use strict';

const { waitUntil, countdown } = require('./_realtime');

// Minigame 14 — Het Biertje (vasthouden om te drinken).
// Houd het glas ingedrukt; hoe langer je vasthoudt, hoe meer slokken. Meeste en
// minste slokken verliezen; het gemiddelde wint. Vast tijdvenster.
const WINDOW = 6000;

module.exports = {
  id: 'bier',
  title: 'Het Biertje',
  theme: 'Hoeveel slokken neem jij?',
  rules: 'Houd het glas ingedrukt om te drinken. Niet de meeste, niet de minste slokken — het gemiddelde wint!',
  type: 'realtime',
  scoring: 'symmetric',

  async run(ctx) {
    if (!(await countdown(ctx, 'bier'))) return { outcomes: {} };
    const start = ctx.now();
    const total = {}; // pid -> opgetelde ms
    const holding = {}; // pid -> starttijd huidige slok

    const off = ctx.onEvent((pid, p) => {
      if (!ctx.ids.includes(pid)) return;
      if (!p) return;
      if (p.type === 'down') {
        if (!(pid in holding)) holding[pid] = ctx.now();
      } else if (p.type === 'up') {
        if (pid in holding) {
          total[pid] = (total[pid] || 0) + (ctx.now() - holding[pid]);
          delete holding[pid];
        }
      }
    });

    await waitUntil(ctx, (el) => el >= WINDOW, {
      pollMs: 100,
      maxMs: WINDOW + 400,
      onTick: () => {
        const now = ctx.now();
        const live = {};
        for (const id of ctx.ids) {
          live[id] = (total[id] || 0) + (id in holding ? now - holding[id] : 0);
        }
        ctx.patch({ phase: 'drink', deadline: start + WINDOW, sips: live });
      },
    });
    off();

    const end = ctx.now();
    for (const id of Object.keys(holding)) {
      total[id] = (total[id] || 0) + (end - holding[id]);
    }
    const outcomes = {};
    const reveal = {};
    for (const id of Object.keys(total)) {
      const sips = Math.max(1, Math.round(total[id] / 320));
      outcomes[id] = total[id];
      reveal[id] = { display: sips + ' slok' + (sips === 1 ? '' : 'ken'), sips };
    }
    return { outcomes, reveal };
  },
};
