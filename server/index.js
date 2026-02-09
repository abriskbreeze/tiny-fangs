import { WebSocketServer } from 'ws';
import { createGame, executeAction, endTurn, getStateForPlayer } from './GameEngine.js';

const PORT = 3001;
const rooms = new Map(); // roomCode → Room

// ═══════════════════════════════════════════════════════════════
// ROOM CLASS
// ═══════════════════════════════════════════════════════════════

class Room {
  constructor(code, creatorWs) {
    this.code = code;
    this.players = [
      { ws: creatorWs, deckId: null, playerIdx: 0 }
    ];
    this.status = 'waiting';  // waiting | ready | playing | finished
    this.gameState = null;
    this.createdAt = Date.now();
  }

  addPlayer(ws) {
    if (this.players.length >= 2) return false;
    this.players.push({ ws, deckId: null, playerIdx: 1 });
    this.status = 'ready';
    return true;
  }

  removePlayer(ws) {
    const idx = this.players.findIndex(p => p.ws === ws);
    if (idx !== -1) {
      this.players.splice(idx, 1);
      // Update playerIdx for remaining player
      if (this.players.length === 1) {
        this.players[0].playerIdx = 0;
        this.status = 'waiting';
      }
    }
  }

  setDeck(ws, deckId) {
    const player = this.players.find(p => p.ws === ws);
    if (player) {
      player.deckId = deckId;
      console.log(`🎴 Player ${player.playerIdx + 1} selected deck: ${deckId}`);
    }
  }

  canStart() {
    return this.players.length === 2 && 
           this.players[0].deckId && 
           this.players[1].deckId;
  }

  startGame() {
    if (!this.canStart()) return false;
    
    // Coin flip to determine who goes first
    const firstPlayer = Math.random() < 0.5 ? 0 : 1;
    
    // Create game with decks (server creates and shuffles decks)
    this.gameState = createGame(
      this.players[firstPlayer].deckId,
      this.players[1 - firstPlayer].deckId
    );
    
    // Remap player indices based on coin flip
    // firstPlayer gets playerIdx 0 (goes first)
    if (firstPlayer === 1) {
      // Swap player indices
      this.players[0].playerIdx = 1;
      this.players[1].playerIdx = 0;
    }
    
    this.status = 'playing';
    console.log(`🎮 Game started! Player ${firstPlayer + 1} goes first`);
    
    return { firstPlayer };
  }

  isFull() {
    return this.players.length === 2;
  }

  isEmpty() {
    return this.players.length === 0;
  }

  broadcast(message, excludeWs = null) {
    const data = JSON.stringify(message);
    this.players.forEach(player => {
      if (player.ws !== excludeWs && player.ws.readyState === 1) {
        player.ws.send(data);
      }
    });
  }

  // Send personalized state to each player
  broadcastState(events = []) {
    this.players.forEach(player => {
      if (player.ws.readyState === 1) {
        const state = getStateForPlayer(this.gameState, player.playerIdx);
        player.ws.send(JSON.stringify({
          type: 'stateUpdate',
          state,
          events: this.mapEventsForPlayer(events, player.playerIdx)
        }));
      }
    });
  }

  // Map p1/p2 to me/opp based on player perspective
  mapEventsForPlayer(events, playerIdx) {
    return events.map(e => {
      const mapped = { ...e };
      if (e.side === 'p1') {
        mapped.side = playerIdx === 0 ? 'me' : 'opp';
      } else if (e.side === 'p2') {
        mapped.side = playerIdx === 1 ? 'me' : 'opp';
      }
      // Also handle winner field
      if (e.winner === 'p1') {
        mapped.winner = playerIdx === 0 ? 'me' : 'opp';
      } else if (e.winner === 'p2') {
        mapped.winner = playerIdx === 1 ? 'me' : 'opp';
      }
      return mapped;
    });
  }

  getPlayerData(ws) {
    return this.players.find(p => p.ws === ws);
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function send(ws, message) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(message));
  }
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE HANDLERS
// ═══════════════════════════════════════════════════════════════

function handleCreate(ws) {
  // Generate unique room code
  let roomCode;
  do {
    roomCode = generateRoomCode();
  } while (rooms.has(roomCode));

  const room = new Room(roomCode, ws);
  rooms.set(roomCode, room);
  ws.roomCode = roomCode;

  console.log(`🏠 Room created: ${roomCode}`);
  send(ws, { type: 'roomCreated', roomCode });
}

function handleJoin(ws, message) {
  const { roomCode } = message;
  
  if (!roomCode) {
    send(ws, { type: 'error', message: 'Missing roomCode' });
    return;
  }

  const room = rooms.get(roomCode.toUpperCase());
  
  if (!room) {
    send(ws, { type: 'error', message: 'Room not found' });
    return;
  }

  if (room.isFull()) {
    send(ws, { type: 'error', message: 'Room is full' });
    return;
  }

  room.addPlayer(ws);
  ws.roomCode = roomCode.toUpperCase();

  console.log(`👥 Player joined room ${roomCode}`);

  // Notify joiner
  send(ws, { type: 'roomJoined', roomCode: roomCode.toUpperCase() });

  // Notify creator
  send(room.players[0].ws, { type: 'opponentJoined' });

  console.log(`✅ Room ${roomCode} now has 2 players`);
}

function handleDeckSelect(ws, message) {
  const { deckId } = message;
  
  if (!ws.roomCode) {
    send(ws, { type: 'error', message: 'Not in a room' });
    return;
  }

  const room = rooms.get(ws.roomCode);
  if (!room) {
    send(ws, { type: 'error', message: 'Room not found' });
    return;
  }

  if (room.status === 'playing') {
    send(ws, { type: 'error', message: 'Game already started' });
    return;
  }

  room.setDeck(ws, deckId);

  // Check if both players have selected decks
  if (room.canStart()) {
    const { firstPlayer } = room.startGame();
    
    // Send gameStart to both players with their perspective
    room.players.forEach(player => {
      const state = getStateForPlayer(room.gameState, player.playerIdx);
      send(player.ws, {
        type: 'gameStart',
        state,
        yourTurn: player.playerIdx === 0,  // Player 0 goes first
        you: player.playerIdx === 0 ? 'p1' : 'p2'
      });
    });
  } else {
    // Notify player they're waiting
    send(ws, { type: 'waitingForOpponent' });
    
    // Notify other player that this player selected
    const otherPlayer = room.players.find(p => p.ws !== ws);
    if (otherPlayer) {
      send(otherPlayer.ws, { type: 'opponentReady' });
    }
  }
}

function handleAction(ws, message) {
  if (!ws.roomCode) {
    send(ws, { type: 'error', message: 'Not in a room' });
    return;
  }

  const room = rooms.get(ws.roomCode);
  if (!room || room.status !== 'playing') {
    send(ws, { type: 'error', message: 'Game not in progress' });
    return;
  }

  const player = room.getPlayerData(ws);
  if (!player) {
    send(ws, { type: 'error', message: 'Player not found' });
    return;
  }

  console.log(`⚔️  P${player.playerIdx + 1} action:`, message.action);

  const result = executeAction(room.gameState, player.playerIdx, message.action);
  
  if (result.error) {
    send(ws, { type: 'error', message: result.error });
    return;
  }

  // Update game state
  room.gameState = result.state;

  // Broadcast state + events to both players
  room.broadcastState(result.events);

  // Check for game over
  if (room.gameState.winner !== null) {
    room.status = 'finished';
    console.log(`🏆 Game over! Winner: P${room.gameState.winner + 1}`);
  }
}

function handleEndTurn(ws) {
  if (!ws.roomCode) {
    send(ws, { type: 'error', message: 'Not in a room' });
    return;
  }

  const room = rooms.get(ws.roomCode);
  if (!room || room.status !== 'playing') {
    send(ws, { type: 'error', message: 'Game not in progress' });
    return;
  }

  const player = room.getPlayerData(ws);
  if (!player) {
    send(ws, { type: 'error', message: 'Player not found' });
    return;
  }

  console.log(`⏭️  P${player.playerIdx + 1} ends turn`);

  const result = endTurn(room.gameState, player.playerIdx);
  
  if (result.error) {
    send(ws, { type: 'error', message: result.error });
    return;
  }

  room.gameState = result.state;

  // Broadcast state + events
  room.broadcastState(result.events);

  // Notify whose turn it is
  room.players.forEach(p => {
    const isYourTurn = room.gameState.currentPlayer === p.playerIdx + 1;
    send(p.ws, { type: 'turnChange', yourTurn: isYourTurn });
  });

  // Check for game over (deck out)
  if (room.gameState.winner !== null) {
    room.status = 'finished';
    console.log(`🏆 Game over! Winner: P${room.gameState.winner + 1}`);
  }
}

function handleLeave(ws) {
  if (!ws.roomCode) return;

  const room = rooms.get(ws.roomCode);
  if (!room) return;

  console.log(`👋 Player left room ${ws.roomCode}`);
  
  room.broadcast({ type: 'opponentLeft' }, ws);
  room.removePlayer(ws);
  
  if (room.isEmpty()) {
    rooms.delete(ws.roomCode);
    console.log(`🗑️  Room ${ws.roomCode} deleted`);
  }
  
  ws.roomCode = null;
}

// ═══════════════════════════════════════════════════════════════
// WEBSOCKET SERVER
// ═══════════════════════════════════════════════════════════════

const wss = new WebSocketServer({ port: PORT });

console.log(`🎮 Tiny Fangs server listening on ws://localhost:${PORT}`);
console.log(`📊 Server started at ${new Date().toLocaleString()}`);

wss.on('connection', (ws) => {
  console.log('🔌 Client connected');
  ws.roomCode = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📩 Received:', message.type);

      switch (message.type) {
        case 'create':
          handleCreate(ws);
          break;
        case 'join':
          handleJoin(ws, message);
          break;
        case 'deckSelect':
          handleDeckSelect(ws, message);
          break;
        case 'action':
          handleAction(ws, message);
          break;
        case 'endTurn':
          handleEndTurn(ws);
          break;
        case 'leave':
          handleLeave(ws);
          break;
        default:
          send(ws, { type: 'error', message: `Unknown: ${message.type}` });
      }
    } catch (error) {
      console.error('❌ Error:', error);
      send(ws, { type: 'error', message: 'Invalid message' });
    }
  });

  ws.on('close', () => {
    console.log('🔌 Client disconnected');
    handleLeave(ws);
  });

  ws.on('error', (err) => console.error('❌ WS error:', err));
});

// Cleanup old rooms every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (room.isEmpty() && (now - room.createdAt) > 5 * 60 * 1000) {
      rooms.delete(code);
      console.log(`🗑️  Room ${code} deleted (timeout)`);
    }
  }
}, 5 * 60 * 1000);
