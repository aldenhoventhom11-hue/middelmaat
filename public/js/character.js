/* Cartoon-personages als schaalbare SVG. Eén spec -> één tekening, overal
   herbruikt (lobby, resultaten, podium). */
(function () {
  const SHAPES = ['blob', 'rond', 'vierkant', 'bonk'];
  const EYES = ['gewoon', 'blij', 'boos', 'verbaasd', 'knipoog'];
  const MOUTHS = ['lach', 'grijns', 'streep', 'open', 'tong'];
  const HATS = ['geen', 'pet', 'kroon', 'hoorns', 'bloem', 'tovenaar'];
  const COLORS = [
    '#ff6b6b',
    '#ffd23f',
    '#4ecdc4',
    '#5b8cff',
    '#c77dff',
    '#ff8fab',
    '#8ac926',
    '#ff9f1c',
  ];

  function darken(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) - amt;
    let g = ((n >> 8) & 255) - amt;
    let b = (n & 255) - amt;
    r = Math.max(0, r);
    g = Math.max(0, g);
    b = Math.max(0, b);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function bodyPath(shape) {
    switch (shape) {
      case 'rond':
        return '<circle cx="50" cy="62" r="34" />';
      case 'vierkant':
        return '<rect x="20" y="30" width="60" height="62" rx="16" />';
      case 'bonk':
        return '<rect x="26" y="24" width="48" height="70" rx="22" />';
      case 'blob':
      default:
        return '<path d="M50 26 C76 26 84 48 82 66 C80 86 66 96 50 96 C34 96 20 86 18 66 C16 48 24 26 50 26 Z" />';
    }
  }

  function eyesSvg(type) {
    const L = 38,
      R = 62,
      Y = 54;
    const arc =
      'fill="none" stroke="#1f1147" stroke-width="3" stroke-linecap="round"';
    const line = 'stroke="#1f1147" stroke-width="3" stroke-linecap="round"';
    switch (type) {
      case 'blij':
        return (
          `<path ${arc} d="M${L - 6} ${Y} q6 -8 12 0" />` +
          `<path ${arc} d="M${R - 6} ${Y} q6 -8 12 0" />`
        );
      case 'boos':
        return (
          `<line ${line} x1="${L - 7}" y1="${Y - 8}" x2="${L + 5}" y2="${Y - 3}" />` +
          `<line ${line} x1="${R - 5}" y1="${Y - 3}" x2="${R + 7}" y2="${Y - 8}" />` +
          `<circle cx="${L}" cy="${Y}" r="4" fill="#1f1147"/>` +
          `<circle cx="${R}" cy="${Y}" r="4" fill="#1f1147"/>`
        );
      case 'verbaasd':
        return `<circle cx="${L}" cy="${Y}" r="8" fill="#fff" stroke="#1f1147" stroke-width="2"/><circle cx="${L}" cy="${Y}" r="3.5" fill="#1f1147"/><circle cx="${R}" cy="${Y}" r="8" fill="#fff" stroke="#1f1147" stroke-width="2"/><circle cx="${R}" cy="${Y}" r="3.5" fill="#1f1147"/>`;
      case 'knipoog':
        return `<circle cx="${L}" cy="${Y}" r="5" fill="#1f1147"/><path d="M${R - 6} ${Y} q6 6 12 0" fill="none" stroke="#1f1147" stroke-width="3" stroke-linecap="round"/>`;
      case 'gewoon':
      default:
        return `<circle cx="${L}" cy="${Y}" r="5" fill="#1f1147"/><circle cx="${R}" cy="${Y}" r="5" fill="#1f1147"/>`;
    }
  }

  function mouthSvg(type) {
    const Y = 74;
    switch (type) {
      case 'grijns':
        return `<path d="M36 ${Y} q14 16 28 0 q-14 6 -28 0 Z" fill="#7a1f3d"/>`;
      case 'streep':
        return `<line x1="40" y1="${Y}" x2="60" y2="${Y}" stroke="#1f1147" stroke-width="3" stroke-linecap="round"/>`;
      case 'open':
        return `<ellipse cx="50" cy="${Y + 2}" rx="9" ry="11" fill="#7a1f3d"/>`;
      case 'tong':
        return `<path d="M38 ${Y} q12 12 24 0" fill="none" stroke="#1f1147" stroke-width="3" stroke-linecap="round"/><path d="M46 ${Y + 5} q4 8 8 0 Z" fill="#ff5d8f"/>`;
      case 'lach':
      default:
        return `<path d="M38 ${Y - 2} q12 14 24 0" fill="none" stroke="#1f1147" stroke-width="3.5" stroke-linecap="round"/>`;
    }
  }

  function hatSvg(type, color) {
    const d = darken(color, 50);
    switch (type) {
      case 'pet':
        return `<path d="M26 30 q24 -20 48 0 Z" fill="${d}"/><path d="M70 30 q16 2 18 8 l-18 2 Z" fill="${d}"/>`;
      case 'kroon':
        return `<path d="M30 28 l6 -16 8 12 12 -16 12 16 8 -12 6 16 Z" fill="#ffd23f" stroke="#e0a800" stroke-width="2"/><circle cx="50" cy="16" r="3" fill="#ff5d8f"/>`;
      case 'hoorns':
        return `<path d="M30 30 q-8 -18 -2 -22 q8 6 10 20 Z" fill="#b91c1c"/><path d="M70 30 q8 -18 2 -22 q-8 6 -10 20 Z" fill="#b91c1c"/>`;
      case 'bloem':
        return `<g fill="#ff5d8f"><circle cx="50" cy="20" r="6"/><circle cx="42" cy="24" r="6"/><circle cx="58" cy="24" r="6"/><circle cx="46" cy="14" r="6"/><circle cx="54" cy="14" r="6"/></g><circle cx="50" cy="19" r="4" fill="#ffd23f"/>`;
      case 'tovenaar':
        return `<path d="M50 -2 L72 34 L28 34 Z" fill="#5b21b6"/><circle cx="50" cy="14" r="3" fill="#ffd23f"/><circle cx="44" cy="24" r="2" fill="#ffd23f"/><circle cx="58" cy="26" r="2" fill="#ffd23f"/>`;
      case 'geen':
      default:
        return '';
    }
  }

  function render(spec) {
    spec = spec || {};
    const color = /^#[0-9a-fA-F]{6}$/.test(spec.color || '') ? spec.color : '#ff6b6b';
    const shape = SHAPES.includes(spec.shape) ? spec.shape : 'blob';
    const eyes = EYES.includes(spec.eyes) ? spec.eyes : 'gewoon';
    const mouth = MOUTHS.includes(spec.mouth) ? spec.mouth : 'lach';
    const hat = HATS.includes(spec.hat) ? spec.hat : 'geen';
    const stroke = darken(color, 40);

    return (
      `<svg viewBox="-5 -10 110 120" class="char-svg-inner" xmlns="http://www.w3.org/2000/svg">` +
      `<g stroke="${stroke}" stroke-width="3" fill="${color}">${bodyPath(shape)}</g>` +
      `<g>${eyesSvg(eyes)}</g>` +
      `<g>${mouthSvg(mouth)}</g>` +
      `<g>${hatSvg(hat, color)}</g>` +
      `</svg>`
    );
  }

  // Wikkel in een span zodat we 'm makkelijk in DOM kunnen plaatsen.
  function el(spec, cls) {
    const span = document.createElement('span');
    span.className = 'char-svg ' + (cls || '');
    span.innerHTML = render(spec);
    return span;
  }

  function randomSpec() {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    return {
      shape: pick(SHAPES),
      color: pick(COLORS),
      eyes: pick(EYES),
      mouth: pick(MOUTHS),
      hat: pick(HATS),
    };
  }

  window.Char = { render, el, randomSpec, SHAPES, EYES, MOUTHS, HATS, COLORS };
})();
