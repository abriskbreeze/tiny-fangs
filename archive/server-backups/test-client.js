import WebSocket from 'ws';

// Test: Create room and join from second client
async function testRoomFlow() {
  console.log('🧪 Testing room create/join flow...\n');

  // Client 1: Create room
  const client1 = new WebSocket('ws://localhost:3001');
  
  await new Promise((resolve) => {
    client1.on('open', () => {
      console.log('✅ Client 1 connected');
      client1.send(JSON.stringify({ 
        type: 'create', 
        deckId: 'starter' 
      }));
      resolve();
    });
  });

  // Wait for room creation
  const roomCode = await new Promise((resolve) => {
    client1.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      console.log('📨 Client 1 received:', msg);
      if (msg.type === 'roomCreated') {
        console.log(`✅ Room created: ${msg.roomCode}\n`);
        resolve(msg.roomCode);
      }
    });
  });

  // Client 2: Join room
  const client2 = new WebSocket('ws://localhost:3001');
  
  await new Promise((resolve) => {
    client2.on('open', () => {
      console.log('✅ Client 2 connected');
      client2.send(JSON.stringify({ 
        type: 'join', 
        roomCode, 
        deckId: 'aggro' 
      }));
      resolve();
    });
  });

  // Wait for both clients to receive confirmation
  let client1NotifiedOfJoin = false;
  let client2Joined = false;

  client1.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('📨 Client 1 received:', msg);
    if (msg.type === 'opponentJoined') {
      console.log('✅ Client 1 notified of opponent joining');
      client1NotifiedOfJoin = true;
      checkComplete();
    }
  });

  client2.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('📨 Client 2 received:', msg);
    if (msg.type === 'roomJoined') {
      console.log('✅ Client 2 joined successfully');
      client2Joined = true;
      checkComplete();
    }
  });

  function checkComplete() {
    if (client1NotifiedOfJoin && client2Joined) {
      console.log('\n🎉 SUCCESS: Both clients connected and in same room!');
      console.log('✅ Room code:', roomCode);
      console.log('✅ Client 1: Creator with deck "starter"');
      console.log('✅ Client 2: Joiner with deck "aggro"');
      
      // Clean up
      setTimeout(() => {
        client1.close();
        client2.close();
        process.exit(0);
      }, 500);
    }
  }
}

// Run test
testRoomFlow().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
