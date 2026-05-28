/* PlayStream — Room Page JavaScript */

// ── Parse URL Params ────────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const userName = params.get('name') || 'Guest';
const action = params.get('action'); // 'create' or 'join'
const roomCodeParam = params.get('room');

if (!action || !userName) {
  window.location.href = '/';
}

// ── State ───────────────────────────────────────────────────────────
let isHost = false;
let roomCode = '';
let participants = [];
let ignoreVideoEvents = false;
let unreadChatCount = 0;
let currentVideoType = null; // 'html5' or 'youtube'
let ytPlayer = null;
let ytReady = false;
let ytIgnoreEvents = false;

// ── YouTube Helpers ─────────────────────────────────────────────────
function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function isYouTubeUrl(url) {
  return extractYouTubeId(url) !== null;
}

// YouTube IFrame API callback
function onYouTubeIframeAPIReady() {
  ytReady = true;
}
window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

function createYTPlayer(videoId, startTime, autoplay) {
  const container = document.getElementById('youtube-container');
  const playerDiv = document.getElementById('youtube-player');
  // Destroy old player
  if (ytPlayer && ytPlayer.destroy) {
    try { ytPlayer.destroy(); } catch(e) {}
  }
  // Reset the div
  playerDiv.innerHTML = '';
  playerDiv.id = 'youtube-player';

  container.style.display = 'block';
  document.getElementById('video-player').style.display = 'none';

  ytPlayer = new YT.Player('youtube-player', {
    videoId: videoId,
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: autoplay ? 1 : 0,
      start: Math.floor(startTime || 0),
      controls: 0,
      modestbranding: 1,
      rel: 0,
      fs: 0
    },
    events: {
      onReady: (e) => {
        // Sync volume with slider
        e.target.setVolume(volumeSlider.value * 100);
        if (autoplay) e.target.playVideo();
        startYTTimeUpdater();
      },
      onStateChange: (e) => {
        if (ytIgnoreEvents) return;
        if (!isHost) return;
        if (e.data === YT.PlayerState.PLAYING) {
          playPauseBtn.textContent = '⏸';
          socket.emit('video-play', { time: ytPlayer.getCurrentTime() });
        } else if (e.data === YT.PlayerState.PAUSED) {
          playPauseBtn.textContent = '▶';
          socket.emit('video-pause', { time: ytPlayer.getCurrentTime() });
        }
      }
    }
  });
}

// Update seek bar / time display for YouTube
let ytTimeInterval = null;
function startYTTimeUpdater() {
  if (ytTimeInterval) clearInterval(ytTimeInterval);
  ytTimeInterval = setInterval(() => {
    if (!ytPlayer || !ytPlayer.getCurrentTime) return;
    const cur = ytPlayer.getCurrentTime();
    const dur = ytPlayer.getDuration();
    if (dur) {
      seekBar.value = (cur / dur) * 100;
      timeCurrent.textContent = formatTime(cur);
      timeDuration.textContent = formatTime(dur);
    }
  }, 500);
}

// ── Socket Connection ───────────────────────────────────────────────
const socket = io();

// ── DOM Elements ────────────────────────────────────────────────────
const video = document.getElementById('video-player');
const videoPlaceholder = document.getElementById('video-placeholder');
const playPauseBtn = document.getElementById('play-pause-btn');
const seekBar = document.getElementById('seek-bar');
const timeCurrent = document.getElementById('time-current');
const timeDuration = document.getElementById('time-duration');
const volumeBtn = document.getElementById('volume-btn');
const volumeSlider = document.getElementById('volume-slider');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const videoUrlInput = document.getElementById('video-url-input');
const loadVideoBtn = document.getElementById('load-video-btn');
const roomCodeText = document.getElementById('room-code-text');
const roomCodeDisplay = document.getElementById('room-code-display');
const participantCountText = document.getElementById('participant-count-text');
const hostBadge = document.getElementById('host-badge');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const participantsList = document.getElementById('participants-list');
const queueList = document.getElementById('queue-list');
const queueEmpty = document.getElementById('queue-empty');
const queueUrlInput = document.getElementById('queue-url-input');
const queueAddBtn = document.getElementById('queue-add-btn');
const hostNote = document.getElementById('host-note');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const chatCount = document.getElementById('chat-count');
const peopleCount = document.getElementById('people-count');
const queueCount = document.getElementById('queue-count');

// ── Toast ───────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Initialize Room ─────────────────────────────────────────────────
socket.on('connect', () => {
  if (action === 'create') {
    socket.emit('create-room', { name: userName }, (response) => {
      if (response.success) {
        roomCode = response.roomCode;
        isHost = true;
        initRoom(response);
        showToast(`Room created! Code: ${roomCode}`, 'success');
      } else {
        showToast('Failed to create room', 'error');
      }
    });
  } else if (action === 'join') {
    socket.emit('join-room', { roomCode: roomCodeParam, name: userName }, (response) => {
      if (response.success) {
        roomCode = response.roomCode;
        isHost = response.isHost;
        initRoom(response);
        showToast(`Joined ${response.hostName}'s party!`, 'success');
      } else {
        showToast(response.error || 'Failed to join room', 'error');
        setTimeout(() => window.location.href = '/', 2000);
      }
    });
  }
});

function initRoom(data) {
  // Update URL without reload
  const newUrl = `/room?name=${encodeURIComponent(userName)}&action=${action}&room=${roomCode}`;
  window.history.replaceState({}, '', newUrl);

  // Update UI
  roomCodeText.textContent = roomCode;
  document.title = `PlayStream — Room ${roomCode}`;
  updateParticipants(data.participants);

  if (isHost) {
    hostBadge.style.display = 'flex';
    hostNote.style.display = 'none';
  } else {
    hostNote.style.display = 'block';
  }

  // Load existing messages
  if (data.messages) {
    data.messages.forEach(msg => appendChatMessage(msg));
  }

  // Load existing video
  if (data.videoState && data.videoState.url) {
    loadVideo(data.videoState.url, false);
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = data.videoState.currentTime || 0;
      if (data.videoState.playing) {
        video.play().catch(() => {});
      }
    }, { once: true });
  }

  // Load queue
  if (data.queue) {
    renderQueue(data.queue);
  }
}

// ── Copy Room Code ──────────────────────────────────────────────────
roomCodeDisplay.addEventListener('click', () => {
  navigator.clipboard.writeText(roomCode).then(() => {
    showToast('Room code copied!', 'success');
  }).catch(() => {
    showToast('Could not copy code', 'error');
  });
});

// ── Leave Room ──────────────────────────────────────────────────────
leaveRoomBtn.addEventListener('click', () => {
  if (confirm('Leave this watch party?')) {
    window.location.href = '/';
  }
});

// ═══════════════════════════════════════════════════════════════════
//  VIDEO SYNC
// ═══════════════════════════════════════════════════════════════════

function loadVideo(url, emit = true) {
  if (!url) return;
  videoPlaceholder.classList.add('hidden');
  videoUrlInput.value = url;

  const ytId = extractYouTubeId(url);
  if (ytId) {
    // YouTube video
    currentVideoType = 'youtube';
    video.style.display = 'none';
    video.pause();
    video.removeAttribute('src');

    const waitForAPI = () => {
      if (typeof YT !== 'undefined' && YT.Player) {
        createYTPlayer(ytId, 0, false);
      } else {
        setTimeout(waitForAPI, 200);
      }
    };
    waitForAPI();
  } else {
    // HTML5 video
    currentVideoType = 'html5';
    document.getElementById('youtube-container').style.display = 'none';
    if (ytPlayer && ytPlayer.destroy) {
      try { ytPlayer.destroy(); } catch(e) {}
      ytPlayer = null;
    }
    if (ytTimeInterval) clearInterval(ytTimeInterval);
    video.style.display = 'block';
    video.src = url;
    video.load();
  }

  if (emit && isHost) {
    socket.emit('video-change', { url });
  }
}

loadVideoBtn.addEventListener('click', () => {
  const url = videoUrlInput.value.trim();
  if (!url) return;
  if (isHost) {
    loadVideo(url, true);
  } else {
    // Non-hosts add to queue instead
    socket.emit('queue-add', { url, title: url.split('/').pop() || url });
    videoUrlInput.value = '';
    showToast('Added to queue', 'info');
  }
});

videoUrlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loadVideoBtn.click();
});

// ── Local Video Events (Host Only) ──────────────────────────────────
video.addEventListener('play', () => {
  playPauseBtn.textContent = '⏸';
  if (!ignoreVideoEvents && isHost) {
    socket.emit('video-play', { time: video.currentTime });
  }
});

video.addEventListener('pause', () => {
  playPauseBtn.textContent = '▶';
  if (!ignoreVideoEvents && isHost) {
    socket.emit('video-pause', { time: video.currentTime });
  }
});

video.addEventListener('seeked', () => {
  if (!ignoreVideoEvents && isHost) {
    socket.emit('video-seek', { time: video.currentTime });
  }
});

// ── Remote Video Events ─────────────────────────────────────────────
socket.on('video-play', ({ time }) => {
  if (currentVideoType === 'youtube' && ytPlayer && ytPlayer.seekTo) {
    ytIgnoreEvents = true;
    ytPlayer.seekTo(time, true);
    ytPlayer.playVideo();
    playPauseBtn.textContent = '⏸';
    setTimeout(() => { ytIgnoreEvents = false; }, 500);
  } else {
    ignoreVideoEvents = true;
    video.currentTime = time;
    video.play().catch(() => {});
    setTimeout(() => { ignoreVideoEvents = false; }, 500);
  }
});

socket.on('video-pause', ({ time }) => {
  if (currentVideoType === 'youtube' && ytPlayer && ytPlayer.seekTo) {
    ytIgnoreEvents = true;
    ytPlayer.seekTo(time, true);
    ytPlayer.pauseVideo();
    playPauseBtn.textContent = '▶';
    setTimeout(() => { ytIgnoreEvents = false; }, 500);
  } else {
    ignoreVideoEvents = true;
    video.currentTime = time;
    video.pause();
    setTimeout(() => { ignoreVideoEvents = false; }, 500);
  }
});

socket.on('video-seek', ({ time }) => {
  if (currentVideoType === 'youtube' && ytPlayer && ytPlayer.seekTo) {
    ytIgnoreEvents = true;
    ytPlayer.seekTo(time, true);
    setTimeout(() => { ytIgnoreEvents = false; }, 500);
  } else {
    ignoreVideoEvents = true;
    video.currentTime = time;
    setTimeout(() => { ignoreVideoEvents = false; }, 500);
  }
});

socket.on('video-change', ({ url }) => {
  loadVideo(url, false);
  showToast('Video changed', 'info');
});

// ── Custom Controls ─────────────────────────────────────────────────
playPauseBtn.addEventListener('click', () => {
  if (!isHost) {
    showToast('Only the host can control playback', 'warning');
    return;
  }
  if (currentVideoType === 'youtube' && ytPlayer) {
    const state = ytPlayer.getPlayerState();
    if (state === YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
    else ytPlayer.playVideo();
  } else {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }
});

video.addEventListener('timeupdate', () => {
  if (currentVideoType === 'html5' && video.duration) {
    seekBar.value = (video.currentTime / video.duration) * 100;
    timeCurrent.textContent = formatTime(video.currentTime);
    timeDuration.textContent = formatTime(video.duration);
  }
});

seekBar.addEventListener('input', () => {
  if (!isHost) {
    showToast('Only the host can control playback', 'warning');
    return;
  }
  if (currentVideoType === 'youtube' && ytPlayer && ytPlayer.getDuration) {
    const time = (seekBar.value / 100) * ytPlayer.getDuration();
    ytPlayer.seekTo(time, true);
    socket.emit('video-seek', { time });
  } else if (video.duration) {
    video.currentTime = (seekBar.value / 100) * video.duration;
  }
});

volumeBtn.addEventListener('click', () => {
  if (currentVideoType === 'youtube' && ytPlayer) {
    if (ytPlayer.isMuted()) {
      ytPlayer.unMute();
      volumeBtn.textContent = '🔊';
      volumeSlider.value = ytPlayer.getVolume() / 100;
    } else {
      ytPlayer.mute();
      volumeBtn.textContent = '🔇';
      volumeSlider.value = 0;
    }
  } else {
    video.muted = !video.muted;
    volumeBtn.textContent = video.muted ? '🔇' : '🔊';
    volumeSlider.value = video.muted ? 0 : video.volume;
  }
});

volumeSlider.addEventListener('input', () => {
  const val = parseFloat(volumeSlider.value);
  if (currentVideoType === 'youtube' && ytPlayer) {
    ytPlayer.setVolume(val * 100);
    if (val === 0) ytPlayer.mute(); else ytPlayer.unMute();
    volumeBtn.textContent = val === 0 ? '🔇' : '🔊';
  } else {
    video.volume = val;
    video.muted = val === 0;
    volumeBtn.textContent = val === 0 ? '🔇' : '🔊';
  }
});

fullscreenBtn.addEventListener('click', () => {
  const wrapper = document.querySelector('.video-section');
  if (document.fullscreenElement) document.exitFullscreen();
  else wrapper.requestFullscreen().catch(() => {});
});

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Drift Correction (for non-hosts) ────────────────────────────────
if (!isHost) {
  // Request sync every 10 seconds is handled by the server state
}

// ═══════════════════════════════════════════════════════════════════
//  CHAT
// ═══════════════════════════════════════════════════════════════════

function appendChatMessage(msg) {
  const div = document.createElement('div');

  if (msg.type === 'system') {
    div.className = 'chat-msg-system';
    div.textContent = msg.text;
  } else {
    div.className = 'chat-msg';
    const isMe = msg.senderId === socket.id;
    const initials = msg.senderName.slice(0, 2).toUpperCase();
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    div.innerHTML = `
      <div class="chat-avatar" style="background:${msg.senderColor}">${initials}</div>
      <div class="chat-body">
        <div class="chat-header">
          <span class="chat-name" style="color:${msg.senderColor}">${isMe ? 'You' : msg.senderName}</span>
          <span class="chat-time">${time}</span>
        </div>
        <div class="chat-text">${escapeHtml(msg.text)}</div>
      </div>
    `;
  }

  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Update unread count if chat tab is not active
  const chatTab = document.querySelector('[data-tab="chat"]');
  if (!chatTab.classList.contains('active') && msg.type !== 'system') {
    unreadChatCount++;
    chatCount.textContent = unreadChatCount;
    chatCount.style.display = 'inline';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

socket.on('chat-message', (msg) => {
  appendChatMessage(msg);
});

chatSendBtn.addEventListener('click', sendChat);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
});

function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit('chat-message', { text });
  chatInput.value = '';
  chatInput.focus();
}

// ── Emoji Reactions ─────────────────────────────────────────────────
document.querySelectorAll('.emoji-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const emoji = btn.dataset.emoji;
    socket.emit('emoji-reaction', { emoji });
    showFloatingEmoji(emoji);
  });
});

socket.on('emoji-reaction', ({ senderName, emoji }) => {
  showFloatingEmoji(emoji);
});

function showFloatingEmoji(emoji) {
  const el = document.createElement('div');
  el.className = 'emoji-float';
  el.textContent = emoji;
  el.style.left = `${30 + Math.random() * 40}%`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

// ═══════════════════════════════════════════════════════════════════
//  PARTICIPANTS
// ═══════════════════════════════════════════════════════════════════

function updateParticipants(list) {
  participants = list;
  const count = list.length;
  participantCountText.textContent = `${count} watching`;
  peopleCount.textContent = count;

  participantsList.innerHTML = '';
  list.forEach(p => {
    const card = document.createElement('div');
    card.className = 'participant-card';
    const initials = p.name.slice(0, 2).toUpperCase();
    card.innerHTML = `
      <div class="participant-avatar" style="background:${p.color}">
        ${initials}
        <div class="online-indicator"></div>
      </div>
      <div class="participant-info">
        <div class="participant-name">${escapeHtml(p.name)}${p.id === socket.id ? ' (You)' : ''}</div>
        <div class="participant-role">${p.isHost ? '👑 Host' : 'Viewer'}</div>
      </div>
      ${p.isHost ? '<span class="badge badge-host">HOST</span>' : ''}
    `;
    participantsList.appendChild(card);
  });
}

socket.on('user-joined', ({ participant, participants: list }) => {
  updateParticipants(list);
  showToast(`${participant.name} joined the party`, 'info');
});

socket.on('user-left', ({ participantId, participants: list }) => {
  updateParticipants(list);
});

socket.on('host-changed', ({ hostId, participants: list }) => {
  isHost = (hostId === socket.id);
  updateParticipants(list);
  if (isHost) {
    hostBadge.style.display = 'flex';
    hostNote.style.display = 'none';
    showToast('You are now the host! 👑', 'success');
  }
});

// ═══════════════════════════════════════════════════════════════════
//  VIDEO QUEUE
// ═══════════════════════════════════════════════════════════════════

function renderQueue(queue) {
  queueList.innerHTML = '';
  if (queue.length === 0) {
    queueList.innerHTML = '<div class="queue-empty"><div class="queue-empty-icon">📋</div><span>Queue is empty</span></div>';
    queueCount.style.display = 'none';
    return;
  }

  queueCount.textContent = queue.length;
  queueCount.style.display = 'inline';

  queue.forEach((item, index) => {
    const el = document.createElement('div');
    el.className = 'queue-item';
    const title = item.title || item.url.split('/').pop() || 'Untitled';
    el.innerHTML = `
      <span style="color:var(--text-muted);font-size:0.8rem;width:20px;">${index + 1}</span>
      <div class="queue-item-info">
        <div class="queue-item-title" title="${escapeHtml(item.url)}">${escapeHtml(title)}</div>
        <div class="queue-item-added">Added by ${escapeHtml(item.addedBy)}</div>
      </div>
      ${isHost ? `<button class="btn btn-ghost btn-sm queue-play-btn" data-id="${item.id}" title="Play now">▶</button>` : ''}
      <button class="btn btn-ghost btn-sm queue-remove-btn" data-id="${item.id}" title="Remove">✕</button>
    `;
    queueList.appendChild(el);
  });

  // Event listeners
  queueList.querySelectorAll('.queue-play-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      socket.emit('queue-play', { itemId: btn.dataset.id });
    });
  });
  queueList.querySelectorAll('.queue-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      socket.emit('queue-remove', { itemId: btn.dataset.id });
    });
  });
}

socket.on('queue-update', ({ queue }) => {
  renderQueue(queue);
});

queueAddBtn.addEventListener('click', () => {
  const url = queueUrlInput.value.trim();
  if (!url) return;
  const title = url.split('/').pop() || url;
  socket.emit('queue-add', { url, title });
  queueUrlInput.value = '';
  showToast('Added to queue', 'success');
});

queueUrlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') queueAddBtn.click();
});

// Auto-play next in queue when video ends
video.addEventListener('ended', () => {
  // Server handles queue advancement if host
});

// ═══════════════════════════════════════════════════════════════════
//  SIDEBAR TABS
// ═══════════════════════════════════════════════════════════════════

document.querySelectorAll('.sidebar-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');

    // Clear unread chat count
    if (tab.dataset.tab === 'chat') {
      unreadChatCount = 0;
      chatCount.style.display = 'none';
    }
  });
});

// ── Mobile Sidebar Toggle ───────────────────────────────────────────
sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  sidebarOverlay.classList.toggle('active');
});
sidebarOverlay.addEventListener('click', () => {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('active');
});

// ── Connection Status ───────────────────────────────────────────────
socket.on('disconnect', () => {
  showToast('Disconnected. Reconnecting...', 'warning');
});

socket.on('reconnect', () => {
  showToast('Reconnected!', 'success');
  // Re-join room
  if (roomCode) {
    socket.emit('join-room', { roomCode, name: userName }, (response) => {
      if (response.success) {
        updateParticipants(response.participants);
      }
    });
  }
});

// ── Keyboard Shortcuts ──────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Don't trigger shortcuts when typing in inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  if (e.code === 'Space' && isHost) {
    e.preventDefault();
    playPauseBtn.click();
  }
  if (e.key === 'f' || e.key === 'F') {
    fullscreenBtn.click();
  }
  if (e.key === 'm' || e.key === 'M') {
    volumeBtn.click();
  }
});
