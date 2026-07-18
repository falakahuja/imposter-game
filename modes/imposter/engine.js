const { getRandomPair } = require('../../public/wordPairs');

function createEngine() {
  function startGame(room, settings) {
    const pair = getRandomPair();
    const imposterIndex = Math.floor(Math.random() * room.players.length);

    room.players.forEach((player, index) => {
      player.isImposter = index === imposterIndex;
      player.word = index === imposterIndex ? pair.imposter : pair.citizen;
    });

    room.modeState = {
      currentRound: 1,
      turnIndex: 0,
      clues: [],
      votes: {},
      settings: {
        totalRounds: settings?.totalRounds ?? 2,
      },
    };

    return room.players.reduce((payloads, player) => {
      payloads[player.id] = { word: player.word, isImposter: player.isImposter };
      return payloads;
    }, {});
  }

  function handleAction(room, actor, action, payload) {
    const state = room.modeState;
    if (!state) {
      return { error: 'Game has not started.' };
    }

    if (action === 'submit-clue') {
      if (room.state !== 'playing') {
        return { error: 'Game is not in progress.' };
      }

      const clueText = payload?.clue;
      const currentPlayer = room.players[state.turnIndex];
      if (!currentPlayer || currentPlayer.id !== actor.id) {
        return { error: "It's not your turn." };
      }
      if (!clueText || !clueText.trim()) {
        return { error: 'Clue cannot be empty.' };
      }

      state.clues.push({
        round: state.currentRound,
        playerId: actor.id,
        playerName: actor.name,
        clue: clueText.trim(),
      });

      state.turnIndex += 1;
      let gameComplete = false;

      if (state.turnIndex >= room.players.length) {
        state.turnIndex = 0;
        state.currentRound += 1;
        if (state.currentRound > state.settings.totalRounds) {
          room.state = 'voting';
          state.votes = {};
          gameComplete = true;
        }
      }

      const phaseComplete = checkPhaseComplete(room);

      return {
        room,
        broadcastPayload: {
          clues: state.clues,
          currentRound: state.currentRound,
          totalRounds: state.settings.totalRounds,
          currentPlayerId: room.state === 'playing' ? room.players[state.turnIndex]?.id ?? null : null,
          gameComplete,
          phaseComplete,
        },
      };
    }

    if (action === 'submit-vote') {
      if (room.state !== 'voting') {
        return { error: 'Voting is not open right now.' };
      }

      const votedForId = payload?.votedForId;
      if (!room.players.some((p) => p.id === votedForId)) {
        return { error: 'Invalid vote target.' };
      }
      if (state.votes[actor.id]) {
        return { error: 'You already voted.' };
      }

      state.votes[actor.id] = votedForId;
      const votesSoFar = Object.keys(state.votes).length;
      const allVoted = votesSoFar === room.players.length;

      let results = null;
      if (allVoted) {
        results = getResults(room);
        room.state = 'finished';
      }

      const phaseComplete = checkPhaseComplete(room);

      return {
        room,
        broadcastPayload: {
          votesSoFar,
          totalPlayers: room.players.length,
          allVoted,
          results,
          phaseComplete,
        },
      };
    }

    return { error: 'Unknown action.' };
  }

  function checkPhaseComplete(room) {
    return room.state === 'voting' || room.state === 'finished';
  }

  function onPlayerRemoved(room, playerId, reason, payload) {
    const index = room.players.findIndex((player) => player.id === playerId);
    if (index === -1) {
      return { aborted: false, room };
    }

    room.players.splice(index, 1);

    if (room.players.length === 0) {
      return { aborted: false, room, roomDeleted: true };
    }

    if (room.hostId === playerId) {
      room.hostId = room.players[0]?.id;
    }

    if (!room.modeState) {
      return { aborted: false, room };
    }

    if ((room.state === 'playing' || room.state === 'voting') && room.players.length < 3) {
      room.state = 'lobby';
      resetForReplay(room);
      return { aborted: true, room };
    }

    if (room.state === 'playing') {
      const state = room.modeState;
      if (index < state.turnIndex) {
        state.turnIndex -= 1;
      }
      if (state.turnIndex >= room.players.length) {
        state.turnIndex = 0;
        state.currentRound = (state.currentRound || 1) + 1;
        if (state.currentRound > state.settings.totalRounds) {
          room.state = 'voting';
          state.votes = {};
        }
      }
      return { aborted: false, room };
    }

    if (room.state === 'voting') {
      delete room.modeState.votes[playerId];
      const allVoted = Object.keys(room.modeState.votes).length === room.players.length;
      if (allVoted) {
        const results = getResults(room);
        room.state = 'finished';
        return { aborted: false, room, results };
      }
      return { aborted: false, room };
    }

    return { aborted: false, room };
  }

  function getResults(room) {
    const state = room.modeState;
    const tally = {};
    room.players.forEach((player) => {
      tally[player.id] = 0;
    });
    Object.values(state?.votes || {}).forEach((votedForId) => {
      if (tally[votedForId] === undefined) tally[votedForId] = 0;
      tally[votedForId] += 1;
    });

    const maxVotes = Math.max(...Object.values(tally));
    const topVoted = Object.keys(tally).filter((id) => tally[id] === maxVotes);
    const imposter = room.players.find((player) => player.isImposter);
    const citizenWord = room.players.find((player) => !player.isImposter)?.word;

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

  function resetForReplay(room) {
    room.state = 'lobby';
    room.modeState = null;
    room.players.forEach((player) => {
      delete player.word;
      delete player.isImposter;
    });
  }

  return {
    startGame,
    handleAction,
    checkPhaseComplete,
    onPlayerRemoved,
    getResults,
    resetForReplay,
  };
}

module.exports = createEngine;
