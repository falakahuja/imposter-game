const socket = io();

// ---- Avatar + confetti helpers ----
const AVATAR_COLORS = ['#FF6B6B','#4ECDC4','#FFD93D','#6C5CE7','#00B894','#FD79A8','#0984E3','#E17055'];
function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function getInitials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
function avatarSpan(name) {
  const span = document.createElement('span');
  span.className = 'avatar';
  span.style.background = getAvatarColor(name);
  span.textContent = getInitials(name);
  return span;
}
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  const colors = AVATAR_COLORS;
  const pieces = Array.from({ length: 140 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.5,
    size: 6 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    speed: 2 + Math.random() * 3,
    drift: -1 + Math.random() * 2,
    rotation: Math.random() * 360,
    rotSpeed: -6 + Math.random() * 12,
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.y += p.speed; p.x += p.drift; p.rotation += p.rotSpeed;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    frame++;
    if (frame < 150) requestAnimationFrame(draw);
    else canvas.style.display = 'none';
  }
  draw();
}

// ---- Screen elements & switching ----
const modeSelectScreen = document.getElementById('mode-select-screen');
const startScreen = document.getElementById('start-screen');
const joinScreen = document.getElementById('join-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const wordScreen = document.getElementById('word-screen');
const votingScreen = document.getElementById('voting-screen');
const resultsScreen = document.getElementById('results-screen');
const mafiaRoleScreen = document.getElementById('mafia-role-screen');
const mafiaNightScreen = document.getElementById('mafia-night-screen');
const mafiaDayScreen = document.getElementById('mafia-day-screen');
const mafiaVoteScreen = document.getElementById('mafia-vote-screen');
const mafiaResultsScreen = document.getElementById('mafia-results-screen');
const localSetupScreen = document.getElementById('local-setup-screen');
const localPassScreen = document.getElementById('local-pass-screen');
const localAccuseScreen = document.getElementById('local-accuse-screen');
const localResultsScreen = document.getElementById('local-results-screen');

const allScreens = [
  modeSelectScreen, startScreen, joinScreen, lobbyScreen, wordScreen,
  votingScreen, resultsScreen, mafiaRoleScreen, mafiaNightScreen,
  mafiaDayScreen, mafiaVoteScreen, mafiaResultsScreen, localSetupScreen,
  localPassScreen, localAccuseScreen, localResultsScreen,
];
function switchScreen(target) {
  allScreens.forEach(s => { s.style.display = 'none'; s.classList.remove('screen-active'); });
  target.style.display = 'block';
  void target.offsetWidth; // restart animation
  target.classList.add('screen-active');
}

// ---- Element refs ----
const nameInput = document.getElementById('name-input');
const codeInput = document.getElementById('code-input');
const errorMsg = document.getElementById('error-msg');
const roomCodeDisplay = document.getElementById('room-code-display');
const playerList = document.getElementById('player-list');
const copyCodeBtn = document.getElementById('copy-code-btn');
const abortBanner = document.getElementById('abort-banner');
const roundsControl = document.getElementById('rounds-control');
const roundsSelect = document.getElementById('rounds-select');
const roundsDisplay = document.getElementById('rounds-display');
const startBtn = document.getElementById('start-btn');
const startError = document.getElementById('start-error');

const wordDisplay = document.getElementById('word-display');
const roundDots = document.getElementById('round-dots');
const roundDisplay = document.getElementById('round-display');
const turnDisplay = document.getElementById('turn-display');
const clueInputArea = document.getElementById('clue-input-area');
const clueInput = document.getElementById('clue-input');
const submitClueBtn = document.getElementById('submit-clue-btn');
const clueError = document.getElementById('clue-error');
const clueList = document.getElementById('clue-list');

const voteProgressDisplay = document.getElementById('vote-progress-display');
const voteOptions = document.getElementById('vote-options');
const voteError = document.getElementById('vote-error');

const resultsCardInner = document.getElementById('results-card-inner');
const resultsHeadline = document.getElementById('results-headline');
const resultsSubtext = document.getElementById('results-subtext');
const resultsCitizenWord = document.getElementById('results-citizen-word');
const resultsImposterWord = document.getElementById('results-imposter-word');
const resultsTally = document.getElementById('results-tally');
const playAgainBtn = document.getElementById('play-again-btn');
const playAgainWaiting = document.getElementById('play-again-waiting');

let currentRoomCode = null;
let isHost = false;
let players = [];
let currentMode = 'imposter';
let myRole = null;
let mafiaState = null;
let mafiaActionPending = false;

// ---- Mode selection ----
document.getElementById('mode-online-btn').addEventListener('click', () => switchScreen(startScreen));
document.getElementById('mode-local-btn').addEventListener('click', () => switchScreen(localSetupScreen));

// ---- Create / join ----
document.getElementById('mode-imposter-btn').addEventListener('click', () => {
  currentMode = 'imposter';
  document.getElementById('mode-imposter-btn').classList.add('btn-primary');
  document.getElementById('mode-imposter-btn').classList.remove('btn-secondary');
  document.getElementById('mode-mafia-btn').classList.add('btn-secondary');
  document.getElementById('mode-mafia-btn').classList.remove('btn-primary');
});

document.getElementById('mode-mafia-btn').addEventListener('click', () => {
  currentMode = 'mafia';
  document.getElementById('mode-mafia-btn').classList.add('btn-primary');
  document.getElementById('mode-mafia-btn').classList.remove('btn-secondary');
  document.getElementById('mode-imposter-btn').classList.add('btn-secondary');
  document.getElementById('mode-imposter-btn').classList.remove('btn-primary');
});

currentMode = 'imposter';
document.getElementById('mode-imposter-btn').classList.add('btn-primary');
document.getElementById('mode-imposter-btn').classList.remove('btn-secondary');
document.getElementById('mode-mafia-btn').classList.add('btn-secondary');
document.getElementById('mode-mafia-btn').classList.remove('btn-primary');

document.getElementById('create-btn').addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) return alert('Enter a name first.');
  socket.emit('create-room', { name, mode: currentMode });
});

document.getElementById('show-join-btn').addEventListener('click', () => switchScreen(joinScreen));

document.getElementById('join-btn').addEventListener('click', () => {
  const name = nameInput.value.trim();
  const code = codeInput.value.trim();
  if (!name) return alert('Enter a name first.');
  if (!code) return alert('Enter a room code.');
  socket.emit('join-room', { code, name });
});

copyCodeBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(currentRoomCode).then(() => {
    const original = copyCodeBtn.textContent;
    copyCodeBtn.textContent = 'Copied!';
    copyCodeBtn.classList.add('copied');
    setTimeout(() => { copyCodeBtn.textContent = original; copyCodeBtn.classList.remove('copied'); }, 1500);
  });
});

socket.on('room-joined', (room) => showLobby(room));
socket.on('join-error', ({ message }) => { errorMsg.textContent = message; });

socket.on('room-updated', (payload) => {
  const room = payload?.room || payload;
  if (!room) return;
  currentMode = room.mode || currentMode;
  if (room.state === 'playing' && room.mode === 'mafia') {
    mafiaState = payload?.room ? payload : { room, resolution: null };
    syncMafiaScreen(room);
    return;
  }
  showLobby(room);
});

function showLobby(room) {
  currentRoomCode = room.code;
  currentMode = room.mode || currentMode;
  isHost = room.hostId === socket.id;
  players = room.players.map(p => ({ id: p.id, name: p.name }));
  mafiaState = null;
  myRole = null;
  mafiaActionPending = false;

  switchScreen(lobbyScreen);
  abortBanner.style.display = 'none';
  roomCodeDisplay.textContent = room.code;
  startBtn.style.display = isHost ? 'block' : 'none';
  startError.textContent = '';

  roundsControl.style.display = isHost ? 'block' : 'none';
  roundsSelect.value = room.totalRounds || 2;
  roundsDisplay.textContent = isHost ? '' : `Rounds: ${room.totalRounds || 2}`;
  roundsDisplay.style.display = isHost ? 'none' : 'block';

  playerList.innerHTML = '';
  room.players.forEach((p) => {
    const li = document.createElement('li');
    li.className = 'player-card';
    li.appendChild(avatarSpan(p.name));
    const nameSpan = document.createElement('span');
    nameSpan.className = 'player-name';
    nameSpan.textContent = p.name;
    li.appendChild(nameSpan);
    if (p.id === room.hostId) {
      const badge = document.createElement('span');
      badge.className = 'badge-host';
      badge.textContent = 'HOST';
      li.appendChild(badge);
    }
    playerList.appendChild(li);
  });
}

roundsSelect.addEventListener('change', () => {
  socket.emit('set-rounds', { code: currentRoomCode, rounds: roundsSelect.value });
});

startBtn.addEventListener('click', () => {
  socket.emit('start-game', { code: currentRoomCode });
});
socket.on('start-error', ({ message }) => { startError.textContent = message; });

// ---- Game start / clues ----
socket.on('your-word', ({ word, role, mode }) => {
  if (mode === 'mafia' || currentMode === 'mafia') {
    myRole = role || myRole;
    if (myRole) {
      renderMafiaRoleScreen();
    }
    return;
  }
  wordDisplay.textContent = word;
});

socket.on('game-started', (data) => {
  players = data.players;
  currentMode = data.mode || currentMode;
  if (currentMode === 'mafia') {
    renderMafiaRoleScreen();
    return;
  }
  switchScreen(wordScreen);
  clueList.innerHTML = '';
  updateTurnUI(data.currentPlayerId, data.currentRound, data.totalRounds);
});

function getPlayerName(id) {
  const p = players.find((player) => player.id === id);
  return p ? p.name : 'someone';
}

function renderRoundDots(round, total) {
  roundDots.innerHTML = '';
  for (let i = 1; i <= total; i++) {
    const dot = document.createElement('span');
    dot.className = 'round-dot';
    if (i < round) dot.classList.add('done');
    if (i === round) dot.classList.add('active');
    roundDots.appendChild(dot);
  }
}

function updateTurnUI(currentPlayerId, round, totalRounds) {
  renderRoundDots(round, totalRounds);
  roundDisplay.textContent = `Round ${round} of ${totalRounds}`;
  if (currentPlayerId === socket.id) {
    turnDisplay.textContent = "It's your turn!";
    clueInputArea.style.display = 'block';
    clueInput.focus();
  } else {
    turnDisplay.textContent = `Waiting for ${getPlayerName(currentPlayerId)}…`;
    clueInputArea.style.display = 'none';
  }
}

function renderClues(clues) {
  clueList.innerHTML = '';
  clues.forEach((c) => {
    const li = document.createElement('li');
    li.className = 'player-card';
    li.appendChild(avatarSpan(c.playerName));
    const span = document.createElement('span');
    span.className = 'player-name';
    span.textContent = `${c.playerName}: "${c.clue}"`;
    li.appendChild(span);
    clueList.appendChild(li);
  });
}

submitClueBtn.addEventListener('click', () => {
  const clue = clueInput.value.trim();
  if (!clue) return;
  socket.emit('game-action', { code: currentRoomCode, action: 'submit-clue', payload: { clue } });
  clueInput.value = '';
});
clueInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitClueBtn.click(); });

socket.on('clue-error', ({ message }) => { clueError.textContent = message; });

socket.on('clue-submitted', (data) => {
  clueError.textContent = '';
  renderClues(data.clues);
  if (data.gameComplete) {
    switchScreen(votingScreen);
    showVotingScreen();
  } else {
    updateTurnUI(data.currentPlayerId, data.currentRound, data.totalRounds);
  }
});

const mafiaRoleDisplay = document.getElementById('mafia-role-display');
const mafiaRoleSubtitle = document.getElementById('mafia-role-subtitle');
const mafiaContinueBtn = document.getElementById('mafia-continue-btn');
const mafiaNightSubtitle = document.getElementById('mafia-night-subtitle');
const mafiaNightActions = document.getElementById('mafia-night-actions');
const mafiaNightStatus = document.getElementById('mafia-night-status');
const mafiaDaySummary = document.getElementById('mafia-day-summary');
const mafiaDayStats = document.getElementById('mafia-day-stats');
const mafiaOpenVoteBtn = document.getElementById('mafia-open-vote-btn');
const mafiaVoteSubtitle = document.getElementById('mafia-vote-subtitle');
const mafiaVoteOptions = document.getElementById('mafia-vote-options');
const mafiaVoteError = document.getElementById('mafia-vote-error');
const mafiaResultsCardInner = document.getElementById('mafia-results-card-inner');
const mafiaResultsHeadline = document.getElementById('mafia-results-headline');
const mafiaResultsSubtext = document.getElementById('mafia-results-subtext');
const mafiaResultsWinner = document.getElementById('mafia-results-winner');
const mafiaResultsRoles = document.getElementById('mafia-results-roles');
const mafiaResultsList = document.getElementById('mafia-results-list');
const mafiaPlayAgainBtn = document.getElementById('mafia-play-again-btn');

mafiaContinueBtn.addEventListener('click', () => {
  showMafiaNightScreen();
});

mafiaOpenVoteBtn.addEventListener('click', () => {
  if (!mafiaState) return;
  mafiaState.phase = 'day-vote';
  renderMafiaVoteScreen();
});

mafiaPlayAgainBtn.addEventListener('click', () => {
  socket.emit('play-again', { code: currentRoomCode });
});

function renderMafiaRoleScreen() {
  switchScreen(mafiaRoleScreen);
  mafiaRoleDisplay.textContent = myRole || 'Unknown';
  mafiaRoleSubtitle.textContent = myRole === 'Mafia'
    ? 'You are the Mafia. Choose a target during the night.'
    : myRole === 'Detective'
      ? 'You are the Detective. Investigate one player at night.'
      : myRole === 'Doctor'
        ? 'You are the Doctor. Protect one player at night.'
        : 'You are a Villager. Watch the discussion and vote during the day.';
}

function syncMafiaScreen(room) {
  if (!room?.modeState) return;
  if (room.modeState.phase === 'night') {
    showMafiaNightScreen();
  } else if (room.modeState.phase === 'day-discussion') {
    renderMafiaDayScreen();
  } else if (room.modeState.phase === 'day-vote') {
    renderMafiaVoteScreen();
  }
}

function showMafiaNightScreen() {
  switchScreen(mafiaNightScreen);
  if (myRole === 'Mafia') {
    mafiaNightSubtitle.textContent = 'Choose who to eliminate tonight.';
    renderActionOptions('night-kill');
  } else if (myRole === 'Detective') {
    mafiaNightSubtitle.textContent = 'Choose a player to investigate tonight.';
    renderActionOptions('night-investigate');
  } else if (myRole === 'Doctor') {
    mafiaNightSubtitle.textContent = 'Choose a player to protect tonight.';
    renderActionOptions('night-save');
  } else {
    mafiaNightSubtitle.textContent = 'You are watching the night phase. Wait for the results.';
    mafiaNightActions.innerHTML = '<p class="subtitle">Waiting for the night actions to resolve…</p>';
    mafiaNightStatus.textContent = 'No action required.';
  }
}

function renderActionOptions(actionType) {
  mafiaNightActions.innerHTML = '';
  mafiaNightStatus.textContent = '';
  const alivePlayers = players.filter((player) => player.id !== socket.id);
  alivePlayers.forEach((player) => {
    const card = document.createElement('button');
    card.className = 'vote-card';
    card.appendChild(avatarSpan(player.name));
    const label = document.createElement('div');
    label.textContent = player.name;
    card.appendChild(label);
    card.addEventListener('click', () => {
      socket.emit('game-action', { code: currentRoomCode, action: actionType, payload: { targetId: player.id } });
      mafiaActionPending = true;
      mafiaNightStatus.textContent = 'Action submitted. Waiting for the phase to resolve…';
      mafiaNightActions.querySelectorAll('button').forEach((btn) => btn.disabled = true);
    });
    mafiaNightActions.appendChild(card);
  });
}

function renderMafiaDayScreen() {
  switchScreen(mafiaDayScreen);
  mafiaDaySummary.textContent = mafiaState?.resolution?.victimId
    ? `${getPlayerName(mafiaState.resolution.victimId)} was eliminated.`
    : 'No one was eliminated this night.';
  mafiaDayStats.innerHTML = '';
  players.forEach((player) => {
    const li = document.createElement('li');
    li.className = 'player-card';
    li.appendChild(avatarSpan(player.name));
    const span = document.createElement('span');
    span.className = 'player-name';
    const role = mafiaState?.roles?.[player.id] || 'Unknown';
    span.textContent = `${player.name} — ${role}`;
    if (mafiaState?.alivePlayerIds?.includes(player.id) === false) {
      span.textContent += ' (dead)';
    }
    li.appendChild(span);
    mafiaDayStats.appendChild(li);
  });
}

function renderMafiaVoteScreen() {
  switchScreen(mafiaVoteScreen);
  mafiaVoteSubtitle.textContent = 'Choose who to eliminate during the day.';
  mafiaVoteError.textContent = '';
  mafiaVoteOptions.innerHTML = '';
  players.filter((player) => mafiaState?.alivePlayerIds?.includes(player.id) !== false).forEach((player) => {
    const card = document.createElement('button');
    card.className = 'vote-card';
    card.appendChild(avatarSpan(player.name));
    const label = document.createElement('div');
    label.textContent = player.name;
    card.appendChild(label);
    card.addEventListener('click', () => {
      socket.emit('game-action', { code: currentRoomCode, action: 'day-vote', payload: { targetId: player.id } });
      mafiaVoteOptions.querySelectorAll('button').forEach((btn) => btn.disabled = true);
      mafiaVoteSubtitle.textContent = 'Vote submitted. Waiting for the next phase…';
    });
    mafiaVoteOptions.appendChild(card);
  });
}

function renderMafiaResults(results) {
  switchScreen(mafiaResultsScreen);
  mafiaResultsCardInner.className = 'results-card';
  mafiaResultsHeadline.textContent = results.winner === 'mafia' ? '🕵️ Mafia wins!' : '🎉 Villagers win!';
  mafiaResultsSubtext.textContent = 'Final roles';
  mafiaResultsWinner.textContent = results.winner === 'mafia' ? 'Mafia' : 'Villagers';
  mafiaResultsRoles.textContent = `${results.roles ? Object.keys(results.roles).length : 0} players`;
  mafiaResultsList.innerHTML = '';
  players.forEach((player) => {
    const li = document.createElement('li');
    li.className = 'player-card';
    li.appendChild(avatarSpan(player.name));
    const span = document.createElement('span');
    span.className = 'player-name';
    span.textContent = `${player.name} — ${results.roles?.[player.id] || 'Unknown'}`;
    li.appendChild(span);
    mafiaResultsList.appendChild(li);
  });
}

socket.on('game-action-error', ({ message }) => {
  mafiaNightStatus.textContent = message;
  mafiaVoteError.textContent = message;
});

socket.on('room-reset', (room) => {
  showLobby(room);
});

socket.on('game-results', (results) => {
  if (currentMode === 'mafia') {
    renderMafiaResults(results);
    return;
  }
  switchScreen(resultsScreen);
  resultsCardInner.className = 'results-card ' + (results.citizensWin ? 'win' : 'lose');
  resultsHeadline.textContent = results.citizensWin ? '🎉 Citizens win!' : '🕵️ Imposter wins!';
  resultsSubtext.textContent = `${results.imposterName} was the imposter`;
  resultsCitizenWord.textContent = results.citizenWord;
  resultsImposterWord.textContent = results.imposterWord;

  resultsTally.innerHTML = '';
  players.forEach((p) => {
    const li = document.createElement('li');
    li.className = 'results-tally-item';
    li.appendChild(avatarSpan(p.name));
    const voteCount = results.tally[p.id] || 0;
    const tag = p.id === results.imposterId ? ' 🎭 (imposter)' : '';
    const span = document.createElement('span');
    span.textContent = `${p.name}${tag} — ${voteCount} vote(s)`;
    li.appendChild(span);
    resultsTally.appendChild(li);
  });

  playAgainBtn.style.display = isHost ? 'block' : 'none';
  playAgainWaiting.style.display = isHost ? 'none' : 'block';

  if (results.citizensWin) launchConfetti();
});

// ---- Voting ----
function showVotingScreen() {
  voteError.textContent = '';
  voteProgressDisplay.textContent = `0 of ${players.length} voted`;
  voteOptions.innerHTML = '';
  players.forEach((p) => {
    const card = document.createElement('button');
    card.className = 'vote-card';
    card.appendChild(avatarSpan(p.name));
    const label = document.createElement('div');
    label.textContent = p.name;
    card.appendChild(label);
    card.addEventListener('click', () => {
      socket.emit('game-action', { code: currentRoomCode, action: 'submit-vote', payload: { votedForId: p.id } });
      voteOptions.querySelectorAll('button').forEach(b => b.disabled = true);
      card.style.boxShadow = '0 0 0 2px var(--accent)';
    });
    voteOptions.appendChild(card);
  });
}

socket.on('vote-error', ({ message }) => { voteError.textContent = message; });
socket.on('vote-progress', ({ votesSoFar, totalPlayers }) => {
  voteProgressDisplay.textContent = `${votesSoFar} of ${totalPlayers} voted`;
});

socket.on('game-results', (results) => {
  switchScreen(resultsScreen);
  resultsCardInner.className = 'results-card ' + (results.citizensWin ? 'win' : 'lose');
  resultsHeadline.textContent = results.citizensWin ? '🎉 Citizens win!' : '🕵️ Imposter wins!';
  resultsSubtext.textContent = `${results.imposterName} was the imposter`;
  resultsCitizenWord.textContent = results.citizenWord;
  resultsImposterWord.textContent = results.imposterWord;

  resultsTally.innerHTML = '';
  players.forEach((p) => {
    const li = document.createElement('li');
    li.className = 'results-tally-item';
    li.appendChild(avatarSpan(p.name));
    const voteCount = results.tally[p.id] || 0;
    const tag = p.id === results.imposterId ? ' 🎭 (imposter)' : '';
    const span = document.createElement('span');
    span.textContent = `${p.name}${tag} — ${voteCount} vote(s)`;
    li.appendChild(span);
    resultsTally.appendChild(li);
  });

  playAgainBtn.style.display = isHost ? 'block' : 'none';
  playAgainWaiting.style.display = isHost ? 'none' : 'block';

  if (results.citizensWin) launchConfetti();
});

playAgainBtn.addEventListener('click', () => {
  socket.emit('play-again', { code: currentRoomCode });
});
socket.on('room-reset', (room) => showLobby(room));

// ---- Disconnect / abort handling ----
socket.on('game-aborted', ({ room, message }) => {
  showLobby(room);
  abortBanner.textContent = message;
  abortBanner.style.display = 'block';
});

// ---- Pass & Play (local) mode ----
let localNames = [];
let localGame = null;
let localPassIndex = 0;

const localNameInput = document.getElementById('local-name-input');
const localAddBtn = document.getElementById('local-add-btn');
const localPlayerList = document.getElementById('local-player-list');
const localStartBtn = document.getElementById('local-start-btn');
const localPassName = document.getElementById('local-pass-name');
const localRevealBox = document.getElementById('local-reveal-box');
const localRevealPrompt = document.getElementById('local-reveal-prompt');
const localRevealWord = document.getElementById('local-reveal-word');
const localNextPassBtn = document.getElementById('local-next-pass-btn');
const localAccuseOptions = document.getElementById('local-accuse-options');
const localResultsCardInner = document.getElementById('local-results-card-inner');
const localResultsHeadline = document.getElementById('local-results-headline');
const localResultsSubtext = document.getElementById('local-results-subtext');
const localResultsCitizenWord = document.getElementById('local-results-citizen-word');
const localResultsImposterWord = document.getElementById('local-results-imposter-word');
const localPlayAgainBtn = document.getElementById('local-play-again-btn');

localAddBtn.addEventListener('click', () => {
  const name = localNameInput.value.trim();
  if (!name) return;
  localNames.push(name);
  localNameInput.value = '';
  renderLocalPlayerList();
});
localNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') localAddBtn.click(); });

function renderLocalPlayerList() {
  localPlayerList.innerHTML = '';
  localNames.forEach((name, i) => {
    const li = document.createElement('li');
    li.className = 'player-card';
    li.appendChild(avatarSpan(name));
    const span = document.createElement('span');
    span.className = 'player-name';
    span.textContent = name;
    li.appendChild(span);
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-ghost';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => { localNames.splice(i, 1); renderLocalPlayerList(); });
    li.appendChild(removeBtn);
    localPlayerList.appendChild(li);
  });
  localStartBtn.disabled = localNames.length < 3;
}

localStartBtn.addEventListener('click', () => {
  localGame = createLocalGame(localNames);
  localPassIndex = 0;
  showLocalPassScreen();
});

function showLocalPassScreen() {
  switchScreen(localPassScreen);
  const player = localGame.players[localPassIndex];
  localPassName.textContent = `Pass the device to ${player.name}`;
  localRevealPrompt.style.display = 'block';
  localRevealWord.style.display = 'none';
  localRevealWord.textContent = '';
  localNextPassBtn.style.display = 'none';
}

localRevealBox.addEventListener('click', () => {
  const player = localGame.players[localPassIndex];
  localRevealPrompt.style.display = 'none';
  localRevealWord.style.display = 'block';
  localRevealWord.textContent = player.word;
  localNextPassBtn.style.display = 'block';
});

localNextPassBtn.addEventListener('click', () => {
  localPassIndex++;
  if (localPassIndex >= localGame.players.length) {
    showLocalAccuseScreen();
  } else {
    showLocalPassScreen();
  }
});

function showLocalAccuseScreen() {
  switchScreen(localAccuseScreen);
  localAccuseOptions.innerHTML = '';
  localGame.players.forEach((player, index) => {
    const card = document.createElement('button');
    card.className = 'vote-card';
    card.appendChild(avatarSpan(player.name));
    const label = document.createElement('div');
    label.textContent = player.name;
    card.appendChild(label);
    card.addEventListener('click', () => {
      const results = computeLocalResults(localGame.players, index);
      showLocalResults(results);
    });
    localAccuseOptions.appendChild(card);
  });
}

function showLocalResults(results) {
  switchScreen(localResultsScreen);
  localResultsCardInner.className = 'results-card ' + (results.citizensWin ? 'win' : 'lose');
  localResultsHeadline.textContent = results.citizensWin ? '🎉 Citizens win!' : '🕵️ Imposter wins!';
  localResultsSubtext.textContent = `${results.imposterName} was the imposter`;
  localResultsCitizenWord.textContent = results.citizenWord;
  localResultsImposterWord.textContent = results.imposterWord;
  if (results.citizensWin) launchConfetti();
}

localPlayAgainBtn.addEventListener('click', () => {
  localNames = [];
  localGame = null;
  renderLocalPlayerList();
  switchScreen(localSetupScreen);
});

// Initial screen
switchScreen(modeSelectScreen);