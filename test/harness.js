'use strict';

// Virtuele-klok-harnas om een minigame-module geïsoleerd te draaien, zonder echte
// timers of sockets. Geeft volledige controle over tijd en speler-events, zodat de
// tests snel en deterministisch zijn.

// Deterministische pseudo-random (mulberry32) zodat doolhof e.d. reproduceerbaar zijn.
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeHarness(n, seed = 12345) {
  const players = [];
  for (let i = 0; i < n; i++) {
    players.push({
      id: 'p' + i,
      name: 'Speler ' + i,
      character: {},
      connected: true,
      waiting: false,
      total: 0,
    });
  }

  let clock = 0;
  const sleeps = []; // { at, resolve, done }
  const intervals = []; // { ms, next, fn, stopped }
  let handler = null;
  let aborted = false;

  const room = { mg: null, players: new Map(players.map((p) => [p.id, p])) };

  const ctx = {
    players,
    ids: players.map((p) => p.id),
    rng: makeRng(seed),
    room,
    now: () => clock,
    publish(s) {
      room.mg = s;
    },
    patch(p) {
      room.mg = Object.assign({}, room.mg, p);
    },
    onEvent(fn) {
      handler = fn;
      return () => {
        if (handler === fn) handler = null;
      };
    },
    sleep(ms) {
      return new Promise((resolve) => {
        sleeps.push({ at: clock + ms, resolve, done: false });
      });
    },
    every(ms, fn) {
      const iv = { ms, next: clock + ms, fn, stopped: false };
      intervals.push(iv);
      return () => {
        iv.stopped = true;
      };
    },
    isActive: (id) =>
      players.some((p) => p.id === id && p.connected && !p.waiting),
    isAborted: () => aborted,
    WORST: Number.MAX_SAFE_INTEGER,
  };

  async function flush() {
    // Laat hangende microtasks lopen.
    for (let i = 0; i < 5; i++) await Promise.resolve();
  }

  async function advance(ms) {
    const target = clock + ms;
    let guard = 0;
    while (clock < target) {
      if (guard++ > 100000) throw new Error('advance vastgelopen');
      let next = target;
      for (const iv of intervals) if (!iv.stopped) next = Math.min(next, iv.next);
      for (const s of sleeps) if (!s.done) next = Math.min(next, s.at);
      clock = Math.min(next, target);
      for (const iv of intervals) {
        while (!iv.stopped && iv.next <= clock) {
          iv.fn();
          iv.next += iv.ms;
        }
      }
      for (const s of sleeps) {
        if (!s.done && s.at <= clock) {
          s.done = true;
          s.resolve();
        }
      }
      await flush();
    }
  }

  function emit(pid, payload) {
    if (handler) handler(pid, payload);
  }

  return {
    ctx,
    players,
    emit,
    advance,
    flush,
    now: () => clock,
    abort: () => {
      aborted = true;
    },
  };
}

module.exports = { makeHarness, makeRng };
