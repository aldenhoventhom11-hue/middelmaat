'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { GameEngine, pickGames } = require('../server/game');
const { Room, Player } = require('../server/lobby');

// Stille io-stub: vangt emits op zonder iets te doen.
const fakeIo = { to: () => ({ emit: () => {} }) };

function makeRoom(n) {
  const room = new Room('TEST01');
  for (let i = 0; i < n; i++) {
    const p = new Player('p' + i, 'Speler ' + i, {});
    p.socketId = 's' + i;
    p.connected = true;
    room.players.set(p.id, p);
  }
  room.hostId = 'p0';
  return room;
}

// Stub-minigame die elke speler een onderscheidende uitkomst (index) geeft.
function stubGame(id, opts = {}) {
  return {
    id,
    title: 'Stub ' + id,
    theme: '',
    rules: '',
    type: 'realtime',
    scoring: 'symmetric',
    async run(ctx) {
      if (opts.onRun) opts.onRun(ctx);
      const outcomes = {};
      ctx.players.forEach((p, i) => {
        outcomes[p.id] = i;
      });
      return { outcomes, reveal: {} };
    },
  };
}

async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

// Drijf de host-flow tot het podium of een afbreuk.
async function driveToEnd(engine, room) {
  const done = engine.run();
  for (let guard = 0; guard < 200; guard++) {
    await flush();
    if (room.phase === 'podium' || room.phase === 'lobby') break;
    if (room.phase === 'intro' || room.phase === 'reveal') {
      engine.hostContinue('p0');
    }
  }
  await done;
}

test('volledig spel van 2 rondes met 3 spelers -> podium met juiste totalen', async () => {
  const room = makeRoom(3);
  room.totalRounds = 2;
  const games = new Map([
    ['a', stubGame('a')],
    ['b', stubGame('b')],
  ]);
  const engine = new GameEngine(room, fakeIo, games, () => 0.5);
  room.engine = engine;
  await driveToEnd(engine, room);

  assert.strictEqual(room.phase, 'podium');
  assert.ok(room.podium, 'podium aanwezig');
  assert.strictEqual(room.podium.ranking.length, 3);
  // Per ronde outcomes [0,1,2] -> scores [0,1,0]; over 2 rondes: p1=2, p0=0, p2=0.
  const totals = {};
  for (const p of room.players.values()) totals[p.id] = p.total;
  assert.strictEqual(totals.p1, 2);
  assert.strictEqual(totals.p0, 0);
  assert.strictEqual(totals.p2, 0);
  assert.strictEqual(room.podium.winnerId, 'p1');
});

test('disconnect midden in een ronde -> slechtst mogelijke uitkomst (0 punten)', async () => {
  const room = makeRoom(5);
  room.totalRounds = 1;
  // In ronde verbreekt p2 (middenpositie qua index) de verbinding.
  const games = new Map([
    [
      'a',
      stubGame('a', {
        onRun: () => {
          room.players.get('p2').connected = false;
        },
      }),
    ],
  ]);
  const engine = new GameEngine(room, fakeIo, games, () => 0.5);
  room.engine = engine;
  await driveToEnd(engine, room);

  // p2 telt als extreem (WORST) -> 0 punten, ondanks middenindex.
  assert.strictEqual(room.players.get('p2').total, 0, 'disconnect -> 0 punten');
});

test('pickGames kiest het gevraagde aantal zonder herhaling', () => {
  const all = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((id) => ({
    id,
  }));
  let seed = 1;
  const rng = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const picked = pickGames(all, 5, rng);
  assert.strictEqual(picked.length, 5);
  assert.strictEqual(new Set(picked.map((g) => g.id)).size, 5, 'geen herhaling');
});

test('gelijke eindstand wordt via tiebreak gebroken', async () => {
  // 4 spelers, 1 ronde. Outcomes [0,1,2,3] -> scores [0,1,1,0]: p1 en p2 gelijk.
  const room = makeRoom(4);
  room.totalRounds = 1;
  const games = new Map([['a', stubGame('a')]]);
  const engine = new GameEngine(room, fakeIo, games, () => 0.5);
  room.engine = engine;
  await driveToEnd(engine, room);

  assert.strictEqual(room.phase, 'podium');
  // Na de tiebreak is er één unieke winnaar.
  const top = room.podium.ranking[0];
  const second = room.podium.ranking[1];
  assert.ok(top.total > second.total, 'unieke winnaar na tiebreak');
});
