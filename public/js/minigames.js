/* Client-side renderers voor de 10 minigames. Elk registreert zich in MG[kind]
   met mount/update/unmount. Optioneel een revealVisual() voor de onthulling.
   De server blijft autoritair: de client toont en stuurt alleen input. */
(function () {
  const MG = {};

  // ---- DOM-helpers ----
  function h(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }
  function countdownView(count) {
    return h('div', 'countdown', String(count || ''));
  }

  // Timer-balk die naar een deadline toeloopt (rAF, leest live state).
  function makeTimerBar(getState, duration) {
    const wrap = h('div', 'timer-bar');
    const fill = h('i');
    wrap.appendChild(fill);
    let raf;
    function loop() {
      const st = getState();
      if (st && st.deadline) {
        const remain = Math.max(0, st.deadline - Date.now());
        fill.style.width = Math.min(100, (remain / duration) * 100) + '%';
      }
      raf = requestAnimationFrame(loop);
    }
    loop();
    wrap.stop = () => cancelAnimationFrame(raf);
    return wrap;
  }

  function submittedTag(text) {
    return h('div', 'submitted-tag', text || '✅ Ingeleverd! Wachten op de rest…');
  }

  // Eigen personage-spec uit de context halen.
  function myChar(ctx) {
    const p = (ctx.players || []).find((pp) => pp.id === ctx.me);
    return p ? p.character : {};
  }
  function charEl(spec, pose, cls) {
    return window.Char.el(spec, cls || '', { pose: pose || 'stand' });
  }

  // =========================================================
  // Gedeelde basis voor "geheim getal kiezen" (ballon, pizza, gemiddeld)
  // =========================================================
  function numberGame(cfg) {
    const st = {};
    return {
      mount(root, ctx) {
        st.ctx = ctx;
        st.state = null;
        st.value = cfg.start;
        st.submitted = false;
        clear(root);
        st.title = h('div', 'mg-title', cfg.emoji + ' ' + cfg.title);
        st.instruct = h('div', 'mg-instruct', cfg.instruction);
        st.timer = makeTimerBar(() => st.state, 30000);
        st.body = h('div');
        root.appendChild(st.title);
        root.appendChild(st.instruct);
        root.appendChild(st.timer);
        root.appendChild(st.body);
        this._build();
      },
      _build() {
        clear(st.body);
        st.visBox = h('div');
        st.visBox.style.cssText = 'min-height:90px;display:flex;align-items:flex-end;justify-content:center;';
        st.body.appendChild(st.visBox);
        const refreshVis = () => {
          if (!cfg.visual) return;
          st.visBox.innerHTML = '';
          st.visBox.appendChild(cfg.visual(st.value, cfg));
        };
        refreshVis();
        const stepper = h('div', 'stepper');
        const minus = h('button', null, '−');
        const val = h('div', 'value', String(st.value));
        const plus = h('button', null, '+');
        const min = cfg.min,
          max = cfg.max;
        minus.onclick = () => {
          st.value = Math.max(min, st.value - 1);
          val.textContent = st.value;
          refreshVis();
          Sound.play('button');
        };
        plus.onclick = () => {
          st.value = Math.min(max, st.value + 1);
          val.textContent = st.value;
          refreshVis();
          Sound.play('button');
        };
        stepper.appendChild(minus);
        stepper.appendChild(val);
        stepper.appendChild(plus);
        st.body.appendChild(stepper);
        if (cfg.hint) st.body.appendChild(h('div', 'mg-instruct', cfg.hint));
        const submit = h('button', 'btn primary big full', 'Inleveren');
        submit.onclick = () => {
          st.submitted = true;
          st.ctx.send({ type: 'submit', value: st.value });
          Sound.play('start');
          this._submittedView();
        };
        st.body.appendChild(submit);
      },
      _submittedView() {
        clear(st.body);
        st.body.appendChild(submittedTag('✅ Je koos ' + st.value + '. Wachten op de rest…'));
        st.body.appendChild(st.statusEl || (st.statusEl = h('div', 'waiting-others')));
      },
      update(state) {
        st.state = state;
        if (st.submitted && st.statusEl) {
          st.statusEl.textContent =
            (state.submitted ? state.submitted.length : 0) + ' / ' + state.total + ' ingeleverd';
        }
      },
      unmount() {
        if (st.timer) st.timer.stop();
      },
    };
  }

  // Groeiende ballon-SVG.
  function balloonSvg(value, max, color) {
    const t = value / max;
    const r = 16 + t * 30;
    const cy = 60 - r * 0.1;
    return (
      `<svg width="120" height="120" viewBox="0 0 120 120">` +
      `<line x1="60" y1="${cy + r}" x2="60" y2="112" stroke="#888" stroke-width="1.5"/>` +
      `<ellipse cx="60" cy="${cy}" rx="${r * 0.9}" ry="${r}" fill="${color}"/>` +
      `<ellipse cx="${60 - r * 0.3}" cy="${cy - r * 0.3}" rx="${r * 0.22}" ry="${r * 0.32}" fill="rgba(255,255,255,0.5)"/>` +
      `<path d="M56 ${cy + r} l4 5 4 -5 Z" fill="${color}"/>` +
      `</svg>`
    );
  }
  MG.ballon = numberGame({
    title: 'De Ballon',
    emoji: '🎈',
    instruction: 'Hoeveel pompslagen geef jij? Te veel = knal, te weinig = profiteur.',
    min: 1,
    max: 20,
    start: 10,
    visual(value, cfg) {
      const d = document.createElement('div');
      d.innerHTML = balloonSvg(value, cfg.max, '#ff5d5d');
      return d;
    },
  });
  // Pizza-SVG met geclaimde punten gemarkeerd.
  function pizzaSvg(value, max) {
    const cx = 50,
      cy = 50,
      r = 42;
    let s = `<svg width="110" height="110" viewBox="0 0 100 100"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#f0b429" stroke="#b9882f" stroke-width="3"/>`;
    for (let i = 0; i < max; i++) {
      const a0 = (i / max) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / max) * Math.PI * 2 - Math.PI / 2;
      const x0 = cx + r * Math.cos(a0),
        y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1),
        y1 = cy + r * Math.sin(a1);
      const fill = i < value ? '#e8590c' : 'transparent';
      s += `<path d="M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1} Z" fill="${fill}" fill-opacity="0.6" stroke="#b9882f" stroke-width="1"/>`;
    }
    // pepperoni
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      s += `<circle cx="${cx + 22 * Math.cos(a)}" cy="${cy + 22 * Math.sin(a)}" r="4" fill="#c0392b"/>`;
    }
    return s + '</svg>';
  }
  MG.pizzapunt = numberGame({
    title: 'De Pizzapunt',
    emoji: '🍕',
    instruction: 'Hoeveel stukken pizza claim je? Niet te hebberig, niet te bescheiden.',
    min: 0,
    max: 12,
    start: 6,
    visual(value, cfg) {
      const d = document.createElement('div');
      d.innerHTML = pizzaSvg(value, cfg.max);
      return d;
    },
  });
  MG.gemiddeldgetal = numberGame({
    title: 'Het Gemiddelde Getal',
    emoji: '🔢',
    instruction: 'Kies 0–100. Kom zo dicht mogelijk bij het groepsgemiddelde.',
    hint: 'De dichtste bij het gemiddelde wint!',
    min: 0,
    max: 100,
    start: 50,
    visual(value) {
      const d = document.createElement('div');
      d.style.cssText = 'width:100%;';
      d.innerHTML =
        '<div style="position:relative;height:36px;background:#fff;border-radius:12px;overflow:hidden;">' +
        '<div style="position:absolute;top:0;bottom:0;left:0;width:' + value + '%;background:linear-gradient(90deg,#4ecdc4,#5b8cff);"></div>' +
        '<div style="position:absolute;top:50%;left:' + value + '%;transform:translate(-50%,-50%);font-weight:900;color:#1f1147;">' + value + '</div>' +
        '</div>';
      return d;
    },
  });

  // De Lift — verdieping kiezen
  function liftSvg(value, max) {
    const W = 70,
      H = 120,
      shaftX = 22,
      shaftW = 30,
      top = 6,
      bot = H - 6;
    const t = (value - 1) / (max - 1);
    const carY = bot - 18 - t * (bot - top - 22);
    let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
    s += `<rect x="14" y="0" width="46" height="${H}" rx="6" fill="#cdd6e0" stroke="#9aa6b3" stroke-width="2"/>`;
    // verdiepingslijnen
    for (let i = 0; i < 6; i++) {
      const y = top + 4 + (i * (bot - top - 8)) / 5;
      s += `<line x1="16" y1="${y}" x2="58" y2="${y}" stroke="#b3bcc7" stroke-width="1"/>`;
    }
    // schacht
    s += `<rect x="${shaftX}" y="${top}" width="${shaftW}" height="${bot - top}" fill="#eef2f6" stroke="#9aa6b3" stroke-width="1.5"/>`;
    // liftcabine
    s += `<rect x="${shaftX + 2}" y="${carY}" width="${shaftW - 4}" height="18" rx="3" fill="#ffd23f" stroke="#b9882f" stroke-width="2"/>`;
    s += `<line x1="${shaftX + shaftW / 2}" y1="${carY}" x2="${shaftX + shaftW / 2}" y2="${carY + 18}" stroke="#b9882f" stroke-width="1"/>`;
    s += `<text x="${shaftX + shaftW / 2}" y="${carY + 13}" text-anchor="middle" font-size="10" font-weight="900" fill="#7a5a14">${value}</text>`;
    return s + '</svg>';
  }
  MG.lift = numberGame({
    title: 'De Lift',
    emoji: '🛗',
    instruction: 'Op welke verdieping stap je uit (1–20)? De gemiddelde verdieping wint.',
    min: 1,
    max: 20,
    start: 10,
    visual(value, cfg) {
      const d = document.createElement('div');
      d.innerHTML = liftSvg(value, cfg.max);
      return d;
    },
  });

  // =========================================================
  // Verdeel & Heers — strafpunten verdelen
  // =========================================================
  MG.verdeelheers = (function () {
    const st = {};
    return {
      mount(root, ctx) {
        st.ctx = ctx;
        st.state = null;
        st.submitted = false;
        st.alloc = {};
        clear(root);
        root.appendChild(h('div', 'mg-title', '😈 Verdeel & Heers'));
        root.appendChild(
          h('div', 'mg-instruct', 'Verdeel 5 strafpunten over de anderen. Niet aan jezelf!')
        );
        st.timer = makeTimerBar(() => st.state, 30000);
        root.appendChild(st.timer);
        st.body = h('div');
        root.appendChild(st.body);
      },
      _build(targets) {
        clear(st.body);
        st.remainEl = h('div', 'alloc-remain');
        st.body.appendChild(st.remainEl);
        targets.forEach((t) => {
          if (!(t.id in st.alloc)) st.alloc[t.id] = 0;
          const row = h('div', 'alloc-row');
          row.appendChild(Char.el(t.character));
          row.appendChild(h('span', 'an', t.name));
          const minus = h('button', null, '−');
          const val = h('span', 'av', String(st.alloc[t.id]));
          const plus = h('button', null, '+');
          minus.onclick = () => {
            if (st.alloc[t.id] > 0) {
              st.alloc[t.id]--;
              val.textContent = st.alloc[t.id];
              this._refresh();
              Sound.play('button');
            }
          };
          plus.onclick = () => {
            if (this._remaining() > 0) {
              st.alloc[t.id]++;
              val.textContent = st.alloc[t.id];
              this._refresh();
              Sound.play('button');
            }
          };
          row.appendChild(minus);
          row.appendChild(val);
          row.appendChild(plus);
          st.body.appendChild(row);
        });
        st.submit = h('button', 'btn primary big full', 'Inleveren');
        st.submit.onclick = () => {
          if (this._remaining() !== 0) return;
          st.submitted = true;
          st.ctx.send({ type: 'submit', value: st.alloc });
          Sound.play('start');
          clear(st.body);
          st.body.appendChild(submittedTag());
        };
        st.body.appendChild(st.submit);
        this._refresh();
      },
      _remaining() {
        const used = Object.values(st.alloc).reduce((a, b) => a + b, 0);
        return 5 - used;
      },
      _refresh() {
        const r = this._remaining();
        st.remainEl.textContent = 'Nog te verdelen: ' + r + ' / 5';
        st.submit.disabled = r !== 0;
      },
      update(state) {
        st.state = state;
        if (!st.built && state.targets) {
          // Toon alleen anderen (server stuurt alle actieve spelers).
          const targets = state.targets.filter((t) => t.id !== st.ctx.me);
          const enriched = targets.map((t) => {
            const p = st.ctx.players.find((pp) => pp.id === t.id);
            return { id: t.id, name: t.name, character: p ? p.character : {} };
          });
          st.built = true;
          this._build(enriched);
        }
      },
      unmount() {
        st.built = false;
        if (st.timer) st.timer.stop();
      },
    };
  })();

  // =========================================================
  // De Tikkampioen — 5 seconden tikken
  // =========================================================
  MG.tikkampioen = (function () {
    const st = {};
    return {
      mount(root, ctx) {
        st.ctx = ctx;
        st.state = null;
        st.local = 0;
        clear(root);
        root.appendChild(h('div', 'mg-title', '👆 De Tikkampioen'));
        st.info = h('div', 'mg-instruct', 'Tik 5 seconden — niet te veel, niet te weinig!');
        root.appendChild(st.info);
        st.timer = makeTimerBar(() => st.state, 5000);
        root.appendChild(st.timer);

        // Arcade-buzzer met LCD-teller.
        const buzzer = h('div', 'buzzer');
        buzzer.style.background = 'linear-gradient(#3b82f6,#1d4ed8)';
        st.lcd = h('div', 'lcd', '0');
        buzzer.appendChild(st.lcd);
        st.dome = h('div', 'dome');
        st.dome.style.marginTop = '14px';
        buzzer.appendChild(st.dome);
        st.counter = st.lcd;
        const tap = (e) => {
          e.preventDefault();
          if (st.disabled) return;
          st.local++;
          st.lcd.textContent = st.local;
          st.dome.style.transform = 'scale(0.92)';
          setTimeout(() => (st.dome.style.transform = ''), 60);
          st.ctx.send({ type: 'tap' });
          Sound.play('tap');
        };
        st.dome.addEventListener('pointerdown', tap);
        st.disabled = true;
        root.appendChild(buzzer);
      },
      update(state) {
        st.state = state;
        if (state.phase === 'countdown') {
          st.lcd.textContent = state.count;
          st.disabled = true;
          st.dome.style.filter = 'grayscale(0.6)';
        } else if (state.phase === 'tap') {
          st.disabled = false;
          st.dome.style.filter = '';
          // Toon de server-telling als die er is (autoritatief).
          const sv = state.counts && state.counts[st.ctx.me];
          if (typeof sv === 'number') st.lcd.textContent = Math.max(sv, st.local);
        }
      },
      unmount() {
        if (st.timer) st.timer.stop();
      },
    };
  })();

  // =========================================================
  // De Berenrace — verstop je op tijd
  // =========================================================
  MG.berenrace = (function () {
    const st = {};
    return {
      mount(root, ctx) {
        st.ctx = ctx;
        st.hidden = false;
        clear(root);
        root.appendChild(h('div', 'mg-title', '🐻 De Berenrace'));

        st.track = h('div', 'scene-track');
        st.track.appendChild(h('div', 'grass'));
        // Beer (achtervolger) links.
        st.bear = h('div', null, '🐻');
        st.bear.style.cssText = 'position:absolute;bottom:8px;left:2%;font-size:56px;transition:left .15s linear;z-index:2;';
        // Eigen personage rent rechts.
        st.runnerWrap = h('div', 'runner-fig');
        st.runnerWrap.style.right = '8%';
        st.runnerWrap.appendChild(charEl(myChar(ctx), 'run'));
        st.track.appendChild(st.bear);
        st.track.appendChild(st.runnerWrap);
        root.appendChild(st.track);

        st.time = h('div', 'mg-instruct', 'Klaar voor de start…');
        root.appendChild(st.time);
        st.btn = h('button', 'big-button', 'VERSTOP JE! 🌳');
        st.btn.onclick = () => {
          if (st.hidden) return;
          st.hidden = true;
          st.ctx.send({ type: 'hide' });
          st.runnerWrap.innerHTML = '<div style="font-size:64px">🌳</div>';
          st.btn.textContent = 'Verstopt! 🤫';
          st.btn.disabled = true;
          st.btn.classList.add('green');
          Sound.play('pop');
        };
        root.appendChild(st.btn);
      },
      update(state) {
        if (state.phase === 'countdown') {
          st.time.textContent = 'Klaar… ' + state.count;
          return;
        }
        const prog = state.bear || 0;
        st.bear.style.left = 2 + prog * 70 + '%';
        st.bear.style.fontSize = 56 + prog * 18 + 'px';
        st.time.textContent = ((state.elapsed || 0) / 1000).toFixed(1) + 's  🐻';
        if (prog > 0.8 && !st.hidden) {
          st.btn.style.background = '#b91c1c';
          Sound.play && (state.elapsed % 1000 < 120) && Sound.play('bear');
        }
      },
      unmount() {},
    };
  })();

  // =========================================================
  // Schermstaren — vinger vasthouden, op gevoel loslaten
  // =========================================================
  MG.schermstaren = (function () {
    const st = {};
    return {
      mount(root, ctx) {
        st.ctx = ctx;
        st.down = false;
        st.released = false;
        clear(root);
        root.appendChild(h('div', 'mg-title', '👁️ Schermstaren'));
        st.info = h('div', 'mg-instruct', 'Leg je vinger op het vlak hieronder.');
        root.appendChild(st.info);
        const charWrap = h('div');
        charWrap.style.cssText = 'text-align:center;height:90px;';
        const ce = charEl(myChar(ctx), 'stand');
        ce.querySelector('svg').style.height = '90px';
        charWrap.appendChild(ce);
        root.appendChild(charWrap);
        st.pad = h('div');
        st.pad.style.cssText =
          'height:34vh;border-radius:20px;background:radial-gradient(circle at 50% 40%,#4c1d95,#1e1b4b);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:24px;text-align:center;touch-action:none;box-shadow:inset 0 0 30px rgba(0,0,0,0.5);';
        st.pad.textContent = 'Houd vast';
        st.pad.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (st.down || st.released) return;
          st.down = true;
          st.ctx.send({ type: 'down' });
          st.pad.style.background = '#4c1d95';
          st.pad.textContent = 'Blijf vasthouden…';
          Sound.play('tick');
        });
        const release = (e) => {
          if (!st.down || st.released) return;
          if (st.phase !== 'hold') return; // pas loslaten als de meting loopt
          st.released = true;
          st.ctx.send({ type: 'up' });
          st.pad.style.background = '#16a34a';
          st.pad.textContent = 'Losgelaten! 😅';
          Sound.play('pop');
        };
        st.pad.addEventListener('pointerup', release);
        st.pad.addEventListener('pointercancel', release);
        st.pad.addEventListener('pointerleave', release);
        root.appendChild(st.pad);
      },
      update(state) {
        st.phase = state.phase;
        if (state.phase === 'wait') {
          st.info.textContent =
            'Wachten op iedereen… (' + (state.readyCount || 0) + '/' + state.total + ')';
        } else if (state.phase === 'hold' && !st.released) {
          st.info.textContent = 'Laat los op gevoel — niet als eerste, niet als laatste!';
          if (st.down) st.pad.textContent = 'NU loslaten op gevoel…';
        }
      },
      unmount() {},
    };
  })();

  // =========================================================
  // Het Doolhof Dilemma
  // =========================================================
  MG.doolhof = (function () {
    const st = {};
    function draw() {
      const { grid, w, h: gh } = st.maze;
      const cw = st.canvas.width / w;
      const ch = st.canvas.height / gh;
      const c = st.ctx2d;
      c.fillStyle = '#0f0a2e';
      c.fillRect(0, 0, st.canvas.width, st.canvas.height);
      c.fillStyle = '#ede9fe';
      for (let y = 0; y < gh; y++)
        for (let x = 0; x < w; x++)
          if (grid[y][x] === 0) c.fillRect(x * cw, y * ch, cw + 0.6, ch + 0.6);
      // uitgang
      c.fillStyle = '#22c55e';
      c.fillRect(st.maze.exit[0] * cw, st.maze.exit[1] * ch, cw, ch);
      // speler
      c.font = Math.min(cw, ch) + 'px serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('🙂', (st.px + 0.5) * cw, (st.py + 0.5) * ch);
    }
    function move(dx, dy) {
      if (st.done) return;
      const g = st.maze.grid;
      const nx = st.px + dx,
        ny = st.py + dy;
      if (ny < 0 || ny >= st.maze.h || nx < 0 || nx >= st.maze.w) return;
      if (g[ny][nx] === 1) return;
      st.px = nx;
      st.py = ny;
      draw();
      if (st.px === st.maze.exit[0] && st.py === st.maze.exit[1]) {
        st.done = true;
        st.ctx.send({ type: 'reach' });
        st.info.textContent = '🎉 Uitgang gevonden! Wachten op de rest…';
        Sound.play('reveal');
      }
    }
    return {
      mount(root, ctx) {
        st.ctx = ctx;
        st.done = false;
        st.maze = null;
        clear(root);
        root.appendChild(h('div', 'mg-title', '🌀 Het Doolhof'));
        st.info = h('div', 'mg-instruct', 'Vind de uitgang — gemiddelde tijd wint!');
        root.appendChild(st.info);
        st.canvas = h('canvas', 'mg-canvas');
        st.canvas.width = 300;
        st.canvas.height = 300;
        st.canvas.style.maxWidth = '300px';
        st.canvas.style.margin = '0 auto';
        st.ctx2d = st.canvas.getContext('2d');
        root.appendChild(st.canvas);

        // Swipe
        let sx, sy;
        st.canvas.addEventListener('pointerdown', (e) => {
          sx = e.clientX;
          sy = e.clientY;
        });
        st.canvas.addEventListener('pointerup', (e) => {
          if (sx == null) return;
          const dx = e.clientX - sx,
            dy = e.clientY - sy;
          if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
          if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1, 0);
          else move(0, dy > 0 ? 1 : -1);
          sx = sy = null;
        });

        // D-pad
        const pad = h('div');
        pad.style.cssText =
          'display:grid;grid-template-columns:repeat(3,64px);grid-template-rows:repeat(2,56px);gap:6px;justify-content:center;margin-top:10px;';
        const mk = (txt, dx, dy, col, row) => {
          const b = h('button', 'btn', txt);
          b.style.gridColumn = col;
          b.style.gridRow = row;
          b.style.fontSize = '24px';
          b.style.padding = '0';
          b.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            move(dx, dy);
          });
          pad.appendChild(b);
        };
        mk('⬆️', 0, -1, '2', '1');
        mk('⬅️', -1, 0, '1', '2');
        mk('⬇️', 0, 1, '2', '2');
        mk('➡️', 1, 0, '3', '2');
        root.appendChild(pad);
      },
      update(state) {
        if (state.maze && !st.maze) {
          st.maze = state.maze;
          st.px = state.maze.start[0];
          st.py = state.maze.start[1];
          draw();
        }
        if (state.phase === 'countdown') {
          st.info.textContent = 'Start over… ' + state.count;
        } else if (state.phase === 'run' && !st.done) {
          const fin = state.finished ? state.finished.length : 0;
          st.info.textContent = 'Vind de uitgang! (' + fin + '/' + state.total + ' klaar)';
        }
      },
      unmount() {},
    };
  })();

  // =========================================================
  // De Blinde Schutter — katapult in het donker
  // =========================================================
  MG.blindeschutter = (function () {
    const st = {};
    const PX = 62; // pivot x
    function draw() {
      const c = st.ctx2d,
        W = st.canvas.width,
        H = st.canvas.height;
      const PY = H - 48;
      c.fillStyle = '#05030f';
      c.fillRect(0, 0, W, H);
      // spotlight op de katapult
      const g = c.createRadialGradient(PX, PY - 18, 8, PX, PY - 18, 170);
      g.addColorStop(0, 'rgba(110,70,180,0.5)');
      g.addColorStop(1, 'rgba(5,3,15,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      const rad = (st.angle * Math.PI) / 180;
      // klif
      c.fillStyle = '#2a2440';
      c.beginPath();
      c.moveTo(0, H);
      c.lineTo(0, H - 24);
      c.lineTo(118, H - 24);
      c.lineTo(100, H);
      c.closePath();
      c.fill();
      c.fillStyle = '#3a3458';
      c.fillRect(0, H - 28, 116, 6);
      // baan-preview (gestippeld)
      const R = (st.power / 100) * (W - PX - 26);
      c.setLineDash([4, 7]);
      c.strokeStyle = 'rgba(255,210,63,0.4)';
      c.lineWidth = 2;
      c.beginPath();
      for (let t = 0; t <= 1; t += 0.04) {
        const x = PX + R * t;
        const peak = Math.min(PY - 12, Math.sin(rad) * R * 0.95);
        const y = PY - 4 * peak * (t - t * t);
        t === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.stroke();
      c.setLineDash([]);
      // A-frame (twee houten poten)
      c.strokeStyle = '#8a5a2b';
      c.lineWidth = 7;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(PX - 16, H - 26);
      c.lineTo(PX, PY);
      c.moveTo(PX + 16, H - 26);
      c.lineTo(PX, PY);
      c.stroke();
      // arm
      const armLen = 46;
      const ax = PX + Math.cos(rad) * armLen;
      const ay = PY - Math.sin(rad) * armLen;
      c.strokeStyle = '#b9762f';
      c.lineWidth = 8;
      c.beginPath();
      c.moveTo(PX, PY);
      c.lineTo(ax, ay);
      c.stroke();
      // elastiek (strakker bij meer kracht -> roder)
      const band = 'rgb(' + Math.round(180 + st.power * 0.6) + ',60,60)';
      c.strokeStyle = band;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(PX - 16, PY - 4);
      c.lineTo(ax, ay);
      c.moveTo(PX + 16, PY - 4);
      c.lineTo(ax, ay);
      c.stroke();
      // projectiel in de pouch (met halo, zonder dure shadowBlur)
      c.fillStyle = 'rgba(255,210,63,0.3)';
      c.beginPath();
      c.arc(ax, ay, 13, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffd23f';
      c.beginPath();
      c.arc(ax, ay, 7, 0, Math.PI * 2);
      c.fill();
      // pivot-bout
      c.fillStyle = '#5a3210';
      c.beginPath();
      c.arc(PX, PY, 4, 0, Math.PI * 2);
      c.fill();
      // krachtmeter rechts
      c.fillStyle = 'rgba(255,255,255,0.15)';
      c.fillRect(W - 22, 16, 12, H - 60);
      c.fillStyle = '#ff6b6b';
      const ph = ((H - 60) * st.power) / 100;
      c.fillRect(W - 22, 16 + (H - 60 - ph), 12, ph);
      // tekst
      c.fillStyle = '#fff';
      c.font = 'bold 14px sans-serif';
      c.fillText('hoek ' + Math.round(st.angle) + '°', 10, 22);
      c.fillText('kracht ' + Math.round(st.power), 10, 40);
    }
    return {
      mount(root, ctx) {
        st.ctx = ctx;
        st.angle = 45;
        st.power = 50;
        st.fired = false;
        clear(root);
        root.appendChild(h('div', 'mg-title', '🎯 De Blinde Schutter'));
        root.appendChild(
          h('div', 'mg-instruct', 'Sleep om te mikken. De gemiddelde afstand wint — niet te ver, niet te kort!')
        );
        st.timer = makeTimerBar(() => st.state, 30000);
        root.appendChild(st.timer);
        st.canvas = h('canvas', 'mg-canvas');
        st.canvas.width = 320;
        st.canvas.height = 220;
        st.canvas.style.maxWidth = '320px';
        st.canvas.style.margin = '0 auto';
        st.ctx2d = st.canvas.getContext('2d');
        root.appendChild(st.canvas);

        const onDrag = (e) => {
          if (st.fired) return;
          const r = st.canvas.getBoundingClientRect();
          const sx = ((e.clientX - r.left) / r.width) * st.canvas.width;
          const sy = ((e.clientY - r.top) / r.height) * st.canvas.height;
          const dx = sx - PX;
          const dy = st.canvas.height - 48 - sy;
          st.angle = Math.max(5, Math.min(85, (Math.atan2(Math.max(1, dy), Math.max(1, dx)) * 180) / Math.PI));
          st.power = Math.max(1, Math.min(100, Math.hypot(dx, dy) / 1.6));
          draw();
        };
        st.canvas.addEventListener('pointerdown', (e) => {
          st.dragging = true;
          onDrag(e);
        });
        st.canvas.addEventListener('pointermove', (e) => {
          if (st.dragging) onDrag(e);
        });
        window.addEventListener('pointerup', () => (st.dragging = false));

        st.fire = h('button', 'btn primary big full', '🔥 Schiet!');
        st.fire.onclick = () => {
          if (st.fired) return;
          st.fired = true;
          st.ctx.send({ type: 'submit', value: { angle: st.angle, power: st.power } });
          Sound.play('start');
          st.fire.textContent = '✅ Geschoten in het donker…';
          st.fire.disabled = true;
        };
        root.appendChild(st.fire);
        draw();
      },
      update(state) {
        st.state = state;
      },
      unmount() {
        if (st.timer) st.timer.stop();
      },
      revealVisual(reveal) {
        // Teken alle banen.
        const wrap = h('div');
        const cv = h('canvas');
        cv.width = 340;
        cv.height = 200;
        cv.style.cssText = 'width:100%;max-width:340px;background:#05030f;border-radius:16px;display:block;margin:0 auto;';
        const c = cv.getContext('2d');
        const rows = reveal.ranking.filter((r) => !r.disconnected && r.distance != null);
        const maxD = Math.max(1, ...rows.map((r) => r.distance));
        rows.forEach((r, i) => {
          const rad = ((r.angle || 45) * Math.PI) / 180;
          const range = (r.distance / maxD) * 300 + 20;
          const hue = (i * 47) % 360;
          c.strokeStyle = 'hsl(' + hue + ',80%,60%)';
          c.lineWidth = 2;
          c.beginPath();
          for (let t = 0; t <= 1; t += 0.05) {
            const x = 20 + range * t;
            const y = 180 - Math.sin(rad) * range * (t - t * t) * 4;
            if (t === 0) c.moveTo(x, y);
            else c.lineTo(x, y);
          }
          c.stroke();
          c.fillStyle = 'hsl(' + hue + ',80%,60%)';
          c.fillText(r.name, 20 + range, 178);
        });
        wrap.appendChild(cv);
        return wrap;
      },
    };
  })();

  // =========================================================
  // Cirkeltrek — teken een cirkel
  // =========================================================
  MG.cirkeltrek = (function () {
    const st = {};
    return {
      mount(root, ctx) {
        st.ctx = ctx;
        st.path = [];
        st.drawing = false;
        st.submitted = false;
        clear(root);
        root.appendChild(h('div', 'mg-title', '⭕ Cirkeltrek'));
        root.appendChild(
          h('div', 'mg-instruct', 'Teken één cirkel. De gemiddelde oppervlakte wint — niet de grootste of de kleinste!')
        );
        st.timer = makeTimerBar(() => st.state, 30000);
        root.appendChild(st.timer);
        st.canvas = h('canvas', 'mg-canvas');
        const size = Math.min(320, window.innerWidth - 40);
        st.canvas.width = size;
        st.canvas.height = size;
        st.canvas.style.cssText = 'background:#fff;border-radius:16px;margin:0 auto;display:block;';
        st.c = st.canvas.getContext('2d');
        const pos = (e) => {
          const r = st.canvas.getBoundingClientRect();
          return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
        };
        const redraw = () => {
          st.c.clearRect(0, 0, size, size);
          st.c.strokeStyle = '#6d28d9';
          st.c.lineWidth = 5;
          st.c.lineJoin = 'round';
          st.c.beginPath();
          st.path.forEach((p, i) => {
            const x = p[0] * size,
              y = p[1] * size;
            i ? st.c.lineTo(x, y) : st.c.moveTo(x, y);
          });
          st.c.stroke();
        };
        st.canvas.addEventListener('pointerdown', (e) => {
          if (st.submitted) return;
          e.preventDefault();
          st.drawing = true;
          st.path = [pos(e)];
        });
        st.canvas.addEventListener('pointermove', (e) => {
          if (!st.drawing) return;
          st.path.push(pos(e));
          redraw();
        });
        const end = () => {
          st.drawing = false;
        };
        st.canvas.addEventListener('pointerup', end);
        st.canvas.addEventListener('pointercancel', end);
        root.appendChild(st.canvas);

        const row = h('div', 'creator-actions');
        const clr = h('button', 'btn', 'Wissen');
        clr.onclick = () => {
          if (st.submitted) return;
          st.path = [];
          st.c.clearRect(0, 0, size, size);
        };
        st.submit = h('button', 'btn primary', 'Inleveren');
        st.submit.onclick = () => {
          if (st.submitted || st.path.length < 3) {
            if (st.path.length < 3) Toast('Teken eerst een cirkel!');
            return;
          }
          st.submitted = true;
          st.ctx.send({ type: 'submit', value: { path: st.path.slice(0, 590) } });
          Sound.play('start');
          st.submit.textContent = '✅ Ingeleverd';
          st.submit.disabled = true;
        };
        row.appendChild(clr);
        row.appendChild(st.submit);
        root.appendChild(row);
      },
      update(state) {
        st.state = state;
      },
      unmount() {
        if (st.timer) st.timer.stop();
      },
      revealVisual(reveal) {
        const wrap = h('div');
        const cv = h('canvas');
        const size = Math.min(300, window.innerWidth - 40);
        cv.width = size;
        cv.height = size;
        cv.style.cssText = 'background:#fff;border-radius:16px;display:block;margin:0 auto;';
        const c = cv.getContext('2d');
        const rows = reveal.ranking
          .filter((r) => r.path && r.path.length)
          .sort((a, b) => (a.area || 0) - (b.area || 0));
        rows.forEach((r, i) => {
          const hue = (i * 57) % 360;
          c.strokeStyle = 'hsl(' + hue + ',75%,55%)';
          c.lineWidth = 3;
          c.beginPath();
          r.path.forEach((p, j) => {
            const x = p[0] * size,
              y = p[1] * size;
            j ? c.lineTo(x, y) : c.moveTo(x, y);
          });
          c.closePath();
          c.stroke();
        });
        wrap.appendChild(cv);
        return wrap;
      },
    };
  })();

  // Lichtgewicht toast (app definieert de echte; fallback hier).
  function Toast(msg) {
    if (window.AppToast) window.AppToast(msg);
  }

  // Onthullings-visual voor het gemiddelde getal: getallenlijn met het gemiddelde.
  MG.gemiddeldgetal.revealVisual = function (reveal) {
    const mean = reveal.meta ? reveal.meta.mean : 0;
    const wrap = h('div');
    wrap.appendChild(h('div', 'reveal-meta', 'Groepsgemiddelde: ' + mean));
    const bar = h('div');
    bar.style.cssText =
      'position:relative;height:60px;background:#fff;border-radius:14px;margin:8px 0;overflow:hidden;';
    const meanLine = h('div');
    meanLine.style.cssText =
      'position:absolute;top:0;bottom:0;width:3px;background:#ef4444;left:' + mean + '%;';
    bar.appendChild(meanLine);
    reveal.ranking.forEach((r) => {
      if (r.choice == null) return;
      const dot = h('div', null, '');
      dot.style.cssText =
        'position:absolute;top:50%;transform:translate(-50%,-50%);font-size:11px;font-weight:800;left:' +
        r.choice +
        '%;';
      dot.textContent = '🔵';
      dot.title = r.name + ': ' + r.choice;
      bar.appendChild(dot);
    });
    wrap.appendChild(bar);
    return wrap;
  };

  // Onthullings-visual voor de ballon.
  MG.ballon.revealVisual = function (reveal) {
    const maxP = reveal.meta ? reveal.meta.maxPumps : 0;
    const wrap = h('div', 'reveal-meta');
    wrap.innerHTML = '🎈 Hoogste inzet: ' + maxP + ' slagen — <b>KNAL!</b> 💥';
    return wrap;
  };

  // =========================================================
  // Demo's bij de uitleg: korte loop-animatie die laat zien hoe het werkt.
  // =========================================================
  function loopDemo(box, framesFn, ms) {
    let i = 0;
    const tick = () => {
      box.innerHTML = framesFn(i);
      i++;
    };
    tick();
    const iv = setInterval(tick, ms || 450);
    return () => clearInterval(iv);
  }
  const scene = (inner, bg) =>
    '<div class="demo-scene"' + (bg ? ' style="background:' + bg + '"' : '') + '>' + inner + '</div>';
  const cap = (t) => '<div class="demo-cap">' + t + '</div>';

  const DEMOS = {
    berenrace: (b) =>
      loopDemo(b, (i) => {
        const p = i % 8, bx = 4 + Math.min(p, 5) * 13, hid = p >= 6;
        return (
          scene(
            '<span style="position:absolute;bottom:10px;left:' + bx + '%;font-size:30px">🐻</span>' +
              '<span style="position:absolute;bottom:10px;right:10%;font-size:28px">' + (hid ? '🌳' : '🏃') + '</span>',
            'linear-gradient(#bbf7d0,#86efac)'
          ) + cap(hid ? '…net op tijd verstopt! 🤫' : 'Niet te vroeg, niet te laat!')
        );
      }, 430),
    doolhof: (b) =>
      loopDemo(b, (i) => {
        const p = i % 5;
        let cells = '';
        for (let k = 0; k < 5; k++) cells += '<span style="font-size:24px">' + (k === p ? '🙂' : k === 4 ? '🏁' : '⬜') + '</span>';
        return scene(cells) + cap('Gemiddelde tijd wint');
      }, 420),
    ballon: (b) =>
      loopDemo(b, (i) => {
        const p = i % 10;
        if (p >= 8) return scene('<div style="font-size:54px">💥</div>') + cap('Te veel = knal!');
        return scene(balloonSvg(3 + p * 2, 20, '#ff5d5d')) + cap('Pomp je deel… niet te veel');
      }, 360),
    verdeelheers: (b) =>
      loopDemo(b, (i) => {
        const a = (i % 5) + 1;
        return scene('<span style="font-size:30px">😈 ➡️ ' + '⭐'.repeat(a) + '</span>') + cap('Verdeel 5 strafpunten');
      }, 500),
    gemiddeldgetal: (b) =>
      loopDemo(b, (i) => {
        const guess = 16 + (i % 7) * 10;
        return (
          scene(
            '<div style="position:relative;width:88%;height:22px;background:#fff;border-radius:8px">' +
              '<div style="position:absolute;top:-7px;bottom:-7px;left:50%;width:3px;background:#ef4444"></div>' +
              '<div style="position:absolute;top:50%;left:' + guess + '%;transform:translate(-50%,-50%);font-size:18px">🔵</div></div>'
          ) + cap('Kom dicht bij het gemiddelde (rood)')
        );
      }, 430),
    schermstaren: (b) =>
      loopDemo(b, (i) => {
        const down = i % 2 === 0;
        return scene('<div style="font-size:46px">' + (down ? '👇' : '✋') + '</div>', 'radial-gradient(circle,#4c1d95,#1e1b4b)') +
          cap(down ? 'Houd vast…' : 'Laat los op gevoel!');
      }, 700),
    tikkampioen: (b) =>
      loopDemo(b, (i) => {
        const n = i % 16;
        return scene('<div style="font-size:38px">👆</div><div style="font-size:30px;font-weight:900;color:#ffd23f">' + n + '</div>') +
          cap('Doseer je tempo');
      }, 250),
    pizzapunt: (b) =>
      loopDemo(b, (i) => scene(pizzaSvg(i % 9, 12)) + cap('Niet te gulzig, niet te karig'), 480),
    blindeschutter: (b) =>
      loopDemo(b, (i) => {
        const t = (i % 11) / 10, x = 12 + t * 66, y = 66 - Math.sin(Math.PI * t) * 48;
        return scene(
          '<span style="position:absolute;left:6%;bottom:10px;font-size:24px">🪨</span>' +
            '<span style="position:absolute;left:' + x + '%;top:' + y + '%;font-size:16px">🟡</span>',
          '#05030f'
        ) + cap('Mik op de gemiddelde afstand');
      }, 130),
    cirkeltrek: (b) =>
      loopDemo(b, (i) => scene('<div style="font-size:' + (26 + (i % 6) * 8) + 'px">⭕</div>') + cap('Niet de grootste of kleinste'), 320),
    lift: (b) =>
      loopDemo(b, (i) => scene(liftSvg(1 + (i % 5) * 4, 20)) + cap('Stap uit op de gemiddelde verdieping'), 600),
  };
  Object.keys(DEMOS).forEach((k) => {
    if (MG[k]) MG[k].demo = DEMOS[k];
  });

  window.MG = MG;
})();
