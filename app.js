const app = document.querySelector('#app');

const COLORS = ['#668473', '#b77870', '#7c88a0', '#c08d55', '#8a789e', '#558d90'];
const ART = [
  ['🌙', 'Księżycowy ogród', 'blue'], ['🗝️', 'Klucz do snu', 'gold'], ['🦊', 'Gość o zmierzchu', 'rose'],
  ['🚪', 'Drzwi donikąd', 'violet'], ['🪁', 'Wiatr w kieszeni', 'coral'], ['🐋', 'Cichy olbrzym', 'blue'],
  ['🌱', 'Mały początek', 'green'], ['🕰️', 'Zegar bez godzin', 'gold'], ['🕊️', 'List do chmur', 'rose'],
  ['🏮', 'Światło w oddali', 'coral'], ['🍄', 'Leśna tajemnica', 'violet'], ['🌊', 'Morze pod podłogą', 'blue'],
  ['🪞', 'Druga strona', 'violet'], ['🦋', 'Chwila wolności', 'coral'], ['🎭', 'Nie ta twarz', 'rose'],
  ['🌳', 'Dom, który pamięta', 'green'], ['🧭', 'Północ jest wszędzie', 'gold'], ['☁️', 'Pokój na niebie', 'blue'],
  ['🐈', 'Strażnik ciszy', 'violet'], ['🎈', 'Prawie odlot', 'coral'], ['🏰', 'Zamek z mgły', 'rose'],
  ['🔥', 'Ostatnie ognisko', 'gold'], ['💧', 'Kropla oceanu', 'blue'], ['🌸', 'Wiosna po północy', 'rose'],
  ['🪐', 'Mała planeta', 'violet'], ['🦌', 'Ślad w śniegu', 'green'], ['🎠', 'Karuzela wspomnień', 'coral'],
  ['🪶', 'Lekka jak słowo', 'gold'], ['🏝️', 'Wyspa na chwilę', 'blue'], ['🐚', 'Echo z daleka', 'rose'],
  ['🌆', 'Miasto zasypia', 'violet'], ['🧵', 'Nić przeznaczenia', 'coral'], ['⏳', 'Piasek i czas', 'gold'],
  ['🌻', 'Słońce dla siebie', 'green'], ['🚂', 'Pociąg do nikąd', 'blue'], ['🧚', 'Ktoś tu był', 'rose'],
];

const state = { view: 'setup', setupCount: 4, players: [], round: 1, storyteller: 0, deck: [], clue: '', selectedCardId: null, storyCardId: null, submissions: [], shuffledSubmissions: [], currentChooser: null, selectedSubmission: null, votes: [], result: null };

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createDeck() {
  const deck = [];
  for (let i = 0; i < 144; i += 1) {
    const artIndex = i % ART.length;
    deck.push({ id: i + 1, artIndex, emoji: ART[artIndex][0], title: ART[artIndex][1], tone: ART[artIndex][2] });
  }
  return shuffle(deck);
}

function drawCard() {
  if (state.deck.length === 0) state.deck = createDeck();
  return state.deck.pop();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'G';
}

function getCard(id) {
  for (const player of state.players) {
    const match = player.hand.find((card) => card.id === id);
    if (match) return match;
  }
  const submission = state.submissions.find((item) => item.card.id === id);
  return submission?.card || null;
}

function cardArt(card) {
  return `<div class="card-art" data-tone="${card.tone}"><span class="art-symbol" aria-hidden="true">${card.emoji}</span><span class="art-horizon" aria-hidden="true"></span></div>`;
}

function handCard(card, selectedId) {
  return `<button class="playing-card ${card.id === selectedId ? 'is-selected' : ''}" type="button" data-card-id="${card.id}" aria-pressed="${card.id === selectedId}">${cardArt(card)}<span class="card-foot"><span>${escapeHtml(card.title)}</span><span class="card-sparkle">✦</span></span></button>`;
}

function playerDot(player, index, className = 'player-dot') {
  return `<span class="${className}" style="background:${COLORS[index % COLORS.length]}">${escapeHtml(initials(player.name))}</span>`;
}

function renderSetup() {
  const inputs = Array.from({ length: state.setupCount }, (_, index) => `
    <label class="player-input-row">
      ${playerDot({ name: `Gracz ${index + 1}` }, index, 'player-avatar')}
      <input class="player-input" maxlength="20" name="player-${index}" value="Gracz ${index + 1}" aria-label="Imię gracza ${index + 1}" />
    </label>`).join('');
  const heroCards = [ART[0], ART[10], ART[4]].map((item, index) => `<div class="hero-card hero-card-${['one', 'two', 'three'][index]}"><div class="card-art" data-tone="${item[2]}"><span class="art-symbol">${item[0]}</span><span class="art-horizon"></span></div></div>`).join('');
  return `
    <div class="setup-layout">
      <section class="hero-copy">
        <span class="eyebrow">Gra skojarzeń dla wyobraźni</span>
        <h1 class="serif">Jedno słowo.<br /><em>Wiele światów.</em></h1>
        <p>Wybierz obraz, opowiedz skojarzenie i sprawdź, kto odczyta je tak jak Ty. Czasem najprostsza wskazówka mówi najwięcej.</p>
        <div class="hero-decor" aria-hidden="true">${heroCards}</div>
      </section>
      <section class="setup-card">
        <span class="eyebrow">Przygotujcie się</span>
        <h2>Przy jednym ekranie</h2>
        <p class="setup-intro">Podajcie sobie urządzenie. Każdy zagra z własną ręką kart — bez kont i bez pośpiechu.</p>
        <span class="field-label">Ilu was gra?</span>
        <div class="count-picker" role="group" aria-label="Liczba graczy">
          ${[3, 4, 5, 6].map((count) => `<button type="button" class="count-option ${state.setupCount === count ? 'is-active' : ''}" data-action="count" data-count="${count}" aria-pressed="${state.setupCount === count}"><strong>${count}</strong> osoby</button>`).join('')}
        </div>
        <span class="field-label">Imiona graczy</span>
        <div class="player-inputs">${inputs}</div>
        <button type="button" class="primary-button" data-action="start">Rozpocznij grę <span aria-hidden="true">→</span></button>
        <p class="micro-copy">Około 30 minut · najlepiej z dźwiękiem i wyobraźnią</p>
      </section>
    </div>`;
}

function renderScoreboard() {
  const players = state.players.map((player, index) => ({ player, index })).sort((a, b) => b.player.score - a.player.score);
  return `<aside class="scoreboard"><div class="scoreboard-head"><h2>Punkty</h2><span>cel: 30</span></div><div class="score-list">${players.map(({ player, index }) => `
    <div class="score-row">${playerDot(player, index)}<div class="score-name">${escapeHtml(player.name)}${state.storyteller === index ? '<span class="storyteller-label">opowiada</span>' : ''}<div class="score-track"><span style="width:${Math.min(player.score / 30 * 100, 100)}%"></span></div></div><span class="score-number">${player.score}</span></div>`).join('')}</div><p class="rules-note">Zdobywaj punkty za trafne skojarzenia i głosy oddane na Twoją kartę. Do zwycięstwa prowadzi wynik 30 punktów.</p></aside>`;
}

function renderGameShell(content, stage, title) {
  return `<div class="game-layout"><section class="game-content"><div class="game-heading"><div><span class="eyebrow">Runda ${state.round} · ${stage}</span><h1>${title}</h1></div><div class="round-pill"><span>Opowiada</span><strong>${escapeHtml(state.players[state.storyteller].name)}</strong></div></div>${content}</section>${renderScoreboard()}</div>`;
}

function renderClue() {
  const storyteller = state.players[state.storyteller];
  const selected = getCard(state.selectedCardId);
  const content = `<section class="stage-card"><div class="stage-topline"><span class="eyebrow">Etap 1 z 3</span><span class="step-count">wybór obrazu</span></div><h2>Wybierz kartę i daj jej głos</h2><p class="stage-description">Opowiadający wybiera z ręki obraz, który pasuje do jego wskazówki. Niech będzie intrygująca — ale nie zbyt oczywista.</p><div class="storyteller-chip">${playerDot(storyteller, state.storyteller)}<span>${escapeHtml(storyteller.name)} opowiada w tej rundzie</span></div><div class="hand-wrap"><p class="hand-caption">Twoje karty — wybierz jedną</p><div class="cards-row">${storyteller.hand.map((card) => handCard(card, state.selectedCardId)).join('')}</div></div><div class="clue-form"><input class="clue-input" id="clue-input" maxlength="80" placeholder="Wpisz skojarzenie…" value="${escapeHtml(state.clue)}" aria-label="Skojarzenie do karty" /><button class="primary-button" data-action="submit-clue" ${!selected || !state.clue.trim() ? 'disabled' : ''}>Podaj wskazówkę <span aria-hidden="true">→</span></button></div></section>`;
  return renderGameShell(content, 'wybór skojarzenia', 'Niech obraz opowie historię');
}

function renderSubmissions() {
  const playerIndex = state.currentChooser;
  const player = state.players[playerIndex];
  const chooserNumber = state.submissions.length;
  const content = `<section class="stage-card"><div class="stage-topline"><span class="eyebrow">Etap 2 z 3</span><span class="step-count">karty ${state.submissions.length} / ${state.players.length}</span></div><h2>Znajdź obraz, który pasuje</h2><p class="stage-description">Wybierz kartę z własnej ręki, która Twoim zdaniem mogłaby pasować do podanej wskazówki. Pozostali nie mogą jej teraz zobaczyć.</p><div class="clue-banner"><small>Skojarzenie</small>${escapeHtml(state.clue)}</div><div class="pass-panel"><span class="pass-icon" aria-hidden="true">↗</span><div><strong>Teraz Ty, ${escapeHtml(player.name)}</strong><span>Przekaż urządzenie tej osobie. Wybierz kartę i zatwierdź — wybór pozostanie tajny.</span></div></div><div class="hand-wrap"><p class="hand-caption">Twoje karty — wybierz jedną</p><div class="cards-row">${player.hand.map((card) => handCard(card, state.selectedCardId)).join('')}</div></div><button class="primary-button stage-action" data-action="submit-card" ${!state.selectedCardId ? 'disabled' : ''}>Zagraj tę kartę <span aria-hidden="true">→</span></button></section>`;
  return renderGameShell(content, 'tajny wybór', 'Który obraz pasuje?');
}

function voteOrder() { return state.players.map((_, i) => i).filter((i) => i !== state.storyteller); }

function renderVote() {
  const player = state.players[state.currentChooser];
  const mySubmission = state.shuffledSubmissions.findIndex((submission) => submission.playerIndex === state.currentChooser);
  const content = `<section class="stage-card"><div class="stage-topline"><span class="eyebrow">Etap 3 z 3</span><span class="step-count">głos ${state.votes.length + 1} / ${state.players.length - 1}</span></div><h2>Którą kartę wybrał opowiadający?</h2><p class="stage-description">Głosują wszyscy poza opowiadającym. Nie głosuj na swoją kartę — wybierz tę, która Twoim zdaniem należy do ${escapeHtml(state.players[state.storyteller].name)}.</p><div class="clue-banner"><small>Skojarzenie</small>${escapeHtml(state.clue)}</div><div class="pass-panel"><span class="pass-icon" aria-hidden="true">◉</span><div><strong>Głos oddaje: ${escapeHtml(player.name)}</strong><span>Niech ta osoba podejdzie do ekranu. Pozostałe karty są anonimowe.</span></div></div><div class="vote-grid">${state.shuffledSubmissions.map((submission, index) => `<button type="button" class="vote-card ${state.selectedSubmission === index ? 'is-selected' : ''}" data-submission-index="${index}" ${index === mySubmission ? 'disabled aria-label="Twoja karta — nie możesz na nią głosować"' : `aria-label="Głos na kartę ${index + 1}"`} aria-pressed="${state.selectedSubmission === index}">${cardArt(submission.card)}<span class="vote-number">${index + 1}</span></button>`).join('')}</div><p class="vote-hint">${mySubmission >= 0 ? 'Twoja karta jest przygaszona — nie możesz na nią głosować.' : 'Wybierz kartę opowiadającego.'}</p><button class="primary-button stage-action" data-action="submit-vote" ${state.selectedSubmission === null ? 'disabled' : ''}>Oddaj głos <span aria-hidden="true">→</span></button></section>`;
  return renderGameShell(content, 'głosowanie', 'Zgadnij, kto opowiada');
}

function renderResults() {
  const result = state.result;
  const ended = state.players.some((player) => player.score >= 30);
  const winners = state.players.filter((player) => player.score === Math.max(...state.players.map((item) => item.score)));
  const cards = state.shuffledSubmissions.map((submission, index) => {
    const count = result.voteCounts[index];
    const correct = index === result.storyIndex;
    return `<div class="result-card-wrap"><div class="reveal-card">${cardArt(submission.card)}</div><div class="result-owner">${playerDot(state.players[submission.playerIndex], submission.playerIndex)}<span>${escapeHtml(state.players[submission.playerIndex].name)}</span></div><span class="vote-count ${correct ? 'is-correct' : ''}">${count} ${count === 1 ? 'głos' : count > 1 && count < 5 ? 'głosy' : 'głosów'}${correct ? ' · karta opowiadającego' : ''}</span></div>`;
  }).join('');
  const status = result.correctVotes === 0 || result.correctVotes === state.players.length - 1
    ? 'Nie wszyscy trafili — w tej rundzie reszta drużyny dostaje po 2 punkty.'
    : `${result.correctVotes} ${result.correctVotes === 1 ? 'osoba odgadła' : 'osoby odgadły'} kartę opowiadającego.`;
  const changes = result.points.map((points, index) => `<div class="score-change"><strong>${escapeHtml(state.players[index].name)}</strong><span>+${points} pkt</span></div>`).join('');
  const gameOver = ended ? `<div class="game-over"><div class="trophy" aria-hidden="true">✦</div><h3>${winners.length === 1 ? `Wygrywa ${escapeHtml(winners[0].name)}!` : `Remis: ${winners.map((player) => escapeHtml(player.name)).join(' i ')}`}</h3><p>${winners.length === 1 ? 'Świetnie odczytane obrazy i opowieści.' : 'Piękny finał — wyobraźnia była po obu stronach.'}</p></div>` : '';
  const content = `<section class="stage-card"><div class="stage-topline"><span class="eyebrow">Wyniki rundy ${state.round}</span><span class="step-count">odsłaniamy karty</span></div><h2>${result.correctVotes > 0 && result.correctVotes < state.players.length - 1 ? 'Dobrze opowiedziana historia' : 'Tym razem obraz zaskoczył'}</h2><p class="stage-description">${status}</p><div class="clue-banner"><small>Skojarzenie ${escapeHtml(state.players[state.storyteller].name)}</small>${escapeHtml(state.clue)}</div><div class="result-grid">${cards}</div><div class="result-summary">${result.correctVotes > 0 && result.correctVotes < state.players.length - 1 ? '<span class="summary-success">Opowiadający i trafne głosy: +3 pkt</span>' : '<span>Cała drużyna poza opowiadającym: +2 pkt</span>'}<span>Za każdy głos na Twoją kartę: +1 pkt</span></div><div class="results-card"><h3>Punkty zdobyte w tej rundzie</h3><div class="score-changes">${changes}</div></div>${gameOver}<div class="result-actions"><button class="primary-button" data-action="${ended ? 'restart' : 'next'}">${ended ? 'Zagraj nową partię' : 'Następna runda'} <span aria-hidden="true">→</span></button></div></section>`;
  return renderGameShell(content, ended ? 'koniec partii' : 'podsumowanie', ended ? 'Mamy zwycięzcę!' : 'Zobaczmy, jak poszło');
}

function render() {
  if (state.view === 'setup') app.innerHTML = renderSetup();
  else if (state.view === 'clue') app.innerHTML = renderClue();
  else if (state.view === 'submit') app.innerHTML = renderSubmissions();
  else if (state.view === 'vote') app.innerHTML = renderVote();
  else if (state.view === 'result') app.innerHTML = renderResults();
}

function startGame(names) {
  state.players = names.map((name) => ({ name: name.trim() || 'Gracz', score: 0, hand: [] }));
  state.deck = createDeck();
  state.players.forEach((player) => { player.hand = Array.from({ length: 6 }, drawCard); });
  state.round = 1;
  state.storyteller = Math.floor(Math.random() * state.players.length);
  state.clue = '';
  state.selectedCardId = null;
  state.storyCardId = null;
  state.submissions = [];
  state.shuffledSubmissions = [];
  state.votes = [];
  state.result = null;
  state.view = 'clue';
  render();
}

function nextChooserAfter(currentIndex, excludedIndex) {
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const candidate = (currentIndex + offset) % state.players.length;
    if (candidate !== excludedIndex) return candidate;
  }
  return null;
}

function finishSubmissions() {
  state.shuffledSubmissions = shuffle(state.submissions);
  state.votes = [];
  state.selectedSubmission = null;
  state.currentChooser = voteOrder()[0];
  state.view = 'vote';
}

function castVote() {
  const voterIndex = state.currentChooser;
  state.votes.push({ voterIndex, submissionIndex: state.selectedSubmission });
  state.selectedSubmission = null;
  const voters = voteOrder();
  if (state.votes.length < voters.length) {
    state.currentChooser = voters[state.votes.length];
    return;
  }
  scoreRound();
}

function scoreRound() {
  const storyIndex = state.shuffledSubmissions.findIndex((submission) => submission.playerIndex === state.storyteller);
  const voteCounts = state.shuffledSubmissions.map((_, index) => state.votes.filter((vote) => vote.submissionIndex === index).length);
  const correctVotes = voteCounts[storyIndex];
  const points = state.players.map(() => 0);
  if (correctVotes === 0 || correctVotes === state.players.length - 1) {
    state.players.forEach((_, index) => { if (index !== state.storyteller) points[index] += 2; });
  } else {
    points[state.storyteller] += 3;
    state.votes.forEach((vote) => { if (vote.submissionIndex === storyIndex) points[vote.voterIndex] += 3; });
  }
  voteCounts.forEach((count, submissionIndex) => {
    const owner = state.shuffledSubmissions[submissionIndex].playerIndex;
    if (owner !== state.storyteller) points[owner] += Math.min(count, 3);
  });
  points.forEach((amount, index) => { state.players[index].score += amount; });
  state.result = { storyIndex, voteCounts, correctVotes, points };
  state.view = 'result';
}

function beginNextRound() {
  for (const submission of state.submissions) {
    const player = state.players[submission.playerIndex];
    player.hand = player.hand.filter((card) => card.id !== submission.card.id);
    player.hand.push(drawCard());
  }
  state.round += 1;
  state.storyteller = (state.storyteller + 1) % state.players.length;
  state.clue = '';
  state.selectedCardId = null;
  state.storyCardId = null;
  state.submissions = [];
  state.shuffledSubmissions = [];
  state.votes = [];
  state.result = null;
  state.view = 'clue';
}

app.addEventListener('input', (event) => {
  if (event.target.id === 'clue-input') {
    state.clue = event.target.value;
    const button = app.querySelector('[data-action="submit-clue"]');
    if (button) button.disabled = !state.selectedCardId || !state.clue.trim();
  }
});

app.addEventListener('click', (event) => {
  const countButton = event.target.closest('[data-action="count"]');
  if (countButton) {
    state.setupCount = Number(countButton.dataset.count);
    render();
    return;
  }

  const cardButton = event.target.closest('[data-card-id]');
  if (cardButton) {
    state.selectedCardId = Number(cardButton.dataset.cardId);
    render();
    if (state.view === 'clue') app.querySelector('#clue-input')?.focus();
    return;
  }

  const submissionButton = event.target.closest('[data-submission-index]');
  if (submissionButton && !submissionButton.disabled) {
    state.selectedSubmission = Number(submissionButton.dataset.submissionIndex);
    render();
    return;
  }

  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'start') {
    const names = [...app.querySelectorAll('.player-input')].map((input) => input.value);
    startGame(names);
  } else if (action === 'submit-clue') {
    if (!state.selectedCardId || !state.clue.trim()) return;
    const card = getCard(state.selectedCardId);
    state.storyCardId = card.id;
    state.submissions = [{ playerIndex: state.storyteller, card }];
    state.currentChooser = nextChooserAfter(state.storyteller, state.storyteller);
    state.selectedCardId = null;
    state.view = 'submit';
    render();
  } else if (action === 'submit-card') {
    if (!state.selectedCardId) return;
    const card = getCard(state.selectedCardId);
    state.submissions.push({ playerIndex: state.currentChooser, card });
    const previousChooser = state.currentChooser;
    if (state.submissions.length === state.players.length) {
      finishSubmissions();
    } else {
      state.currentChooser = nextChooserAfter(previousChooser, state.storyteller);
      state.selectedCardId = null;
    }
    render();
  } else if (action === 'submit-vote') {
    if (state.selectedSubmission === null) return;
    castVote();
    render();
  } else if (action === 'next') {
    beginNextRound();
    render();
  } else if (action === 'restart') {
    const names = state.players.map((player) => player.name);
    startGame(names);
  }
});

render();
