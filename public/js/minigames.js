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

  // Deeltjes-burst (waterspetters, vonken, schuim, gras). container = position:relative.
  function burst(container, opts) {
    opts = opts || {};
    const n = opts.count || 12;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      if (opts.emojis) s.textContent = opts.emojis[i % opts.emojis.length];
      s.style.cssText =
        'position:absolute;left:' + (opts.x != null ? opts.x : 50) + '%;top:' + (opts.y != null ? opts.y : 50) + '%;' +
        'pointer-events:none;z-index:5;font-size:' + (opts.size || 16) + 'px;' +
        (opts.color ? 'width:8px;height:8px;border-radius:50%;background:' + opts.color + ';' : '');
      container.appendChild(s);
      const ang = (opts.dir != null ? opts.dir : -Math.PI / 2) + (Math.random() - 0.5) * (opts.spread || Math.PI);
      const sp = (opts.speed || 2.2) * (0.5 + Math.random());
      let vx = Math.cos(ang) * sp,
        vy = Math.sin(ang) * sp,
        x = 0,
        y = 0,
        life = 0;
      const max = opts.dur || 42;
      const g = opts.gravity != null ? opts.gravity : 0.14;
      const tick = () => {
        life++;
        vy += g;
        x += vx;
        y += vy;
        s.style.transform = 'translate(' + x * 4 + 'px,' + y * 4 + 'px)';
        s.style.opacity = String(Math.max(0, 1 - life / max));
        if (life < max && s.isConnected) requestAnimationFrame(tick);
        else s.remove();
      };
      requestAnimationFrame(tick);
    }
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
        const min = cfg.min,
          max = cfg.max;
        if (cfg.slider) {
          // Schuifbalk-variant (handig voor grote bereiken zoals 0–100).
          const wrap = h('div');
          wrap.style.cssText = 'display:flex;align-items:center;gap:12px;margin:8px 0;';
          const val = h('div', 'value', String(st.value));
          const range = document.createElement('input');
          range.type = 'range';
          range.min = String(min);
          range.max = String(max);
          range.value = String(st.value);
          range.className = 'slider';
          range.style.flex = '1';
          range.addEventListener('input', () => {
            st.value = Number(range.value);
            val.textContent = st.value;
            refreshVis();
          });
          wrap.appendChild(range);
          wrap.appendChild(val);
          st.body.appendChild(wrap);
        } else {
          const stepper = h('div', 'stepper');
          const minus = h('button', null, '−');
          const val = h('div', 'value', String(st.value));
          const plus = h('button', null, '+');
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
        }
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

  // Schatten in de Pot — schat het aantal snoepjes
  function jarSvg() {
    let s = '<svg width="120" height="120" viewBox="0 0 100 100">';
    s += '<rect x="28" y="14" width="44" height="8" rx="3" fill="#9aa6b3"/>';
    s += '<path d="M26 24 q24 -6 48 0 l-3 64 q-21 6 -42 0 Z" fill="rgba(180,210,235,0.5)" stroke="#9aa6b3" stroke-width="2"/>';
    const cols = ['#ff6b6b', '#ffd23f', '#4ecdc4', '#c77dff', '#8ac926', '#ff9f1c'];
    let i = 0;
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 5; x++) {
        const cx = 34 + x * 8 + (y % 2) * 4;
        const cy = 78 - y * 9;
        if (cx > 70) continue;
        s += '<circle cx="' + cx + '" cy="' + cy + '" r="3.6" fill="' + cols[i++ % cols.length] + '"/>';
      }
    }
    return s + '</svg>';
  }
  MG.schatten = numberGame({
    title: 'Schatten in de Pot',
    emoji: '🫙',
    instruction: 'Hoeveel snoepjes zitten er in de pot? Schat (0–100). De gemiddelde schatting wint.',
    min: 0,
    max: 100,
    start: 50,
    slider: true,
    visual() {
      const d = document.createElement('div');
      d.innerHTML = jarSvg();
      return d;
    },
  });

  // De Toren — stapel en stop op tijd
  MG.toren = (function () {
    const st = {};
    return {
      mount(root, ctx) {
        st.ctx = ctx;
        st.stopped = false;
        st.shown = -1;
        st.cur = 1;
        clear(root);
        root.appendChild(h('div', 'mg-title', '🧱 De Toren'));
        st.info = h('div', 'mg-instruct', 'De toren groeit — stop op tijd! Niet te hoog, niet te laag.');
        root.appendChild(st.info);
        st.tower = h('div');
        st.tower.style.cssText =
          'height:280px;display:flex;flex-direction:column-reverse;align-items:center;justify-content:flex-start;gap:2px;padding-bottom:6px;';
        root.appendChild(st.tower);
        st.btn = h('button', 'big-button', 'STOP! 🧱');
        st.btn.disabled = true;
        st.btn.onclick = () => {
          if (st.stopped) return;
          st.stopped = true;
          st.ctx.send({ type: 'stop' });
          st.btn.textContent = 'Gestopt op ' + st.cur + ' blokken! 🧱';
          st.btn.disabled = true;
          st.btn.classList.add('green');
          Sound.play('pop');
        };
        root.appendChild(st.btn);
      },
      update(state) {
        if (state.phase === 'countdown') {
          st.info.textContent = 'Klaar… ' + state.count;
          return;
        }
        const prog = Math.min(1, (state.elapsed || 0) / (state.rise || 9000));
        const blocks = Math.max(1, Math.round(prog * 20));
        st.cur = blocks;
        if (blocks !== st.shown && !st.stopped) {
          st.shown = blocks;
          st.tower.innerHTML = '';
          for (let i = 0; i < blocks; i++) {
            const bk = h('div');
            const w = 78 - Math.min(46, i * 1.4);
            bk.style.cssText =
              'width:' + w + 'px;height:12px;border-radius:3px;background:hsl(' + (18 + i * 12) + ',72%,55%);box-shadow:inset 0 -2px 0 rgba(0,0,0,0.22);';
            st.tower.appendChild(bk);
          }
        }
        if (!st.stopped) st.btn.disabled = false;
      },
      unmount() {},
    };
  })();

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
  // Het Biertje — vasthouden om te drinken
  // =========================================================
  function glassSvg(level) {
    const top = 18,
      bot = 96,
      h2 = bot - top;
    const beerTop = bot - h2 * level;
    return (
      '<svg width="90" height="120" viewBox="0 0 80 120">' +
      '<rect x="18" y="14" width="44" height="92" rx="6" fill="rgba(255,255,255,0.18)" stroke="#cbd5e1" stroke-width="3"/>' +
      '<path d="M62 34 q14 6 14 24 -14 18 -14 22" fill="none" stroke="#cbd5e1" stroke-width="4"/>' +
      '<rect x="21" y="' + beerTop + '" width="38" height="' + (bot - beerTop) + '" rx="3" fill="#f6b400"/>' +
      '<rect x="21" y="' + (beerTop - 7) + '" width="38" height="9" rx="4" fill="#fff8e7"/>' +
      '</svg>'
    );
  }
  MG.bier = (function () {
    const st = {};
    return {
      mount(root, ctx) {
        st.ctx = ctx;
        st.level = 1;
        st.holding = false;
        clear(root);
        root.appendChild(h('div', 'mg-title', '🍺 Het Biertje'));
        st.info = h('div', 'mg-instruct', 'Houd het glas ingedrukt om te drinken!');
        root.appendChild(st.info);
        st.timer = makeTimerBar(() => st.state, 6000);
        root.appendChild(st.timer);
        st.scene = h('div', 'scene');
        st.scene.style.cssText = 'position:relative;height:170px;display:flex;align-items:center;justify-content:center;background:linear-gradient(#fff3d0,#ffe39e);border-radius:16px;';
        st.glass = h('div');
        st.glass.innerHTML = glassSvg(1);
        st.scene.appendChild(st.glass);
        root.appendChild(st.scene);
        st.btn = h('button', 'big-button green', '🍺 DRINKEN (houd vast)');
        const down = (e) => {
          e.preventDefault();
          if (st.holding) return;
          st.holding = true;
          st.ctx.send({ type: 'down' });
          st.btn.textContent = 'Slok… slok… 🍺';
        };
        const up = () => {
          if (!st.holding) return;
          st.holding = false;
          st.ctx.send({ type: 'up' });
          st.btn.textContent = '🍺 DRINKEN (houd vast)';
        };
        st.btn.addEventListener('pointerdown', down);
        st.btn.addEventListener('pointerup', up);
        st.btn.addEventListener('pointercancel', up);
        st.btn.addEventListener('pointerleave', up);
        root.appendChild(st.btn);
        const loop = () => {
          if (st.holding) {
            st.level -= 0.02;
            if (Math.random() < 0.35) burst(st.scene, { x: 50, y: 40, color: '#fff8e7', count: 1, speed: 1.4, dur: 22, spread: 1.4, gravity: -0.05 });
            if (st.level <= 0) {
              st.level = 1; // nieuw biertje
              Sound.play('pop');
            }
          }
          st.glass.innerHTML = glassSvg(Math.max(0, st.level));
          st.raf = requestAnimationFrame(loop);
        };
        st.raf = requestAnimationFrame(loop);
      },
      update(state) {
        st.state = state;
        if (state.phase === 'countdown') st.info.textContent = 'Klaar… ' + state.count;
        else {
          const ms = state.sips && state.sips[st.ctx.me];
          if (ms != null) st.info.textContent = 'Slokken: ' + Math.max(0, Math.round(ms / 320));
        }
      },
      unmount() {
        if (st.timer) st.timer.stop();
        if (st.raf) cancelAnimationFrame(st.raf);
      },
    };
  })();

  // =========================================================
  // De Raket — lanceer op tijd
  // =========================================================
  MG.raket = (function () {
    const st = {};
    return {
      mount(root, ctx) {
        st.ctx = ctx;
        st.launched = false;
        clear(root);
        root.appendChild(h('div', 'mg-title', '🚀 De Raket'));
        st.info = h('div', 'mg-instruct', 'De motor loopt warm…');
        root.appendChild(st.info);
        st.scene = h('div', 'scene scene-dark');
        st.scene.style.cssText = 'position:relative;height:200px;border-radius:16px;overflow:hidden;background:linear-gradient(#0b1026,#1b2a5b);';
        st.rocket = h('div', null, '🚀');
        st.rocket.style.cssText = 'position:absolute;left:50%;bottom:14px;transform:translateX(-50%) rotate(-45deg);font-size:54px;transition:bottom 0.1s;';
        st.pad = h('div', null, '🟫');
        st.pad.style.cssText = 'position:absolute;left:50%;bottom:0;transform:translateX(-50%);font-size:40px;';
        st.scene.appendChild(st.pad);
        st.scene.appendChild(st.rocket);
        root.appendChild(st.scene);
        st.time = h('div', 'mg-instruct', '0.0s');
        root.appendChild(st.time);
        st.btn = h('button', 'big-button', 'LANCEER! 🚀');
        st.btn.onclick = () => {
          if (st.launched) return;
          st.launched = true;
          st.ctx.send({ type: 'launch' });
          st.btn.textContent = 'Gelanceerd! 🔥';
          st.btn.disabled = true;
          st.btn.classList.add('green');
          // vlieg omhoog met vonken + trail
          st.rocket.style.transition = 'bottom 1.4s cubic-bezier(.4,0,.9,.5), left 1.4s';
          st.rocket.style.bottom = '210px';
          burst(st.scene, { x: 50, y: 92, emojis: ['🔥', '✨', '💨'], count: 16, speed: 2.6, spread: 1.0, dir: Math.PI / 2, dur: 38 });
          Sound.play('start');
        };
        root.appendChild(st.btn);
      },
      update(state) {
        if (state.phase === 'countdown') {
          st.info.textContent = 'Aftellen… ' + state.count;
          return;
        }
        const t = (state.elapsed || 0) / 1000;
        st.time.textContent = t.toFixed(1) + 's';
        if (!st.launched) {
          const wob = Math.sin(Date.now() / 60) * Math.min(4, t);
          st.rocket.style.transform = 'translateX(-50%) translateX(' + wob + 'px) rotate(-45deg)';
          st.info.textContent = t > 8 ? '⚠️ Bijna te laat!' : 'De motor loopt warm…';
        }
      },
      unmount() {},
    };
  })();

  // =========================================================
  // Dobbelen — pure mazzel
  // =========================================================
  function dieFace(n) {
    const pips = {
      1: [[50, 50]],
      2: [[28, 28], [72, 72]],
      3: [[28, 28], [50, 50], [72, 72]],
      4: [[28, 28], [72, 28], [28, 72], [72, 72]],
      5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
      6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
    };
    let s = '<svg width="64" height="64" viewBox="0 0 100 100"><rect x="6" y="6" width="88" height="88" rx="16" fill="#fff" stroke="#cbd5e1" stroke-width="3"/>';
    (pips[n] || []).forEach((p) => (s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="9" fill="#1f1147"/>'));
    return s + '</svg>';
  }
  MG.dobbel = (function () {
    const st = {};
    return {
      mount(root, ctx) {
        st.ctx = ctx;
        st.rolled = false;
        clear(root);
        root.appendChild(h('div', 'mg-title', '🎲 Dobbelen'));
        st.info = h('div', 'mg-instruct', 'Gooi twee dobbelstenen — pure mazzel!');
        root.appendChild(st.info);
        st.dice = h('div');
        st.dice.style.cssText = 'display:flex;gap:16px;justify-content:center;align-items:center;height:90px;';
        st.d1 = h('div');
        st.d2 = h('div');
        st.d1.innerHTML = dieFace(1);
        st.d2.innerHTML = dieFace(1);
        st.dice.appendChild(st.d1);
        st.dice.appendChild(st.d2);
        root.appendChild(st.dice);
        st.sum = h('div', 'tap-counter', '');
        root.appendChild(st.sum);
        st.btn = h('button', 'big-button blue', 'GOOI! 🎲');
        st.btn.onclick = () => {
          if (st.rolled) return;
          st.rolled = true;
          st.ctx.send({ type: 'roll' });
          st.btn.disabled = true;
          st.btn.textContent = 'Gegooid!';
          // tumble tot de server-waarde binnen is
          st.tumble = setInterval(() => {
            st.d1.innerHTML = dieFace(1 + Math.floor(Math.random() * 6));
            st.d2.innerHTML = dieFace(1 + Math.floor(Math.random() * 6));
          }, 80);
          Sound.play('tick');
        };
        root.appendChild(st.btn);
      },
      update(state) {
        if (state.phase === 'countdown') {
          st.info.textContent = 'Klaar… ' + state.count;
          return;
        }
        const d = state.dice && state.dice[st.ctx.me];
        if (d && st.tumble) {
          clearInterval(st.tumble);
          st.tumble = null;
          st.d1.innerHTML = dieFace(d[0]);
          st.d2.innerHTML = dieFace(d[1]);
          st.sum.textContent = d[0] + d[1];
          st.info.textContent = 'Jij gooide ' + (d[0] + d[1]) + '!';
          Sound.play('reveal');
        }
      },
      unmount() {
        if (st.tumble) clearInterval(st.tumble);
      },
    };
  })();

  // =========================================================
  // Haaieneiland — tik-duwen, survival
  // =========================================================
  MG.haaien = (function () {
    const st = {};
    const SIZE = 320;
    return {
      mount(root, ctx) {
        st.ctx = ctx;
        st.fellSeen = {};
        clear(root);
        root.appendChild(h('div', 'mg-title', '🦈 Haaieneiland'));
        st.info = h('div', 'mg-instruct', 'Tik op een ander om ’m de haaien in te duwen!');
        root.appendChild(st.info);
        st.arena = h('div');
        st.arena.style.cssText =
          'position:relative;width:' + SIZE + 'px;max-width:92vw;aspect-ratio:1;margin:0 auto;border-radius:50%;' +
          'background:radial-gradient(circle at 50% 45%,#7ec8e3 0 58%,#2f8fc0 60%,#1c6390 100%);overflow:hidden;';
        // platform
        st.platform = h('div');
        st.platform.style.cssText = 'position:absolute;left:14%;top:14%;width:72%;height:72%;border-radius:50%;background:radial-gradient(circle at 50% 40%,#e9c887,#caa15a);box-shadow:inset 0 0 0 4px #b07d3a;';
        st.arena.appendChild(st.platform);
        // sharks
        ['🦈', '🦈', '🦈'].forEach((sh, i) => {
          const f = h('div', null, sh);
          f.style.cssText = 'position:absolute;font-size:26px;animation:swim ' + (6 + i) + 's linear infinite;top:' + (10 + i * 35) + '%;left:' + (i % 2 ? 80 : 5) + '%;';
          st.arena.appendChild(f);
        });
        st.figs = h('div');
        st.figs.style.cssText = 'position:absolute;inset:0;';
        st.arena.appendChild(st.figs);
        root.appendChild(st.arena);
        st.btn = h('button', 'big-button green', '💪 BLIJF STAAN! (ram)');
        const recover = (e) => {
          e.preventDefault();
          st.ctx.send({ type: 'recover' });
        };
        st.btn.addEventListener('pointerdown', recover);
        root.appendChild(st.btn);
      },
      update(state) {
        if (state.phase === 'countdown') {
          st.info.textContent = 'Klaar… ' + state.count;
          return;
        }
        const players = state.players || [];
        const pos = state.pos || {};
        const fallen = state.fallen || [];
        const n = players.length;
        st.figs.innerHTML = '';
        players.forEach((p, i) => {
          const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
          const fell = fallen.includes(p.id);
          const d = fell ? 0.98 : 0.16 + Math.min(1, pos[p.id] || 0) * 0.74;
          const cx = 50 + Math.cos(ang) * d * 42;
          const cy = 50 + Math.sin(ang) * d * 42;
          const wrap = document.createElement('div');
          wrap.style.cssText =
            'position:absolute;left:' + cx + '%;top:' + cy + '%;transform:translate(-50%,-60%);transition:left .15s,top .15s;' +
            (fell ? 'opacity:.5;filter:grayscale(.6);' : '');
          const ce = charEl(p.character, 'stand');
          ce.querySelector('svg').style.height = n > 8 ? '44px' : '62px';
          wrap.appendChild(ce);
          if (p.id === st.ctx.me) {
            wrap.style.filter = 'drop-shadow(0 0 6px #ffd23f)';
          } else if (!fell) {
            wrap.style.cursor = 'pointer';
            wrap.addEventListener('pointerdown', (e) => {
              e.preventDefault();
              st.ctx.send({ type: 'push', target: p.id });
              burst(st.arena, { x: cx, y: cy, emojis: ['💢'], count: 3, speed: 1.5, dur: 20 });
            });
          }
          // splash bij vallen
          if (fell && !st.fellSeen[p.id]) {
            st.fellSeen[p.id] = 1;
            burst(st.arena, { x: cx, y: cy, emojis: ['💦', '💧'], count: 10, speed: 2.4, dur: 32 });
            Sound.play('pop');
          }
          st.figs.appendChild(wrap);
        });
        const left = n - fallen.length;
        st.info.textContent = 'Nog ' + left + ' op het eiland — duw de anderen eraf!';
      },
      unmount() {},
    };
  })();

  // =========================================================
  // De 100 Meter — sprint (links/rechts tikken)
  // =========================================================
  MG.sprint = (function () {
    const st = {};
    return {
      mount(root, ctx) {
        st.ctx = ctx;
        st.phase = 0;
        st.finished = false;
        clear(root);
        root.appendChild(h('div', 'mg-title', '🏃 De 100 Meter'));
        st.info = h('div', 'mg-instruct', 'Tik AFWISSELEND links en rechts om te rennen!');
        root.appendChild(st.info);
        // baan
        st.track = h('div');
        st.track.style.cssText = 'position:relative;height:150px;border-radius:14px;overflow:hidden;background:#c0392b;border:4px solid #8a2a1e;';
        st.lanes = h('div');
        st.lanes.style.cssText = 'position:absolute;inset:0;background:repeating-linear-gradient(90deg,#c0392b 0 60px,#a93226 60px 64px);';
        st.track.appendChild(st.lanes);
        st.finishLine = h('div');
        st.finishLine.style.cssText = 'position:absolute;top:0;bottom:0;width:10px;background:repeating-linear-gradient(45deg,#fff 0 6px,#000 6px 12px);right:6%;';
        st.track.appendChild(st.finishLine);
        st.runnerWrap = h('div');
        st.runnerWrap.style.cssText = 'position:absolute;bottom:6px;left:6%;transition:left .12s linear;';
        st.setRunner = (phase) => {
          st.runnerWrap.innerHTML = '';
          const e = window.Char.el(myChar(st.ctx), '', { pose: 'run', runPhase: phase });
          const svg = e.querySelector('svg');
          svg.style.height = '120px';
          svg.style.width = 'auto';
          st.runnerWrap.appendChild(e);
        };
        st.setRunner(0);
        st.track.appendChild(st.runnerWrap);
        root.appendChild(st.track);
        // afstandsbalk
        st.bar = h('div', 'timer-bar');
        st.barFill = h('i');
        st.barFill.style.background = '#22c55e';
        st.bar.appendChild(st.barFill);
        root.appendChild(st.bar);
        // L/R knoppen
        const btns = h('div');
        btns.style.cssText = 'display:flex;gap:12px;';
        st.bl = h('button', 'big-button blue', 'LINKS 👟');
        st.br = h('button', 'big-button blue', 'RECHTS 👟');
        st.bl.style.flex = '1';
        st.br.style.flex = '1';
        const tap = (side) => (e) => {
          e.preventDefault();
          if (st.finished) return;
          st.ctx.send({ type: 'tap', side: side });
          st.phase = st.phase ? 0 : 1;
          st.setRunner(st.phase);
          burst(st.track, { x: 8, y: 92, emojis: ['💨'], count: 1, speed: 1.4, dur: 16, dir: Math.PI });
        };
        st.bl.addEventListener('pointerdown', tap('l'));
        st.br.addEventListener('pointerdown', tap('r'));
        btns.appendChild(st.bl);
        btns.appendChild(st.br);
        root.appendChild(btns);
      },
      update(state) {
        if (state.phase === 'countdown') {
          st.info.textContent = 'Op uw plaatsen… ' + state.count;
          return;
        }
        const d = (state.dist && state.dist[st.ctx.me]) || 0;
        const goal = state.goal || 100;
        const frac = Math.min(1, d / goal);
        st.runnerWrap.style.left = 6 + frac * 82 + '%';
        st.barFill.style.width = frac * 100 + '%';
        st.info.textContent = Math.round(d) + ' / ' + goal + ' meter';
        if (frac >= 1 && !st.finished) {
          st.finished = true;
          st.info.textContent = '🏁 Finish!';
          st.track.style.animation = 'slowmo 0.6s';
        }
      },
      unmount() {},
    };
  })();

  // =========================================================
  // Mini Golf — richten + kracht, één hole
  // =========================================================
  MG.golf = (function () {
    const st = {};
    const COURSE = 1700;
    return {
      mount(root, ctx) {
        st.ctx = ctx;
        st.submitted = false;
        st.strokes = 0;
        st.ball = { x: 60, y: 150, vx: 0, vy: 0 };
        st.safe = { x: 60, y: 150 };
        st.hole = { x: COURSE - 80, y: 150 };
        st.moving = false;
        clear(root);
        root.appendChild(h('div', 'mg-title', '⛳ Mini Golf'));
        st.info = h('div', 'mg-instruct', 'Sleep terug om te richten + kracht. In de hole in een gemiddeld aantal slagen!');
        root.appendChild(st.info);
        st.timer = makeTimerBar(() => st.state, 45000);
        root.appendChild(st.timer);
        st.canvas = h('canvas', 'mg-canvas');
        st.canvas.width = 340;
        st.canvas.height = 200;
        st.canvas.style.cssText = 'width:100%;max-width:340px;margin:0 auto;display:block;background:#3fa34d;border-radius:14px;';
        st.c = st.canvas.getContext('2d');
        root.appendChild(st.canvas);
        st.status = h('div', 'mg-instruct', 'Slagen: 0');
        root.appendChild(st.status);

        // obstakels: water + bunker (in course-coords)
        st.water = { x: 760, w: 150 };
        st.bunker = { x: 1150, w: 170 };

        const cam = () => Math.max(0, Math.min(COURSE - 340, st.ball.x - 150));
        st.cam = cam;
        const toScreen = (x) => x - cam();

        let drag = null;
        const pos = (e) => {
          const r = st.canvas.getBoundingClientRect();
          return { x: ((e.clientX - r.left) / r.width) * 340, y: ((e.clientY - r.top) / r.height) * 200 };
        };
        st.canvas.addEventListener('pointerdown', (e) => {
          if (st.moving || st.submitted) return;
          drag = pos(e);
        });
        st.canvas.addEventListener('pointermove', (e) => {
          if (drag) {
            drag.cur = pos(e);
            st.draw();
          }
        });
        const shoot = (e) => {
          if (!drag || !drag.cur) {
            drag = null;
            return;
          }
          const dx = drag.x - drag.cur.x;
          const dy = drag.y - drag.cur.y;
          const power = Math.min(1, Math.hypot(dx, dy) / 90);
          st.ball.vx = dx * 0.18 * (power + 0.2);
          st.ball.vy = dy * 0.18 * (power + 0.2);
          st.strokes++;
          st.status.textContent = 'Slagen: ' + st.strokes;
          st.moving = true;
          drag = null;
          Sound.play('button');
        };
        st.canvas.addEventListener('pointerup', shoot);

        st.draw = () => {
          const c = st.c,
            off = cam();
          c.clearRect(0, 0, 340, 200);
          // fairway
          c.fillStyle = '#3fa34d';
          c.fillRect(0, 0, 340, 200);
          c.fillStyle = '#4caf50';
          c.fillRect(0, 120, 340, 80);
          // water
          c.fillStyle = '#3b82f6';
          c.fillRect(st.water.x - off, 120, st.water.w, 80);
          // bunker
          c.fillStyle = '#e8d8a0';
          c.fillRect(st.bunker.x - off, 120, st.bunker.w, 80);
          // hole
          c.fillStyle = '#1b1b1b';
          c.beginPath();
          c.ellipse(st.hole.x - off, st.hole.y, 11, 6, 0, 0, 7);
          c.fill();
          c.strokeStyle = '#fff';
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(st.hole.x - off, st.hole.y - 6);
          c.lineTo(st.hole.x - off, st.hole.y - 34);
          c.stroke();
          c.fillStyle = '#ef4444';
          c.fillRect(st.hole.x - off, st.hole.y - 34, 14, 9);
          // ball
          c.fillStyle = '#fff';
          c.beginPath();
          c.arc(st.ball.x - off, st.ball.y, 6, 0, 7);
          c.fill();
          c.strokeStyle = '#bbb';
          c.stroke();
          // richt-lijn
          if (drag && drag.cur) {
            const dx = drag.x - drag.cur.x,
              dy = drag.y - drag.cur.y;
            c.strokeStyle = '#ffd23f';
            c.lineWidth = 3;
            c.beginPath();
            c.moveTo(st.ball.x - off, st.ball.y);
            c.lineTo(st.ball.x - off + dx * 1.5, st.ball.y + dy * 1.5);
            c.stroke();
          }
          // afstand tot hole
          c.fillStyle = 'rgba(0,0,0,0.5)';
          c.fillRect(0, 0, 130, 22);
          c.fillStyle = '#fff';
          c.font = 'bold 13px sans-serif';
          c.fillText('nog ' + Math.max(0, Math.round((st.hole.x - st.ball.x) / 17)) + 'm', 8, 16);
        };

        const phys = () => {
          if (st.moving) {
            st.ball.x += st.ball.vx;
            st.ball.y += st.ball.vy;
            // grond/randen
            if (st.ball.y > 188) {
              st.ball.y = 188;
              st.ball.vy *= -0.4;
            }
            if (st.ball.y < 60) {
              st.ball.y = 60;
              st.ball.vy *= -0.4;
            }
            if (st.ball.x < 12) {
              st.ball.x = 12;
              st.ball.vx *= -0.4;
            }
            // bunker = veel wrijving
            const inBunker = st.ball.x > st.bunker.x && st.ball.x < st.bunker.x + st.bunker.w && st.ball.y > 120;
            const fr = inBunker ? 0.86 : 0.985;
            st.ball.vx *= fr;
            st.ball.vy *= fr;
            // water = strafslag, terug naar veilig
            if (st.ball.x > st.water.x && st.ball.x < st.water.x + st.water.w && st.ball.y > 120) {
              st.strokes++;
              st.ball.x = st.safe.x;
              st.ball.y = st.safe.y;
              st.ball.vx = st.ball.vy = 0;
              st.moving = false;
              st.status.textContent = 'Slagen: ' + st.strokes + ' (plons! +1)';
              burst(st.canvas.parentNode, { x: 50, y: 70, emojis: ['💦'], count: 6 });
            }
            const sp = Math.hypot(st.ball.vx, st.ball.vy);
            // in de hole?
            if (Math.abs(st.ball.x - st.hole.x) < 12 && Math.abs(st.ball.y - st.hole.y) < 8 && sp < 3.2) {
              st.holeIn();
            } else if (sp < 0.25) {
              st.moving = false;
              st.ball.vx = st.ball.vy = 0;
              st.safe = { x: st.ball.x, y: st.ball.y };
            }
          }
          st.draw();
          st.raf = requestAnimationFrame(phys);
        };
        st.holeIn = () => {
          if (st.submitted) return;
          st.submitted = true;
          st.moving = false;
          st.ctx.send({ type: 'submit', value: st.strokes });
          st.info.textContent = '🏌️ In de hole in ' + st.strokes + ' slagen!';
          burst(st.canvas.parentNode, { x: 88, y: 60, emojis: ['🎉', '⛳', '✨'], count: 14 });
          Sound.play('win');
        };
        st.raf = requestAnimationFrame(phys);
      },
      update(state) {
        st.state = state;
        // veiligheidsnet: bijna deadline en nog niet ingeleverd -> stuur (met straf).
        if (!st.submitted && state.deadline && state.deadline - Date.now() < 700) {
          st.submitted = true;
          st.ctx.send({ type: 'submit', value: Math.min(40, st.strokes + 15) });
          st.info.textContent = 'Tijd op! ' + (st.strokes + 15) + ' slagen';
        }
      },
      unmount() {
        if (st.timer) st.timer.stop();
        if (st.raf) cancelAnimationFrame(st.raf);
      },
    };
  })();

  // =========================================================
  // De Kapper — knip de lange haren
  // =========================================================
  function ladySvg(hairLen) {
    // hairLen 0..1 (1 = lang). Hoofd boven, haar hangt eronder.
    const top = 26,
      hairTop = 44;
    const hairBottom = hairTop + 110 * hairLen;
    return (
      '<svg width="120" height="200" viewBox="0 0 120 200">' +
      '<rect x="44" y="' + hairTop + '" width="32" height="' + (hairBottom - hairTop) + '" rx="14" fill="#6b3f1d"/>' +
      '<rect x="30" y="' + hairTop + '" width="60" height="' + (hairBottom - hairTop) * 0.9 + '" rx="22" fill="#7a4a22"/>' +
      '<ellipse cx="60" cy="' + (top + 18) + '" rx="22" ry="24" fill="#f3c89b"/>' +
      '<circle cx="52" cy="' + (top + 16) + '" r="2.5" fill="#241a12"/><circle cx="68" cy="' + (top + 16) + '" r="2.5" fill="#241a12"/>' +
      '<path d="M53 ' + (top + 26) + ' q7 6 14 0" fill="none" stroke="#a44" stroke-width="2"/>' +
      '<path d="M34 ' + hairTop + ' q26 -22 52 0" fill="#7a4a22"/>' +
      '</svg>'
    );
  }
  MG.kapper = (function () {
    const st = {};
    return {
      mount(root, ctx) {
        st.ctx = ctx;
        st.submitted = false;
        st.line = 0.6; // fractie van onderaf (hoger = meer geknipt)
        clear(root);
        root.appendChild(h('div', 'mg-title', '✂️ De Kapper'));
        st.info = h('div', 'mg-instruct', 'Sleep de knip-lijn en knip! Niet te veel, niet te weinig.');
        root.appendChild(st.info);
        st.timer = makeTimerBar(() => st.state, 30000);
        root.appendChild(st.timer);
        st.scene = h('div', 'scene');
        st.scene.style.cssText = 'position:relative;height:210px;background:linear-gradient(#dff1ff,#bfe0f5);border-radius:16px;display:flex;justify-content:center;';
        st.lady = h('div');
        st.lady.innerHTML = ladySvg(1);
        st.scene.appendChild(st.lady);
        // knip-lijn
        st.cut = h('div');
        st.cut.style.cssText = 'position:absolute;left:18%;right:18%;height:0;border-top:3px dashed #e11d48;cursor:row-resize;';
        st.scissors = h('div', null, '✂️');
        st.scissors.style.cssText = 'position:absolute;left:-22px;top:-13px;font-size:24px;';
        st.cut.appendChild(st.scissors);
        st.scene.appendChild(st.cut);
        root.appendChild(st.scene);
        const sceneH = 210,
          hairTopPx = 44 / 200 * sceneH,
          hairBotPx = 154 / 200 * sceneH;
        const setLine = (clientY) => {
          const r = st.scene.getBoundingClientRect();
          let y = clientY - r.top;
          y = Math.max(hairTopPx + 8, Math.min(hairBotPx, y));
          st.cut.style.top = y + 'px';
          // cut-fractie: hoe hoger de lijn, hoe meer geknipt
          st.line = 1 - (y - hairTopPx) / (hairBotPx - hairTopPx);
        };
        st.cut.style.top = '60%';
        st.scene.addEventListener('pointerdown', (e) => {
          if (st.submitted) return;
          st.dragging = true;
          setLine(e.clientY);
        });
        st.scene.addEventListener('pointermove', (e) => {
          if (st.dragging) setLine(e.clientY);
        });
        window.addEventListener('pointerup', () => (st.dragging = false));
        st.btn = h('button', 'btn primary big full', '✂️ Knip!');
        st.btn.onclick = () => {
          if (st.submitted) return;
          st.submitted = true;
          st.ctx.send({ type: 'submit', value: st.line });
          // schaar-animatie + vallend haar
          const top = parseFloat(st.cut.style.top);
          st.scissors.style.transition = 'left 0.5s';
          st.scissors.style.left = '100%';
          st.lady.innerHTML = ladySvg(Math.max(0.05, 1 - st.line));
          burst(st.scene, { x: 50, y: (top / sceneH) * 100, emojis: ['💇', '〰️'], count: 10, speed: 1.6, dur: 40, gravity: 0.2, dir: Math.PI / 2 });
          st.btn.textContent = '✅ Geknipt (' + Math.round(st.line * 100) + '%)';
          st.btn.disabled = true;
          Sound.play('pop');
        };
        root.appendChild(st.btn);
      },
      update(state) {
        st.state = state;
      },
      unmount() {
        if (st.timer) st.timer.stop();
      },
      revealVisual(reveal) {
        // Alle dames naast elkaar, klein->veel geknipt.
        const wrap = h('div');
        wrap.style.cssText = 'display:flex;gap:6px;overflow-x:auto;justify-content:center;padding:6px;';
        const rows = reveal.ranking.filter((r) => r.cut != null).sort((a, b) => a.cut - b.cut);
        rows.forEach((r) => {
          const col = h('div');
          col.style.cssText = 'text-align:center;flex:0 0 auto;';
          col.innerHTML = ladySvg(Math.max(0.05, 1 - r.cut)).replace('width="120" height="200"', 'width="70" height="116"');
          col.appendChild(h('div', 'demo-cap', r.name));
          wrap.appendChild(col);
        });
        return wrap;
      },
    };
  })();

  // =========================================================
  // Bal Hooghouden — plateau (volgt je vinger) + stuiterende bal, neon arcade
  // =========================================================
  MG.hooghouden = (function () {
    const st = {};
    const W = 320,
      H = 400,
      PW = 92, // plateau-breedte (middel)
      PH = 12,
      BR = 14, // bal-straal (middel)
      PY = H - 54;
    return {
      mount(root, ctx) {
        st.ctx = ctx;
        st.started = false;
        st.dropped = false;
        st.bounces = 0;
        st.t0 = 0;
        st.paddleX = W / 2;
        st.target = W / 2;
        st.ball = { x: W / 2, y: PY - BR, vx: 0, vy: 0 };
        clear(root);
        root.appendChild(h('div', 'mg-title', '🏓 Bal Hooghouden'));
        st.info = h('div', 'mg-instruct', 'Beweeg het plateau met je vinger en houd de bal hoog!');
        root.appendChild(st.info);
        st.canvas = h('canvas', 'mg-canvas');
        st.canvas.width = W;
        st.canvas.height = H;
        st.canvas.style.cssText = 'width:100%;max-width:' + W + 'px;margin:0 auto;display:block;background:#0a0a1f;border-radius:16px;box-shadow:0 0 0 2px #3b1d6e;touch-action:none;';
        st.c = st.canvas.getContext('2d');
        root.appendChild(st.canvas);

        const setTarget = (e) => {
          const r = st.canvas.getBoundingClientRect();
          st.target = Math.max(PW / 2, Math.min(W - PW / 2, ((e.clientX - r.left) / r.width) * W));
        };
        st.canvas.addEventListener('pointerdown', setTarget);
        st.canvas.addEventListener('pointermove', setTarget);

        st.draw = () => {
          const c = st.c;
          c.clearRect(0, 0, W, H);
          // neon-grid
          c.strokeStyle = 'rgba(120,80,220,0.18)';
          c.lineWidth = 1;
          for (let x = 0; x <= W; x += 32) {
            c.beginPath();
            c.moveTo(x, 0);
            c.lineTo(x, H);
            c.stroke();
          }
          for (let y = 0; y <= H; y += 32) {
            c.beginPath();
            c.moveTo(0, y);
            c.lineTo(W, y);
            c.stroke();
          }
          // middel-hint op het plateau
          // plateau (neon)
          c.fillStyle = 'rgba(0,240,255,0.18)';
          c.fillRect(st.paddleX - PW / 2 - 3, PY - 3, PW + 6, PH + 6);
          c.fillStyle = '#00f0ff';
          c.fillRect(st.paddleX - PW / 2, PY, PW, PH);
          c.fillStyle = '#0a0a1f';
          c.fillRect(st.paddleX - 2, PY, 4, PH); // midden-markering
          // bal (gloed zonder shadowBlur)
          c.fillStyle = 'rgba(255,80,200,0.3)';
          c.beginPath();
          c.arc(st.ball.x, st.ball.y, BR + 7, 0, 7);
          c.fill();
          c.fillStyle = '#ff4fd0';
          c.beginPath();
          c.arc(st.ball.x, st.ball.y, BR, 0, 7);
          c.fill();
          c.fillStyle = 'rgba(255,255,255,0.7)';
          c.beginPath();
          c.arc(st.ball.x - 4, st.ball.y - 4, 4, 0, 7);
          c.fill();
        };

        const loop = () => {
          // plateau volgt de vinger (soepel)
          st.paddleX += (st.target - st.paddleX) * 0.5;
          if (st.started && !st.dropped) {
            const elapsed = Date.now() - st.t0;
            const accel = 1 + Math.min(0.9, elapsed / 30000 * 0.9); // bal versnelt langzaam
            const G = 0.32 * accel;
            const b = st.ball;
            b.vy += G;
            b.x += b.vx;
            b.y += b.vy;
            // wanden
            if (b.x < BR) {
              b.x = BR;
              b.vx = Math.abs(b.vx);
            } else if (b.x > W - BR) {
              b.x = W - BR;
              b.vx = -Math.abs(b.vx);
            }
            // plafond (zacht)
            if (b.y < BR) {
              b.y = BR;
              b.vy = Math.abs(b.vy) * 0.6;
            }
            // plateau-botsing
            if (
              b.vy > 0 &&
              b.y + BR >= PY &&
              b.y + BR <= PY + PH + 14 &&
              b.x >= st.paddleX - PW / 2 &&
              b.x <= st.paddleX + PW / 2
            ) {
              const offset = (b.x - st.paddleX) / (PW / 2); // -1..1
              b.y = PY - BR;
              b.vy = -8.4 * accel; // recht omhoog
              b.vx = offset * 6.2 * accel; // hoek groeit met afstand tot midden
              st.bounces++;
              burst(st.canvas.parentNode, { x: (st.paddleX / W) * 100, y: (PY / H) * 100, emojis: ['✨'], count: 3, speed: 1.6, dur: 18 });
              Sound.play('tick');
            }
            // gevallen?
            if (b.y - BR > H) {
              st.dropped = true;
              st.ctx.send({ type: 'drop' });
              st.info.textContent = '💥 Bal gevallen na ' + st.bounces + ' keer! Wachten op de rest…';
              burst(st.canvas.parentNode, { x: (b.x / W) * 100, y: 96, emojis: ['💥', '💧'], count: 10, speed: 2.4 });
              Sound.play('pop');
            }
            st.info.textContent = st.dropped
              ? st.info.textContent
              : 'Hooggehouden: ' + (elapsed / 1000).toFixed(1) + 's · ' + st.bounces + 'x';
          } else if (!st.started) {
            // bal rust op het plateau
            st.ball.x = st.paddleX;
            st.ball.y = PY - BR;
          }
          st.draw();
          st.raf = requestAnimationFrame(loop);
        };
        st.draw();
        st.raf = requestAnimationFrame(loop);
      },
      update(state) {
        if (state.phase === 'countdown') {
          st.info.textContent = 'Klaar… ' + state.count;
        } else if (state.phase === 'play' && !st.started) {
          st.started = true;
          st.t0 = Date.now();
          st.ball.vy = -2; // klein zetje omhoog bij de start
        }
      },
      unmount() {
        if (st.raf) cancelAnimationFrame(st.raf);
      },
    };
  })();

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
    toren: (b) =>
      loopDemo(b, (i) => {
        const p = i % 9;
        if (p >= 7) return scene('<div style="font-size:40px">🧱✋</div>') + cap('STOP op tijd!');
        let blocks = '';
        for (let k = 0; k <= p; k++) blocks += '<div style="width:' + (44 - k * 4) + 'px;height:8px;margin:1px auto;border-radius:2px;background:hsl(' + (20 + k * 16) + ',72%,55%)"></div>';
        return scene('<div style="display:flex;flex-direction:column-reverse">' + blocks + '</div>') + cap('Niet te hoog, niet te laag');
      }, 300),
    schatten: (b) =>
      loopDemo(b, (i) => scene(jarSvg() + '<div style="font-size:30px;font-weight:900;color:#5b21b6">' + (20 + (i % 7) * 10) + '?</div>') + cap('Schat de gemiddelde hoeveelheid'), 450),
    bier: (b) =>
      loopDemo(b, (i) => scene(glassSvg(1 - (i % 6) / 6), 'linear-gradient(#fff3d0,#ffe39e)') + cap('Houd vast — niet te veel, niet te weinig'), 300),
    raket: (b) =>
      loopDemo(b, (i) => {
        const p = i % 7;
        const bottom = p < 5 ? 6 : 6 + (p - 4) * 40;
        return scene('<span style="position:absolute;left:50%;bottom:' + bottom + 'px;transform:translateX(-50%) rotate(-45deg);font-size:34px">🚀</span>', '#0b1026') + cap(p >= 5 ? 'Lanceer op tijd!' : 'Wacht op het juiste moment…');
      }, 280),
    dobbel: (b) =>
      loopDemo(b, (i) => scene('<div style="display:flex;gap:8px">' + dieFace(1 + (i % 6)) + dieFace(1 + ((i + 3) % 6)) + '</div>') + cap('Hoogste & laagste verliezen'), 260),
    haaien: (b) =>
      loopDemo(b, (i) => {
        const p = i % 6;
        return scene('<span style="font-size:34px">🏝️🧍' + (p > 3 ? '💦🦈' : '') + '</span>') + cap(p > 3 ? 'Niet als eerste of laatste eraf!' : 'Duw de anderen het water in');
      }, 360),
    sprint: (b) =>
      loopDemo(b, (i) => scene('<span style="font-size:36px;display:inline-block;transform:scaleX(' + (i % 2 ? -1 : 1) + ')">🏃</span><span style="font-size:24px">💨</span>', '#c0392b') + cap('Afwisselend L/R — gemiddelde tijd wint'), 180),
    golf: (b) =>
      loopDemo(b, (i) => {
        const p = i % 8;
        const x = 10 + p * 9;
        return scene('<span style="position:absolute;left:' + x + '%;top:50%;font-size:16px">⚪</span><span style="position:absolute;right:8%;top:46%;font-size:22px">⛳</span>', '#3fa34d') + cap('In de hole — gemiddeld aantal slagen wint');
      }, 220),
    kapper: (b) =>
      loopDemo(b, (i) => scene(ladySvg(1 - (i % 6) / 8).replace('width="120" height="200"', 'width="74" height="124"') + '<span style="font-size:24px">✂️</span>') + cap('Niet te veel, niet te weinig knippen'), 400),
    hooghouden: (b) =>
      loopDemo(b, (i) => {
        const p = i % 8;
        const by = p < 4 ? 20 + p * 18 : 20 + (7 - p) * 18; // bal op en neer
        const px = 30 + (p % 4) * 12;
        return scene(
          '<div style="position:relative;width:120px;height:110px">' +
            '<div style="position:absolute;left:' + px + '%;top:' + by + 'px;font-size:22px">🔴</div>' +
            '<div style="position:absolute;left:' + px + '%;bottom:8px;transform:translateX(-50%);width:46px;height:8px;border-radius:4px;background:#00f0ff"></div>' +
            '</div>',
          '#0a0a1f'
        ) + cap('Houd de bal hoog — niet te kort, niet te lang');
      }, 260),
  };
  Object.keys(DEMOS).forEach((k) => {
    if (MG[k]) MG[k].demo = DEMOS[k];
  });

  window.MG = MG;
})();
