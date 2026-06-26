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

  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [playerName, setPlayerName] = useState(user?.name ?? 'INVITADO');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gameKey, setGameKey] = useState(0);

  const gameRef = useRef<TetrisGameHandle>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);
  const [skin, setSkin] = useSkin();

  const callbacks: TetrisCallbacks = {
    onScoreChange: useCallback((s: number) => setScore(s), []),
    onLinesChange: useCallback((l: number) => setLines(l), []),
    onLevelChange: useCallback((l: number) => setLevel(l), []),
    onPauseChange: useCallback((p: boolean) => setPaused(p), []),
    onGameOver: useCallback((s: number) => {
      setFinalScore(s);
      setOver(true);
    }, []),
  };

  const togglePause = () => {
    if (paused) {
      gameRef.current?.resume();
      setPaused(false);
    } else {
      gameRef.current?.pause();
      setPaused(true);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveScore('tetris', playerName, finalScore);
    } finally {
      setSaving(false);
      setSaved(true);
    }
  };

  const restart = () => {
    setScore(0);
    setLines(0);
    setLevel(1);
    setPaused(false);
    setOver(false);
    setFinalScore(0);
    setSaved(false);
    setSaving(false);
    setPlayerName(user?.name ?? 'INVITADO');
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
            <div className="v">{score.toLocaleString('es-ES')}</div>
          </div>
          <div className="hud-stat">
            <div className="l">Líneas</div>
            <div className="v">{lines}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, '0')}</div>
          </div>
        </div>

        <div className="hud-actions">
          <SkinSelector value={skin} onChange={setSkin} disabled={over} />
          <button className="btn yellow" onClick={togglePause} disabled={over}>
            {paused ? 'REANUDAR' : 'PAUSA'}
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

          {paused && !over && (
            <div
              className="crt-content"
              style={{
                background: 'rgba(0,0,0,0.6)',
                zIndex: 5,
                position: 'absolute',
                inset: 0,
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
          )}
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
        <button className="btn yellow" onClick={togglePause} disabled={over}>
          {paused ? 'REANUDAR' : 'PAUSA'}
        </button>
        <SkinSelector value={skin} onChange={setSkin} disabled={over} />
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{finalScore.toLocaleString('es-ES')}</div>

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
