const wordImposter = require('./wordImposter');
const gifImposter = require('./gifImposter');
const mostLikely = require('./mostLikely');
const registry = {
  'word-imposter': { id: 'word-imposter', name: 'Word Imposter', minPlayers: 3, maxPlayers: 12, defaultSettings: { rounds: 2 }, engine: wordImposter },
  'gif-imposter': { id: 'gif-imposter', name: 'GIF Imposter', minPlayers: 3, maxPlayers: 12, defaultSettings: { rounds: 2 }, engine: gifImposter },
  'most-likely': { id: 'most-likely', name: 'Most Likely To', minPlayers: 3, maxPlayers: 16, defaultSettings: { rounds: 1 }, engine: mostLikely },
};
function getMode(id) { return registry[id]; }
module.exports = { registry, getMode };
