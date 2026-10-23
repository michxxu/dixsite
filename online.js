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

const roomFromUrl = new URLSearchParams(window.location.search).get('room');
const network = {
  peer: null,
  isHost: false,
  roomId: roomFromUrl,
  playerId: null,
  name: '',
  game: null,
  hand: [],
  deck: [],
  discardPile: [],
  cardSerial: 0,
  heartbeatTimer: null,
  lastSeen: new Map(),
  lastHostPingAt: 0,
  connections: new Map(),
  peerToPlayer: new Map(),
  connection: null,
  selectedCardId: null,
  selectedSubmission: null,
  clueDraft: '',
  inviteUrl: '',
  error: '',
  note: '',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isPublicHttpsPage() {
  return window.location.protocol === 'https:';
}

function initials(name) {
  return String(name || '').trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'G';
}

function cleanName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 20) || 'Gracz';
}

function getPlayer(id) {
  return network.game?.players.find((player) => player.id === id) || { id, name: 'Gracz', score: 0, connected: false };
}

function playerDot(player, index, className = 'player-dot') {
  return `<span class="${className}" style="background:${COLORS[index % COLORS.length]}">${escapeHtml(initials(player.name))}</span>`;
}

function cardArt(card) {
  return `<div class="card-art" data-tone="${escapeHtml(card.tone)}"><span class="art-symbol" aria-hidden="true">${card.emoji}</span><span class="art-horizon" aria-hidden="true"></span></div>`;
}

function handCard(card) {
  return `<button class="playing-card ${network.selectedCardId === card.id ? 'is-selected' : ''}" type="button" data-card-id="${escapeHtml(card.id)}" aria-pressed="${network.selectedCardId === card.id}">${cardArt(card)}<span class="card-foot"><span>${escapeHtml(card.title)}</span><span class="card-sparkle">✦</span></span></button>`;
}

function createDeck() {
  const deck = ART.map((item) => ({ id: `card-${++network.cardSerial}`, emoji: item[0], title: item[1], tone: item[2] }));
  return shuffle(deck);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function drawCard() {
  if (!network.deck.length) {
    if (network.discardPile.length) {
      network.deck = shuffle(network.discardPile);
      network.discardPile = [];
    } else {
      network.deck = createDeck();
    }
  }
  return network.deck.pop();
}

function cardsPerNonStoryteller(game = network.game) {
  return game?.players?.length === 3 ? 2 : 1;
}

function expectedSubmissionCount(game = network.game) {
  return 1 + Math.max(0, game.activePlayerIds.length - 1) * cardsPerNonStoryteller(game);
}

function countPlayerSubmissions(playerId, game = network.game) {
  return game.submissions.filter((submission) => submission.ownerId === playerId).length;
}

function publicGameSnapshot() {
  return JSON.parse(JSON.stringify(network.game));
}

function renderMessage() {
  if (network.error) return `<p class="error-message" role="alert">${escapeHtml(network.error)}</p>`;
  if (network.note) return `<p class="online-note" role="status">${escapeHtml(network.note)}</p>`;
  return '';
}

function renderHome() {
  const canInvite = isPublicHttpsPage();
  const peerUnavailable = !window.Peer;
  app.innerHTML = `
    <div class="setup-layout">
      <section class="hero-copy">
        <span class="eyebrow">Gra skojarzeń · online</span>
        <h1 class="serif">Jedno słowo.<br /><em>Wiele światów.</em></h1>
        <p>Utwórz pokój i wyślij link znajomym. Każdy gra na swoim urządzeniu, a karty i punkty synchronizują się na bieżąco.</p>
        <div class="hero-decor" aria-hidden="true">
          ${[['🌙', 'blue'], ['🍄', 'violet'], ['🪁', 'coral']].map((item, index) => `<div class="hero-card hero-card-${['one', 'two', 'three'][index]}"><div class="card-art" data-tone="${item[1]}"><span class="art-symbol">${item[0]}</span><span class="art-horizon"></span></div></div>`).join('')}
        </div>
      </section>
      <section class="setup-card">
        <span class="eyebrow">Wasz prywatny pokój</span>
        <h2>Zagrajcie razem</h2>
        <p class="setup-intro">3–6 graczy · każdy na swoim urządzeniu · bez zakładania konta</p>
        <label class="field-label" for="player-name">Twoje imię</label>
        <input class="player-input room-name-input" id="player-name" maxlength="20" placeholder="np. Ania" autocomplete="nickname" />
        ${renderMessage()}
        ${!canInvite ? '<div class="room-warning"><strong>Najpierw opublikuj stronę</strong><span>Otwierasz lokalny plik. Link zadziała dla znajomych dopiero po umieszczeniu gry pod publicznym adresem HTTPS. Można to zrobić bezpłatnie.</span></div>' : ''}
        ${peerUnavailable ? '<div class="room-warning"><strong>Nie udało się załadować połączenia online</strong><span>Odśwież stronę z dostępem do internetu i spróbuj ponownie.</span></div>' : ''}
        <button type="button" class="primary-button" data-action="create-room" ${!canInvite || peerUnavailable ? 'disabled' : ''}>Utwórz nowy pokój <span aria-hidden="true">→</span></button>
        <p class="micro-copy">Gdy utworzysz pokój, skopiujesz link i wyślesz go pozostałym.</p>
      </section>
    </div>`;
}

function renderJoin() {
  app.innerHTML = `
    <div class="join-layout">
      <section class="setup-card join-card">
        <span class="eyebrow">Zaproszenie do gry</span>
        <h2>Dołącz do pokoju</h2>
        <p class="setup-intro">Pokój <span class="room-code">${escapeHtml(network.roomId)}</span> czeka na graczy. Wpisz imię i dołącz.</p>
        <label class="field-label" for="player-name">Twoje imię</label>
        <input class="player-input room-name-input" id="player-name" maxlength="20" placeholder="np. Ania" autocomplete="nickname" />
        ${renderMessage()}
        ${!window.Peer ? '<div class="room-warning"><strong>Połączenie online jest niedostępne</strong><span>Odśwież stronę z dostępem do internetu i spróbuj ponownie.</span></div>' : ''}
        <button type="button" class="primary-button" data-action="join-room" ${!window.Peer ? 'disabled' : ''}>Dołącz do gry <span aria-hidden="true">→</span></button>
        <p class="micro-copy">Potrzebujesz stabilnego połączenia internetowego.</p>
      </section>
    </div>`;
}

function renderPlayerList() {
  return network.game.players.map((player, index) => `<div class="room-player-row ${player.connected ? '' : 'is-offline'}">${playerDot(player, index)}<div class="room-player-name">${escapeHtml(player.name)}${player.id === network.game.hostId ? '<span class="host-label">gospodarz</span>' : ''}</div><span class="connection-label">${player.connected ? 'online' : 'rozłączony'}</span></div>`).join('');
}

function renderLobby() {
  const playerCount = network.game.players.length;
  const connectedCount = network.game.players.filter((player) => network.isHost ? (player.id === network.game.hostId || Boolean(network.connections.get(player.id)?.open)) : player.connected).length;
  const isHost = network.isHost;
  app.innerHTML = `
    <div class="join-layout"><section class="setup-card lobby-card">
      <div class="lobby-top"><div><span class="eyebrow">Pokój online</span><h2>${isHost ? 'Pokój jest gotowy' : 'Dołączono do pokoju'}</h2></div><span class="online-pill"><span class="status-dot"></span> połączono</span></div>
      <p class="setup-intro">${isHost ? 'Wyślij link znajomym i poczekaj, aż dołączą. Zostaw tę kartę otwartą podczas gry.' : 'Czekasz na gospodarza. Gdy rozpocznie partię, gra ruszy również u Ciebie.'}</p>
      ${isHost ? `<label class="field-label" for="invite-url">Link dla graczy</label><div class="room-link-row"><input id="invite-url" class="player-input" readonly value="${escapeHtml(network.inviteUrl)}" /><button type="button" class="secondary-button copy-button" data-action="copy-link">Kopiuj link</button></div>` : ''}
      ${renderMessage()}
      <div class="room-player-head"><span class="field-label">Gracze</span><span>${connectedCount} połączonych · ${playerCount} / 6 miejsc</span></div>
      <div class="room-player-list">${renderPlayerList()}</div>
      <div class="lobby-actions">${isHost ? `<button type="button" class="primary-button" data-action="start-game" ${connectedCount < 3 ? 'disabled' : ''}>Rozpocznij grę <span aria-hidden="true">→</span></button>` : ''}<button type="button" class="text-button" data-action="leave-room">Opuść pokój</button></div>
      ${isHost && connectedCount < 3 ? `<p class="micro-copy">Do startu potrzeba 3 połączonych graczy. Teraz jest ${connectedCount}.</p>` : ''}
      ${isHost ? '<p class="micro-copy">Gospodarz musi pozostać na stronie, aby pokój działał.</p>' : ''}
    </section></div>`;
}

function renderScoreboard() {
  const game = network.game;
  const sorted = [...game.players].sort((a, b) => b.score - a.score);
  return `<aside class="scoreboard"><div class="scoreboard-head"><h2>Punkty</h2><span>cel: 30</span></div><div class="score-list">${sorted.map((player) => {
    const index = game.players.findIndex((item) => item.id === player.id);
    return `<div class="score-row">${playerDot(player, index)}<div class="score-name">${escapeHtml(player.name)}${game.storytellerId === player.id ? '<span class="storyteller-label">opowiada</span>' : ''}<div class="score-track"><span style="width:${Math.min(player.score / 30 * 100, 100)}%"></span></div></div><span class="score-number">${player.score}</span></div>`;
  }).join('')}</div><p class="rules-note">Narrator i trafiający zdobywają po 3 pkt, gdy część graczy zgadnie. Gdy zgadną wszyscy albo nikt: pozostali dostają po 2 pkt. Każdy głos na Twoją kartę to +1 pkt. Przy 3 graczach pozostali zagrywają po 2 karty.</p></aside>`;
}

function renderGameShell(content, stage, title) {
  const storyteller = getPlayer(network.game.storytellerId);
  return `<div class="game-layout"><section class="game-content"><div class="game-heading"><div><span class="eyebrow">Runda ${network.game.round} · ${stage}</span><h1>${title}</h1></div><div class="round-pill"><span>Opowiada</span><strong>${escapeHtml(storyteller.name)}</strong></div></div>${renderMessage()}${content}</section>${renderScoreboard()}</div>`;
}

function renderWaitingMessage(playerId, message) {
  const player = getPlayer(playerId);
  return `<div class="pass-panel"><span class="pass-icon" aria-hidden="true">◷</span><div><strong>${escapeHtml(player.name)}</strong><span>${message}</span></div></div>`;
}

function renderHand() {
  return `<div class="hand-wrap"><p class="hand-caption">Twoje karty — wybierz jedną</p><div class="cards-row">${network.hand.map(handCard).join('')}</div></div>`;
}

function renderCluePhase() {
  const isMyTurn = network.playerId === network.game.storytellerId;
  const content = `<section class="stage-card"><div class="stage-topline"><span class="eyebrow">Etap 1 z 3</span><span class="step-count">wybór skojarzenia</span></div><h2>Wybierz obraz i wymyśl wskazówkę</h2><p class="stage-description">Wybierz kartę z ręki i wpisz skojarzenie, które mogą odczytać inni gracze.</p>${isMyTurn ? `${renderHand()}<div class="clue-form"><input class="clue-input" id="clue-input" maxlength="80" placeholder="Wpisz skojarzenie…" value="${escapeHtml(network.clueDraft)}" aria-label="Skojarzenie do karty" /><button class="primary-button" data-action="submit-clue" ${!network.selectedCardId || !network.clueDraft.trim() ? 'disabled' : ''}>Podaj wskazówkę <span aria-hidden="true">→</span></button></div>` : renderWaitingMessage(network.game.storytellerId, 'Wybiera kartę i układa skojarzenie. Za chwilę zobaczysz jego wskazówkę.')}</section>`;
  return renderGameShell(content, 'opowieść', 'Niech obraz opowie historię');
}

function renderSubmitPhase() {
  const game = network.game;
  const current = game.turnPlayerId;
  const isMyTurn = current === network.playerId;
  const expected = expectedSubmissionCount(game);
  const cardsNeeded = cardsPerNonStoryteller(game);
  const alreadyPlayed = countPlayerSubmissions(current, game);
  const leftForCurrent = Math.max(0, cardsNeeded - alreadyPlayed);
  const threePlayerRule = cardsNeeded === 2 ? ' W grze trzyosobowej każdy poza narratorem zagrywa po dwie karty.' : '';
  const waitingText = leftForCurrent > 1
    ? `Zagra jeszcze ${leftForCurrent} karty.`
    : 'Wybiera swoją kartę. Gdy ją zagra, przejdzie kolej na następną osobę.';
  const content = `<section class="stage-card"><div class="stage-topline"><span class="eyebrow">Etap 2 z 3</span><span class="step-count">${game.submissions.length} / ${expected} kart</span></div><h2>Znajdź obraz pasujący do wskazówki</h2><p class="stage-description">Zagraj kartę ze swojej ręki. Pozostali nie zobaczą, kto ją wybrał.${threePlayerRule}</p><div class="clue-banner"><small>Skojarzenie</small>${escapeHtml(game.clue)}</div>${isMyTurn ? `${renderHand()}<button class="primary-button stage-action" data-action="submit-card" ${!network.selectedCardId ? 'disabled' : ''}>Zagraj kartę${cardsNeeded === 2 ? ` (pozostało ${leftForCurrent})` : ''} <span aria-hidden="true">→</span></button>` : renderWaitingMessage(current, waitingText)}</section>`;
  return renderGameShell(content, 'tajny wybór kart', 'Który obraz pasuje?');
}

function renderVotePhase() {
  const current = network.game.turnPlayerId;
  const isMyTurn = current === network.playerId;
  const mySubmission = network.game.submissions.findIndex((submission) => submission.ownerId === network.playerId);
  const content = `<section class="stage-card"><div class="stage-topline"><span class="eyebrow">Etap 3 z 3</span><span class="step-count">${network.game.votes.length + 1} / ${network.game.voteOrder.length} głosów</span></div><h2>Którą kartę wybrał opowiadający?</h2><p class="stage-description">Wybierz kartę, która Twoim zdaniem należy do opowiadającego. Nie możesz głosować na własną.</p><div class="clue-banner"><small>Skojarzenie</small>${escapeHtml(network.game.clue)}</div>${isMyTurn ? `<div class="vote-grid">${network.game.submissions.map((submission, index) => `<button type="button" class="vote-card ${network.selectedSubmission === index ? 'is-selected' : ''}" data-submission-index="${index}" ${index === mySubmission ? 'disabled' : ''} aria-pressed="${network.selectedSubmission === index}">${cardArt(submission.card)}<span class="vote-number">${index + 1}</span></button>`).join('')}</div><p class="vote-hint">${mySubmission >= 0 ? 'Twoja karta jest przygaszona.' : 'Wskaż kartę opowiadającego.'}</p><button class="primary-button stage-action" data-action="submit-vote" ${network.selectedSubmission === null ? 'disabled' : ''}>Oddaj głos <span aria-hidden="true">→</span></button>` : renderWaitingMessage(current, 'Oddaje głos. Wyniki pojawią się, gdy wszyscy zagłosują.')}</section>`;
  return renderGameShell(content, 'głosowanie', 'Zgadnij, kto opowiada');
}

function renderResults() {
  const result = network.game.result;
  const winners = network.game.players.filter((player) => player.score >= 30);
  const ended = winners.length > 0;
  const cards = network.game.submissions.map((submission, index) => {
    const player = getPlayer(submission.ownerId);
    const playerIndex = network.game.players.findIndex((item) => item.id === player.id);
    const isCorrect = index === result.storyIndex;
    const count = result.voteCounts[index];
    const noun = count === 1 ? 'głos' : count > 1 && count < 5 ? 'głosy' : 'głosów';
    return `<div class="result-card-wrap"><div class="reveal-card">${cardArt(submission.card)}</div><div class="result-owner">${playerDot(player, playerIndex)}<span>${escapeHtml(player.name)}</span></div><span class="vote-count ${isCorrect ? 'is-correct' : ''}">${count} ${noun}${isCorrect ? ' · karta opowiadającego' : ''}</span></div>`;
  }).join('');
  const points = network.game.players.map((player) => `<div class="score-change"><strong>${escapeHtml(player.name)}</strong><span>+${result.points[player.id] || 0} pkt</span></div>`).join('');
  const correctCount = result.correctVotes;
  const special = correctCount === 0 || correctCount === network.game.voteOrder.length;
  const heading = special ? 'Tym razem obraz zaskoczył' : 'Dobrze opowiedziana historia';
  const description = special ? 'Nikt albo wszyscy trafili — wszyscy poza opowiadającym dostają po 2 punkty.' : `${correctCount} graczy odgadło kartę opowiadającego.`;
  const ending = ended ? `<div class="game-over"><div class="trophy" aria-hidden="true">✦</div><h3>${winners.length === 1 ? `Wygrywa ${escapeHtml(winners[0].name)}!` : `Remis: ${winners.map((player) => escapeHtml(player.name)).join(' i ')}`}</h3><p>Partia dobiegła końca.</p></div>` : '';
  const action = network.isHost ? `<div class="result-actions"><button class="primary-button" data-action="${ended ? 'restart-game' : 'next-round'}">${ended ? 'Nowa partia' : 'Następna runda'} <span aria-hidden="true">→</span></button></div>` : '<p class="micro-copy">Gospodarz rozpocznie następną rundę.</p>';
  const content = `<section class="stage-card"><div class="stage-topline"><span class="eyebrow">Wyniki rundy ${network.game.round}</span><span class="step-count">odsłaniamy karty</span></div><h2>${heading}</h2><p class="stage-description">${description}</p><div class="clue-banner"><small>Skojarzenie ${escapeHtml(getPlayer(network.game.storytellerId).name)}</small>${escapeHtml(network.game.clue)}</div><div class="result-grid">${cards}</div><div class="results-card"><h3>Punkty w tej rundzie</h3><div class="score-changes">${points}</div></div>${ending}${action}</section>`;
  return renderGameShell(content, ended ? 'koniec partii' : 'wyniki', ended ? 'Mamy zwycięzcę!' : 'Zobaczmy, jak poszło');
}

function renderGame() {
  if (network.game.phase === 'lobby') return renderLobby();
  if (network.game.phase === 'clue') return renderCluePhase();
  if (network.game.phase === 'submit') return renderSubmitPhase();
  if (network.game.phase === 'vote') return renderVotePhase();
  if (network.game.phase === 'result') return renderResults();
  app.innerHTML = '<div class="empty-state">Ładowanie pokoju…</div>';
}

function render() {
  if (network.game) renderGame();
  else if (network.roomId) renderJoin();
  else renderHome();
}

function createLobbyState(hostId, hostName) {
  return {
    hostId,
    phase: 'lobby',
    round: 0,
    players: [{ id: hostId, name: hostName, score: 0, connected: true }],
    activePlayerIds: [],
    storytellerId: null,
    clue: '',
    submissions: [],
    votes: [],
    voteOrder: [],
    turnPlayerId: null,
    result: null,
  };
}

function createPeer() {
  if (!window.Peer) throw new Error('PeerJS nie został wczytany. Sprawdź internet i odśwież stronę.');
  return new window.Peer();
}

function createRoom(name) {
  if (!isPublicHttpsPage()) {
    network.error = 'Aby wygenerować link działający u innych graczy, najpierw opublikuj stronę pod adresem HTTPS.';
    render();
    return;
  }
  network.error = '';
  network.note = 'Tworzę pokój…';
  network.name = cleanName(name);
  network.isHost = true;
  render();
  try {
    const peer = createPeer();
    network.peer = peer;
    peer.on('connection', registerHostConnection);
    peer.on('open', (id) => {
      network.roomId = id;
      network.playerId = id;
      network.game = createLobbyState(id, network.name);
      network.discardPile = [];
      network.hands = {};
      startHeartbeat(true);
      const invite = new URL(window.location.href);
      invite.searchParams.set('room', id);
      network.inviteUrl = invite.toString();
      window.history.replaceState({}, '', invite.toString());
      network.note = '';
      network.error = '';
      render();
    });
    peer.on('error', (error) => {
      network.error = peerErrorMessage(error);
      network.note = '';
      render();
    });
  } catch (error) {
    network.error = error.message || 'Nie udało się utworzyć pokoju.';
    network.note = '';
    network.isHost = false;
    render();
  }
}

function joinRoom(name) {
  if (!isPublicHttpsPage()) {
    network.error = 'Otwórz publiczny link HTTPS z zaproszenia, aby dołączyć z innego urządzenia.';
    render();
    return;
  }
  if (!network.roomId) return;
  network.error = '';
  network.note = 'Łączę z pokojem…';
  network.name = cleanName(name);
  render();
  try {
    const peer = createPeer();
    network.peer = peer;
    peer.on('open', () => {
      const key = `opowieci-player-${network.roomId}`;
      let token;
      try {
        token = sessionStorage.getItem(key) || makeId();
        sessionStorage.setItem(key, token);
      } catch {
        token = makeId();
      }
      network.playerId = token;
      const connection = peer.connect(network.roomId, { reliable: true });
      network.connection = connection;
      connection.on('open', () => {
        network.lastHostPingAt = Date.now();
        startHeartbeat(false);
        connection.send({ type: 'JOIN', token, name: network.name });
      });
      connection.on('data', receiveGuestMessage);
      connection.on('error', () => {
        network.error = 'Połączenie z pokojem zostało przerwane. Spróbuj otworzyć zaproszenie ponownie.';
        network.note = '';
        render();
      });
      connection.on('close', () => {
        network.error = 'Gospodarz zakończył połączenie.';
        network.note = '';
        network.game = null;
        render();
      });
      window.setTimeout(() => {
        if (!network.game && network.note) {
          network.note = '';
          network.error = 'Nie udało się połączyć. Pokój mógł zostać zamknięty przez gospodarza.';
          render();
        }
      }, 15000);
    });
    peer.on('error', (error) => {
      network.error = peerErrorMessage(error);
      network.note = '';
      render();
    });
  } catch (error) {
    network.error = error.message || 'Nie udało się połączyć z pokojem.';
    network.note = '';
    render();
  }
}

function peerErrorMessage(error) {
  if (error?.type === 'peer-unavailable') return 'Nie znaleziono pokoju. Poproś gospodarza o nowy link.';
  if (error?.type === 'network') return 'Nie udało się połączyć z usługą połączeń. Sprawdź internet i spróbuj ponownie.';
  if (error?.type === 'unavailable-id') return 'Ten pokój już istnieje albo wygasł. Utwórz nowy.';
  return `Problem z połączeniem: ${error?.type || error?.message || 'spróbuj ponownie'}.`;
}

function startHeartbeat(isHost) {
  window.clearInterval(network.heartbeatTimer);
  network.heartbeatTimer = window.setInterval(() => {
    if (isHost && network.isHost && network.game) {
      const now = Date.now();
      for (const [playerId, connection] of [...network.connections]) {
        if (!connection.open) {
          removeHostPlayer(playerId);
          continue;
        }
        if (now - (network.lastSeen.get(playerId) || now) > 16000) {
          removeHostPlayer(playerId);
          try { connection.close(); } catch { /* already closed */ }
          continue;
        }
        try { connection.send({ type: 'PING', at: now }); } catch { removeHostPlayer(playerId); }
      }
    } else if (!isHost && network.connection?.open && Date.now() - network.lastHostPingAt > 22000) {
      window.clearInterval(network.heartbeatTimer);
      network.error = 'Utracono połączenie z gospodarzem. Wróć do lobby i użyj aktualnego zaproszenia.';
      network.note = '';
      network.game = null;
      try { network.connection.close(); } catch { /* already closed */ }
      render();
    }
  }, 5000);
}

function removeHostPlayer(playerId) {
  const game = network.game;
  const connection = network.connections.get(playerId);
  if (connection) network.peerToPlayer.delete(connection.peer);
  network.connections.delete(playerId);
  network.lastSeen.delete(playerId);
  const player = game?.players.find((item) => item.id === playerId);
  if (!player) return;
  player.connected = false;
  if (game.phase === 'lobby') {
    game.players = game.players.filter((item) => item.id !== playerId);
    network.note = `${player.name} opuścił lobby i został usunięty z listy.`;
  } else {
    game.players = game.players.filter((item) => item.id !== playerId);
    game.players.forEach((item) => { item.score = 0; });
    Object.assign(game, {
      phase: 'lobby', round: 0, activePlayerIds: [], storytellerId: null, clue: '',
      submissions: [], votes: [], voteOrder: [], turnPlayerId: null, result: null,
    });
    network.hands = {};
    network.deck = [];
    network.discardPile = [];
    network.hand = [];
    network.note = `${player.name} rozłączył się. Partia została zresetowana do lobby — możecie rozpocząć ponownie po jego powrocie.`;
  }
  broadcastState();
}

function registerHostConnection(connection) {
  connection.on('data', (message) => {
    const playerId = network.peerToPlayer.get(connection.peer);
    if (playerId) network.lastSeen.set(playerId, Date.now());
    if (message?.type === 'JOIN') handleJoin(connection, message);
    else if (message?.type === 'PONG') return;
    else if (message?.type === 'ACTION' && playerId) processHostAction(playerId, message.action, message.payload || {});
  });
  connection.on('close', () => {
    const playerId = network.peerToPlayer.get(connection.peer);
    if (!playerId || network.connections.get(playerId) !== connection) return;
    removeHostPlayer(playerId);
  });
}

function handleJoin(connection, message) {
  if (!network.game || network.game.phase !== 'lobby') {
    connection.send({ type: 'ERROR', message: 'Partia już się rozpoczęła albo gospodarz nie jest gotowy.' });
    window.setTimeout(() => connection.close(), 500);
    return;
  }
  const token = String(message.token || connection.peer).slice(0, 80);
  let player = network.game.players.find((item) => item.id === token);
  if (!player && network.game.players.length >= 6) {
    connection.send({ type: 'ERROR', message: 'Pokój jest pełny.' });
    window.setTimeout(() => connection.close(), 500);
    return;
  }
  if (!player) {
    player = { id: token, name: cleanName(message.name), score: 0, connected: true };
    network.game.players.push(player);
  } else {
    player.name = cleanName(message.name || player.name);
    player.connected = true;
  }
  network.peerToPlayer.set(connection.peer, player.id);
  network.connections.set(player.id, connection);
  network.lastSeen.set(player.id, Date.now());
  sendStateToPlayer(player.id);
  broadcastState();
}

function receiveGuestMessage(message) {
  if (message?.type === 'PING') {
    network.lastHostPingAt = Date.now();
    if (network.connection?.open) network.connection.send({ type: 'PONG', at: Date.now() });
    return;
  }
  if (message?.type === 'STATE') {
    network.lastHostPingAt = Date.now();
    network.game = message.game;
    network.hand = message.hand || [];
    network.playerId = message.me;
    network.isHost = false;
    network.note = '';
    network.error = '';
    network.selectedCardId = null;
    network.selectedSubmission = null;
    render();
  } else if (message?.type === 'ERROR') {
    network.error = message.message || 'Nie udało się dołączyć do pokoju.';
    network.note = '';
    render();
  }
}

function sendStateToPlayer(playerId) {
  if (playerId === network.playerId) return;
  const connection = network.connections.get(playerId);
  if (!connection?.open) return;
  connection.send({ type: 'STATE', game: publicGameSnapshot(), hand: network.hands?.[playerId] || [], me: playerId });
}

function broadcastState() {
  if (!network.game) return;
  if (network.isHost) network.hand = network.hands?.[network.playerId] || [];
  render();
  for (const [playerId, connection] of network.connections) {
    if (!connection.open) continue;
    connection.send({ type: 'STATE', game: publicGameSnapshot(), hand: network.hands?.[playerId] || [], me: playerId });
  }
}

function startGame() {
  if (!network.isHost) {
    network.error = 'Tylko gospodarz może rozpocząć grę. Wróć do karty, w której utworzono pokój.';
    render();
    return;
  }
  if (network.game?.phase !== 'lobby') {
    network.error = 'Nie można rozpocząć: pokój nie jest już w poczekalni. Odśwież stronę gospodarza.';
    render();
    return;
  }
  const active = network.game.players.filter((player) => player.id === network.game.hostId || Boolean(network.connections.get(player.id)?.open));
  if (active.length < 3 || active.length > 6) {
    network.error = `Do startu potrzeba 3 połączonych graczy. Teraz jest ${active.length}.`;
    render();
    return;
  }
  try {
    network.error = '';
    network.discardPile = [];
    network.deck = createDeck();
    network.hands = {};
    const startingHandSize = active.length === 3 ? 7 : 6;
    for (const player of active) network.hands[player.id] = Array.from({ length: startingHandSize }, drawCard);
    const storyteller = active[Math.floor(Math.random() * active.length)];
    Object.assign(network.game, {
      phase: 'clue', round: 1, activePlayerIds: active.map((player) => player.id),
      storytellerId: storyteller.id, clue: '', submissions: [], votes: [], voteOrder: [],
      turnPlayerId: storyteller.id, result: null,
    });
    network.hand = network.hands[network.playerId] || [];
    network.selectedCardId = null;
    network.selectedSubmission = null;
    broadcastState();
  } catch (error) {
    console.error('Nie udało się rozpocząć gry:', error);
    network.error = 'Nie udało się uruchomić rundy. Odśwież stronę gospodarza i utwórz nowy pokój.';
    render();
  }
}

function sendAction(action, payload = {}) {
  if (network.isHost) processHostAction(network.playerId, action, payload);
  else if (network.connection?.open) network.connection.send({ type: 'ACTION', action, payload });
  else {
    network.error = 'Połączenie z gospodarzem zostało przerwane.';
    render();
  }
}

function currentPlayerIds() {
  return network.game.activePlayerIds.length ? network.game.activePlayerIds : network.game.players.filter((player) => player.connected).map((player) => player.id);
}

function nextIdAfter(playerId, eligibleIds) {
  const ids = currentPlayerIds();
  const index = ids.indexOf(playerId);
  for (let offset = 1; offset <= ids.length; offset += 1) {
    const candidate = ids[(index + offset + ids.length) % ids.length];
    if (eligibleIds.includes(candidate)) return candidate;
  }
  return null;
}

function processHostAction(playerId, action, payload) {
  const game = network.game;
  if (!network.isHost || !game) return;
  if (action === 'START') {
    if (playerId === game.hostId) startGame();
    else {
      network.error = 'Start gry został odrzucony: komendę wysłał gracz, który nie jest gospodarzem.';
      render();
    }
    return;
  }
  if (action === 'PLAY_CLUE' && game.phase === 'clue' && playerId === game.storytellerId) {
    const hand = network.hands[playerId] || [];
    const cardIndex = hand.findIndex((card) => card.id === payload.cardId);
    const clue = String(payload.clue || '').trim().slice(0, 80);
    if (cardIndex < 0 || !clue) return;
    const [card] = hand.splice(cardIndex, 1);
    game.clue = clue;
    game.submissions = [{ id: makeId(), ownerId: playerId, card }];
    game.phase = 'submit';
    game.turnPlayerId = nextIdAfter(playerId, currentPlayerIds().filter((id) => id !== playerId));
    broadcastState();
    return;
  }
  if (action === 'SUBMIT_CARD' && game.phase === 'submit' && playerId === game.turnPlayerId) {
    const hand = network.hands[playerId] || [];
    const alreadyPlayed = countPlayerSubmissions(playerId, game);
    if (alreadyPlayed >= cardsPerNonStoryteller(game)) return;
    const cardIndex = hand.findIndex((card) => card.id === payload.cardId);
    if (cardIndex < 0) return;
    const [card] = hand.splice(cardIndex, 1);
    game.submissions.push({ id: makeId(), ownerId: playerId, card });
    const ids = currentPlayerIds();
    if (game.submissions.length >= expectedSubmissionCount(game)) {
      game.submissions = shuffle(game.submissions);
      game.phase = 'vote';
      game.voteOrder = ids.filter((id) => id !== game.storytellerId);
      const rotated = [...game.voteOrder];
      const first = nextIdAfter(game.storytellerId, rotated);
      if (first && rotated[0] !== first) game.voteOrder = [...rotated.slice(rotated.indexOf(first)), ...rotated.slice(0, rotated.indexOf(first))];
      game.turnPlayerId = game.voteOrder[0] || null;
    } else {
      const needsCard = (id) => id !== game.storytellerId && countPlayerSubmissions(id, game) < cardsPerNonStoryteller(game);
      const eligible = ids.filter(needsCard);
      game.turnPlayerId = countPlayerSubmissions(playerId, game) < cardsPerNonStoryteller(game)
        ? playerId
        : nextIdAfter(playerId, eligible);
    }
    broadcastState();
    return;
  }
  if (action === 'VOTE' && game.phase === 'vote' && playerId === game.turnPlayerId) {
    const submission = game.submissions[Number(payload.submissionIndex)];
    if (!submission || submission.ownerId === playerId || game.votes.some((vote) => vote.voterId === playerId)) return;
    game.votes.push({ voterId: playerId, submissionIndex: Number(payload.submissionIndex) });
    const remaining = game.voteOrder.filter((id) => !game.votes.some((vote) => vote.voterId === id));
    if (!remaining.length) finishRound();
    else game.turnPlayerId = remaining[0];
    broadcastState();
    return;
  }
  if (action === 'NEXT' && playerId === game.hostId && game.phase === 'result' && !game.players.some((player) => player.score >= 30)) {
    beginNextRound();
    return;
  }
  if (action === 'RESTART' && playerId === game.hostId && game.phase === 'result' && game.players.some((player) => player.score >= 30)) {
    game.players.forEach((player) => { player.score = 0; });
    game.activePlayerIds = game.players.filter((player) => player.connected).map((player) => player.id);
    network.discardPile = [];
    network.deck = createDeck();
    network.hands = {};
    const startingHandSize = game.activePlayerIds.length === 3 ? 7 : 6;
    for (const id of game.activePlayerIds) network.hands[id] = Array.from({ length: startingHandSize }, drawCard);
    game.round = 1;
    game.storytellerId = game.activePlayerIds[Math.floor(Math.random() * game.activePlayerIds.length)];
    game.phase = 'clue'; game.clue = ''; game.submissions = []; game.votes = []; game.voteOrder = []; game.turnPlayerId = game.storytellerId; game.result = null;
    broadcastState();
  }
}

function finishRound() {
  const game = network.game;
  const storyIndex = game.submissions.findIndex((submission) => submission.ownerId === game.storytellerId);
  const voteCounts = game.submissions.map((_, index) => game.votes.filter((vote) => vote.submissionIndex === index).length);
  const correctVotes = voteCounts[storyIndex] || 0;
  const points = Object.fromEntries(game.activePlayerIds.map((id) => [id, 0]));
  if (correctVotes === 0 || correctVotes === game.voteOrder.length) {
    for (const id of game.activePlayerIds) if (id !== game.storytellerId) points[id] += 2;
  } else {
    points[game.storytellerId] += 3;
    for (const vote of game.votes) if (vote.submissionIndex === storyIndex) points[vote.voterId] += 3;
  }
  voteCounts.forEach((count, index) => {
    const ownerId = game.submissions[index].ownerId;
    if (ownerId !== game.storytellerId) points[ownerId] += count;
  });
  for (const player of game.players) player.score += points[player.id] || 0;
  game.result = { storyIndex, voteCounts, correctVotes, points };
  game.phase = 'result';
  game.turnPlayerId = null;
}

function beginNextRound() {
  const game = network.game;
  game.submissions.forEach((submission) => network.discardPile.push(submission.card));
  for (const playerId of game.activePlayerIds) {
    const cardsToDraw = game.players.length === 3 && playerId !== game.storytellerId ? 2 : 1;
    for (let i = 0; i < cardsToDraw; i += 1) (network.hands[playerId] ||= []).push(drawCard());
  }
  const nextStoryteller = nextIdAfter(game.storytellerId, game.activePlayerIds);
  game.round += 1;
  game.storytellerId = nextStoryteller;
  game.phase = 'clue'; game.clue = ''; game.submissions = []; game.votes = []; game.voteOrder = []; game.turnPlayerId = nextStoryteller; game.result = null;
  network.selectedCardId = null; network.selectedSubmission = null; network.clueDraft = '';
  broadcastState();
}

function copyInviteLink() {
  const input = app.querySelector('#invite-url');
  const value = network.inviteUrl;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(value).then(() => {
      network.note = 'Skopiowano link. Wyślij go znajomym.';
      render();
    }).catch(() => fallbackCopy(input));
  } else fallbackCopy(input);
}

function fallbackCopy(input) {
  if (!input) return;
  input.focus(); input.select();
  try { document.execCommand('copy'); network.note = 'Skopiowano link. Wyślij go znajomym.'; }
  catch { network.note = 'Zaznaczony link możesz skopiować skrótem Ctrl+C.'; }
  render();
}

function leaveRoom() {
  window.clearInterval(network.heartbeatTimer);
  network.heartbeatTimer = null;
  try { network.peer?.destroy(); } catch { /* peer may already be closed */ }
  network.peer = null; network.connection = null; network.connections.clear(); network.peerToPlayer.clear(); network.lastSeen.clear();
  network.isHost = false; network.playerId = null; network.game = null; network.hand = []; network.deck = []; network.discardPile = []; network.hands = {};
  network.roomId = null; network.inviteUrl = ''; network.error = ''; network.note = ''; network.selectedCardId = null; network.selectedSubmission = null;
  const url = new URL(window.location.href); url.searchParams.delete('room'); window.history.replaceState({}, '', url.toString());
  render();
}

app.addEventListener('input', (event) => {
  if (event.target.id === 'clue-input') {
    network.clueDraft = event.target.value;
    const button = app.querySelector('[data-action="submit-clue"]');
    if (button) button.disabled = !network.selectedCardId || !network.clueDraft.trim();
  }
});

app.addEventListener('click', (event) => {
  const cardButton = event.target.closest('[data-card-id]');
  if (cardButton) {
    network.selectedCardId = cardButton.dataset.cardId;
    render();
    return;
  }
  const voteButton = event.target.closest('[data-submission-index]');
  if (voteButton && !voteButton.disabled) {
    network.selectedSubmission = Number(voteButton.dataset.submissionIndex);
    render();
    return;
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'create-room') createRoom(app.querySelector('#player-name')?.value);
  else if (action === 'join-room') joinRoom(app.querySelector('#player-name')?.value);
  else if (action === 'copy-link') copyInviteLink();
  else if (action === 'start-game') sendAction('START');
  else if (action === 'submit-clue') {
    if (!network.selectedCardId || !network.clueDraft.trim()) return;
    sendAction('PLAY_CLUE', { cardId: network.selectedCardId, clue: network.clueDraft });
    network.selectedCardId = null;
  } else if (action === 'submit-card') {
    if (!network.selectedCardId) return;
    sendAction('SUBMIT_CARD', { cardId: network.selectedCardId });
    network.selectedCardId = null;
  } else if (action === 'submit-vote') {
    if (network.selectedSubmission === null) return;
    sendAction('VOTE', { submissionIndex: network.selectedSubmission });
    network.selectedSubmission = null;
  } else if (action === 'next-round') sendAction('NEXT');
  else if (action === 'restart-game') sendAction('RESTART');
  else if (action === 'leave-room') leaveRoom();
});

render();
