const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// ─── In-Memory State ────────────────────────────────────────────────
const rooms = new Map();

function generateRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function createRoom(hostId, hostName) {
  const code = generateRoomCode();
  rooms.set(code, {
    code,
    hostId,
    hostName,
    createdAt: Date.now(),
    participants: new Map(),
    videoState: {
      url: '',
      playing: false,
      currentTime: 0,
      lastUpdate: Date.now()
    },
    queue: [],
    messages: []
  });
  return code;
}

function getRoom(code) {
  return rooms.get(code);
}

function addParticipant(room, socketId, name) {
  const colors = [
    '#6C5CE7', '#00CEC9', '#FD79A8', '#FDCB6E',
    '#E17055', '#00B894', '#74B9FF', '#A29BFE',
    '#FF7675', '#55EFC4', '#fab1a0', '#81ecec'
  ];
  const colorIndex = room.participants.size % colors.length;
  room.participants.set(socketId, {
    id: socketId,
    name,
    color: colors[colorIndex],
    joinedAt: Date.now()
  });
}

function removeParticipant(room, socketId) {
  room.participants.delete(socketId);
}

function getParticipantList(room) {
  return Array.from(room.participants.values()).map(p => ({
    id: p.id,
    name: p.name,
    color: p.color,
    isHost: p.id === room.hostId
  }));
}

// ─── Socket.IO Events ──────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`⚡ User connected: ${socket.id}`);
  let currentRoom = null;

  // ── Create Room ───────────────────────────────────────────────
  socket.on('create-room', ({ name }, callback) => {
    const code = createRoom(socket.id, name);
    const room = getRoom(code);
    addParticipant(room, socket.id, name);
    socket.join(code);
    currentRoom = code;

    console.log(`🏠 Room ${code} created by ${name}`);

    callback({
      success: true,
      roomCode: code,
      isHost: true,
      participants: getParticipantList(room),
      videoState: room.videoState,
      queue: room.queue,
      messages: room.messages
    });
  });

  // ── Join Room ─────────────────────────────────────────────────
  socket.on('join-room', ({ roomCode, name }, callback) => {
    const room = getRoom(roomCode);

    if (!room) {
      callback({ success: false, error: 'Room not found. Check the code and try again.' });
      return;
    }

    addParticipant(room, socket.id, name);
    socket.join(roomCode);
    currentRoom = roomCode;

    console.log(`👤 ${name} joined room ${roomCode}`);

    // Notify others
    socket.to(roomCode).emit('user-joined', {
      participant: {
        id: socket.id,
        name,
        color: room.participants.get(socket.id).color,
        isHost: false
      },
      participants: getParticipantList(room)
    });

    // Send system message
    const joinMsg = {
      id: crypto.randomUUID(),
      type: 'system',
      text: `${name} joined the party 🎉`,
      timestamp: Date.now()
    };
    room.messages.push(joinMsg);
    io.to(roomCode).emit('chat-message', joinMsg);

    // Calculate the current video time based on last update
    const videoState = { ...room.videoState };
    if (videoState.playing) {
      const elapsed = (Date.now() - videoState.lastUpdate) / 1000;
      videoState.currentTime += elapsed;
    }

    callback({
      success: true,
      roomCode,
      isHost: false,
      hostName: room.hostName,
      participants: getParticipantList(room),
      videoState,
      queue: room.queue,
      messages: room.messages.slice(-50) // Last 50 messages
    });
  });

  // ── Video Sync Events ─────────────────────────────────────────
  socket.on('video-play', ({ time }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (!room || socket.id !== room.hostId) return;

    room.videoState.playing = true;
    room.videoState.currentTime = time;
    room.videoState.lastUpdate = Date.now();

    socket.to(currentRoom).emit('video-play', { time });
  });

  socket.on('video-pause', ({ time }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (!room || socket.id !== room.hostId) return;

    room.videoState.playing = false;
    room.videoState.currentTime = time;
    room.videoState.lastUpdate = Date.now();

    socket.to(currentRoom).emit('video-pause', { time });
  });

  socket.on('video-seek', ({ time }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (!room || socket.id !== room.hostId) return;

    room.videoState.currentTime = time;
    room.videoState.lastUpdate = Date.now();

    socket.to(currentRoom).emit('video-seek', { time });
  });

  socket.on('video-change', ({ url }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (!room || socket.id !== room.hostId) return;

    room.videoState.url = url;
    room.videoState.playing = false;
    room.videoState.currentTime = 0;
    room.videoState.lastUpdate = Date.now();

    socket.to(currentRoom).emit('video-change', { url });

    // System message
    const msg = {
      id: crypto.randomUUID(),
      type: 'system',
      text: `🎬 Video changed by ${room.participants.get(socket.id)?.name || 'Host'}`,
      timestamp: Date.now()
    };
    room.messages.push(msg);
    io.to(currentRoom).emit('chat-message', msg);
  });

  // ── Chat ──────────────────────────────────────────────────────
  socket.on('chat-message', ({ text }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (!participant) return;

    const msg = {
      id: crypto.randomUUID(),
      type: 'user',
      senderId: socket.id,
      senderName: participant.name,
      senderColor: participant.color,
      text: text.trim().slice(0, 500), // Max 500 chars
      timestamp: Date.now()
    };

    room.messages.push(msg);
    // Keep only last 200 messages
    if (room.messages.length > 200) {
      room.messages = room.messages.slice(-200);
    }

    io.to(currentRoom).emit('chat-message', msg);
  });

  // ── Emoji Reaction ────────────────────────────────────────────
  socket.on('emoji-reaction', ({ emoji }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (!participant) return;

    socket.to(currentRoom).emit('emoji-reaction', {
      senderId: socket.id,
      senderName: participant.name,
      emoji
    });
  });

  // ── Video Queue ───────────────────────────────────────────────
  socket.on('queue-add', ({ url, title }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    const item = {
      id: crypto.randomUUID(),
      url,
      title: title || url,
      addedBy: participant?.name || 'Unknown',
      addedAt: Date.now()
    };

    room.queue.push(item);
    io.to(currentRoom).emit('queue-update', { queue: room.queue });

    // If no video is playing, auto-load the first queued video
    if (!room.videoState.url && room.queue.length === 1) {
      room.videoState.url = item.url;
      room.videoState.playing = false;
      room.videoState.currentTime = 0;
      room.videoState.lastUpdate = Date.now();
      io.to(currentRoom).emit('video-change', { url: item.url });
    }
  });

  socket.on('queue-remove', ({ itemId }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (!room) return;

    room.queue = room.queue.filter(i => i.id !== itemId);
    io.to(currentRoom).emit('queue-update', { queue: room.queue });
  });

  socket.on('queue-play', ({ itemId }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (!room || socket.id !== room.hostId) return;

    const item = room.queue.find(i => i.id === itemId);
    if (!item) return;

    room.videoState.url = item.url;
    room.videoState.playing = false;
    room.videoState.currentTime = 0;
    room.videoState.lastUpdate = Date.now();

    // Remove from queue
    room.queue = room.queue.filter(i => i.id !== itemId);

    io.to(currentRoom).emit('video-change', { url: item.url });
    io.to(currentRoom).emit('queue-update', { queue: room.queue });
  });

  // ── Disconnect ────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`💤 User disconnected: ${socket.id}`);

    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    const name = participant?.name || 'Someone';

    removeParticipant(room, socket.id);

    // System message
    const msg = {
      id: crypto.randomUUID(),
      type: 'system',
      text: `${name} left the party 👋`,
      timestamp: Date.now()
    };
    room.messages.push(msg);
    io.to(currentRoom).emit('chat-message', msg);

    // Notify others
    io.to(currentRoom).emit('user-left', {
      participantId: socket.id,
      participants: getParticipantList(room)
    });

    // If host left, assign new host
    if (socket.id === room.hostId && room.participants.size > 0) {
      const newHost = room.participants.keys().next().value;
      room.hostId = newHost;
      const newHostParticipant = room.participants.get(newHost);
      room.hostName = newHostParticipant.name;

      const hostMsg = {
        id: crypto.randomUUID(),
        type: 'system',
        text: `👑 ${newHostParticipant.name} is now the host`,
        timestamp: Date.now()
      };
      room.messages.push(hostMsg);
      io.to(currentRoom).emit('chat-message', hostMsg);
      io.to(currentRoom).emit('host-changed', {
        hostId: newHost,
        participants: getParticipantList(room)
      });
    }

    // Clean up empty rooms
    if (room.participants.size === 0) {
      rooms.delete(currentRoom);
      console.log(`🗑️ Room ${currentRoom} deleted (empty)`);
    }
  });
});

// ─── Routes ─────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/room', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'room.html'));
});

// ── Check if room exists (REST endpoint) ────────────────────────────
app.get('/api/room/:code', (req, res) => {
  const room = getRoom(req.params.code.toUpperCase());
  if (room) {
    res.json({
      exists: true,
      participantCount: room.participants.size,
      hostName: room.hostName
    });
  } else {
    res.json({ exists: false });
  }
});

// ─── Start ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎬 PlayStream server running at http://localhost:${PORT}\n`);
});
