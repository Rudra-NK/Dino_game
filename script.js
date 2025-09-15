// game.js — Full file with high-speed easing and Start button support
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // ---------- DPI / canvas ----------
  function resizeCanvasToDisplaySize() {
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.max(1, Math.floor(canvas.clientWidth));
    const displayHeight = Math.max(1, Math.floor(canvas.clientHeight));
    const width = Math.max(1, Math.floor(displayWidth * dpr));
    const height = Math.max(1, Math.floor(displayHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
  resizeCanvasToDisplaySize();
  window.addEventListener('resize', () => {
    resizeCanvasToDisplaySize();
    recalcLayout();
  });

  function CSS_W() { return canvas.clientWidth; }
  function CSS_H() { return canvas.clientHeight; }

  // ---------- Layout helpers ----------
  let groundHeight = 40; // css px
  function groundY() { return CSS_H() - groundHeight; }

  function recalcLayout() {
    dino.y = Math.min(dino.y, groundY() - dino.h);
    for (const o of obstacles) {
      o.y = groundY() - o.h;
    }
  }

  // ---------- Camera ----------
  const CAMERA_OFFSET_X = 80; // dino drawn at this screen x (css px)

  // ---------- DOM elements ----------
  const scoreEl = document.getElementById('score');
  const speedEl = document.getElementById('speed');
  const godStateEl = document.getElementById('godState');
  const restartBtn = document.getElementById('restartBtn');
  const startBtn = document.getElementById('startBtn'); // optional

  // ---------- Game state ----------
  const baseSpeed = 3;      // base starting speed
  let gameSpeed = baseSpeed;      // dino forward speed (css px per frame)
  let gravity = 0.68
  let frame = 0;
  let score = 0;
  let running = false;      // start in not-running; startGame toggles
  let isPaused = false;
  let godMode = false;
  let started = false;      // whether player pressed Start (if startBtn exists)

  // ---------- High-speed easing & obstacle tuning ----------
  const GAP_BASE = 600;           // base gap in px at baseSpeed
  const GAP_PER_SPEED = 150;      // extra px added per speed unit above baseSpeed
  const GAP_RANDOM_JITTER = 200;  // random jitter range
  const GAP_MIN = 300;
  const GAP_MAX = 3000;

  // high-speed easing settings
  const HIGH_SPEED_THRESHOLD = 12;     // above this speed we begin easing
  const HIGH_SPEED_GAP_MULTIPLIER = 0.20; // +20% gap at extreme
  const HIGH_SPEED_REDUCTION_RATE = 2.0;  // every 2 speed units above threshold reduce 1 extra obstacle

  // how speed maps to extra obstacles
  const SPEED_LEVEL = 1.0;        // every 1.0 speed units => +1 extra obstacle
  const MAX_EXTRA_OBSTACLES = 6;  // cap extra obstacles
  const BASE_OBSTACLE_BUFFER = 4; // base desired number of gaps ahead
  const INITIAL_EXTRA_OBSTACLES = 6; // denser start

  function computeGapForSpeed(speed) {
    // base: grows with speed (so faster -> further apart by default)
    const extra = Math.max(0, speed - baseSpeed) * GAP_PER_SPEED;
    const jitter = Math.floor(Math.random() * GAP_RANDOM_JITTER);
    let gap = GAP_BASE + extra + jitter;

    // But at very high speeds gently increase gap further (easing)
    if (speed > HIGH_SPEED_THRESHOLD) {
      const over = speed - HIGH_SPEED_THRESHOLD;
      const mult = 1 + Math.min(1.0, (over / HIGH_SPEED_THRESHOLD) * HIGH_SPEED_GAP_MULTIPLIER);
      gap = Math.floor(gap * mult);
    }

    gap = Math.max(GAP_MIN, Math.min(GAP_MAX, gap));
    return gap;
  }

  function computeExtraObstacles(speed) {
    const raw = Math.floor(Math.max(0, speed - baseSpeed) / SPEED_LEVEL);
    // If above threshold, reduce raw extra gradually
    if (speed > HIGH_SPEED_THRESHOLD) {
      const overUnits = speed - HIGH_SPEED_THRESHOLD;
      const reduceBy = Math.floor(overUnits / HIGH_SPEED_REDUCTION_RATE);
      const adjusted = Math.max(0, raw - reduceBy);
      return Math.min(MAX_EXTRA_OBSTACLES, adjusted);
    }
    return Math.min(MAX_EXTRA_OBSTACLES, raw);
  }

  // ---------- Dino (world coordinates) ----------
  const dino = {
    x: 40, // world x
    y: 0,  // set in reset
    w: 40,
    h: 40,
    vy: 0,
    jumpForce: -16,
    grounded: true,
    update() {
      this.vy += gravity;
      this.y += this.vy;
      if (this.y + this.h >= groundY()) {
        this.y = groundY() - this.h;
        this.vy = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
      if (running && !isPaused) {
        this.x += Number(gameSpeed) || 0;
      }
    },
    jump() {
      if (this.grounded) {
        this.vy = this.jumpForce;
        this.grounded = false;
        // optional: play soundJump if defined elsewhere
        if (typeof soundJump !== 'undefined') {
          try { soundJump.currentTime = 0; soundJump.play(); } catch(e) {}
        }
      }
    },
    reset() {
      this.x = 40;
      this.y = groundY() - this.h;
      this.vy = 0;
      this.grounded = true;
    },
    draw() {
      const screenX = CAMERA_OFFSET_X;
      const color = (getComputedStyle(document.documentElement).getPropertyValue('--dino') || '#222').trim() || '#222';
      ctx.fillStyle = color;
      roundRect(ctx, screenX, this.y, this.w, this.h, 6);
      ctx.fillStyle = '#fff';
      ctx.fillRect(screenX + 28, this.y + 10, 6, 6);
    }
  };

  // ---------- Obstacles ----------
  class Obstacle {
    constructor(worldX) {
      this.w = (Math.random() > 0.6) ? 30 + Math.floor(Math.random() * 30) : 20 + Math.floor(Math.random() * 15);
      this.h = 20 + Math.floor(Math.random() * 30);
      this.worldX = Number(worldX);
      this.y = groundY() - this.h;
    }
    draw(dinoWorldX) {
      const screenX = this.worldX - (dinoWorldX - CAMERA_OFFSET_X);
      const color = (getComputedStyle(document.documentElement).getPropertyValue('--obstacle') || '#333').trim() || '#333';
      ctx.fillStyle = color;
      roundRect(ctx, screenX, this.y, this.w, this.h, 4);
    }
  }

  const obstacles = [];

  // ---------- Utilities ----------
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }

  function collides(a, b) {
    return a.x < b.worldX + b.w &&
           a.x + a.w > b.worldX &&
           a.y < b.y + b.h &&
           a.y + a.h > b.y;
  }

  // ---------- Obstacle generation ----------
  function generateNextObstacle() {
    let last = dino.x + 200;
    if (obstacles.length > 0) {
      last = obstacles[obstacles.length - 1].worldX;
    }
    const gap = computeGapForSpeed(gameSpeed);
    const nextX = last + gap + Math.floor(Math.random() * 80) - 40; // small jitter +/-40
    obstacles.push(new Obstacle(nextX));
  }

  function populateInitialObstacles() {
    obstacles.length = 0;
    let cursor = dino.x + 200;
    const baseInitial = 10; // base number at start
    const initialCount = baseInitial + INITIAL_EXTRA_OBSTACLES; // denser beginning
    for (let i = 0; i < initialCount; i++) {
      const gap = computeGapForSpeed(gameSpeed);
      cursor += gap + Math.floor(Math.random() * 40) - 20;
      obstacles.push(new Obstacle(cursor));
    }
    // a few extra far ones
    for (let i = 0; i < 6; i++) {
      const gap = computeGapForSpeed(gameSpeed) + 200 + Math.floor(Math.random() * 300);
      cursor += gap;
      obstacles.push(new Obstacle(cursor));
    }
  }

  // ---------- Reset / Start / Restart ----------
  function resetGame() {
    resizeCanvasToDisplaySize();
    frame = 0;
    score = 0;
    running = true;
    isPaused = false;
    godMode = false;
    gameSpeed = baseSpeed;
    dino.reset();
    populateInitialObstacles();
    recalcLayout();
    updateHUD();
  }

  function restart() {
    resetGame();
  }

  function startGame() {
    if (started) return;
    started = true;
    if (startBtn) startBtn.style.display = 'none';
    resetGame();
    // start loop if not already running
    if (!rafRequested) {
      rafRequested = true;
      loop();
    }
  }

  // If no startBtn present, auto-start
  if (!startBtn) {
    startGame();
  } else {
    // attach start handler
    startBtn.addEventListener('click', startGame);
  }

  // ---------- HUD ----------
  function updateHUD() {
    scoreEl.textContent = Math.floor(score);
    speedEl.textContent = Math.max(0, Math.floor(gameSpeed));
    godStateEl.textContent = godMode ? 'ON' : 'OFF';
    const badge = document.getElementById('godBadge');
    if (badge) badge.style.border = godMode ? '2px solid #4caf50' : '1px solid #ddd';
  }

  // ---------- Input ----------
  function handleJumpKey(e) {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      dino.jump();
    }
  }

  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      handleJumpKey(e);
    } else if (key === 'g') {
      godMode = !godMode; updateHUD();
    } else if (key === 'p') {
      isPaused = !isPaused;
    } else if (key === 'r') {
      restart();
    } else if (key === 's') {
      startGame();
    }
  });

  // touch: tap => jump; double-tap toggles god mode
  let lastTap = 0;
  canvas.addEventListener('touchstart', (ev) => {
    ev.preventDefault();
    const now = Date.now();
    if (now - lastTap < 300) {
      godMode = !godMode;
      updateHUD();
    } else {
      dino.jump();
    }
    lastTap = now;
  }, { passive: false });

  // pointer: click to jump; if run over, click restarts
  canvas.addEventListener('pointerdown', (ev) => {
    if (!running) restart();
    else dino.jump();
  });

  if (restartBtn) restartBtn.addEventListener('click', restart);

  // ---------- Game loop ----------
  let rafRequested = false;
  function loop() {
    rafRequested = true;
    if (!isPaused && running) {
      frame++;
      dino.update();

      // dynamic obstacle spawning with buffer size dependent on speed
      const extraObstacles = computeExtraObstacles(gameSpeed);
      const desiredBuffer = BASE_OBSTACLE_BUFFER + extraObstacles + INITIAL_EXTRA_OBSTACLES;

      // count obstacles ahead of dino
      const aheadCount = obstacles.filter(o => o.worldX > dino.x).length;

      // if fewer than desiredBuffer+1 obstacles ahead, generate enough
      if (aheadCount < desiredBuffer + 1) {
        const toGenerate = (desiredBuffer + 1) - aheadCount;
        for (let i = 0; i < toGenerate; i++) generateNextObstacle();
      } else {
        const farthest = obstacles.length ? obstacles[obstacles.length - 1].worldX : dino.x;
        const threshold = dino.x + computeGapForSpeed(gameSpeed) * Math.max(1, desiredBuffer * 0.9);
        if (farthest < threshold) {
          const baseGen = 1;
          const bonusProb = Math.min(0.85, extraObstacles * 0.15 + 0.15);
          const bonus = Math.random() < bonusProb ? 1 : 0;
          const genCount = baseGen + bonus;
          for (let i = 0; i < genCount; i++) generateNextObstacle();
        }
      }

      // score
      score = Math.max(score, Math.floor((dino.x - 40) * 0.3));

      // difficulty ramp: every N frames speed up a bit and spawn a few extras to reflect level up
      if (frame % 800 === 0) {
        const oldSpeed = gameSpeed;
        gameSpeed = Number(gameSpeed) + 0.9; // small bump
        // spawn a small burst of obstacles on level-up
        const extraOnLevel = Math.min(4, computeExtraObstacles(gameSpeed) - computeExtraObstacles(oldSpeed) + 1);
        for (let i = 0; i < extraOnLevel; i++) generateNextObstacle();
      }

      // collision detection
      if (!godMode) {
        for (const o of obstacles) {
          if (collides(dino, o)) {
            running = false;
            // optional hit sound if defined
            if (typeof soundHit !== 'undefined') {
              try { soundHit.currentTime = 0; soundHit.play(); } catch(e) {}
            }
            flashGame();
            break;
          }
        }
      }
    }

    draw(!running);
    updateHUD();
    requestAnimationFrame(loop);
  }

  function draw(gameOver = false) {
    resizeCanvasToDisplaySize();
    const W = CSS_W();
    const H = CSS_H();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ground
    const groundColor = (getComputedStyle(document.documentElement).getPropertyValue('--ground') || '#666').trim() || '#666';
    ctx.fillStyle = groundColor;
    ctx.fillRect(0, groundY(), W, H - groundY());

    // draw obstacles (map worldX -> screenX)
    for (const o of obstacles) {
      const screenX = o.worldX - (dino.x - CAMERA_OFFSET_X);
      if (screenX + o.w < -120 || screenX > W + 120) continue;
      o.draw(dino.x);
    }

    // draw dino
    dino.draw();

    // god indicator
    if (godMode) {
      ctx.fillStyle = '#4caf50';
      ctx.beginPath();
      ctx.arc(W - 30, 30, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('G', W - 30, 35);
      ctx.textAlign = 'start';
    }

    // overlay
    if (gameOver) {
      const collisionHappened = !godMode && obstacles.some(o => collides(dino, o));
      const msg = collisionHappened ? 'Game Over — collision!' : 'Run Finished';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(W / 2 - 200, H / 2 - 40, 400, 80);
      ctx.fillStyle = '#fff';
      ctx.font = '18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(msg + ' — Press Restart (R) or button to play again', W / 2, H / 2 + 6);
      ctx.textAlign = 'start';
    }
  }

  function flashGame() {
    const original = canvas.style.boxShadow || '';
    canvas.style.boxShadow = '0 0 0 6px rgba(255,0,0,0.15)';
    setTimeout(() => canvas.style.boxShadow = original, 300);
  }

  // ---------- Start initial state: show Start button if present ----------
  // If startBtn exists we show it and wait; otherwise start immediately (startGame() above already handles)
  if (startBtn) {
    // Make sure start button is visible
    startBtn.style.display = 'block';
  }

  // ---------- Public API ----------
  window.DINO_CLONE = {
    setGodMode(v) { godMode = !!v; updateHUD(); },
    toggleGodMode() { godMode = !godMode; updateHUD(); },
    setSpeed(v) {
      const n = Number(v);
      if (isFinite(n) && n >= 0) {
        gameSpeed = n;
        updateHUD();
      }
    },
    addObstacleAt(x) {
      const n = Number(x);
      if (isFinite(n)) obstacles.push(new Obstacle(n));
    },
    restart,
    startGame,
    getState() {
      return {
        baseSpeed,
        gameSpeed,
        gravity,
        score: Math.floor(score),
        running,
        paused: isPaused,
        dinoX: dino.x,
        obstacleCount: obstacles.length,
        extraObstacles: computeExtraObstacles(gameSpeed)
      };
    }
  };

})();
