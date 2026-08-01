const socket = io();
const games = {
  'word-imposter': { icon: '🎭', name: 'Word Imposter', description: 'Spot the player with the different secret word.' },
  'gif-imposter': { icon: '🎞️', name: 'GIF Imposter', description: 'Describe your secret GIF and find the odd one out.' },
  'most-likely': { icon: '🗳️', name: 'Most Likely To', description: 'Vote for the friend who fits the prompt best.' },
};
const gif = id => `https://media.giphy.com/media/${id}/giphy.gif`;
function gifMarkup(item, small = false) {
  if (typeof item === 'string') return `<img class="${small ? 'gif-thumb' : 'gif-item'}" src="${item}" alt="GIF prompt">`;
  return `<div class="reaction-gif ${item.hue || ''} ${small ? 'small' : ''}"><span>${item.emoji}</span><small>${item.caption}</small></div>`;
}
const localGifPairs = [
  { citizen: gif('10JhviFuU2gWD6'), imposter: gif('5VKbvrjxpVJCM') },
  { citizen: gif('3o7TKSjRrfIPjeiVyM'), imposter: gif('j24iLwCAjAeNQgORpZ') },
  { citizen: gif('XlKvVrcIq4qAtsTFVk'), imposter: gif('10JhviFuU2gWD6') },
  { citizen: gif('5VKbvrjxpVJCM'), imposter: gif('3o7TKSjRrfIPjeiVyM') },
  { citizen: gif('j24iLwCAjAeNQgORpZ'), imposter: gif('XlKvVrcIq4qAtsTFVk') },
];
const localPrompts = ['Who is most likely to become famous?', 'Who is most likely to survive a zombie apocalypse?', 'Who is most likely to be late to their own wedding?', 'Who is most likely to start a business?', 'Who is most likely to win a reality show?'];
const screens = [...document.querySelectorAll('[data-screen]')];
let historyStack = ['landing'], popping = false, selectedMode, room, privateItem;
function show(id, push = true) { screens.forEach(s => s.style.display = s.id === id ? 'block' : 'none'); if (push && !popping && historyStack.at(-1) !== id) { historyStack.push(id); history.pushState({ screen: id }, ''); } }
history.replaceState({ screen: 'landing' }, '');
window.onpopstate = () => { if (historyStack.length > 1) { popping = true; historyStack.pop(); show(historyStack.at(-1), false); popping = false; } };
document.querySelectorAll('.back-btn').forEach(b => b.onclick = () => history.back());
function avatar(name) { const e = document.createElement('span'); e.className = 'avatar'; e.textContent = name.split(/\s+/).map(x => x[0]).join('').slice(0, 2); return e; }
function addButton(parent, text, handler) { const b = document.createElement('button'); b.className = 'btn btn-primary'; b.textContent = text; b.onclick = handler; parent.append(b); return b; }
function playerList(el, list, host) { el.innerHTML = ''; list.forEach(p => { const li = document.createElement('li'); li.className = 'player-card'; li.append(avatar(p.name), Object.assign(document.createElement('span'), { className: 'player-name', textContent: p.name })); if (p.id === host) li.append(Object.assign(document.createElement('span'), { className: 'badge-host', textContent: 'HOST' })); el.append(li); }); }

const cards = document.querySelector('#game-cards');
Object.entries(games).forEach(([id, game]) => { const b = document.createElement('button'); b.className = 'game-card'; b.innerHTML = `<span class="game-icon">${game.icon}</span><strong>${game.name}</strong><small>${game.description}</small>`; b.onclick = () => { selectedMode = id; document.querySelector('#method-title').textContent = game.name; document.querySelector('#method-description').textContent = game.description; document.querySelector('#local-btn').style.display = 'block'; document.querySelector('#local-note').textContent = ''; show('method'); }; cards.append(b); });
document.querySelector('#online-btn').onclick = () => show('start');
document.querySelector('#local-btn').onclick = () => openLocalSetup();
document.querySelector('#create').onclick = () => { const name = document.querySelector('#name').value.trim(); if (!name) return alert('Enter your name.'); socket.emit('create-room', { name, modeId: selectedMode }); };
document.querySelector('#show-join').onclick = () => show('join');
document.querySelector('#join').onclick = () => socket.emit('join-room', { code: document.querySelector('#code').value.trim(), name: document.querySelector('#name').value.trim() });

function lobby(r) { room = r; document.querySelector('#room-code').textContent = r.code; playerList(document.querySelector('#players'), r.players, r.hostId); const host = r.hostId === socket.id; const usesRounds = r.modeId !== 'most-likely'; document.querySelector('#settings').style.display = host && usesRounds ? 'block' : 'none'; document.querySelector('#start-game').style.display = host ? 'block' : 'none'; document.querySelector('#rounds').value = r.settings.rounds; show('lobby'); }
socket.on('room-joined', lobby); socket.on('room-updated', lobby); socket.on('room-reset', lobby);
socket.on('join-error', x => document.querySelector('#join-error').textContent = x.message); socket.on('start-error', x => document.querySelector('#start-error').textContent = x.message);
document.querySelector('#rounds').onchange = e => socket.emit('update-settings', { code: room.code, settings: { rounds: e.target.value } });
document.querySelector('#start-game').onclick = () => socket.emit('start-game', { code: room.code });
socket.on('game-private', x => privateItem = x);
function action(actionName, payload = {}) { socket.emit('game-action', { code: room.code, action: actionName, payload }); }
function gameState(s) {
  show('play'); const imposter = s.kind === 'imposter'; const reveal = document.querySelector('#private-reveal'); reveal.style.display = imposter ? 'block' : 'none';
  if (imposter && privateItem) { document.querySelector('#private-label').textContent = `Your ${privateItem.label}`; const item = document.querySelector('#private-item'); if (privateItem.label === 'gif') item.innerHTML = `<img class="gif-item" src="${privateItem.item}" alt="Your secret GIF">`; else item.textContent = privateItem.item; }
  const title = document.querySelector('#play-title'), status = document.querySelector('#play-status'), area = document.querySelector('#action-area'), feed = document.querySelector('#feed'); area.innerHTML = ''; feed.innerHTML = '';
  if (imposter) {
    title.textContent = s.phase === 'voting' ? "Who's the imposter?" : `Round ${s.currentRound} of ${s.totalRounds}`;
    if (s.phase === 'playing') { status.textContent = s.currentPlayerId === socket.id ? "It's your turn — give one word." : `Waiting for ${room.players.find(p => p.id === s.currentPlayerId)?.name || 'a player'}…`; if (s.currentPlayerId === socket.id) { const input = Object.assign(document.createElement('input'), { className: 'input-field', placeholder: 'One-word clue' }); area.append(input); addButton(area, 'Submit clue', () => action('clue', { clue: input.value })); } s.clues.forEach(c => { const li = document.createElement('li'); li.className = 'player-card'; li.textContent = `${c.playerName}: “${c.clue}”`; feed.append(li); }); }
    else { status.textContent = `${s.votesSoFar} of ${s.totalPlayers} voted`; room.players.forEach(p => addButton(area, `Vote: ${p.name}`, () => action('vote', { votedForId: p.id }))); }
  } else { title.textContent = `Prompt ${s.round} of ${s.totalRounds}`; status.textContent = s.prompt; if (s.phase === 'picking') { document.querySelector('#feed-title').textContent = 'Pick one other player'; room.players.filter(p => p.id !== socket.id).forEach(p => addButton(area, p.name, () => action('pick', { playerId: p.id }))); } else { document.querySelector('#feed-title').textContent = 'Discussion time'; status.textContent = 'Make your case, defend yourself, and have a laugh.'; if (room.hostId === socket.id) addButton(area, s.round >= s.totalRounds ? 'End session' : 'Next prompt', () => action('next-round')); } }
}
socket.on('game-state', gameState); socket.on('game-error', x => alert(x.message)); socket.on('game-aborted', x => { alert(x.message); lobby(x.room); });
socket.on('game-results', r => { show('results'); const social = r.kind === 'most-likely-results', host = room.hostId === socket.id; document.querySelector('#result-card').className = 'results-card ' + (!social && r.citizensWin ? 'win' : 'lose'); document.querySelector('#result-title').textContent = social ? 'The picks are in!' : r.citizensWin ? '🎉 Citizens win!' : '🕵️ Imposter wins!'; document.querySelector('#result-subtitle').textContent = social ? r.prompt : `${r.imposterName} was the imposter`; const items = document.querySelector('#result-items'); items.innerHTML = ''; if (!social) items.innerHTML = `<div class="word-chip"><span class="word-chip-label">Citizen ${r.label}</span><span class="word-chip-value">${r.label === 'gif' ? `<img class="gif-thumb" src="${r.citizenItem}">` : r.citizenItem}</span></div><div class="word-chip word-chip-imposter"><span class="word-chip-label">Imposter ${r.label}</span><span class="word-chip-value">${r.label === 'gif' ? `<img class="gif-thumb" src="${r.imposterItem}">` : r.imposterItem}</span></div>`; const tally = document.querySelector('#tally'); tally.innerHTML = ''; room.players.forEach(p => { const li = document.createElement('li'); li.className = 'player-card'; li.textContent = `${p.name} — ${r.tally[p.id] || 0} pick${r.tally[p.id] === 1 ? '' : 's'}`; tally.append(li); }); const cont = document.querySelector('#continue'); cont.style.display = host ? 'block' : 'none'; cont.textContent = social ? 'Next prompt' : 'Play Again'; cont.onclick = () => social ? action('next-round') : socket.emit('play-again', { code: room.code }); document.querySelector('#waiting').textContent = host ? (social ? 'Discuss, then continue when ready.' : '') : 'Waiting for the host to continue.'; });
socket.on('session-complete', () => document.querySelector('#result-subtitle').textContent = 'That was the final prompt. Thanks for playing!');

let localNames = [], localGame = null, localIndex = 0, localPicks = {}, localPromptIndex = 0;
const localList = document.querySelector('#local-players');
function openLocalSetup() { localNames = []; renderLocalNames(); const game = games[selectedMode]; document.querySelector('#local-setup-title').textContent = `${game.name} — Pass & Play`; document.querySelector('#local-setup-description').textContent = selectedMode === 'most-likely' ? 'Add 3 or more players. Each person privately makes one pick, then the group finds the question imposter.' : 'Add 3 or more players, then pass the device around for private reveals.'; document.querySelector('#local-rounds-wrap').style.display = 'none'; show('local-setup'); }
function renderLocalNames() { localList.innerHTML = ''; localNames.forEach((name, i) => { const li = document.createElement('li'); li.className = 'player-card'; li.append(avatar(name), Object.assign(document.createElement('span'), { className: 'player-name', textContent: name })); const remove = document.createElement('button'); remove.className = 'btn-ghost'; remove.textContent = 'Remove'; remove.onclick = () => { localNames.splice(i, 1); renderLocalNames(); }; li.append(remove); localList.append(li); }); }
document.querySelector('#local-add').onclick = () => { const name = document.querySelector('#local-name').value.trim(); if (!name) return; localNames.push(name); document.querySelector('#local-name').value = ''; renderLocalNames(); };
document.querySelector('#local-name').onkeydown = e => { if (e.key === 'Enter') document.querySelector('#local-add').click(); };
document.querySelector('#local-start').onclick = () => { if (localNames.length < 3) return alert('Add at least 3 players.'); localIndex = 0; localPromptIndex = 0; if (selectedMode === 'most-likely') { localGame = { mode: selectedMode, players: localNames.map(name => ({ name })), totalRounds: Number(document.querySelector('#local-rounds').value) }; startLocalPrompt(); } else { const pair = selectedMode === 'word-imposter' ? WordPairs.getRandomPair() : localGifPairs[Math.floor(Math.random() * localGifPairs.length)]; const imposter = Math.floor(Math.random() * localNames.length); localGame = { mode: selectedMode, pair, players: localNames.map((name, i) => ({ name, isImposter: i === imposter, item: i === imposter ? pair.imposter : pair.citizen })) }; localPass(); } };
function localPass() { const player = localGame.players[localIndex], isGif = localGame.mode === 'gif-imposter'; show('local-pass'); document.querySelector('#local-person').textContent = `Pass the device to ${player.name}`; document.querySelector('#local-reveal-prompt').textContent = `Tap to reveal your ${isGif ? 'GIF' : 'word'}`; const item = document.querySelector('#local-word'); item.innerHTML = ''; item.textContent = ''; document.querySelector('#local-choice').innerHTML = ''; document.querySelector('#local-next').style.display = 'none'; document.querySelector('#local-reveal').onclick = () => { if (isGif) item.innerHTML = `<img class="gif-item" src="${player.item}" alt="Your secret GIF">`; else item.textContent = player.item; document.querySelector('#local-next').style.display = 'block'; }; }
document.querySelector('#local-next').onclick = () => { localIndex++; if (localIndex < localGame.players.length) localPass(); else localImposterVote(); };
function localImposterVote() { show('local-vote'); document.querySelector('#local-vote-title').textContent = 'Discuss, then pick the imposter'; document.querySelector('#local-vote-subtitle').textContent = 'Choose the group’s final accusation.'; const votes = document.querySelector('#local-votes'); votes.innerHTML = ''; localGame.players.forEach((p, index) => addButton(votes, p.name, () => showLocalImposterResult(index))); }
function showLocalImposterResult(accused) { const imposter = localGame.players.findIndex(p => p.isImposter), won = accused === imposter; show('local-result'); document.querySelector('#local-result-card').className = `results-card ${won ? 'win' : 'lose'}`; document.querySelector('#local-result-title').textContent = won ? '🎉 Citizens win!' : '🕵️ Imposter wins!'; document.querySelector('#local-result-text').textContent = `${localGame.players[imposter].name} was the imposter.`; const items = document.querySelector('#local-result-items'); items.innerHTML = ''; const citizen = localGame.players.find(p => !p.isImposter).item; if (localGame.mode === 'gif-imposter') items.innerHTML = `<div class="word-chip"><span class="word-chip-label">Citizen GIF</span><img class="gif-thumb" src="${citizen}"></div><div class="word-chip word-chip-imposter"><span class="word-chip-label">Imposter GIF</span><img class="gif-thumb" src="${localGame.players[imposter].item}"></div>`; else items.innerHTML = `<div class="word-chip"><span class="word-chip-label">Citizen word</span><span class="word-chip-value">${citizen}</span></div><div class="word-chip word-chip-imposter"><span class="word-chip-label">Imposter word</span><span class="word-chip-value">${localGame.players[imposter].item}</span></div>`; document.querySelector('#local-tally').innerHTML = ''; document.querySelector('#local-again').textContent = 'New Game'; document.querySelector('#local-again').onclick = openLocalSetup; }
function startLocalPrompt() { localIndex = 0; localPicks = {}; localGame.prompt = localPrompts[localPromptIndex++ % localPrompts.length]; localMostLikelyPass(); }
function localMostLikelyPass() { const player = localGame.players[localIndex]; show('local-pass'); document.querySelector('#local-person').textContent = `Pass the device to ${player.name}`; document.querySelector('#local-reveal-prompt').textContent = 'Tap to make your private pick'; document.querySelector('#local-word').textContent = ''; document.querySelector('#local-choice').innerHTML = ''; document.querySelector('#local-next').style.display = 'none'; document.querySelector('#local-reveal').onclick = () => { document.querySelector('#local-word').textContent = localGame.prompt; const choices = document.querySelector('#local-choice'); choices.innerHTML = ''; localGame.players.filter(p => p.name !== player.name).forEach(p => addButton(choices, p.name, () => { localPicks[player.name] = p.name; localIndex++; if (localIndex < localGame.players.length) localMostLikelyPass(); else showLocalPromptResults(); })); }; }
function showLocalPromptResults() { show('local-result'); const tally = Object.fromEntries(localGame.players.map(p => [p.name, 0])); Object.values(localPicks).forEach(name => tally[name]++); document.querySelector('#local-result-card').className = 'results-card win'; document.querySelector('#local-result-title').textContent = 'The picks are in!'; document.querySelector('#local-result-text').textContent = `${localGame.prompt} Discuss the results, then continue when ready.`; document.querySelector('#local-result-items').innerHTML = ''; const list = document.querySelector('#local-tally'); list.innerHTML = ''; localGame.players.forEach(p => { const li = document.createElement('li'); li.className = 'player-card'; li.textContent = `${p.name} — ${tally[p.name]} pick${tally[p.name] === 1 ? '' : 's'}`; list.append(li); }); const next = document.querySelector('#local-again'); const final = localPromptIndex >= localGame.totalRounds; next.textContent = final ? 'New Game' : 'Next prompt'; next.onclick = final ? openLocalSetup : startLocalPrompt; }
// Most Likely To is an imposter game: answers are revealed before the group votes.
function gameState(s) {
  show('play');
  const isImposter = s.kind === 'imposter';
  const isQuestionImposter = s.kind === 'most-likely-imposter';
  const reveal = document.querySelector('#private-reveal');
  reveal.style.display = (isImposter || isQuestionImposter) ? 'block' : 'none';
  if ((isImposter || isQuestionImposter) && privateItem) {
    document.querySelector('#private-label').textContent = `Your ${privateItem.label}`;
    const item = document.querySelector('#private-item');
    if (privateItem.label === 'gif') item.innerHTML = gifMarkup(privateItem.item);
    else item.textContent = privateItem.item;
  }
  const title = document.querySelector('#play-title'), status = document.querySelector('#play-status'), area = document.querySelector('#action-area'), feed = document.querySelector('#feed'), feedTitle = document.querySelector('#feed-title');
  area.innerHTML = ''; feed.innerHTML = ''; feedTitle.textContent = '';
  if (isImposter) {
    title.textContent = s.phase === 'voting' ? "Who's the imposter?" : `Round ${s.currentRound} of ${s.totalRounds}`;
    if (s.phase === 'playing') {
      status.textContent = s.currentPlayerId === socket.id ? "It's your turn — give one word." : `Waiting for ${room.players.find(p => p.id === s.currentPlayerId)?.name || 'a player'}…`;
      if (s.currentPlayerId === socket.id) { const input = Object.assign(document.createElement('input'), { className: 'input-field', placeholder: 'One-word clue' }); area.append(input); addButton(area, 'Submit clue', () => action('clue', { clue: input.value })); }
      s.clues.forEach(c => { const li = document.createElement('li'); li.className = 'player-card'; li.textContent = `${c.playerName}: “${c.clue}”`; feed.append(li); });
    } else { status.textContent = `${s.votesSoFar} of ${s.totalPlayers} voted`; room.players.forEach(p => addButton(area, `Vote: ${p.name}`, () => action('vote', { votedForId: p.id }))); }
    return;
  }
  if (!isQuestionImposter) return;
  title.textContent = `Question round ${s.round} of ${s.totalRounds}`;
  if (s.phase === 'picking') {
    status.textContent = `${s.picksSoFar} of ${s.totalPlayers} answers submitted`;
    feedTitle.textContent = 'Choose the player who best fits your question';
    room.players.forEach(p => addButton(area, p.name, () => action('pick', { playerId: p.id })));
  } else if (s.phase === 'discussion') {
    status.textContent = 'Compare the answers. Who had the different question?';
    feedTitle.textContent = 'Everyone’s answers';
    renderAnswerList(feed, s.answers);
    if (room.hostId === socket.id) addButton(area, 'Start imposter vote', () => action('start-vote'));
  } else if (s.phase === 'voting') {
    status.textContent = `${s.votesSoFar} of ${s.totalPlayers} voted — vote out the question imposter.`;
    room.players.forEach(p => addButton(area, `Vote: ${p.name}`, () => action('vote', { playerId: p.id })));
    feedTitle.textContent = 'Everyone’s answers'; renderAnswerList(feed, s.answers);
  }
}
function renderAnswerList(list, answers) {
  const totals = Object.fromEntries(room.players.map(player => [player.id, 0]));
  answers.forEach(answer => { totals[answer.pickedId] = (totals[answer.pickedId] || 0) + 1; });
  answers.forEach(answer => {
    const from = room.players.find(player => player.id === answer.playerId)?.name || 'Someone';
    const picked = room.players.find(player => player.id === answer.pickedId)?.name || 'someone';
    const li = document.createElement('li'); li.className = 'player-card answer-row';
    li.append(document.createTextNode(`${from} picked `), Object.assign(document.createElement('strong'), { className: 'answer-target', textContent: picked }));
    const count = document.createElement('span'); count.className = 'answer-count'; count.textContent = `${totals[answer.pickedId]} pick${totals[answer.pickedId] === 1 ? '' : 's'}`; li.append(count); list.append(li);
  });
}

// Replace the old results listener so the question-imposter round has its own reveal.
socket.off('game-results');
socket.on('game-results', r => {
  show('results'); const questionImposter = r.kind === 'most-likely-imposter-results', host = room.hostId === socket.id;
  document.querySelector('#result-card').className = 'results-card ' + (r.citizensWin ? 'win' : 'lose');
  document.querySelector('#result-title').textContent = r.citizensWin ? '🎉 Group found the imposter!' : '🕵️ The imposter blended in!';
  document.querySelector('#result-subtitle').textContent = questionImposter ? `${r.imposterName} had the different question.` : `${r.imposterName} was the imposter.`;
  const items = document.querySelector('#result-items'); items.innerHTML = '';
  if (questionImposter) items.innerHTML = `<div class="word-chip"><span class="word-chip-label">Group question</span><span class="word-chip-value">${r.citizenQuestion}</span></div><div class="word-chip word-chip-imposter"><span class="word-chip-label">Imposter question</span><span class="word-chip-value">${r.imposterQuestion}</span></div>`;
  else items.innerHTML = `<div class="word-chip"><span class="word-chip-label">Citizen ${r.label}</span><span class="word-chip-value">${r.label === 'gif' ? gifMarkup(r.citizenItem, true) : r.citizenItem}</span></div><div class="word-chip word-chip-imposter"><span class="word-chip-label">Imposter ${r.label}</span><span class="word-chip-value">${r.label === 'gif' ? gifMarkup(r.imposterItem, true) : r.imposterItem}</span></div>`;
  const tally = document.querySelector('#tally'); tally.innerHTML = ''; room.players.forEach(p => { const li = document.createElement('li'); li.className = 'player-card'; li.textContent = `${p.name} — ${r.tally[p.id] || 0} vote${r.tally[p.id] === 1 ? '' : 's'}`; tally.append(li); });
  if (questionImposter) { const answerHeading = document.createElement('h3'); answerHeading.textContent = 'Answers'; tally.before(answerHeading); const answers = document.createElement('ul'); answers.className = 'player-list'; renderAnswerList(answers, r.answers); answerHeading.after(answers); }
  const cont = document.querySelector('#continue'); cont.style.display = host ? 'block' : 'none'; cont.textContent = 'Next game'; cont.onclick = () => socket.emit('play-again', { code: room.code });
  const choose = document.querySelector('#choose-game'); choose.style.display = 'block'; choose.onclick = () => show('landing'); document.querySelector('#waiting').textContent = host ? '' : 'Waiting for the host to start the next game.';
});

const localPromptPairs = [
  { citizen: 'Who is most likely to become famous?', imposter: 'Who is most likely to become a millionaire?' },
  { citizen: 'Who is most likely to survive a zombie apocalypse?', imposter: 'Who is most likely to survive alone in the wilderness?' },
  { citizen: 'Who is most likely to be late to their own wedding?', imposter: 'Who is most likely to forget an important birthday?' },
  { citizen: 'Who is most likely to start a business?', imposter: 'Who is most likely to quit their job and travel the world?' },
  { citizen: 'Who is most likely to laugh at the worst possible moment?', imposter: 'Who is most likely to tell a terrible joke with confidence?' },
  { citizen: 'Who is most likely to become a meme?', imposter: 'Who is most likely to have a viral dance?' },
  { citizen: 'Who is most likely to order dessert first?', imposter: 'Who is most likely to steal fries from everyone else?' },
  { citizen: 'Who is most likely to get lost in their own neighborhood?', imposter: 'Who is most likely to miss a flight?' },
  { citizen: 'Who is most likely to survive a haunted house?', imposter: 'Who is most likely to scream first in a horror film?' },
  { citizen: 'Who is most likely to start a dance party?', imposter: 'Who is most likely to sing karaoke without being asked?' },
  { citizen: 'Who is most likely to adopt too many pets?', imposter: 'Who is most likely to name every stray animal they see?' },
];
function startLocalPrompt() {
  localIndex = 0; localPicks = {}; const pair = localPromptPairs[localPromptIndex++ % localPromptPairs.length]; const imposterIndex = Math.floor(Math.random() * localGame.players.length);
  localGame.pair = pair; localGame.imposterIndex = imposterIndex; localGame.players.forEach((player, index) => player.question = index === imposterIndex ? pair.imposter : pair.citizen); localMostLikelyPass();
}
function localMostLikelyPass() {
  const player = localGame.players[localIndex]; show('local-pass'); document.querySelector('#local-person').textContent = `Pass the device to ${player.name}`; document.querySelector('#local-reveal-prompt').textContent = 'Tap to reveal your private question'; document.querySelector('#local-word').textContent = ''; const choices = document.querySelector('#local-choice'); choices.innerHTML = ''; document.querySelector('#local-next').style.display = 'none';
  document.querySelector('#local-reveal').onclick = () => { document.querySelector('#local-word').textContent = player.question; choices.innerHTML = ''; localGame.players.forEach(p => addButton(choices, p.name, () => { localPicks[player.name] = p.name; localIndex++; if (localIndex < localGame.players.length) localMostLikelyPass(); else showLocalPromptResults(); })); };
}
function renderLocalAnswerList(list) {
  const totals = Object.fromEntries(localGame.players.map(player => [player.name, 0])); Object.values(localPicks).forEach(name => totals[name]++);
  localGame.players.forEach(player => { const picked = localPicks[player.name]; const li = document.createElement('li'); li.className = 'player-card answer-row'; li.append(document.createTextNode(`${player.name} picked `), Object.assign(document.createElement('strong'), { className: 'answer-target', textContent: picked })); const count = document.createElement('span'); count.className = 'answer-count'; count.textContent = `${totals[picked]} pick${totals[picked] === 1 ? '' : 's'}`; li.append(count); list.append(li); });
}
function showLocalPromptResults() {
  show('local-result'); document.querySelector('#local-result-card').className = 'results-card win'; document.querySelector('#local-result-title').textContent = 'Answers revealed'; document.querySelector('#local-result-text').textContent = 'Discuss the answers, then vote out the player with the different question.'; document.querySelector('#local-result-items').innerHTML = ''; const list = document.querySelector('#local-tally'); list.innerHTML = ''; renderLocalAnswerList(list); const vote = document.querySelector('#local-again'); vote.textContent = 'Vote out the imposter'; vote.onclick = localQuestionImposterVote;
}
function localQuestionImposterVote() { show('local-vote'); document.querySelector('#local-vote-title').textContent = 'Who had the different question?'; document.querySelector('#local-vote-subtitle').textContent = 'Agree on one player to vote out.'; const votes = document.querySelector('#local-votes'); votes.innerHTML = ''; localGame.players.forEach((p, index) => addButton(votes, p.name, () => showLocalQuestionResult(index))); }
function showLocalQuestionResult(accused) { const imposter = localGame.imposterIndex, won = accused === imposter; show('local-result'); document.querySelector('#local-result-card').className = `results-card ${won ? 'win' : 'lose'}`; document.querySelector('#local-result-title').textContent = won ? '🎉 Group found the imposter!' : '🕵️ The imposter blended in!'; document.querySelector('#local-result-text').textContent = `${localGame.players[imposter].name} had the different question.`; document.querySelector('#local-result-items').innerHTML = `<div class="word-chip"><span class="word-chip-label">Group question</span><span class="word-chip-value">${localGame.pair.citizen}</span></div><div class="word-chip word-chip-imposter"><span class="word-chip-label">Imposter question</span><span class="word-chip-value">${localGame.pair.imposter}</span></div>`; const list = document.querySelector('#local-tally'); list.innerHTML = ''; renderLocalAnswerList(list); const next = document.querySelector('#local-again'); next.textContent = 'Choose another game'; next.onclick = () => show('landing'); }

function restartLocalGame() {
  localIndex = 0; localPromptIndex = 0;
  if (selectedMode === 'most-likely') {
    localGame = { mode: selectedMode, players: localNames.map(name => ({ name })), totalRounds: 1 };
    startLocalPrompt();
    return;
  }
  const pair = selectedMode === 'word-imposter' ? WordPairs.getRandomPair() : localGifPairs[Math.floor(Math.random() * localGifPairs.length)];
  const imposter = Math.floor(Math.random() * localNames.length);
  localGame = { mode: selectedMode, pair, players: localNames.map((name, i) => ({ name, isImposter: i === imposter, item: i === imposter ? pair.imposter : pair.citizen })) };
  localPass();
}
function showLocalImposterResult(accused) {
  const imposter = localGame.players.findIndex(p => p.isImposter), won = accused === imposter; show('local-result'); document.querySelector('#local-result-card').className = `results-card ${won ? 'win' : 'lose'}`; document.querySelector('#local-result-title').textContent = won ? '🎉 Citizens win!' : '🕵️ Imposter wins!'; document.querySelector('#local-result-text').textContent = `${localGame.players[imposter].name} was the imposter.`; const items = document.querySelector('#local-result-items'); const citizen = localGame.players.find(p => !p.isImposter).item; items.innerHTML = localGame.mode === 'gif-imposter' ? `<div class="word-chip"><span class="word-chip-label">Citizen GIF</span><img class="gif-thumb" src="${citizen}"></div><div class="word-chip word-chip-imposter"><span class="word-chip-label">Imposter GIF</span><img class="gif-thumb" src="${localGame.players[imposter].item}"></div>` : `<div class="word-chip"><span class="word-chip-label">Citizen word</span><span class="word-chip-value">${citizen}</span></div><div class="word-chip word-chip-imposter"><span class="word-chip-label">Imposter word</span><span class="word-chip-value">${localGame.players[imposter].item}</span></div>`; document.querySelector('#local-tally').innerHTML = ''; document.querySelector('#local-again').textContent = 'Next game'; document.querySelector('#local-again').onclick = restartLocalGame; const choose = document.querySelector('#local-choose-game'); choose.style.display = 'block'; choose.onclick = () => show('landing');
}
function showLocalQuestionResult(accused) {
  const imposter = localGame.imposterIndex, won = accused === imposter; show('local-result'); document.querySelector('#local-result-card').className = `results-card ${won ? 'win' : 'lose'}`; document.querySelector('#local-result-title').textContent = won ? '🎉 Group found the imposter!' : '🕵️ The imposter blended in!'; document.querySelector('#local-result-text').textContent = `${localGame.players[imposter].name} had the different question.`; document.querySelector('#local-result-items').innerHTML = `<div class="word-chip"><span class="word-chip-label">Group question</span><span class="word-chip-value">${localGame.pair.citizen}</span></div><div class="word-chip word-chip-imposter"><span class="word-chip-label">Imposter question</span><span class="word-chip-value">${localGame.pair.imposter}</span></div>`; const list = document.querySelector('#local-tally'); list.innerHTML = ''; renderLocalAnswerList(list); document.querySelector('#local-again').textContent = 'Next game'; document.querySelector('#local-again').onclick = restartLocalGame; const choose = document.querySelector('#local-choose-game'); choose.style.display = 'block'; choose.onclick = () => show('landing');
}
function localPass() {
  const player = localGame.players[localIndex], isGif = localGame.mode === 'gif-imposter';
  show('local-pass'); document.querySelector('#local-person').textContent = `Pass the device to ${player.name}`;
  document.querySelector('#local-reveal-prompt').textContent = `Tap to reveal your ${isGif ? 'GIF' : 'word'}`;
  const item = document.querySelector('#local-word'); item.innerHTML = ''; document.querySelector('#local-choice').innerHTML = ''; document.querySelector('#local-next').style.display = 'none';
  document.querySelector('#local-reveal').onclick = () => { if (isGif) item.innerHTML = gifMarkup(player.item); else item.textContent = player.item; document.querySelector('#local-next').style.display = 'block'; };
}
function showLocalImposterResult(accused) {
  const imposter = localGame.players.findIndex(p => p.isImposter), won = accused === imposter, citizen = localGame.players.find(p => !p.isImposter).item;
  show('local-result'); document.querySelector('#local-result-card').className = `results-card ${won ? 'win' : 'lose'}`; document.querySelector('#local-result-title').textContent = won ? 'Citizens win!' : 'Imposter wins!'; document.querySelector('#local-result-text').textContent = `${localGame.players[imposter].name} was the imposter.`;
  const items = document.querySelector('#local-result-items'); items.innerHTML = localGame.mode === 'gif-imposter' ? `<div class="word-chip"><span class="word-chip-label">Citizen GIF</span>${gifMarkup(citizen, true)}</div><div class="word-chip word-chip-imposter"><span class="word-chip-label">Imposter GIF</span>${gifMarkup(localGame.players[imposter].item, true)}</div>` : `<div class="word-chip"><span class="word-chip-label">Citizen word</span><span class="word-chip-value">${citizen}</span></div><div class="word-chip word-chip-imposter"><span class="word-chip-label">Imposter word</span><span class="word-chip-value">${localGame.players[imposter].item}</span></div>`;
  document.querySelector('#local-tally').innerHTML = ''; document.querySelector('#local-again').textContent = 'Next game'; document.querySelector('#local-again').onclick = restartLocalGame; const choose = document.querySelector('#local-choose-game'); choose.style.display = 'block'; choose.onclick = () => show('landing');
}
show('landing', false);
