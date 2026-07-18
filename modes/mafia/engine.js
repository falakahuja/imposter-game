function createEngine() {
  function getAlivePlayerIds(room) {
    return room.players.filter((player) => player.alive !== false).map((player) => player.id);
  }

  function isAlive(room, playerId) {
    const player = room.players.find((entry) => entry.id === playerId);
    return !!player && player.alive !== false;
  }

  function getRoleCounts(room) {
    const alivePlayers = room.players.filter((player) => player.alive !== false);
    return {
      mafia: alivePlayers.filter((player) => player.role === 'Mafia').length,
      nonMafia: alivePlayers.filter((player) => player.role !== 'Mafia').length,
    };
  }

  function resolveMajorityTarget(room, actionType) {
    const state = room.modeState;
    const submissions = Object.entries(state.actions[actionType] || {}).map(([actorId, entry]) => ({ actorId, ...entry }));
    if (!submissions.length) return null;

    const mafiaSubmissions = submissions.filter((submission) => {
      const actor = room.players.find((player) => player.id === submission.actorId);
      return actor?.role === 'Mafia' && submission?.type === 'night-kill';
    });

    if (!mafiaSubmissions.length) return null;

    const tally = {};
    mafiaSubmissions.forEach((entry) => {
      if (!entry?.targetId) return;
      tally[entry.targetId] = (tally[entry.targetId] || 0) + 1;
    });

    const sortedTargets = Object.entries(tally).sort((a, b) => {
      if (b[1] - a[1] !== 0) return b[1] - a[1];
      const aIndex = mafiaSubmissions.findIndex((entry) => entry.targetId === a[0]);
      const bIndex = mafiaSubmissions.findIndex((entry) => entry.targetId === b[0]);
      return aIndex - bIndex;
    });

    return sortedTargets[0]?.[0] || null;
  }

  function startGame(room, settings) {
    const roleConfig = require('./config');
    const distribution = roleConfig.getRoleDistribution(room.players.length);
    const rolePool = [];

    Object.entries(distribution).forEach(([role, count]) => {
      for (let i = 0; i < count; i += 1) {
        rolePool.push(role);
      }
    });

    for (let i = rolePool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [rolePool[i], rolePool[j]] = [rolePool[j], rolePool[i]];
    }

    room.players.forEach((player, index) => {
      const role = rolePool[index];
      player.role = role;
      player.alive = true;
    });

    room.modeState = {
      phase: 'night',
      day: 1,
      round: 1,
      alivePlayerIds: getAlivePlayerIds(room),
      nightStartAlivePlayerIds: getAlivePlayerIds(room),
      roles: room.players.reduce((map, player) => {
        map[player.id] = player.role;
        return map;
      }, {}),
      actions: {
        night: {},
        dayVote: {},
      },
      pendingPhase: null,
      settings: {
        totalRounds: settings?.totalRounds ?? 0,
      },
    };

    return room.players.reduce((payloads, player) => {
      payloads[player.id] = { role: player.role };
      return payloads;
    }, {});
  }

  function handleAction(room, actor, action, payload) {
    const state = room.modeState;
    if (!state) {
      return { error: 'Game has not started.' };
    }

    const alivePlayers = getAlivePlayerIds(room);
    const actorIsAlive = alivePlayers.includes(actor.id);
    if (!actorIsAlive) {
      return { error: 'Dead players cannot act.' };
    }

    if (action === 'night-kill') {
      if (state.phase !== 'night') return { error: 'Night actions are not open.' };
      if (actor.role !== 'Mafia') return { error: 'Only Mafia can submit a night kill.' };
      const targetId = payload?.targetId;
      if (!targetId) return { error: 'A target is required.' };
      if (!isAlive(room, targetId)) return { error: 'Target must be alive.' };
      if (room.players.find((player) => player.id === targetId)?.role === 'Mafia') {
        return { error: 'Mafia cannot target another Mafia member.' };
      }

      state.actions.night[actor.id] = { type: 'night-kill', targetId };
      const result = checkPhaseComplete(room);
      return {
        room,
        broadcastPayload: {
          phase: state.phase,
          phaseChanged: result.phaseChanged,
          pendingPhase: result.pendingPhase,
          actionRecorded: true,
          actionType: 'night-kill',
          resolution: result.resolution,
        },
      };
    }

    if (action === 'night-investigate') {
      if (state.phase !== 'night') return { error: 'Night actions are not open.' };
      if (actor.role !== 'Detective') return { error: 'Only the Detective can investigate.' };
      const targetId = payload?.targetId;
      if (!targetId) return { error: 'A target is required.' };
      if (!isAlive(room, targetId)) return { error: 'Target must be alive.' };

      state.actions.night[actor.id] = { type: 'night-investigate', targetId };
      const result = checkPhaseComplete(room);
      return {
        room,
        broadcastPayload: {
          phase: state.phase,
          phaseChanged: result.phaseChanged,
          pendingPhase: result.pendingPhase,
          actionRecorded: true,
          actionType: 'night-investigate',
          resolution: result.resolution,
        },
      };
    }

    if (action === 'night-save') {
      if (state.phase !== 'night') return { error: 'Night actions are not open.' };
      if (actor.role !== 'Doctor') return { error: 'Only the Doctor can save.' };
      const targetId = payload?.targetId;
      if (!targetId) return { error: 'A target is required.' };
      if (!isAlive(room, targetId)) return { error: 'Target must be alive.' };

      state.actions.night[actor.id] = { type: 'night-save', targetId };
      const result = checkPhaseComplete(room);
      return {
        room,
        broadcastPayload: {
          phase: state.phase,
          phaseChanged: result.phaseChanged,
          pendingPhase: result.pendingPhase,
          actionRecorded: true,
          actionType: 'night-save',
          resolution: result.resolution,
        },
      };
    }

    if (action === 'day-vote') {
      if (state.phase === 'day-discussion' && state.pendingPhase === 'day-vote') {
        state.phase = 'day-vote';
        state.pendingPhase = null;
      }
      if (state.phase !== 'day-vote') return { error: 'Day voting is not open.' };
      const targetId = payload?.targetId;
      if (!targetId) return { error: 'A target is required.' };
      if (!isAlive(room, targetId)) return { error: 'Target must be alive.' };

      state.actions.dayVote[actor.id] = { type: 'day-vote', targetId };
      const result = checkPhaseComplete(room);
      return {
        room,
        broadcastPayload: {
          phase: state.phase,
          phaseChanged: result.phaseChanged,
          pendingPhase: result.pendingPhase,
          actionRecorded: true,
          actionType: 'day-vote',
          resolution: result.resolution,
        },
      };
    }

    return { error: 'Unknown action.' };
  }

  function checkPhaseComplete(room) {
    const state = room.modeState;
    if (!state) return { phaseChanged: false, pendingPhase: null };

    if (state.phase === 'night') {
      const nightStartAliveIds = state.nightStartAlivePlayerIds || getAlivePlayerIds(room);
      const mafiaRequired = nightStartAliveIds
        .map((id) => room.players.find((player) => player.id === id))
        .filter((player) => player?.role === 'Mafia');
      const detectiveRequired = nightStartAliveIds
        .map((id) => room.players.find((player) => player.id === id))
        .find((player) => player?.role === 'Detective');
      const doctorRequired = nightStartAliveIds
        .map((id) => room.players.find((player) => player.id === id))
        .find((player) => player?.role === 'Doctor');
      const killTargetId = resolveMajorityTarget(room, 'night');

      const mafiaDone = mafiaRequired.every((player) => state.actions.night[player.id]);
      const detectiveDone = !detectiveRequired || !!state.actions.night[detectiveRequired.id] || detectiveRequired.id === killTargetId;
      const doctorDone = !doctorRequired || !!state.actions.night[doctorRequired.id] || doctorRequired.id === killTargetId;

      if (mafiaDone && detectiveDone && doctorDone) {
        const resolved = resolveNightPhase(room);
        state.phase = 'day-discussion';
        state.pendingPhase = 'day-vote';
        return {
          phaseChanged: true,
          pendingPhase: state.pendingPhase,
          resolution: resolved,
        };
      }

      return { phaseChanged: false, pendingPhase: null };
    }

    if (state.phase === 'day-vote') {
      const aliveIds = getAlivePlayerIds(room);
      const votesDone = aliveIds.every((id) => state.actions.dayVote[id]);
      if (votesDone) {
        const resolved = resolveDayVote(room);
        if (!resolved.winner) {
          state.phase = 'night';
          state.day += 1;
          state.round += 1;
          state.pendingPhase = 'night';
          state.nightStartAlivePlayerIds = getAlivePlayerIds(room);
          state.actions = { night: {}, dayVote: {} };
        }
        return {
          phaseChanged: true,
          pendingPhase: state.phase,
          resolution: resolved,
        };
      }
      return { phaseChanged: false, pendingPhase: null };
    }

    return { phaseChanged: false, pendingPhase: null };
  }

  function resolveNightPhase(room) {
    const state = room.modeState;
    const mafiaAlive = room.players.filter((player) => player.alive !== false && player.role === 'Mafia');
    const nightStartAliveIds = state.nightStartAlivePlayerIds || getAlivePlayerIds(room);
    const detectiveActor = nightStartAliveIds
      .map((id) => room.players.find((player) => player.id === id))
      .find((player) => player?.role === 'Detective');
    const doctorActor = nightStartAliveIds
      .map((id) => room.players.find((player) => player.id === id))
      .find((player) => player?.role === 'Doctor');
    const killTargetId = resolveMajorityTarget(room, 'night');
    const doctorSaveTargetId = doctorActor ? state.actions.night[doctorActor.id]?.targetId : null;
    const detectiveAction = detectiveActor ? state.actions.night[detectiveActor.id] : null;
    const detectiveTargetId = detectiveAction?.targetId || null;

    let victimId = null;
    let blocked = false;

    if (killTargetId && doctorSaveTargetId === killTargetId) {
      blocked = true;
    } else if (killTargetId) {
      victimId = killTargetId;
      const victim = room.players.find((player) => player.id === victimId);
      if (victim) {
        victim.alive = false;
      }
    }

    const aliveIds = getAlivePlayerIds(room);
    state.alivePlayerIds = aliveIds.filter((id) => id !== victimId);

    const detectiveResult = detectiveAction
      ? {
          targetId: detectiveTargetId,
          role: detectiveTargetId ? room.players.find((player) => player.id === detectiveTargetId)?.role : null,
          isMafia: detectiveTargetId ? room.players.find((player) => player.id === detectiveTargetId)?.role === 'Mafia' : null,
        }
      : null;

    if (detectiveActor && detectiveAction) {
      state.privatePayloads = {
        ...(state.privatePayloads || {}),
        [detectiveActor.id]: detectiveResult,
      };
    }

    const winner = checkWinConditions(room);

    return {
      victimId,
      blocked,
      detectiveResult,
      winner,
      mafiaTargetId: killTargetId,
      mafiaAliveCount: mafiaAlive.length,
    };
  }

  function resolveDayVote(room) {
    const state = room.modeState;
    const submissions = Object.values(state.actions.dayVote || {});
    if (!submissions.length) {
      return { victimId: null, winner: null };
    }

    const tally = {};
    submissions.forEach((entry) => {
      if (!entry?.targetId) return;
      tally[entry.targetId] = (tally[entry.targetId] || 0) + 1;
    });

    const sortedTargets = Object.entries(tally).sort((a, b) => {
      if (b[1] - a[1] !== 0) return b[1] - a[1];
      const aIndex = submissions.findIndex((entry) => entry.targetId === a[0]);
      const bIndex = submissions.findIndex((entry) => entry.targetId === b[0]);
      return aIndex - bIndex;
    });

    const victimId = sortedTargets[0]?.[0] || null;
    if (victimId) {
      const victim = room.players.find((player) => player.id === victimId);
      if (victim) {
        victim.alive = false;
      }
    }

    state.alivePlayerIds = getAlivePlayerIds(room);
    const winner = checkWinConditions(room);

    return { victimId, winner };
  }

  function checkWinConditions(room) {
    const counts = getRoleCounts(room);
    if (counts.mafia === 0) {
      return { winner: 'villagers', roles: room.players.reduce((map, player) => {
        map[player.id] = player.role;
        return map;
      }, {}) };
    }
    if (counts.mafia >= counts.nonMafia) {
      return { winner: 'mafia', roles: room.players.reduce((map, player) => {
        map[player.id] = player.role;
        return map;
      }, {}) };
    }
    return null;
  }

  function onPlayerRemoved() {
    return { aborted: false, room: null };
  }

  function getResults(room) {
    return checkWinConditions(room) || { winner: null, roles: room.players.reduce((map, player) => {
      map[player.id] = player.role;
      return map;
    }, {}) };
  }

  function resetForReplay(room) {
    room.state = 'lobby';
    room.modeState = null;
    room.players.forEach((player) => {
      delete player.role;
      delete player.alive;
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
