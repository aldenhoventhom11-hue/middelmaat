'use strict';

const { waitUntil, countdown, secs } = require('./_realtime');

// Minigame 17 — Haaieneiland (tik-duwen, survival).
// Iedereen staat op een rond platform met haaien eromheen. Tik op een
// tegenstander om 'm naar de rand te duwen; ram op je eigen knop om naar het
// midden terug te kruipen. Wie als eerste én als laatste het water in gaat,
// verliest. De middelste overlevingstijd wint.
const MAX_TIME = 22000;
const PUSH = 0.16; // hoeveel een tik een ander naar de rand duwt
const RECOVER = 0.07; // hoeveel een eigen tik je terug naar het midden brengt

module.exports = {
  id: 'haaien',
  title: 'Haaieneiland',
  theme: 'Duw de anderen het haaienwater in — maar val niet als eerste of laatste!',
  rules: 'Tik op een tegenstander om ’m naar de rand te duwen. Ram op JIJ om terug te kruipen. Niet als eerste of laatste in het water — het midden wint.',
  type: 'realtime',
  scoring: 'symmetric',

  async run(ctx) {
    if (!(await countdown(ctx, 'haaien'))) return { outcomes: {} };
    const start = ctx.now();
    const pos = {}; // pid -> 0 (midden) .. 1 (rand)
    const fallen = {}; // pid -> valtijd
    for (const id of ctx.ids) pos[id] = 0;

    const publishState = () => {
      ctx.patch({
        phase: 'fight',
        pos: Object.assign({}, pos),
        fallen: Object.keys(fallen),
        players: ctx.players.map((p) => ({ id: p.id, name: p.name, character: p.character })),
      });
    };

    const off = ctx.onEvent((pid, p) => {
      if (!ctx.ids.includes(pid) || !p) return;
      if (pid in fallen) return; // wie eraf is, doet niet meer mee
      if (p.type === 'push' && p.target && ctx.ids.includes(p.target) && !(p.target in fallen)) {
        pos[p.target] = Math.min(1, pos[p.target] + PUSH);
      } else if (p.type === 'recover') {
        pos[pid] = Math.max(0, pos[pid] - RECOVER);
      }
    });

    ctx.publish({ kind: 'haaien', phase: 'fight', pos, fallen: [], players: ctx.players.map((p) => ({ id: p.id, name: p.name, character: p.character })) });

    await waitUntil(
      ctx,
      () => Object.keys(fallen).length >= ctx.ids.length,
      {
        pollMs: 120,
        maxMs: MAX_TIME + 500,
        onTick: (el) => {
          for (const id of ctx.ids) {
            if (!(id in fallen) && pos[id] >= 1) fallen[id] = el;
          }
          publishState();
        },
      }
    );
    off();

    const end = ctx.now() - start;
    const outcomes = {};
    const reveal = {};
    for (const id of ctx.ids) {
      const t = id in fallen ? fallen[id] : Math.max(end, MAX_TIME);
      outcomes[id] = t;
      reveal[id] = { display: id in fallen ? secs(t) + ' overleefd' : 'bleef staan! 🏝️', fell: id in fallen };
    }
    return { outcomes, reveal };
  },
};
