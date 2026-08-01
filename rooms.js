const { getMode } = require('./modes');

const rooms = new Map();
const codeLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function makeCode() { let code; do { code = Array.from({ length: 4 }, () => codeLetters[Math.floor(Math.random() * codeLetters.length)]).join(''); } while (rooms.has(code)); return code; }
function publicRoom(room) {
  return { code: room.code, hostId: room.hostId, modeId: room.modeId, state: room.state, settings: room.settings,
    players: room.players.map(({ id, name }) => ({ id, name })) };
}
function createRoom(hostId, name, modeId) {
  const mode = getMode(modeId); if (!mode) return { error: 'That game is not available.' };
  const room = { code: makeCode(), hostId, modeId, players: [{ id: hostId, name }], state: 'lobby', settings: { ...mode.defaultSettings }, game: {} };
  rooms.set(room.code, room); return { room };
}
function joinRoom(code, id, name) {
  const room = rooms.get(code); if (!room) return { error: 'Room not found.' };
  const mode = getMode(room.modeId);
  if (room.state !== 'lobby') return { error: 'Game already in progress.' };
  if (room.players.length >= mode.maxPlayers) return { error: 'This room is full.' };
  room.players.push({ id, name }); return { room };
}
function updateSettings(code, actor, settings) {
  const room = rooms.get(code); if (!room) return { error: 'Room not found.' };
  if (room.hostId !== actor) return { error: 'Only the host can change settings.' };
  if (room.state !== 'lobby') return { error: 'Settings cannot be changed after starting.' };
  const mode = getMode(room.modeId); room.settings = mode.sanitizeSettings({ ...room.settings, ...settings }); return { room };
}
function startGame(code, actor) {
  const room = rooms.get(code); if (!room) return { error: 'Room not found.' };
  const mode = getMode(room.modeId);
  if (room.hostId !== actor) return { error: 'Only the host can start the game.' };
  if (room.players.length < mode.minPlayers) return { error: `Need at least ${mode.minPlayers} players to start.` };
  const result = mode.engine.startGame(room, room.settings) || {}; return { room, ...result };
}
function gameAction(code, actor, action, payload) {
  const room = rooms.get(code); if (!room) return { error: 'Room not found.' };
  if (!room.players.some(p => p.id === actor)) return { error: 'You are not in this room.' };
  const result = getMode(room.modeId).engine.handleAction(room, actor, action, payload || {}) || {};
  return { room, ...result };
}
function resetRoom(code, actor) {
  const room = rooms.get(code); if (!room) return { error: 'Room not found.' };
  if (room.hostId !== actor) return { error: 'Only the host can start a new session.' };
  getMode(room.modeId).engine.resetForReplay(room); return { room };
}
function removePlayer(id) {
  for (const room of rooms.values()) {
    const index = room.players.findIndex(p => p.id === id); if (index < 0) continue;
    room.players.splice(index, 1);
    if (!room.players.length) { rooms.delete(room.code); return { roomDeleted: true }; }
    if (room.hostId === id) room.hostId = room.players[0].id;
    const mode = getMode(room.modeId);
    const result = mode.engine.onPlayerRemoved(room, id, 'disconnect', { index }) || {};
    if (room.state !== 'lobby' && room.players.length < mode.minPlayers) { mode.engine.resetForReplay(room); result.aborted = true; }
    return { room, ...result };
  }
  return null;
}
module.exports = { createRoom, joinRoom, updateSettings, startGame, gameAction, resetRoom, removePlayer, publicRoom };
