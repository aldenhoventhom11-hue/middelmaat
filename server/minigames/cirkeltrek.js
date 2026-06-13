'use strict';

const { runSecret } = require('./_secret');

// Minigame 10 — Cirkeltrek (perfecte cirkel tekenen).
// Teken in het geheim één gesloten cirkel. De server berekent de oppervlakte
// (shoelace) — autoritatief, dus rondheid telt niet mee. Grootste en kleinste
// oppervlakte = extreem -> 0 punten. De gemiddelde oppervlakte wint.
const MAX_POINTS = 600;

// Shoelace-oppervlakte van een gesloten polygoon in genormaliseerde coords.
function polygonArea(path) {
  let area = 0;
  const n = path.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = path[i];
    const [x2, y2] = path[(i + 1) % n];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

module.exports = {
  id: 'cirkeltrek',
  title: 'Cirkeltrek',
  theme: 'Teken één gesloten cirkel op een leeg scherm.',
  rules: 'Teken in het geheim één cirkel. Alleen de oppervlakte telt (niet de rondheid). De gemiddelde grootte wint.',
  type: 'secret',
  scoring: 'symmetric',

  run(ctx) {
    return runSecret(ctx, {
      kind: 'cirkeltrek',
      config: {},
      validate(value) {
        // value = { path: [[x,y], ...] } met x,y in 0..1.
        if (!value || !Array.isArray(value.path)) return null;
        const path = value.path;
        if (path.length < 3 || path.length > MAX_POINTS) return null;
        const clean = [];
        for (const pt of path) {
          if (!Array.isArray(pt) || pt.length < 2) return null;
          const x = Number(pt[0]);
          const y = Number(pt[1]);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
          if (x < -0.1 || x > 1.1 || y < -0.1 || y > 1.1) return null;
          clean.push([x, y]);
        }
        const area = polygonArea(clean);
        if (!(area > 0)) return null;
        return { path: clean, area };
      },
      compute(submissions) {
        const outcomes = {};
        const reveal = {};
        for (const id of Object.keys(submissions)) {
          const { path, area } = submissions[id];
          outcomes[id] = area; // server-autoritatieve oppervlakte
          reveal[id] = {
            display: (area * 100).toFixed(1) + '% van het vlak',
            area: Number(area.toFixed(4)),
            path,
          };
        }
        return { outcomes, reveal };
      },
    });
  },
};
