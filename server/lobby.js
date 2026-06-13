'use strict';

// Beheer van lobbies (rooms) en spelers. Alles in-memory; een lobby leeft zolang
// het spel duurt. De server is de single source of truth.

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 10;

// Code zonder verwarrende tekens (geen 0/O/1/I).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeCode(rng, exists) {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
    }
    if (!exists(code)) return code;
  }
  // Extreem onwaarschijnlijk; voeg een suffix toe als fallback.
  return CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)].repeat(6);
}

class Player {
  constructor(id, name, character) {
    this.id = id; // stabiel speler-id (reconnect-token), los van socket-id
    this.socketId = null;
    this.deviceId = null; // apparaat-token: 1 join per apparaat per lobby
    this.name = name;
    this.character = character; // { shape, color, eyes, mouth, hat }
    this.connected = true;
    this.waiting = false; // true = mid-game gejoind, doet pas volgend spel mee
    this.total = 0; // totaalscore over de rondes
  }

  publicView() {
    return {
      id: this.id,
      name: this.name,
      character: this.character,
      connected: this.connected,
      waiting: this.waiting,
      total: this.total,
    };
  }
}

class Room {
  constructor(code) {
    this.code = code;
    this.players = new Map(); // playerId -> Player
    this.hostId = null;
    this.phase = 'lobby'; // lobby | intro | playing | reveal | standings | podium
    this.engine = null; // GameEngine wanneer een spel loopt
    this.mg = null; // publieke minigame-state voor de client
    this.wheel = null; // rad-data (opties + gekozen game) bij de ronde-intro
    this.reveal = null; // ronde-onthulling
    this.podium = null;
    this.roundIndex = -1;
    this.totalRounds = 5;
    this.currentGame = null; // { id, title, theme, rules, type }
    this.lastActivity = Date.now();
  }

  activePlayers() {
    // Spelers die meedoen aan het huidige spel: verbonden en niet in de wachtrij.
    return [...this.players.values()].filter((p) => !p.waiting);
  }

  connectedActivePlayers() {
    return this.activePlayers().filter((p) => p.connected);
  }

  isHost(playerId) {
    return this.hostId === playerId;
  }

  // Draag host over aan de eerstvolgende verbonden speler.
  reassignHost() {
    const candidates = [...this.players.values()].filter((p) => p.connected);
    this.hostId = candidates.length ? candidates[0].id : null;
  }

  publicView(forPlayerId) {
    const players = [...this.players.values()].map((p) => p.publicView());
    return {
      code: this.code,
      phase: this.phase,
      hostId: this.hostId,
      totalRounds: this.totalRounds,
      roundIndex: this.roundIndex,
      currentGame: this.currentGame,
      mg: this.mg,
      wheel: this.wheel,
      reveal: this.reveal,
      podium: this.podium,
      players,
      you: forPlayerId
        ? {
            id: forPlayerId,
            isHost: this.hostId === forPlayerId,
          }
        : null,
    };
  }
}

class RoomManager {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.rooms = new Map(); // code -> Room
  }

  createRoom() {
    const code = makeCode(this.rng, (c) => this.rooms.has(c));
    const room = new Room(code);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code) {
    return this.rooms.get((code || '').toUpperCase());
  }

  removeRoom(code) {
    const room = this.rooms.get(code);
    if (room && room.engine) room.engine.abort('room verwijderd');
    this.rooms.delete(code);
  }
}

module.exports = { RoomManager, Room, Player, MIN_PLAYERS, MAX_PLAYERS };
