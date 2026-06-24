// ── Types ────────────────────────────────────────────────────────────────────

export interface ArkanoidCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface ArkanoidController {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export function initArkanoid(
  canvas: HTMLCanvasElement,
  callbacks: ArkanoidCallbacks,
): ArkanoidController {
  // ── LEVELS (inline from levels.js) ─────────────────────────────────────────

  const LEVELS = (() => {
    const rowColors1 = ['red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green'];
    const rowColors2 = [
      'gray',
      'cyan',
      'hotpink',
      'yellow',
      'magenta',
      'green',
    ];
    const rowColors4 = ['cyan', 'magenta', 'green', 'yellow', 'hotpink', 'red'];

    const l1: { col: number; row: number; color: string }[] = [];
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 10; col++)
        l1.push({ col, row, color: rowColors1[row] });

    const l2: { col: number; row: number; color: string }[] = [];
    const pyStart = [4, 3, 2, 1, 0, 0];
    const pyEnd = [5, 6, 7, 8, 9, 9];
    for (let row = 0; row < 6; row++)
      for (let col = pyStart[row]; col <= pyEnd[row]; col++)
        l2.push({ col, row, color: rowColors2[row] });

    const l3: { col: number; row: number; color: string }[] = [];
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 10; col++)
        if ((col + row) % 2 === 0)
          l3.push({ col, row, color: row < 3 ? 'yellow' : 'magenta' });

    const gaps4 = [
      [2, 5, 8],
      [0, 4, 7, 9],
      [1, 3, 6],
      [2, 5, 8, 9],
      [0, 4, 7],
      [1, 3, 6, 9],
    ];
    const l4: { col: number; row: number; color: string }[] = [];
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 10; col++)
        if (!gaps4[row].includes(col))
          l4.push({ col, row, color: rowColors4[row] });

    const l5: { col: number; row: number; color: string }[] = [];
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 10; col++) {
        const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
        const isCross = col === 4 || row === 2;
        if (isFrame || isCross)
          l5.push({
            col,
            row,
            color: isCross && !isFrame ? 'hotpink' : 'cyan',
          });
      }

    return [
      { speed: 1.0, blocks: l1 },
      { speed: 1.1, blocks: l2 },
      { speed: 1.21, blocks: l3 },
      { speed: 1.33, blocks: l4 },
      { speed: 1.46, blocks: l5 },
    ];
  })();

  // ── Spritesheet (inline from assets/spritesheet.js) ──────────────────────

  type Frame = { sx: number; sy: number; sw: number; sh: number };

  const EXPLOSION_FRAMES: Record<string, Frame[]> = {
    red: [
      { sx: 256, sy: 176, sw: 32, sh: 16 },
      { sx: 288, sy: 176, sw: 32, sh: 16 },
      { sx: 320, sy: 176, sw: 32, sh: 16 },
      { sx: 352, sy: 176, sw: 32, sh: 16 },
    ],
    cyan: [
      { sx: 256, sy: 192, sw: 32, sh: 16 },
      { sx: 288, sy: 192, sw: 32, sh: 16 },
      { sx: 320, sy: 192, sw: 32, sh: 16 },
      { sx: 352, sy: 192, sw: 32, sh: 16 },
    ],
    green: [
      { sx: 256, sy: 208, sw: 32, sh: 16 },
      { sx: 288, sy: 208, sw: 32, sh: 16 },
      { sx: 320, sy: 208, sw: 32, sh: 16 },
      { sx: 352, sy: 208, sw: 32, sh: 16 },
    ],
    magenta: [
      { sx: 256, sy: 224, sw: 32, sh: 16 },
      { sx: 288, sy: 224, sw: 32, sh: 16 },
      { sx: 320, sy: 224, sw: 32, sh: 16 },
      { sx: 352, sy: 224, sw: 32, sh: 16 },
    ],
    yellow: [
      { sx: 256, sy: 240, sw: 32, sh: 16 },
      { sx: 288, sy: 240, sw: 32, sh: 16 },
      { sx: 320, sy: 240, sw: 32, sh: 16 },
      { sx: 352, sy: 240, sw: 32, sh: 16 },
    ],
    hotpink: [
      { sx: 256, sy: 256, sw: 32, sh: 16 },
      { sx: 288, sy: 256, sw: 32, sh: 16 },
      { sx: 320, sy: 256, sw: 32, sh: 16 },
      { sx: 352, sy: 256, sw: 32, sh: 16 },
    ],
    gray: [
      { sx: 256, sy: 176, sw: 32, sh: 16 },
      { sx: 288, sy: 176, sw: 32, sh: 16 },
      { sx: 320, sy: 176, sw: 32, sh: 16 },
      { sx: 352, sy: 176, sw: 32, sh: 16 },
    ],
  };

  const EXPLOSION_DURATION = 150;

  const SPRITES: Record<string, Frame> = {
    paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
    ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  };
  const BLOCK_SPRITES: Record<string, Frame> = {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  };

  let ssImg: HTMLCanvasElement | null = null;
  let ssLoaded = false;
  const ssCallbacks: (() => void)[] = [];

  function loadSpritesheet(cb: () => void) {
    if (ssLoaded) {
      cb();
      return;
    }
    ssCallbacks.push(cb);
    if (ssImg) return;
    ssImg = document.createElement('canvas'); // placeholder to prevent double-load
    const rawImg = new Image();
    rawImg.onload = () => {
      const oc = document.createElement('canvas');
      oc.width = rawImg.width;
      oc.height = rawImg.height;
      const octx = oc.getContext('2d')!;
      octx.drawImage(rawImg, 0, 0);
      ssImg = oc;
      ssLoaded = true;
      ssCallbacks.forEach((f) => f());
    };
    rawImg.onerror = () => console.error('Failed to load spritesheet');
    rawImg.src = '/arkanoid/spritesheet-breakout.png';
  }

  function drawFrame(
    ctx: CanvasRenderingContext2D,
    frame: Frame,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    if (!ssLoaded || !ssImg) return;
    ctx.drawImage(ssImg, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
  }

  function drawSprite(
    ctx: CanvasRenderingContext2D,
    name: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    if (!ssLoaded || !ssImg) return;
    const sp = name.startsWith('block_')
      ? BLOCK_SPRITES[name.slice(6)]
      : SPRITES[name];
    if (!sp) return;
    ctx.drawImage(ssImg, sp.sx, sp.sy, sp.sw, sp.sh, x, y, w, h);
  }

  // ── Constants ────────────────────────────────────────────────────────────────

  const W = 800;
  const H = 600;

  const PADDLE_SPEED = 400;
  const BLOCK_COLS = 10;
  const BLOCK_W = 64;
  const BLOCK_H = 24;
  const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
  const BLOCKS_ORIGIN_Y = 80;
  const BASE_BALL_VX = 200;
  const BASE_BALL_VY = -300;

  const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight']);

  // ── Game state ───────────────────────────────────────────────────────────────

  const ctx = canvas.getContext('2d')!;

  const paddle = { x: 0, y: 560, w: 81, h: 14 };
  const ball = { x: 0, y: 0, w: 16, h: 16, vx: 200, vy: -300 };

  type Block = {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    alive: boolean;
  };
  type Explosion = {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    elapsed: number;
  };

  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let lives = 3;
  let score = 0;
  let gameState: 'playing' | 'gameover' | 'win' = 'playing';
  let currentLevel = 1;
  let paused = false;
  let lastTime: number | null = null;
  let rafId = 0;
  let destroyed = false;

  const keys: Record<string, boolean> = { ArrowLeft: false, ArrowRight: false };

  // ── Init helpers ─────────────────────────────────────────────────────────────

  function initPaddle() {
    paddle.x = (W - paddle.w) / 2;
  }

  function initBall() {
    const speed = LEVELS[currentLevel - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function loadLevel(n: number) {
    currentLevel = n;
    const level = LEVELS[n - 1];
    blocks = level.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * level.speed;
    ball.vy = BASE_BALL_VY * level.speed;
    callbacks.onLevelChange(currentLevel);
  }

  // ── Keyboard listeners ───────────────────────────────────────────────────────

  function onKeyDown(e: KeyboardEvent) {
    if (GAME_KEYS.has(e.key)) {
      e.preventDefault();
      keys[e.key] = true;
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.key in keys) keys[e.key] = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // ── Physics ──────────────────────────────────────────────────────────────────

  function collideAABB(block: Block) {
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }

  function update(dt: number) {
    if (gameState !== 'playing') return;

    if (keys.ArrowLeft) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (keys.ArrowRight)
      paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
    }

    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
    }

    for (const block of blocks) {
      if (!block.alive) continue;
      if (collideAABB(block)) {
        block.alive = false;
        explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        score += 10;
        ball.vy = -ball.vy;
        callbacks.onScoreChange(score);
        if (blocks.every((b) => !b.alive)) {
          if (currentLevel < 5) {
            loadLevel(currentLevel + 1);
          } else {
            gameState = 'win';
          }
        }
        break;
      }
    }

    for (const exp of explosions) exp.elapsed += dt * 1000;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    if (ball.y > H) {
      lives--;
      callbacks.onLivesChange(lives);
      if (lives <= 0) {
        lives = 0;
        gameState = 'gameover';
        callbacks.onGameOver(score);
      } else {
        initBall();
      }
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  function drawOverlay(message: string) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 64px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, W / 2, H / 2);
  }

  function drawPauseOverlay() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 56px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSA', W / 2, H / 2);
  }

  function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    for (const block of blocks)
      if (block.alive)
        drawSprite(
          ctx,
          'block_' + block.color,
          block.x,
          block.y,
          block.w,
          block.h,
        );

    for (const exp of explosions) {
      const frameIndex = Math.min(
        Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4),
        3,
      );
      drawFrame(
        ctx,
        EXPLOSION_FRAMES[exp.color][frameIndex],
        exp.x,
        exp.y,
        exp.w,
        exp.h,
      );
    }

    drawSprite(ctx, 'paddle', paddle.x, paddle.y, paddle.w, paddle.h);
    drawSprite(ctx, 'ball', ball.x, ball.y, ball.w, ball.h);

    if (gameState === 'gameover') drawOverlay('GAME OVER');
    if (gameState === 'win') drawOverlay('¡Completaste el juego!');
    if (paused) drawPauseOverlay();
  }

  // ── RAF loop ─────────────────────────────────────────────────────────────────

  function loop(timestamp: number) {
    if (destroyed) return;
    if (lastTime === null) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    if (!paused) update(dt);
    draw();

    if (gameState === 'playing' || paused) {
      rafId = requestAnimationFrame(loop);
    }
  }

  // ── Controller ───────────────────────────────────────────────────────────────

  const controller: ArkanoidController = {
    pause() {
      if (paused || gameState !== 'playing') return;
      paused = true;
      cancelAnimationFrame(rafId);
      draw(); // render pause overlay immediately
    },
    resume() {
      if (!paused || gameState !== 'playing') return;
      paused = false;
      lastTime = null;
      rafId = requestAnimationFrame(loop);
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    },
  };

  loadSpritesheet(() => {
    if (destroyed) return;
    initPaddle();
    loadLevel(1);
    callbacks.onScoreChange(0);
    callbacks.onLivesChange(3);
    rafId = requestAnimationFrame(loop);
  });

  return controller;
}
