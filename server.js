const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const {
  createRoom, joinRoom, removePlayer, getRoom,
  startGame, submitClue, submitVote, setRounds, resetRoom,
} = require('./rooms');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  socket.on('create-room', ({ name }) => {
    const room = createRoom(socket.id, name);
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
    room.players.forEach((player) => io.to(player.id).emit('your-word', { word: player.word }));
    io.to(room.code).emit('game-started', {
      code: room.code,
      players: room.players.map(p => ({ id: p.id, name: p.name })),
      currentPlayerId: room.players[room.turnIndex].id,
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
    });
  });

  socket.on('submit-clue', ({ code, clue }) => {
    const result = submitClue(code, socket.id, clue);
    if (result.error) return socket.emit('clue-error', { message: result.error });

    const room = result.room;
    io.to(room.code).emit('clue-submitted', {
      clues: room.clues,
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      currentPlayerId: room.state === 'playing' ? room.players[room.turnIndex].id : null,
      gameComplete: result.gameComplete,
    });
  });

  socket.on('submit-vote', ({ code, votedForId }) => {
    const result = submitVote(code, socket.id, votedForId);
    if (result.error) return socket.emit('vote-error', { message: result.error });

    io.to(code).emit('vote-progress', { votesSoFar: result.votesSoFar, totalPlayers: result.totalPlayers });
    if (result.allVoted) io.to(code).emit('game-results', result.results);
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
        clues: room.clues,
        currentRound: room.currentRound,
        totalRounds: room.totalRounds,
        currentPlayerId: room.players[room.turnIndex].id,
        gameComplete: false,
      });
    }
    if (room.state === 'voting') {
      io.to(room.code).emit('vote-progress', {
        votesSoFar: Object.keys(room.votes).length,
        totalPlayers: room.players.length,
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});