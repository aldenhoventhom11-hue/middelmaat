'use strict';

const { scoreRound } = require('./scoring');
const { MIN_PLAYERS } = require('./lobby');

// Sentinel voor "slechtst mogelijke uitkomst" (disconnect / niet ingeleverd).
// Sorteert altijd naar de hoge extreem -> 0 punten. Wordt nooit als getal naar
// de client gestuurd (in de onthulling tonen we 'verbinding verbroken').
const WORST = Number.MAX_SAFE_INTEGER;

function pickGames(allGames, n, rng) {
  const pool = [...allGames];
  // Fisher-Yates met de meegegeven rng.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length));
}

class GameEngine {
  constructor(room, io, minigames, rng = Math.random) {
    this.room = room;
    this.io = io;
    this.minigames = minigames; // map id -> module
    this.rng = rng;
    this.aborted = false;
    this.abortReason = null;

    this._timers = new Set();
    this._waiters = new Set(); // pending {resolve} voor abortable waits
    this._continueResolve = null; // wacht op host "volgende"
    this._eventHandler = null; // huidige minigame-event-handler
  }

  // ---- Broadcast ----
  broadcast() {
    for (const p of this.room.players.values()) {
      if (p.connected && p.socketId) {
        this.io.to(p.socketId).emit('state', this.room.publicView(p.id));
      }
    }
  }

  // ---- Timers (auto-opgeruimd bij abort) ----
  _setTimeout(ms, cb) {
    const t = setTimeout(() => {
      this._timers.delete(t);
      if (!this.aborted) cb();
    }, ms);
    this._timers.add(t);
    return t;
  }

  _every(ms, cb) {
    const t = setInterval(() => {
      if (this.aborted) {
        clearInterval(t);
        this._timers.delete(t);
        return;
      }
      cb();
    }, ms);
    this._timers.add(t);
    return () => {
      clearInterval(t);
      this._timers.delete(t);
    };
  }

  sleep(ms) {
    return new Promise((resolve) => {
      const waiter = { resolve };
      this._waiters.add(waiter);
      const t = this._setTimeout(ms, () => {
        this._waiters.delete(waiter);
        resolve();
      });
      waiter.cancel = () => {
        clearTimeout(t);
        this._timers.delete(t);
      };
    });
  }

  // ---- Host "volgende" ----
  waitForContinue() {
    return new Promise((resolve) => {
      this._continueResolve = resolve;
    });
  }

  hostContinue(playerId) {
    if (!this.room.isHost(playerId)) return;
    if (this._continueResolve) {
      const r = this._continueResolve;
      this._continueResolve = null;
      r();
    }
  }

  // ---- Minigame-events ----
  onEvent(fn) {
    this._eventHandler = fn;
    return () => {
      if (this._eventHandler === fn) this._eventHandler = null;
    };
  }

  routeEvent(playerId, payload) {
    if (this._eventHandler) this._eventHandler(playerId, payload);
  }

  // ---- Abort ----
  abort(reason) {
    if (this.aborted) return;
    this.aborted = true;
    this.abortReason = reason;
    for (const t of this._timers) {
      clearTimeout(t);
      clearInterval(t);
    }
    this._timers.clear();
    for (const w of this._waiters) {
      if (w.cancel) w.cancel();
      w.resolve();
    }
    this._waiters.clear();
    if (this._continueResolve) {
      const r = this._continueResolve;
      this._continueResolve = null;
      r();
    }
  }

  // ---- Context voor een minigame ----
  makeContext(activePlayers) {
    const self = this;
    return {
      players: activePlayers,
      ids: activePlayers.map((p) => p.id),
      rng: this.rng,
      room: this.room,
      now: () => Date.now(),
      publish(mgState) {
        self.room.mg = mgState;
        self.broadcast();
      },
      patch(partial) {
        self.room.mg = Object.assign({}, self.room.mg, partial);
        self.broadcast();
      },
      onEvent: (fn) => self.onEvent(fn),
      sleep: (ms) => self.sleep(ms),
      every: (ms, fn) => self._every(ms, fn),
      isActive: (id) => {
        const p = self.room.players.get(id);
        return !!(p && p.connected && !p.waiting);
      },
      isAborted: () => self.aborted,
      WORST,
    };
  }

  // ---- Hoofdloop ----
  async run() {
    const room = this.room;
    try {
      // Reset voor een nieuw spel.
      for (const p of room.players.values()) {
        p.total = 0;
        if (p.waiting) p.waiting = false; // wachtrij mag nu meedoen
      }
      room.podium = null;

      // Het rad: start met alle minigames; elke gespeelde verdwijnt eruit.
      let remaining = [...this.minigames.values()];
      const rounds = Math.min(room.totalRounds, remaining.length);

      for (let r = 0; r < rounds; r++) {
        if (this.aborted) return;
        // Kies live uit het resterende pool (server-autoritair).
        const idx = Math.floor(this.rng() * remaining.length);
        const game = remaining[idx];
        room.roundIndex = r;
        room.currentGame = {
          id: game.id,
          title: game.title,
          theme: game.theme,
          rules: game.rules,
          type: game.type,
          emoji: game.emoji,
        };
        // Rad-data: alle opties die nog op het rad staan + de gekozen game.
        room.wheel = {
          round: r,
          selectedId: game.id,
          options: remaining.map((g) => ({ id: g.id, title: g.title, emoji: g.emoji })),
        };
        // Verwijder de gekozen game van het rad voor de volgende ronde.
        remaining = remaining.filter((g) => g.id !== game.id);

        // --- Intro (rad draait, daarna de uitleg-kaart) ---
        room.phase = 'intro';
        room.mg = null;
        room.reveal = null;
        this.broadcast();
        await this.waitForContinue(); // host klikt "Start ronde"
        if (this.aborted) return;

        if (room.connectedActivePlayers().length < MIN_PLAYERS) {
          return this.endAbort('Te weinig spelers om door te gaan.');
        }

        // --- Spelen ---
        room.phase = 'playing';
        const active = room.connectedActivePlayers();
        const ctx = this.makeContext(active);
        let result;
        try {
          result = await game.run(ctx);
        } finally {
          this._eventHandler = null;
        }
        if (this.aborted) return;

        // --- Uitkomsten samenstellen + scoren ---
        const outcomes = result.outcomes || {};
        const entries = active.map((p) => {
          const acted = Object.prototype.hasOwnProperty.call(outcomes, p.id);
          const disconnected = !p.connected;
          let value = acted ? outcomes[p.id] : WORST;
          if (disconnected) value = WORST;
          return { id: p.id, value, disconnected: disconnected || !acted };
        });

        const roundScores = scoreRound(
          entries.map((e) => ({ id: e.id, value: e.value })),
          game.scoring || 'symmetric'
        );

        for (const e of entries) {
          const p = room.players.get(e.id);
          if (p) p.total += roundScores[e.id] || 0;
        }

        // --- Onthulling ---
        room.phase = 'reveal';
        room.reveal = this.buildReveal(entries, roundScores, result, game);
        this.broadcast();
        await this.waitForContinue(); // host klikt "Volgende"
        if (this.aborted) return;
      }

      // --- Eindstand + eventuele tiebreak ---
      if (this.aborted) return;
      await this.resolvePodium();
    } catch (err) {
      if (!this.aborted) {
        console.error('GameEngine fout:', err);
        this.endAbort('Er ging iets mis in het spel.');
      }
    }
  }

  buildReveal(entries, roundScores, result, game) {
    const room = this.room;
    const extra = (result && result.reveal) || {};
    const rows = entries.map((e) => {
      const p = room.players.get(e.id);
      const ex = extra[e.id] || {};
      return {
        id: e.id,
        name: p ? p.name : '?',
        character: p ? p.character : null,
        disconnected: e.disconnected,
        value: e.disconnected ? null : e.value,
        display: e.disconnected ? 'verbinding verbroken' : ex.display,
        roundScore: roundScores[e.id] || 0,
        total: p ? p.total : 0,
        ...ex,
      };
    });

    // Ronde-ranking: hoogste rondescore eerst (de meest gemiddelde = winnaar).
    const ranking = [...rows].sort((a, b) => b.roundScore - a.roundScore);
    // Tussenstand op totaal.
    const standings = [...rows].sort((a, b) => b.total - a.total);

    return {
      gameId: game.id,
      gameTitle: game.title,
      scoring: game.scoring || 'symmetric',
      meta: extra._meta || null,
      ranking,
      standings,
      roundIndex: room.roundIndex,
      totalRounds: room.totalRounds,
    };
  }

  async resolvePodium() {
    const room = this.room;
    const players = room.activePlayers();
    // Bepaal de koplopers (gelijke topscore -> tiebreak-minigame).
    let guard = 0;
    while (true) {
      guard++;
      const maxTotal = Math.max(...players.map((p) => p.total));
      const leaders = players.filter((p) => p.total === maxTotal);
      if (leaders.length <= 1 || guard > 10) break;
      // Tiebreak: snelle willekeurige minigame tussen alleen de koplopers.
      const ok = await this.runTiebreak(leaders);
      if (!ok || this.aborted) break;
    }
    if (this.aborted) return;

    const ranked = [...players].sort((a, b) => b.total - a.total);
    room.phase = 'podium';
    room.mg = null;
    room.reveal = null;
    room.podium = {
      ranking: ranked.map((p, i) => ({
        rank: i + 1,
        id: p.id,
        name: p.name,
        character: p.character,
        total: p.total,
      })),
      winnerId: ranked.length ? ranked[0].id : null,
      loserId: ranked.length ? ranked[ranked.length - 1].id : null,
    };
    this.broadcast();
  }

  async runTiebreak(leaders) {
    const room = this.room;
    const game = pickGames([...this.minigames.values()], 1, this.rng)[0];
    if (!game) return false;
    room.phase = 'intro';
    room.currentGame = {
      id: game.id,
      title: game.title,
      theme: game.theme,
      rules: game.rules,
      type: game.type,
      tiebreak: true,
      emoji: game.emoji,
    };
    room.reveal = null;
    room.wheel = null; // geen rad bij de tiebreak
    room.mg = { tiebreak: true, leaderNames: leaders.map((l) => l.name) };
    this.broadcast();
    await this.waitForContinue();
    if (this.aborted) return false;

    const active = leaders.filter((p) => p.connected);
    if (active.length < 2) return false;
    room.phase = 'playing';
    const ctx = this.makeContext(active);
    let result;
    try {
      result = await game.run(ctx);
    } finally {
      this._eventHandler = null;
    }
    if (this.aborted) return false;

    const outcomes = result.outcomes || {};
    const ranked = active.map((p) => ({
      p,
      value:
        p.connected && Object.prototype.hasOwnProperty.call(outcomes, p.id)
          ? outcomes[p.id]
          : WORST,
    }));

    // De middelmaat-scoring kan een 2-persoons gelijkstand niet beslissen (beide
    // extremen = 0). Daarom kiest de tiebreak deterministisch precies één winnaar:
    // de speler die het dichtst bij het gemiddelde van de koplopers zit. Gelijk?
    // Dan de laagste uitkomst, en als laatste redmiddel op id. Zo termineert het
    // altijd in één ronde met een unieke winnaar.
    const mean =
      ranked.reduce((s, r) => s + r.value, 0) / (ranked.length || 1);
    ranked.sort((a, b) => {
      const da = Math.abs(a.value - mean);
      const db = Math.abs(b.value - mean);
      if (da !== db) return da - db;
      if (a.value !== b.value) return a.value - b.value;
      return a.p.id < b.p.id ? -1 : 1;
    });
    const winner = ranked[0].p;
    winner.total += 0.001; // minieme bonus, breekt alleen de gelijkstand

    room.phase = 'reveal';
    room.reveal = {
      tiebreak: true,
      gameTitle: game.title,
      winnerId: winner.id,
      ranking: ranked.map((r) => ({
        id: r.p.id,
        name: r.p.name,
        character: r.p.character,
        display: r.value === WORST ? 'geen inzending' : String(r.value),
        total: r.p.total,
        winner: r.p.id === winner.id,
      })),
    };
    this.broadcast();
    await this.waitForContinue();
    return true;
  }

  endAbort(message) {
    this.abort(message);
    this.room.phase = 'lobby';
    this.room.engine = null;
    this.room.mg = null;
    this.room.reveal = null;
    this.room.podium = null;
    this.room.roundIndex = -1;
    this.room.currentGame = null;
    for (const p of this.room.players.values()) {
      if (p.connected && p.socketId) {
        this.io.to(p.socketId).emit('game:aborted', { message });
        this.io.to(p.socketId).emit('state', this.room.publicView(p.id));
      }
    }
  }
}

module.exports = { GameEngine, pickGames, WORST };
