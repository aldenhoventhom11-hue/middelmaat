/* Gedetailleerde cartoon-figuren als schaalbare SVG: voeten, benen, buik, armen,
   handen, nek en gezicht. Instelbaar via schuifbalken (lengte, postuur), man/vrouw
   (lichaamsvorm + kleding rok/jurk), huidskleur, haarstijl/-kleur, kleding en
   gezicht. Poses: 'stand', 'cheer', 'run'. */
(function () {
  const SKINS = ['#ffe0bd', '#f3c89b', '#e0ac69', '#c68642', '#8d5524', '#5c3317'];
  const HAIR_STYLES = ['kort', 'krullen', 'lang', 'staart', 'stekels', 'bob', 'kaal'];
  const HAIR_COLORS = ['#2b1b12', '#5a3210', '#8a5a2b', '#d9a441', '#bfbfbf', '#b03a2e', '#1a1a1a', '#6c3baf'];
  const FACES = ['blij', 'neutraal', 'stoer', 'verbaasd'];
  const GENDERS = ['man', 'vrouw'];
  const OUTFITS = ['broek', 'rok', 'jurk'];
  const GLASSES = ['geen', 'rond', 'nerd', 'zonnebril'];
  const BEARDS = ['geen', 'snor', 'sik', 'vol'];
  const ACC_HATS = ['geen', 'pet', 'muts', 'hoge hoed', 'kroon', 'bloem'];
  const COLORS = ['#ff6b6b', '#ffd23f', '#4ecdc4', '#5b8cff', '#c77dff', '#ff8fab', '#8ac926', '#ff9f1c', '#ffffff', '#2b2d42'];
  const PANTS = ['#2b2d42', '#3a3a44', '#5b3a1a', '#1b3a5b', '#7a1f3d', '#2d6a4f', '#4a4e69', '#1a1a1a'];

  function darken(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, (n >> 16) - amt);
    const g = Math.max(0, ((n >> 8) & 255) - amt);
    const b = Math.max(0, (n & 255) - amt);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, (n >> 16) + amt);
    const g = Math.min(255, ((n >> 8) & 255) + amt);
    const b = Math.min(255, (n & 255) + amt);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function pick(val, list, def) {
    return list.indexOf(val) >= 0 ? val : def;
  }
  function pickColor(val, def) {
    return /^#[0-9a-fA-F]{6}$/.test(val || '') ? val : def;
  }
  // Schuif-factor 0..1; accepteert ook oude enum-waarden.
  function slider(v, def) {
    if (typeof v === 'number' && isFinite(v)) return Math.max(0, Math.min(1, v));
    const map = { klein: 0.15, gemiddeld: 0.5, lang: 0.85, dun: 0.12, stevig: 0.88 };
    return map[v] != null ? map[v] : def;
  }

  function normalize(spec) {
    spec = spec || {};
    const gender = pick(spec.gender, GENDERS, 'man');
    return {
      gender,
      skin: pickColor(spec.skin, SKINS[1]),
      hair: pick(spec.hair, HAIR_STYLES, gender === 'vrouw' ? 'lang' : 'kort'),
      hairColor: pickColor(spec.hairColor, HAIR_COLORS[1]),
      height: slider(spec.height, 0.5),
      build: slider(spec.build, 0.5),
      top: pickColor(spec.top, COLORS[3]),
      bottom: pickColor(spec.bottom, '#2b2d42'),
      outfit: pick(spec.outfit, OUTFITS, gender === 'vrouw' ? 'jurk' : 'broek'),
      face: pick(spec.face, FACES, 'blij'),
      glasses: pick(spec.glasses, GLASSES, 'geen'),
      beard: pick(spec.beard, BEARDS, 'geen'),
      hat: pick(spec.hat, ACC_HATS, 'geen'),
    };
  }

  function glassesSvg(type, hcx, hcy) {
    if (type === 'geen') return '';
    const ex = 7.5, y = hcy - 1, r = 6.2;
    const frame = '#241a12';
    if (type === 'zonnebril') {
      return (
        `<circle cx="${hcx - ex}" cy="${y}" r="${r}" fill="#1a1a1a"/>` +
        `<circle cx="${hcx + ex}" cy="${y}" r="${r}" fill="#1a1a1a"/>` +
        `<line x1="${hcx - 1.5}" y1="${y}" x2="${hcx + 1.5}" y2="${y}" stroke="#1a1a1a" stroke-width="2"/>`
      );
    }
    if (type === 'nerd') {
      return (
        `<rect x="${hcx - ex - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" rx="3" fill="rgba(255,255,255,0.25)" stroke="${frame}" stroke-width="2.4"/>` +
        `<rect x="${hcx + ex - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" rx="3" fill="rgba(255,255,255,0.25)" stroke="${frame}" stroke-width="2.4"/>` +
        `<line x1="${hcx - 1.5}" y1="${y}" x2="${hcx + 1.5}" y2="${y}" stroke="${frame}" stroke-width="2.4"/>`
      );
    }
    // rond
    return (
      `<circle cx="${hcx - ex}" cy="${y}" r="${r}" fill="rgba(255,255,255,0.2)" stroke="${frame}" stroke-width="2"/>` +
      `<circle cx="${hcx + ex}" cy="${y}" r="${r}" fill="rgba(255,255,255,0.2)" stroke="${frame}" stroke-width="2"/>` +
      `<line x1="${hcx - 1.5}" y1="${y}" x2="${hcx + 1.5}" y2="${y}" stroke="${frame}" stroke-width="2"/>`
    );
  }

  function beardSvg(type, color, hcx, hcy, hr) {
    if (type === 'geen') return '';
    const c = color;
    if (type === 'snor') return `<path d="M ${hcx - 8} ${hcy + 7} q4 4 8 0 q4 4 8 0 q-8 6 -16 0 Z" fill="${c}"/>`;
    if (type === 'sik') return `<path d="M ${hcx - 4} ${hcy + 13} q4 7 8 0 q-4 4 -8 0 Z" fill="${c}"/>`;
    // vol
    return `<path d="M ${hcx - hr + 1} ${hcy + 2} Q ${hcx - hr + 2} ${hcy + hr} ${hcx} ${hcy + hr + 1} Q ${hcx + hr - 2} ${hcy + hr} ${hcx + hr - 1} ${hcy + 2} Q ${hcx} ${hcy + 9} ${hcx - hr + 1} ${hcy + 2} Z" fill="${c}"/>`;
  }

  function accHatSvg(type, hcx, hcy, hr) {
    if (type === 'geen') return '';
    const topY = hcy - hr;
    switch (type) {
      case 'pet':
        return `<path d="M ${hcx - hr - 1} ${topY + 6} Q ${hcx} ${topY - 12} ${hcx + hr + 1} ${topY + 6} Z" fill="#2563eb"/><path d="M ${hcx + hr - 2} ${topY + 6} q 14 1 16 6 l -16 1 Z" fill="#1e40af"/>`;
      case 'muts':
        return `<path d="M ${hcx - hr - 1} ${topY + 8} Q ${hcx} ${topY - 16} ${hcx + hr + 1} ${topY + 8} Z" fill="#dc2626"/><rect x="${hcx - hr - 1}" y="${topY + 6}" width="${2 * hr + 2}" height="6" rx="3" fill="#fff"/><circle cx="${hcx}" cy="${topY - 12}" r="5" fill="#fff"/>`;
      case 'hoge hoed':
        return `<rect x="${hcx - hr - 3}" y="${topY + 2}" width="${2 * hr + 6}" height="6" rx="3" fill="#1a1a1a"/><rect x="${hcx - hr + 3}" y="${topY - 22}" width="${2 * hr - 6}" height="26" rx="2" fill="#1a1a1a"/><rect x="${hcx - hr + 3}" y="${topY - 6}" width="${2 * hr - 6}" height="5" fill="#b03a2e"/>`;
      case 'kroon':
        return `<path d="M ${hcx - hr + 2} ${topY + 6} l 3 -16 6 10 6 -14 6 14 6 -10 3 16 Z" fill="#ffd23f" stroke="#e0a800" stroke-width="1.5"/><circle cx="${hcx}" cy="${topY - 8}" r="2.5" fill="#ff5d8f"/>`;
      case 'bloem':
        return `<g fill="#ff5d8f"><circle cx="${hcx + hr - 4}" cy="${topY + 6}" r="5"/><circle cx="${hcx + hr - 10}" cy="${topY + 8}" r="5"/><circle cx="${hcx + hr + 2}" cy="${topY + 8}" r="5"/><circle cx="${hcx + hr - 2}" cy="${topY + 1}" r="5"/></g><circle cx="${hcx + hr - 4}" cy="${topY + 6}" r="3" fill="#ffd23f"/>`;
      default:
        return '';
    }
  }

  function faceSvg(face, gender, hcx, hcy) {
    const eyeDX = 7.5;
    const eyeY = hcy - 1;
    const mouthY = hcy + 11;
    const fem = gender === 'vrouw';
    const eye = (x, big) => {
      const ry = big ? 4.6 : 3.4;
      return (
        `<ellipse cx="${x}" cy="${eyeY}" rx="${big ? 4.2 : 2.7}" ry="${ry}" fill="#fff"/>` +
        `<circle cx="${x}" cy="${eyeY + 0.6}" r="${big ? 2.4 : 2.1}" fill="#3a2a1a"/>` +
        `<circle cx="${x + 0.9}" cy="${eyeY - 0.9}" r="0.9" fill="#fff"/>` +
        (fem ? `<path d="M ${x - 3.4} ${eyeY - 2.6} q -2 -1 -3.6 0" stroke="#241a12" stroke-width="1" fill="none"/>` : '')
      );
    };
    const brow = (x, dir) =>
      `<path d="M ${x - 4} ${eyeY - 6 + (dir > 0 ? 1.5 : 0)} q 4 ${dir > 0 ? 1 : -2} 8 ${dir > 0 ? 1.5 : 0}" stroke="${'#3a2a1a'}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
    const nose = `<path d="M ${hcx} ${hcy + 2} q 2 4 -1.5 5" stroke="#caa06e" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
    let s = '';
    switch (face) {
      case 'neutraal':
        s += brow(hcx - eyeDX, 0) + brow(hcx + eyeDX, 0);
        s += eye(hcx - eyeDX) + eye(hcx + eyeDX) + nose;
        s += `<line x1="${hcx - 5}" y1="${mouthY}" x2="${hcx + 5}" y2="${mouthY}" stroke="#a44" stroke-width="2.4" stroke-linecap="round"/>`;
        break;
      case 'stoer':
        s += `<line x1="${hcx - eyeDX - 4}" y1="${eyeY - 6}" x2="${hcx - eyeDX + 3}" y2="${eyeY - 3}" stroke="#3a2a1a" stroke-width="2" stroke-linecap="round"/>`;
        s += `<line x1="${hcx + eyeDX + 4}" y1="${eyeY - 6}" x2="${hcx + eyeDX - 3}" y2="${eyeY - 3}" stroke="#3a2a1a" stroke-width="2" stroke-linecap="round"/>`;
        s += eye(hcx - eyeDX) + eye(hcx + eyeDX) + nose;
        s += `<path d="M ${hcx - 6} ${mouthY + 1} q6 -3 12 0" fill="none" stroke="#a44" stroke-width="2.4" stroke-linecap="round"/>`;
        break;
      case 'verbaasd':
        s += brow(hcx - eyeDX, 1) + brow(hcx + eyeDX, 1);
        s += eye(hcx - eyeDX, true) + eye(hcx + eyeDX, true) + nose;
        s += `<ellipse cx="${hcx}" cy="${mouthY + 1}" rx="3.2" ry="4" fill="#7a3b2e"/>`;
        break;
      case 'blij':
      default:
        s += brow(hcx - eyeDX, 0) + brow(hcx + eyeDX, 0);
        s += eye(hcx - eyeDX) + eye(hcx + eyeDX) + nose;
        s += `<path d="M ${hcx - 8} ${mouthY - 2} q8 9 16 0" fill="none" stroke="#a44" stroke-width="2.6" stroke-linecap="round"/>`;
        s += `<circle cx="${hcx - 12}" cy="${hcy + 7}" r="3" fill="#ff9aa2" opacity="0.5"/><circle cx="${hcx + 12}" cy="${hcy + 7}" r="3" fill="#ff9aa2" opacity="0.5"/>`;
        break;
    }
    if (fem) {
      // Lippen-accent.
      s += `<path d="M ${hcx - 5} ${mouthY + (face === 'verbaasd' ? 4 : 1)} q5 2 10 0" stroke="#d6607a" stroke-width="1.4" fill="none" opacity="0.7"/>`;
    }
    return s;
  }

  function hairSvg(style, color, hcx, hcy, hr, shoulderY) {
    if (style === 'kaal') {
      return { back: '', front: `<ellipse cx="${hcx - 5}" cy="${hcy - hr + 6}" rx="5" ry="3" fill="#ffffff" opacity="0.18"/>` };
    }
    const dk = darken(color, 28);
    const hi = lighten(color, 40);
    const cap = `<path d="M ${hcx - hr - 1} ${hcy + 1} A ${hr + 1} ${hr + 1} 0 0 1 ${hcx + hr + 1} ${hcy + 1} L ${hcx + hr + 1} ${hcy - 2} A ${hr + 1} ${hr + 1} 0 0 0 ${hcx - hr - 1} ${hcy - 2} Z" fill="${color}"/>`;
    const shine = `<path d="M ${hcx - hr * 0.5} ${hcy - hr * 0.7} q ${hr * 0.5} -${hr * 0.3} ${hr} 0" stroke="${hi}" stroke-width="2" fill="none" opacity="0.6" stroke-linecap="round"/>`;
    let back = '';
    let front = cap + shine;
    switch (style) {
      case 'krullen':
        for (let i = -1; i <= 1; i++) front += `<circle cx="${hcx + i * hr * 0.7}" cy="${hcy - hr + 3}" r="${hr * 0.42}" fill="${color}"/>`;
        front += `<circle cx="${hcx - hr * 0.95}" cy="${hcy - hr * 0.35}" r="${hr * 0.32}" fill="${color}"/><circle cx="${hcx + hr * 0.95}" cy="${hcy - hr * 0.35}" r="${hr * 0.32}" fill="${color}"/>`;
        break;
      case 'stekels':
        front += `<path d="M ${hcx - hr} ${hcy - 6} l 4 -16 5 12 5 -18 5 18 5 -12 4 16 Z" fill="${color}"/>`;
        break;
      case 'lang':
        back = `<path d="M ${hcx - hr - 2} ${hcy - 6} C ${hcx - hr - 8} ${hcy + 22}, ${hcx - hr - 5} ${shoulderY + 16}, ${hcx - hr + 3} ${shoulderY + 20} L ${hcx + hr - 3} ${shoulderY + 20} C ${hcx + hr + 5} ${shoulderY + 16}, ${hcx + hr + 8} ${hcy + 22}, ${hcx + hr + 2} ${hcy - 6} Z" fill="${color}"/>`;
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
    const bf = 0.74 + spec.build * 0.62; // postuur (dikte)
    const hf = 0.86 + spec.height * 0.3; // lengte

    const CX = 60;
    const feetY = 224;
    const legLen = 50 * hf;
    const hipY = feetY - legLen;
    const torsoLen = 58 * hf;
    const shoulderY = hipY - torsoLen;

    // Man = bredere schouders/smallere heupen; vrouw = omgekeerd.
    const fem = spec.gender === 'vrouw';
    const torsoHalf = 23 * bf * (fem ? 0.9 : 1.06);
    const hipsHalf = 16 * bf * (fem ? 1.12 : 0.92);
    const hr = 21.5;
    const hcy = shoulderY - 24;
    const hcx = CX;

    const skin = spec.skin;
    const skinDk = darken(skin, 30);
    const top = spec.top;
    const topDk = darken(top, 35);
    const topHi = lighten(top, 30);
    const bottom = spec.bottom;
    const shoe = '#3a3a44';
    const outfit = spec.outfit;
    const bareLegs = outfit === 'rok' || outfit === 'jurk';

    // --- Benen + schoenen ---
    const legW = 13 * bf;
    const lLegX = CX - 8 * bf;
    const rLegX = CX + 8 * bf;
    const legTop = hipY - 4;
    const ankleY = feetY - 8;
    const legColor = bareLegs ? skin : bottom;
    const leg = (x) =>
      `<rect x="${x - legW / 2}" y="${legTop}" width="${legW}" height="${ankleY - legTop}" rx="${legW / 2}" fill="${legColor}"/>`;
    const shoeEl = (x) =>
      `<ellipse cx="${x + 2}" cy="${feetY - 3}" rx="${legW * 0.72}" ry="6" fill="${bareLegs ? '#d6607a' : shoe}"/>`;
    const runPhase = opts.runPhase || 0; // continu 0..1 = ren-cyclus
    const runSwing = Math.sin(runPhase * Math.PI * 2);
    let legs;
    if (pose === 'run') {
      const sw = 32;
      const legG = (x, ang) =>
        `<g transform="rotate(${ang} ${x} ${legTop})">${leg(x)}${shoeEl(x)}</g>`;
      legs = legG(lLegX, runSwing * sw) + legG(rLegX, -runSwing * sw);
    } else {
      legs = leg(lLegX) + leg(rLegX) + shoeEl(lLegX) + shoeEl(rLegX);
    }

    // --- Rok/jurk ---
    let skirt = '';
    if (bareLegs) {
      const waistY = hipY - 4;
      const hemY = hipY + legLen * 0.45;
      const hemHalf = hipsHalf * 2.1;
      const col = outfit === 'jurk' ? top : bottom;
      skirt = `<path d="M ${CX - hipsHalf - 1} ${waistY} L ${CX - hemHalf} ${hemY} Q ${CX} ${hemY + 9} ${CX + hemHalf} ${hemY} L ${CX + hipsHalf + 1} ${waistY} Z" fill="${col}"/>`;
    }

    // --- Romp (buik) met lichte schaduw ---
    const torso =
      `<path d="M ${CX - torsoHalf * 0.78} ${shoulderY + 2} ` +
      `C ${CX - torsoHalf * 1.04} ${(shoulderY + hipY) / 2}, ${CX - hipsHalf * 1.15} ${hipY}, ${CX - hipsHalf} ${hipY + 3} ` +
      `L ${CX + hipsHalf} ${hipY + 3} ` +
      `C ${CX + hipsHalf * 1.15} ${hipY}, ${CX + torsoHalf * 1.04} ${(shoulderY + hipY) / 2}, ${CX + torsoHalf * 0.78} ${shoulderY + 2} ` +
      `Q ${CX} ${shoulderY - 9}, ${CX - torsoHalf * 0.78} ${shoulderY + 2} Z" fill="${top}"/>` +
      `<path d="M ${CX} ${shoulderY + 2} Q ${CX + torsoHalf * 0.5} ${(shoulderY + hipY) / 2} ${CX + hipsHalf * 0.6} ${hipY} L ${CX + hipsHalf} ${hipY + 3} C ${CX + torsoHalf * 1.04} ${(shoulderY + hipY) / 2}, ${CX + torsoHalf * 0.78} ${shoulderY + 2}, ${CX + torsoHalf * 0.78} ${shoulderY + 2} Z" fill="${topDk}" opacity="0.25"/>` +
      `<path d="M ${CX - 7} ${shoulderY + 1} q7 6 14 0" fill="none" stroke="${topDk}" stroke-width="1.5" opacity="0.4"/>`; // kraag

    // --- Armen + handen ---
    const armW = 10 * bf;
    const shLX = CX - torsoHalf * 0.8;
    const shRX = CX + torsoHalf * 0.8;
    const shY = shoulderY + 6;
    let handLX, handLY, handRX, handRY;
    if (pose === 'cheer') {
      handLX = CX - torsoHalf - 6; handLY = hcy - hr - 14;
      handRX = CX + torsoHalf + 6; handRY = hcy - hr - 14;
    } else if (pose === 'run') {
      handLX = CX - torsoHalf - 11 * bf; handLY = shY + 14 - runSwing * 12;
      handRX = CX + torsoHalf + 11 * bf; handRY = shY + 14 + runSwing * 12;
    } else {
      handLX = CX - torsoHalf - 7 * bf; handLY = hipY - 4;
      handRX = CX + torsoHalf + 7 * bf; handRY = hipY - 4;
    }
    const armPath = (sx, hx, hy) =>
      `<path d="M ${sx} ${shY} Q ${(sx + hx) / 2} ${(shY + hy) / 2 + 4} ${hx} ${hy}" fill="none" stroke="${skin}" stroke-width="${armW}" stroke-linecap="round"/>`;
    const sleeve = (sx, hx, hy) => {
      const mx = sx + (hx - sx) * 0.42;
      const my = shY + (hy - shY) * 0.42;
      return `<path d="M ${sx} ${shY} Q ${(sx + mx) / 2} ${(shY + my) / 2} ${mx} ${my}" fill="none" stroke="${top}" stroke-width="${armW + 3}" stroke-linecap="round"/>`;
    };
    const hand = (x, y) => `<circle cx="${x}" cy="${y}" r="${5.5 * bf}" fill="${skin}" stroke="${skinDk}" stroke-width="0.8"/>`;
    const arms =
      armPath(shLX, handLX, handLY) + armPath(shRX, handRX, handRY) +
      sleeve(shLX, handLX, handLY) + sleeve(shRX, handRX, handRY) +
      hand(handLX, handLY) + hand(handRX, handRY);

    // --- Nek + hoofd ---
    const neck = `<rect x="${CX - 5.5}" y="${hcy + hr - 6}" width="11" height="14" rx="5" fill="${skin}"/><rect x="${CX - 5.5}" y="${hcy + hr - 6}" width="11" height="5" rx="3" fill="${skinDk}" opacity="0.3"/>`;
    const ears = `<circle cx="${hcx - hr}" cy="${hcy + 2}" r="4" fill="${skin}" stroke="${skinDk}" stroke-width="0.6"/><circle cx="${hcx + hr}" cy="${hcy + 2}" r="4" fill="${skin}" stroke="${skinDk}" stroke-width="0.6"/>`;
    const head = `<ellipse cx="${hcx}" cy="${hcy}" rx="${hr}" ry="${hr + 1}" fill="${skin}" stroke="${skinDk}" stroke-width="0.8"/>`;
    const face = faceSvg(spec.face, spec.gender, hcx, hcy);
    const hair = hairSvg(spec.hair, spec.hairColor, hcx, hcy, hr, shoulderY);
    const beard = beardSvg(spec.beard, spec.hairColor, hcx, hcy, hr);
    const glasses = glassesSvg(spec.glasses, hcx, hcy);
    const accHat = accHatSvg(spec.hat, hcx, hcy, hr);

    const tilt = pose === 'run' ? `rotate(-7 ${CX} ${feetY})` : '';
    const body =
      `<g ${tilt ? `transform="${tilt}"` : ''}>` +
      legs + skirt + torso + arms + neck + hair.back + ears + head + beard + hair.front + face + glasses + accHat +
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
    const gender = r(GENDERS);
    return {
      gender,
      skin: r(SKINS),
      hair: r(HAIR_STYLES),
      hairColor: r(HAIR_COLORS),
      height: Math.random(),
      build: Math.random(),
      top: r(COLORS),
      bottom: r(PANTS),
      outfit: gender === 'vrouw' ? r(OUTFITS) : 'broek',
      face: r(FACES),
      glasses: r(GLASSES),
      beard: gender === 'man' ? r(BEARDS) : 'geen',
      hat: r(ACC_HATS),
    };
  }

  window.Char = {
    render, el, randomSpec,
    SKINS, HAIR_STYLES, HAIR_COLORS, FACES, GENDERS, OUTFITS, GLASSES, BEARDS, ACC_HATS, COLORS, PANTS,
  };
})();
