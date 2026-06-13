'use strict';

const { runSecret } = require('./_secret');

// Minigame 9 — De Blinde Schutter (katapult in het donker).
// Kies in het geheim hoek + kracht. De server berekent de afstand met
// eenvoudige projectiel-fysica. Verste (in het water) en kortste (haalt de
// overkant niet) = extreem -> 0 punten. De gemiddelde afstand wint.
const MIN_ANGLE = 5;
const MAX_ANGLE = 85;
const MIN_POWER = 1;
const MAX_POWER = 100;

// Afstand ~ v^2 * sin(2θ) / g. We schalen v met de kracht en kiezen een factor
// die nette getallen geeft.
function computeDistance(angleDeg, power) {
  const rad = (angleDeg * Math.PI) / 180;
  const v = power; // 1..100
  const range = (v * v * Math.sin(2 * rad)) / 100; // 0..~100
  return Math.max(0, range);
}

module.exports = {
  id: 'blindeschutter',
  title: 'De Blinde Schutter',
  theme: 'Een katapult in het pikkedonker.',
  rules: 'Kies in het geheim hoek en kracht. De gemiddelde afstand wint. Te ver (in het water) of te kort (haalt het niet) verliest.',
  type: 'secret',
  scoring: 'symmetric',

  run(ctx) {
    return runSecret(ctx, {
      kind: 'blindeschutter',
      config: {
        minAngle: MIN_ANGLE,
        maxAngle: MAX_ANGLE,
        minPower: MIN_POWER,
        maxPower: MAX_POWER,
      },
      validate(value) {
        if (!value || typeof value !== 'object') return null;
        const angle = Number(value.angle);
        const power = Number(value.power);
        if (!Number.isFinite(angle) || !Number.isFinite(power)) return null;
        const a = Math.min(MAX_ANGLE, Math.max(MIN_ANGLE, angle));
        const pw = Math.min(MAX_POWER, Math.max(MIN_POWER, power));
        return { angle: a, power: pw };
      },
      compute(submissions) {
        const outcomes = {};
        const reveal = {};
        for (const id of Object.keys(submissions)) {
          const { angle, power } = submissions[id];
          const dist = computeDistance(angle, power);
          outcomes[id] = dist;
          reveal[id] = {
            display: dist.toFixed(1) + ' m',
            angle: Number(angle.toFixed(1)),
            power: Number(power.toFixed(1)),
            distance: Number(dist.toFixed(2)),
          };
        }
        return { outcomes, reveal };
      },
    });
  },
};
