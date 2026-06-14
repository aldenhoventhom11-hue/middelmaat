'use strict';

// Registry van alle 10 minigames. De engine kiest hier willekeurig 5 uit.
const modules = [
  require('./berenrace'), // 1
  require('./doolhof'), // 2
  require('./ballon'), // 3
  require('./verdeelheers'), // 4
  require('./gemiddeldgetal'), // 5
  require('./schermstaren'), // 6
  require('./tikkampioen'), // 7
  require('./pizzapunt'), // 8
  require('./blindeschutter'), // 9
  require('./cirkeltrek'), // 10
  require('./lift'), // 11
  require('./toren'), // 12
  require('./schatten'), // 13
  require('./bier'), // 14
  require('./raket'), // 15
  require('./dobbel'), // 16
  require('./haaien'), // 17
  require('./sprint'), // 18
  require('./golf'), // 19
  require('./kapper'), // 20
  require('./hooghouden'), // 21
];

// Emoji per minigame (voor het rad en de intro-kaart).
const EMOJI = {
  berenrace: '🐻',
  doolhof: '🌀',
  ballon: '🎈',
  verdeelheers: '😈',
  gemiddeldgetal: '🔢',
  schermstaren: '👁️',
  tikkampioen: '👆',
  pizzapunt: '🍕',
  blindeschutter: '🎯',
  cirkeltrek: '⭕',
  lift: '🛗',
  toren: '🧱',
  schatten: '🫙',
  bier: '🍺',
  raket: '🚀',
  dobbel: '🎲',
  haaien: '🦈',
  sprint: '🏃',
  golf: '⛳',
  kapper: '✂️',
  hooghouden: '🏓',
};

const minigames = new Map();
for (const m of modules) {
  if (minigames.has(m.id)) throw new Error('Dubbele minigame-id: ' + m.id);
  m.emoji = EMOJI[m.id] || '🎮';
  minigames.set(m.id, m);
}

module.exports = { minigames };
