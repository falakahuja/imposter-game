const createImposterEngine = require('./modes/imposter/engine');
const createMafiaEngine = require('./modes/mafia/engine');
const imposterConfig = require('./modes/imposter/config');
const mafiaConfig = require('./modes/mafia/config');

const modeRegistry = new Map([
  ['imposter', { engine: createImposterEngine(), config: imposterConfig }],
  ['mafia', { engine: createMafiaEngine(), config: mafiaConfig }],
]);

module.exports = modeRegistry;
