const promptPairs = [
  { citizen: 'Who is most likely to become famous?', imposter: 'Who is most likely to become a millionaire?' },
  { citizen: 'Who is most likely to survive a zombie apocalypse?', imposter: 'Who is most likely to survive alone in the wilderness?' },
  { citizen: 'Who is most likely to be late to their own wedding?', imposter: 'Who is most likely to forget an important birthday?' },
  { citizen: 'Who is most likely to start a business?', imposter: 'Who is most likely to quit their job and travel the world?' },
  { citizen: 'Who is most likely to win a reality show?', imposter: 'Who is most likely to go viral online?' },
  { citizen: 'Who is most likely to laugh at the worst possible moment?', imposter: 'Who is most likely to tell a terrible joke with confidence?' },
  { citizen: 'Who is most likely to accidentally join a meeting on mute?', imposter: 'Who is most likely to send a message to the wrong group chat?' },
  { citizen: 'Who is most likely to become a meme?', imposter: 'Who is most likely to have a viral dance?' },
  { citizen: 'Who is most likely to order dessert first?', imposter: 'Who is most likely to steal fries from everyone else?' },
  { citizen: 'Who is most likely to get lost in their own neighborhood?', imposter: 'Who is most likely to miss a flight?' },
  { citizen: 'Who is most likely to talk their way out of trouble?', imposter: 'Who is most likely to win an argument with a toddler?' },
  { citizen: 'Who is most likely to survive a haunted house?', imposter: 'Who is most likely to scream first in a horror film?' },
  { citizen: 'Who is most likely to start a dance party?', imposter: 'Who is most likely to sing karaoke without being asked?' },
  { citizen: 'Who is most likely to become a secret agent?', imposter: 'Who is most likely to be terrible at keeping a secret?' },
  { citizen: 'Who is most likely to adopt too many pets?', imposter: 'Who is most likely to name every stray animal they see?' },
  { citizen: 'Who is most likely to fall asleep during a movie?', imposter: 'Who is most likely to spoil the ending of a movie?' },
];

function publicState(room) {
  return { kind: 'most-likely-imposter', phase: room.state, round: room.game.round, totalRounds: room.settings.rounds,
    picksSoFar: Object.keys(room.game.picks || {}).length, votesSoFar: Object.keys(room.game.votes || {}).length, totalPlayers: room.players.length,
    answers: room.state === 'discussion' || room.state === 'voting' || room.state === 'finished' ? Object.entries(room.game.picks || {}).map(([playerId, pickedId]) => ({ playerId, pickedId })) : [] };
}
function getResults(room) {
  const tally = Object.fromEntries(room.players.map(p => [p.id, 0]));
  Object.values(room.game.votes || {}).forEach(id => { if (id in tally) tally[id]++; });
  const maximum = Math.max(...Object.values(tally)); const top = Object.keys(tally).filter(id => tally[id] === maximum);
  const imposter = room.players.find(p => p.id === room.game.imposterId);
  return { kind: 'most-likely-imposter-results', tally, answers: publicState(room).answers, imposterId: imposter?.id, imposterName: imposter?.name || 'Unknown', citizensWin: top.length === 1 && top[0] === imposter?.id, citizenQuestion: room.game.citizenQuestion, imposterQuestion: room.game.imposterQuestion, round: room.game.round, totalRounds: room.settings.rounds };
}
function startRound(room) {
  const pair = promptPairs[Math.floor(Math.random() * promptPairs.length)]; const imposter = room.players[Math.floor(Math.random() * room.players.length)];
  room.state = 'picking'; room.game.imposterId = imposter.id; room.game.citizenQuestion = pair.citizen; room.game.imposterQuestion = pair.imposter; room.game.picks = {}; room.game.votes = {};
  return { privateAssignments: room.players.map(p => ({ playerId: p.id, label: 'question', item: p.id === imposter.id ? pair.imposter : pair.citizen })), publicState: publicState(room) };
}
module.exports = {
  sanitizeSettings() { return { rounds: 1 }; },
  startGame(room) { room.game = { round: 1 }; return startRound(room); },
  handleAction(room, actor, action, payload) {
    if (action === 'pick') { if (room.state !== 'picking') return { error: 'Answers are not open.' }; if (room.game.picks[actor]) return { error: 'You already answered.' }; if (!room.players.some(p => p.id === payload.playerId)) return { error: 'Invalid player.' }; room.game.picks[actor] = payload.playerId; if (Object.keys(room.game.picks).length === room.players.length) room.state = 'discussion'; return { publicState: publicState(room) }; }
    if (action === 'start-vote') { if (room.hostId !== actor) return { error: 'Only the host can start voting.' }; if (room.state !== 'discussion') return { error: 'Discussion is not active.' }; room.state = 'voting'; return { publicState: publicState(room) }; }
    if (action === 'vote') { if (room.state !== 'voting') return { error: 'Voting is not open.' }; if (room.game.votes[actor]) return { error: 'You already voted.' }; if (!room.players.some(p => p.id === payload.playerId)) return { error: 'Invalid player.' }; room.game.votes[actor] = payload.playerId; if (Object.keys(room.game.votes).length === room.players.length) { room.state = 'finished'; return { publicState: publicState(room), results: getResults(room) }; } return { publicState: publicState(room) }; }
    if (action === 'next-round') { if (room.hostId !== actor) return { error: 'Only the host can continue.' }; if (room.state !== 'finished') return { error: 'Finish voting first.' }; if (room.game.round >= room.settings.rounds) return { publicState: publicState(room), sessionComplete: true }; room.game.round++; return startRound(room); }
    return { error: 'Unknown game action.' };
  },
  onPlayerRemoved(room, id) { delete room.game.picks?.[id]; delete room.game.votes?.[id]; if (room.state === 'picking' && Object.keys(room.game.picks).length === room.players.length) room.state = 'discussion'; if (room.state === 'voting' && Object.keys(room.game.votes).length === room.players.length) { room.state = 'finished'; return { publicState: publicState(room), results: getResults(room) }; } return { publicState: publicState(room) }; },
  getResults, resetForReplay(room) { room.state = 'lobby'; room.game = {}; }, getPublicState: publicState,
};
