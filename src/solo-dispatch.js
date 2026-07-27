/**
 * Solo client ↔ shared engine state bridge + local action dispatch.
 */
export function clientToSharedState(clientState) {
  return {
    turn: clientState.turn,
    currentPlayer: clientState.myTurn ? 1 : 2,
    players: [clientState.me, clientState.opp],
    winner: clientState.winner,
    firstTurn: clientState.firstTurn,
    hasAttacked: clientState.hasAttacked,
    hasRetreated: clientState.hasRetreated
  };
}

export function sharedToClientState(sharedState, clientState) {
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
 * @param {object} deps — looked up at call time (may be filled after create)
 * Expected: state, sharedExecuteAction, Anim, log, render, playEvents, showModal, closeModal
 */
export function createSoloDispatch(deps) {
  async function handleLocalPendingAction(pending, playerIdx = 0) {
    const { state, showModal, closeModal } = deps;
    const isAI = playerIdx === 1;
    const side = isAI ? 'p2' : 'p1';

    if (pending.type === 'skitterSwap' && pending.side === side) {
      const benchOptions = pending.benchOptions || [];
      if (benchOptions.length === 0) return;

      if (isAI) {
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
        await dispatchLocalAction({
          type: 'respondOptionalTrigger',
          confirmed: true,
          verseId: pending.verseId,
          context: pending.context
        }, 1);
      } else {
        const confirmed = await new Promise(resolve => {
          showModal(pending.prompt, [
            {
              name: 'Yes',
              sub: `Activate ${pending.verseName}`,
              action: () => { closeModal(); resolve(true); }
            },
            {
              name: 'No',
              sub: "Don't activate",
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

  async function dispatchLocalAction(action, playerIdx = 0) {
    const {
      state,
      sharedExecuteAction,
      Anim,
      log,
      render,
      playEvents
    } = deps;

    const sharedAction = { action: action.type, ...action };
    const sharedState = clientToSharedState(state.G);
    const result = sharedExecuteAction(sharedState, playerIdx, sharedAction);

    if (result.error) {
      log(result.error, 'dmg');
      return result;
    }

    Anim.cacheActivePositions();

    const preRenderTypes = [
      'attack', 'damage', 'ko', 'lpDamage', 'damageReduced', 'damageNegated',
      'heal', 'abilityTrigger', 'triggerVerse', 'cast', 'setStatus', 'survival'
    ];
    const preRenderEvents = result.events.filter(e => preRenderTypes.includes(e.type));
    const postRenderEvents = result.events.filter(e => !preRenderTypes.includes(e.type));

    await playEvents(preRenderEvents);
    state.G = sharedToClientState(result.state, state.G);
    render();
    await playEvents(postRenderEvents);

    if (result.pendingAction) {
      await handleLocalPendingAction(result.pendingAction, playerIdx);
    }

    return result;
  }

  return { dispatchLocalAction, handleLocalPendingAction, clientToSharedState, sharedToClientState };
}
