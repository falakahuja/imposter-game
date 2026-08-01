const { getRandomPair } = require('../public/wordPairs');
const make = require('./imposterFactory');
module.exports = make(getRandomPair, 'word');
