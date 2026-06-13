'use strict';

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const {
  RoomManager,
  Player,
  MIN_PLAYERS,
  MAX_PLAYERS,
} = require('./lobby');
const { GameEngine } = require('./game');
const { minigames } = require('./minigames');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Statische frontend op dezelfde poort als de sockets.
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/healthz', (req, res) => res.json({ ok: true }));

const rooms = new RoomManager();

// ---- Helpers ----
function genPlayerId() {
  return (
    Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
  );
}

function sanitizeName(name) {
  const s = String(name == null ? '' : name).trim().slice(0, 16);
  return s.length ? s : 'Speler';
}

function sanitizeDevice(d) {
  return typeof d === 'string' && d.length ? d.slice(0, 64) : null;
}

const HAIR_STYLES = ['kort', 'krullen', 'lang', 'staart', 'stekels', 'bob', 'kaal'];
const FACES = ['blij', 'neutraal', 'stoer', 'verbaasd'];
const GENDERS = ['man', 'vrouw'];
const OUTFITS = ['broek', 'rok', 'jurk'];
const GLASSES = ['geen', 'rond', 'nerd', 'zonnebril'];
const BEARDS = ['geen', 'snor', 'sik', 'vol'];
const ACC_HATS = ['geen', 'pet', 'muts', 'hoge hoed', 'kroon', 'bloem'];

function sanitizeCharacter(c) {
  c = c && typeof c === 'object' ? c : {};
  const pick = (val, list, def) => (list.includes(val) ? val : def);
  const color = (val, def) =>
    typeof val === 'string' && /^#[0-9a-fA-F]{6}$/.test(val) ? val : def;
  const num01 = (val, def) =>
    typeof val === 'number' && isFinite(val) ? Math.max(0, Math.min(1, val)) : def;
  return {
    gender: pick(c.gender, GENDERS, 'man'),
    skin: color(c.skin, '#f3c89b'),
    hair: pick(c.hair, HAIR_STYLES, 'kort'),
    hairColor: color(c.hairColor, '#5a3210'),
    height: num01(c.height, 0.5),
    build: num01(c.build, 0.5),
    top: color(c.top, '#5b8cff'),
    bottom: color(c.bottom, '#2b2d42'),
    outfit: pick(c.outfit, OUTFITS, 'broek'),
    face: pick(c.face, FACES, 'blij'),
    glasses: pick(c.glasses, GLASSES, 'geen'),
    beard: pick(c.beard, BEARDS, 'geen'),
    hat: pick(c.hat, ACC_HATS, 'geen'),
  };
}

function sendState(room, player) {
  if (player.connected && player.socketId) {
    io.to(player.socketId).emit('state', room.publicView(player.id));
  }
}

function broadcastRoom(room) {
  for (const p of room.players.values()) sendState(room, p);
}

function emitError(socket, message) {
  socket.emit('errormsg', { message });
}

// ---- Socket-afhandeling ----
io.on('connection', (socket) => {
  socket.data.code = null;
  socket.data.playerId = null;

  socket.on('lobby:create', (data, ack) => {
    try {
      const name = sanitizeName(data && data.name);
      const character = sanitizeCharacter(data && data.character);
      const deviceId = sanitizeDevice(data && data.deviceId);
      const room = rooms.createRoom();
      const player = new Player(genPlayerId(), name, character);
      player.socketId = socket.id;
      player.deviceId = deviceId;
      room.players.set(player.id, player);
      room.hostId = player.id;
      socket.data.code = room.code;
      socket.data.playerId = player.id;
      socket.join(room.code);
      if (typeof ack === 'function') {
        ack({ ok: true, code: room.code, playerId: player.id });
      }
      broadcastRoom(room);
    } catch (err) {
      console.error('create fout', err);
      if (typeof ack === 'function') ack({ ok: false, message: 'Kon lobby niet aanmaken.' });
    }
  });

  socket.on('lobby:join', (data, ack) => {
    const reply = (obj) => typeof ack === 'function' && ack(obj);
    try {
      const room = rooms.getRoom(data && data.code);
      if (!room) return reply({ ok: false, message: 'Lobby niet gevonden.' });
      if (room.players.size >= MAX_PLAYERS) {
        return reply({ ok: false, message: 'Lobby is vol (max ' + MAX_PLAYERS + ').' });
      }
      const deviceId = sanitizeDevice(data && data.deviceId);
      // Eén keer joinen per apparaat per lobby.
      if (deviceId) {
        const dup = [...room.players.values()].find(
          (p) => p.deviceId === deviceId && p.connected
        );
        if (dup) {
          return reply({ ok: false, message: 'Dit apparaat doet al mee in deze lobby.' });
        }
      }
      const name = sanitizeName(data && data.name);
      const character = sanitizeCharacter(data && data.character);
      const player = new Player(genPlayerId(), name, character);
      player.socketId = socket.id;
      player.deviceId = deviceId;
      // Mid-game gejoind? Dan wacht je tot het volgende spel.
      player.waiting = room.phase !== 'lobby';
      room.players.set(player.id, player);
      if (!room.hostId) room.hostId = player.id;
      socket.data.code = room.code;
      socket.data.playerId = player.id;
      socket.join(room.code);
      reply({ ok: true, code: room.code, playerId: player.id, waiting: player.waiting });
      broadcastRoom(room);
    } catch (err) {
      console.error('join fout', err);
      reply({ ok: false, message: 'Kon niet joinen.' });
    }
  });

  socket.on('lobby:rejoin', (data, ack) => {
    const reply = (obj) => typeof ack === 'function' && ack(obj);
    const room = rooms.getRoom(data && data.code);
    if (!room) return reply({ ok: false, message: 'Lobby bestaat niet meer.' });
    const player = room.players.get(data && data.playerId);
    if (!player) return reply({ ok: false, message: 'Speler niet gevonden.' });
    player.socketId = socket.id;
    player.connected = true;
    socket.data.code = room.code;
    socket.data.playerId = player.id;
    socket.join(room.code);
    if (!room.hostId) room.reassignHost();
    reply({ ok: true, code: room.code, playerId: player.id });
    broadcastRoom(room);
  });

  socket.on('lobby:start', (data) => {
    const room = rooms.getRoom(socket.data.code);
    if (!room) return;
    if (!room.isHost(socket.data.playerId)) return;
    if (room.phase !== 'lobby') return;
    if (room.connectedActivePlayers().length < MIN_PLAYERS) {
      return emitError(socket, 'Je hebt minstens ' + MIN_PLAYERS + ' spelers nodig.');
    }
    // Host kiest het aantal rondes (3/5/7).
    const rounds = data && [3, 5, 7].includes(data.rounds) ? data.rounds : 5;
    room.totalRounds = rounds;
    room.engine = new GameEngine(room, io, minigames);
    room.engine.run().then(() => {
      // Spel klaar: engine blijft staan tot host herstart.
    });
  });

  socket.on('game:next', () => {
    const room = rooms.getRoom(socket.data.code);
    if (!room || !room.engine) return;
    if (!room.isHost(socket.data.playerId)) return;
    room.engine.hostContinue(socket.data.playerId);
  });

  // Host rondt de lopende minigame vroegtijdig af.
  socket.on('game:force', () => {
    const room = rooms.getRoom(socket.data.code);
    if (!room || !room.engine) return;
    if (!room.isHost(socket.data.playerId)) return;
    room.engine.forceEnd(socket.data.playerId);
  });

  // Lobby-chat.
  socket.on('lobby:chat', (data) => {
    const room = rooms.getRoom(socket.data.code);
    if (!room) return;
    const player = room.players.get(socket.data.playerId);
    if (!player) return;
    let text = String((data && data.text) || '').trim().slice(0, 120);
    if (!text) return;
    room.chat.push({ name: player.name, text, id: player.id });
    if (room.chat.length > 30) room.chat.shift();
    broadcastRoom(room);
  });

  // Speler verlaat de lobby ("Terug").
  socket.on('lobby:leave', () => {
    const room = rooms.getRoom(socket.data.code);
    const pid = socket.data.playerId;
    socket.data.code = null;
    socket.data.playerId = null;
    if (!room) return;
    const player = room.players.get(pid);
    if (!player) return;
    const wasHost = room.isHost(player.id);
    room.players.delete(player.id);
    socket.leave(room.code);
    const anyConnected = [...room.players.values()].some((p) => p.connected);
    if (!anyConnected) {
      rooms.removeRoom(room.code);
      return;
    }
    if (wasHost) room.reassignHost();
    if (room.engine && room.phase !== 'lobby' &&
        room.connectedActivePlayers().length < MIN_PLAYERS) {
      room.engine.endAbort('Te weinig spelers — het spel is gestopt.');
    }
    broadcastRoom(room);
  });

  socket.on('game:restart', () => {
    const room = rooms.getRoom(socket.data.code);
    if (!room) return;
    if (!room.isHost(socket.data.playerId)) return;
    if (room.engine) room.engine.abort('herstart');
    room.engine = null;
    room.phase = 'lobby';
    room.mg = null;
    room.reveal = null;
    room.podium = null;
    room.roundIndex = -1;
    room.currentGame = null;
    for (const p of room.players.values()) {
      p.total = 0;
      p.waiting = false;
    }
    broadcastRoom(room);
  });

  socket.on('mg:event', (payload) => {
    const room = rooms.getRoom(socket.data.code);
    if (!room || !room.engine) return;
    if (!socket.data.playerId) return;
    room.engine.routeEvent(socket.data.playerId, payload);
  });

  socket.on('disconnect', () => {
    const room = rooms.getRoom(socket.data.code);
    if (!room) return;
    const player = room.players.get(socket.data.playerId);
    if (!player) return;
    player.connected = false;
    player.socketId = null;

    const wasHost = room.isHost(player.id);

    // Tijdens de lobby: verwijder de speler meteen.
    if (room.phase === 'lobby') {
      room.players.delete(player.id);
    }

    // Lobby leeg? Ruim de room op.
    const anyConnected = [...room.players.values()].some((p) => p.connected);
    if (!anyConnected) {
      rooms.removeRoom(room.code);
      return;
    }

    if (wasHost) room.reassignHost();

    // Mid-game te weinig actieve spelers -> netjes afbreken.
    if (room.engine && room.phase !== 'lobby') {
      if (room.connectedActivePlayers().length < MIN_PLAYERS) {
        room.engine.endAbort('Te weinig spelers — het spel is gestopt.');
        broadcastRoom(room);
        return;
      }
    }

    broadcastRoom(room);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Middelmaat draait op poort ' + PORT);
});

module.exports = { app, server };
