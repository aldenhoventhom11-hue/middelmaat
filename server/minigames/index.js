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
];

const minigames = new Map();
for (const m of modules) {
  if (minigames.has(m.id)) throw new Error('Dubbele minigame-id: ' + m.id);
  minigames.set(m.id, m);
}

module.exports = { minigames };
