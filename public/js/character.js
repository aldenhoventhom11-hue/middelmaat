/* Volledige cartoon-figuren als schaalbare SVG: voeten, benen, buik, armen,
   handen, nek en gezicht. Instelbaar: lengte, postuur, huidskleur, haarstijl,
   haarkleur en kleding. Eén spec -> één tekening, overal herbruikt (lobby,
   minigames, resultaten, podium). Ondersteunt poses: 'stand', 'cheer', 'run'. */
(function () {
  // ---- Opties ----
  const SKINS = ['#ffe0bd', '#f3c89b', '#e0ac69', '#c68642', '#8d5524', '#5c3317'];
  const HAIR_STYLES = ['kort', 'krullen', 'lang', 'staart', 'stekels', 'bob', 'kaal'];
  const HAIR_COLORS = ['#2b1b12', '#5a3210', '#8a5a2b', '#d9a441', '#bfbfbf', '#b03a2e', '#1a1a1a', '#6c3baf'];
  const BUILDS = ['dun', 'gemiddeld', 'stevig'];
  const HEIGHTS = ['klein', 'gemiddeld', 'lang'];
  const FACES = ['blij', 'neutraal', 'stoer', 'verbaasd'];
  const COLORS = ['#ff6b6b', '#ffd23f', '#4ecdc4', '#5b8cff', '#c77dff', '#ff8fab', '#8ac926', '#ff9f1c', '#ffffff', '#2b2d42'];

  const BUILD_F = { dun: 0.82, gemiddeld: 1.0, stevig: 1.28 };
  const HEIGHT_F = { klein: 0.9, gemiddeld: 1.0, lang: 1.12 };

  function darken(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, (n >> 16) - amt);
    const g = Math.max(0, ((n >> 8) & 255) - amt);
    const b = Math.max(0, (n & 255) - amt);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function pick(val, list, def) {
    return list.indexOf(val) >= 0 ? val : def;
  }
  function pickColor(val, def) {
    return /^#[0-9a-fA-F]{6}$/.test(val || '') ? val : def;
  }

  function normalize(spec) {
    spec = spec || {};
    return {
      skin: pickColor(spec.skin, SKINS[1]),
      hair: pick(spec.hair, HAIR_STYLES, 'kort'),
      hairColor: pickColor(spec.hairColor, HAIR_COLORS[1]),
      build: pick(spec.build, BUILDS, 'gemiddeld'),
      height: pick(spec.height, HEIGHTS, 'gemiddeld'),
      top: pickColor(spec.top, COLORS[3]),
      bottom: pickColor(spec.bottom, '#2b2d42'),
      face: pick(spec.face, FACES, 'blij'),
    };
  }

  function faceSvg(face, hcx, hcy) {
    const eyeDX = 7.5;
    const eyeY = hcy - 2;
    const mouthY = hcy + 10;
    const eye = (x, big) =>
      big
        ? `<circle cx="${x}" cy="${eyeY}" r="4.2" fill="#fff" stroke="#3a2a1a" stroke-width="1.3"/><circle cx="${x}" cy="${eyeY}" r="2" fill="#1f1147"/>`
        : `<ellipse cx="${x}" cy="${eyeY}" rx="2.5" ry="3.1" fill="#241a12"/>`;
    let s = '';
    switch (face) {
      case 'neutraal':
        s += eye(hcx - eyeDX) + eye(hcx + eyeDX);
        s += `<line x1="${hcx - 6}" y1="${mouthY}" x2="${hcx + 6}" y2="${mouthY}" stroke="#7a3b2e" stroke-width="2.4" stroke-linecap="round"/>`;
        break;
      case 'stoer':
        s += `<line x1="${hcx - eyeDX - 4}" y1="${eyeY - 6}" x2="${hcx - eyeDX + 3}" y2="${eyeY - 3}" stroke="#3a2a1a" stroke-width="2" stroke-linecap="round"/>`;
        s += `<line x1="${hcx + eyeDX + 4}" y1="${eyeY - 6}" x2="${hcx + eyeDX - 3}" y2="${eyeY - 3}" stroke="#3a2a1a" stroke-width="2" stroke-linecap="round"/>`;
        s += eye(hcx - eyeDX) + eye(hcx + eyeDX);
        s += `<path d="M ${hcx - 6} ${mouthY + 1} q6 -3 12 0" fill="none" stroke="#7a3b2e" stroke-width="2.4" stroke-linecap="round"/>`;
        break;
      case 'verbaasd':
        s += eye(hcx - eyeDX, true) + eye(hcx + eyeDX, true);
        s += `<ellipse cx="${hcx}" cy="${mouthY + 1}" rx="3.4" ry="4.2" fill="#7a3b2e"/>`;
        break;
      case 'blij':
      default:
        s += eye(hcx - eyeDX) + eye(hcx + eyeDX);
        s += `<path d="M ${hcx - 8} ${mouthY - 2} q8 9 16 0" fill="none" stroke="#7a3b2e" stroke-width="2.6" stroke-linecap="round"/>`;
        s += `<circle cx="${hcx - 12}" cy="${hcy + 6}" r="3" fill="#ff9aa2" opacity="0.55"/><circle cx="${hcx + 12}" cy="${hcy + 6}" r="3" fill="#ff9aa2" opacity="0.55"/>`;
        break;
    }
    return s;
  }

  // Geeft { back, front } terug: achterhaar wordt vóór het hoofd getekend (zit er
  // dus achter), voorhaar (kap + accenten) ná het hoofd zodat het gezicht vrij blijft.
  function hairSvg(style, color, hcx, hcy, hr, shoulderY) {
    if (style === 'kaal') {
      return { back: '', front: `<ellipse cx="${hcx - 5}" cy="${hcy - hr + 6}" rx="5" ry="3" fill="#ffffff" opacity="0.18"/>` };
    }
    const dk = darken(color, 28);
    // Basiskap: bovenste helft van het hoofd (de scalp).
    const cap = `<path d="M ${hcx - hr - 1} ${hcy + 1} A ${hr + 1} ${hr + 1} 0 0 1 ${hcx + hr + 1} ${hcy + 1} L ${hcx + hr + 1} ${hcy - 2} A ${hr + 1} ${hr + 1} 0 0 0 ${hcx - hr - 1} ${hcy - 2} Z" fill="${color}"/>`;
    let back = '';
    let front = cap;
    switch (style) {
      case 'krullen':
        for (let i = -1; i <= 1; i++) {
          front += `<circle cx="${hcx + i * hr * 0.7}" cy="${hcy - hr + 3}" r="${hr * 0.42}" fill="${color}"/>`;
        }
        front += `<circle cx="${hcx - hr * 0.95}" cy="${hcy - hr * 0.35}" r="${hr * 0.32}" fill="${color}"/><circle cx="${hcx + hr * 0.95}" cy="${hcy - hr * 0.35}" r="${hr * 0.32}" fill="${color}"/>`;
        break;
      case 'stekels':
        front += `<path d="M ${hcx - hr} ${hcy - 6} l 4 -16 5 12 5 -18 5 18 5 -12 4 16 Z" fill="${color}"/>`;
        break;
      case 'lang':
        // Brede vorm achter het hoofd; het hoofd dekt het gezicht af.
        back = `<path d="M ${hcx - hr - 2} ${hcy - 6} C ${hcx - hr - 8} ${hcy + 22}, ${hcx - hr - 5} ${shoulderY + 16}, ${hcx - hr + 3} ${shoulderY + 20} L ${hcx + hr - 3} ${shoulderY + 20} C ${hcx + hr + 5} ${shoulderY + 16}, ${hcx + hr + 8} ${hcy + 22}, ${hcx + hr + 2} ${hcy - 6} Z" fill="${color}"/>`;
        front += `<path d="M ${hcx - hr} ${hcy - 1} q 4 -8 10 -8 q -3 6 -2 9 q 4 -7 9 -7 q -1 5 1 7 q 4 -6 8 -5 l 0 -3 A ${hr} ${hr} 0 0 0 ${hcx - hr} ${hcy - 1} Z" fill="${color}"/>`;
        break;
      case 'bob':
        back = `<path d="M ${hcx - hr - 3} ${hcy - 6} C ${hcx - hr - 5} ${hcy + 16}, ${hcx - hr - 1} ${hcy + 24}, ${hcx - hr + 3} ${hcy + 24} L ${hcx + hr - 3} ${hcy + 24} C ${hcx + hr + 1} ${hcy + 24}, ${hcx + hr + 5} ${hcy + 16}, ${hcx + hr + 3} ${hcy - 6} Z" fill="${color}"/>`;
        break;
      case 'staart':
        back = `<ellipse cx="${hcx + hr + 5}" cy="${hcy + 8}" rx="6" ry="14" fill="${color}"/><ellipse cx="${hcx + hr + 6}" cy="${hcy + 24}" rx="5" ry="9" fill="${dk}"/>`;
        break;
      case 'kort':
      default:
        front += `<path d="M ${hcx - hr + 2} ${hcy - 2} q ${hr - 2} 6 ${2 * hr - 4} 0" fill="${color}"/>`;
        break;
    }
    return { back, front };
  }

  function render(spec, opts) {
    spec = normalize(spec);
    opts = opts || {};
    const pose = opts.pose || 'stand';
    const bf = BUILD_F[spec.build];
    const hf = HEIGHT_F[spec.height];

    const CX = 60;
    const feetY = 224;
    const legLen = 50 * hf;
    const hipY = feetY - legLen;
    const torsoLen = 58 * hf;
    const shoulderY = hipY - torsoLen;
    const torsoHalf = 23 * bf;
    const hipsHalf = 16 * bf;
    const hr = 22;
    const hcy = shoulderY - 24;
    const hcx = CX;

    const skin = spec.skin;
    const skinDk = darken(skin, 30);
    const top = spec.top;
    const topDk = darken(top, 35);
    const bottom = spec.bottom;
    const shoe = '#3a3a44';

    // --- Benen + schoenen ---
    const legW = 13 * bf;
    const lLegX = CX - 8 * bf;
    const rLegX = CX + 8 * bf;
    const legTop = hipY - 4;
    const ankleY = feetY - 8;
    const leg = (x) =>
      `<rect x="${x - legW / 2}" y="${legTop}" width="${legW}" height="${ankleY - legTop}" rx="${legW / 2}" fill="${bottom}"/>`;
    const shoeEl = (x) =>
      `<ellipse cx="${x + 2}" cy="${feetY - 3}" rx="${legW * 0.7}" ry="6" fill="${shoe}"/>`;
    const legs = leg(lLegX) + leg(rLegX) + shoeEl(lLegX) + shoeEl(rLegX);

    // --- Romp (buik) ---
    const torso =
      `<path d="M ${CX - torsoHalf * 0.78} ${shoulderY + 2} ` +
      `C ${CX - torsoHalf * 1.04} ${(shoulderY + hipY) / 2}, ${CX - hipsHalf * 1.15} ${hipY}, ${CX - hipsHalf} ${hipY + 3} ` +
      `L ${CX + hipsHalf} ${hipY + 3} ` +
      `C ${CX + hipsHalf * 1.15} ${hipY}, ${CX + torsoHalf * 1.04} ${(shoulderY + hipY) / 2}, ${CX + torsoHalf * 0.78} ${shoulderY + 2} ` +
      `Q ${CX} ${shoulderY - 9}, ${CX - torsoHalf * 0.78} ${shoulderY + 2} Z" fill="${top}"/>`;

    // --- Armen + handen ---
    const armW = 10 * bf;
    const shLX = CX - torsoHalf * 0.8;
    const shRX = CX + torsoHalf * 0.8;
    const shY = shoulderY + 6;
    let handLX, handLY, handRX, handRY;
    if (pose === 'cheer') {
      handLX = CX - torsoHalf - 6;
      handLY = hcy - hr - 14;
      handRX = CX + torsoHalf + 6;
      handRY = hcy - hr - 14;
    } else if (pose === 'run') {
      handLX = CX - torsoHalf - 12 * bf;
      handLY = shY + 22;
      handRX = CX + torsoHalf + 10 * bf;
      handRY = shY + 6;
    } else {
      handLX = CX - torsoHalf - 7 * bf;
      handLY = hipY - 4;
      handRX = CX + torsoHalf + 7 * bf;
      handRY = hipY - 4;
    }
    const armPath = (sx, hx, hy) =>
      `<path d="M ${sx} ${shY} Q ${(sx + hx) / 2} ${(shY + hy) / 2 + 4} ${hx} ${hy}" fill="none" stroke="${skin}" stroke-width="${armW}" stroke-linecap="round"/>`;
    const sleeve = (sx, hx, hy) => {
      const mx = sx + (hx - sx) * 0.4;
      const my = shY + (hy - shY) * 0.4;
      return `<path d="M ${sx} ${shY} Q ${(sx + mx) / 2} ${(shY + my) / 2} ${mx} ${my}" fill="none" stroke="${top}" stroke-width="${armW + 3}" stroke-linecap="round"/>`;
    };
    const hand = (x, y) => `<circle cx="${x}" cy="${y}" r="${5.5 * bf}" fill="${skin}" stroke="${skinDk}" stroke-width="0.8"/>`;
    const arms =
      armPath(shLX, handLX, handLY) +
      armPath(shRX, handRX, handRY) +
      sleeve(shLX, handLX, handLY) +
      sleeve(shRX, handRX, handRY) +
      hand(handLX, handLY) +
      hand(handRX, handRY);

    // --- Nek + hoofd ---
    const neck = `<rect x="${CX - 6}" y="${hcy + hr - 6}" width="12" height="14" rx="5" fill="${skin}"/>`;
    const ears = `<circle cx="${hcx - hr}" cy="${hcy + 2}" r="4" fill="${skin}" stroke="${skinDk}" stroke-width="0.6"/><circle cx="${hcx + hr}" cy="${hcy + 2}" r="4" fill="${skin}" stroke="${skinDk}" stroke-width="0.6"/>`;
    const head = `<ellipse cx="${hcx}" cy="${hcy}" rx="${hr}" ry="${hr + 1}" fill="${skin}" stroke="${skinDk}" stroke-width="0.8"/>`;
    const face = faceSvg(spec.face, hcx, hcy);
    const hair = hairSvg(spec.hair, spec.hairColor, hcx, hcy, hr, shoulderY);

    // Volgorde: lichaam, achterhaar, hoofd, voorhaar (kap), gezicht bovenop.
    const tilt = pose === 'run' ? `rotate(-7 ${CX} ${feetY})` : '';
    const body =
      `<g ${tilt ? `transform="${tilt}"` : ''}>` +
      legs +
      torso +
      arms +
      neck +
      hair.back +
      ears +
      head +
      hair.front +
      face +
      `</g>`;

    return (
      `<svg viewBox="0 30 120 200" preserveAspectRatio="xMidYMax meet" class="char-svg-inner" xmlns="http://www.w3.org/2000/svg">` +
      body +
      `</svg>`
    );
  }

  function el(spec, cls, opts) {
    const span = document.createElement('span');
    span.className = 'char-svg ' + (cls || '');
    span.innerHTML = render(spec, opts);
    return span;
  }

  function randomSpec() {
    const r = (a) => a[Math.floor(Math.random() * a.length)];
    return {
      skin: r(SKINS),
      hair: r(HAIR_STYLES),
      hairColor: r(HAIR_COLORS),
      build: r(BUILDS),
      height: r(HEIGHTS),
      top: r(COLORS),
      bottom: r(['#2b2d42', '#3a3a44', '#5b3a1a', '#1b3a5b', '#7a1f3d', '#2d6a4f']),
      face: r(FACES),
    };
  }

  window.Char = {
    render,
    el,
    randomSpec,
    SKINS,
    HAIR_STYLES,
    HAIR_COLORS,
    BUILDS,
    HEIGHTS,
    FACES,
    COLORS,
  };
})();
