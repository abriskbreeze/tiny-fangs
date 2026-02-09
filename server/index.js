import { WebSocketServer } from 'ws';

const PORT = 3001;
const rooms = new Map(); // roomCode → Room

// Generate 4-character room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Room structure
class Room {
  constructor(code, creatorWs, creatorDeckId) {
    this.code = code;
    this.players = [
      { ws: creatorWs, deckId: creatorDeckId, playerIdx: 0 }
    ];
    this.createdAt = Date.now();
  }

  addPlayer(ws, deckId) {
    if (this.players.length >= 2) {
      return false;
    }
    this.players.push({ ws, deckId, playerIdx: 1 });
    return true;
  }

  removePlayer(ws) {
    this.players = this.players.filter(p => p.ws !== ws);
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

  getPlayerData(ws) {
    return this.players.find(p => p.ws === ws);
  }
}

// WebSocket Server
const wss = new WebSocketServer({ port: PORT });

console.log(`🎮 Tiny Fangs server listening on ws://localhost:${PORT}`);
console.log(`📊 Server started at ${new Date().toLocaleString()}`);

wss.on('connection', (ws) => {
  console.log('🔌 Client connected');
  
  // Store room code on the websocket for easy cleanup
  ws.roomCode = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📩 Received:', message.type, message);

      switch (message.type) {
        case 'create':
          handleCreate(ws, message);
          break;
        
        case 'join':
          handleJoin(ws, message);
          break;
        
        case 'leave':
          handleLeave(ws);
          break;
        
        default:
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: `Unknown message type: ${message.type}` 
          }));
      }
    } catch (error) {
      console.error('❌ Error parsing message:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Invalid message format' 
      }));
    }
  });

  ws.on('close', () => {
    console.log('🔌 Client disconnected');
    handleDisconnect(ws);
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

function handleCreate(ws, message) {
  const { deckId } = message;
  
  if (!deckId) {
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'Missing deckId' 
    }));
    return;
  }

  // Generate unique room code
  let roomCode;
  do {
    roomCode = generateRoomCode();
  } while (rooms.has(roomCode));

  // Create room
  const room = new Room(roomCode, ws, deckId);
  rooms.set(roomCode, room);
  ws.roomCode = roomCode;

  console.log(`🏠 Room created: ${roomCode} by player with deck ${deckId}`);
  
  ws.send(JSON.stringify({ 
    type: 'roomCreated', 
    roomCode 
  }));
}

function handleJoin(ws, message) {
  const { roomCode, deckId } = message;
  
  if (!roomCode || !deckId) {
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'Missing roomCode or deckId' 
    }));
    return;
  }

  const room = rooms.get(roomCode);
  
  if (!room) {
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'Room not found' 
    }));
    return;
  }

  if (room.isFull()) {
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'Room is full' 
    }));
    return;
  }

  // Add player to room
  room.addPlayer(ws, deckId);
  ws.roomCode = roomCode;

  console.log(`👥 Player joined room ${roomCode} with deck ${deckId}`);

  // Notify the joiner
  const creatorDeck = room.players[0].deckId;
  ws.send(JSON.stringify({ 
    type: 'roomJoined', 
    roomCode,
    opponentDeck: creatorDeck
  }));

  // Notify the room creator
  room.players[0].ws.send(JSON.stringify({ 
    type: 'opponentJoined', 
    opponentDeck: deckId 
  }));

  console.log(`✅ Room ${roomCode} now has ${room.players.length} players`);
}

function handleLeave(ws) {
  if (!ws.roomCode) {
    return;
  }

  const room = rooms.get(ws.roomCode);
  if (!room) {
    return;
  }

  console.log(`👋 Player left room ${ws.roomCode}`);
  
  // Notify other players
  room.broadcast({ type: 'opponentLeft' }, ws);
  
  // Remove player from room
  room.removePlayer(ws);
  
  // Clean up empty rooms
  if (room.isEmpty()) {
    rooms.delete(ws.roomCode);
    console.log(`🗑️  Room ${ws.roomCode} deleted (empty)`);
  }
  
  ws.roomCode = null;
}

function handleDisconnect(ws) {
  if (ws.roomCode) {
    handleLeave(ws);
  }
}

// Periodic cleanup of old empty rooms (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  
  for (const [code, room] of rooms.entries()) {
    if (room.isEmpty() && (now - room.createdAt) > fiveMinutes) {
      rooms.delete(code);
      console.log(`🗑️  Room ${code} deleted (timeout)`);
    }
  }
}, 5 * 60 * 1000);

// Log room status every minute
setInterval(() => {
  console.log(`📊 Active rooms: ${rooms.size}`);
  for (const [code, room] of rooms.entries()) {
    console.log(`   - ${code}: ${room.players.length}/2 players`);
  }
}, 60 * 1000);
