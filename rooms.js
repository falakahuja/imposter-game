const { getRandomPair } = require('./public/wordPairs');

const rooms = new Map();

function generateRoomCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code;
  do {
    code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function createRoom(hostSocketId, hostName) {
  const code = generateRoomCode();
  const room = {
    code,
    hostId: hostSocketId,
    players: [{ id: hostSocketId, name: hostName }],
    state: 'lobby',
    totalRounds: 2,
  };
  rooms.set(code, room);
  return room;
}

function joinRoom(code, socketId, name) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found.' };
  if (room.state !== 'lobby') return { error: 'Game already in progress.' };
  room.players.push({ id: socketId, name });
  return { room };
}

function setRounds(code, socketId, rounds) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found.' };
  if (room.hostId !== socketId) return { error: 'Only the host can change round count.' };
  if (room.state !== 'lobby') return { error: 'Cannot change rounds after starting.' };
  room.totalRounds = Math.min(4, Math.max(1, parseInt(rounds, 10) || 2));
  return { room };
}

function startGame(code, requestingSocketId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found.' };
  if (room.hostId !== requestingSocketId) return { error: 'Only the host can start the game.' };
  if (room.players.length < 3) return { error: 'Need at least 3 players to start.' };

  const pair = getRandomPair();
  const imposterIndex = Math.floor(Math.random() * room.players.length);

  room.players.forEach((player, index) => {
    player.isImposter = index === imposterIndex;
    player.word = index === imposterIndex ? pair.imposter : pair.citizen;
  });

  room.state = 'playing';
  room.currentRound = 1;
  room.turnIndex = 0;
  room.clues = [];

  return { room };
}

function submitClue(code, socketId, clueText) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found.' };
  if (room.state !== 'playing') return { error: 'Game is not in progress.' };

  const currentPlayer = room.players[room.turnIndex];
  if (!currentPlayer || currentPlayer.id !== socketId) return { error: "It's not your turn." };
  if (!clueText || !clueText.trim()) return { error: 'Clue cannot be empty.' };

  room.clues.push({ round: room.currentRound, playerId: socketId, playerName: currentPlayer.name, clue: clueText.trim() });
  room.turnIndex++;
  let gameComplete = false;

  if (room.turnIndex >= room.players.length) {
    room.turnIndex = 0;
    room.currentRound++;
    if (room.currentRound > room.totalRounds) {
      room.state = 'voting';
      room.votes = {};
      gameComplete = true;
    }
  }

  return { room, gameComplete };
}

function submitVote(code, socketId, votedForId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found.' };
  if (room.state !== 'voting') return { error: 'Voting is not open right now.' };
  if (room.votes[socketId]) return { error: 'You already voted.' };
  if (!room.players.some(p => p.id === votedForId)) return { error: 'Invalid vote target.' };

  room.votes[socketId] = votedForId;
  const votesSoFar = Object.keys(room.votes).length;
  const allVoted = votesSoFar === room.players.length;

  let results = null;
  if (allVoted) {
    results = computeResults(room);
    room.state = 'finished';
  }

  return { room, votesSoFar, totalPlayers: room.players.length, allVoted, results };
}

function computeResults(room) {
  const tally = {};
  room.players.forEach(p => { tally[p.id] = 0; });
  Object.values(room.votes).forEach(votedForId => {
    if (tally[votedForId] === undefined) tally[votedForId] = 0;
    tally[votedForId]++;
  });

  const maxVotes = Math.max(...Object.values(tally));
  const topVoted = Object.keys(tally).filter(id => tally[id] === maxVotes);
  const imposter = room.players.find(p => p.isImposter);
  const citizenWord = room.players.find(p => !p.isImposter)?.word;
  const citizensWin = !!imposter && topVoted.length === 1 && topVoted[0] === imposter.id;

  return {
    tally,
    imposterId: imposter ? imposter.id : null,
    imposterName: imposter ? imposter.name : 'Unknown',
    citizenWord,
    imposterWord: imposter ? imposter.word : undefined,
    citizensWin,
  };
}

function resetRoom(code, socketId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found.' };
  if (room.hostId !== socketId) return { error: 'Only the host can start a new round.' };

  room.state = 'lobby';
  room.currentRound = undefined;
  room.turnIndex = 0;
  room.clues = [];
  room.votes = {};
  room.players.forEach(p => { delete p.word; delete p.isImposter; });

  return { room };
}

function removePlayer(socketId) {
  for (const room of rooms.values()) {
    const index = room.players.findIndex(p => p.id === socketId);
    if (index === -1) continue;

    room.players.splice(index, 1);

    if (room.players.length === 0) {
      rooms.delete(room.code);
      return { roomDeleted: true };
    }
    if (room.hostId === socketId) {
      room.hostId = room.players[0].id;
    }

    if ((room.state === 'playing' || room.state === 'voting') && room.players.length < 3) {
      room.state = 'lobby';
      room.currentRound = undefined;
      room.turnIndex = 0;
      room.clues = [];
      room.votes = {};
      room.players.forEach(p => { delete p.word; delete p.isImposter; });
      return { room, aborted: true };
    }

    if (room.state === 'playing') {
      if (index < room.turnIndex) room.turnIndex--;
      if (room.turnIndex >= room.players.length) {
        room.turnIndex = 0;
        room.currentRound = (room.currentRound || 1) + 1;
        if (room.currentRound > room.totalRounds) {
          room.state = 'voting';
          room.votes = {};
        }
      }
      return { room };
    }

    if (room.state === 'voting') {
      delete room.votes[socketId];
      const allVoted = Object.keys(room.votes).length === room.players.length;
      if (allVoted) {
        const results = computeResults(room);
        room.state = 'finished';
        return { room, results };
      }
      return { room };
    }

    return { room };
  }
  return null;
}

function getRoom(code) {
  return rooms.get(code);
}

module.exports = { createRoom, joinRoom, removePlayer, getRoom, startGame, submitClue, submitVote, setRounds, resetRoom };