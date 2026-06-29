'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { saveScore } from '@/lib/supabase/saveScore';
import SkinSelector, { useSkin } from '@/components/games/SkinSelector';
import VirtualGamepad, {
  type GamepadConfig,
} from '@/components/games/VirtualGamepad';

const FroggerGame = dynamic(() => import('@/components/games/FroggerGame'), {
  ssr: false,
});

// Frogger solo usa el D-pad (saltos discretos en 4 direcciones); sin botones A/B.
const FROGGER_CONFIG: GamepadConfig = {
  dpadUp: 'ArrowUp',
  dpadDown: 'ArrowDown',
  dpadLeft: 'ArrowLeft',
  dpadRight: 'ArrowRight',
};

export default function FroggerPlayPage() {
  const router = useRouter();

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [playerName, setPlayerName] = useState('INVITADO');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const [skin, setSkin] = useSkin();

  // Pre-rellenar nombre desde localStorage
  useEffect(() => {
    const stored = localStorage.getItem('av_player_name');
    if (stored) setPlayerName(stored);
  }, []);

  const onScoreChange = useCallback((s: number) => setScore(s), []);
  const onLivesChange = useCallback((l: number) => setLives(l), []);
  const onLevelChange = useCallback((l: number) => setLevel(l), []);
  const onGameOver = useCallback((s: number) => {
    setFinalScore(s);
    setOver(true);
  }, []);

  const togglePause = () => setPaused((p) => !p);

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem('av_player_name', playerName);
      await saveScore('frogger', playerName, finalScore);
    } finally {
      setSaving(false);
      setSaved(true);
    }
  };

  const restart = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setPaused(false);
    setOver(false);
    setFinalScore(0);
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
            <div className="v">{score.toLocaleString('es-ES')}</div>
          </div>
          <div className="hud-stat">
            <div className="l">Vidas</div>
            <div className="v">{lives}</div>
          </div>
          <div className="hud-stat">
            <div className="l">Nivel</div>
            <div className="v">{level}</div>
          </div>
        </div>

        <div className="hud-actions">
          <SkinSelector value={skin} onChange={setSkin} disabled={paused} />
          <button className="btn yellow" onClick={togglePause} disabled={over}>
            {paused ? 'REANUDAR' : 'PAUSA'}
          </button>
          <button
            className="btn ghost"
            onClick={() => router.push('/games/frogger')}
          >
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div
          className="crt-screen"
          style={{
            padding: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          <FroggerGame
            key={`${gameKey}-${skin}`}
            paused={paused}
            onScoreChange={onScoreChange}
            onLivesChange={onLivesChange}
            onLevelChange={onLevelChange}
            onGameOver={onGameOver}
            skin={skin}
          />
        </div>

        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>FROGGER · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      <VirtualGamepad config={FROGGER_CONFIG} />

      {/* Footer móvil: PAUSA + SkinSelector */}
      <div className="flex md:hidden items-center justify-center gap-4 px-4 py-3 flex-wrap">
        <button className="btn yellow" onClick={togglePause} disabled={over}>
          {paused ? 'REANUDAR' : 'PAUSA'}
        </button>
        <SkinSelector value={skin} onChange={setSkin} disabled={paused} />
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
