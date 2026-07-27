/**
 * Solo AI turn logic — extracted from main.js
 * Factory injects client deps so this module stays free of circular imports.
 */

export function createSoloAi(deps) {
  const {
    state,
    Anim,
    ANIM_TIMING,
    log,
    getScoredMoves,
    pickBestMove,
  } = deps;

  // Late-bound from runtime bag (assigned in bindRuntimeModules)
  const render = (...args) => deps.render(...args);
  const draw = (...args) => deps.draw(...args);
  const dispatchLocalAction = (...args) => deps.dispatchLocalAction(...args);
  const playTurnEndAnimation = (...args) => deps.playTurnEndAnimation(...args);

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

      // Poison / Broodmother / turn switch handled by shared endTurn in endAiTurn()

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

      // Poison / Broodmother / turn switch handled by shared endTurn in endAiTurn()

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

  return {
    aiTurn,
    aiTurnHunter,
    endAiTurn,
    executeAiMove,
    aiCastVerse,
    aiSelectCreatureTarget,
    startPlayerTurn,
    forcePlayerTurn,
  };
}
