'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import TetrisGame, { TetrisGameHandle } from '@/components/games/TetrisGame';
import { TetrisCallbacks } from '@/lib/games/tetris';
import { saveScore } from '@/lib/supabase/saveScore';
import SkinSelector, { useSkin } from '@/components/games/SkinSelector';
import VirtualGamepad, {
  type GamepadConfig,
} from '@/components/games/VirtualGamepad';

const TETRIS_CONFIG: GamepadConfig = {
  dpadDown: 'ArrowDown',
  dpadLeft: 'ArrowLeft',
  dpadRight: 'ArrowRight',
  buttonA: 'ArrowUp',
  buttonB: ' ',
};

export default function TetrisPlayPage() {
  const router = useRouter();
  const { user } = useUser();

  // Hot-path HUD values: updated via DOM ref — no React re-render on score/lines/level change
  const scoreSpanRef = useRef<HTMLDivElement>(null);
  const linesSpanRef = useRef<HTMLDivElement>(null);
  const levelSpanRef = useRef<HTMLDivElement>(null);

  // Pause state: managed imperatively so toggling doesn't trigger re-renders
  const pausedRef = useRef<boolean>(false);
  const pauseBtnDesktopRef = useRef<HTMLButtonElement>(null);
  const pauseBtnMobileRef = useRef<HTMLButtonElement>(null);
  const pauseOverlayRef = useRef<HTMLDivElement>(null);

  // finalScore set before setOver(true) — read from ref in modal at render time
  const finalScoreRef = useRef<number>(0);

  // React state: only what drives a structural re-render (modal, input, restart)
  const [over, setOver] = useState(false);
  const [playerName, setPlayerName] = useState(user?.name ?? 'INVITADO');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gameKey, setGameKey] = useState(0);

  const gameRef = useRef<TetrisGameHandle>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);
  const [skin, setSkin] = useSkin();

  const callbacks: TetrisCallbacks = {
    onScoreChange: useCallback((s: number) => {
      if (scoreSpanRef.current)
        scoreSpanRef.current.textContent = s.toLocaleString('es-ES');
    }, []),
    onLinesChange: useCallback((l: number) => {
      if (linesSpanRef.current) linesSpanRef.current.textContent = String(l);
    }, []),
    onLevelChange: useCallback((l: number) => {
      if (levelSpanRef.current)
        levelSpanRef.current.textContent = String(l).padStart(2, '0');
    }, []),
    // Fired when the P key toggles pause internally; syncs DOM refs to match
    onPauseChange: useCallback((p: boolean) => {
      pausedRef.current = p;
      const label = p ? 'REANUDAR' : 'PAUSA';
      if (pauseBtnDesktopRef.current)
        pauseBtnDesktopRef.current.textContent = label;
      if (pauseBtnMobileRef.current)
        pauseBtnMobileRef.current.textContent = label;
      if (pauseOverlayRef.current)
        pauseOverlayRef.current.style.display = p ? 'flex' : 'none';
    }, []),
    // onGameOver is the ONLY setState in the hot path
    onGameOver: useCallback((s: number) => {
      finalScoreRef.current = s;
      // Ensure overlay is hidden before the game-over modal appears
      if (pauseOverlayRef.current)
        pauseOverlayRef.current.style.display = 'none';
      setOver(true);
    }, []),
  };

  // Imperative pause: updates DOM refs directly, no setState
  const togglePause = () => {
    if (pausedRef.current) {
      gameRef.current?.resume();
      pausedRef.current = false;
      if (pauseBtnDesktopRef.current)
        pauseBtnDesktopRef.current.textContent = 'PAUSA';
      if (pauseBtnMobileRef.current)
        pauseBtnMobileRef.current.textContent = 'PAUSA';
      if (pauseOverlayRef.current)
        pauseOverlayRef.current.style.display = 'none';
    } else {
      gameRef.current?.pause();
      pausedRef.current = true;
      if (pauseBtnDesktopRef.current)
        pauseBtnDesktopRef.current.textContent = 'REANUDAR';
      if (pauseBtnMobileRef.current)
        pauseBtnMobileRef.current.textContent = 'REANUDAR';
      if (pauseOverlayRef.current)
        pauseOverlayRef.current.style.display = 'flex';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveScore('tetris', playerName, finalScoreRef.current);
    } finally {
      setSaving(false);
      setSaved(true);
    }
  };

  const restart = () => {
    // Reset DOM refs to initial values before remounting the game
    if (scoreSpanRef.current) scoreSpanRef.current.textContent = '0';
    if (linesSpanRef.current) linesSpanRef.current.textContent = '0';
    if (levelSpanRef.current) levelSpanRef.current.textContent = '01';
    if (pauseBtnDesktopRef.current)
      pauseBtnDesktopRef.current.textContent = 'PAUSA';
    if (pauseBtnMobileRef.current)
      pauseBtnMobileRef.current.textContent = 'PAUSA';
    if (pauseOverlayRef.current) pauseOverlayRef.current.style.display = 'none';
    pausedRef.current = false;
    finalScoreRef.current = 0;

    setOver(false);
    setPlayerName(user?.name ?? 'INVITADO');
    setSaved(false);
    setSaving(false);
    setGameKey((k) => k + 1);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud hidden md:flex">
        <div
          style={{
            display: 'flex',
            gap: 24,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: 'var(--ink)' }}>
              {playerName}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            {/* textContent updated directly by onScoreChange callback */}
            <div className="v" ref={scoreSpanRef}>
              0
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Líneas</div>
            <div className="v" ref={linesSpanRef}>
              0
            </div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v" ref={levelSpanRef}>
              01
            </div>
          </div>
        </div>

        <div className="hud-actions">
          <SkinSelector value={skin} onChange={setSkin} disabled={over} />
          <button
            ref={pauseBtnDesktopRef}
            className="btn yellow"
            onClick={togglePause}
            disabled={over}
          >
            PAUSA
          </button>
          <button
            className="btn ghost"
            onClick={() => router.push('/games/tetris')}
          >
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div
          className="crt-screen"
          style={{
            padding: '0 0 0 0',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
          }}
        >
          {/* Tablero centrado + preview a la derecha, como unidad */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
            <TetrisGame
              key={`${gameKey}-${skin}`}
              ref={gameRef}
              callbacks={callbacks}
              nextCanvasRef={nextCanvasRef}
              skin={skin}
            />

            {/* Preview NEXT — a la derecha del tablero, dentro del CRT */}
            <div
              style={{
                padding: '16px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                flexShrink: 0,
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  color: 'var(--ink-faint)',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                }}
              >
                Siguiente
              </div>
              <canvas
                ref={nextCanvasRef}
                width={120}
                height={120}
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'block',
                }}
              />
            </div>
          </div>

          {/* Pause overlay — pre-rendered hidden; shown/hidden imperatively via ref */}
          <div
            ref={pauseOverlayRef}
            className="crt-content"
            style={{
              background: 'rgba(0,0,0,0.6)',
              zIndex: 5,
              position: 'absolute',
              inset: 0,
              display: 'none',
            }}
          >
            <div>
              <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                EN PAUSA
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: 'var(--ink-dim)',
                  marginTop: 10,
                  letterSpacing: '0.16em',
                }}
              >
                PULSA REANUDAR PARA CONTINUAR
              </div>
            </div>
          </div>
        </div>

        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>TETRIS · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      <VirtualGamepad config={TETRIS_CONFIG} />

      {/* Mobile footer: PAUSA + SkinSelector */}
      <div className="flex md:hidden items-center justify-center gap-4 px-4 py-3 flex-wrap">
        <button
          ref={pauseBtnMobileRef}
          className="btn yellow"
          onClick={togglePause}
          disabled={over}
        >
          PAUSA
        </button>
        <SkinSelector value={skin} onChange={setSkin} disabled={over} />
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            {/* finalScoreRef.current is set before setOver(true) — safe to read here */}
            <div className="final">
              {finalScoreRef.current.toLocaleString('es-ES')}
            </div>

            {!saved ? (
              <div className="input-row">
                <input
                  value={playerName}
                  onChange={(e) =>
                    setPlayerName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'GUARDANDO…' : 'GUARDAR PUNTUACIÓN'}
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}

            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <button className="btn magenta" onClick={() => router.push('/')}>
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
