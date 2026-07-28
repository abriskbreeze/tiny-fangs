/**
 * Multiplayer WebSocket client — extracted from main.js
 * Factory injects client deps so this module stays free of circular imports.
 *
 * @param {object} deps
 * @param {object} deps.state
 * @param {object} deps.Anim
 * @param {function} deps.log
 * @param {function} deps.render
 * @param {function} deps.renderLog
 * @param {function} deps.showModal
 * @param {function} deps.closeModal
 * @param {function} deps.playServerEvents
 * @param {function} [deps.playMPCoinFlip] - may be assigned on deps later
 * @param {function} [deps.highlightEndTurn] - may be assigned on deps later
 */
export function createMpClient(deps) {
  // Server URL — override via ?ws= or localStorage.tinyFangsWs (Cloudflare tunnels change)
  const WS_SERVER =
    new URLSearchParams(location.search).get('ws') ||
    localStorage.getItem('tinyFangsWs') ||
    'wss://obituaries-comedy-blake-having.trycloudflare.com';

  let ws = null;
  let gameMode = 'solo'; // 'solo' or 'multi'
  let roomCode = null;
  let isHost = false;
  let selectedDeckId = null;

  // Update queue for batching server state updates
  let updateQueue = [];
  let processingQueue = false;
  let gameStartPromise = null;

  function disconnectWebSocket() {
    if (!ws) return;

    const socket = ws;
    ws = null;
    socket.onopen = null;
    socket.onerror = null;
    socket.onclose = null;
    socket.onmessage = null;
    socket.close();
  }

  function connectWebSocket() {
    return new Promise((resolve, reject) => {
      disconnectWebSocket();
      const socket = new WebSocket(WS_SERVER);
      ws = socket;

      socket.onopen = () => {
        console.log('🔌 Connected to server');
        resolve();
      };

      socket.onerror = (err) => {
        console.error('❌ WebSocket error:', err);
        reject(err);
      };

      socket.onclose = () => {
        if (ws === socket) ws = null;
        deps.stopGameTimer?.();
        console.log('🔌 Disconnected from server');
        if (gameMode === 'multi') {
          setMpStatus('Disconnected from server');
        }
      };

      socket.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        console.log('📩 Server:', msg);
        handleServerMessage(msg);
      };
    });
  }

  async function handleServerMessage(msg) {
    switch (msg.type) {
      case 'roomCreated':
        roomCode = msg.roomCode;
        document.getElementById('room-code-display').textContent = roomCode;
        document.getElementById('room-info').style.display = 'block';
        document.getElementById('join-input').style.display = 'none';
        document.querySelector('.mp-buttons').style.display = 'none';
        break;

      case 'roomJoined':
        roomCode = msg.roomCode;
        isHost = false;
        setMpStatus(`Joined room ${roomCode}!`);
        showDeckSelect();
        break;

      case 'opponentJoined':
        setMpStatus('Opponent joined! Select your deck.');
        document.getElementById('waiting-msg').textContent = 'Opponent joined!';
        document.getElementById('waiting-msg').style.color = 'var(--green)';
        setTimeout(() => showDeckSelect(), 1000);
        break;

      case 'waitingForOpponent':
        setMpStatus('Waiting for opponent to select deck...');
        break;

      case 'opponentReady':
        setMpStatus('Opponent ready! Select your deck.');
        break;

      case 'gameStart':
        console.log('🎮 Game starting!', msg);
        // CSS keeps the desktop shell laid out behind setup. Make both gameplay
        // shells explicitly inert before the coin so no board or input can
        // surface until the awaited start transition chooses one shell.
        document.getElementById('desktop').style.display = 'none';
        document.getElementById('mobile').style.display = 'none';
        // The board, authoritative state, and any immediately following server
        // update stay behind the complete coin choreography.
        gameStartPromise = (async () => {
          await deps.playMPCoinFlip(msg.coinFlip === 'won');
          startMultiplayerGame(msg.state, msg.yourTurn, msg.you);
        })();
        return gameStartPromise;

      case 'stateUpdate':
        console.log('📊 State update', msg.events);
        if (gameStartPromise) await gameStartPromise;
        return queueUpdate(msg.state, msg.events, msg.pendingAction);

      case 'turnChange':
        deps.state.G.myTurn = msg.yourTurn;
        updateTurnUI();
        showTurnBanner(msg.yourTurn ? 'YOUR TURN' : 'OPPONENT\'S TURN');
        break;

      case 'opponentLeft':
        if (deps.state.G && deps.state.G.isMultiplayer) {
          deps.stopGameTimer?.();
          deps.showModal('Opponent Left', [{
            name: 'Return to Menu',
            action: () => {
              deps.clearGame?.();
              deps.closeModal();
              location.reload();
            }
          }]);
        } else {
          setMpStatus('Opponent disconnected');
        }
        break;

      case 'error':
        console.error('Server error:', msg.message);
        if (deps.state.G && deps.state.G.isMultiplayer) {
          // Show error briefly but don't block
          deps.log(`Error: ${msg.message}`, 'dmg');
        } else {
          setMpStatus(`Error: ${msg.message}`);
        }
        break;
    }
  }

  // Convert server state to client state format
  function convertServerState(serverState) {
    return {
      isMultiplayer: true,
      myTurn: serverState.yourTurn,
      turn: serverState.turn,
      winner: serverState.winner,
      firstTurn: serverState.firstTurn,
      actionLock: false,
      hasAttacked: serverState.hasAttacked || false,
      hasRetreated: serverState.hasRetreated || false,
      aiDifficulty: 0, // No AI in multiplayer
      me: {
        lp: serverState.me.lp,
        mana: serverState.me.mana,
        maxMana: serverState.me.maxMana,
        deck: [], // Hidden - just need count
        deckCount: serverState.me.deckCount,
        hand: serverState.me.hand || [],
        active: serverState.me.active,
        bench: serverState.me.bench || [],
        grave: serverState.me.grave || [],
        setVerse: serverState.me.setVerse,
        attackBonuses: serverState.me.attackBonuses || [],
        chainLightning: serverState.me.chainLightning || 0,
        unbreakable: serverState.me.unbreakable || false,
        usedManaSurge: !!serverState.me.usedManaSurge,
        usedLastBreath: !!serverState.me.usedLastBreath
      },
      opp: {
        lp: serverState.opp.lp,
        mana: serverState.opp.mana,
        maxMana: serverState.opp.maxMana,
        deck: [],
        deckCount: serverState.opp.deckCount,
        handCount: serverState.opp.handCount,
        hand: [], // Hidden
        active: serverState.opp.active,
        bench: serverState.opp.bench || [],
        grave: serverState.opp.grave || [],
        setVerse: serverState.opp.setVerse,
        chainLightning: serverState.opp.chainLightning || 0
      },
      log: [] // Battle log
    };
  }

  // Start multiplayer game with server state
  function startMultiplayerGame(serverState, yourTurn, you) {
    // Hide setup, show game
    document.getElementById('setup').style.display = 'none';
    const isMobile = window.innerWidth <= 600;
    const gameEl = isMobile ? 'mobile' : 'desktop';
    document.getElementById(gameEl).style.display = 'flex';

    // Initialize state from server
    deps.state.G = convertServerState(serverState);
    deps.state.G.myTurn = yourTurn;
    deps.state.G.myPlayerKey = you; // 'p1' or 'p2'

    deps.startGameTimer?.();

    deps.render();
    updateTurnUI();

    // Show turn banner
    if (yourTurn) {
      showTurnBanner('YOUR TURN');
    } else {
      showTurnBanner('OPPONENT\'S TURN');
    }
  }

  // Queue update to prevent animations from being interrupted
  async function queueUpdate(serverState, events, pendingAction) {
    updateQueue.push({ serverState, events, pendingAction });
    if (!processingQueue) {
      processingQueue = true;
      while (updateQueue.length > 0) {
        const update = updateQueue.shift();
        await processUpdate(update.serverState, update.events, update.pendingAction);
      }
      processingQueue = false;
    }
  }

  // Process a single state update from server
  async function processUpdate(serverState, events, pendingAction) {
    const oldLog = deps.state.G?.log || [];

    // Cache element positions BEFORE state update (for animations that need them)
    deps.Anim.cacheActivePositions();

    // Always update state FIRST so DOM elements exist for animations
    // (summon needs element in DOM, KO animation handles missing elements gracefully)
    deps.state.G = convertServerState(serverState);
    deps.state.G.log = oldLog;
    deps.render();

    // Then play animations (elements now exist)
    if (events && events.length > 0) {
      await deps.playServerEvents(events);
    }

    deps.renderLog();

    if (deps.state.G.isMultiplayer) {
      updateTurnUI();
    }

    if (deps.state.G.winner !== null) {
      const youWon = deps.state.G.winner === 'me';
      showGameOver(youWon);
    }

    if (pendingAction) {
      await handlePendingAction(pendingAction);
    }
  }

  // Handle pending actions that require player input
  async function handlePendingAction(pending) {
    if (pending.type === 'skitterSwap' && pending.side === 'me') {
      // Skitter took damage - prompt for swap
      const benchOptions = pending.benchOptions || [];
      if (benchOptions.length === 0) return;

      const choice = await new Promise(resolve => {
        deps.showModal(`${pending.creature}'s Scurry - Swap with bench?`, [
          ...benchOptions.map(opt => ({
            name: opt.name,
            sub: `Swap ${pending.creature} to bench`,
            action: () => { deps.closeModal(); resolve(opt.idx); }
          })),
          {
            name: '← Decline',
            sub: 'Stay in active slot',
            action: () => { deps.closeModal(); resolve(null); }
          }
        ]);
      });

      if (choice !== null) {
        sendAction({ action: 'skitterSwap', benchIdx: choice });
      } else {
        sendAction({ action: 'skitterDecline' });
      }
    }

    if (pending.type === 'optionalTrigger' && pending.side === 'me') {
      // Optional trigger (e.g., Vengeance) - prompt for activation
      const confirmed = await new Promise(resolve => {
        deps.showModal(pending.prompt, [
          {
            name: 'Yes',
            sub: `Activate ${pending.verseName}`,
            action: () => { deps.closeModal(); resolve(true); }
          },
          {
            name: 'No',
            sub: 'Don\'t activate',
            action: () => { deps.closeModal(); resolve(false); }
          }
        ]);
      });

      sendAction({
        action: 'respondOptionalTrigger',
        confirmed
      });
    }
  }

  // Update UI based on whose turn it is
  function updateTurnUI() {
    const attackBtn = document.getElementById('attack-btn');
    const endTurnBtn = document.getElementById('end-turn');
    const mAttackBtn = document.getElementById('m-attack-btn');
    const mEndTurnBtn = document.getElementById('m-end-turn');

    if (deps.state.G.isMultiplayer) {
      const enabled = deps.state.G.myTurn;
      if (attackBtn) attackBtn.disabled = !enabled;
      if (endTurnBtn) endTurnBtn.disabled = !enabled;
      if (mAttackBtn) mAttackBtn.disabled = !enabled;
      if (mEndTurnBtn) mEndTurnBtn.disabled = !enabled;

      // Update turn indicator
      const mIndicator = document.getElementById('m-turn-indicator');
      const dIndicator = document.getElementById('d-turn-indicator');
      const text = enabled ? 'YOUR TURN' : 'WAITING';
      const className = enabled ? 'turn-indicator your-turn' : 'turn-indicator opp-turn';

      if (mIndicator) {
        mIndicator.textContent = text;
        mIndicator.className = className;
      }
      if (dIndicator) {
        dIndicator.textContent = text;
        dIndicator.className = className;
      }

      // Don't highlight end turn if not your turn
      if (!enabled) {
        deps.highlightEndTurn(false);
      }
    }
  }

  // Show turn banner
  function showTurnBanner(text) {
    // Reuse existing banner animation if available
    const banner = document.createElement('div');
    banner.className = 'turn-banner';
    banner.textContent = text;
    banner.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        font-size: 24px; font-weight: bold; color: var(--yellow);
        text-shadow: 0 0 10px var(--yellow); z-index: 9999;
        animation: fadeInOut 1.5s ease-in-out forwards;
      `;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 1500);
  }

  // Show game over modal
  function showGameOver(youWon) {
    deps.stopGameTimer?.();
    deps.showModal(youWon ? '🏆 VICTORY!' : '💀 DEFEAT', [{
      name: 'Return to Menu',
      action: () => {
        deps.clearGame?.();
        deps.closeModal();
        location.reload();
      }
    }]);
  }

  // Send action to server
  function sendAction(action) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'action', action }));
    }
  }

  // Send end turn to server
  function sendEndTurn() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'endTurn' }));
    }
  }

  function setMpStatus(text) {
    const el = document.getElementById('mp-status');
    if (el) el.textContent = text;
  }

  function selectMode(mode) {
    deps.clearGame?.();
    gameMode = mode;
    if (mode === 'solo') {
      disconnectWebSocket();
      showDeckSelect();
      document.getElementById('ai-difficulty').style.display = 'flex';
    } else {
      document.getElementById('mode-select').style.display = 'none';
      document.getElementById('mp-lobby').style.display = 'block';
      document.getElementById('deck-select').style.display = 'none';
      // Connect to server
      connectWebSocket().catch(err => {
        setMpStatus('Failed to connect to server. Try again later.');
      });
    }
  }

  function showDeckSelect() {
    document.getElementById('mode-select').style.display = 'none';
    document.getElementById('mp-lobby').style.display = 'none';
    document.getElementById('deck-select').style.display = 'block';
    // Hide AI difficulty in multiplayer
    if (gameMode === 'multi') {
      document.getElementById('ai-difficulty').style.display = 'none';
    }
  }

  function backToModeSelect() {
    deps.clearGame?.();
    gameMode = 'solo';
    disconnectWebSocket();
    roomCode = null;
    isHost = false;
    selectedDeckId = null;
    document.getElementById('mode-select').style.display = 'block';
    document.getElementById('mp-lobby').style.display = 'none';
    document.getElementById('deck-select').style.display = 'none';
    document.getElementById('room-info').style.display = 'none';
    document.getElementById('join-input').style.display = 'none';
    document.getElementById('room-code-display').textContent = '';
    document.getElementById('room-code-input').value = '';
    document.getElementById('waiting-msg').textContent = 'Waiting for opponent...';
    document.getElementById('waiting-msg').style.color = '';
    document.querySelector('.mp-buttons').style.display = 'flex';
    setMpStatus('');
  }

  async function createRoom() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setMpStatus('Connecting...');
      try {
        await connectWebSocket();
      } catch (e) {
        setMpStatus('Failed to connect');
        return;
      }
    }
    isHost = true;
    // We'll send the deck ID after selection
    // For now, just create with placeholder
    ws.send(JSON.stringify({ type: 'create', deckId: 'pending' }));
  }

  function showJoinInput() {
    document.getElementById('join-input').style.display = 'block';
    document.getElementById('room-code-input').focus();
  }

  async function joinRoom() {
    const input = document.getElementById('room-code-input');
    const code = input.value.toUpperCase().trim();
    if (code.length !== 4) {
      setMpStatus('Room code must be 4 characters');
      return;
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setMpStatus('Connecting...');
      try {
        await connectWebSocket();
      } catch (e) {
        setMpStatus('Failed to connect');
        return;
      }
    }

    ws.send(JSON.stringify({ type: 'join', roomCode: code, deckId: 'pending' }));
  }

  // Expose functions globally (same as main.js)
  window.selectMode = selectMode;
  window.backToModeSelect = backToModeSelect;
  window.createRoom = createRoom;
  window.showJoinInput = showJoinInput;
  window.joinRoom = joinRoom;

  return {
    connectWebSocket,
    sendAction,
    sendEndTurn,
    selectMode,
    showDeckSelect,
    backToModeSelect,
    createRoom,
    showJoinInput,
    joinRoom,
    setMpStatus,
    updateTurnUI,
    convertServerState,
    startMultiplayerGame,
    queueUpdate,
    processUpdate,
    handlePendingAction,
    showTurnBanner,
    showGameOver,
    handleServerMessage,
    getGameMode: () => gameMode,
    setSelectedDeckId: (id) => { selectedDeckId = id; },
    getSelectedDeckId: () => selectedDeckId,
    getWs: () => ws,
    getRoomCode: () => roomCode,
    getIsHost: () => isHost,
  };
}
