const { getRandomPair } = require('./gifPairs');
const make = require('./imposterFactory');
module.exports = make(getRandomPair, 'gif');
