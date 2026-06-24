// ── Types ────────────────────────────────────────────────────────────────────

export interface SnakeCallbacks {
  onScoreChange: (score: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface SnakeController {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export function initSnake(
  canvas: HTMLCanvasElement,
  callbacks: SnakeCallbacks,
): SnakeController {
  // ── Sprite atlas (inline from references/source-assets/snake-assets/sprites.js) ──
  // Recorte { x, y, w, h } dentro de /snake/fruits.png (hoja 3790×442, fondo transparente).

  type FruitRect = { x: number; y: number; w: number; h: number };

  const FRUITS: Record<string, FruitRect> = {
    banana: { x: 34, y: 136, w: 110, h: 160 },
    orange: { x: 186, y: 136, w: 150, h: 160 },
    grape: { x: 378, y: 136, w: 110, h: 160 },
    garlic: { x: 540, y: 136, w: 130, h: 160 },
    eggplant: { x: 712, y: 136, w: 130, h: 160 },
    strawberry: { x: 894, y: 136, w: 110, h: 160 },
    cherry: { x: 1066, y: 136, w: 110, h: 160 },
    carrot: { x: 1228, y: 136, w: 130, h: 160 },
    mushroom: { x: 1400, y: 136, w: 130, h: 160 },
    broccoli: { x: 1582, y: 136, w: 110, h: 160 },
    watermelon: { x: 1734, y: 136, w: 150, h: 160 },
    pepper: { x: 1906, y: 136, w: 150, h: 160 },
    kiwi: { x: 2068, y: 136, w: 170, h: 160 },
    lemon: { x: 2250, y: 136, w: 140, h: 160 },
    peach: { x: 2432, y: 136, w: 130, h: 160 },
    peanut: { x: 2604, y: 136, w: 130, h: 160 },
    apple: { x: 2786, y: 136, w: 110, h: 160 },
    tomato: { x: 2948, y: 136, w: 130, h: 160 },
    berries: { x: 3110, y: 136, w: 150, h: 160 },
    grapes2: { x: 3302, y: 136, w: 110, h: 160 },
    pineapple: { x: 3454, y: 136, w: 150, h: 160 },
    melon: { x: 3637, y: 136, w: 130, h: 160 },
  };

  const FRUIT_NAMES = Object.keys(FRUITS);

  // ── Constants ────────────────────────────────────────────────────────────────

  const W = 800;
  const H = 800;
  const CELL = 20;
  const COLS = 40;
  const ROWS = 40;

  const GAME_KEYS = new Set([
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
  ]);

  const DIRS: Record<string, { x: number; y: number }> = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
  };

  // ── Game state (closure variables) ─────────────────────────────────────────

  type Cell = { x: number; y: number };

  const ctx = canvas.getContext('2d')!;

  let body: Cell[] = [];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let food: { x: number; y: number; fruit: string } = {
    x: 0,
    y: 0,
    fruit: 'apple',
  };
  let score = 0;
  let fruitsEaten = 0;
  let speed = 8; // celdas por segundo
  let accum = 0;
  let paused = false;
  let dead = false;

  let lastTime: number | null = null;
  let rafId = 0;
  let destroyed = false;
  let imgLoaded = false;

  const img = new Image();

  // ── Init / helpers ─────────────────────────────────────────────────────────

  function init() {
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    body = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0;
    fruitsEaten = 0;
    speed = 8;
    accum = 0;
    paused = false;
    dead = false;
    spawnFood();
  }

  function spawnFood() {
    const free: Cell[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!body.some((c) => c.x === x && c.y === y)) free.push({ x, y });
      }
    }
    const cell = free[Math.floor(Math.random() * free.length)];
    const fruit = FRUIT_NAMES[Math.floor(Math.random() * FRUIT_NAMES.length)];
    food = { x: cell.x, y: cell.y, fruit };
  }

  function die() {
    dead = true;
    callbacks.onGameOver(score);
  }

  // ── Tick (un paso lógico) ──────────────────────────────────────────────────

  function tick() {
    dir = nextDir;
    const head = body[0];
    const newHead = { x: head.x + dir.x, y: head.y + dir.y };

    // Colisión con pared
    if (
      newHead.x < 0 ||
      newHead.x >= COLS ||
      newHead.y < 0 ||
      newHead.y >= ROWS
    ) {
      die();
      return;
    }

    const ateFood = newHead.x === food.x && newHead.y === food.y;

    // Colisión con el propio cuerpo. Si no come, la cola se libera este tick.
    const occupied = ateFood ? body : body.slice(0, body.length - 1);
    if (occupied.some((c) => c.x === newHead.x && c.y === newHead.y)) {
      die();
      return;
    }

    body.unshift(newHead);

    if (ateFood) {
      score += 10;
      fruitsEaten += 1;
      callbacks.onScoreChange(score);
      if (fruitsEaten % 5 === 0) speed += 0.5;
      spawnFood();
    } else {
      body.pop();
    }
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────

  function onKeyDown(e: KeyboardEvent) {
    if (!GAME_KEYS.has(e.key)) return;
    e.preventDefault();
    const nd = DIRS[e.key];
    // Ignorar reversión de 180° respecto a la dirección comprometida
    if (nd.x === -dir.x && nd.y === -dir.y) return;
    nextDir = nd;
  }

  window.addEventListener('keydown', onKeyDown);

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

  function draw() {
    // Fondo
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, W, H);

    // Grilla sutil
    ctx.strokeStyle = 'rgba(46, 194, 126, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, H);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(W, y * CELL);
      ctx.stroke();
    }

    // Comida (sprite de fruta encajado en la celda, preservando proporción)
    if (imgLoaded) {
      const f = FRUITS[food.fruit];
      const scale = Math.min(CELL / f.w, CELL / f.h);
      const dw = f.w * scale;
      const dh = f.h * scale;
      const dx = food.x * CELL + (CELL - dw) / 2;
      const dy = food.y * CELL + (CELL - dh) / 2;
      ctx.drawImage(img, f.x, f.y, f.w, f.h, dx, dy, dw, dh);
    }

    // Serpiente
    body.forEach((c, i) => {
      ctx.fillStyle = i === 0 ? '#aef6c8' : '#2ec27e';
      ctx.fillRect(c.x * CELL + 1, c.y * CELL + 1, CELL - 2, CELL - 2);
    });

    if (paused) drawOverlay('PAUSA');
    if (dead) drawOverlay('GAME OVER');
  }

  // ── RAF loop ─────────────────────────────────────────────────────────────────

  function loop(timestamp: number) {
    if (destroyed) return;
    if (lastTime === null) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    if (!paused && !dead) {
      accum += dt;
      const tickInterval = 1 / speed;
      if (accum >= tickInterval) {
        tick();
        accum = 0;
      }
    }

    draw();

    if (!dead) {
      rafId = requestAnimationFrame(loop);
    }
  }

  // ── Controller ───────────────────────────────────────────────────────────────

  const controller: SnakeController = {
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
      lastTime = null;
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
    },
  };

  // ── Arranque (loop dentro del onload de la imagen) ─────────────────────────

  img.onload = () => {
    if (destroyed) return;
    imgLoaded = true;
    init();
    callbacks.onScoreChange(0);
    rafId = requestAnimationFrame(loop);
  };
  img.onerror = () => console.error('Failed to load /snake/fruits.png');
  img.src = '/snake/fruits.png';

  return controller;
}
