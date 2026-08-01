function createImposterEngine(getPair, label) {
  function getResults(room) {
    const tally = Object.fromEntries(room.players.map(p => [p.id, 0]));
    Object.values(room.game.votes || {}).forEach(id => { if (id in tally) tally[id]++; });
    const max = Math.max(...Object.values(tally)); const top = Object.keys(tally).filter(id => tally[id] === max);
    const imposter = room.players.find(p => p.id === room.game.imposterId);
    return { kind: 'imposter-results', tally, imposterId: imposter?.id, imposterName: imposter?.name || 'Unknown',
      citizenItem: room.game.citizenItem, imposterItem: room.game.imposterItem, citizensWin: top.length === 1 && top[0] === imposter?.id, label };
  }
  function publicState(room) { return { kind: 'imposter', phase: room.state, clues: room.game.clues || [], currentRound: room.game.currentRound, totalRounds: room.settings.rounds, currentPlayerId: room.state === 'playing' ? room.players[room.game.turnIndex]?.id : null, votesSoFar: Object.keys(room.game.votes || {}).length, totalPlayers: room.players.length }; }
  return {
    sanitizeSettings(s) { return { rounds: Math.min(4, Math.max(1, Number(s.rounds) || 2)) }; },
    startGame(room) { const pair = getPair(); const imposter = room.players[Math.floor(Math.random() * room.players.length)]; room.state = 'playing'; room.game = { imposterId: imposter.id, citizenItem: pair.citizen, imposterItem: pair.imposter, currentRound: 1, turnIndex: 0, clues: [], votes: {} }; return { privateAssignments: room.players.map(p => ({ playerId: p.id, item: p.id === imposter.id ? pair.imposter : pair.citizen, label })), publicState: publicState(room) }; },
    handleAction(room, actor, action, payload) {
      if (action === 'clue') { if (room.state !== 'playing') return { error: 'The clue phase is not open.' }; const player = room.players[room.game.turnIndex]; if (!player || player.id !== actor) return { error: "It's not your turn." }; const clue = String(payload.clue || '').trim(); if (!clue) return { error: 'Clue cannot be empty.' }; room.game.clues.push({ round: room.game.currentRound, playerId: actor, playerName: player.name, clue }); room.game.turnIndex++; if (room.game.turnIndex >= room.players.length) { room.game.turnIndex = 0; room.game.currentRound++; if (room.game.currentRound > room.settings.rounds) { room.state = 'voting'; room.game.votes = {}; } } return { publicState: publicState(room) }; }
      if (action === 'vote') { if (room.state !== 'voting') return { error: 'Voting is not open right now.' }; if (room.game.votes[actor]) return { error: 'You already voted.' }; if (!room.players.some(p => p.id === payload.votedForId)) return { error: 'Invalid vote target.' }; room.game.votes[actor] = payload.votedForId; if (Object.keys(room.game.votes).length === room.players.length) { room.state = 'finished'; return { publicState: publicState(room), results: getResults(room) }; } return { publicState: publicState(room) }; }
      return { error: 'Unknown game action.' };
    },
    onPlayerRemoved(room, id, reason, { index }) { if (room.state === 'playing') { if (index < room.game.turnIndex) room.game.turnIndex--; if (room.game.turnIndex >= room.players.length) room.game.turnIndex = 0; } if (room.state === 'voting') { delete room.game.votes[id]; if (Object.keys(room.game.votes).length === room.players.length) { room.state = 'finished'; return { results: getResults(room) }; } } return { publicState: publicState(room) }; },
    getResults, resetForReplay(room) { room.state = 'lobby'; room.game = {}; }, getPublicState: publicState,
  };
}
module.exports = createImposterEngine;
