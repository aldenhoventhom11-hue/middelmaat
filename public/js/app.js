/* Hoofd-app: schermrouting op basis van de server-state, character-creator,
   lobby en alle fase-overgangen. De server is leidend; deze laag toont alleen. */
(function () {
  const $ = (id) => document.getElementById(id);
  const screens = {
    home: $('screen-home'),
    creator: $('screen-creator'),
    lobby: $('screen-lobby'),
    intro: $('screen-intro'),
    play: $('screen-play'),
    reveal: $('screen-reveal'),
    podium: $('screen-podium'),
  };

  let mode = 'create'; // create | join
  let character = Char.randomSpec();
  let lastPhase = null;
  let curMgKind = null;
  let curMg = null;
  let podiumDone = false;
  let lastReveal = null;

  // ---- UI-helpers ----
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
  }
  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
  }
  window.AppToast = toast;

  function fmtScore(n) {
    const r = Math.round(n * 10) / 10;
    return Number.isInteger(r) ? '+' + r : '+' + r.toFixed(1);
  }

  // ---- Geluid ontgrendelen + mute ----
  document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });
  $('mute-btn').onclick = () => {
    const m = Sound.toggleMute();
    $('mute-btn').textContent = m ? '🔇' : '🔊';
  };

  // ---- Home ----
  document.querySelectorAll('[data-go]').forEach((b) => {
    b.addEventListener('click', () => {
      Sound.play('button');
      const dest = b.getAttribute('data-go');
      if (dest === 'home') return showScreen('home');
      if (dest === 'create' || dest === 'join') openCreator(dest);
    });
  });

  // ---- Character creator ----
  function openCreator(m) {
    mode = m;
    $('creator-title').textContent = m === 'create' ? 'Ontwerp jezelf' : 'Ontwerp jezelf & join';
    $('join-code-row').classList.toggle('hidden', m !== 'join');
    $('creator-confirm').textContent = m === 'create' ? 'Lobby maken' : 'Meedoen';
    buildCreatorControls();
    drawPreview();
    showScreen('creator');
  }

  function drawPreview() {
    $('char-preview').innerHTML = Char.render(character);
  }

  function buildCreatorControls() {
    const wrap = $('creator-controls');
    wrap.innerHTML = '';
    const fields = [
      { key: 'shape', label: 'Vorm', list: Char.SHAPES },
      { key: 'eyes', label: 'Ogen', list: Char.EYES },
      { key: 'mouth', label: 'Mond', list: Char.MOUTHS },
      { key: 'hat', label: 'Hoedje', list: Char.HATS },
    ];
    // Kleur
    wrap.appendChild(colorRow());
    // Overige opties
    fields.forEach((field) => {
      const key = field.key;
      const row = document.createElement('div');
      row.className = 'ctrl-row';
      row.appendChild(label(field.label));
      const list = document.createElement('div');
      list.className = 'opt-list';
      field.list.forEach((val) => {
        const o = document.createElement('button');
        o.className = 'opt' + (character[key] === val ? ' selected' : '');
        o.textContent = val;
        o.onclick = () => {
          character[key] = val;
          Sound.play('button');
          buildCreatorControls();
          drawPreview();
        };
        list.appendChild(o);
      });
      row.appendChild(list);
      wrap.appendChild(row);
    });
  }
  function label(txt) {
    const l = document.createElement('div');
    l.className = 'ctrl-label';
    l.textContent = txt;
    return l;
  }
  function colorRow() {
    const row = document.createElement('div');
    row.className = 'ctrl-row';
    row.appendChild(label('Kleur'));
    const list = document.createElement('div');
    list.className = 'opt-list';
    Char.COLORS.forEach((col) => {
      const s = document.createElement('div');
      s.className = 'swatch' + (character.color === col ? ' selected' : '');
      s.style.background = col;
      s.onclick = () => {
        character.color = col;
        Sound.play('button');
        buildCreatorControls();
        drawPreview();
      };
      list.appendChild(s);
    });
    row.appendChild(list);
    return row;
  }

  $('creator-confirm').onclick = async () => {
    const name = $('name-input').value.trim() || 'Speler';
    Sound.play('start');
    let resp;
    if (mode === 'create') {
      resp = await Net.create(name, character);
    } else {
      const code = $('code-input').value.trim().toUpperCase();
      if (code.length < 4) return toast('Vul een geldige code in');
      resp = await Net.join(code, name, character);
    }
    if (!resp.ok) {
      Sound.play('error');
      return toast(resp.message || 'Er ging iets mis');
    }
    Sound.play('join');
  };

  // ---- Render op basis van server-state ----
  Net.setHandlers({
    onState: render,
    onError: (m) => {
      Sound.play('error');
      toast(m || 'Fout');
    },
    onAborted: (m) => {
      toast(m || 'Spel gestopt');
    },
  });

  function render(state) {
    const phase = state.phase;
    const isHost = state.you && state.you.isHost;

    // Bovenbalk
    const inGame = ['intro', 'playing', 'reveal', 'podium'].includes(phase);
    $('topbar').classList.toggle('hidden', !inGame);
    $('standings-btn').classList.toggle('hidden', !inGame);
    if (inGame && phase !== 'podium') {
      const tb = state.currentGame && state.currentGame.tiebreak;
      $('round-pill').textContent = tb
        ? '⚔️ Tiebreak'
        : 'Ronde ' + (state.roundIndex + 1) + '/' + state.totalRounds;
    } else if (phase === 'podium') {
      $('round-pill').textContent = '🏁 Klaar';
    }

    // Minigame loskoppelen als we niet (meer) spelen
    if (phase !== 'playing' && curMg) {
      if (curMg.unmount) curMg.unmount();
      curMg = null;
      curMgKind = null;
    }
    if (phase !== 'podium') podiumDone = false;

    if (phase === 'lobby') renderLobby(state, isHost);
    else if (phase === 'intro') renderIntro(state, isHost);
    else if (phase === 'playing') renderPlay(state, isHost);
    else if (phase === 'reveal') renderReveal(state, isHost);
    else if (phase === 'podium') renderPodium(state, isHost);

    lastPhase = phase;
  }

  // ---- Lobby ----
  function renderLobby(state, isHost) {
    showScreen('lobby');
    $('lobby-code').textContent = state.code;
    const grid = $('lobby-players');
    grid.innerHTML = '';
    state.players.forEach((p) => grid.appendChild(playerCard(p, state.you.id)));
    $('copy-code').onclick = () => {
      navigator.clipboard && navigator.clipboard.writeText(state.code);
      toast('Code gekopieerd: ' + state.code);
    };
    const ctrl = $('lobby-controls');
    ctrl.innerHTML = '';
    const count = state.players.filter((p) => !p.waiting).length;
    if (isHost) {
      const btn = document.createElement('button');
      btn.className = 'btn primary big full';
      btn.textContent = count < 3 ? 'Wacht op spelers (' + count + '/3)' : 'Start het spel! (' + count + ')';
      btn.disabled = count < 3;
      btn.onclick = () => {
        Sound.play('start');
        Net.start();
      };
      ctrl.appendChild(btn);
    } else {
      ctrl.appendChild(waitNote('Wachten tot de host start…'));
    }
  }

  function playerCard(p, youId) {
    const card = document.createElement('div');
    card.className = 'player-card' + (p.id === youId ? ' you' : '') + (p.connected ? '' : ' off');
    card.appendChild(Char.el(p.character));
    const name = document.createElement('div');
    name.className = 'pname';
    name.textContent = p.name;
    card.appendChild(name);
    if (p.waiting) {
      const w = document.createElement('div');
      w.className = 'waiting-tag';
      w.textContent = 'volgende ronde';
      card.appendChild(w);
    }
    return card;
  }

  function waitNote(txt) {
    const n = document.createElement('div');
    n.className = 'wait-note';
    n.textContent = txt;
    return n;
  }

  // ---- Intro ----
  function renderIntro(state, isHost) {
    showScreen('intro');
    const g = state.currentGame || {};
    const tb = g.tiebreak;
    $('intro-round').textContent = tb ? '⚔️ Tiebreak' : 'Ronde ' + (state.roundIndex + 1) + '/' + state.totalRounds;
    $('intro-title').textContent = g.title || '';
    $('intro-theme').textContent = tb
      ? 'Gelijkspel! ' + ((state.mg && state.mg.leaderNames) || []).join(' & ') + ' strijden om de winst.'
      : g.theme || '';
    $('intro-rules').textContent = g.rules || '';
    const ctrl = $('intro-controls');
    ctrl.innerHTML = '';
    if (isHost) {
      const b = document.createElement('button');
      b.className = 'btn primary big full';
      b.textContent = 'Start ronde ▶';
      b.onclick = () => {
        Sound.play('start');
        Net.next();
      };
      ctrl.appendChild(b);
    } else {
      ctrl.appendChild(waitNote('Wachten tot de host de ronde start…'));
    }
  }

  // ---- Spelen ----
  function renderPlay(state, isHost) {
    showScreen('play');
    const mg = state.mg;
    if (!mg || !mg.kind) return;
    const kind = mg.kind;
    if (kind !== curMgKind) {
      if (curMg && curMg.unmount) curMg.unmount();
      const root = $('mg-root');
      root.innerHTML = '';
      curMg = MG[kind];
      curMgKind = kind;
      if (curMg) {
        curMg.mount(root, {
          send: (p) => Net.action(p),
          me: state.you.id,
          players: state.players,
          isHost,
        });
        if (kind === 'berenrace' || kind === 'doolhof') Sound.play('start');
      } else {
        root.innerHTML = '<div class="mg-instruct">Onbekende minigame.</div>';
      }
    }
    if (curMg && curMg.update) curMg.update(mg);
  }

  // ---- Onthulling ----
  function renderReveal(state, isHost) {
    showScreen('reveal');
    const rev = state.reveal;
    lastReveal = rev;
    Sound.play('reveal');
    const body = $('reveal-body');
    body.innerHTML = '';

    if (rev.tiebreak) {
      $('reveal-title').textContent = '⚔️ Tiebreak: ' + rev.gameTitle;
      rev.ranking.forEach((r) => body.appendChild(resultRow(r, r.winner, false, r.winner ? '👑' : '')));
    } else {
      $('reveal-title').textContent = rev.gameTitle;
      // Speciale visual
      const mod = MG[rev.gameId];
      if (mod && mod.revealVisual) {
        try {
          const v = mod.revealVisual(rev);
          if (v) body.appendChild(v);
        } catch (e) {}
      }
      const maxScore = Math.max.apply(null, rev.ranking.map((r) => r.roundScore));
      rev.ranking.forEach((r) => {
        const winner = r.roundScore === maxScore && maxScore > 0;
        const loser = r.roundScore === 0;
        const medal = winner ? '🥇' : '';
        body.appendChild(resultRow(r, winner, loser, medal, true));
      });
      // Tussenstand eronder
      body.appendChild(standingsBlock(rev.standings));
    }

    const ctrl = $('reveal-controls');
    ctrl.innerHTML = '';
    if (isHost) {
      const b = document.createElement('button');
      b.className = 'btn primary big full';
      const last = state.roundIndex + 1 >= state.totalRounds;
      b.textContent = rev.tiebreak ? 'Verder ▶' : last ? 'Naar het podium 🏆' : 'Volgende ronde ▶';
      b.onclick = () => {
        Sound.play('button');
        Net.next();
      };
      ctrl.appendChild(b);
    } else {
      ctrl.appendChild(waitNote('Wachten op de host…'));
    }
  }

  function resultRow(r, winner, loser, medal, showScore) {
    const row = document.createElement('div');
    row.className = 'result-row' + (winner ? ' winner' : '') + (loser ? ' loser' : '');
    if (medal) {
      const m = document.createElement('span');
      m.className = 'medal';
      m.textContent = medal;
      row.appendChild(m);
    }
    row.appendChild(Char.el(r.character || {}));
    const name = document.createElement('span');
    name.className = 'rn';
    name.textContent = r.name;
    row.appendChild(name);
    const val = document.createElement('span');
    val.className = 'rv';
    val.textContent = r.disconnected ? '⚡ weg' : r.display || '';
    row.appendChild(val);
    if (showScore) {
      const p = document.createElement('span');
      p.className = 'rp';
      p.textContent = fmtScore(r.roundScore);
      row.appendChild(p);
    }
    return row;
  }

  function standingsBlock(standings) {
    const wrap = document.createElement('div');
    wrap.appendChild(h('div', 'reveal-meta', '— Tussenstand —'));
    standings.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'result-row';
      row.appendChild(h('span', 'medal', i === 0 ? '👑' : i + 1 + '.'));
      row.appendChild(Char.el(r.character || {}));
      row.appendChild(h('span', 'rn', r.name));
      row.appendChild(h('span', 'rp', String(Math.round(r.total * 10) / 10)));
      wrap.appendChild(row);
    });
    return wrap;
  }
  function h(tag, cls, txt) {
    const e = document.createElement(tag);
    e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  // ---- Podium ----
  function renderPodium(state, isHost) {
    showScreen('podium');
    const pod = state.podium;
    const body = $('podium-body');
    body.innerHTML = '';
    const r = pod.ranking;

    if (!podiumDone) {
      podiumDone = true;
      Sound.play('win');
      confetti();
    }

    // Top 3 op het podium
    const stage = document.createElement('div');
    stage.className = 'podium-stage';
    const order = [r[1], r[0], r[2]]; // 2e, 1e, 3e
    const cls = ['p2', 'p1', 'p3'];
    order.forEach((p, i) => {
      if (!p) return;
      const spot = document.createElement('div');
      spot.className = 'podium-spot ' + cls[i] + (cls[i] === 'p1' ? ' winner' : '');
      spot.appendChild(Char.el(p.character));
      spot.appendChild(h('div', 'pn', p.name));
      const stand = document.createElement('div');
      stand.className = 'stand';
      stand.textContent = cls[i] === 'p1' ? '1' : cls[i] === 'p2' ? '2' : '3';
      spot.appendChild(stand);
      spot.appendChild(h('div', 'pt', Math.round(p.total * 10) / 10 + ' pt'));
      stage.appendChild(spot);
    });
    body.appendChild(stage);
    body.appendChild(h('div', 'reveal-meta', '🥇 ' + r[0].name + ' is het meest gemiddeld — kampioen!'));

    // Rest
    if (r.length > 3) {
      const rest = document.createElement('div');
      rest.className = 'podium-rest';
      r.slice(3).forEach((p, i) => {
        const row = document.createElement('div');
        row.className = 'result-row';
        row.appendChild(h('span', 'medal', i + 4 + '.'));
        row.appendChild(Char.el(p.character));
        row.appendChild(h('span', 'rn', p.name));
        row.appendChild(h('span', 'rp', Math.round(p.total * 10) / 10 + ''));
        rest.appendChild(row);
      });
      body.appendChild(rest);
    }
    body.appendChild(h('div', 'loser-note', '🐌 ' + r[r.length - 1].name + ' was de grootste uitschieter…'));

    const ctrl = $('podium-controls');
    ctrl.innerHTML = '';
    if (isHost) {
      const b = document.createElement('button');
      b.className = 'btn primary big full';
      b.textContent = '🔁 Nieuw spel (zelfde lobby)';
      b.onclick = () => {
        Sound.play('start');
        Net.restart();
      };
      ctrl.appendChild(b);
    } else {
      ctrl.appendChild(waitNote('Wachten tot de host opnieuw start…'));
    }
  }

  function confetti() {
    const colors = ['#ffd23f', '#ff6b6b', '#4ecdc4', '#5b8cff', '#c77dff'];
    for (let i = 0; i < 60; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = 2 + Math.random() * 2 + 's';
      c.style.animationDelay = Math.random() * 0.5 + 's';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 4500);
    }
  }

  // ---- Tussenstand-overlay ----
  $('standings-btn').onclick = () => {
    const list = $('standings-list');
    list.innerHTML = '';
    const data = lastReveal && lastReveal.standings;
    if (!data) {
      list.appendChild(h('div', 'reveal-meta', 'Nog geen stand.'));
    } else {
      data.forEach((r, i) => {
        const row = document.createElement('div');
        row.className = 'result-row';
        row.appendChild(h('span', 'medal', i === 0 ? '👑' : i + 1 + '.'));
        row.appendChild(Char.el(r.character || {}));
        row.appendChild(h('span', 'rn', r.name));
        row.appendChild(h('span', 'rp', Math.round(r.total * 10) / 10 + ''));
        list.appendChild(row);
      });
    }
    $('standings-overlay').classList.remove('hidden');
  };
  $('standings-close').onclick = () => $('standings-overlay').classList.add('hidden');

  // Start
  showScreen('home');
})();
