/* Dunne wrapper rond Socket.io. Houdt het reconnect-token alleen in geheugen
   (geen localStorage), zoals de spec vraagt. */
(function () {
  const socket = io({ transports: ['websocket', 'polling'] });

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
      const r = await emit('lobby:create', { name, character });
      if (r.ok) {
        code = r.code;
        playerId = r.playerId;
      }
      return r;
    },
    async join(c, name, character) {
      const r = await emit('lobby:join', { code: c, name, character });
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
