'use strict';

const { waitUntil, countdown, secs } = require('./_realtime');

// Minigame 17 — Haaieneiland (joystick, survival).
// Iedereen staat op een rond platform met haaien eromheen. Je beweegt je eigen
// karakter met een joystick en kunt anderen van het eiland bonken. Wie als
// eerste én als laatste in het water valt, verliest; de middelste overlevingstijd
// wint. Server-autoritatief: posities en botsingen worden hier berekend.
const MAX_TIME = 25000;
const ACC = 0.008; // versnelling per tick uit de joystick
const FRICTION = 0.85;
const PR = 0.12; // botsstraal per speler
const MINDIST = PR * 2;

module.exports = {
  id: 'haaien',
  title: 'Haaieneiland',
  theme: 'Ren over het eiland en bonk de anderen in het haaienwater!',
  rules: 'Beweeg met de joystick en duw de anderen van het eiland. Niet als eerste of laatste in het water — de middelste overlevingstijd wint.',
  type: 'realtime',
  scoring: 'symmetric',

  async run(ctx) {
    if (!(await countdown(ctx, 'haaien'))) return { outcomes: {} };
    const start = ctx.now();
    const n = ctx.ids.length;
    const pos = {};
    const vel = {};
    const input = {};
    const fallen = {};
    ctx.ids.forEach((id, i) => {
      const a = (i / n) * Math.PI * 2;
      pos[id] = { x: Math.cos(a) * 0.4, y: Math.sin(a) * 0.4 };
      vel[id] = { x: 0, y: 0 };
      input[id] = { x: 0, y: 0 };
    });

    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, character: p.character }));
    const publishState = () => {
      const out = {};
      for (const id of ctx.ids) out[id] = { x: +pos[id].x.toFixed(3), y: +pos[id].y.toFixed(3) };
      ctx.patch({ phase: 'fight', pos: out, fallen: Object.keys(fallen) });
    };

    const off = ctx.onEvent((pid, p) => {
      if (!ctx.ids.includes(pid) || !p || pid in fallen) return;
      if (p.type === 'move') {
        let dx = Number(p.dx) || 0;
        let dy = Number(p.dy) || 0;
        const m = Math.hypot(dx, dy);
        if (m > 1) {
          dx /= m;
          dy /= m;
        }
        input[pid] = { x: dx, y: dy };
      }
    });

    ctx.publish({ kind: 'haaien', phase: 'fight', pos, fallen: [], players });

    await waitUntil(ctx, () => n - Object.keys(fallen).length <= 1, {
      pollMs: 55,
      maxMs: MAX_TIME + 500,
      onTick: (el) => {
        // beweging
        for (const id of ctx.ids) {
          if (id in fallen) continue;
          const v = vel[id];
          v.x = (v.x + input[id].x * ACC) * FRICTION;
          v.y = (v.y + input[id].y * ACC) * FRICTION;
          pos[id].x += v.x;
          pos[id].y += v.y;
        }
        // botsingen (paarsgewijs wegduwen)
        for (let i = 0; i < n; i++) {
          const a = ctx.ids[i];
          if (a in fallen) continue;
          for (let j = i + 1; j < n; j++) {
            const b = ctx.ids[j];
            if (b in fallen) continue;
            let dx = pos[b].x - pos[a].x;
            let dy = pos[b].y - pos[a].y;
            let d = Math.hypot(dx, dy) || 0.0001;
            if (d < MINDIST) {
              const nx = dx / d;
              const ny = dy / d;
              const overlap = (MINDIST - d) / 2;
              pos[a].x -= nx * overlap;
              pos[a].y -= ny * overlap;
              pos[b].x += nx * overlap;
              pos[b].y += ny * overlap;
              // impuls: bonk geeft elkaar snelheid
              const imp = 0.6;
              vel[a].x -= nx * overlap * imp;
              vel[a].y -= ny * overlap * imp;
              vel[b].x += nx * overlap * imp;
              vel[b].y += ny * overlap * imp;
            }
          }
        }
        // van het eiland?
        for (const id of ctx.ids) {
          if (id in fallen) continue;
          if (Math.hypot(pos[id].x, pos[id].y) > 1) fallen[id] = el;
        }
        publishState();
      },
    });
    off();

    // De laatste die nog staat valt symbolisch als allerlaatste (hoogste tijd).
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
