// game.js — Dino clone logic (separate file)
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  // use canvas width/height attributes for crisp coordinates
  const W = canvas.width;
  const H = canvas.height;
  const scoreEl = document.getElementById('score');
  const speedEl = document.getElementById('speed');
  const godStateEl = document.getElementById('godState');
  const restartBtn = document.getElementById('restartBtn');

  // ----- Game settings -----
  let gameSpeed = 6;
  let spawnInterval = 90; // frames between obstacles at start
  let gravity = 0.8;
  let frame = 0;
  let score = 0;
  let running = true;

  // SAFE: local toggle to simulate "invincible"
  let godMode = false;

  // ---- Entities ----
  const groundY = H - 40;
  const dino = {
    x: 40,
    y: groundY - 40,
    w: 40,
    h: 40,
    vy: 0,
    jumpForce: -14,
    grounded: true,
    draw() {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--dino').trim() || '#222';
      roundRect(ctx, this.x, this.y, this.w, this.h, 6);
      // eye
      ctx.fillStyle = '#fff';
      ctx.fillRect(this.x + 28, this.y + 10, 6, 6);
    },
    update() {
      this.vy += gravity;
      this.y += this.vy;
      if (this.y + this.h >= groundY) {
        this.y = groundY - this.h;
        this.vy = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
    },
    jump() {
      if (this.grounded) {
        this.vy = this.jumpForce;
        this.grounded = false;
      }
    }
  };

  class Obstacle {
    constructor(speed) {
      this.w = (Math.random() > 0.6) ? 30 + Math.floor(Math.random()*30) : 20 + Math.floor(Math.random()*15);
      this.h = 20 + Math.floor(Math.random()*30);
      this.x = W + 20;
      this.y = groundY - this.h;
      this.speed = speed;
    }
    update() {
      this.x -= this.speed;
    }
    draw() {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--obstacle').trim() || '#333';
      roundRect(ctx, this.x, this.y, this.w, this.h, 4);
    }
    offscreen() {
      return this.x + this.w < 0;
    }
  }

  const obstacles = [];

  // Utility: rounded rectangle
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

  // Collision check (AABB)
  function collides(a, b) {
    return a.x < b.x + b.w &&
           a.x + a.w > b.x &&
           a.y < b.y + b.h &&
           a.y + a.h > b.y;
  }

  // Reset game
  function resetGame() {
    obstacles.length = 0;
    gameSpeed = 6;
    spawnInterval = 90;
    frame = 0;
    score = 0;
    running = true;
    dino.y = groundY - dino.h;
    dino.vy = 0;
    godMode = false;
    updateHUD();
  }

  function updateHUD() {
    scoreEl.textContent = Math.floor(score);
    speedEl.textContent = Math.floor(gameSpeed);
    godStateEl.textContent = godMode ? 'ON' : 'OFF';
    document.getElementById('godBadge').style.border = godMode ? '2px solid #4caf50' : '1px solid #ddd';
  }

  // Input
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      dino.jump();
      e.preventDefault();
    } else if (e.key.toLowerCase() === 'g') {
      godMode = !godMode;
      updateHUD();
    } else if (e.key.toLowerCase() === 'p') {
      running = !running; // pause/unpause
    }
  });

  restartBtn.addEventListener('click', () => resetGame());

  // Game Loop
  function loop() {
    if (running) {
      frame++;
      // spawn obstacles
      if (frame % Math.max(20, Math.floor(spawnInterval)) === 0) {
        obstacles.push(new Obstacle(gameSpeed + Math.random()*2));
      }

      // increase difficulty gradually
      if (frame % 300 === 0) {
        gameSpeed += 0.6;
        spawnInterval = Math.max(40, spawnInterval - 4);
      }

      // update
      dino.update();
      obstacles.forEach(o => o.update());
      // remove offscreen
      for (let i = obstacles.length - 1; i >= 0; i--) {
        if (obstacles[i].offscreen()) obstacles.splice(i,1);
      }

      // score increases with time and speed
      score += 0.1 * gameSpeed;

      // collision detection (skip if godMode)
      if (!godMode) {
        for (let o of obstacles) {
          if (collides(dino, o)) {
            running = false;
            flashGame();
          }
        }
      }

      // render
      draw();
      updateHUD();
    } else {
      draw(true);
    }

    requestAnimationFrame(loop);
  }

  function draw(gameOver=false) {
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ground').trim() || '#666';
    ctx.fillRect(0, groundY, W, H - groundY);
    obstacles.forEach(o => o.draw());
    dino.draw();
    if (gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(W/2 - 160, H/2 - 40, 320, 80);
      ctx.fillStyle = '#fff';
      ctx.font = '18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over — Press Restart to play again', W/2, H/2 + 6);
      ctx.textAlign = 'start';
    }
    if (godMode) {
      ctx.fillStyle = '#4caf50';
      ctx.beginPath();
      ctx.arc(W - 30, 30, 12, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('G', W - 30, 35);
      ctx.textAlign = 'start';
    }
  }

  function flashGame() {
    const original = canvas.style.boxShadow;
    canvas.style.boxShadow = '0 0 0 6px rgba(255,0,0,0.15)';
    setTimeout(() => canvas.style.boxShadow = original, 300);
  }

  // Start
  resetGame();
  loop();

  // Expose safe API
  window.DINO_CLONE = {
    setGodMode(v) { godMode = !!v; updateHUD(); },
    toggleGodMode() { godMode = !godMode; updateHUD(); },
    setSpeed(v) { gameSpeed = Number(v); updateHUD(); },
    setGravity(v) { gravity = Number(v); },
    addObstacle() { obstacles.push(new Obstacle(gameSpeed)); },
    getState() { return { gameSpeed, spawnInterval, gravity, godMode, score: Math.floor(score) }; }
  };

})();
