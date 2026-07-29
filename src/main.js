    import { CREATURES, VERSES, DECKS } from './cards.js';
    import {
      $,
      uid,
      state,
      setGame,
      clearGame,
      readGameElapsedSeconds,
      resetGameTimer,
      startGameTimer,
      stopGameTimer,
    } from './state.js';
    import { ANIM_TIMING, Anim } from './anim.js';
    import { hearts, manaStr, renderManaPips, renderSetVerse, renderActiveCard, renderMiniCard, renderBench, renderHandCard, renderLogEntry, renderLogInlineEntry, getActiveEffects } from './render.js';
    import { getAllMoves, scoreMove, pickBestMove, getScoredMoves } from './ai.js';
    import {
      log,
      drawCard,
      checkDeckOut,
      checkWinConditions,
      applyLastBreath,
      shouldGraveRiseTrigger,
      applyGraveRise,
      processDeathEffects,
      sendToGrave,
      autoReplace,
      shouldChainLightningHit
    } from './helpers.js';
    import {
      getEffectiveAtk,
      getAtkModifiers,
      getEffectiveDamageReduction,
      getDamageReductionSources,
      checkSwarm,
      applySpawn,
      shouldScurryTrigger,
      executeScurry
    } from './abilities.js';
    import { executeAction as sharedExecuteAction } from '../shared/engine.js';
    import { createEventPlayback } from './event-playback.js';
    import { createSoloDispatch } from './solo-dispatch.js';
    import { createMpClient } from './mp-client.js';
    import { createSoloAi } from './solo-ai.js';
    import { applyPresentationMode } from './presentation/presentation-mode.js';
    import { createHtmlKeyedView, syncElementToHtml } from './presentation/dom/html-keyed-view.js';
    import { installVisualQaContract } from './presentation/testing/visual-qa-bootstrap.js';
    import { createAaaShell } from './presentation/aaa-shell.js';

    applyPresentationMode();
    installVisualQaContract({
      activation: {
        clearGame,
        setGame,
        showGameRoute: showVisualFixtureRoute,
        render,
      },
    });

    // Expose Anim globally so effects.js can access it
    globalThis.Anim = Anim;

    // ═══════════════════════════════════════════════════════════════
    // EXTRACTED MODULES (event playback / solo dispatch / mp / ai)
    // runtime bag is filled once UI helpers exist below
    // ═══════════════════════════════════════════════════════════════

    const runtime = {
      state,
      sharedExecuteAction,
      Anim,
      ANIM_TIMING,
      log,
      VERSES,
      CREATURES,
      getScoredMoves,
      pickBestMove,
      // filled after function declarations:
      render: null,
      renderLog: null,
      showModal: null,
      closeModal: null,
      highlightEndTurn: null,
      playTurnEndAnimation: null,
      playMPCoinFlip: null,
      draw: null,
      playEvents: null,
      playServerEvents: null,
      clearGame,
      resetGameTimer,
      startGameTimer: () => startGameTimer(updateTimer),
      stopGameTimer,
    };

    const { playEvents, playServerEvents, sideKey, EVENT_HANDLERS } = createEventPlayback({
      Anim, log, VERSES, CREATURES
    });
    runtime.playEvents = playEvents;
    runtime.playServerEvents = playServerEvents;

    const soloRuntime = Object.create(runtime);
    const { dispatchLocalAction, handleLocalPendingAction } = createSoloDispatch(soloRuntime);
    runtime.dispatchLocalAction = dispatchLocalAction;

    const mp = createMpClient(runtime);
    const {
      sendAction,
      sendEndTurn,
      selectMode,
      showDeckSelect,
      setMpStatus,
      updateTurnUI,
      getGameMode,
      setSelectedDeckId,
      getWs,
    } = mp;

    // AI wired after draw / playTurnEndAnimation exist (see bindRuntimeModules)
    let aiTurn, aiTurnHunter, startPlayerTurn, forcePlayerTurn;

    function bindRuntimeModules() {
      runtime.render = render;
      runtime.renderLog = renderLog;
      runtime.showModal = showModal;
      soloRuntime.showModal = (title, options, opts = {}) => showModal(
        title,
        options,
        { semantic: true, noCancel: true, ...opts },
      );
      runtime.closeModal = closeModal;
      runtime.highlightEndTurn = highlightEndTurn;
      runtime.playTurnEndAnimation = playTurnEndAnimation;
      runtime.playMPCoinFlip = playMPCoinFlip;
      runtime.draw = draw;
      runtime.dispatchLocalAction = dispatchLocalAction;

      const ai = createSoloAi(runtime);
      aiTurn = ai.aiTurn;
      aiTurnHunter = ai.aiTurnHunter;
      startPlayerTurn = ai.startPlayerTurn;
      forcePlayerTurn = ai.forcePlayerTurn;
    }

    // ═══════════════════════════════════════════════════════════════
    // UNIFIED ACTION DISPATCHER
    // All game actions go through here - handles MP vs Solo routing
    // ═══════════════════════════════════════════════════════════════

    /**
     * Dispatch a game action
     * @param {string} type - Action type: 'summon', 'cast', 'set', 'attack', 'retreat', 'endTurn'
     * @param {object} params - Action parameters (cardUid, target, benchIdx, etc.)
     */
    async function dispatchAction(type, params = {}) {
      if (!state.G) return;
      if (state.G.winner != null) return;
      if (state.animating) return;

      // Multiplayer: validate turn and send to server
      if (state.G.isMultiplayer) {
        if (!state.G.myTurn) {
          log("Not your turn!", 'dmg');
          return;
        }

        switch (type) {
          case 'summon':
            sendAction({ action: 'summon', cardUid: params.cardUid, target: params.target });
            break;
          case 'cast': {
            const castAction = { action: 'cast', cardUid: params.cardUid };
            // Include selection data for targeting cards
            if (params.selection) {
              if (params.selection.type === 'target') {
                castAction.targetUid = params.selection.uid;
              } else if (params.selection.type === 'grave') {
                castAction.graveUid = params.selection.uid;
              } else if (params.selection.type === 'own') {
                castAction.sacrificeUid = params.selection.uid;
              }
            }
            sendAction(castAction);
            break;
          }
          case 'set':
            sendAction({ action: 'set', cardUid: params.cardUid });
            break;
          case 'attack':
            sendAction({ action: 'attack' });
            break;
          case 'retreat':
            sendAction({ action: 'retreat', benchIdx: params.benchIdx });
            break;
          case 'endTurn':
            sendEndTurn();
            break;
        }
        return;
      }

      // Solo mode: execute locally via executor map
      const executor = localExecutors[type];
      if (executor) {
        await executor(params);
      } else {
        console.warn('Unknown action type:', type);
      }
    }

    // Local action executors (solo mode) - maps action types to handlers
    const localExecutors = {
      summon: (params) => executeLocalSummon(params.card),
      // cast: Handled directly by playCastVerse via dispatchLocalAction
      cast: () => console.warn('localExecutors.cast called - should use playCastVerse instead'),
      set: (params) => executeLocalSet(params.card),
      attack: () => executeLocalAttack(),
      retreat: (params) => executeLocalRetreat(params.benchIdx),
      endTurn: () => executeLocalEndTurn()
    };

    // Expose for onclick handlers
    window.dispatchAction = dispatchAction;

    // Lobby / MP UI hooks live in mp-client.js (window.selectMode etc.)



    // Selected difficulty (before game starts)
    let selectedDifficulty = 2; // Default: Hunter

    function setDifficulty(level) {
      selectedDifficulty = level;
      document.getElementById('diff-pup').classList.toggle('active', level === 1);
      document.getElementById('diff-hunter').classList.toggle('active', level === 2);
    }
    window.setDifficulty = setDifficulty;

    // ═══════════════════════════════════════════════════════════════
    // GAME INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    function mkCreature(id) {
      const t = CREATURES[id];
      return { ...t, cardType:'creature', curHp:t.hp, status:null, uid:uid(), firstAtk:true };
    }

    function mkVerse(id) {
      const t = VERSES[id];
      return { ...t, cardType:'verse', uid:uid() };
    }

    function mkDeck(deckId) {
      const def = DECKS[deckId];
      const cards = [
        ...def.creatures.map(mkCreature),
        ...def.verses.map(mkVerse)
      ];
      // Shuffle
      for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
      }
      return cards;
    }

    function mkPlayer(deckId) {
      const deck = mkDeck(deckId);
      const hand = deck.splice(0, 5);
      return {
        lp: 3,
        mana: 1,
        maxMana: 1,
        deck,
        hand,
        active: null,
        bench: [],
        grave: [],
        setVerse: null,
        usedManaSurge: false,
        usedLastBreath: false,
        attackBonuses: [], // Unified: [{source, value}]
        poisoned: false,
        chainLightning: 0,
      };
    }

    // Deck selection state
    let pendingDeckId = null;
    let pendingAIDeckId = null;

    const DECK_INFO = {
      shadow: {
        icon: '(O)', name: 'Shadow', desc: 'Control & graveyard synergy',
        full: 'Manipulate the graveyard and outlast opponents. Whisper evades traps, Gloom punishes removal, Duskfang grows stronger with fallen allies.',
        stars: ['Duskfang', 'Gloom', 'Mireveil']
      },
      fang: {
        icon: '/\\', name: 'Fang', desc: 'Aggro & direct damage',
        full: 'Fast and ferocious. Cindermaw attacks twice, Pulsefin doubles first strike, Stormtalon chains lightning on death.',
        stars: ['Cindermaw', 'Pulsefin', 'Stormtalon']
      },
      venom: {
        icon: '*X*', name: 'Venom', desc: 'Poison & lifesteal',
        full: 'Wear down enemies with status effects. Hexweaver poisons, Leechling drains health, Sundew Queen heals on kills.',
        stars: ['Hexweaver', 'Leechling', 'Sundew Queen']
      },
      swarm: {
        icon: '}:{', name: 'Swarm', desc: 'Pack tactics & bench synergy',
        full: 'Strength in numbers. Fangpup grows with allies, Broodmother spawns tokens, Alpha buffs the whole pack.',
        stars: ['Fangpup', 'Broodmother', 'Alpha']
      },
      shell: {
        icon: '[=]', name: 'Shell', desc: 'Defense & damage reduction',
        full: 'Outlast and endure. Shellkin negates first hit, Ironhide reduces all damage, Titanback survives everything.',
        stars: ['Shellkin', 'Ironhide', 'Titanback']
      }
    };

    function getRandomDeckId() {
      const deckIds = Object.keys(DECKS);
      return deckIds[Math.floor(Math.random() * deckIds.length)];
    }

    // Deck preview (hover on desktop, hold on mobile)
    let deckPreviewTimer = null;
    let deckPreviewEl = null;
    let isTouchDevice = false;

    function deckPress(deckId) {
      isTouchDevice = true; // Touch detected
      deckPreviewTimer = setTimeout(() => showDeckPreview(deckId), 400);
    }

    function deckRelease() {
      if (deckPreviewTimer) {
        clearTimeout(deckPreviewTimer);
        deckPreviewTimer = null;
      }
      hideDeckPreview();
    }

    function deckHover(deckId, event) {
      if (isTouchDevice) return; // Skip hover on touch devices
      showDeckPreview(deckId, event);
    }

    function deckLeave() {
      if (isTouchDevice) return;
      hideDeckPreview();
    }

    // Format deck contents as "2× Shellkin, 1× Ironhide, ..."
    function formatDeckList(cardIds, cardLookup) {
      const counts = {};
      for (const id of cardIds) {
        counts[id] = (counts[id] || 0) + 1;
      }
      // Sort by count (descending), then name
      const sorted = Object.entries(counts).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1]; // Higher count first
        const nameA = cardLookup[a[0]]?.name || a[0];
        const nameB = cardLookup[b[0]]?.name || b[0];
        return nameA.localeCompare(nameB);
      });
      return sorted.map(([id, count]) => {
        const name = cardLookup[id]?.name || id;
        return `<span class="count">${count}×</span> ${name}`;
      }).join(', ');
    }

    function showDeckPreview(deckId, event) {
      const info = DECK_INFO[deckId];
      if (!info) return;

      const deck = DECKS[deckId];
      if (!deck) return;

      hideDeckPreview();

      // Build card list HTML
      const creaturesHtml = formatDeckList(deck.creatures, CREATURES);
      const versesHtml = formatDeckList(deck.verses, VERSES);

      deckPreviewEl = document.createElement('div');
      deckPreviewEl.className = 'deck-preview';
      deckPreviewEl.innerHTML = `
        <div class="icon">${info.icon}</div>
        <div class="name">${info.name}</div>
        <div class="desc">${info.desc}</div>
        <div class="full">${info.full}</div>
        <div class="stars">★ ${info.stars.join(' • ')}</div>
        <div class="deck-list">
          <div class="deck-list-label">Creatures (${deck.creatures.length})</div>
          <div class="deck-list-items">${creaturesHtml}</div>
          <div class="deck-list-label">Verses (${deck.verses.length})</div>
          <div class="deck-list-items">${versesHtml}</div>
        </div>
      `;
      document.body.appendChild(deckPreviewEl);

      // Position: right of cursor on desktop, centered on mobile
      if (event && event.clientX !== undefined) {
        const x = event.clientX + 20; // 20px to the right of cursor
        const y = event.clientY;
        const rect = deckPreviewEl.getBoundingClientRect();

        // Keep within viewport
        const maxX = window.innerWidth - rect.width - 10;
        const maxY = window.innerHeight - rect.height - 10;

        deckPreviewEl.style.left = Math.min(x, maxX) + 'px';
        deckPreviewEl.style.top = Math.max(10, Math.min(y - rect.height / 2, maxY)) + 'px';
      } else {
        deckPreviewEl.classList.add('centered');
      }
    }

    function hideDeckPreview() {
      if (deckPreviewEl) {
        deckPreviewEl.remove();
        deckPreviewEl = null;
      }
    }

    function selectPlayerDeck(deckId) {
      // Resolve random selection
      const resolvedDeckId = deckId === 'random' ? getRandomDeckId() : deckId;

      // Multiplayer: send deck to server
      if (getGameMode() === 'multi') {
        setSelectedDeckId(resolvedDeckId);
        getWs().send(JSON.stringify({ type: 'deckSelect', deckId: resolvedDeckId }));
        setMpStatus('Deck selected! Waiting for opponent...');
        return;
      }

      // Solo: continue to AI deck selection
      pendingDeckId = resolvedDeckId;
      $('setup').classList.add('hidden');
      showAIDeckSelector();
    }

    function showAIDeckSelector() {
      const options = Object.entries(DECK_INFO).map(([id, info]) => ({
        name: `${info.icon} ${info.name}`,
        sub: info.desc,
        action: () => selectAIDeck(id)
      }));

      // Add random option
      options.push({
        name: '? Random',
        sub: 'Let fate decide',
        action: () => selectAIDeck('random')
      });

      showModal('Choose Rival Deck', options, { noCancel: true });
    }

    function selectAIDeck(deckId) {
      pendingAIDeckId = deckId === 'random' ? getRandomDeckId() : deckId;
      closeModal();
      showCoinFlipModal();
    }

    function showCoinFlipModal() {
      showModal('Coin Flip', [
        { name: 'HEADS', sub: 'Call it!', action: () => doCoinFlip('heads') },
        { name: 'TAILS', sub: 'Call it!', action: () => doCoinFlip('tails') }
      ], { noCancel: true });
    }

    // Legacy function for compatibility
    function showCoinFlip(deckId) {
      pendingDeckId = deckId;
      pendingAIDeckId = getRandomDeckId();
      $('setup').classList.add('hidden');
      showCoinFlipModal();
    }

    async function doCoinFlip(playerCall) {
      closeModal();

      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const playerWon = playerCall === result;

      // Shaded Depth coin art at different sizes
      const coinSmall = {
        heads: '▓███▓\n█ H █\n▓███▓',
        tails: '▓███▓\n█ T █\n▓███▓',
        edge:  '▌▐\n▌▐\n▌▐'
      };

      const coinMed = {
        heads: '░▒▓████▓▒░\n█        █\n█   H    █\n█        █\n░▒▓████▓▒░',
        tails: '░▒▓████▓▒░\n█        █\n█   T    █\n█        █\n░▒▓████▓▒░',
        edge:  ' ▌▐\n ▌▐\n ▌▐\n ▌▐\n ▌▐'
      };

      const coinBig = {
        heads: '░░▒▓██████▓▒░░\n█            █\n█            █\n█     H      █\n█            █\n█            █\n░░▒▓██████▓▒░░',
        tails: '░░▒▓██████▓▒░░\n█            █\n█            █\n█     T      █\n█            █\n█            █\n░░▒▓██████▓▒░░',
        edge:  '  ▌▐\n  ▌▐\n  ▌▐\n  ▌▐\n  ▌▐\n  ▌▐\n  ▌▐'
      };

      // Font sizes for depth effect
      const fontSize = { small: '10px', med: '14px', big: '18px' };

      // Create overlay for animation
      const overlay = document.createElement('div');
      overlay.id = 'coin-flip-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;';
      const coinDisplay = document.createElement('pre');
      coinDisplay.style.cssText = 'color:var(--text);text-align:center;font-family:monospace;transition:transform 0.08s ease-out;line-height:1.2;';
      // Phase 9c: in aaa mode the same overlay/lifecycle hosts a CSS-3D gold
      // coin instead of ASCII art; every frame delay below is unchanged, so
      // the result timing contract (1780 ms) is byte-identical to classic.
      const isAaaCoin = document.documentElement.dataset.presentation === 'aaa';
      let aaaCoinScene = null;
      let aaaCoin = null;
      let aaaRotation = 0;
      if (isAaaCoin) {
        overlay.classList.add('aaa-coin-overlay');
        aaaCoinScene = document.createElement('div');
        aaaCoinScene.className = 'aaa-coin-scene';
        aaaCoin = document.createElement('div');
        aaaCoin.className = 'aaa-coin';
        aaaCoin.innerHTML =
          '<div class="aaa-coin-face aaa-coin-face--heads">H</div>'
          + '<div class="aaa-coin-face aaa-coin-face--tails">T</div>';
        aaaCoinScene.appendChild(aaaCoin);
        overlay.appendChild(aaaCoinScene);
      } else {
        overlay.appendChild(coinDisplay);
      }
      document.body.appendChild(overlay);

      // Animation sequence: rise, spin, fall, bounce, reveal
      const frames = [
        // Rise phase (getting bigger)
        { art: coinSmall.edge, size: 'small', delay: 80 },
        { art: coinMed.heads, size: 'med', delay: 80 },
        { art: coinMed.edge, size: 'med', delay: 60 },
        { art: coinBig.tails, size: 'big', delay: 60 },
        { art: coinBig.edge, size: 'big', delay: 50 },
        { art: coinBig.heads, size: 'big', delay: 50 },
        { art: coinBig.edge, size: 'big', delay: 50 },
        { art: coinBig.tails, size: 'big', delay: 50 },
        { art: coinBig.edge, size: 'big', delay: 50 },
        { art: coinBig.heads, size: 'big', delay: 50 },
        // Fall phase (getting smaller)
        { art: coinBig.edge, size: 'big', delay: 50 },
        { art: coinMed.tails, size: 'med', delay: 60 },
        { art: coinMed.edge, size: 'med', delay: 60 },
        { art: coinMed.heads, size: 'med', delay: 70 },
        { art: coinSmall.edge, size: 'small', delay: 80 },
        // Bounce 1
        { art: coinMed[result], size: 'med', delay: 100, bounce: true },
        { art: coinSmall.edge, size: 'small', delay: 80 },
        // Bounce 2 (smaller)
        { art: coinSmall[result], size: 'small', delay: 120, bounce: true },
        { art: coinSmall.edge, size: 'small', delay: 60 },
        // Final land
        { art: coinSmall[result], size: 'small', delay: 400 },
      ];

      // Play animation (same frames/delays in both presentations)
      const aaaScale = { small: 0.62, med: 0.85, big: 1.12 };
      for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
        const frame = frames[frameIndex];
        if (aaaCoin) {
          aaaRotation += 90;
          if (frameIndex === frames.length - 1) {
            // Land exactly on the flipped result face.
            aaaRotation = Math.ceil(aaaRotation / 360) * 360
              + (result === 'tails' ? 180 : 0);
          }
          aaaCoin.style.transition = `transform ${frame.delay}ms ease-in-out`;
          aaaCoin.style.transform =
            `scale(${aaaScale[frame.size]}) rotateY(${aaaRotation}deg)`;
        } else {
          coinDisplay.textContent = frame.art;
          coinDisplay.style.fontSize = fontSize[frame.size];
        }
        if (frame.bounce) {
          (aaaCoinScene ?? coinDisplay).style.transform = 'translateY(-20px)';
          await Anim.wait(60);
          (aaaCoinScene ?? coinDisplay).style.transform = 'translateY(0)';
        }
        await Anim.wait(frame.delay);
      }

      // Remove overlay
      overlay.remove();

      if (playerWon) {
        // Player won - let them choose
        showModal(`${result.toUpperCase()}! You won the toss`, [
          { name: 'Go First', sub: 'You cannot attack on turn 1', action: () => startGame(pendingDeckId, true) },
          { name: 'Go Second', sub: 'You can attack on turn 1', action: () => startGame(pendingDeckId, false) }
        ], { noCancel: true });
      } else {
        // AI won - randomly choose and auto-start
        const aiGoesFirst = Math.random() < 0.5;
        // Brief message overlay
        const msg = document.createElement('div');
        msg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;color:var(--dim);font-size:12px;text-transform:uppercase;letter-spacing:2px;';
        msg.innerHTML = `<div style="margin-bottom:8px;">${result.toUpperCase()}! Rival won</div><div style="color:var(--text);font-size:14px;">${aiGoesFirst ? 'Rival goes first' : 'You go first'}</div>`;
        document.body.appendChild(msg);
        await Anim.wait(1500);
        msg.remove();
        startGame(pendingDeckId, !aiGoesFirst);
      }
    }

    // MP coin flip animation (server already decided, just show result)
    async function playMPCoinFlip(playerWon) {
      const result = playerWon ? 'heads' : 'tails';

      const coinSmall = {
        heads: '▓███▓\n█ H █\n▓███▓',
        tails: '▓███▓\n█ T █\n▓███▓',
        edge:  '▌▐\n▌▐\n▌▐'
      };
      const coinMed = {
        heads: '░▒▓████▓▒░\n█        █\n█   H    █\n█        █\n░▒▓████▓▒░',
        tails: '░▒▓████▓▒░\n█        █\n█   T    █\n█        █\n░▒▓████▓▒░',
        edge:  ' ▌▐\n ▌▐\n ▌▐\n ▌▐\n ▌▐'
      };
      const coinBig = {
        heads: '░░▒▓██████▓▒░░\n█            █\n█     H      █\n█            █\n░░▒▓██████▓▒░░',
        tails: '░░▒▓██████▓▒░░\n█            █\n█     T      █\n█            █\n░░▒▓██████▓▒░░',
        edge:  '  ▌▐\n  ▌▐\n  ▌▐\n  ▌▐\n  ▌▐'
      };
      const fontSize = { small: '10px', med: '14px', big: '18px' };

      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;';
      const coinDisplay = document.createElement('pre');
      coinDisplay.style.cssText = 'color:var(--text);text-align:center;font-family:monospace;transition:transform 0.08s ease-out;line-height:1.2;';
      // Phase 9c: in aaa mode the same overlay/lifecycle hosts a CSS-3D gold
      // coin instead of ASCII art; every frame delay below is unchanged, so
      // the result timing contract (1780 ms) is byte-identical to classic.
      const isAaaCoin = document.documentElement.dataset.presentation === 'aaa';
      let aaaCoinScene = null;
      let aaaCoin = null;
      let aaaRotation = 0;
      if (isAaaCoin) {
        overlay.classList.add('aaa-coin-overlay');
        aaaCoinScene = document.createElement('div');
        aaaCoinScene.className = 'aaa-coin-scene';
        aaaCoin = document.createElement('div');
        aaaCoin.className = 'aaa-coin';
        aaaCoin.innerHTML =
          '<div class="aaa-coin-face aaa-coin-face--heads">H</div>'
          + '<div class="aaa-coin-face aaa-coin-face--tails">T</div>';
        aaaCoinScene.appendChild(aaaCoin);
        overlay.appendChild(aaaCoinScene);
      } else {
        overlay.appendChild(coinDisplay);
      }
      document.body.appendChild(overlay);

      const frames = [
        { art: coinSmall.edge, size: 'small', delay: 80 },
        { art: coinMed.heads, size: 'med', delay: 80 },
        { art: coinBig.tails, size: 'big', delay: 50 },
        { art: coinBig.edge, size: 'big', delay: 50 },
        { art: coinBig.heads, size: 'big', delay: 50 },
        { art: coinBig.edge, size: 'big', delay: 50 },
        { art: coinMed.tails, size: 'med', delay: 60 },
        { art: coinSmall.edge, size: 'small', delay: 80 },
        { art: coinMed[result], size: 'med', delay: 100, bounce: true },
        { art: coinSmall[result], size: 'small', delay: 400 },
      ];

      for (const frame of frames) {
        coinDisplay.textContent = frame.art;
        coinDisplay.style.fontSize = fontSize[frame.size];
        if (frame.bounce) {
          coinDisplay.style.transform = 'translateY(-20px)';
          await Anim.wait(60);
          coinDisplay.style.transform = 'translateY(0)';
        }
        await Anim.wait(frame.delay);
      }

      // Show result text
      const resultText = playerWon ? 'YOU GO FIRST!' : 'OPPONENT GOES FIRST';
      coinDisplay.textContent = `${coinBig[result]}\n\n${resultText}`;
      await Anim.wait(1500);

      overlay.remove();
    }

    async function playBeginAnimation() {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:9999;';
      const display = document.createElement('pre');
      display.style.cssText = 'color:var(--text);font-size:28px;text-align:center;font-family:monospace;line-height:1.2;transition:transform 0.15s ease-out;';
      overlay.appendChild(display);
      document.body.appendChild(overlay);

      // Crossbar Letter Slide animation frames (all centered)
      const frames = [
        { text: "│                           │\n│                           │\n│                           │\n│                           │\n│                           │", delay: 60, offsetX: 0, offsetY: 0 },
        { text: " │                         │\n─┼─B─────────────────────!─┼─\n │                         │\n─┼─────E───────────N───────┼─\n │                         │", delay: 70, offsetX: 0, offsetY: 0 },
        { text: "  │                       │\n──┼──B───────────────!────┼──\n  │                       │\n──┼────E─────────N────────┼──\n  │         GI            │", delay: 70, offsetX: 0, offsetY: 0 },
        { text: "   │                     │\n───┼───B───────────!─────┼───\n   │        GI           │\n───┼─────E───────N───────┼───\n   │                     │", delay: 70, offsetX: 0, offsetY: 0 },
        { text: "    │                   │\n────┼────B───────!──────┼────\n    │       GI          │\n────┼──────E───N────────┼────\n    │                   │", delay: 70, offsetX: 0, offsetY: 0 },
        { text: "     │                 │\n─────┼─────B─────!─────┼─────\n     │      GI         │\n─────┼──────E─N────────┼─────\n     │                 │", delay: 70, offsetX: 0, offsetY: 0 },
        { text: "      │               │\n──────┼─────B───!─────┼──────\n      │     GIN       │\n──────┼──────E────────┼──────\n      │               │", delay: 70, offsetX: 0, offsetY: 0 },
        { text: "       │             │\n───────┼────BEGIN!───┼───────\n       │             │", delay: 100, offsetX: 0, offsetY: 0 },
        { text: "BEGIN!", delay: 150, scale: 1.3, offsetX: 0, offsetY: 0 },
        { text: "BEGIN!", delay: 600, scale: 1.5, offsetX: 0, offsetY: 0 },
      ];

      for (const frame of frames) {
        display.textContent = frame.text;
        display.style.transform = `translate(${frame.offsetX || 0}px, ${frame.offsetY || 0}px) scale(${frame.scale || 1})`;
        await Anim.wait(frame.delay);
      }

      overlay.remove();
    }

    async function playTurnEndAnimation() {
      state.animating = true;

      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;';
      const display = document.createElement('pre');
      display.style.cssText = 'color:var(--text);font-size:28px;text-align:center;font-family:monospace;line-height:1.2;transition:transform 0.15s ease-out;';
      overlay.appendChild(display);
      document.body.appendChild(overlay);

      // TURN END animation frames (similar style to BEGIN)
      const frames = [
        { text: "│                           │\n│                           │\n│                           │", delay: 50 },
        { text: " │                         │\n─┼─T───────────────────D───┼─\n │                         │", delay: 60 },
        { text: "  │                       │\n──┼──T─────────────D──────┼──\n  │        RN             │", delay: 60 },
        { text: "   │                     │\n───┼───T───────────D─────┼───\n   │       RN EN          │", delay: 60 },
        { text: "    │                   │\n────┼────T─────────D────┼────\n    │      RN EN         │", delay: 60 },
        { text: "     │                 │\n─────┼────TURN END─────┼─────\n     │                 │", delay: 80 },
        { text: "TURN END", delay: 120, scale: 1.2 },
        { text: "TURN END", delay: 400, scale: 1.4 },
      ];

      for (const frame of frames) {
        display.textContent = frame.text;
        display.style.transform = `scale(${frame.scale || 1})`;
        await Anim.wait(frame.delay);
      }

      overlay.remove();
      state.animating = false;
    }

    function highlightEndTurn(show = true) {
      const mBtn = $('m-btn-end');
      const dBtn = $('d-btn-end');
      if (show) {
        mBtn?.classList.add('end-turn-highlight');
        dBtn?.classList.add('end-turn-highlight');
      } else {
        mBtn?.classList.remove('end-turn-highlight');
        dBtn?.classList.remove('end-turn-highlight');
      }
    }

    function isDesktopBehaviorQaEnabled() {
      return new URLSearchParams(location.search).get('behaviorQa') === '1';
    }

    function showVisualFixtureRoute(presentation = {}) {
      $('setup').classList.add('hidden');
      $('modal').classList.remove('open');
      $('responseModal').classList.remove('open');
      $('rulesModal').classList.remove('open');
      $('cardModal').classList.remove('open');
      $('triggerModal').classList.remove('open', 'cast', 'set', 'creature');
      $('result').classList.remove('open', 'win', 'lose');
      state.animating = false;

      if (isDesktopBehaviorQaEnabled() && presentation.result) {
        showResult(
          presentation.result.outcome,
          presentation.result.reason,
        );
      }

      if (
        isDesktopBehaviorQaEnabled() &&
        presentation.response?.pendingAction
      ) {
        void handleLocalPendingAction(
          presentation.response.pendingAction,
          presentation.response.ownerSide === 'p2' ? 1 : 0,
        );
      }
    }

    async function startGame(deckId, playerFirst = true) {
      closeModal();

      // BEGIN! animation
      await playBeginAnimation();

      // Use pre-selected AI deck, or random if not set
      const aiDeck = pendingAIDeckId || getRandomDeckId();

      state.G = {
        me: mkPlayer(deckId),
        opp: mkPlayer(aiDeck),
        turn: 1,
        phase: 'main',
        log: [],
        myTurn: playerFirst,
        winner: null,
        firstTurn: true,
        hasAttacked: false,  // C3: Track if player attacked this turn
        hasRetreated: false, // C3: Track if player retreated this turn
        actionLock: false,   // BUG-12: Prevent multiple attack button clicks
        aiDifficulty: selectedDifficulty, // 1=Pup, 2=Hunter
      };

      startGameTimer(updateTimer);

      $('setup').classList.add('hidden');

      log('Game started');

      if (playerFirst) {
        log('You go first! Choose a creature to summon');
        render();
      } else {
        log('Rival goes first');
        render();
        // AI takes first turn
        if (typeof aiTurn === 'function') {
          setTimeout(() => {
            Promise.resolve(aiTurn()).catch(err => {
              console.error('[AI] First turn failed:', err);
              log(`(AI error: ${err.message || err})`, 'dmg');
            });
          }, 600);
        }
      }
    }

    // Expose functions globally for onclick handlers (module scope)
    window.startGame = startGame;
    window.showCoinFlip = showCoinFlip;
    window.selectPlayerDeck = selectPlayerDeck;
    window.deckPress = deckPress;
    window.deckRelease = deckRelease;
    window.deckHover = deckHover;
    window.deckLeave = deckLeave;

    // Timer update function (uses ANIM_TIMING)
    function updateTimer() {
      const s = readGameElapsedSeconds();
      const str = Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
      $('m-time').textContent = str;
      $('d-time').textContent = str;
      // Phase 9b: the AAA timer chip mirrors the same clock.
      const aaaTimer = document.getElementById('aaa-timer');
      if (aaaTimer) aaaTimer.textContent = str;
    }

    // ═══════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════

    // Phase 4: uid-keyed zone rendering. Markup still comes from the same
    // src/render.js template strings byte-for-byte; the keyed view only
    // preserves per-card DOM identity across re-renders so FLIP motion can
    // key on uid. Views lazily rebind if a container node is ever replaced.
    const keyedZoneViews = new Map(); // container id -> { container, view }

    function keyedZoneView(containerId) {
      const container = $(containerId);
      let entry = keyedZoneViews.get(containerId);
      if (!entry || entry.container !== container) {
        container.innerHTML = '';
        entry = { container, view: createHtmlKeyedView(container) };
        keyedZoneViews.set(containerId, entry);
      }
      return entry.view;
    }

    // Single-slot zones addressed by element id (set verses): patch the slot
    // node in place from the same rendered markup instead of outerHTML
    // replacement, so anim id-selectors and captured references stay valid.
    const setSlotApplied = new Map(); // slot id -> { node, html }

    function patchSetSlot(id, verse, isPlayer) {
      const node = $(id);
      const html = renderSetVerse(verse, id, isPlayer);
      const applied = setSlotApplied.get(id);
      if (applied && applied.node === node && applied.html === html) return;
      const template = document.createElement('template');
      template.innerHTML = html;
      syncElementToHtml(node, template.content.firstElementChild);
      setSlotApplied.set(id, { node, html });
    }

    function render() {
      if (!state.G) return;

      // Turn
      $('m-turn').textContent = state.G.turn;
      $('d-turn').textContent = state.G.turn;

      // LP (as hearts)
      $('m-my-lp').textContent = hearts(state.G.me.lp);
      $('m-opp-lp').textContent = hearts(state.G.opp.lp);
      $('d-my-lp').textContent = hearts(state.G.me.lp);
      $('d-opp-lp').textContent = hearts(state.G.opp.lp);
      $('d-lp-left').textContent = hearts(state.G.me.lp);
      $('d-lp-right').textContent = hearts(state.G.opp.lp);

      // Mana
      $('m-my-mana').textContent = manaStr(state.G.me);
      $('m-opp-mana').textContent = manaStr(state.G.opp);

      // Desktop mana pips
      $('d-mana-pips').innerHTML = renderManaPips(state.G.me.mana, state.G.me.maxMana);
      $('d-opp-mana-pips').innerHTML = renderManaPips(state.G.opp.mana, state.G.opp.maxMana);

      // Stats
      $('d-deck').textContent = state.G.me.deckCount ?? state.G.me.deck?.length ?? 0;
      $('d-grave').textContent = state.G.me.grave.length;
      $('d-opp-deck').textContent = state.G.opp.deckCount ?? state.G.opp.deck?.length ?? 0;
      $('d-opp-hand').textContent = state.G.opp.handCount ?? state.G.opp.hand?.length ?? 0;
      $('d-opp-grave').textContent = state.G.opp.grave.length;
      $('m-my-grave-ct').textContent = state.G.me.grave.length;
      $('m-opp-grave-ct').textContent = state.G.opp.grave.length;
      $('m-my-grave-slot').classList.toggle('has-grave', state.G.me.grave.length > 0);
      $('m-opp-grave-slot').classList.toggle('has-grave', state.G.opp.grave.length > 0);
      $('d-set-verse').textContent = state.G.me.setVerse ? '✓' : '-';

      // Set Verses — patched in place (same renderSetVerse markup) so the
      // id-addressed slot node keeps one DOM identity instead of being
      // destroyed by outerHTML on every render.
      patchSetSlot('m-my-set', state.G.me.setVerse, true);
      patchSetSlot('m-opp-set', state.G.opp.setVerse, false);
      patchSetSlot('d-my-set', state.G.me.setVerse, true);
      patchSetSlot('d-opp-set', state.G.opp.setVerse, false);

      // Active creatures
      // Calculate ATK modifiers for display
      const myAtkInfo = state.G.me.active ? getAtkModifiers(state.G.me.active, state.G.me, state.G.opp) : null;
      const oppAtkInfo = state.G.opp.active ? getAtkModifiers(state.G.opp.active, state.G.opp, state.G.me) : null;

      const activeModels = (card, atkInfo, ownerPlayer) => [
        card
          ? { uid: card.uid, html: renderActiveCard(card, atkInfo, ownerPlayer) }
          : { uid: '__empty__', html: renderActiveCard(null) },
      ];
      keyedZoneView('m-my-active').reconcile(activeModels(state.G.me.active, myAtkInfo, state.G.me));
      keyedZoneView('m-opp-active').reconcile(activeModels(state.G.opp.active, oppAtkInfo, state.G.opp));
      keyedZoneView('d-my-active').reconcile(activeModels(state.G.me.active, myAtkInfo, state.G.me));
      keyedZoneView('d-opp-active').reconcile(activeModels(state.G.opp.active, oppAtkInfo, state.G.opp));

      // Bench (two slots, filled or empty, exactly as renderBench composed them)
      const benchModels = (bench) => [0, 1].map((slot) => (
        bench[slot]
          ? { uid: bench[slot].uid, html: renderMiniCard(bench[slot]) }
          : { uid: `__empty-${slot}__`, html: '<div class="card-empty"></div>' }
      ));
      keyedZoneView('m-my-bench').reconcile(benchModels(state.G.me.bench));
      keyedZoneView('m-opp-bench').reconcile(benchModels(state.G.opp.bench));
      keyedZoneView('d-my-bench').reconcile(benchModels(state.G.me.bench));
      keyedZoneView('d-opp-bench').reconcile(benchModels(state.G.opp.bench));

      // Hand
      $('m-hand-ct').textContent = state.G.me.handCount ?? state.G.me.hand?.length ?? 0;
      $('d-hand-ct').textContent = state.G.me.handCount ?? state.G.me.hand?.length ?? 0;
      keyedZoneView('m-hand').reconcile(state.G.me.hand.map(c => ({
        uid: c.uid,
        html: renderHandCard(c, false, state.selectedCard),
      })));
      keyedZoneView('d-hand').reconcile(state.G.me.hand.map(c => ({
        uid: c.uid,
        html: renderHandCard(c, true, state.selectedCard),
      })));

      // Buttons
      updateButtons();

      // Highlight END TURN if player has 0 mana (can't do anything)
      if (state.G.myTurn && state.G.me.mana === 0) {
        highlightEndTurn(true);
      }

      // Log
      renderLog();

      // Phase 8: the AAA shell mirrors this exact projected state after the
      // classic render (so its log/affordance mirrors read final DOM). It is
      // presentation-only; on any mount failure gameplay continues classic.
      renderAaaShell();
    }

    // ═══ Phase 8 AAA shell (behind the `aaa` presentation flag) ═══
    let aaaShell = null;

    function isAaaMode() {
      return document.documentElement.dataset.presentation === 'aaa';
    }

    function renderAaaShell() {
      if (!isAaaMode() || !state.G) return;
      if (!aaaShell) {
        aaaShell = createAaaShell({
          actions: { doSummon, doCast, doSet, doAttack, doRetreat, endTurn, showCardDetail, showGraveyard, showRules },
          onError: (error) => console.warn('AAA shell error; staying classic', error),
        });
      }
      const host = document.getElementById('aaa-stage');
      if (host) host.style.display = '';
      aaaShell.update(state.G, { selectedCard: state.selectedCard });
      if (!aaaShell.mounted) {
        // RSP-07: the scene failed to mount (no WebGL, context loss, or a
        // scene error). The aaa CSS hides the classic shells, so a silent
        // failure would leave a dead screen — downgrade the presentation
        // flag itself so the classic renderer takes over fully.
        document.documentElement.dataset.presentation = 'classic';
        if (host) host.style.display = 'none';
        aaaShell = null;
        return;
      }
      // Mirror the classic affordability computation (single source of truth
      // in updateButtons) onto the AAA action rail.
      const mirror = [
        ['aaa-action-summon', 'd-btn-summon'],
        ['aaa-action-attack', 'd-btn-atk'],
        ['aaa-action-cast', 'd-btn-cast'],
        ['aaa-action-set', 'd-btn-set'],
        ['aaa-action-retreat', 'd-btn-retreat'],
        ['aaa-action-end', 'd-btn-end'],
      ];
      for (const [aaaId, classicId] of mirror) {
        const target = document.getElementById(aaaId);
        const source = document.getElementById(classicId);
        if (target && source) target.disabled = source.disabled;
      }
    }

    function renderLog() {
      // Keyed by absolute log index: entries are append-only within a game,
      // so existing lines keep their DOM node and only new lines are created.
      const log = state.G.log;
      const mobileWindow = log.slice(-8);
      const mobileStart = log.length - mobileWindow.length;
      keyedZoneView('m-log').reconcile(mobileWindow.map((entry, i) => ({
        uid: `log-${mobileStart + i}`,
        html: renderLogInlineEntry(entry),
      })));
      // Desktop shows the full retained history, newest first (BUG-B1).
      const desktopWindow = log.slice(-500);
      const desktopStart = log.length - desktopWindow.length;
      keyedZoneView('d-log').reconcile(desktopWindow.slice().reverse().map((entry, i) => ({
        uid: `log-${desktopStart + desktopWindow.length - 1 - i}`,
        html: renderLogEntry(entry),
      })));
    }

    function updateButtons() {
      const isTerminal =
        state.G.winner != null &&
        (!state.G.isVisualFixture || isDesktopBehaviorQaEnabled());
      const hasCreature = state.G.me.hand.some(c => c.cardType === 'creature');
      const hasCast = state.G.me.hand.some(c => c.cardType === 'verse' && c.type === 'cast');
      const hasSet = state.G.me.hand.some(c => c.cardType === 'verse' && c.type === 'set');
      const canRetreat = state.G.me.active && state.G.me.bench.length > 0;
      const canAttack = state.G.me.active && !state.G.firstTurn; // Can attack creatures or LP directly (not on first turn)

      // C3: Cannot attack after retreating, cannot retreat after attacking
      const attackAllowed = canAttack && !state.G.hasAttacked && !state.G.hasRetreated;
      const retreatAllowed = canRetreat && !state.G.hasAttacked && !state.G.hasRetreated;

      ['m-btn-summon','d-btn-summon'].forEach(id => $(id).disabled = isTerminal || !hasCreature || !state.G.myTurn);
      ['m-btn-cast','d-btn-cast'].forEach(id => $(id).disabled = isTerminal || !hasCast || !state.G.myTurn);
      ['m-btn-set','d-btn-set'].forEach(id => $(id).disabled = isTerminal || !hasSet || state.G.me.setVerse || !state.G.myTurn);
      ['m-btn-atk','d-btn-atk'].forEach(id => $(id).disabled = isTerminal || !attackAllowed || !state.G.myTurn);
      ['m-btn-retreat','d-btn-retreat'].forEach(id => $(id).disabled = isTerminal || !retreatAllowed || !state.G.myTurn);
      ['m-btn-end','d-btn-end'].forEach(id => $(id).disabled = isTerminal || !state.G.myTurn);
    }

    // ═══════════════════════════════════════════════════════════════
    // CARD INTERACTIONS
    // ═══════════════════════════════════════════════════════════════

    function selectCard(uid) {
      state.selectedCard = state.selectedCard === uid ? null : uid;
      render();
    }

    // Drag-to-play system
    const DRAG_THRESHOLD = 15;

    function cardPress(uid, e) {
      // Check if card is in player's hand (only hand cards can be dragged)
      const handCard = state.G.me.hand.find(c => c.uid === uid);

      // Search all card locations for zoom preview
      let card = handCard;
      if (!card && state.G.me.active?.uid === uid) card = state.G.me.active;
      if (!card) card = state.G.me.bench.find(c => c.uid === uid);
      if (!card) card = state.G.me.grave.find(c => c.uid === uid);
      if (!card && state.G.me.setVerse?.uid === uid) card = state.G.me.setVerse;
      if (!card && state.G.opp.active?.uid === uid) card = state.G.opp.active;
      if (!card) card = state.G.opp.bench.find(c => c.uid === uid);
      if (!card && state.G.opp.setVerse?.uid === uid) card = state.G.opp.setVerse;
      if (!card) return;

      // Don't preventDefault here - allow scrolling until we confirm it's a drag

      // Non-hand cards: only allow hold-to-zoom, no drag
      if (!handCard) {
        state.longPressTimer = setTimeout(() => {
          showCardDetail(uid);
        }, 400);
        return;
      }

      // Hand cards: full drag + zoom functionality
      const clientX = e?.clientX ?? e?.touches?.[0]?.clientX ?? 0;
      const clientY = e?.clientY ?? e?.touches?.[0]?.clientY ?? 0;

      // Track if card is affordable
      const canAfford = card.cost <= state.G.me.mana;

      // Initialize drag state
      state.drag = {
        active: false,
        card: card,
        uid: uid,
        startX: clientX,
        startY: clientY,
        currentX: clientX,
        currentY: clientY,
        canAfford: canAfford,
        el: null
      };

      // Long press timer for zoom preview
      state.longPressTimer = setTimeout(() => {
        if (state.drag && !state.drag.active) {
          showCardDetail(uid);
          state.drag = null;
        }
      }, 400);

      // Add move/up listeners
      document.addEventListener('pointermove', onDragMove);
      document.addEventListener('pointerup', onDragEnd);
      document.addEventListener('pointercancel', onDragEnd);
    }

    function onDragMove(e) {
      if (!state.drag) return;

      const clientX = e.clientX ?? 0;
      const clientY = e.clientY ?? 0;
      state.drag.currentX = clientX;
      state.drag.currentY = clientY;

      const dx = clientX - state.drag.startX;
      const dy = clientY - state.drag.startY;
      const dist = Math.sqrt(dx*dx + dy*dy);

      // Only prevent scrolling once we've confirmed it's a drag (past threshold)
      if (state.drag.active && e.cancelable) {
        e.preventDefault();
      }

      // Check if we should enter drag mode
      if (!state.drag.active && dist >= DRAG_THRESHOLD) {
        // Cancel long press
        if (state.longPressTimer) {
          clearTimeout(state.longPressTimer);
          state.longPressTimer = null;
        }

        state.drag.active = true;
        createDragElement();
        if (state.drag.canAfford) {
          highlightDropZones();
        }
      }

      // Update drag element position
      if (state.drag?.active && state.drag.el) {
        state.drag.el.style.left = (clientX - 40) + 'px';
        state.drag.el.style.top = (clientY - 50) + 'px';

        // Update affordability visual based on position
        const overField = isOverField(clientX, clientY);
        state.drag.el.classList.toggle('unaffordable', !state.drag.canAfford && overField);

        if (state.drag.canAfford) {
          updateDropZoneHighlights(clientX, clientY);
        }
      }
    }

    function isOverField(x, y) {
      const isMobile = window.innerWidth < 900;
      // Check if over the battlefield area (not the hand)
      const fieldEl = isMobile
        ? document.querySelector('.m-field-half.you')
        : document.querySelector('.d-field');
      if (!fieldEl) return false;
      const rect = fieldEl.getBoundingClientRect();
      return y <= rect.bottom; // Over field if above the bottom of field
    }

    function onDragEnd(e) {
      document.removeEventListener('pointermove', onDragMove);
      document.removeEventListener('pointerup', onDragEnd);
      document.removeEventListener('pointercancel', onDragEnd);

      const captureTarget = e.target;
      if (
        Number.isInteger(e.pointerId) &&
        captureTarget?.hasPointerCapture?.(e.pointerId)
      ) {
        captureTarget.releasePointerCapture(e.pointerId);
      }

      if (state.longPressTimer) {
        clearTimeout(state.longPressTimer);
        state.longPressTimer = null;
      }

      if (state.drag?.active) {
        const clientX = e.clientX ?? state.drag.currentX;
        const clientY = e.clientY ?? state.drag.currentY;

        // Cancellation is cleanup-only, even if the final coordinates are over
        // a legal field target.
        if (e.type !== 'pointercancel' && state.drag.canAfford) {
          const zone = detectDropZone(clientX, clientY);
          if (zone) {
            executeDrop(state.drag.card, zone);
          }
        }

        // Clean up
        if (state.drag.el) {
          state.drag.el.remove();
        }
        clearDropZoneHighlights();
      }

      state.drag = null;
    }

    function cardRelease() {
      // Legacy - now handled by onDragEnd
      if (state.longPressTimer) {
        clearTimeout(state.longPressTimer);
        state.longPressTimer = null;
      }
    }

    function createDragElement() {
      const card = state.drag.card;
      const typeClass = card.cardType === 'creature' ? 'creature' : (card.type === 'cast' ? 'verse-cast' : 'verse-set');
      const typeLabel = card.cardType === 'creature' ? 'Creature' : (card.type === 'cast' ? 'Cast' : 'Set');

      const el = document.createElement('div');
      el.className = `hand-card ${typeClass} dragging`;
      el.innerHTML = `
        <div class="cost-pip">${card.cost}</div>
        <div class="name">${card.name}</div>
        <div class="type">${typeLabel}</div>
      `;
      el.style.cssText = `
        position: fixed;
        z-index: 9999;
        pointer-events: none;
        transform: scale(0.9);
        opacity: 0.9;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        left: ${state.drag.currentX - 40}px;
        top: ${state.drag.currentY - 50}px;
      `;
      document.body.appendChild(el);
      state.drag.el = el;
    }

    function getFieldElement() {
      const isMobile = window.innerWidth < 900;
      return isMobile
        ? document.querySelector('#mobile .m-field-half.you')?.parentElement || document.querySelector('#mobile')
        : document.querySelector('.d-field');
    }

    function canPlayCard(card) {
      // Check if card can be played at all
      if (card.cardType === 'creature') {
        // Need empty active OR room on bench
        return !state.G.me.active || state.G.me.bench.length < 2;
      } else if (card.type === 'cast') {
        return true; // Cast verses can always be attempted
      } else if (card.type === 'set') {
        return !state.G.me.setVerse; // Need empty set slot
      }
      return false;
    }

    function getPlayType(card) {
      // Determine what happens when this card is played
      if (card.cardType === 'creature') {
        if (!state.G.me.active) return 'summon-active';
        if (state.G.me.bench.length < 2) return 'summon-bench';
        return null;
      } else if (card.type === 'cast') {
        return 'cast';
      } else if (card.type === 'set') {
        if (!state.G.me.setVerse) return 'set-verse';
        return null;
      }
      return null;
    }

    function highlightDropZones() {
      const card = state.drag?.card;
      if (!card || !canPlayCard(card)) return;

      const fieldEl = getFieldElement();
      if (fieldEl) fieldEl.classList.add('drop-target');
    }

    function clearDropZoneHighlights() {
      document.querySelectorAll('.drop-target, .drop-hover').forEach(el => {
        el.classList.remove('drop-target', 'drop-hover');
      });
    }

    function updateDropZoneHighlights(x, y) {
      const card = state.drag?.card;
      if (!card || !canPlayCard(card)) return;

      const fieldEl = getFieldElement();
      if (!fieldEl) return;

      const rect = fieldEl.getBoundingClientRect();
      const isOver = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      fieldEl.classList.toggle('drop-hover', isOver);
    }

    function detectDropZone(x, y) {
      const card = state.drag?.card;
      if (!card) return null;

      const playType = getPlayType(card);
      if (!playType) return null;

      const fieldEl = getFieldElement();
      if (!fieldEl) return null;

      const rect = fieldEl.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return { type: playType };
      }
      return null;
    }

    async function executeDrop(card, zone) {
      // Use unified playCard for all card plays
      await playCard(card);
    }

    function setVersePress() {
      state.longPressTimer = setTimeout(() => showSetVerseDetail(), 400);
    }

    function setVerseRelease() {
      if (state.longPressTimer) {
        clearTimeout(state.longPressTimer);
        state.longPressTimer = null;
      }
    }

    function showSetVerseDetail() {
      const card = state.G.me.setVerse;
      if (!card) return;

      const el = $('cardDetail');
      const triggerHtml = card.trigger ? `<div class="ability-box"><div class="ability-name">Trigger</div><div class="ability-text">${card.trigger}</div></div>` : '';
      const artHtml = card.art ? `<div class="art-box verse-art">${card.art}</div>` : '';
      const flavorHtml = card.flavor ? `<div class="flavor">${card.flavor}</div>` : '';
      el.innerHTML = `
        <div class="top-bar set-verse"><span class="type">Verse • Set</span><span class="cost">${card.cost}</span></div>
        <div class="name-row"><div class="name">${card.name}</div></div>
        ${artHtml}
        ${triggerHtml}
        <div class="ability-box"><div class="ability-name">Effect</div><div class="ability-text">${card.text}</div></div>
        ${flavorHtml}
      `;

      $('cardModal').classList.add('open');
    }

    function showCardDetail(uid) {
      // Find card
      let card = findCard(uid);
      if (!card) return;

      const el = $('cardDetail');

      if (card.cardType === 'creature') {
        // BUG-B3: Check if creature is on battlefield (active OR bench) to show effective stats
        let atkInfo = null;
        let isOnField = false;
        let cardOwner = null;  // Track owner for player-level effects like unbreakable
        if (state.G.me.active?.uid === uid) {
          atkInfo = getAtkModifiers(card, state.G.me, state.G.opp);
          isOnField = true;
          cardOwner = state.G.me;
        } else if (state.G.opp.active?.uid === uid) {
          atkInfo = getAtkModifiers(card, state.G.opp, state.G.me);
          isOnField = true;
          cardOwner = state.G.opp;
        } else if (state.G.me.bench.some(c => c.uid === uid)) {
          // Bench creatures also show current HP and potential ATK modifiers
          atkInfo = getAtkModifiers(card, state.G.me, state.G.opp);
          isOnField = true;
          cardOwner = state.G.me;
        } else if (state.G.opp.bench.some(c => c.uid === uid)) {
          atkInfo = getAtkModifiers(card, state.G.opp, state.G.me);
          isOnField = true;
          cardOwner = state.G.opp;
        }

        // HP display: show current if on field, otherwise max
        const hpVal = isOnField ? `${card.curHp}/${card.hp}` : card.hp;
        const hpClass = (isOnField && card.curHp < card.hp) ? 'hp-damaged' : '';

        // ATK display: show effective if modified
        let atkVal = card.atk;
        let atkClass = '';
        let atkTooltip = '';
        if (atkInfo && atkInfo.effectiveAtk !== atkInfo.baseAtk) {
          atkVal = atkInfo.effectiveAtk;
          atkClass = atkInfo.effectiveAtk > atkInfo.baseAtk ? 'atk-boosted' : 'atk-reduced';
          atkTooltip = atkInfo.modifiers.map(m => `${m.name}: +${m.value}`).join(', ');
        }

        // Active effects section (only for creatures on battlefield)
        let effectsHtml = '';
        if (isOnField) {
          const effects = getActiveEffects(card, cardOwner);
          if (effects.length > 0) {
            const effectsList = effects.map(e =>
              `<div class="effect-item"><span class="effect-icon ${e.color}">${e.icon}</span><span class="effect-name">${e.name}</span><span class="effect-desc">${e.desc}</span></div>`
            ).join('');
            effectsHtml = `<div class="effects-section"><div class="effects-label">Active Effects</div>${effectsList}</div>`;
          }
        }

        el.innerHTML = `
          <div class="top-bar creature"><span class="type">Creature</span><span class="cost">${card.cost}</span></div>
          <div class="name-row"><div class="name">${card.name}</div><div class="subtitle">${card.subtitle}</div></div>
          <div class="art-box">${card.art}</div>
          <div class="stats-row">
            <div class="stat"><div class="label">HP</div><div class="val ${hpClass}">${hpVal}</div></div>
            <div class="stat"><div class="label">ATK</div><div class="val ${atkClass}" title="${atkTooltip}">${atkVal}</div></div>
          </div>
          ${effectsHtml}
          <div class="ability-box"><div class="ability-name">${card.ability?.name || card.ability}</div><div class="ability-text">${card.ability?.text || card.abilityText}</div></div>
          <div class="flavor">${card.flavor}</div>
          <button class="close-btn" onclick="closeCardModal(event, true)">Close</button>
        `;
      } else {
        const typeLabel = card.type === 'cast' ? 'Verse • Cast' : 'Verse • Set';
        const typeClass = card.type === 'cast' ? 'cast-verse' : 'set-verse';
        const triggerHtml = card.trigger ? `<div class="ability-box"><div class="ability-name">Trigger</div><div class="ability-text">${card.trigger}</div></div>` : '';
        const artHtml = card.art ? `<div class="art-box verse-art">${card.art}</div>` : '';
        const flavorHtml = card.flavor ? `<div class="flavor">${card.flavor}</div>` : '';
        el.innerHTML = `
          <div class="top-bar ${typeClass}"><span class="type">${typeLabel}</span><span class="cost">${card.cost}</span></div>
          <div class="name-row"><div class="name">${card.name}</div></div>
          ${artHtml}
          ${triggerHtml}
          <div class="ability-box"><div class="ability-name">Effect</div><div class="ability-text">${card.text}</div></div>
          ${flavorHtml}
          <button class="close-btn" onclick="closeCardModal(event, true)">Close</button>
        `;
      }

      $('cardModal').classList.add('open');
    }

    function closeCardModal(e, force) {
      if (force || e.target === $('cardModal')) {
        $('cardModal').classList.remove('open');
      }
    }

    function findCard(uid) {
      const all = [...state.G.me.hand, ...state.G.me.bench, ...state.G.opp.bench, ...state.G.me.grave, ...state.G.opp.grave];
      if (state.G.me.active) all.push(state.G.me.active);
      if (state.G.opp.active) all.push(state.G.opp.active);
      return all.find(c => c.uid === uid);
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTIONS
    // ═══════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════
    // UNIFIED CARD PLAY - Single entry point for all card plays
    // ═══════════════════════════════════════════════════════════════

    /**
     * Play a card from hand - unified entry point for drag, click, modal
     * Routes to appropriate handler based on card type
     * @param {object} card - Card to play
     */
    async function playCard(card) {
      if (!card) return;
      if (state.animating) return;

      if (card.cardType === 'creature') {
        await playCreature(card);
      } else if (card.cardType === 'verse') {
        if (card.type === 'cast') {
          await playCastVerse(card);
        } else if (card.type === 'set') {
          await playSetVerse(card);
        }
      }
    }

    /**
     * Play a creature card
     */
    async function playCreature(card) {
      closeModal();
      const target = !state.G.me.active ? 'active' : 'bench';
      await dispatchAction('summon', { card, cardUid: card.uid, target });
    }

    /**
     * Play a set verse
     */
    async function playSetVerse(card) {
      closeModal();
      await dispatchAction('set', { card, cardUid: card.uid });
    }

    // ═══════════════════════════════════════════════════════════════

    function doSummon() {
      if (!state.G || state.G.winner != null) return;
      if (state.animating) return; // Block during animations
      const creatures = state.G.me.hand.filter(c => c.cardType === 'creature');
      if (!creatures.length) return;

      showModal('Summon Creature', creatures.map(c => ({
        name: c.name,
        sub: `Cost ${c.cost} | ${c.hp} HP | ${c.atk} ATK`,
        disabled: c.cost > state.G.me.mana,
        action: () => playCard(c)
      })));
    }

    // Local execution (solo mode only) - uses shared engine
    async function executeLocalSummon(c) {
      const result = await dispatchLocalAction({ 
        type: 'summon', 
        cardUid: c.uid 
      });
      
      if (result?.error) {
        // Error already logged by dispatchLocalAction
        return;
      }
      
      // Log the summon based on event data
      const summonEvent = result?.events?.find(e => e.type === 'summon' && e.creature === c.name);
      if (summonEvent) {
        log(`Summoned ${c.name} to ${summonEvent.slot}`);
      }
    }

    function doCast() {
      if (!state.G || state.G.winner != null) return;
      if (state.animating) return; // Block during animations
      const casts = state.G.me.hand.filter(c => c.cardType === 'verse' && c.type === 'cast');
      console.log('🎯 doCast - cast verses in hand:', casts.map(c => ({ name: c.name, selection: c.selection })));
      if (!casts.length) return;

      showModal('Cast Verse', casts.map(c => ({
        name: c.name,
        sub: `Cost ${c.cost} | ${c.text}`,
        disabled: c.cost > state.G.me.mana || (c.id === 'manaSurge' && state.G.me.usedManaSurge),
        action: () => playCard(c)
      })));
    }

    // Cast verse handler - handles selection BEFORE dispatchAction
    async function playCastVerse(c) {
      closeModal();

      // === SOLO MODE: Use shared engine with selection loop ===
      if (!state.G.isMultiplayer) {
        let action = { type: 'cast', cardUid: c.uid };
        
        // First attempt - might need selection
        let result = await dispatchLocalAction(action);
        
        // If needs selection, show UI and retry
        if (result?.needsSelection) {
          const selected = await showTargetSelection(result.selectionConfig);
          if (!selected) return; // User cancelled
          
          action.selectedUid = selected.uid;
          result = await dispatchLocalAction(action);
        }
        
        // Error already logged by dispatchLocalAction
        return;
      }

      // === MULTIPLAYER: Get selection first, then dispatch ===
      let selection = null;
      const sel = c.selection;
      
      // Handle different selection types based on declarative config
      if (sel) {
        if (sel.location === 'grave' && sel.filter === 'friendly') {
          // Grave Echo - select from graveyard
          const graveCr = state.G.me.grave.filter(x => x.cardType === 'creature');
          if (!graveCr.length) {
            showModal(c.name, [{
              name: 'No creatures in graveyard!',
              sub: 'The echoes are silent...',
              action: () => closeModal()
            }]);
            return;
          }
          selection = await new Promise(resolve => {
            showModal(sel.prompt || 'Choose creature from graveyard', graveCr.map(creature => ({
              name: creature.name,
              sub: `${creature.hp} HP / ${creature.atk} ATK • Cost ${creature.cost}`,
              action: () => { closeModal(); resolve({ type: 'grave', uid: creature.uid }); }
            })).concat([{
              name: '← Cancel',
              sub: 'Return to hand',
              action: () => { closeModal(); resolve(null); }
            }]));
          });
          if (!selection) return;
        } else if (sel.location === 'board' && sel.filter === 'friendly') {
          // Sacrifice - select own creature
          const options = [];
          if (state.G.me.active) options.push({ creature: state.G.me.active, location: 'active' });
          state.G.me.bench.forEach((cr, idx) => options.push({ creature: cr, location: 'bench', idx }));
          
          if (!options.length) {
            showModal(c.name, [{
              name: 'No creatures to target!',
              sub: 'Your board is empty...',
              action: () => closeModal()
            }]);
            return;
          }
          selection = await new Promise(resolve => {
            showModal(sel.prompt || 'Choose your creature', options.map(opt => ({
              name: opt.creature.name,
              sub: `${opt.creature.curHp}/${opt.creature.hp} HP • ${opt.location}`,
              action: () => { window._modalOnClose = null; closeModal(); resolve({ type: 'own', uid: opt.creature.uid }); }
            })), { onClose: resolve, semantic: true });
          });
          if (!selection) return;
        } else if (sel.location === 'board' && sel.filter === 'any') {
          // Any creature (Ignite, Banish, Soul Siphon)
          const result = await showCreatureSelector(sel.prompt || 'Choose a creature');
          if (!result) return;
          selection = { type: 'target', uid: result.creature.uid };
        }
      }

      await dispatchAction('cast', { card: c, cardUid: c.uid, selection });
    }

    /**
     * Show target selection UI based on selectionConfig from shared engine
     * @param {Object} config - { type, filter, location, prompt, cardUid }
     * @returns {Promise<{uid: string}|null>} - Selected creature or null if cancelled
     */
    async function showTargetSelection(config) {
      const { filter, location, prompt } = config;
      
      if (location === 'grave' && filter === 'friendly') {
        // Select from own graveyard
        const graveCr = state.G.me.grave.filter(x => x.cardType === 'creature');
        if (!graveCr.length) {
          showModal('No Valid Targets', [{
            name: 'No creatures in graveyard!',
            sub: 'The echoes are silent...',
            action: () => closeModal()
          }]);
          return null;
        }
        return new Promise(resolve => {
          showModal(prompt || 'Choose creature from graveyard', graveCr.map(creature => ({
            name: creature.name,
            sub: `${creature.hp} HP / ${creature.atk} ATK • Cost ${creature.cost}`,
            action: () => { window._modalOnClose = null; closeModal(); resolve({ uid: creature.uid }); }
          })), { onClose: resolve, semantic: true });
        });
      }
      
      if (location === 'board' && filter === 'friendly') {
        // Select own creature (sacrifice, etc.)
        const options = [];
        if (state.G.me.active) options.push({ creature: state.G.me.active, location: 'active' });
        state.G.me.bench.forEach((cr, idx) => options.push({ creature: cr, location: 'bench', idx }));
        
        if (!options.length) {
          showModal('No Valid Targets', [{
            name: 'No creatures to target!',
            sub: 'Your board is empty...',
            action: () => closeModal()
          }]);
          return null;
        }
        return new Promise(resolve => {
          showModal(prompt || 'Choose your creature', options.map(opt => ({
            name: opt.creature.name,
            sub: `${opt.creature.curHp}/${opt.creature.hp} HP • ${opt.location}`,
            action: () => { window._modalOnClose = null; closeModal(); resolve({ uid: opt.creature.uid }); }
          })), { onClose: resolve, semantic: true });
        });
      }
      
      if (location === 'board' && filter === 'any') {
        // Select any creature on field
        const result = await showCreatureSelector(prompt || 'Choose a creature');
        return result ? { uid: result.creature.uid } : null;
      }
      
      console.warn('Unknown selection config:', config);
      return null;
    }

    function doSet() {
      if (!state.G || state.G.winner != null) return;
      if (state.animating) return; // Block during animations
      if (state.G.me.setVerse) {
        log('Already have a set verse!');
        return;
      }

      const sets = state.G.me.hand.filter(c => c.cardType === 'verse' && c.type === 'set');
      if (!sets.length) return;

      showModal('Set Verse', sets.map(c => ({
        name: c.name,
        sub: `Cost ${c.cost} | ${c.trigger}`,
        disabled: c.cost > state.G.me.mana || (c.id === 'lastBreath' && state.G.me.usedLastBreath),
        action: () => playCard(c)  // Use unified playCard
      })));
    }

    // Legacy alias
    async function setVerse(c) {
      await playSetVerse(c);
    }

    // Local execution (solo mode only) - uses shared engine
    async function executeLocalSet(c) {
      const result = await dispatchLocalAction({ type: 'set', cardUid: c.uid });
      if (!result.error) {
        log('Set a verse face-down');
      }
    }

    // Wrapper
    async function doAttack() {
      if (!state.G) return;
      if (state.G.winner != null) return;
      if (state.animating) return;
      if (state.G.actionLock) return;
      if (!state.G.me.active) return;
      await dispatchAction('attack', {});
    }

    // Local execution (solo mode only) - Phase 4: Uses shared engine
    async function executeLocalAttack() {
      state.G.actionLock = true; // BUG-12: Lock actions during attack
      
      try {
        const result = await dispatchLocalAction({ type: 'attack' });
        
        if (result.error) {
          // Error already logged by dispatchLocalAction
          return;
        }
        
        // Check for game over
        checkWin();
        
        // Prompt player to end turn
        highlightEndTurn(true);
      } catch (err) {
        console.error('Attack error:', err);
        log('(Attack error)', 'dmg');
      } finally {
        state.G.actionLock = false; // BUG-12: Always release lock
      }
    }

    // Shows modal to pick bench creature, then dispatches action
    function doRetreat() {
      if (!state.G || state.G.winner != null) return;
      if (state.animating) return;
      if (!state.G.me.active || !state.G.me.bench.length) return;

      if (state.G.me.active.status === 'trapped') {
        log('Cannot retreat - trapped!', 'dmg');
        return;
      }

      showModal('Choose replacement', state.G.me.bench.map((c, idx) => ({
        name: c.name,
        sub: `${c.curHp}/${c.hp} HP`,
        action: async () => {
          closeModal();
          await dispatchAction('retreat', { benchIdx: idx, creature: c });
        }
      })));
    }

    // Local execution (solo mode only) - uses shared engine
    async function executeLocalRetreat(benchIdx) {
      const c = state.G.me.bench[benchIdx];
      if (!c) return;

      const result = await dispatchLocalAction({ type: 'retreat', benchIdx });
      if (result.error) return;

      log(`Switched to ${state.G.me.active.name}`);
      // Chain Lightning now handled by shared engine - events drive animations

      highlightEndTurn(true);
    }

    // Wrapper
    async function endTurn() {
      if (!state.G) return;
      if (state.G.winner != null) return;
      if (state.animating) return;
      await dispatchAction('endTurn', {});
    }

    // Local execution (solo mode only) - uses shared engine
    async function executeLocalEndTurn() {
      // Clear END TURN highlight
      highlightEndTurn(false);

      // Use shared engine for core end-turn logic
      // This handles: poison, summonedThisTurn clear, trapped clear, turn switch,
      // AI's mana increment/refill, AI's draw
      const result = await dispatchLocalAction({ type: 'endTurn' });
      if (result.error) return;

      if (state.G.winner != null) {
        const playerWon = state.G.winner === 'You' || state.G.winner === 0;
        const loser = playerWon ? state.G.opp : state.G.me;
        const reason = loser.deck?.length === 0 ? 'Deck out' : 'LP depleted';
        state.G.winner = playerWon ? 'You' : 'Rival';
        showResult(playerWon, reason);
        return;
      }

      // Mark that AI setup was done by shared engine (mana refilled, card drawn)
      state.G._aiSetupDone = true;

      // Broodmother / turnEnd handled by shared engine — do not re-run client processTriggers

      render();

      // TURN END animation
      await playTurnEndAnimation();

      // AI turn (guard — undefined if bindRuntimeModules failed)
      if (typeof aiTurn === 'function') {
        setTimeout(() => {
          Promise.resolve(aiTurn()).catch(err => {
            console.error('[AI] Turn failed:', err);
            log(`(AI error: ${err.message || err})`, 'dmg');
          });
        }, 600);
      } else {
        console.error('[AI] aiTurn not bound — cannot start rival turn');
        log('(AI failed to start)', 'dmg');
      }
    }

    // AI lives in solo-ai.js (bound via bindRuntimeModules)

    // ═══════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════

    function draw(player) {
      if (!drawCard(player)) {
        // Deck out - player loses
        log('Deck out!', 'dmg');
        state.G.winner = player === state.G.me ? 'Rival' : 'You';
        showResult(state.G.winner === 'You', 'Deck out');
      }
    }

    // Legacy client ko() removed — death rules + KO anim come from shared engine events
    // (event-playback handles type:'ko'). Do not reintroduce rule mutations here.

    function checkWin() {
      const result = checkWinConditions();

      if (result.lastBreathTriggered === 'me') {
        applyLastBreath(state.G.me);
        Anim.versePopup('Last Breath');
        log('Last Breath! Survived with 1 life!', 'heal');
        Anim.lpHeal('me', 1);
        return;
      }
      if (result.lastBreathTriggered === 'opp') {
        applyLastBreath(state.G.opp);
        Anim.versePopup('Last Breath');
        log('Rival Last Breath!', 'heal');
        return;
      }
      if (result.winner) {
        state.G.winner = result.winner;
        const loser = result.winner === 'You' ? state.G.opp : state.G.me;
        const reason = loser.deck?.length === 0 ? 'Deck out' : 'LP depleted';
        showResult(result.winner === 'You', reason);
      }
    }

    // log() is now imported from helpers.js

    // ═══════════════════════════════════════════════════════════════
    // MODALS
    // ═══════════════════════════════════════════════════════════════

    function showModal(title, options, opts = {}) {
      $('modal-title').textContent = title;
      // For graveyard modals, add hold-to-zoom handlers
      if (opts.graveyard) {
        $('modal-opts').innerHTML = options.map((o, i) => `
          <div class="option" data-uid="${o.uid || ''}" onpointerdown="graveCardPress('${o.uid}', '${opts.player}')" onpointerup="graveCardRelease()" onpointerleave="graveCardRelease()">
            <div class="name">${o.name}</div>
            <div class="sub">${o.sub}</div>
          </div>
        `).join('');
      } else {
        $('modal-opts').innerHTML = options.map((o, i) => `
          <div class="option ${o.disabled ? 'off' : ''}" onclick="${o.disabled ? '' : `modalAction(${i})`}">
            <div class="name">${o.name}</div>
            <div class="sub">${o.sub}</div>
          </div>
        `).join('');
      }
      window._modalActions = options.map(o => o.action);
      // Store onClose callback for Close button
      window._modalOnClose = opts.onClose || null;
      $('modal').dataset.escapeDismiss = opts.semantic ? 'false' : 'true';
      // Hide cancel button if noCancel option is set
      const cancelBtn = $('modal').querySelector('.cancel');
      if (cancelBtn) cancelBtn.style.display = opts.noCancel ? 'none' : '';
      $('modal').classList.add('open');
    }

    function modalAction(i) {
      if (
        $('modal').classList.contains('open') &&
        window._modalActions &&
        window._modalActions[i]
      ) {
        window._modalActions[i]();
      }
    }

    // Phase 9b: presentation-only board targeting highlights. The selector
    // modal remains the resolution authority; a highlighted AAA card click
    // routes through the SAME option action (exactly-once by construction).
    function aaaSetTargetHighlights(uids) {
      const stage = document.getElementById('aaa-stage');
      if (!stage) return;
      const wanted = new Set(uids ?? []);
      for (const node of stage.querySelectorAll('[data-uid]')) {
        node.classList.toggle('aaa-card--targetable', wanted.has(node.dataset.uid));
      }
      // Targeting mode docks the selector panel aside and lets the scrim
      // pass clicks through, so highlighted board cards are physically
      // clickable (the panel remains the keyboard/list path).
      $('modal').classList.toggle('aaa-targeting', Boolean(uids && uids.length));
      if (!uids || !uids.length) window._aaaTargetPick = null;
    }

    function closeModal() {
      $('modal').classList.remove('open');
      window._modalActions = null;
      aaaSetTargetHighlights(null);
      // Call onClose callback if set (for selection modals to resolve with null)
      if (window._modalOnClose) {
        const onClose = window._modalOnClose;
        window._modalOnClose = null;
        onClose(null);
      }
    }

    /**
     * Show creature selector for anyCreature targeting (Ignite, Banish, Soul Siphon)
     * Shows all creatures on field with YOURS/ENEMY ownership labels
     * @param {string} prompt - Modal title
     * @returns {Promise<{creature, location, ownerKey, idx?}|null>} - Selected creature or null
     */
    async function showCreatureSelector(prompt) {
      console.log('🎯 showCreatureSelector called with prompt:', prompt);
      const options = [];

      // BUG-B4: ENEMY section first (at TOP)
      if (state.G.opp.active) {
        options.push({
          creature: state.G.opp.active,
          location: 'active',
          ownerKey: 'opp',
          name: `[ENEMY] ★ ${state.G.opp.active.name}`,  // BUG-B4: ★ for active
          sub: `${state.G.opp.active.curHp}/${state.G.opp.active.hp} HP • Active`,
          cssClass: 'selector-enemy'
        });
      }
      state.G.opp.bench.forEach((cr, idx) => {
        options.push({
          creature: cr,
          location: 'bench',
          ownerKey: 'opp',
          idx,
          name: `[ENEMY] ${cr.name}`,
          sub: `${cr.curHp}/${cr.hp} HP • Bench`,
          cssClass: 'selector-enemy'
        });
      });

      // BUG-B4: YOURS section second (at BOTTOM)
      if (state.G.me.active) {
        options.push({
          creature: state.G.me.active,
          location: 'active',
          ownerKey: 'me',
          name: `[YOURS] ★ ${state.G.me.active.name}`,  // BUG-B4: ★ for active
          sub: `${state.G.me.active.curHp}/${state.G.me.active.hp} HP • Active`,
          cssClass: 'selector-yours'
        });
      }
      state.G.me.bench.forEach((cr, idx) => {
        options.push({
          creature: cr,
          location: 'bench',
          ownerKey: 'me',
          idx,
          name: `[YOURS] ${cr.name}`,
          sub: `${cr.curHp}/${cr.hp} HP • Bench`,
          cssClass: 'selector-yours'
        });
      });

      // No valid targets
      if (options.length === 0) {
        showModal(prompt, [{
          name: 'No creatures on field!',
          sub: 'The battlefield is empty...',
          action: () => closeModal()
        }]);
        return null;
      }

      // Show selector modal with ownership styling; mirror the legal
      // targets onto the AAA board as clickable highlights.
      aaaSetTargetHighlights(options.map((opt) => opt.creature.uid));
      window._aaaTargetPick = (uid) => {
        const index = options.findIndex((opt) => opt.creature.uid === uid);
        if (index >= 0) creatureSelectorAction(index);
      };
      return new Promise(resolve => {
        $('modal-title').textContent = prompt;
        $('modal-opts').innerHTML = options.map((opt, i) => `
          <div class="option ${opt.cssClass}" onclick="creatureSelectorAction(${i})">
            <div class="name">${opt.name}</div>
            <div class="sub">${opt.sub}</div>
          </div>
        `).join('');
        window._creatureSelectorOptions = options;
        window._creatureSelectorResolve = resolve;
        const cancelBtn = $('modal').querySelector('.cancel');
        if (cancelBtn) {
          cancelBtn.style.display = '';
          cancelBtn.onclick = () => {
            closeModal();
            resolve(null);
          };
        }
        $('modal').dataset.escapeDismiss = 'false';
        $('modal').classList.add('open');
      });
    }

    function creatureSelectorAction(i) {
      aaaSetTargetHighlights(null);
      if (window._creatureSelectorOptions && window._creatureSelectorOptions[i]) {
        const opt = window._creatureSelectorOptions[i];
        closeModal();
        window._creatureSelectorResolve({
          creature: opt.creature,
          location: opt.location,
          ownerKey: opt.ownerKey,
          idx: opt.idx
        });
      }
    }
    window.creatureSelectorAction = creatureSelectorAction;

    // ═══════════════════════════════════════════════════════════════
    // OPTIONAL SET VERSE TRIGGERS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Prompt player or AI to decide whether to trigger a set verse
     * @param {Object} owner - The player who owns the set verse
     * @param {Object} verse - The set verse card
     * @param {Object} context - Context for AI evaluation { attacker, defender, damage }
     * @returns {Promise<boolean>} - Whether to trigger
     */
    async function promptTrigger(owner, verse, context = {}) {
      const isPlayer = owner === state.G.me;

      if (isPlayer) {
        // Show modal prompt for player
        return new Promise(resolve => {
          showModal(`Trigger ${verse.name}?`, [
            { name: 'Yes', sub: verse.text || verse.abilityText, action: () => { closeModal(); resolve(true); } },
            { name: 'No', sub: 'Save for later', action: () => { closeModal(); resolve(false); } }
          ], { noCancel: true });
        });
      } else {
        // AI evaluation
        return evaluateAiTrigger(owner, verse, context);
      }
    }

    /**
     * AI decides whether to trigger a set verse
     */
    function evaluateAiTrigger(owner, verse, context) {
      const { attacker, defender, damage } = context;

      switch (verse.id) {
        case 'phantomWall':
          // Always trigger - negates attack entirely
          return true;

        case 'spikeShield':
          // Trigger if would KO attacker or they're low HP
          return attacker && attacker.curHp <= 20;

        case 'brace':
        case 'swarmShield':
          // Trigger only if it would actually save the creature from KO
          if (!defender || !damage) return true;
          const wouldDieWithout = damage >= defender.curHp;
          const wouldSurviveWith = (damage - 15) < defender.curHp;
          return wouldDieWithout && wouldSurviveWith;

        case 'vengeance':
        case 'mirrorForce':
          // Trigger if attacker is valuable (high ATK)
          return attacker && attacker.atk >= 20;

        case 'denMother':
          // Trigger if we have creatures that can use the buff
          return owner.active || owner.bench.length > 0;

        case 'graveRise':
          // Trigger if there's a 1-cost creature to revive and room
          const hasTarget = owner.grave.some(c => c.cardType === 'creature' && c.cost === 1);
          const hasRoom = !owner.active || owner.bench.length < 2;
          return hasTarget && hasRoom;

        default:
          return true; // Unknown verse - trigger by default
      }
    }

    function passResponse() {
      $('responseModal').classList.remove('open');
    }

    function showResult(outcome, reason = '') {
      const win = outcome === true || outcome === 'victory';
      const normalizedReason = String(reason).toLowerCase();
      const deckOut = normalizedReason.includes('deck');
      const result = $('result');
      stopGameTimer();
      result.classList.remove('win', 'lose');
      result.classList.add('open', win ? 'win' : 'lose');
      result.dataset.outcome = win ? 'victory' : 'defeat';
      result.dataset.reason = deckOut ? 'deck-out' : normalizedReason;
      $('result-text').textContent = deckOut
        ? win
          ? '[ VICTORY — DECK OUT ]'
          : '[ DEFEAT — DECK OUT ]'
        : win
          ? '[ VICTORY ]'
          : '[ DEFEAT ]';
    }

    function restartGame(navigate = () => location.reload()) {
      clearGame();
      navigate();
    }

    function showRules() {
      $('rulesModal').classList.add('open');
    }

    function closeRules() {
      $('rulesModal').classList.remove('open');
    }

    // Graveyard View - scrollable list with hold-to-zoom
    function showGraveyard(who) {
      const player = who === 'me' ? state.G.me : state.G.opp;
      const title = who === 'me' ? 'Your Graveyard' : "Rival's Graveyard";

      if (player.grave.length === 0) {
        showModal(title, [{
          name: 'Empty',
          sub: 'No cards in graveyard',
          action: () => closeModal()
        }]);
        return;
      }

      // Reverse order to show newest cards first
      const options = [...player.grave].reverse().map(c => ({
        name: c.name,
        sub: c.cardType === 'creature'
          ? `${c.hp} HP / ${c.atk} ATK • Cost ${c.cost}`
          : `${c.type} verse • Cost ${c.cost}`,
        action: () => {}, // Hold-to-zoom handled separately
        uid: c.uid
      }));

      showModal(title, options, { graveyard: true, player: who });
    }

    // Set Verse Inspect - view your own set verse (not opponent's!)
    function showMySetVerse() {
      if (!state.G.me.setVerse) {
        showModal('Your Set Verse', [{
          name: 'No set verse',
          sub: 'Use [T] Set to place one',
          action: () => closeModal()
        }]);
        return;
      }

      const v = state.G.me.setVerse;
      showModal('Your Set Verse', [{
        name: v.name,
        sub: `Trigger: ${v.trigger}`,
        action: () => {}
      }, {
        name: 'Effect',
        sub: v.text,
        action: () => {}
      }, {
        name: '[ Close ]',
        sub: '',
        action: () => closeModal()
      }]);
    }

    // Trigger Reveal - shows set verse when it activates
    let triggerRevealResolve = null;
    let triggerRevealTimeout = null;

    function showTriggerReveal(card) {
      return new Promise(resolve => {
        triggerRevealResolve = resolve;

        // Detect if this is a creature ability or a set verse
        const isCreature = card.cardType === 'creature' || card.ability;
        const typeLabel = isCreature ? 'Ability Triggered!' : 'Set Verse Triggered!';

        // Get the right fields depending on card type
        const cardName = card.name;
        let triggerText, effectText;

        if (isCreature) {
          // BUG-A3 FIX: For creature abilities, show ability name as trigger label
          // The ability text already contains the full description
          triggerText = card.ability?.name || 'Ability';
          effectText = card.ability?.text || 'Effect';
        } else {
          // Set verses have explicit trigger text
          triggerText = card.trigger || 'On trigger';
          effectText = card.text || 'Effect';
        }

        // Determine type class for coloring
        const typeClass = isCreature ? 'creature' : 'set';

        // Art display (if available)
        const artHtml = card.art ? `<div class="trigger-art">${card.art}</div>` :
                        (card.ability?.art ? `<div class="trigger-art">${card.ability.art}</div>` : '');

        // Build content
        const content = `
          <div class="name-row">
            <div class="name">${cardName}</div>
            <div class="type">${typeLabel}</div>
          </div>
          ${artHtml}
          <div class="trigger-condition">
            <div class="label">${isCreature ? 'Ability' : 'Trigger'}</div>
            <div class="text">${triggerText}</div>
          </div>
          <div class="effect-box">
            <div class="label">Effect</div>
            <div class="text">${effectText}</div>
          </div>
        `;

        $('triggerContent').innerHTML = content;
        $('triggerHeaderText').textContent = 'TRIGGERED!';
        $('triggerModal').classList.remove('cast', 'set', 'creature');
        $('triggerModal').classList.add('open', typeClass);

        // Auto-dismiss after delay (click/key also dismisses)
        triggerRevealTimeout = setTimeout(() => {
          dismissTriggerReveal();
        }, ANIM_TIMING.TRIGGER_REVEAL);
      });
    }

    // Show cast verse card popup (briefer than trigger reveal)
    function showCastReveal(verse) {
      return new Promise(resolve => {
        triggerRevealResolve = resolve;

        // Art display (if available)
        const artHtml = verse.art ? `<div class="trigger-art">${verse.art}</div>` : '';

        const content = `
          <div class="name-row">
            <div class="name">${verse.name}</div>
            <div class="type">Cast Verse</div>
          </div>
          ${artHtml}
          <div class="effect-box">
            <div class="label">Effect</div>
            <div class="text">${verse.text}</div>
          </div>
        `;

        $('triggerContent').innerHTML = content;
        $('triggerHeaderText').textContent = 'CAST!';
        $('triggerModal').classList.remove('set', 'creature');
        $('triggerModal').classList.add('open', 'cast');

        // Auto-dismiss after delay (click/key also dismisses)
        triggerRevealTimeout = setTimeout(() => {
          dismissTriggerReveal();
        }, 2500);
      });
    }

    // Show set verse animation
    function showSetReveal() {
      return new Promise(resolve => {
        triggerRevealResolve = resolve;

        const content = `
          <div class="name-row">
            <div class="name">Verse Set!</div>
            <div class="type">Face-down</div>
          </div>
          <div class="effect-box">
            <div class="text">A trap awaits...</div>
          </div>
        `;

        $('triggerContent').innerHTML = content;
        $('triggerModal').classList.add('open');

        // Very brief for set notification
        triggerRevealTimeout = setTimeout(() => {
          dismissTriggerReveal();
        }, 1000);
      });
    }

    function dismissTriggerReveal() {
      if (triggerRevealTimeout) {
        clearTimeout(triggerRevealTimeout);
        triggerRevealTimeout = null;
      }
      $('triggerModal').classList.remove('open', 'cast', 'set', 'creature');
      // Small delay to let close animation finish before AI continues
      if (triggerRevealResolve) {
        const resolve = triggerRevealResolve;
        triggerRevealResolve = null;
        setTimeout(resolve, 300);
      }
    }

    // Wire extracted modules now that UI helpers exist
    bindRuntimeModules();

    // Expose functions globally for onclick handlers (module scope)
    window.showTriggerReveal = showTriggerReveal;
    window.dismissTriggerReveal = dismissTriggerReveal;
    window.ANIM_TIMING = ANIM_TIMING;
    window.aiTurn = aiTurn;
    window.startPlayerTurn = startPlayerTurn;
    window.forcePlayerTurn = forcePlayerTurn;
    window.showSetReveal = showSetReveal;
    window.showCastReveal = showCastReveal;

    // Action buttons
    window.doSummon = doSummon;
    window.doCast = doCast;
    window.doSet = doSet;
    window.doAttack = doAttack;
    window.doRetreat = doRetreat;
    window.endTurn = endTurn;

    // Modals
    window.modalAction = modalAction;
    window.closeModal = closeModal;
    window.passResponse = passResponse;
    window.closeCardModal = closeCardModal;
    window.showRules = showRules;
    window.closeRules = closeRules;
    window.showGraveyard = showGraveyard;
    window.showMySetVerse = showMySetVerse;

    // Card interactions
    window.cardPress = cardPress;
    window.cardRelease = cardRelease;
    window.setVersePress = setVersePress;
    window.setVerseRelease = setVerseRelease;
    window.selectCard = selectCard;

    // Graveyard card zoom
    let graveZoomTimer = null;
    function graveCardPress(uid, who) {
      if (!uid) return;
      graveZoomTimer = setTimeout(() => {
        const player = who === 'me' ? state.G.me : state.G.opp;
        const card = player.grave.find(c => c.uid === uid);
        if (card) showCardDetail(uid);
      }, 400);
    }
    function graveCardRelease() {
      if (graveZoomTimer) {
        clearTimeout(graveZoomTimer);
        graveZoomTimer = null;
      }
    }
    window.graveCardPress = graveCardPress;
    window.graveCardRelease = graveCardRelease;

    // Generated card and grave markup binds release/leave handlers directly.
    // A platform cancellation may bypass those element handlers, so keep one
    // document-level cleanup path for every hold interaction.
    document.addEventListener('pointercancel', () => {
      cardRelease();
      setVerseRelease();
      graveCardRelease();
    });

    function toggleMenu() {
      alert('Menu: Coming soon!');
    }

    // ═══════════════════════════════════════════════════════════════
    // KEYBOARD
    // ═══════════════════════════════════════════════════════════════

    function isEditableKeyboardTarget(target) {
      if (!(target instanceof Element)) return false;
      return target.matches('input, textarea, select, [contenteditable="true"]');
    }

    function hasBlockingKeyboardOverlay() {
      return [
        'modal',
        'responseModal',
        'rulesModal',
        'cardModal',
        'triggerModal',
        'result',
      ].some(id => $(id)?.classList.contains('open'));
    }

    function dismissKeyboardOverlay() {
      if ($('triggerModal').classList.contains('open')) {
        dismissTriggerReveal();
        return true;
      }
      if ($('cardModal').classList.contains('open')) {
        closeCardModal(new Event('keydown'), true);
        return true;
      }
      if ($('rulesModal').classList.contains('open')) {
        closeRules();
        return true;
      }
      if (
        $('modal').classList.contains('open') &&
        $('modal').dataset.escapeDismiss !== 'false'
      ) {
        closeModal();
        return true;
      }
      return false;
    }

    document.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (k === 'escape' && dismissKeyboardOverlay()) {
        e.preventDefault();
        return;
      }
      if ($('triggerModal').classList.contains('open')) {
        dismissTriggerReveal();
        e.preventDefault();
        return;
      }
      if (isEditableKeyboardTarget(e.target)) return;
      if (
        !state.G ||
        state.G.winner != null ||
        !state.G.myTurn ||
        state.animating ||
        hasBlockingKeyboardOverlay()
      ) {
        return;
      }

      if (k === 's') doSummon();
      else if (k === 'c') doCast();
      else if (k === 't') doSet();
      else if (k === 'a') doAttack();
      else if (k === 'r') doRetreat();
      else if (k === 'e') endTurn();
      // Debug: test animations with number keys
      else if (e.ctrlKey && k === '1') { Anim.attack('me', 'opp', 30); log('TEST: attack'); }
      else if (e.ctrlKey && k === '2') { Anim.damage('me', 20); log('TEST: damage'); }
      else if (e.ctrlKey && k === '3') { Anim.heal('me', 30); log('TEST: heal'); }
      else if (e.ctrlKey && k === '4') { Anim.ko('opp'); log('TEST: KO'); }
      else if (e.ctrlKey && k === '5') { Anim.versePopup('Test Verse'); log('TEST: verse popup'); }
      else if (e.ctrlKey && k === '6') { Anim.negateX(); log('TEST: negate'); }
      else if (e.ctrlKey && k === '7') { Anim.lpDamage('me', 5); log('TEST: LP damage'); }
      else if (e.ctrlKey && k === '8') { Anim.poisonTick('me'); log('TEST: poison'); }
      else if (e.ctrlKey && k === '9') { Anim.summon('me'); log('TEST: summon'); }
      else if (e.ctrlKey && k === '0') { showTriggerReveal(VERSES.phantomWall); log('TEST: trigger reveal'); }
    });

    // ═══════════════════════════════════════════════════════════════
    // HOLD-TO-END-TURN BUTTONS
    // ═══════════════════════════════════════════════════════════════

    const HOLD_DURATION = 500; // ms to hold before ending turn

    function setupHoldButton(btn) {
      if (!btn) return;
      
      let holdTimeout = null;
      let isHolding = false;

      function startHold(e) {
        if (btn.disabled) return;
        if (!state.G || state.G.winner || !state.G.myTurn) return;
        if (state.animating) return;
        
        e.preventDefault();
        isHolding = true;
        btn.classList.add('holding');
        
        holdTimeout = setTimeout(() => {
          if (isHolding) {
            btn.classList.remove('holding');
            endTurn();
          }
        }, HOLD_DURATION);
      }

      function cancelHold() {
        isHolding = false;
        btn.classList.remove('holding');
        if (holdTimeout) {
          clearTimeout(holdTimeout);
          holdTimeout = null;
        }
      }

      // Pointer events (works for both touch and mouse)
      btn.addEventListener('pointerdown', startHold);
      btn.addEventListener('pointerup', cancelHold);
      btn.addEventListener('pointerleave', cancelHold);
      btn.addEventListener('pointercancel', cancelHold);
      
      // Prevent context menu on long press (mobile)
      btn.addEventListener('contextmenu', e => e.preventDefault());
    }

    // Initialize hold buttons
    setupHoldButton(document.getElementById('m-btn-end'));
    setupHoldButton(document.getElementById('d-btn-end'));

    const playAgainButton = document.querySelector('#result button');
    playAgainButton?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      restartGame();
    }, true);

    if (
      globalThis.__TINY_FANGS_VISUAL_QA__ &&
      isDesktopBehaviorQaEnabled()
    ) {
      globalThis.__TINY_FANGS_DESKTOP_BEHAVIOR_QA__ = Object.freeze({
        handleLocalPendingAction,
        hasGame: () => state.G !== null,
        restartGame,
        showModal,
        showResult,
        showTargetSelection,
      });
    }
