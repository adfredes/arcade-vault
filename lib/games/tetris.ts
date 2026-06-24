export interface TetrisCallbacks {
  onScoreChange: (score: number) => void;
  onLinesChange: (lines: number) => void;
  onLevelChange: (level: number) => void;
  onPauseChange: (paused: boolean) => void; // la tecla P alterna pausa internamente
  onGameOver: (finalScore: number) => void;
}

export interface TetrisController {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

// nextCanvas es opcional: si se pasa, el módulo dibuja ahí la pieza siguiente
export function initTetris(
  canvas: HTMLCanvasElement,
  callbacks: TetrisCallbacks,
  nextCanvas?: HTMLCanvasElement,
): TetrisController {
  // ── Constantes ─────────────────────────────────────────────────────────────

  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 30; // canvas 300×600

  const COLORS = [
    null,
    '#4dd0e1', // I - cyan
    '#ffd54f', // O - yellow
    '#ba68c8', // T - purple
    '#81c784', // S - green
    '#e57373', // Z - red
    '#90caf9', // J - pale blue
    '#ffb74d', // L - orange
    '#9e9e9e', // N - tuerca (gris metálico)
  ];

  const PIECES: (number[][] | null)[] = [
    null,
    [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ], // I
    [
      [2, 2],
      [2, 2],
    ], // O
    [
      [0, 3, 0],
      [3, 3, 3],
      [0, 0, 0],
    ], // T
    [
      [0, 4, 4],
      [4, 4, 0],
      [0, 0, 0],
    ], // S
    [
      [5, 5, 0],
      [0, 5, 5],
      [0, 0, 0],
    ], // Z
    [
      [6, 0, 0],
      [6, 6, 6],
      [0, 0, 0],
    ], // J
    [
      [0, 0, 7],
      [7, 7, 7],
      [0, 0, 0],
    ], // L
    [
      [8, 8, 8],
      [8, 0, 8],
      [8, 8, 8],
    ], // N (tuerca)
  ];

  const LINE_SCORES = [0, 100, 300, 500, 800];

  // ── Contextos ──────────────────────────────────────────────────────────────

  const ctx = canvas.getContext('2d')!;
  const nextCtx = nextCanvas ? nextCanvas.getContext('2d') : null;

  // ── Tipos / estado del juego (closure, no globales) ──────────────────────────

  interface Piece {
    type: number;
    shape: number[][];
    x: number;
    y: number;
  }

  let board: number[][];
  let current: Piece;
  let next: Piece;
  let score: number;
  let lines: number;
  let level: number;
  let paused: boolean;
  let gameOver: boolean;
  let lastTime: number;
  let dropAccum: number;
  let dropInterval: number;
  let animId = 0;

  // valores previos para emitir callbacks sólo cuando cambian
  let prevScore = -1;
  let prevLines = -1;
  let prevLevel = -1;

  function syncHUD() {
    if (score !== prevScore) {
      prevScore = score;
      callbacks.onScoreChange(score);
    }
    if (lines !== prevLines) {
      prevLines = lines;
      callbacks.onLinesChange(lines);
    }
    if (level !== prevLevel) {
      prevLevel = level;
      callbacks.onLevelChange(level);
    }
  }

  // ── Lógica del juego ─────────────────────────────────────────────────────────

  function createBoard(): number[][] {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  function randomPiece(): Piece {
    const type = Math.floor(Math.random() * 8) + 1;
    const shape = PIECES[type]!.map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }

  function collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateCW(shape: number[][]): number[][] {
    const rows = shape.length,
      cols = shape[0].length;
    const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
    return result;
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
      syncHUD();
    }
  }

  function ghostY(): number {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
      syncHUD();
    } else {
      lockPiece();
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) {
      endGame();
    }
    drawNext();
  }

  // ── Dibujo ───────────────────────────────────────────────────────────────────

  function drawBlock(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha?: number,
  ) {
    if (!colorIndex) return;
    const color = COLORS[colorIndex]!;
    context.globalAlpha = alpha ?? 1;
    context.fillStyle = color;
    context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    // highlight
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    context.globalAlpha = 1;
  }

  function drawGrid() {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(COLS * BLOCK, r * BLOCK);
      ctx.stroke();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    // board
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) drawBlock(ctx, c, r, board[r][c], BLOCK);

    // ghost
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(
            ctx,
            current.x + c,
            gy + r,
            current.shape[r][c],
            BLOCK,
            0.2,
          );

    // current piece
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(
            ctx,
            current.x + c,
            current.y + r,
            current.shape[r][c],
            BLOCK,
          );
  }

  function drawNext() {
    if (!nextCtx || !nextCanvas) return;
    const NB = 30;
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
  }

  // ── Fin de juego / pausa ─────────────────────────────────────────────────────

  function endGame() {
    gameOver = true;
    cancelAnimationFrame(animId);
    callbacks.onGameOver(score);
  }

  function doPause() {
    if (gameOver || paused) return;
    paused = true;
    cancelAnimationFrame(animId);
  }

  function doResume() {
    if (gameOver || !paused) return;
    paused = false;
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  }

  // la tecla P alterna la pausa internamente y notifica a React
  function togglePause() {
    if (gameOver) return;
    if (paused) doResume();
    else doPause();
    callbacks.onPauseChange(paused);
  }

  // ── Loop ─────────────────────────────────────────────────────────────────────

  function loop(ts: number) {
    let dt = ts - lastTime;
    lastTime = ts;
    dt = Math.min(dt, 100); // clamp: evita saltos tras pausa/pestaña oculta
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
    if (gameOver) return;
    draw();
    animId = requestAnimationFrame(loop);
  }

  // ── Input ─────────────────────────────────────────────────────────────────────

  const GAME_KEYS = new Set([
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Space',
  ]);

  function onKeyDown(e: KeyboardEvent) {
    if (e.code === 'KeyP') {
      togglePause();
      return;
    }
    if (GAME_KEYS.has(e.code)) e.preventDefault(); // evita scroll de página
    if (paused || gameOver) return;
    switch (e.code) {
      case 'ArrowLeft':
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case 'ArrowRight':
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case 'ArrowDown':
        softDrop();
        break;
      case 'ArrowUp':
      case 'KeyX':
        tryRotate();
        break;
      case 'Space':
        hardDrop();
        break;
    }
    syncHUD();
  }

  window.addEventListener('keydown', onKeyDown);

  // ── Init ──────────────────────────────────────────────────────────────────────

  function init() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    paused = false;
    gameOver = false;
    dropInterval = 1000;
    dropAccum = 0;
    next = randomPiece();
    spawn();
    syncHUD();
    lastTime = performance.now();
    cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
  }

  init();

  return {
    pause() {
      doPause();
    },
    resume() {
      doResume();
    },
    destroy() {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', onKeyDown);
    },
  };
}
