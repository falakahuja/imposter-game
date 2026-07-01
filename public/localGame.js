function createLocalGame(names) {
  const pair = WordPairs.getRandomPair();
  const imposterIndex = Math.floor(Math.random() * names.length);

  const players = names.map((name, index) => ({
    name,
    isImposter: index === imposterIndex,
    word: index === imposterIndex ? pair.imposter : pair.citizen,
  }));

  return { players };
}

function computeLocalResults(players, accusedIndex) {
  const imposterIndex = players.findIndex((p) => p.isImposter);
  const citizensWin = accusedIndex === imposterIndex;

  return {
    citizensWin,
    imposterName: players[imposterIndex].name,
    citizenWord: players.find((p) => !p.isImposter).word,
    imposterWord: players[imposterIndex].word,
  };
}