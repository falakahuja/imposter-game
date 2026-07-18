const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const {
  createRoom, joinRoom, removePlayer, getRoom,
  startGame, handleGameAction, setRounds, resetRoom,
} = require('./rooms');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  socket.on('create-room', ({ name, mode }) => {
    const room = createRoom(socket.id, name, mode);
    socket.join(room.code);
    socket.emit('room-joined', room);
  });

  socket.on('join-room', ({ code, name }) => {
    const result = joinRoom(code.toUpperCase(), socket.id, name);
    if (result.error) return socket.emit('join-error', { message: result.error });
    socket.join(result.room.code);
    socket.emit('room-joined', result.room);
    socket.to(result.room.code).emit('room-updated', result.room);
  });

  socket.on('set-rounds', ({ code, rounds }) => {
    const result = setRounds(code, socket.id, rounds);
    if (result.error) return socket.emit('start-error', { message: result.error });
    io.to(result.room.code).emit('room-updated', result.room);
  });

  socket.on('start-game', ({ code }) => {
    const result = startGame(code, socket.id);
    if (result.error) return socket.emit('start-error', { message: result.error });

    const room = result.room;
    room.players.forEach((player) => {
      const privatePayload = result.privatePayloads?.[player.id];
      const isMafiaMode = room.mode === 'mafia';
      io.to(player.id).emit('your-word', {
        word: privatePayload?.word ?? privatePayload?.role ?? player.word,
        mode: room.mode,
        role: privatePayload?.role ?? null,
      });
    });
    io.to(room.code).emit('game-started', {
      code: room.code,
      players: room.players.map((player) => ({ id: player.id, name: player.name })),
      mode: room.mode,
      ...(room.mode === 'imposter' ? {
        currentPlayerId: room.players[room.modeState.turnIndex].id,
        currentRound: room.modeState.currentRound,
        totalRounds: room.modeState.settings.totalRounds,
      } : {}),
    });
  });

  socket.on('game-action', ({ code, action, payload }) => {
    const result = handleGameAction(code, socket.id, action, payload);
    if (result.error) {
      if (action === 'submit-clue') return socket.emit('clue-error', { message: result.error });
      if (action === 'submit-vote') return socket.emit('vote-error', { message: result.error });
      return socket.emit('game-action-error', { message: result.error });
    }

    const room = result.room;
    if (room.mode === 'mafia') {
      const payload = {
        room,
        resolution: result.broadcastPayload?.resolution || null,
      };
      io.to(room.code).emit('room-updated', payload);
      if (result.broadcastPayload?.resolution?.winner) {
        io.to(room.code).emit('game-results', {
          winner: result.broadcastPayload.resolution.winner.winner,
          roles: result.broadcastPayload.resolution.winner.roles,
        });
      }
      return;
    }

    if (action === 'submit-clue') {
      io.to(room.code).emit('clue-submitted', result.broadcastPayload);
      return;
    }

    if (action === 'submit-vote') {
      io.to(code).emit('vote-progress', {
        votesSoFar: result.broadcastPayload.votesSoFar,
        totalPlayers: result.broadcastPayload.totalPlayers,
      });
      if (result.broadcastPayload.allVoted) io.to(code).emit('game-results', result.broadcastPayload.results);
      return;
    }
  });

  socket.on('play-again', ({ code }) => {
    const result = resetRoom(code, socket.id);
    if (result.error) return socket.emit('start-error', { message: result.error });
    io.to(result.room.code).emit('room-reset', result.room);
  });

  socket.on('disconnect', () => {
    const result = removePlayer(socket.id);
    if (!result || result.roomDeleted) return;

    const room = result.room;

    if (result.aborted) {
      io.to(room.code).emit('game-aborted', {
        room,
        message: 'A player left and there are not enough players to continue. Back to the lobby.',
      });
      return;
    }

    io.to(room.code).emit('room-updated', room);

    if (result.results) {
      io.to(room.code).emit('game-results', result.results);
      return;
    }
    if (room.state === 'playing') {
      io.to(room.code).emit('clue-submitted', {
        clues: room.modeState?.clues || [],
        currentRound: room.modeState?.currentRound || 1,
        totalRounds: room.modeState?.settings?.totalRounds || room.totalRounds,
        currentPlayerId: room.players[room.modeState?.turnIndex || 0]?.id || null,
        gameComplete: false,
      });
    }
    if (room.state === 'voting') {
      io.to(room.code).emit('vote-progress', {
        votesSoFar: Object.keys(room.modeState?.votes || {}).length,
        totalPlayers: room.players.length,
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});