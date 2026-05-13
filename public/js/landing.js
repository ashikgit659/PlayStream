/* PlayStream — Landing Page JavaScript */

// ── Particle Animation ──────────────────────────────────────────────
(function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  let animId;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 2 + 0.5;
      this.speedX = (Math.random() - 0.5) * 0.4;
      this.speedY = (Math.random() - 0.5) * 0.4;
      this.opacity = Math.random() * 0.4 + 0.1;
      this.color = Math.random() > 0.5 ? '108, 92, 231' : '0, 206, 201';
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
        this.reset();
      }
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color}, ${this.opacity})`;
      ctx.fill();
    }
  }

  function init() {
    resize();
    const count = Math.min(80, Math.floor((canvas.width * canvas.height) / 15000));
    particles = Array.from({ length: count }, () => new Particle());
  }

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(108, 92, 231, ${0.06 * (1 - dist / 150)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    drawConnections();
    animId = requestAnimationFrame(animate);
  }

  window.addEventListener('resize', () => { cancelAnimationFrame(animId); init(); animate(); });
  init();
  animate();
})();

// ── Toast Utility ───────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── DOM Elements ────────────────────────────────────────────────────
const displayNameInput = document.getElementById('display-name');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const joinModal = document.getElementById('join-modal');
const closeJoinModal = document.getElementById('close-join-modal');
const cancelJoinBtn = document.getElementById('cancel-join-btn');
const confirmJoinBtn = document.getElementById('confirm-join-btn');
const roomCodeInput = document.getElementById('room-code-input');
const joinError = document.getElementById('join-error');

// ── Validation ──────────────────────────────────────────────────────
function getDisplayName() {
  const name = displayNameInput.value.trim();
  if (!name) {
    displayNameInput.focus();
    displayNameInput.style.borderColor = 'var(--color-error)';
    showToast('Please enter your display name', 'warning');
    setTimeout(() => { displayNameInput.style.borderColor = ''; }, 2000);
    return null;
  }
  return name;
}

// ── Create Room ─────────────────────────────────────────────────────
createRoomBtn.addEventListener('click', () => {
  const name = getDisplayName();
  if (!name) return;
  // Navigate to room page — room will be created via Socket.IO on that page
  const params = new URLSearchParams({ name, action: 'create' });
  window.location.href = `/room?${params.toString()}`;
});

// ── Join Room Modal ─────────────────────────────────────────────────
joinRoomBtn.addEventListener('click', () => {
  const name = getDisplayName();
  if (!name) return;
  joinModal.classList.add('active');
  roomCodeInput.value = '';
  joinError.style.display = 'none';
  setTimeout(() => roomCodeInput.focus(), 300);
});

function closeModal() {
  joinModal.classList.remove('active');
}

closeJoinModal.addEventListener('click', closeModal);
cancelJoinBtn.addEventListener('click', closeModal);
joinModal.addEventListener('click', (e) => {
  if (e.target === joinModal) closeModal();
});

// Auto-uppercase room code
roomCodeInput.addEventListener('input', () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  joinError.style.display = 'none';
});

// ── Confirm Join ────────────────────────────────────────────────────
confirmJoinBtn.addEventListener('click', async () => {
  const name = getDisplayName();
  if (!name) return;

  const code = roomCodeInput.value.trim().toUpperCase();
  if (code.length !== 6) {
    joinError.textContent = 'Room code must be 6 characters';
    joinError.style.display = 'block';
    return;
  }

  // Check if room exists
  confirmJoinBtn.disabled = true;
  confirmJoinBtn.innerHTML = '<span class="spinner"></span> Checking...';

  try {
    const res = await fetch(`/api/room/${code}`);
    const data = await res.json();

    if (data.exists) {
      const params = new URLSearchParams({ name, action: 'join', room: code });
      window.location.href = `/room?${params.toString()}`;
    } else {
      joinError.textContent = 'Room not found. Check the code and try again.';
      joinError.style.display = 'block';
    }
  } catch (err) {
    joinError.textContent = 'Connection error. Please try again.';
    joinError.style.display = 'block';
  } finally {
    confirmJoinBtn.disabled = false;
    confirmJoinBtn.innerHTML = '<span>🚀</span> Join Party';
  }
});

// Enter key support
roomCodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') confirmJoinBtn.click();
});

displayNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') createRoomBtn.click();
});

// Restore name from session
const savedName = sessionStorage.getItem('playstream-name');
if (savedName) displayNameInput.value = savedName;
displayNameInput.addEventListener('input', () => {
  sessionStorage.setItem('playstream-name', displayNameInput.value);
});
