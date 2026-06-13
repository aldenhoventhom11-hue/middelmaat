'use strict';

const { waitUntil, countdown, secs } = require('./_realtime');

// Minigame 2 — Het Doolhof Dilemma (gemiddelde tijd wint).
// Iedereen krijgt exact hetzelfde doolhof. Tijd tot de uitgang = uitkomst.
// Snelste (streber) en langzaamste (treuzelaar) = extreem -> 0 punten.
const SAFETY = 60000;
const W = 11; // oneven voor recursive backtracking
const H = 11;

// Recursive backtracking; geeft een grid waar 1 = muur, 0 = pad.
function genMaze(rng) {
  const grid = [];
  for (let y = 0; y < H; y++) grid.push(new Array(W).fill(1));
  const stack = [[1, 1]];
  grid[1][1] = 0;
  const dirs = [
    [0, -2],
    [0, 2],
    [-2, 0],
    [2, 0],
  ];
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const opts = [];
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx > 0 && nx < W - 1 && ny > 0 && ny < H - 1 && grid[ny][nx] === 1) {
        opts.push([nx, ny, cx + dx / 2, cy + dy / 2]);
      }
    }
    if (opts.length === 0) {
      stack.pop();
      continue;
    }
    const [nx, ny, wx, wy] = opts[Math.floor(rng() * opts.length)];
    grid[wy][wx] = 0;
    grid[ny][nx] = 0;
    stack.push([nx, ny]);
  }
  grid[1][1] = 0;
  grid[H - 2][W - 2] = 0;
  return { grid, w: W, h: H, start: [1, 1], exit: [W - 2, H - 2] };
}

module.exports = {
  id: 'doolhof',
  title: 'Het Doolhof Dilemma',
  theme: 'Vind de uitgang — haast is een doodzonde, treuzelen dodelijk.',
  rules: 'Navigeer naar de uitgang. Niet de snelste of de langzaamste, maar de gemiddelde tijd wint.',
  type: 'realtime',
  scoring: 'symmetric',

  async run(ctx) {
    const maze = genMaze(ctx.rng);
    if (!(await countdown(ctx, 'doolhof', { maze }))) return { outcomes: {} };

    const start = ctx.now();
    const results = {};

    const off = ctx.onEvent((pid, p) => {
      if (!ctx.ids.includes(pid)) return;
      if (pid in results) return;
      if (!p || p.type !== 'reach') return;
      results[pid] = ctx.now() - start;
    });

    ctx.publish({
      kind: 'doolhof',
      phase: 'run',
      maze,
      total: ctx.ids.length,
      finished: [],
    });

    await waitUntil(
      ctx,
      (el) => Object.keys(results).length >= ctx.ids.length || el >= SAFETY,
      {
        pollMs: 250,
        maxMs: SAFETY + 500,
        onTick: () => ctx.patch({ finished: Object.keys(results) }),
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
