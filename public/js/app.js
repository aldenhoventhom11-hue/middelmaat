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
  let introDemoStop = null; // stopt de lopende intro-demo-animatie
  let currentMusic = null;
  let revealTimers = [];
  let selectedRounds = 5;
  function setMusic(name) {
    if (currentMusic === name) return;
    currentMusic = name;
    if (name) Sound.startMusic(name);
    else Sound.stopMusic();
  }
  function clearRevealTimers() {
    revealTimers.forEach(clearTimeout);
    revealTimers = [];
  }

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
    wrap.appendChild(optRow('Man / Vrouw', 'gender', Char.GENDERS));
    wrap.appendChild(swatchRow('Huidskleur', 'skin', Char.SKINS));
    wrap.appendChild(optRow('Haarstijl', 'hair', Char.HAIR_STYLES));
    wrap.appendChild(swatchRow('Haarkleur', 'hairColor', Char.HAIR_COLORS, true));
    wrap.appendChild(sliderRow('Lengte', 'height', '🧍 klein', '🦒 lang'));
    wrap.appendChild(sliderRow('Postuur', 'build', '🪶 dun', '🧸 stevig'));
    wrap.appendChild(optRow('Gezicht', 'face', Char.FACES));
    wrap.appendChild(optRow('Bril', 'glasses', Char.GLASSES));
    wrap.appendChild(optRow('Baard', 'beard', Char.BEARDS));
    wrap.appendChild(optRow('Hoofd', 'hat', Char.ACC_HATS));
    wrap.appendChild(swatchRow('Shirt', 'top', Char.COLORS));
    wrap.appendChild(optRow('Kleding', 'outfit', Char.OUTFITS));
    wrap.appendChild(swatchRow('Broek/rok-kleur', 'bottom', Char.PANTS));
  }
  function sliderRow(labelTxt, key, lo, hi) {
    const row = document.createElement('div');
    row.className = 'ctrl-row';
    row.appendChild(label(labelTxt));
    const wrap = document.createElement('div');
    wrap.className = 'slider-row';
    const loEl = document.createElement('span');
    loEl.className = 'slider-end';
    loEl.textContent = lo;
    const hiEl = document.createElement('span');
    hiEl.className = 'slider-end';
    hiEl.textContent = hi;
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '0';
    range.max = '100';
    range.value = String(Math.round((typeof character[key] === 'number' ? character[key] : 0.5) * 100));
    range.className = 'slider';
    range.addEventListener('input', () => {
      character[key] = Number(range.value) / 100;
      drawPreview();
    });
    range.addEventListener('change', () => Sound.play('button'));
    wrap.appendChild(loEl);
    wrap.appendChild(range);
    wrap.appendChild(hiEl);
    row.appendChild(wrap);
    return row;
  }
  function label(txt) {
    const l = document.createElement('div');
    l.className = 'ctrl-label';
    l.textContent = txt;
    return l;
  }
  function optRow(labelTxt, key, list) {
    const row = document.createElement('div');
    row.className = 'ctrl-row';
    row.appendChild(label(labelTxt));
    const wrap = document.createElement('div');
    wrap.className = 'opt-list';
    list.forEach((val) => {
      const o = document.createElement('button');
      o.className = 'opt' + (character[key] === val ? ' selected' : '');
      o.textContent = val;
      o.onclick = () => {
        character[key] = val;
        Sound.play('button');
        buildCreatorControls();
        drawPreview();
      };
      wrap.appendChild(o);
    });
    row.appendChild(wrap);
    return row;
  }
  function swatchRow(labelTxt, key, colors, ring) {
    const row = document.createElement('div');
    row.className = 'ctrl-row';
    row.appendChild(label(labelTxt));
    const wrap = document.createElement('div');
    wrap.className = 'opt-list';
    colors.forEach((col) => {
      const s = document.createElement('div');
      s.className = 'swatch' + (character[key] === col ? ' selected' : '');
      s.style.background = col;
      s.onclick = () => {
        character[key] = col;
        Sound.play('button');
        buildCreatorControls();
        drawPreview();
      };
      wrap.appendChild(s);
    });
    row.appendChild(wrap);
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

    // Muziek: alleen in lobby & podium.
    setMusic(phase === 'lobby' ? 'lobby' : phase === 'podium' ? 'podium' : null);
    // Onthulling-timers opruimen zodra we de onthulling verlaten.
    if (phase !== 'reveal') clearRevealTimers();
    // Intro-demo stoppen zodra we de intro verlaten.
    if (phase !== 'intro' && introDemoStop) {
      introDemoStop();
      introDemoStop = null;
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
    wheelSpunRound = -1;
    wheelSpinning = false;
    $('lobby-code').textContent = state.code;
    const grid = $('lobby-players');
    grid.innerHTML = '';
    state.players.forEach((p) => grid.appendChild(playerCard(p, state.you.id)));
    $('copy-code').onclick = () => {
      navigator.clipboard && navigator.clipboard.writeText(state.code);
      toast('Code gekopieerd: ' + state.code);
    };
    renderChat(state);
    const ctrl = $('lobby-controls');
    ctrl.innerHTML = '';
    const count = state.players.filter((p) => !p.waiting).length;
    if (isHost) {
      // Rondes-keuze (3 / 5 / 7).
      const rr = document.createElement('div');
      rr.className = 'rounds-row';
      rr.appendChild(h('span', 'rounds-label', 'Rondes:'));
      [3, 5, 7].forEach((n) => {
        const o = document.createElement('button');
        o.className = 'opt' + (selectedRounds === n ? ' selected' : '');
        o.textContent = n;
        o.onclick = () => {
          selectedRounds = n;
          Sound.play('button');
          renderLobby(state, isHost);
        };
        rr.appendChild(o);
      });
      ctrl.appendChild(rr);
      const btn = document.createElement('button');
      btn.className = 'btn primary big full';
      btn.textContent = count < 3 ? 'Wacht op spelers (' + count + '/3)' : 'Start het spel! (' + count + ')';
      btn.disabled = count < 3;
      btn.onclick = () => {
        Sound.play('start');
        Net.start(selectedRounds);
      };
      ctrl.appendChild(btn);
    } else {
      ctrl.appendChild(waitNote('Wachten tot de host start…'));
    }
    const back = document.createElement('button');
    back.className = 'btn full';
    back.textContent = '← Terug';
    back.onclick = () => {
      Sound.play('button');
      Net.leave();
      showScreen('home');
    };
    ctrl.appendChild(back);
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

  function renderChat(state) {
    const box = $('chat-messages');
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.innerHTML = '';
    (state.chat || []).forEach((m) => {
      const row = document.createElement('div');
      row.className = 'chat-msg' + (m.id === state.you.id ? ' me' : '');
      row.innerHTML = '<b></b><span></span>';
      row.querySelector('b').textContent = m.name + ': ';
      row.querySelector('span').textContent = m.text;
      box.appendChild(row);
    });
    if (atBottom) box.scrollTop = box.scrollHeight;
  }
  function sendChat() {
    const inp = $('chat-input');
    const t = inp.value.trim();
    if (!t) return;
    Net.chat(t);
    inp.value = '';
  }
  $('chat-send').onclick = sendChat;
  $('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat();
  });

  // ---- Intro (rad draait, daarna de uitleg-kaart) ----
  let wheelSpunRound = -1;
  let wheelSpinning = false;
  let lastIntroState = null;
  let lastIntroHost = false;
  const WHEEL_COLORS = ['#ff6b6b', '#ffd23f', '#4ecdc4', '#5b8cff', '#c77dff', '#ff8fab', '#8ac926', '#ff9f1c'];

  // Toon altijd betrouwbaar de uitleg-kaart (einde van het rad). Idempotent.
  function showIntroMain() {
    wheelSpinning = false;
    $('intro-wheel').classList.add('hidden');
    $('intro-main').classList.remove('hidden');
    if (lastIntroState) fillIntro(lastIntroState, lastIntroHost);
  }
  // Veiligheidsnet: als je terugkomt in de app terwijl het rad nog 'draait'
  // (mobiele browsers bevriezen timers/animaties op de achtergrond), maak het
  // rad dan meteen af zodat niemand vastzit.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && wheelSpinning) showIntroMain();
  });

  function renderIntro(state, isHost) {
    showScreen('intro');
    lastIntroState = state;
    lastIntroHost = isHost;
    const g = state.currentGame || {};
    const tb = g.tiebreak;
    const wheel = state.wheel;

    // Rad alleen bij een gewone ronde (niet bij tiebreak) en één keer per ronde.
    if (!tb && wheel && wheel.round !== wheelSpunRound) {
      spinWheel(state, isHost);
      return;
    }
    // Re-render tijdens het draaien: de finisher regelt het einde.
    if (wheelSpinning) return;
    $('intro-wheel').classList.add('hidden');
    $('intro-main').classList.remove('hidden');
    fillIntro(state, isHost);
  }

  function fillIntro(state, isHost) {
    const g = state.currentGame || {};
    const tb = g.tiebreak;
    $('intro-round').textContent = tb
      ? '⚔️ Tiebreak'
      : 'Ronde ' + (state.roundIndex + 1) + '/' + state.totalRounds;
    $('intro-title').textContent = (g.emoji ? g.emoji + ' ' : '') + (g.title || '');
    $('intro-theme').textContent = tb
      ? 'Gelijkspel! ' + ((state.mg && state.mg.leaderNames) || []).join(' & ') + ' strijden om de winst.'
      : g.theme || '';
    $('intro-rules').textContent = g.rules || '';
    // Auto-demo van de minigame.
    if (introDemoStop) {
      introDemoStop();
      introDemoStop = null;
    }
    const demoBox = $('intro-demo');
    demoBox.innerHTML = '';
    const mod = !tb && g.id ? MG[g.id] : null;
    if (mod && mod.demo) {
      try {
        introDemoStop = mod.demo(demoBox);
      } catch (e) {}
    }
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

  function spinWheel(state, isHost) {
    const wheel = state.wheel;
    wheelSpinning = true;
    wheelSpunRound = wheel.round;
    $('intro-main').classList.add('hidden');
    $('intro-wheel').classList.remove('hidden');
    $('wheel-result').textContent = '';

    const disc = $('wheel-disc');
    disc.className = 'wheel';
    disc.style.transform = 'rotate(0deg)';
    disc.innerHTML = '';

    const opts = wheel.options;
    const n = opts.length;
    const seg = 360 / n;
    // Gekleurde taart-achtergrond via conic-gradient.
    const stops = opts
      .map((o, i) => WHEEL_COLORS[i % WHEEL_COLORS.length] + ' ' + (i * seg) + 'deg ' + ((i + 1) * seg) + 'deg')
      .join(', ');
    disc.style.background = 'conic-gradient(' + stops + ')';
    // Emoji-labels rond het rad.
    const R = Math.min(window.innerWidth * 0.86, 340) * 0.36;
    opts.forEach((o, i) => {
      const ang = (i + 0.5) * seg;
      const span = document.createElement('span');
      span.className = 'wheel-seg';
      // Radiaal geplaatst; de gekozen emoji eindigt zo precies rechtop onder de pointer.
      span.style.cssText =
        'width:auto;height:auto;left:50%;top:50%;clip-path:none;padding:0;' +
        'transform:translate(-50%,-50%) rotate(' + ang + 'deg) translateY(-' + R + 'px);';
      span.textContent = o.emoji;
      disc.appendChild(span);
      // Scheidingslijn aan het begin van elk segment.
      const line = document.createElement('span');
      line.style.cssText =
        'position:absolute;left:50%;top:50%;width:3px;height:50%;background:rgba(255,255,255,0.8);' +
        'transform-origin:top center;transform:translateX(-50%) rotate(' + (i * seg + 180) + 'deg);';
      disc.appendChild(line);
    });

    const selIndex = Math.max(0, opts.findIndex((o) => o.id === wheel.selectedId));
    const selCenter = (selIndex + 0.5) * seg;
    const finalRot = 360 * 5 - selCenter; // 5 volle slagen, dan uitlijnen op de pointer
    disc.style.setProperty('--spin-to', finalRot + 'deg');

    // Trigger de animatie.
    void disc.offsetWidth;
    disc.classList.add('spinning');
    Sound.play('tick');
    const ticker = setInterval(() => Sound.play('tick'), 350);

    // Idempotente afronding: vuurt op animationend, met fallback-timers als
    // backup (mobiele throttling). Daarna verschijnt de uitleg-kaart altijd.
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(ticker);
      clearTimeout(fallback);
      clearTimeout(hardStop);
      disc.removeEventListener('animationend', finish);
      const sel = opts[selIndex];
      $('wheel-result').textContent = sel.emoji + ' ' + sel.title + '!';
      Sound.play('reveal');
      setTimeout(showIntroMain, 800);
    };
    disc.addEventListener('animationend', finish, { once: true });
    const fallback = setTimeout(finish, 4800); // als animationend niet vuurt
    const hardStop = setTimeout(showIntroMain, 7000); // absolute noodrem
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

    // Host kan de ronde altijd vroegtijdig afronden.
    const hc = $('play-host-controls');
    if (isHost) {
      if (!hc.dataset.built) {
        hc.innerHTML = '';
        const b = document.createElement('button');
        b.className = 'btn full';
        b.style.opacity = '0.92';
        b.textContent = '⏭ Ronde nu afronden';
        b.onclick = () => {
          Sound.play('button');
          Net.force();
        };
        hc.appendChild(b);
        hc.dataset.built = '1';
      }
    } else {
      hc.innerHTML = '';
      delete hc.dataset.built;
    }
  }

  // ---- Onthulling ----
  function renderReveal(state, isHost) {
    showScreen('reveal');
    clearRevealTimers();
    const rev = state.reveal;
    lastReveal = rev;
    const body = $('reveal-body');
    body.innerHTML = '';

    if (rev.tiebreak) {
      Sound.play('reveal');
      $('reveal-title').textContent = '⚔️ Tiebreak: ' + rev.gameTitle;
      rev.ranking.forEach((r) => body.appendChild(resultRow(r, r.winner, false, r.winner ? '👑' : '')));
    } else {
      $('reveal-title').textContent = rev.gameTitle;
      // Speciale visual (bv. ballon-knal, banen, cirkels) als context vooraf.
      const mod = MG[rev.gameId];
      if (mod && mod.revealVisual) {
        try {
          const v = mod.revealVisual(rev);
          if (v) body.appendChild(v);
        } catch (e) {}
      }
      const maxScore = Math.max.apply(null, rev.ranking.map((r) => r.roundScore));
      const list = document.createElement('div');
      body.appendChild(list);
      // Spanning: onthul van de slechtste naar de beste, één voor één.
      const order = [...rev.ranking].sort((a, b) => a.roundScore - b.roundScore);
      let i = 0;
      const revealNext = () => {
        if (i >= order.length) {
          if (maxScore > 0) body.appendChild(winnerSpotlight(rev.ranking[0]));
          body.appendChild(standingsBlock(rev.standings));
          return;
        }
        const r = order[i];
        i++;
        const winner = r.roundScore === maxScore && maxScore > 0;
        const loser = r.roundScore === 0;
        list.appendChild(resultRow(r, winner, loser, winner ? '🥇' : '', true));
        Sound.play(i >= order.length && winner ? 'win' : 'tick');
        revealTimers.push(setTimeout(revealNext, budget(order.length)));
      };
      revealNext();
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
  // Onthul-tempo: sneller bij veel spelers zodat het niet te lang duurt.
  function budget(n) {
    return n > 8 ? 320 : n > 5 ? 480 : 650;
  }

  const WIN_LINES = [
    '🌟 Lekker gemiddeld! 🌟',
    '🏅 Precies de middelmaat!',
    '✨ Goud voor het midden!',
    '👑 Heerlijk doorsnee!',
  ];
  function winnerSpotlight(row) {
    const box = document.createElement('div');
    box.className = 'winner-spotlight';
    const banner = document.createElement('div');
    banner.className = 'wbanner';
    banner.textContent = WIN_LINES[Math.floor(Math.random() * WIN_LINES.length)];
    box.appendChild(banner);
    box.appendChild(Char.el(row.character || {}, '', { pose: 'cheer' }));
    const name = document.createElement('div');
    name.className = 'wname';
    name.textContent = row.name + ' wint deze ronde!';
    box.appendChild(name);
    // Sparkles
    const spots = [
      [12, 30],
      [85, 24],
      [22, 70],
      [78, 66],
      [50, 14],
      [60, 84],
    ];
    spots.forEach((p, i) => {
      const s = document.createElement('span');
      s.className = 'spark';
      s.textContent = i % 2 ? '✨' : '⭐';
      s.style.left = p[0] + '%';
      s.style.top = p[1] + '%';
      s.style.animationDelay = (i * 0.18).toFixed(2) + 's';
      box.appendChild(s);
    });
    Sound.play('win');
    return box;
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
      row.appendChild(h('span', 'rp', String(Math.round(r.total))));
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
      const isWin = cls[i] === 'p1';
      const isLoser = p.id === pod.loserId && r.length > 1;
      const spot = document.createElement('div');
      spot.className = 'podium-spot ' + cls[i] + (isWin ? ' winner' : '') + (isLoser ? ' loser-fig' : '');
      if (isWin) spot.appendChild(h('div', 'crown', '👑'));
      if (isLoser) spot.appendChild(h('div', 'raincloud', '🌧️'));
      spot.appendChild(Char.el(p.character, '', { pose: isWin ? 'cheer' : 'stand' }));
      spot.appendChild(h('div', 'pn', p.name));
      const stand = document.createElement('div');
      stand.className = 'stand';
      stand.textContent = cls[i] === 'p1' ? '1' : cls[i] === 'p2' ? '2' : '3';
      spot.appendChild(stand);
      spot.appendChild(h('div', 'pt', Math.round(p.total) + ' pt'));
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
        const isLoser = p.id === pod.loserId;
        row.className = 'result-row' + (isLoser ? ' loser' : '');
        row.appendChild(h('span', 'medal', isLoser ? '🐌' : i + 4 + '.'));
        row.appendChild(Char.el(p.character));
        row.appendChild(h('span', 'rn', p.name));
        row.appendChild(h('span', 'rp', Math.round(p.total) + ''));
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
        row.appendChild(h('span', 'rp', Math.round(r.total) + ''));
        list.appendChild(row);
      });
    }
    $('standings-overlay').classList.remove('hidden');
  };
  $('standings-close').onclick = () => $('standings-overlay').classList.add('hidden');

  // Start
  showScreen('home');
})();
