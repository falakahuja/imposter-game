function getRoleDistribution(playerCount) {
  const mafiaCount = Math.max(1, Math.floor(playerCount / 4));
  const detectiveCount = playerCount >= 5 ? 1 : 0;
  const doctorCount = playerCount >= 6 ? 1 : 0;
  const villagerCount = Math.max(0, playerCount - mafiaCount - detectiveCount - doctorCount);

  return {
    Mafia: mafiaCount,
    Detective: detectiveCount,
    Doctor: doctorCount,
    Villager: villagerCount,
  };
}

module.exports = {
  minPlayers: 5,
  maxPlayers: 12,
  defaultSettings: {
    totalRounds: 0,
  },
  getRoleDistribution,
};
