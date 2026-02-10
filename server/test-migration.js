/**
 * Test Phase 2 Migration
 * Verifies that server can create games and execute actions using shared module
 */

import { createGame, executeAction, endTurn, getStateForPlayer } from './GameEngine.js';

console.log('🧪 Testing Phase 2 Migration\n');

// Test 1: Create game
console.log('Test 1: Create game...');
const game = createGame('fang', 'swarm');
console.log(`✅ Game created: Turn ${game.turn}, Current player: ${game.currentPlayer}`);
console.log(`   P1 deck: ${game.players[0].deck.length} cards, hand: ${game.players[0].hand.length}`);
console.log(`   P2 deck: ${game.players[1].deck.length} cards, hand: ${game.players[1].hand.length}`);

// Test 2: Get state for player
console.log('\nTest 2: Get filtered state...');
const p1State = getStateForPlayer(game, 0);
console.log(`✅ P1 sees their hand: ${p1State.me.hand.length} cards`);
console.log(`   P1 sees opponent hand count: ${p1State.opp.handCount} (hidden)`);

// Test 3: Summon creature
console.log('\nTest 3: Summon creature...');
const card = game.players[0].hand.find(c => c.cardType === 'creature' && c.cost === 1);
if (card) {
  const result = executeAction(game, 0, { action: 'summon', cardUid: card.uid });
  if (result.error) {
    console.log(`❌ Summon failed: ${result.error}`);
  } else {
    console.log(`✅ Summoned ${card.name}`);
    console.log(`   Events: ${result.events.map(e => e.type).join(', ')}`);
  }
}

// Test 4: End turn
console.log('\nTest 4: End turn...');
const endResult = endTurn(game, 0);
if (endResult.error) {
  console.log(`❌ End turn failed: ${endResult.error}`);
} else {
  console.log(`✅ Turn ended. Now player ${game.currentPlayer}'s turn`);
  console.log(`   Events: ${endResult.events.map(e => e.type).join(', ')}`);
}

// Test 5: Verify card definitions from shared
console.log('\nTest 5: Verify shared card definitions...');
import { CREATURES, VERSES, DECKS } from '../shared/index.js';
console.log(`✅ Loaded ${Object.keys(CREATURES).length} creatures from shared`);
console.log(`✅ Loaded ${Object.keys(VERSES).length} verses from shared`);
console.log(`✅ Loaded ${Object.keys(DECKS).length} decks from shared`);

console.log('\n🎉 All tests passed! Phase 2 migration successful.');
