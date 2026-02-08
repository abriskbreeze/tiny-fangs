/**
 * TINY FANGS - MULTIPLAYER NETWORKING MODULE
 * 
 * Handles P2P connections using PeerJS for 1v1 multiplayer.
 * 
 * Architecture:
 * - Host creates room with custom code (FANGS-XXXX)
 * - Guest connects to host using room code
 * - Direct WebRTC data channel for game messages
 * - Host has authority for game state validation
 * 
 * Message Format:
 * All messages are JSON objects sent via conn.send()
 * { type: 'action|sync|ready|coinFlip|rematch|disconnect', ...data }
 */

class MultiplayerManager {
  constructor() {
    // PeerJS instances
    this.peer = null;      // Our PeerJS instance
    this.conn = null;      // Connection to peer (host or guest)
    
    // State
    this.isHost = false;   // Are we hosting the room?
    this.roomCode = null;  // FANGS-XXXX room code
    this.connected = false; // Are we connected to peer?
    this.peerId = null;    // Our peer ID
    
    // Event callbacks (set by game code)
    this.onConnect = null;     // Called when peer connects
    this.onMessage = null;     // Called when message received
    this.onDisconnect = null;  // Called when peer disconnects
    this.onError = null;       // Called on connection error
  }
  
  /**
   * Generate a random room code in format FANGS-XXXX
   * Uses uppercase letters excluding I/O (ambiguous)
   * @returns {string} Room code (e.g., "FANGS-ABCD")
   */
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // 24 chars (no I, O)
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return `FANGS-${code}`;
  }
  
  /**
   * Create a new room as host
   * Generates room code and waits for guest to join
   * @returns {Promise<string>} Resolves with room code when ready
   */
  async createRoom() {
    return new Promise((resolve, reject) => {
      try {
        // Generate unique room code
        this.roomCode = this.generateRoomCode();
        this.isHost = true;
        
        // Create peer with custom ID (room code)
        this.peer = new Peer(this.roomCode, {
          // Using PeerJS cloud (free tier)
          // For production, could use custom server:
          // host: 'your-peerjs-server.com',
          // port: 9000,
          debug: 1 // Log level (0=none, 3=all)
        });
        
        // Peer ready
        this.peer.on('open', (id) => {
          this.peerId = id;
          console.log('[Multiplayer] Room created:', this.roomCode);
          resolve(this.roomCode);
        });
        
        // Peer error
        this.peer.on('error', (err) => {
          console.error('[Multiplayer] Peer error:', err);
          if (this.onError) this.onError(err);
          
          // If room code is taken, regenerate
          if (err.type === 'unavailable-id') {
            console.log('[Multiplayer] Room code taken, regenerating...');
            this.createRoom().then(resolve).catch(reject);
          } else {
            reject(err);
          }
        });
        
        // Guest connects
        this.peer.on('connection', (conn) => {
          console.log('[Multiplayer] Guest connected');
          this.conn = conn;
          this.setupConnection();
        });
        
      } catch (err) {
        console.error('[Multiplayer] Failed to create room:', err);
        reject(err);
      }
    });
  }
  
  /**
   * Join an existing room as guest
   * Connects to host using their room code
   * @param {string} code - Room code (e.g., "FANGS-ABCD")
   * @returns {Promise<void>} Resolves when connected
   */
  async joinRoom(code) {
    return new Promise((resolve, reject) => {
      try {
        // Normalize code (uppercase, add prefix if missing)
        this.roomCode = code.toUpperCase();
        if (!this.roomCode.startsWith('FANGS-')) {
          this.roomCode = `FANGS-${this.roomCode}`;
        }
        
        this.isHost = false;
        
        // Create anonymous peer
        this.peer = new Peer({
          debug: 1
        });
        
        // Peer ready
        this.peer.on('open', (id) => {
          this.peerId = id;
          console.log('[Multiplayer] Peer ready, connecting to:', this.roomCode);
          
          // Connect to host
          this.conn = this.peer.connect(this.roomCode, {
            reliable: true // Ordered, guaranteed delivery
          });
          
          this.setupConnection();
          
          // Connection opened
          this.conn.on('open', () => {
            console.log('[Multiplayer] Connected to host');
            resolve();
          });
          
          // Connection error
          this.conn.on('error', (err) => {
            console.error('[Multiplayer] Connection error:', err);
            if (this.onError) this.onError(err);
            reject(err);
          });
        });
        
        // Peer error
        this.peer.on('error', (err) => {
          console.error('[Multiplayer] Peer error:', err);
          if (this.onError) this.onError(err);
          reject(err);
        });
        
      } catch (err) {
        console.error('[Multiplayer] Failed to join room:', err);
        reject(err);
      }
    });
  }
  
  /**
   * Setup connection event handlers
   * Called after connection is established (host or guest)
   * @private
   */
  setupConnection() {
    if (!this.conn) return;
    
    // Data received
    this.conn.on('data', (data) => {
      console.log('[Multiplayer] Received:', data);
      if (this.onMessage) {
        this.onMessage(data);
      }
    });
    
    // Connection opened (guest only, host doesn't get this)
    this.conn.on('open', () => {
      this.connected = true;
      console.log('[Multiplayer] Connection established');
      if (this.onConnect) {
        this.onConnect();
      }
    });
    
    // For host, trigger onConnect immediately since connection is already open
    if (this.isHost && this.conn.open) {
      this.connected = true;
      if (this.onConnect) {
        // Delay slightly to ensure conn is fully ready
        setTimeout(() => this.onConnect(), 100);
      }
    }
    
    // Connection closed
    this.conn.on('close', () => {
      this.connected = false;
      console.log('[Multiplayer] Peer disconnected');
      if (this.onDisconnect) {
        this.onDisconnect();
      }
    });
    
    // Connection error
    this.conn.on('error', (err) => {
      console.error('[Multiplayer] Connection error:', err);
      if (this.onError) {
        this.onError(err);
      }
    });
  }
  
  /**
   * Send message to peer
   * @param {Object} message - JSON-serializable message
   */
  send(message) {
    if (!this.conn || !this.conn.open) {
      console.warn('[Multiplayer] Cannot send, not connected');
      return false;
    }
    
    try {
      this.conn.send(message);
      console.log('[Multiplayer] Sent:', message);
      return true;
    } catch (err) {
      console.error('[Multiplayer] Send failed:', err);
      if (this.onError) {
        this.onError(err);
      }
      return false;
    }
  }
  
  /**
   * Disconnect from peer and cleanup
   */
  disconnect() {
    console.log('[Multiplayer] Disconnecting...');
    
    // Send disconnect message first
    if (this.connected) {
      this.send({ type: 'disconnect' });
    }
    
    // Close connection
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
    
    // Destroy peer
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    
    // Reset state
    this.connected = false;
    this.isHost = false;
    this.roomCode = null;
    this.peerId = null;
    
    console.log('[Multiplayer] Disconnected');
  }
}

// Export singleton instance
export const multiplayer = new MultiplayerManager();

// Expose to window for console testing
if (typeof window !== 'undefined') {
  window.multiplayer = multiplayer;
  console.log('[Multiplayer] Module loaded. Test with: window.multiplayer');
}
