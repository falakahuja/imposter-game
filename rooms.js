const modeRegistry = require('./modeRegistry');

const rooms = new Map();

function getModeEntry(mode) {
  return modeRegistry.get(mode || 'imposter');
}

function generateRoomCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code;
  do {
    code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function createRoom(hostSocketId, hostName, mode = 'imposter') {
  const code = generateRoomCode();
  const modeEntry = getModeEntry(mode);
  const room = {
    code,
    hostId: hostSocketId,
    players: [{ id: hostSocketId, name: hostName }],
    state: 'lobby',
    totalRounds: modeEntry?.config?.defaultSettings?.totalRounds ?? 2,
    mode: modeEntry ? mode : 'imposter',
    modeState: null,
  };
  if (!modeEntry) {
    room.mode = 'imposter';
  }
  rooms.set(code, room);
  return room;
}

function joinRoom(code, socketId, name) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found.' };
  if (room.state !== 'lobby') return { error: 'Game already in progress.' };
  const modeEntry = getModeEntry(room.mode);
  if (modeEntry?.config?.maxPlayers && room.players.length >= modeEntry.config.maxPlayers) {
    return { error: 'Room is full.' };
  }
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

  const modeEntry = getModeEntry(room.mode);
  if (!modeEntry) return { error: 'Unsupported game mode.' };
  if (room.players.length < (modeEntry.config?.minPlayers ?? 3)) {
    return { error: `Need at least ${modeEntry.config?.minPlayers ?? 3} players to start.` };
  }

  room.state = 'playing';
  const privatePayloads = modeEntry.engine.startGame(room, { totalRounds: room.totalRounds });
  return { room, privatePayloads };
}

function handleGameAction(code, socketId, action, payload) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found.' };

  const actor = room.players.find((player) => player.id === socketId);
  if (!actor) return { error: 'Player not found in room.' };

  const modeEntry = getModeEntry(room.mode);
  if (!modeEntry) return { error: 'Unsupported game mode.' };
  return modeEntry.engine.handleAction(room, actor, action, payload);
}

function resetRoom(code, socketId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found.' };
  if (room.hostId !== socketId) return { error: 'Only the host can start a new round.' };

  const modeEntry = getModeEntry(room.mode);
  if (!modeEntry) return { error: 'Unsupported game mode.' };
  modeEntry.engine.resetForReplay(room);
  return { room };
}

function removePlayer(socketId) {
  for (const room of rooms.values()) {
    const index = room.players.findIndex((player) => player.id === socketId);
    if (index === -1) continue;

    const modeEntry = getModeEntry(room.mode);
    const result = modeEntry?.engine?.onPlayerRemoved(room, socketId, 'disconnected', {}) || { aborted: false, room };

    if (result.roomDeleted) {
      rooms.delete(room.code);
      return { roomDeleted: true };
    }

    if (room.players.length === 0) {
      rooms.delete(room.code);
      return { roomDeleted: true };
    }

    if (room.hostId === socketId) {
      room.hostId = room.players[0]?.id;
    }

    return { room, aborted: result.aborted, results: result.results };
  }
  return null;
}

function getRoom(code) {
  return rooms.get(code);
}

module.exports = { createRoom, joinRoom, removePlayer, getRoom, startGame, handleGameAction, setRounds, resetRoom };