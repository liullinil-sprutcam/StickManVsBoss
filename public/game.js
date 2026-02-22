// ============================================================
// StickMan vs Boss — 2D Side-Scroller with break-apart mechanic
// ============================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// --- Responsive sizing ---
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// --- Constants ---
const GRAVITY = 2200;
const JUMP_FORCE = -750;
const GROUND_Y_RATIO = 0.78;      // ground line as fraction of canvas height
const PLAYER_X_RATIO = 0.18;      // stickman horizontal position
const BASE_SCROLL_SPEED = 180;
const MAX_SCROLL_SPEED = 700;
const SPEED_INCREMENT = 1.2;       // speed-up per second
const OBSTACLE_MIN_GAP_START = 420;
const OBSTACLE_MAX_GAP_START = 600;
const OBSTACLE_MIN_GAP_END = 180;
const OBSTACLE_MAX_GAP_END = 300;
const DIFFICULTY_RAMP_TIME = 120;  // seconds to reach max difficulty
const REASSEMBLE_TIME = 1.2;       // seconds to reassemble
const INVINCIBLE_TIME = 1.5;       // post-reassemble invincibility
const PARTICLE_COUNT = 12;

// --- Game state ---
let groundY, playerX;
let scrollSpeed;
let score, highScore = 0;
let gameState; // 'menu' | 'running' | 'breaking' | 'reassembling' | 'invincible'
let stateTimer;
let invincibleTimer;
let elapsedTime;  // total play time in seconds

// --- Difficulty curve ---
function getDifficulty() {
  const t = Math.min(elapsedTime / DIFFICULTY_RAMP_TIME, 1);
  const ease = t * (2 - t); // ease-out quad — fast start, slow finish
  return ease;
}

function getCurrentGap() {
  const d = getDifficulty();
  const minGap = OBSTACLE_MIN_GAP_START + (OBSTACLE_MIN_GAP_END - OBSTACLE_MIN_GAP_START) * d;
  const maxGap = OBSTACLE_MAX_GAP_START + (OBSTACLE_MAX_GAP_END - OBSTACLE_MAX_GAP_START) * d;
  return minGap + Math.random() * (maxGap - minGap);
}

// --- Stickman ---
const stick = {
  x: 0, y: 0,
  vy: 0,
  onGround: true,
  runPhase: 0,
  // Body part positions (relative offsets from root x,y which is at feet)
  // Stored as: { id, ox, oy, w, h, type }
  parts: [],
  // When broken: each part becomes { ...part, bx, by, bvx, bvy, angle, angVel }
  brokenParts: [],
};

// Body part templates (offsets from feet position, y-up in canvas means negative = up)
function getPartTemplates(scale) {
  const s = scale;
  return [
    { id: 'head',     ox: 0,       oy: -s*5.8, r: s*0.55, type: 'circle' },
    { id: 'body',     ox: 0,       oy: -s*3.6, h: s*2.0,  type: 'line' },
    { id: 'luparm',   ox: -s*0.1,  oy: -s*4.6, h: s*1.0,  type: 'line' },
    { id: 'lloarm',   ox: -s*0.4,  oy: -s*3.6, h: s*0.9,  type: 'line' },
    { id: 'ruparm',   ox: s*0.1,   oy: -s*4.6, h: s*1.0,  type: 'line' },
    { id: 'rloarm',   ox: s*0.4,   oy: -s*3.6, h: s*0.9,  type: 'line' },
    { id: 'lupleg',   ox: -s*0.3,  oy: -s*2.6, h: s*1.2,  type: 'line' },
    { id: 'lloleg',   ox: -s*0.4,  oy: -s*1.3, h: s*1.3,  type: 'line' },
    { id: 'rupleg',   ox: s*0.3,   oy: -s*2.6, h: s*1.2,  type: 'line' },
    { id: 'rloleg',   ox: s*0.4,   oy: -s*1.3, h: s*1.3,  type: 'line' },
  ];
}

// --- Obstacles ---
let obstacles = [];
const OBSTACLE_TYPES = ['spike', 'box', 'sawblade'];

function spawnObstacle(x) {
  const scale = getScale();
  const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
  let w, h;
  if (type === 'spike') {
    w = scale * 1.5;
    h = scale * 2.5;
  } else if (type === 'box') {
    w = scale * 2.0;
    h = scale * 2.0 + Math.random() * scale * 1.5;
  } else {
    w = scale * 2.2;
    h = scale * 2.2;
  }
  obstacles.push({ x, y: groundY - h, w, h, type, phase: Math.random() * Math.PI * 2 });
}

// --- Particles ---
let particles = [];

function emitParticles(x, y) {
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 150 + Math.random() * 300;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 200,
      life: 0.5 + Math.random() * 0.5,
      maxLife: 0.5 + Math.random() * 0.5,
      size: 2 + Math.random() * 4,
      color: ['#ff4444', '#ffaa00', '#ffff44'][Math.floor(Math.random() * 3)],
    });
  }
}

// --- Background layers (parallax) ---
const bgStars = [];
for (let i = 0; i < 80; i++) {
  bgStars.push({
    x: Math.random(),
    y: Math.random() * 0.7,
    size: 0.5 + Math.random() * 1.5,
    bright: 0.3 + Math.random() * 0.7,
  });
}

const bgBuildings = [];
for (let i = 0; i < 20; i++) {
  bgBuildings.push({
    x: i * 0.06,
    w: 0.02 + Math.random() * 0.04,
    h: 0.08 + Math.random() * 0.2,
    color: `hsl(${230 + Math.random() * 30}, 30%, ${12 + Math.random() * 10}%)`,
  });
}

// --- Scale helper ---
function getScale() {
  return Math.min(canvas.width, canvas.height) / 45;
}

// --- Init / Reset ---
function initGame() {
  groundY = canvas.height * GROUND_Y_RATIO;
  playerX = canvas.width * PLAYER_X_RATIO;
  scrollSpeed = BASE_SCROLL_SPEED;
  score = 0;
  elapsedTime = 0;
  gameState = 'menu';
  stateTimer = 0;
  invincibleTimer = 0;
  obstacles = [];
  particles = [];

  stick.x = playerX;
  stick.y = groundY;
  stick.vy = 0;
  stick.onGround = true;
  stick.runPhase = 0;
  stick.parts = getPartTemplates(getScale());
  stick.brokenParts = [];
}

function startGame() {
  groundY = canvas.height * GROUND_Y_RATIO;
  playerX = canvas.width * PLAYER_X_RATIO;
  scrollSpeed = BASE_SCROLL_SPEED;
  score = 0;
  elapsedTime = 0;
  gameState = 'running';
  stateTimer = 0;
  invincibleTimer = 0;
  obstacles = [];
  particles = [];

  stick.x = playerX;
  stick.y = groundY;
  stick.vy = 0;
  stick.onGround = true;
  stick.runPhase = 0;
  stick.parts = getPartTemplates(getScale());
  stick.brokenParts = [];

  // Spawn initial obstacles
  let ox = canvas.width + 300;
  for (let i = 0; i < 3; i++) {
    spawnObstacle(ox);
    ox += getCurrentGap();
  }
}

// --- Input ---
let jumpRequested = false;

function onInput(e) {
  e.preventDefault();
  if (gameState === 'menu') {
    startGame();
    return;
  }
  if (gameState === 'running' || gameState === 'invincible') {
    jumpRequested = true;
  }
}

canvas.addEventListener('touchstart', onInput, { passive: false });
canvas.addEventListener('mousedown', onInput);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    if (gameState === 'menu') { startGame(); return; }
    if (gameState === 'running' || gameState === 'invincible') jumpRequested = true;
  }
});

// --- Break apart ---
function breakApart() {
  gameState = 'breaking';
  stateTimer = 0;
  emitParticles(stick.x, stick.y - getScale() * 3);

  const scale = getScale();
  stick.brokenParts = stick.parts.map(p => ({
    ...p,
    bx: stick.x + p.ox,
    by: stick.y + p.oy,
    bvx: (Math.random() - 0.5) * 500,
    bvy: -300 - Math.random() * 400,
    angle: 0,
    angVel: (Math.random() - 0.5) * 15,
  }));
}

// --- Collision detection ---
function checkCollision() {
  const scale = getScale();
  // Stickman bounding box (rough)
  const sx = stick.x - scale * 0.8;
  const sy = stick.y - scale * 5.8;
  const sw = scale * 1.6;
  const sh = scale * 5.8;

  for (const obs of obstacles) {
    // AABB test
    if (sx < obs.x + obs.w && sx + sw > obs.x &&
        sy < obs.y + obs.h && sy + sh > obs.y) {
      return true;
    }
  }
  return false;
}

// --- Update ---
let lastTime = 0;
let nextObstacleX = 0;

function update(dt) {
  const scale = getScale();
  groundY = canvas.height * GROUND_Y_RATIO;
  playerX = canvas.width * PLAYER_X_RATIO;

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 600 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  if (gameState === 'menu') return;

  if (gameState === 'running' || gameState === 'invincible') {
    // Track play time & ramp speed
    elapsedTime += dt;
    scrollSpeed = BASE_SCROLL_SPEED + (MAX_SCROLL_SPEED - BASE_SCROLL_SPEED) * getDifficulty();

    // Jump
    if (jumpRequested && stick.onGround) {
      stick.vy = JUMP_FORCE;
      stick.onGround = false;
    }
    jumpRequested = false;

    // Gravity
    if (!stick.onGround) {
      stick.vy += GRAVITY * dt;
      stick.y += stick.vy * dt;
      if (stick.y >= groundY) {
        stick.y = groundY;
        stick.vy = 0;
        stick.onGround = true;
      }
    }

    // Run animation phase (faster legs at higher speed)
    if (stick.onGround) {
      stick.runPhase += dt * (8 + 8 * getDifficulty());
    }

    // Update stickman position
    stick.x = playerX;
    stick.parts = getPartTemplates(scale);

    // Scroll obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].x -= scrollSpeed * dt;
      obstacles[i].phase += dt * 8;
      if (obstacles[i].x + obstacles[i].w < -50) {
        obstacles.splice(i, 1);
        score++;
      }
    }

    // Spawn new obstacles
    const rightEdge = obstacles.length > 0 ? Math.max(...obstacles.map(o => o.x + o.w)) : 0;
    if (obstacles.length === 0 || rightEdge < canvas.width + 100) {
      const gap = getCurrentGap();
      const spawnX = obstacles.length > 0 ? rightEdge + gap : canvas.width + gap;
      spawnObstacle(spawnX);
    }

    // Collision
    if (gameState === 'running' && checkCollision()) {
      breakApart();
      return;
    }

    // Invincibility timer
    if (gameState === 'invincible') {
      invincibleTimer -= dt;
      if (invincibleTimer <= 0) {
        gameState = 'running';
      }
    }
  }

  if (gameState === 'breaking') {
    stateTimer += dt;
    // Animate broken parts with physics
    for (const p of stick.brokenParts) {
      p.bvx *= 0.99;
      p.bvy += GRAVITY * 0.5 * dt;
      p.bx += p.bvx * dt;
      p.by += p.bvy * dt;
      p.angle += p.angVel * dt;
      // Bounce off ground
      if (p.by > groundY) {
        p.by = groundY;
        p.bvy *= -0.4;
        p.bvx *= 0.7;
        p.angVel *= 0.7;
      }
    }

    // Scroll obstacles even while breaking
    for (let i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].x -= scrollSpeed * 0.3 * dt;
      if (obstacles[i].x + obstacles[i].w < -50) {
        obstacles.splice(i, 1);
      }
    }

    if (stateTimer > 1.0) {
      gameState = 'reassembling';
      stateTimer = 0;
    }
  }

  if (gameState === 'reassembling') {
    stateTimer += dt;
    const t = Math.min(stateTimer / REASSEMBLE_TIME, 1);
    const ease = t * t * (3 - 2 * t); // smoothstep

    // Lerp parts back to correct positions
    for (const p of stick.brokenParts) {
      const targetX = stick.x + p.ox;
      const targetY = groundY + p.oy;
      p.bx = p.bx + (targetX - p.bx) * ease * 0.15;
      p.by = p.by + (targetY - p.by) * ease * 0.15;
      p.angle *= (1 - ease * 0.1);
    }

    if (t >= 1) {
      gameState = 'invincible';
      invincibleTimer = INVINCIBLE_TIME;
      stick.y = groundY;
      stick.vy = 0;
      stick.onGround = true;
      stick.brokenParts = [];
      if (score > highScore) highScore = score;
      emitParticles(stick.x, stick.y - scale * 3);
    }
  }
}

// --- Draw ---
function drawBackground() {
  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#0a0a2e');
  grad.addColorStop(0.6, '#16213e');
  grad.addColorStop(1, '#1a1a3e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Stars
  for (const star of bgStars) {
    ctx.fillStyle = `rgba(255,255,255,${star.bright * 0.6})`;
    ctx.fillRect(star.x * canvas.width, star.y * canvas.height, star.size, star.size);
  }

  // Buildings (parallax)
  const scroll = (score * 0.01) % 1;
  for (const b of bgBuildings) {
    const bx = ((b.x - scroll * 0.3) % 1.2) * canvas.width;
    const bw = b.w * canvas.width;
    const bh = b.h * canvas.height;
    ctx.fillStyle = b.color;
    ctx.fillRect(bx, groundY - bh, bw, bh);
    // Windows
    ctx.fillStyle = 'rgba(255, 200, 50, 0.15)';
    for (let wy = groundY - bh + 8; wy < groundY - 8; wy += 14) {
      for (let wx = bx + 4; wx < bx + bw - 4; wx += 10) {
        if (Math.random() > 0.3) ctx.fillRect(wx, wy, 5, 7);
      }
    }
  }
}

function drawGround() {
  // Ground
  ctx.fillStyle = '#2d2d5e';
  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);

  // Ground line
  ctx.strokeStyle = '#5555aa';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(canvas.width, groundY);
  ctx.stroke();

  // Ground pattern
  ctx.strokeStyle = 'rgba(85, 85, 170, 0.2)';
  ctx.lineWidth = 1;
  const lineSpacing = 30;
  const offset = (Date.now() * 0.05 * (scrollSpeed / BASE_SCROLL_SPEED)) % lineSpacing;
  for (let x = -offset; x < canvas.width; x += lineSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x - 20, canvas.height);
    ctx.stroke();
  }
}

function drawStickman() {
  const scale = getScale();
  const x = stick.x;
  const y = stick.y;
  const phase = stick.runPhase;
  const isRunning = stick.onGround && (gameState === 'running' || gameState === 'invincible');

  // Blinking for invincibility
  if (gameState === 'invincible' && Math.floor(invincibleTimer * 10) % 2 === 0) return;

  const legSwing = isRunning ? Math.sin(phase) * 0.5 : 0;
  const armSwing = isRunning ? Math.sin(phase) * 0.4 : 0;
  const bounce = isRunning ? Math.abs(Math.sin(phase)) * scale * 0.2 : 0;
  const by = y - bounce;

  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = Math.max(3, scale * 0.3);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Head
  ctx.beginPath();
  ctx.arc(x, by - scale * 5.3, scale * 0.55, 0, Math.PI * 2);
  ctx.stroke();

  // Eyes
  const eyeScale = scale * 0.12;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x - scale * 0.2, by - scale * 5.4, eyeScale, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + scale * 0.2, by - scale * 5.4, eyeScale, 0, Math.PI * 2);
  ctx.fill();

  // Pupils
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(x - scale * 0.15, by - scale * 5.4, eyeScale * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + scale * 0.25, by - scale * 5.4, eyeScale * 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';

  // Body
  ctx.beginPath();
  ctx.moveTo(x, by - scale * 4.7);
  ctx.lineTo(x, by - scale * 2.6);
  ctx.stroke();

  // Left arm
  const laAngle = -Math.PI / 6 + armSwing;
  ctx.beginPath();
  ctx.moveTo(x, by - scale * 4.4);
  ctx.lineTo(x + Math.sin(laAngle) * scale * 1.2, by - scale * 4.4 + Math.cos(laAngle) * scale * 1.2);
  ctx.stroke();

  // Right arm
  const raAngle = Math.PI / 6 - armSwing;
  ctx.beginPath();
  ctx.moveTo(x, by - scale * 4.4);
  ctx.lineTo(x + Math.sin(raAngle) * scale * 1.2, by - scale * 4.4 + Math.cos(raAngle) * scale * 1.2);
  ctx.stroke();

  // Left leg
  const llAngle = -0.15 + legSwing;
  const lKneeX = x + Math.sin(llAngle) * scale * 1.3;
  const lKneeY = by - scale * 2.6 + Math.cos(llAngle) * scale * 1.3;
  ctx.beginPath();
  ctx.moveTo(x, by - scale * 2.6);
  ctx.lineTo(lKneeX, lKneeY);
  ctx.lineTo(lKneeX + Math.sin(llAngle * 0.5) * scale * 1.2, lKneeY + Math.cos(llAngle * 0.3) * scale * 1.2);
  ctx.stroke();

  // Right leg
  const rlAngle = 0.15 - legSwing;
  const rKneeX = x + Math.sin(rlAngle) * scale * 1.3;
  const rKneeY = by - scale * 2.6 + Math.cos(rlAngle) * scale * 1.3;
  ctx.beginPath();
  ctx.moveTo(x, by - scale * 2.6);
  ctx.lineTo(rKneeX, rKneeY);
  ctx.lineTo(rKneeX + Math.sin(rlAngle * 0.5) * scale * 1.2, rKneeY + Math.cos(rlAngle * 0.3) * scale * 1.2);
  ctx.stroke();
}

function drawBrokenParts() {
  const scale = getScale();
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = Math.max(3, scale * 0.3);
  ctx.lineCap = 'round';

  for (const p of stick.brokenParts) {
    ctx.save();
    ctx.translate(p.bx, p.by);
    ctx.rotate(p.angle);

    if (p.type === 'circle') {
      // Head
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.stroke();
      // Eyes
      const es = p.r * 0.22;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-p.r * 0.35, -p.r * 0.15, es, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.r * 0.35, -p.r * 0.15, es, 0, Math.PI * 2);
      ctx.fill();
      // X eyes (dazed)
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2;
      const cx1 = -p.r * 0.35, cy1 = -p.r * 0.15;
      ctx.beginPath();
      ctx.moveTo(cx1 - es, cy1 - es); ctx.lineTo(cx1 + es, cy1 + es);
      ctx.moveTo(cx1 + es, cy1 - es); ctx.lineTo(cx1 - es, cy1 + es);
      ctx.stroke();
      const cx2 = p.r * 0.35, cy2 = -p.r * 0.15;
      ctx.beginPath();
      ctx.moveTo(cx2 - es, cy2 - es); ctx.lineTo(cx2 + es, cy2 + es);
      ctx.moveTo(cx2 + es, cy2 - es); ctx.lineTo(cx2 - es, cy2 + es);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(3, scale * 0.3);
    } else {
      // Line (limb)
      ctx.beginPath();
      ctx.moveTo(0, -p.h * 0.5);
      ctx.lineTo(0, p.h * 0.5);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawObstacles() {
  const scale = getScale();
  for (const obs of obstacles) {
    if (obs.type === 'spike') {
      // Triangle spike
      ctx.fillStyle = '#ff3333';
      ctx.strokeStyle = '#ff6666';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(obs.x + obs.w / 2, obs.y);
      ctx.lineTo(obs.x + obs.w, obs.y + obs.h);
      ctx.lineTo(obs.x, obs.y + obs.h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Glow
      ctx.shadowColor = '#ff3333';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (obs.type === 'box') {
      // Crate
      ctx.fillStyle = '#8B4513';
      ctx.strokeStyle = '#D2691E';
      ctx.lineWidth = 2;
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      // X pattern
      ctx.strokeStyle = 'rgba(210,105,30,0.5)';
      ctx.beginPath();
      ctx.moveTo(obs.x, obs.y);
      ctx.lineTo(obs.x + obs.w, obs.y + obs.h);
      ctx.moveTo(obs.x + obs.w, obs.y);
      ctx.lineTo(obs.x, obs.y + obs.h);
      ctx.stroke();
    } else if (obs.type === 'sawblade') {
      // Rotating saw
      const cx = obs.x + obs.w / 2;
      const cy = obs.y + obs.h / 2;
      const r = obs.w / 2;
      const teeth = 8;
      ctx.fillStyle = '#888';
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2 + obs.phase;
        const tr = i % 2 === 0 ? r : r * 0.7;
        const tx = cx + Math.cos(a) * tr;
        const ty = cy + Math.sin(a) * tr;
        if (i === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Center
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawParticles() {
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawUI() {
  const scale = getScale();

  // Score
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.max(18, scale * 1.5)}px 'Segoe UI', sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(`Score: ${score}`, 16, 36);
  ctx.fillText(`Best: ${highScore}`, 16, 36 + Math.max(22, scale * 1.8));

  // Speed indicator (only during gameplay)
  if (gameState !== 'menu') {
    const speedPct = Math.round(((scrollSpeed - BASE_SCROLL_SPEED) / (MAX_SCROLL_SPEED - BASE_SCROLL_SPEED)) * 100);
    const barW = Math.max(80, scale * 8);
    const barH = Math.max(8, scale * 0.5);
    const barX = canvas.width - barW - 16;
    const barY = 24;
    // Background
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(barX, barY, barW, barH);
    // Fill with gradient from green to red
    const fillW = barW * (speedPct / 100);
    const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    barGrad.addColorStop(0, '#44ff44');
    barGrad.addColorStop(0.5, '#ffff44');
    barGrad.addColorStop(1, '#ff4444');
    ctx.fillStyle = barGrad;
    ctx.fillRect(barX, barY, fillW, barH);
    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `${Math.max(12, scale * 0.8)}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(`Speed x${(scrollSpeed / BASE_SCROLL_SPEED).toFixed(1)}`, barX + barW, barY - 6);
    ctx.textAlign = 'left';
  }

  if (gameState === 'menu') {
    // Title
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(32, scale * 3)}px 'Segoe UI', sans-serif`;
    ctx.fillText('StickMan vs Boss', canvas.width / 2, canvas.height * 0.3);

    ctx.font = `${Math.max(16, scale * 1.2)}px 'Segoe UI', sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Нажмите чтобы начать', canvas.width / 2, canvas.height * 0.3 + scale * 3.5);
    ctx.fillText('Тап / Пробел — прыжок', canvas.width / 2, canvas.height * 0.3 + scale * 5.5);

    // Draw idle stickman in menu
    drawStickman();
  }

  if (gameState === 'breaking' || gameState === 'reassembling') {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4444';
    ctx.font = `bold ${Math.max(24, scale * 2)}px 'Segoe UI', sans-serif`;
    if (gameState === 'breaking') {
      ctx.fillText('CRASH!', canvas.width / 2, canvas.height * 0.25);
    } else {
      ctx.fillStyle = '#44ff44';
      ctx.fillText('Reassembling...', canvas.width / 2, canvas.height * 0.25);
    }
  }
}

// --- Main loop ---
function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  update(dt);

  // Draw
  drawBackground();
  drawGround();
  drawObstacles();

  if (gameState === 'breaking' || gameState === 'reassembling') {
    drawBrokenParts();
  } else {
    drawStickman();
  }

  drawParticles();
  drawUI();

  requestAnimationFrame(gameLoop);
}

initGame();
requestAnimationFrame(gameLoop);
