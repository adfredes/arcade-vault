import { DEFAULT_SKIN, FROGGER_SKINS, type SkinId } from '@/lib/games/skins';

// ===== Interfaces exportadas =====

export interface FroggerCallbacks {
  onScoreChange(score: number): void;
  onLivesChange(lives: number): void;
  onLevelChange(level: number): void;
  onGameOver(finalScore: number): void;
}

export interface FroggerController {
  pause(): void;
  resume(): void;
  destroy(): void;
  setSkin(id: SkinId): void;
}

// ===== Constantes de cuadrícula =====

const COLS = 16;
const ROWS = 14;
const CELL = 40;
const CANVAS_W = COLS * CELL;
const CANVAS_H = ROWS * CELL;

const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;

// ===== Parámetros de juego =====

const START_LIVES = 3;
const HOP_MS = 120;
const ROUND_TIME_MS = 15000;
const NUM_GOALS = 5;
const CENTER_COL = Math.floor(COLS / 2);

const goalStartCol = (i: number) => 1 + i * 3;

// ===== Tipos locales =====

type Direction = 'up' | 'down' | 'left' | 'right';

interface Lane {
  row: number;
  speed: number;
  dir: 1 | -1;
  entities: Entity[];
}

interface Entity {
  col: number;
  width: number;
  type: 'car' | 'truck' | 'log' | 'turtle';
  submerged?: boolean;
  diveT?: number;
  diveCycle?: number;
}

interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  targetCol: number;
  targetRow: number;
}

interface GameState {
  frog: Frog;
  lanes: Lane[];
  goals: boolean[];
  lives: number;
  score: number;
  level: number;
  timeLeft: number;
  roundTime: number;
  topRowThisLife: number;
  pendingDir: Direction | null;
  gameOver: boolean;
  prevScore: number;
  prevLives: number;
  prevLevel: number;
}

// ===== Construcción de carriles =====

function buildRoadEntities(kind: 'car' | 'truck', laneIdx: number): Entity[] {
  const count = 3;
  const width = kind === 'truck' ? 2 + (laneIdx % 2) : 1;
  const spacing = COLS / count;
  const entities: Entity[] = [];
  for (let i = 0; i < count; i++) {
    entities.push({ col: i * spacing + (laneIdx % 2), width, type: kind });
  }
  return entities;
}

function buildRiverEntities(kind: 'log' | 'turtle', laneIdx: number): Entity[] {
  const count = 3;
  const spacing = COLS / count;
  const entities: Entity[] = [];
  for (let i = 0; i < count; i++) {
    if (kind === 'log') {
      entities.push({ col: i * spacing, width: 2 + (i % 3), type: 'log' });
    } else {
      entities.push({
        col: i * spacing,
        width: 2 + (laneIdx % 2),
        type: 'turtle',
        diveCycle: 4500,
        diveT: (i * 1500) % 4500,
        submerged: false,
      });
    }
  }
  return entities;
}

function buildLanes(level: number): Lane[] {
  const mult = Math.pow(1.15, level - 1);
  const lanes: Lane[] = [];

  const roadConfigs: { speed: number; dir: 1 | -1; kind: 'car' | 'truck' }[] = [
    { speed: 0.024, dir: 1, kind: 'car' },
    { speed: 0.036, dir: -1, kind: 'truck' },
    { speed: 0.03, dir: 1, kind: 'car' },
    { speed: 0.045, dir: -1, kind: 'car' },
    { speed: 0.027, dir: 1, kind: 'truck' },
  ];
  roadConfigs.forEach((cfg, i) => {
    lanes.push({
      row: ROW_ROAD_TOP + i,
      speed: cfg.speed * mult,
      dir: cfg.dir,
      entities: buildRoadEntities(cfg.kind, i),
    });
  });

  const riverConfigs: { speed: number; dir: 1 | -1; kind: 'log' | 'turtle' }[] =
    [
      { speed: 0.03, dir: -1, kind: 'turtle' },
      { speed: 0.022, dir: 1, kind: 'log' },
      { speed: 0.036, dir: -1, kind: 'log' },
      { speed: 0.018, dir: 1, kind: 'turtle' },
      { speed: 0.028, dir: -1, kind: 'log' },
      { speed: 0.024, dir: 1, kind: 'log' },
    ];
  riverConfigs.forEach((cfg, i) => {
    lanes.push({
      row: ROW_RIVER_TOP + i,
      speed: cfg.speed * mult,
      dir: cfg.dir,
      entities: buildRiverEntities(cfg.kind, i),
    });
  });

  return lanes;
}

function roundTimeForLevel(level: number): number {
  return Math.max(6000, ROUND_TIME_MS - (level - 1) * 1500);
}

function freshFrog(): Frog {
  return {
    col: CENTER_COL,
    row: ROW_START,
    animating: false,
    animT: 0,
    targetCol: CENTER_COL,
    targetRow: ROW_START,
  };
}

function createState(): GameState {
  return {
    frog: freshFrog(),
    lanes: buildLanes(1),
    goals: new Array(NUM_GOALS).fill(false),
    lives: START_LIVES,
    score: 0,
    level: 1,
    timeLeft: ROUND_TIME_MS,
    roundTime: ROUND_TIME_MS,
    topRowThisLife: ROW_START,
    pendingDir: null,
    gameOver: false,
    prevScore: 0,
    prevLives: START_LIVES,
    prevLevel: 1,
  };
}

// ===== initFrogger =====

export function initFrogger(
  canvas: HTMLCanvasElement,
  callbacks: FroggerCallbacks,
  initialSkin: SkinId = DEFAULT_SKIN,
): FroggerController {
  const ctx = canvas.getContext('2d')!;

  let palette = FROGGER_SKINS[initialSkin];
  let paused = false;

  const setGlow = (color: string) => {
    ctx.shadowBlur = palette.glow;
    ctx.shadowColor = palette.glow ? color : 'transparent';
  };
  const clearGlow = () => {
    ctx.shadowBlur = 0;
  };

  const s = createState();

  // ---------- Helpers ----------

  const laneAt = (row: number): Lane | undefined =>
    s.lanes.find((l) => l.row === row);
  const isRiverRow = (row: number) =>
    row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT;
  const isRoadRow = (row: number) => row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT;

  const getSupport = (): Entity | null => {
    const lane = laneAt(s.frog.row);
    if (!lane) return null;
    const center = s.frog.col + 0.5;
    for (const e of lane.entities) {
      if (e.type === 'turtle' && e.submerged) continue;
      if (center >= e.col && center < e.col + e.width) return e;
    }
    return null;
  };

  const checkRoadCollision = (): boolean => {
    const lane = laneAt(s.frog.row);
    if (!lane) return false;
    const center = s.frog.col + 0.5;
    for (const e of lane.entities) {
      if (center >= e.col && center < e.col + e.width) return true;
    }
    return false;
  };

  const respawnFrog = () => {
    s.frog = freshFrog();
    s.topRowThisLife = ROW_START;
  };

  const resetTimer = () => {
    s.timeLeft = s.roundTime;
  };

  const emitLives = (lives: number) => {
    if (lives !== s.prevLives) {
      s.prevLives = lives;
      callbacks.onLivesChange(lives);
    }
  };

  const completeRound = () => {
    s.score += 200;
    s.level += 1;
    s.goals = new Array(NUM_GOALS).fill(false);
    s.lanes = buildLanes(s.level);
    s.roundTime = roundTimeForLevel(s.level);
    respawnFrog();
    resetTimer();
  };

  const killFrog = () => {
    const lives = s.lives - 1;
    s.lives = lives;
    emitLives(lives);
    if (lives <= 0) {
      s.lives = 0;
      emitLives(0);
      s.gameOver = true;
      callbacks.onGameOver(s.score);
      return;
    }
    respawnFrog();
    resetTimer();
  };

  const checkGoal = () => {
    const fc = Math.round(s.frog.col);
    let slot = -1;
    for (let i = 0; i < NUM_GOALS; i++) {
      const start = goalStartCol(i);
      if (fc === start || fc === start + 1) {
        slot = i;
        break;
      }
    }
    if (slot === -1 || s.goals[slot]) {
      killFrog();
      return;
    }
    s.goals[slot] = true;
    s.score += 50;
    s.score += Math.floor(s.timeLeft / 1000) * 10;
    if (s.goals.every(Boolean)) {
      completeRound();
    } else {
      respawnFrog();
      resetTimer();
    }
  };

  const resolveLanding = () => {
    const r = s.frog.row;
    if (r === ROW_GOALS) {
      checkGoal();
      return;
    }
    if (isRiverRow(r)) {
      if (!getSupport()) killFrog();
      return;
    }
    if (isRoadRow(r)) {
      if (checkRoadCollision()) killFrog();
      return;
    }
  };

  const startHop = (dir: Direction) => {
    let tc = Math.round(s.frog.col);
    let tr = s.frog.row;
    if (dir === 'up') tr -= 1;
    else if (dir === 'down') tr += 1;
    else if (dir === 'left') tc -= 1;
    else if (dir === 'right') tc += 1;

    if (tc < 0 || tc > COLS - 1) return;
    if (tr < ROW_GOALS) tr = ROW_GOALS;
    if (tr > ROW_START) tr = ROW_START;

    s.frog.targetCol = tc;
    s.frog.targetRow = tr;
    s.frog.animating = true;
    s.frog.animT = 0;

    if (tr < s.topRowThisLife) {
      s.score += 10 * (s.topRowThisLife - tr);
      s.topRowThisLife = tr;
    }
  };

  const emitChanges = () => {
    if (s.score !== s.prevScore) {
      s.prevScore = s.score;
      callbacks.onScoreChange(s.score);
    }
    if (s.lives !== s.prevLives) {
      s.prevLives = s.lives;
      callbacks.onLivesChange(s.lives);
    }
    if (s.level !== s.prevLevel) {
      s.prevLevel = s.level;
      callbacks.onLevelChange(s.level);
    }
  };

  // ---------- Update ----------

  const update = (dt: number) => {
    for (const lane of s.lanes) {
      for (const e of lane.entities) {
        e.col += lane.speed * lane.dir * (dt / 16);
        if (lane.dir === 1 && e.col >= COLS) e.col = -e.width;
        else if (lane.dir === -1 && e.col + e.width <= 0) e.col = COLS;
        if (e.type === 'turtle') {
          e.diveT = ((e.diveT ?? 0) + dt) % (e.diveCycle ?? 4500);
          e.submerged = e.diveT >= 3000;
        }
      }
    }

    if (s.frog.animating) {
      s.frog.animT += dt;
      if (s.frog.animT >= HOP_MS) {
        s.frog.col = s.frog.targetCol;
        s.frog.row = s.frog.targetRow;
        s.frog.animating = false;
        s.frog.animT = 0;
        resolveLanding();
      }
    } else if (s.pendingDir) {
      const dir = s.pendingDir;
      s.pendingDir = null;
      startHop(dir);
    } else {
      if (isRiverRow(s.frog.row)) {
        const support = getSupport();
        if (!support) {
          killFrog();
        } else {
          const lane = laneAt(s.frog.row)!;
          s.frog.col += lane.speed * lane.dir * (dt / 16);
          if (s.frog.col < 0 || s.frog.col + 1 > COLS) killFrog();
        }
      } else if (isRoadRow(s.frog.row)) {
        if (checkRoadCollision()) killFrog();
      }
    }

    if (s.gameOver) return;

    s.timeLeft -= dt;
    if (s.timeLeft <= 0) {
      s.timeLeft = 0;
      killFrog();
    }

    emitChanges();
  };

  // ---------- Draw ----------

  const px = (col: number) => col * CELL;

  function roundRect(x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  const drawCar = (e: Entity, y: number, color: string) => {
    const x = px(e.col);
    const w = e.width * CELL;
    setGlow(color);
    ctx.fillStyle = color;
    roundRect(x + 3, y + 7, w - 6, CELL - 14, 6);
    ctx.fill();
    clearGlow();
    ctx.fillStyle = palette.windshield;
    roundRect(x + w - 16, y + 11, 8, CELL - 22, 3);
    ctx.fill();
    ctx.fillStyle = palette.wheel;
    ctx.fillRect(x + 6, y + 4, 8, 4);
    ctx.fillRect(x + 6, y + CELL - 8, 8, 4);
    ctx.fillRect(x + w - 14, y + 4, 8, 4);
    ctx.fillRect(x + w - 14, y + CELL - 8, 8, 4);
  };

  const drawTruck = (e: Entity, y: number) => {
    const x = px(e.col);
    const w = e.width * CELL;
    setGlow(palette.truckTrailer);
    ctx.fillStyle = palette.truckTrailer;
    roundRect(x + 3, y + 6, w - 6, CELL - 12, 4);
    ctx.fill();
    setGlow(palette.truckCab);
    ctx.fillStyle = palette.truckCab;
    roundRect(x + w - CELL + 4, y + 6, CELL - 8, CELL - 12, 4);
    ctx.fill();
    clearGlow();
    ctx.fillStyle = palette.wheel;
    for (let wx = x + 8; wx < x + w - 8; wx += 14) {
      ctx.fillRect(wx, y + CELL - 8, 8, 4);
      ctx.fillRect(wx, y + 4, 8, 4);
    }
  };

  const drawLog = (e: Entity, y: number) => {
    const x = px(e.col);
    const w = e.width * CELL;
    setGlow(palette.log);
    ctx.fillStyle = palette.log;
    roundRect(x + 1, y + 6, w - 2, CELL - 12, 8);
    ctx.fill();
    clearGlow();
    ctx.strokeStyle = palette.logGrain;
    ctx.lineWidth = 2;
    for (let i = 1; i < e.width; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * CELL, y + 8);
      ctx.lineTo(x + i * CELL, y + CELL - 8);
      ctx.stroke();
    }
    ctx.fillStyle = palette.logRing;
    ctx.beginPath();
    ctx.ellipse(x + 6, y + CELL / 2, 4, CELL / 2 - 8, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawTurtles = (e: Entity, y: number) => {
    const x = px(e.col);
    for (let i = 0; i < e.width; i++) {
      const cx = x + i * CELL + CELL / 2;
      const cy = y + CELL / 2;
      if (e.submerged) {
        ctx.strokeStyle = palette.turtleSubmerged;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, CELL / 2 - 7, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        setGlow(palette.turtleBody);
        ctx.fillStyle = palette.turtleBody;
        ctx.beginPath();
        ctx.arc(cx, cy, CELL / 2 - 5, 0, Math.PI * 2);
        ctx.fill();
        clearGlow();
        ctx.fillStyle = palette.turtleShell;
        ctx.beginPath();
        ctx.arc(cx, cy, CELL / 2 - 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = palette.turtleBody;
        ctx.beginPath();
        ctx.arc(cx + (e.col < COLS / 2 ? 9 : -9), cy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const drawFrog = (x: number, y: number) => {
    const cx = x + CELL / 2;
    const cy = y + CELL / 2;
    setGlow(palette.frogBody);
    ctx.fillStyle = palette.frogBody;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.frogLegs;
    const spread = s.frog.animating ? 8 : 4;
    ctx.fillRect(x + 2, y + 6 - (s.frog.animating ? 2 : 0), 6, 5);
    ctx.fillRect(x + CELL - 8, y + 6 - (s.frog.animating ? 2 : 0), 6, 5);
    ctx.fillRect(x + 2, y + CELL - 12 + (s.frog.animating ? spread : 0), 6, 5);
    ctx.fillRect(
      x + CELL - 8,
      y + CELL - 12 + (s.frog.animating ? spread : 0),
      6,
      5,
    );
    clearGlow();
    ctx.fillStyle = palette.frogEye;
    ctx.beginPath();
    ctx.arc(cx - 6, cy - 7, 4, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - 7, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.frogPupil;
    ctx.beginPath();
    ctx.arc(cx - 6, cy - 7, 2, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - 7, 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawGoalFrog = (x: number, y: number) => {
    const cx = x + CELL / 2;
    const cy = y + CELL / 2;
    setGlow(palette.goalFrog);
    ctx.fillStyle = palette.goalFrog;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 9, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    clearGlow();
  };

  const draw = () => {
    ctx.shadowBlur = 0;
    ctx.fillStyle = palette.goalsRow;
    ctx.fillRect(0, ROW_GOALS * CELL, CANVAS_W, CELL);
    ctx.fillStyle = palette.river;
    ctx.fillRect(
      0,
      ROW_RIVER_TOP * CELL,
      CANVAS_W,
      (ROW_RIVER_BOT - ROW_RIVER_TOP + 1) * CELL,
    );
    ctx.fillStyle = palette.safe;
    ctx.fillRect(0, ROW_SAFE_MID * CELL, CANVAS_W, CELL);
    ctx.fillStyle = palette.road;
    ctx.fillRect(
      0,
      ROW_ROAD_TOP * CELL,
      CANVAS_W,
      (ROW_ROAD_BOT - ROW_ROAD_TOP + 1) * CELL,
    );
    ctx.strokeStyle = palette.laneLine;
    ctx.lineWidth = 1;
    ctx.setLineDash([10, 12]);
    for (let r = ROW_ROAD_TOP; r <= ROW_ROAD_BOT + 1; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(CANVAS_W, r * CELL);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = palette.safe;
    ctx.fillRect(0, ROW_START * CELL, CANVAS_W, CELL);

    for (let i = 0; i < NUM_GOALS; i++) {
      const x = goalStartCol(i) * CELL;
      const w = 2 * CELL;
      const y = ROW_GOALS * CELL;
      ctx.fillStyle = palette.goalMouth;
      ctx.fillRect(x, y, w, CELL);
      setGlow(palette.goalBorder);
      ctx.strokeStyle = palette.goalBorder;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, w - 4, CELL - 4);
      clearGlow();
      if (s.goals[i]) drawGoalFrog(x + CELL / 2, y);
    }

    const carColors = palette.cars;
    for (const lane of s.lanes) {
      const y = lane.row * CELL;
      lane.entities.forEach((e, idx) => {
        switch (e.type) {
          case 'car':
            drawCar(e, y, carColors[(lane.row + idx) % carColors.length]);
            break;
          case 'truck':
            drawTruck(e, y);
            break;
          case 'log':
            drawLog(e, y);
            break;
          case 'turtle':
            drawTurtles(e, y);
            break;
        }
      });
    }

    let fx = px(s.frog.col);
    let fy = s.frog.row * CELL;
    if (s.frog.animating) {
      const t = Math.min(1, s.frog.animT / HOP_MS);
      fx = px(s.frog.col + (s.frog.targetCol - s.frog.col) * t);
      fy =
        (s.frog.row + (s.frog.targetRow - s.frog.row) * t) * CELL -
        Math.sin(t * Math.PI) * CELL * 0.3;
    }
    drawFrog(fx, fy);

    ctx.fillStyle = palette.hudScore;
    ctx.font = 'bold 16px monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(`${s.score}`, 8, 6);
    ctx.textAlign = 'center';
    ctx.fillStyle = palette.hudLevel;
    ctx.fillText(`NIVEL ${s.level}`, CANVAS_W / 2, 6);
    for (let i = 0; i < s.lives; i++) {
      const lx = CANVAS_W - 18 - i * 18;
      ctx.fillStyle = palette.hudLife;
      ctx.beginPath();
      ctx.arc(lx, 13, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.hudLifeEye;
      ctx.beginPath();
      ctx.arc(lx - 2, 11, 1.6, 0, Math.PI * 2);
      ctx.arc(lx + 2, 11, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    const ratio = Math.max(0, s.timeLeft / s.roundTime);
    const barColor =
      ratio > 0.5
        ? palette.timeBarHigh
        : ratio > 0.25
          ? palette.timeBarMid
          : palette.timeBarLow;
    ctx.fillStyle = palette.timeBarBg;
    ctx.fillRect(0, CANVAS_H - 6, CANVAS_W, 6);
    ctx.fillStyle = barColor;
    ctx.fillRect(0, CANVAS_H - 6, CANVAS_W * ratio, 6);
  };

  // ---------- Input ----------

  const onKey = (e: KeyboardEvent) => {
    let dir: Direction | null = null;
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        dir = 'up';
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        dir = 'down';
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        dir = 'left';
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        dir = 'right';
        break;
    }
    if (dir) {
      e.preventDefault();
      if (!paused && !s.gameOver) s.pendingDir = dir;
    }
  };
  window.addEventListener('keydown', onKey);

  // ---------- RAF loop ----------

  let raf = 0;
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(50, now - last);
    last = now;
    if (!paused && !s.gameOver) update(dt);
    draw();
    if (!s.gameOver) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  // ---------- Controller ----------

  return {
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
    },
    setSkin(id: SkinId) {
      palette = FROGGER_SKINS[id];
    },
  };
}
