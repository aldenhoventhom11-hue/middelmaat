'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { makeHarness } = require('./harness');
const { minigames } = require('../server/minigames');
const { scoreRound } = require('../server/scoring');

// Scenario per minigame: drijf de spelers met onderscheidende invoer en geef de
// uitkomsten terug. Realtime games krijgen gestaffelde events; geheime games
// leveren direct in.
const scenarios = {
  async berenrace(h, n) {
    await h.advance(2300); // voorbij de 3-2-1 aftelling
    for (let i = 0; i < n; i++) {
      await h.advance(150 * (i + 1));
      h.emit('p' + i, { type: 'hide' });
    }
    await h.advance(21000);
  },
  async doolhof(h, n) {
    await h.advance(2300);
    for (let i = 0; i < n; i++) {
      await h.advance(300 * (i + 1));
      h.emit('p' + i, { type: 'reach' });
    }
    await h.advance(61000);
  },
  async schermstaren(h, n) {
    await h.flush();
    for (let i = 0; i < n; i++) h.emit('p' + i, { type: 'down' });
    await h.advance(300); // poll detecteert dat iedereen klaar is
    for (let i = 0; i < n; i++) {
      await h.advance(120 * (i + 1));
      h.emit('p' + i, { type: 'up' });
    }
    await h.advance(31000);
  },
  async tikkampioen(h, n) {
    await h.advance(2400);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k <= i; k++) h.emit('p' + i, { type: 'tap' });
    }
    await h.advance(6000);
  },
  async ballon(h, n) {
    await h.flush();
    for (let i = 0; i < n; i++) h.emit('p' + i, { type: 'submit', value: i + 1 });
    await h.flush();
  },
  async lift(h, n) {
    await h.flush();
    for (let i = 0; i < n; i++) h.emit('p' + i, { type: 'submit', value: Math.min(20, i + 1) });
    await h.flush();
  },
  async schatten(h, n) {
    await h.flush();
    for (let i = 0; i < n; i++) h.emit('p' + i, { type: 'submit', value: Math.min(100, i * 8) });
    await h.flush();
  },
  async toren(h, n) {
    await h.advance(2400); // voorbij aftelling
    for (let i = 0; i < n; i++) {
      await h.advance(250); // gestaffeld, ruim binnen de 9s
      h.emit('p' + i, { type: 'stop' });
    }
    await h.advance(10000);
  },
  async verdeelheers(h, n) {
    await h.flush();
    for (let i = 0; i < n; i++) {
      const target = 'p' + ((i + 1) % n);
      h.emit('p' + i, { type: 'submit', value: { [target]: 5 } });
    }
    await h.flush();
  },
  async gemiddeldgetal(h, n) {
    await h.flush();
    for (let i = 0; i < n; i++)
      h.emit('p' + i, { type: 'submit', value: Math.min(100, i * 10) });
    await h.flush();
  },
  async pizzapunt(h, n) {
    await h.flush();
    for (let i = 0; i < n; i++)
      h.emit('p' + i, { type: 'submit', value: Math.min(12, i) });
    await h.flush();
  },
  async blindeschutter(h, n) {
    await h.flush();
    for (let i = 0; i < n; i++)
      h.emit('p' + i, { type: 'submit', value: { angle: 30 + i * 3, power: 50 } });
    await h.flush();
  },
  async cirkeltrek(h, n) {
    await h.flush();
    for (let i = 0; i < n; i++) {
      const s = 0.1 + 0.05 * i;
      const path = [
        [0, 0],
        [s, 0],
        [s, s],
        [0, s],
      ];
      h.emit('p' + i, { type: 'submit', value: { path } });
    }
    await h.flush();
  },
};

// Controleer dat een reeks scores eerst (zwak) stijgt en daarna (zwak) daalt.
function assertUnimodal(arr) {
  const eps = 1e-9;
  let i = 1;
  // stijgende flank
  while (i < arr.length && arr[i] >= arr[i - 1] - eps) i++;
  // dalende flank
  while (i < arr.length && arr[i] <= arr[i - 1] + eps) i++;
  assert.strictEqual(i, arr.length, 'scores zijn unimodaal: ' + JSON.stringify(arr));
}

async function runGame(game, n) {
  const h = makeHarness(n);
  const scenario = scenarios[game.id];
  assert.ok(scenario, 'geen scenario voor ' + game.id);
  const p = game.run(h.ctx);
  await scenario(h, n);
  return await p;
}

for (const game of minigames.values()) {
  for (const n of [3, 10]) {
    test(`${game.id}: ${n} spelers levert nette uitkomsten en scores`, async () => {
      const result = await runGame(game, n);
      assert.ok(result && result.outcomes, 'geen outcomes');
      const ids = Object.keys(result.outcomes);
      assert.strictEqual(ids.length, n, 'elke speler heeft een uitkomst');

      // Alle uitkomsten zijn eindige getallen.
      for (const id of ids) {
        assert.ok(Number.isFinite(result.outcomes[id]), id + ' uitkomst is een getal');
      }

      // Scoring toepassen en de spec-eigenschappen controleren.
      const entries = ids.map((id) => ({ id, value: result.outcomes[id] }));
      const scores = scoreRound(entries, game.scoring || 'symmetric');
      const vals = Object.values(scores);
      assert.strictEqual(vals.length, n);
      assert.ok(Math.max(...vals) > 0, 'er is een winnaar met punten');

      const sorted = [...entries].sort((a, b) => a.value - b.value);
      const ordered = sorted.map((e) => scores[e.id]);
      if ((game.scoring || 'symmetric') === 'symmetric') {
        // Middelmaat is goud: scores zijn unimodaal langs de gesorteerde waarden
        // (stijgen naar het midden, dalen naar de extremen). Ties worden gemiddeld,
        // dus dit geldt ook bij gelijke uitkomsten.
        assertUnimodal(ordered);
        // Bij een uniek laagste/hoogste uitkomst is dat extreem exact 0.
        if (sorted[0].value !== sorted[1].value) {
          assert.strictEqual(ordered[0], 0, 'uniek laagste extreem = 0');
        }
        if (sorted[n - 1].value !== sorted[n - 2].value) {
          assert.strictEqual(ordered[n - 1], 0, 'uniek hoogste extreem = 0');
        }
      } else {
        // closest: scores dalen we. De dichtstbij wint, de verste krijgt 0.
        for (let i = 1; i < n; i++) {
          assert.ok(ordered[i] <= ordered[i - 1] + 1e-9, 'monotoon dalend');
        }
        assert.strictEqual(ordered[0], Math.max(...vals), 'dichtstbij = meeste punten');
        if (sorted[n - 1].value !== sorted[n - 2].value) {
          assert.strictEqual(ordered[n - 1], 0, 'verste = 0');
        }
      }
    });
  }
}
