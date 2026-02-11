    import { CREATURES, VERSES, DECKS } from './cards.js';
    import { $, uid, state, setGame, clearGame } from './state.js';
    import { ANIM_TIMING, Anim } from './anim.js';
    import { hearts, manaStr, renderManaPips, renderSetVerse, renderActiveCard, renderMiniCard, renderBench, renderHandCard, renderLogEntries, renderLogInline, getActiveEffects } from './render.js';
    import { applyDamage } from './game.js';
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
    import { Effects, processEffects } from './effects.js';
    import { processTriggers } from './triggers.js';
    import { executeAction as sharedExecuteAction } from '../shared/engine.js';

    // Expose Anim globally so effects.js can access it
    globalThis.Anim = Anim;

    // ═══════════════════════════════════════════════════════════════
    // EVENT PLAYBACK SYSTEM (Phase 1 - Unified Engine Events)
    // ═══════════════════════════════════════════════════════════════
    // Translates shared engine events to client animations.
    // Engine returns events like { type: 'damage', side: 0, amount: 10 }
    // Client maps side 0='me', 1='opp' (in solo mode).

    /**
     * Convert engine side index to client side key
     * In solo mode: 0 = player ('me'), 1 = opponent ('opp')
     */
    function sideKey(side) {
      // Handle both numeric (0/1) and string ('p1'/'p2') sides
      if (side === 0 || side === 'p1') return 'me';
      if (side === 1 || side === 'p2') return 'opp';
      return side; // fallback for 'me'/'opp' already in correct format
    }

    /**
     * Event handlers map event types to animation functions.
     * Each handler receives the event object and returns a Promise.
     * Note: Some events don't need animation, they just update state.
     */
    const EVENT_HANDLERS = {
      // Summon events
      summon: (e) => {
        if (e.slot === 'bench') {
          return Anim.summonBench(sideKey(e.side), e.benchIdx || 0);
        }
        return Anim.summon(sideKey(e.side));
      },
      summonBench: (e) => Anim.summonBench(sideKey(e.side), e.benchIdx || 0),
      
      // Damage events
      damage: async (e) => {
        await Anim.damage(sideKey(e.side), e.amount);
        if (e.source) {
          log(`${e.source}: ${e.amount} damage`, 'dmg');
        }
      },
      lpDamage: async (e) => {
        await Anim.lpDamage(sideKey(e.side), e.amount);
        log('Direct hit! Lost a life!', 'dmg');
      },
      
      // Combat events
      attack: async (e) => {
        const attackerSide = sideKey(e.side);
        const defenderSide = attackerSide === 'me' ? 'opp' : 'me';
        if (e.direct) {
          // Direct attack on LP - just lunge animation
          await Anim.attackDirect(attackerSide);
        } else {
          // Normal attack on defender creature
          await Anim.attack(attackerSide, defenderSide, e.damage);
        }
      },
      
      // KO events
      ko: async (e) => {
        await Anim.ko(sideKey(e.side));
        log(`${e.creature} KO'd!`, 'dmg');
      },
      
      // Healing events
      heal: async (e) => {
        await Anim.heal(sideKey(e.side), e.amount);
        log(`Healed ${e.amount} HP!`, 'heal');
      },
      
      // Mana events
      manaGain: (e) => Anim.manaGain(),
      
      // Movement events
      retreat: (e) => Anim.benchToActive(sideKey(e.side)), // Swap animation
      swap: (e) => Promise.resolve(), // State update only
      benchToActive: async (e) => {
        await Anim.benchToActive(sideKey(e.side));
        if (e.creature) {
          log(`${e.creature} moved to active!`);
        }
      },
      
      // Verse events
      setVerse: (e) => {
        Anim.setVerse(sideKey(e.side));
        return Promise.resolve();
      },
      cast: (e) => Anim.castVerse(sideKey(e.side)),
      triggerVerse: async (e) => {
        // Show trigger reveal modal - look up verse by name
        const verse = Object.values(VERSES).find(v => v.name === e.verse) 
          || { name: e.verse, text: '', trigger: '' };
        if (typeof showTriggerReveal === 'function') {
          await showTriggerReveal(verse);
        }
      },
      
      // Ability events
      abilityTrigger: async (e) => {
        // Show ability reveal - look up creature by name
        if (e.creature && typeof showTriggerReveal === 'function') {
          const creature = Object.values(CREATURES).find(c => c.name === e.creature)
            || { name: e.creature, ability: { name: e.ability, text: '' } };
          await showTriggerReveal(creature);
        }
        log(`${e.creature}'s ${e.ability}!`, 'mana');
      },
      
      // Status effects
      setStatus: async (e) => {
        const selector = sideKey(e.side) === 'me' 
          ? '#m-my-active .card-active, #d-opp-active .card-active' 
          : '#m-opp-active .card-active, #d-opp-active .card-active';
        if (e.status === 'poison') {
          Anim.playOn(selector, 'anim-poison', 600);
          log('Poisoned!', 'dmg');
        } else if (e.status === 'trapped') {
          Anim.playOn(selector, 'anim-trapped', 600);
          log('Trapped!', 'dmg');
        }
        return Anim.wait(400);
      },
      clearStatus: (e) => Promise.resolve(),
      
      // Damage modifiers
      damageReduced: (e) => {
        log(`${e.source}! -${e.amount} damage`, 'heal');
        return Promise.resolve();
      },
      damageNegated: (e) => Anim.negateX(),
      atkBonus: (e) => Promise.resolve(), // Log only
      survival: (e) => {
        // Creature survived lethal
        const pos = Anim.getAnimPosition(sideKey(e.side));
        Anim.floatText('SURVIVES!', 'gold', pos);
        log(`${e.creature} survives at ${e.hp} HP!`, 'heal');
        return Anim.wait(400);
      },
      
      // Card movement
      draw: (e) => Promise.resolve(), // Hand update only
      discard: (e) => Promise.resolve(), // State update only
      graveReturn: (e) => Promise.resolve(), // State update only
      sacrifice: (e) => Anim.ko(sideKey(e.side)),
      banish: (e) => Anim.ko(sideKey(e.side)),
      
      // Game state
      setFlag: (e) => Promise.resolve(), // State update only
      turnStart: (e) => Promise.resolve(), // Handled by turn system
      gameOver: (e) => Promise.resolve(), // Handled by win check
      
      // Special cases
      skitterSwap: (e) => Promise.resolve(), // State update only
      skitterDecline: (e) => Promise.resolve(), // State update only
      
      // Optional triggers (prompt for player choice)
      optionalTrigger: (e) => Promise.resolve(), // Handled by prompt system
      triggerDeclined: (e) => Promise.resolve(), // State update only
    };

    /**
     * Play a sequence of events from the shared engine.
     * Awaits each animation in sequence for proper pacing.
     * @param {Array} events - Array of event objects from engine
     */
    async function playEvents(events) {
      if (!events || events.length === 0) return;
      
      for (const event of events) {
        const handler = EVENT_HANDLERS[event.type];
        if (handler) {
          try {
            await handler(event);
          } catch (err) {
            console.error(`Error playing event ${event.type}:`, err);
          }
        } else {
          console.warn(`Unknown event type: ${event.type}`, event);
        }
        
        // Small delay between events for readability
        await Anim.wait(50);
      }
    }

    /**
     * Convert client state (me/opp) to shared engine format (players[0]/players[1])
     */
    function clientToSharedState(clientState) {
      return {
        turn: clientState.turn,
        currentPlayer: clientState.myTurn ? 1 : 2, // 1-indexed for shared engine
        players: [clientState.me, clientState.opp],
        winner: clientState.winner,
        firstTurn: clientState.firstTurn,
        hasAttacked: clientState.hasAttacked,
        hasRetreated: clientState.hasRetreated
      };
    }

    /**
     * Convert shared engine state (players[0]/players[1]) back to client format (me/opp)
     */
    function sharedToClientState(sharedState, clientState) {
      return {
        ...clientState,
        me: sharedState.players[0],
        opp: sharedState.players[1],
        turn: sharedState.turn,
        myTurn: sharedState.currentPlayer === 1,
        winner: sharedState.winner,
        firstTurn: sharedState.firstTurn,
        hasAttacked: sharedState.hasAttacked,
        hasRetreated: sharedState.hasRetreated
      };
    }

    /**
     * Wrapper for local (solo mode) action dispatch.
     * Calls shared engine's executeAction, plays events, updates state.
     * @param {object} action - Action object (e.g., { type: 'endTurn', action: 'endTurn' })
     * @param {number} playerIdx - Player index (0 = player, 1 = AI). Default 0.
     */
    async function dispatchLocalAction(action, playerIdx = 0) {
      // Convert action type to shared format (shared uses 'action' field)
      const sharedAction = { action: action.type, ...action };
      
      // Convert client state to shared engine format
      const sharedState = clientToSharedState(state.G);
      
      // Execute action for specified player
      const result = sharedExecuteAction(sharedState, playerIdx, sharedAction);
      
      if (result.error) {
        log(result.error, 'dmg');
        return result;
      }
      
      // Cache element positions BEFORE state update (for animations on existing elements)
      Anim.cacheActivePositions();
      
      // Split events: pre-render (destructive) vs post-render (constructive)
      const preRenderTypes = ['attack', 'damage', 'ko', 'lpDamage', 'damageReduced', 'damageNegated', 'heal', 'abilityTrigger', 'triggerVerse', 'cast', 'setStatus', 'survival'];
      const preRenderEvents = result.events.filter(e => preRenderTypes.includes(e.type));
      const postRenderEvents = result.events.filter(e => !preRenderTypes.includes(e.type));
      
      // Play pre-render animations (attack, damage, ko - while elements still exist)
      await playEvents(preRenderEvents);
      
      // Update state and render
      state.G = sharedToClientState(result.state, state.G);
      render();
      
      // Play post-render animations (summon - after elements are created)
      await playEvents(postRenderEvents);
      
      // Handle pending actions (Skitter swap, optional triggers, etc.)
      if (result.pendingAction) {
        await handleLocalPendingAction(result.pendingAction, playerIdx);
      }
      
      return result;
    }
    
    /**
     * Handle pending actions in solo mode (Skitter swap, optional triggers)
     * @param {object} pending - Pending action from shared engine
     * @param {number} playerIdx - Which player this is for (0 = player, 1 = AI)
     */
    async function handleLocalPendingAction(pending, playerIdx = 0) {
      const isAI = playerIdx === 1;
      const side = isAI ? 'p2' : 'p1';
      
      if (pending.type === 'skitterSwap' && pending.side === side) {
        const benchOptions = pending.benchOptions || [];
        if (benchOptions.length === 0) return;
        
        if (isAI) {
          // AI auto-decides: swap if there's a healthier creature on bench
          const ai = state.G.opp;
          const currentHpRatio = pending.currentHp / pending.maxHp;
          const betterOption = benchOptions.find(opt => {
            const benchCreature = ai.bench[opt.idx];
            return benchCreature && (benchCreature.curHp / benchCreature.hp) > currentHpRatio;
          });
          
          if (betterOption) {
            await dispatchLocalAction({ type: 'skitterSwap', benchIdx: betterOption.idx }, 1);
          } else {
            await dispatchLocalAction({ type: 'skitterDecline' }, 1);
          }
        } else {
          // Player's Skitter took damage - prompt for swap
          const choice = await new Promise(resolve => {
            showModal(`${pending.creature}'s Scurry - Swap with bench?`, [
              ...benchOptions.map(opt => ({
                name: opt.name,
                sub: `Swap ${pending.creature} to bench`,
                action: () => { closeModal(); resolve(opt.idx); }
              })),
              {
                name: '← Decline',
                sub: 'Stay in active slot',
                action: () => { closeModal(); resolve(null); }
              }
            ]);
          });
          
          if (choice !== null) {
            await dispatchLocalAction({ type: 'skitterSwap', benchIdx: choice });
          } else {
            await dispatchLocalAction({ type: 'skitterDecline' });
          }
        }
      }
      
      if (pending.type === 'optionalTrigger' && pending.side === side) {
        if (isAI) {
          // AI always activates optional triggers (e.g., Vengeance)
          await dispatchLocalAction({
            type: 'respondOptionalTrigger',
            confirmed: true,
            verseId: pending.verseId,
            context: pending.context
          }, 1);
        } else {
          // Optional trigger (e.g., Vengeance) - prompt for activation
          const confirmed = await new Promise(resolve => {
            showModal(pending.prompt, [
              {
                name: 'Yes',
                sub: `Activate ${pending.verseName}`,
                action: () => { closeModal(); resolve(true); }
              },
              {
                name: 'No',
                sub: 'Don\'t activate',
                action: () => { closeModal(); resolve(false); }
              }
            ]);
          });
          
          await dispatchLocalAction({
            type: 'respondOptionalTrigger',
            confirmed,
            verseId: pending.verseId,
            context: pending.context
          });
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // MULTIPLAYER (WebSocket)
    // ═══════════════════════════════════════════════════════════════

    // Server URL - change for production
    const WS_SERVER = 'wss://obituaries-comedy-blake-having.trycloudflare.com';

    let ws = null;
    let gameMode = 'solo'; // 'solo' or 'multi'
    let roomCode = null;
    let isHost = false;
    let selectedDeckId = null;

    // Update queue for batching server state updates
    let updateQueue = [];
    let processingQueue = false;

    function connectWebSocket() {
      return new Promise((resolve, reject) => {
        ws = new WebSocket(WS_SERVER);

        ws.onopen = () => {
          console.log('🔌 Connected to server');
          resolve();
        };

        ws.onerror = (err) => {
          console.error('❌ WebSocket error:', err);
          reject(err);
        };

        ws.onclose = () => {
          console.log('🔌 Disconnected from server');
          if (gameMode === 'multi') {
            setMpStatus('Disconnected from server');
          }
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          console.log('📩 Server:', msg);
          handleServerMessage(msg);
        };
      });
    }

    function handleServerMessage(msg) {
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
          // Play coin flip animation before starting
          (async () => {
            await playMPCoinFlip(msg.coinFlip === 'won');
            startMultiplayerGame(msg.state, msg.yourTurn, msg.you);
          })();
          break;

        case 'stateUpdate':
          console.log('📊 State update', msg.events);
          queueUpdate(msg.state, msg.events, msg.pendingAction);
          break;

        case 'turnChange':
          state.G.myTurn = msg.yourTurn;
          updateTurnUI();
          showTurnBanner(msg.yourTurn ? 'YOUR TURN' : 'OPPONENT\'S TURN');
          break;

        case 'opponentLeft':
          if (state.G && state.G.isMultiplayer) {
            showModal('Opponent Left', [{
              name: 'Return to Menu',
              action: () => { closeModal(); location.reload(); }
            }]);
          } else {
            setMpStatus('Opponent disconnected');
          }
          break;

        case 'error':
          console.error('Server error:', msg.message);
          if (state.G && state.G.isMultiplayer) {
            // Show error briefly but don't block
            log(`Error: ${msg.message}`, 'dmg');
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
          usedManaSurge: false,
          usedLastBreath: false
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
      state.G = convertServerState(serverState);
      state.G.myTurn = yourTurn;
      state.G.myPlayerKey = you; // 'p1' or 'p2'

      // Start game timer
      state.G.startTime = Date.now();

      render();
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
      const oldLog = state.G?.log || [];

      // Cache element positions BEFORE state update (for animations that need them)
      Anim.cacheActivePositions();

      // Always update state FIRST so DOM elements exist for animations
      // (summon needs element in DOM, KO animation handles missing elements gracefully)
      state.G = convertServerState(serverState);
      state.G.log = oldLog;
      render();

      // Then play animations (elements now exist)
      if (events && events.length > 0) {
        await playServerEvents(events);
      }

      renderLog();

      if (state.G.isMultiplayer) {
        updateTurnUI();
      }

      if (state.G.winner !== null) {
        const youWon = state.G.winner === 'me';
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
          showModal(`${pending.creature}'s Scurry - Swap with bench?`, [
            ...benchOptions.map(opt => ({
              name: opt.name,
              sub: `Swap ${pending.creature} to bench`,
              action: () => { closeModal(); resolve(opt.idx); }
            })),
            {
              name: '← Decline',
              sub: 'Stay in active slot',
              action: () => { closeModal(); resolve(null); }
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
          showModal(pending.prompt, [
            {
              name: 'Yes',
              sub: `Activate ${pending.verseName}`,
              action: () => { closeModal(); resolve(true); }
            },
            {
              name: 'No',
              sub: 'Don\'t activate',
              action: () => { closeModal(); resolve(false); }
            }
          ]);
        });

        sendAction({
          action: 'respondOptionalTrigger',
          confirmed,
          verseId: pending.verseId,
          context: pending.context
        });
      }
    }

    // Play animation events from server
    // Server event handlers - maps event types to handler functions
    const serverEventHandlers = {
      summon: async (e, side) => {
        if (e.slot === 'bench') await Anim.summonBench(side, 0);
        else await Anim.summon(side);
      },
      attack: async (e, side) => await Anim.attack(side, side === 'me' ? 'opp' : 'me', e.damage),
      damage: async (e, side) => await Anim.damage(side, e.amount),
      heal: async (e, side) => await Anim.heal(side, e.amount),
      ko: async (e, side) => await Anim.ko(side),
      retreat: async (e, side) => await Anim.benchToActive(side),
      benchToActive: async (e, side) => {
        await Anim.benchToActive(side);
        log(`${e.creature} moved to active!`);
      },
      cast: async () => await Anim.castVerse(),
      setVerse: (e, side) => Anim.setVerse(side),
      draw: async () => await Anim.wait(100),
      lpDamage: async (e, side) => await Anim.lpDamage(side, e.amount || 1),
      manaGain: async () => await Anim.manaGain(),
      turnStart: () => {}, // Handled by turnChange message
      gameOver: () => {}, // Handled separately
      skitterSwap: async (e, side) => {
        await Anim.benchToActive(side);
        log(`${e.from} scurried to bench, ${e.to} is now active!`);
      },
      skitterDecline: () => {},
      abilityTrigger: async (e) => {
        const creature = Object.values(CREATURES).find(c => c.name === e.creature);
        if (creature?.ability) await showTriggerReveal(creature);
        log(`${e.creature}'s ${e.ability} triggered!`);
      },
      banish: async (e, side) => {
        await Anim.ko(side);
        log(`${e.creature} was banished!`);
      },
      graveReturn: (e) => log(`${e.creature} returned to hand!`),
      sacrifice: async (e, side) => {
        await Anim.ko(side);
        log(`${e.creature} was sacrificed!`);
      },
      triggerVerse: async (e) => {
        const verse = Object.values(VERSES).find(v => v.name === e.verse);
        if (verse) await showTriggerReveal(verse);
        log(`${e.verse} triggered!`);
      },
      damageReduced: (e) => log(`${e.source} reduced damage by ${e.amount}!`),
      survival: (e) => log(`${e.creature} survived at ${e.hp} HP!`),
      setFlag: () => {},
      clearStatus: () => {},
      atkBonus: (e) => log(`+${e.amount} ATK from ${e.source}!`),
      discard: (e) => log(`${e.card} discarded!`),
      setStatus: () => {} // Status applied (handled by render)
    };

    async function playServerEvents(events) {
      console.log('[DEBUG] Playing events:', events.map(e => `${e.type}${e.amount ? `(${e.amount})` : ''}${e.source ? `[${e.source}]` : ''}`));
      for (const e of events) {
        const handler = serverEventHandlers[e.type];
        if (handler) {
          await handler(e, e.side);
        } else {
          console.log('Unknown event:', e.type);
        }
      }
    }

    // Update UI based on whose turn it is
    function updateTurnUI() {
      const attackBtn = document.getElementById('attack-btn');
      const endTurnBtn = document.getElementById('end-turn');
      const mAttackBtn = document.getElementById('m-attack-btn');
      const mEndTurnBtn = document.getElementById('m-end-turn');

      if (state.G.isMultiplayer) {
        const enabled = state.G.myTurn;
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
          highlightEndTurn(false);
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
      showModal(youWon ? '🏆 VICTORY!' : '💀 DEFEAT', [{
        name: 'Return to Menu',
        action: () => { closeModal(); location.reload(); }
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

    function setMpStatus(text) {
      const el = document.getElementById('mp-status');
      if (el) el.textContent = text;
    }

    function selectMode(mode) {
      gameMode = mode;
      if (mode === 'solo') {
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
      if (ws) {
        ws.close();
        ws = null;
      }
      roomCode = null;
      document.getElementById('mode-select').style.display = 'block';
      document.getElementById('mp-lobby').style.display = 'none';
      document.getElementById('deck-select').style.display = 'none';
      document.getElementById('room-info').style.display = 'none';
      document.getElementById('join-input').style.display = 'none';
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

    // Expose functions globally
    window.selectMode = selectMode;
    window.backToModeSelect = backToModeSelect;
    window.createRoom = createRoom;
    window.showJoinInput = showJoinInput;
    window.joinRoom = joinRoom;

    // Game state is now in state.js: state.G, state.state.selectedCard, etc.

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
      if (gameMode === 'multi') {
        selectedDeckId = resolvedDeckId;
        ws.send(JSON.stringify({ type: 'deckSelect', deckId: resolvedDeckId }));
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
      overlay.appendChild(coinDisplay);
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

      // Play animation
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
      overlay.appendChild(coinDisplay);
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

      state.startTime = Date.now();
      state.timerInt = setInterval(updateTimer, 1000);

      $('setup').classList.add('hidden');

      log('Game started');

      if (playerFirst) {
        log('You go first! Choose a creature to summon');
        render();
      } else {
        log('Rival goes first');
        render();
        // AI takes first turn
        setTimeout(aiTurn, 600);
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
      const s = Math.floor((Date.now() - state.startTime) / 1000);
      const str = Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
      $('m-time').textContent = str;
      $('d-time').textContent = str;
    }

    // ═══════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════

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

      // Set Verses
      $('m-my-set').outerHTML = renderSetVerse(state.G.me.setVerse, 'm-my-set', true);
      $('m-opp-set').outerHTML = renderSetVerse(state.G.opp.setVerse, 'm-opp-set', false);
      $('d-my-set').outerHTML = renderSetVerse(state.G.me.setVerse, 'd-my-set', true);
      $('d-opp-set').outerHTML = renderSetVerse(state.G.opp.setVerse, 'd-opp-set', false);

      // Active creatures
      // Calculate ATK modifiers for display
      const myAtkInfo = state.G.me.active ? getAtkModifiers(state.G.me.active, state.G.me, state.G.opp) : null;
      const oppAtkInfo = state.G.opp.active ? getAtkModifiers(state.G.opp.active, state.G.opp, state.G.me) : null;

      $('m-my-active').innerHTML = renderActiveCard(state.G.me.active, myAtkInfo, state.G.me);
      $('m-opp-active').innerHTML = renderActiveCard(state.G.opp.active, oppAtkInfo, state.G.opp);
      $('d-my-active').innerHTML = renderActiveCard(state.G.me.active, myAtkInfo, state.G.me);
      $('d-opp-active').innerHTML = renderActiveCard(state.G.opp.active, oppAtkInfo, state.G.opp);

      // Bench
      $('m-my-bench').innerHTML = renderBench(state.G.me.bench);
      $('m-opp-bench').innerHTML = renderBench(state.G.opp.bench);
      $('d-my-bench').innerHTML = renderBench(state.G.me.bench);
      $('d-opp-bench').innerHTML = renderBench(state.G.opp.bench);

      // Hand
      $('m-hand-ct').textContent = state.G.me.handCount ?? state.G.me.hand?.length ?? 0;
      $('d-hand-ct').textContent = state.G.me.handCount ?? state.G.me.hand?.length ?? 0;
      $('m-hand').innerHTML = state.G.me.hand.map(c => renderHandCard(c, false, state.selectedCard)).join('');
      $('d-hand').innerHTML = state.G.me.hand.map(c => renderHandCard(c, true, state.selectedCard)).join('');

      // Buttons
      updateButtons();

      // Highlight END TURN if player has 0 mana (can't do anything)
      if (state.G.myTurn && state.G.me.mana === 0) {
        highlightEndTurn(true);
      }

      // Log
      renderLog();
    }

    function renderLog() {
      $('m-log').innerHTML = renderLogInline(state.G.log, 8);
      $('d-log').innerHTML = renderLogEntries(state.G.log, 12);
    }

    function updateButtons() {
      const hasCreature = state.G.me.hand.some(c => c.cardType === 'creature');
      const hasCast = state.G.me.hand.some(c => c.cardType === 'verse' && c.type === 'cast');
      const hasSet = state.G.me.hand.some(c => c.cardType === 'verse' && c.type === 'set');
      const canRetreat = state.G.me.active && state.G.me.bench.length > 0;
      const canAttack = state.G.me.active && !state.G.firstTurn; // Can attack creatures or LP directly (not on first turn)

      // C3: Cannot attack after retreating, cannot retreat after attacking
      const attackAllowed = canAttack && !state.G.hasAttacked && !state.G.hasRetreated;
      const retreatAllowed = canRetreat && !state.G.hasAttacked && !state.G.hasRetreated;

      ['m-btn-summon','d-btn-summon'].forEach(id => $(id).disabled = !hasCreature || !state.G.myTurn);
      ['m-btn-cast','d-btn-cast'].forEach(id => $(id).disabled = !hasCast || !state.G.myTurn);
      ['m-btn-set','d-btn-set'].forEach(id => $(id).disabled = !hasSet || state.G.me.setVerse || !state.G.myTurn);
      ['m-btn-atk','d-btn-atk'].forEach(id => $(id).disabled = !attackAllowed || !state.G.myTurn);
      ['m-btn-retreat','d-btn-retreat'].forEach(id => $(id).disabled = !retreatAllowed || !state.G.myTurn);
      ['m-btn-end','d-btn-end'].forEach(id => $(id).disabled = !state.G.myTurn);
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

      // Prevent touch scrolling
      if (e?.cancelable) e.preventDefault();

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

      // Prevent scrolling during drag
      if (e.cancelable) e.preventDefault();

      const clientX = e.clientX ?? 0;
      const clientY = e.clientY ?? 0;
      state.drag.currentX = clientX;
      state.drag.currentY = clientY;

      const dx = clientX - state.drag.startX;
      const dy = clientY - state.drag.startY;
      const dist = Math.sqrt(dx*dx + dy*dy);

      // Check if we should enter drag mode
      if (!state.drag.active && dist > DRAG_THRESHOLD) {
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

      if (state.longPressTimer) {
        clearTimeout(state.longPressTimer);
        state.longPressTimer = null;
      }

      if (state.drag?.active) {
        const clientX = e.clientX ?? state.drag.currentX;
        const clientY = e.clientY ?? state.drag.currentY;

        // Only execute drop if affordable
        if (state.drag.canAfford) {
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
              action: () => { closeModal(); resolve({ type: 'own', uid: opt.creature.uid }); }
            })).concat([{
              name: '← Cancel',
              sub: 'Return to hand',
              action: () => { closeModal(); resolve(null); }
            }]));
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
            action: () => { closeModal(); resolve({ uid: creature.uid }); }
          })).concat([{
            name: '← Cancel',
            sub: 'Return to hand',
            action: () => { closeModal(); resolve(null); }
          }]));
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
            action: () => { closeModal(); resolve({ uid: opt.creature.uid }); }
          })).concat([{
            name: '← Cancel',
            sub: 'Return to hand',
            action: () => { closeModal(); resolve(null); }
          }]));
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

      // Chain Lightning triggers when new creature becomes active
      // NOTE: Shared engine doesn't handle this yet - handled client-side
      if (state.G.me.chainLightning > 0) {
        await Anim.wait(300);
        const chainKo = applyDamage(state.G.me.active, state.G.me.chainLightning);
        log(`Chain Lightning: -${state.G.me.chainLightning}`, 'dmg');
        await Anim.damage('me', state.G.me.chainLightning);
        state.G.me.chainLightning = 0;
        if (chainKo) {
          await Anim.ko('me');
          await ko(state.G.me.active, state.G.me);
        }
      }

      highlightEndTurn(true);
    }

    // Wrapper
    async function endTurn() {
      if (!state.G) return;
      if (state.G.winner) return;
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

      // Mark that AI setup was done by shared engine (mana refilled, card drawn)
      state.G._aiSetupDone = true;

      // Client-specific turnEnd triggers (Broodmother Spawn handled by shared, but client triggers may differ)
      // Note: Shared engine handles Broodmother spawn, so this may be redundant
      // Keeping for any client-specific trigger handling
      await processTriggers('turnEnd', {
        activePlayer: state.G.me,
        activePlayerKey: 'me'
      }, state, {
        log,
        render,
        processEffects: async (card, ctx) => {
          return await processEffects(card, { ...ctx, self: card, state });
        }
      });

      render();

      // TURN END animation
      await playTurnEndAnimation();

      // AI turn
      setTimeout(aiTurn, 600);
    }

    // ═══════════════════════════════════════════════════════════════
    // AI
    // ═══════════════════════════════════════════════════════════════

    /**
     * Hunter AI (Difficulty 2) - Score-based decision making
     * Evaluates all possible moves and picks the best one each iteration
     */
    async function aiTurnHunter() {
      if (state.G.winner) return;

      const ai = state.G.opp;
      const player = state.G.me;
      const pause = () => Anim.wait(ANIM_TIMING.AI_PAUSE);

      try {
        // If shared engine already set up AI turn (via player's endTurn), skip setup
        if (!state.G._aiSetupDone) {
          // Mana phase: refill to max
          ai.mana = ai.maxMana;

          // Draw
          draw(ai);
          if (state.G.winner) return;
        }
        state.G._aiSetupDone = false; // Reset flag for next turn

        // Reset per-turn ability flags (Shellkin Harden, etc.)
        if (ai.active) {
          ai.active.Harden_used = false;
          ai.active.hardenUsed = false; // Legacy
        }

        log('-- Rival turn --');
        render();
        await pause();

        // Main phase: loop until pass is best option
        let moveCount = 0;
        let aiHasAttacked = false; // Track if AI already attacked this turn
        const MAX_MOVES = 10; // Safety limit

        while (moveCount < MAX_MOVES && !state.G.winner) {
          const canAttack = !state.G.firstTurn && !aiHasAttacked;
          const scoredMoves = getScoredMoves(ai, player, canAttack);


          const best = pickBestMove(scoredMoves, 10);

          if (!best || best.type === 'pass') {
            break;
          }


          // Execute the chosen move
          await executeAiMove(best, ai, player, pause);

          // Mark if AI attacked (can only attack once per turn)
          if (best.type === 'attack' || best.type === 'attack-direct') {
            aiHasAttacked = true;
          }

          moveCount++;
          render();
          await pause();
        }

        // Poison tick
        if (ai.active?.status === 'poison') {
          const aiPoisonKo = applyDamage(ai.active, 10);
          log('Rival poison: -10', 'dmg');
          await Anim.poisonTick('opp');
          if (aiPoisonKo) {
            await Anim.ko('opp');
            await ko(ai.active, ai);
          }
          render();
        }

      } catch (err) {
        console.error('[AI Hunter] Error:', err);
        log(`(AI error: ${err.message || err})`, 'dmg');
      }

      await endAiTurn(ai, pause);
    }

    /**
     * Shared end-of-turn logic for all AI difficulties
     * Prevents divergence bugs by centralizing: turnEnd triggers, mana, flags, transition
     */
    async function endAiTurn(ai, pause) {
      // Use shared engine for end turn - this handles:
      // - Poison damage
      // - Broodmother spawn trigger
      // - Player's maxMana increment
      // - Player's mana refill
      // - Player's draw
      // - Turn switch
      const result = await dispatchLocalAction({ type: 'endTurn' }, 1);
      
      if (result.error) {
        console.error('AI endTurn failed:', result.error);
      }

      // Transition to player turn
      await pause();
      await playTurnEndAnimation();
      
      if (!state.G.winner) {
        // Mark that player setup was done by shared engine
        state.G._playerSetupDone = true;
        state.G.myTurn = true;
        log('Your turn', 'mana');
        render();
      }
    }

    /**
     * Execute a single AI move using the shared engine
     */
    async function executeAiMove(move, ai, player, pause) {
      switch (move.type) {
        case 'summon-active': {
          const card = move.card;
          const result = await dispatchLocalAction({ 
            type: 'summon', 
            cardUid: card.uid, 
            target: 'active' 
          }, 1);
          if (result.error) {
            console.error('AI summon-active failed:', result.error);
          }
          break;
        }

        case 'summon-bench': {
          const card = move.card;
          const result = await dispatchLocalAction({ 
            type: 'summon', 
            cardUid: card.uid, 
            target: 'bench' 
          }, 1);
          if (result.error) {
            console.error('AI summon-bench failed:', result.error);
          }
          break;
        }

        case 'cast': {
          const card = move.card;
          await aiCastVerse(card, ai, player, pause);
          break;
        }

        case 'set': {
          const card = move.card;
          const result = await dispatchLocalAction({ 
            type: 'set', 
            cardUid: card.uid 
          }, 1);
          if (result.error) {
            console.error('AI set failed:', result.error);
          }
          break;
        }

        case 'attack':
        case 'attack-direct': {
          const result = await dispatchLocalAction({ type: 'attack' }, 1);
          if (result.error) {
            console.error('AI attack failed:', result.error);
          }
          break;
        }
      }
    }

    /**
     * AI selects a creature target for anyCreature selection cards
     * Returns { creature, location, ownerKey, idx? } or null
     */
    function aiSelectCreatureTarget(card, ai, player) {
      // For damage/banish cards, AI should target player's creatures
      // Priority: active first (most threatening), then bench
      // NOTE: ownerKey is from AI's perspective - 'opp' means player

      // Target player's active if available
      if (player.active) {
        return {
          creature: player.active,
          location: 'active',
          ownerKey: 'opp'  // 'opp' = player from AI's perspective
        };
      }

      // Target player's strongest bench creature
      if (player.bench.length > 0) {
        // Pick creature with highest ATK (most threatening)
        const sorted = [...player.bench].sort((a, b) => b.atk - a.atk);
        const target = sorted[0];
        const idx = player.bench.findIndex(c => c.uid === target.uid);
        return {
          creature: target,
          location: 'bench',
          ownerKey: 'opp',  // 'opp' = player from AI's perspective
          idx
        };
      }

      // No player creatures - don't cast targeting cards
      return null;
    }

    /**
     * AI casts a verse using the shared engine
     */
    async function aiCastVerse(card, ai, player, pause) {
      // Build action with AI-selected target if needed
      const action = { type: 'cast', cardUid: card.uid };
      
      // Handle targeting for verses that need it
      switch (card.id) {
        case 'ignite':
        case 'banish':
        case 'soulSiphon': {
          // AI targets player's creatures (enemy from AI's perspective)
          const target = aiSelectCreatureTarget(card, ai, player);
          if (target) {
            action.targetUid = target.creature.uid;
          } else {
            // No valid target - skip casting
            console.log(`AI skipping ${card.name}: no valid target`);
            return;
          }
          break;
        }
        case 'graveEcho': {
          // AI picks first creature from own graveyard
          const graveCr = ai.grave.filter(c => c.cardType === 'creature');
          if (graveCr.length > 0) {
            action.graveUid = graveCr[0].uid;
          } else {
            console.log(`AI skipping Grave Echo: no creatures in grave`);
            return;
          }
          break;
        }
        case 'sacrifice': {
          // AI picks weakest bench creature to sacrifice
          if (ai.bench.length > 0) {
            // Sort by HP ratio (lowest first) to sacrifice the weakest
            const sorted = [...ai.bench].sort((a, b) => 
              (a.curHp / a.hp) - (b.curHp / b.hp)
            );
            action.sacrificeUid = sorted[0].uid;
          } else {
            console.log(`AI skipping Sacrifice: no bench creatures`);
            return;
          }
          break;
        }
      }
      
      const result = await dispatchLocalAction(action, 1);
      if (result.error) {
        console.error(`AI cast ${card.name} failed:`, result.error);
      }
      await pause();
    }
    async function aiTurn() {
      if (state.G.winner) return;

      // Dispatch based on difficulty
      if (state.G.aiDifficulty >= 2) {
        return aiTurnHunter();
      }

      // === PUP AI (Difficulty 1) - Original fixed-order logic ===
      const ai = state.G.opp;
      const pause = () => Anim.wait(ANIM_TIMING.AI_PAUSE);

      try {
        // If shared engine already set up AI turn (via player's endTurn), skip setup
        if (!state.G._aiSetupDone) {
          // Mana phase: refill to max (no increment here - that happens at end of turn)
          ai.mana = ai.maxMana;

          // Draw
          draw(ai);
          if (state.G.winner) return;
        }
        state.G._aiSetupDone = false; // Reset flag for next turn

        // Reset per-turn ability flags (Shellkin Harden, etc.)
        if (ai.active) {
          ai.active.Harden_used = false;
          ai.active.hardenUsed = false; // Legacy
        }

        log('-- Rival turn --');
        render();
        await pause();

        // === SUMMON PHASE ===
        if (!ai.active) {
          const creatures = ai.hand.filter(c => c.cardType === 'creature' && c.cost <= ai.mana);
          if (creatures.length) {
            const pick = creatures.sort((a,b) => b.cost - a.cost)[0];
            const result = await dispatchLocalAction({
              type: 'summon',
              cardUid: pick.uid,
              target: 'active'
            }, 1);
            if (result.error) {
              console.error('AI summon-active failed:', result.error);
            }
            render();
            await pause();
          }
        }

        // === BENCH PHASE ===
        while (ai.bench.length < 2) {
          const creatures = ai.hand.filter(c => c.cardType === 'creature' && c.cost <= ai.mana);
          if (!creatures.length) break;
          const pick = creatures[0];
          const result = await dispatchLocalAction({
            type: 'summon',
            cardUid: pick.uid,
            target: 'bench'
          }, 1);
          if (result.error) {
            console.error('AI summon-bench failed:', result.error);
            break; // Prevent infinite loop if summon fails
          }
        }

        // === CAST VERSE PHASE ===
        // Decision logic kept here, execution via shared engine
        const casts = ai.hand.filter(c => c.cardType === 'verse' && c.type === 'cast' && c.cost <= ai.mana);
        for (const cast of casts) {
          if (ai.mana < cast.cost) continue;

          let shouldCast = false;
          switch(cast.id) {
            case 'manaSurge':
              shouldCast = !ai.usedManaSurge;
              break;
            case 'soulSiphon':
              shouldCast = state.G.me.active && ai.active;
              break;
            case 'ignite':
              shouldCast = state.G.me.active && state.G.me.active.curHp <= 15;
              break;
            case 'darkPact':
              shouldCast = ai.lp > 1 && ai.hand.length < 4;
              break;
            case 'secondWind':
              shouldCast = ai.active && ai.active.curHp <= ai.active.hp - 30;
              break;
            case 'predatorsMark':
              shouldCast = ai.active && state.G.me.active;
              break;
            case 'banish':
              shouldCast = state.G.me.active && state.G.me.active.atk >= 40;
              break;
            case 'bloodMoon': {
              const myLoss = ai.active ? Math.min(20, ai.active.curHp) : 0;
              const theirLoss = state.G.me.active ? Math.min(20, state.G.me.active.curHp) : 0;
              shouldCast = theirLoss > myLoss;
              break;
            }
            case 'packTactics':
              shouldCast = (ai.active ? 1 : 0) + ai.bench.length >= 2;
              break;
            case 'graveEcho':
              shouldCast = ai.grave.some(c => c.cardType === 'creature');
              break;
            case 'callOfTheWild': {
              const hasRoom = !ai.active || ai.bench.length < 2;
              const hasOneCost = ai.deck.some(c => c.cardType === 'creature' && c.cost === 1);
              shouldCast = hasRoom && hasOneCost;
              break;
            }
            case 'sacrifice':
              shouldCast = ai.bench.length > 0 && ai.hand.length < 3;
              break;
            case 'shellArmor':
              shouldCast = ai.active && ai.active.curHp <= ai.active.hp - 20;
              break;
            case 'regenerate':
              shouldCast = ai.active && (ai.active.curHp <= ai.active.hp - 30 || ai.active.status === 'poison');
              break;
            case 'fortify':
              shouldCast = ai.active && ai.active.curHp <= 30 && !ai.active.fortified;
              break;
            case 'unbreakable':
              shouldCast = ai.active && ai.active.curHp <= 25 && !ai.unbreakable;
              break;
          }

          if (shouldCast) {
            await aiCastVerse(cast, ai, state.G.me, pause);
          }
        }

        // === SET VERSE PHASE ===
        if (!ai.setVerse) {
          const sets = ai.hand.filter(c => c.cardType === 'verse' && c.type === 'set' && c.cost <= ai.mana);
          if (sets.length) {
            const pick = sets[0];
            const result = await dispatchLocalAction({
              type: 'set',
              cardUid: pick.uid
            }, 1);
            if (result.error) {
              console.error('AI set verse failed:', result.error);
            }
          }
        }

        // === ATTACK PHASE ===
        // Skip attack on first turn of game (whoever goes first can't attack)
        if (ai.active && !state.G.firstTurn) {
          await pause();
          const attackResult = await dispatchLocalAction({ type: 'attack' }, 1);
          if (attackResult.error) {
            console.error('AI attack failed:', attackResult.error);
          }
        }

        // Poison tick
        if (ai.active?.status === 'poison') {
          const aiPoisonKo = applyDamage(ai.active, 10);
          log('Rival poison: -10', 'dmg');
          await Anim.poisonTick('opp');
          if (aiPoisonKo) {
            await Anim.ko('opp');
            await ko(ai.active, ai);
          }
          render();
        }

      } catch (err) {
        console.error('[AI] Turn error:', err);
        log(`(AI error: ${err.message || err})`, 'dmg');
      }

      await endAiTurn(ai, pause);
    }

    // Extracted player turn start for reuse
    function startPlayerTurn() {
      // Clear failsafe
      if (state.G._aiFailsafe) {
        clearTimeout(state.G._aiFailsafe);
        state.G._aiFailsafe = null;
      }

      if (state.G.winner) return;

      try {
        // If shared engine already set up player turn (via AI's endTurn), skip manual setup
        if (!state.G._playerSetupDone) {
          // Mana phase: refill to max (increment happens at end of turn)
          state.G.me.mana = state.G.me.maxMana;

          // Draw
          draw(state.G.me);
        }
        state.G._playerSetupDone = false; // Reset flag for next turn

        // C3: Reset attack/retreat flags for new turn
        state.G.hasAttacked = false;
        state.G.hasRetreated = false;

        // Reset per-turn ability flags (Shellkin Harden, etc.)
        if (state.G.me.active) {
          state.G.me.active.Harden_used = false;
          state.G.me.active.hardenUsed = false; // Legacy
        }

        state.G.myTurn = true;
        log('Your turn', 'mana');
        render();
      } catch (err) {
        console.error('[GAME] Player turn start error:', err);
        state.G.myTurn = true; // Force it anyway
        render();
      }
    }

    // Emergency player turn start
    function forcePlayerTurn() {
      state.G._aiFailsafe = null;

      if (state.G.winner) return;

      // Minimal setup to get the game unstuck
      state.G.myTurn = true;
      state.G.me.mana = state.G.me.maxMana;

      try {
        if (state.G.me.deck && state.G.me.deck.length > 0) {
          state.G.me.hand.push(state.G.me.deck.pop());
        }
        render();
      } catch (err) {
        console.error('[GAME] Force player turn render error:', err);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════

    function draw(player) {
      if (!drawCard(player)) {
        // Deck out - player loses
        log('Deck out!', 'dmg');
        state.G.winner = player === state.G.me ? 'Rival' : 'You';
        showResult(state.G.winner === 'You');
      }
    }

    async function ko(creature, owner, attacker = null, attackerOwner = null) {
      const ownerKey = owner === state.G.me ? 'me' : 'opp';

      // Clear active slot IMMEDIATELY to prevent re-render during trigger processing
      // This fixes the visual bug where creature pops back up during KO
      owner.active = null;

      // Emit beforeKO event for triggers like Vengeance
      // Only emit if there's an attacker (combat KO)
      // BUG-06 FIX: Pass source: 'attack' so Vengeance only triggers on attack KO
      if (attacker && attackerOwner) {
        const attackerOwnerKey = attackerOwner === state.G.me ? 'me' : 'opp';
        const beforeKOCtx = await processTriggers('beforeKO', {
          target: creature,
          targetOwner: ownerKey,
          targetLocation: 'active',
          attacker: attacker,
          attackerOwner: attackerOwner,
          attackerOwnerKey: attackerOwnerKey,
          activePlayerKey: attackerOwnerKey,  // Attacker's turn
          source: 'attack'  // BUG-06 FIX: Mark this as attack-caused KO
        }, state, {
          promptTrigger,
          showTriggerReveal,
          log,
          render,
          processEffects: async (card, ctx) => {
            return await processEffects(card, ctx);
          }
        });

        // If KO was negated (e.g., Vengeance), handle attacker replacement and return
        if (beforeKOCtx.koNegated) {
          // Restore creature to active (we cleared it at top of function)
          owner.active = creature;

          // Log the survival and destruction
          if (beforeKOCtx.destroyed) {
            log(`${creature.name} survives! ${attacker.name} destroyed!`, 'dmg');
          } else {
            log(`${creature.name} survives!`, 'heal');
          }

          // Handle attacker's replacement if destroyed by destroy effect
          if (beforeKOCtx.needsReplacement && beforeKOCtx.destroyedOwner) {
            const destroyedOwner = beforeKOCtx.destroyedOwner;
            const destroyedOwnerKey = beforeKOCtx.destroyedOwnerKey;

            if (destroyedOwner.bench.length > 0) {
              destroyedOwner.active = destroyedOwner.bench.shift();
              log(`${destroyedOwnerKey === 'me' ? 'You' : 'Rival'} sent out ${destroyedOwner.active.name}`);
              render();
              await Anim.benchToActive(destroyedOwnerKey);
            }
          }

          checkWin();
          render();
          return;
        }
      }

      // Play KO animation AFTER beforeKO triggers (Vengeance can negate)
      // This fixes the bug where KO animation plays even when negated
      await Anim.ko(ownerKey);

      log(`${creature.name} KO'd!`, 'dmg');

      // BUG-A6 FIX: Clear creature's ATK bonuses when it dies
      // This prevents stacking when creature is re-summoned via Grave Echo/Grave Rise
      creature.atkBonuses = [];

      // Add to graveyard (active already cleared at top of function)
      owner.grave.push(creature);

      const isPlayer = owner === state.G.me;
      const enemy = isPlayer ? state.G.opp : state.G.me;

      // Titanback death effect - deal 25 damage to enemy active
      if (creature.id === 'titanback' && enemy.active) {
        log(`Titanback's Juggernaut! ${enemy.active.name} takes 25 damage!`, 'dmg');
        const titanKo = applyDamage(enemy.active, 25);
        await Anim.damage(isPlayer ? 'opp' : 'me', 25);
        if (titanKo) {
          await Anim.ko(isPlayer ? 'opp' : 'me');
          await ko(enemy.active, enemy);
        }
      }

      // Emit onKO event for trigger system (Den Mother, Grave Rise, etc.)
      await processTriggers('onKO', {
        creature,
        creatureOwnerKey: ownerKey,
        targetOwner: ownerKey,
        targetLocation: 'active'
      }, state, {
        promptTrigger,
        showTriggerReveal,
        log,
        render,
        promptGraveSelect: async (candidates) => {
          // AI always picks first, player chooses if multiple
          if (!isPlayer || candidates.length === 1) {
            return candidates[0];
          }
          return new Promise(resolve => {
            showModal('Grave Rise - Choose creature to revive', candidates.map(c => ({
              name: c.name,
              sub: `${c.hp} HP / ${c.atk} ATK`,
              action: () => { closeModal(); resolve(c); }
            })), { noCancel: true });
          });
        },
        processEffects: async (card, ctx) => {
          return await processEffects(card, ctx);
        }
      });

      // NOTE: Death abilities (gloom, echomask, stormtalon) now handled by onKO triggers above

      // Replace from bench - player chooses if multiple, AI auto-selects
      if (owner.bench.length > 0) {
        let replacement;

        if (isPlayer && owner.bench.length > 1) {
          // Player chooses which bench creature becomes active
          replacement = await new Promise(resolve => {
            showModal('Choose new active creature', owner.bench.map(c => ({
              name: c.name,
              sub: `${c.curHp}/${c.hp} HP / ${c.atk} ATK`,
              action: () => {
                closeModal();
                resolve(c);
              }
            })));
          });
          owner.bench = owner.bench.filter(c => c.uid !== replacement.uid);
        } else {
          // AI or only one option - take first
          replacement = owner.bench.shift();
        }

        owner.active = replacement;
        log(`${isPlayer ? 'You' : 'Rival'} sent out ${owner.active.name}`);
        render();
        await Anim.benchToActive(isPlayer ? 'me' : 'opp');

        if (owner.chainLightning > 0) {
          const chainReplaceKo = applyDamage(owner.active, owner.chainLightning);
          log(`Chain Lightning: -${owner.chainLightning}`, 'dmg');
          owner.chainLightning = 0;
          if (chainReplaceKo) await ko(owner.active, owner);
        }
      }

      checkWin();
    }

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
        showResult(result.winner === 'You');
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
      // Hide cancel button if noCancel option is set
      const cancelBtn = $('modal').querySelector('.cancel');
      if (cancelBtn) cancelBtn.style.display = opts.noCancel ? 'none' : '';
      $('modal').classList.add('open');
    }

    function modalAction(i) {
      if (window._modalActions && window._modalActions[i]) {
        window._modalActions[i]();
      }
    }

    function closeModal() {
      $('modal').classList.remove('open');
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

      // Show selector modal with ownership styling
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
        $('modal').classList.add('open');
      });
    }

    function creatureSelectorAction(i) {
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

    function showResult(win) {
      clearInterval(state.timerInt);
      $('result').classList.add('open', win ? 'win' : 'lose');
      $('result-text').textContent = win ? '[ VICTORY ]' : '[ DEFEAT ]';
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

    // Expose functions globally for onclick handlers (module scope)
    window.showTriggerReveal = showTriggerReveal;
    window.dismissTriggerReveal = dismissTriggerReveal;
    window.ANIM_TIMING = ANIM_TIMING;
    window.aiTurn = aiTurn;

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

    function toggleMenu() {
      alert('Menu: Coming soon!');
    }

    // ═══════════════════════════════════════════════════════════════
    // KEYBOARD
    // ═══════════════════════════════════════════════════════════════

    // Dismiss trigger modal on any keypress
    document.addEventListener('keydown', e => {
      if ($('triggerModal').classList.contains('open')) {
        dismissTriggerReveal();
        e.preventDefault();
        return;
      }
    });

    document.addEventListener('keydown', e => {
      if (!state.G || state.G.winner || !state.G.myTurn) return;
      const k = e.key.toLowerCase();
      if (k === 's') doSummon();
      else if (k === 'c') doCast();
      else if (k === 't') doSet();
      else if (k === 'a') doAttack();
      else if (k === 'r') doRetreat();
      else if (k === 'e') endTurn();
      else if (k === 'escape') closeModal();
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
