/* Dunne wrapper rond Socket.io. Houdt het reconnect-token alleen in geheugen
   (geen localStorage), zoals de spec vraagt. */
(function () {
  const socket = io({ transports: ['websocket', 'polling'] });

  // Persistent apparaat-token (alleen voor 'één join per apparaat', geen game-state).
  let deviceId;
  try {
    deviceId = localStorage.getItem('mm_device');
    if (!deviceId) {
      deviceId = 'd-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('mm_device', deviceId);
    }
  } catch (e) {
    deviceId = 'd-' + Math.random().toString(36).slice(2);
  }

  let code = null;
  let playerId = null;
  let onState = function () {};
  let onError = function () {};
  let onAborted = function () {};

  socket.on('state', (s) => onState(s));
  socket.on('errormsg', (e) => onError(e && e.message));
  socket.on('game:aborted', (e) => onAborted(e && e.message));

  // Bij herverbinden proberen we automatisch terug te keren in onze lobby.
  socket.on('connect', () => {
    if (code && playerId) {
      socket.emit('lobby:rejoin', { code, playerId }, () => {});
    }
  });

  function emit(event, data) {
    return new Promise((resolve) => {
      socket.emit(event, data, (resp) => resolve(resp || {}));
    });
  }

  window.Net = {
    async create(name, character) {
      const r = await emit('lobby:create', { name, character, deviceId });
      if (r.ok) {
        code = r.code;
        playerId = r.playerId;
      }
      return r;
    },
    async join(c, name, character) {
      const r = await emit('lobby:join', { code: c, name, character, deviceId });
      if (r.ok) {
        code = r.code;
        playerId = r.playerId;
      }
      return r;
    },
    start() {
      socket.emit('lobby:start');
    },
    next() {
      socket.emit('game:next');
    },
    force() {
      socket.emit('game:force');
    },
    leave() {
      socket.emit('lobby:leave');
      code = null;
      playerId = null;
    },
    restart() {
      socket.emit('game:restart');
    },
    action(payload) {
      socket.emit('mg:event', payload);
    },
    me() {
      return playerId;
    },
    setHandlers(h) {
      if (h.onState) onState = h.onState;
      if (h.onError) onError = h.onError;
      if (h.onAborted) onAborted = h.onAborted;
    },
  };
})();
