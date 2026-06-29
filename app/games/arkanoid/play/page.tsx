'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import ArkanoidGame, {
  ArkanoidGameHandle,
} from '@/components/games/ArkanoidGame';
import { ArkanoidCallbacks } from '@/lib/games/arkanoid';
import SkinSelector, { useSkin } from '@/components/games/SkinSelector';
import VirtualGamepad, {
  type GamepadConfig,
} from '@/components/games/VirtualGamepad';
import { saveScore } from '@/lib/supabase/saveScore';

const ARKANOID_CONFIG: GamepadConfig = {
  dpadLeft: 'ArrowLeft',
  dpadRight: 'ArrowRight',
};

export default function ArkanoidPlayPage() {
  const router = useRouter();
  const { user } = useUser();

  // React state: only for UI branches that require re-render
  const [over, setOver] = useState(false);
  const [playerName, setPlayerName] = useState(user?.name ?? 'INVITADO');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const [skin, setSkin] = useSkin();

  // Refs for hot-path values — updated via DOM, never trigger re-render
  const gameRef = useRef<ArkanoidGameHandle>(null);
  const pausedRef = useRef(false);
  const finalScoreRef = useRef(0);

  // DOM refs for HUD spans
  const scoreSpanRef = useRef<HTMLSpanElement>(null);
  const livesSpanRef = useRef<HTMLSpanElement>(null);
  const levelSpanRef = useRef<HTMLSpanElement>(null);
  const pauseBtnDesktopRef = useRef<HTMLButtonElement>(null);
  const pauseBtnMobileRef = useRef<HTMLButtonElement>(null);

  const onScoreChange = useCallback((s: number) => {
    if (scoreSpanRef.current)
      scoreSpanRef.current.textContent = s.toLocaleString('es-ES');
  }, []);

  const onLivesChange = useCallback((l: number) => {
    if (livesSpanRef.current) livesSpanRef.current.textContent = String(l);
  }, []);

  const onLevelChange = useCallback((l: number) => {
    if (levelSpanRef.current)
      levelSpanRef.current.textContent = String(l).padStart(2, '0');
  }, []);

  const onGameOver = useCallback((s: number) => {
    finalScoreRef.current = s;
    setOver(true);
  }, []);

  const callbacks: ArkanoidCallbacks = {
    onScoreChange,
    onLivesChange,
    onLevelChange,
    onGameOver,
  };

  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    const label = pausedRef.current ? 'REANUDAR' : 'PAUSA';
    if (pauseBtnDesktopRef.current)
      pauseBtnDesktopRef.current.textContent = label;
    if (pauseBtnMobileRef.current)
      pauseBtnMobileRef.current.textContent = label;
    if (pausedRef.current) gameRef.current?.pause();
    else gameRef.current?.resume();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveScore('arkanoid', playerName, finalScoreRef.current);
    } finally {
      setSaving(false);
      setSaved(true);
    }
  };

  const restart = () => {
    pausedRef.current = false;
    finalScoreRef.current = 0;
    if (pauseBtnDesktopRef.current)
      pauseBtnDesktopRef.current.textContent = 'PAUSA';
    if (pauseBtnMobileRef.current)
      pauseBtnMobileRef.current.textContent = 'PAUSA';
    setSaved(false);
    setSaving(false);
    setOver(false);
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
            <div className="v">
              <span ref={scoreSpanRef}>0</span>
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Vidas</div>
            <div className="v">
              <span ref={livesSpanRef}>3</span>
            </div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">
              <span ref={levelSpanRef}>01</span>
            </div>
          </div>
        </div>

        <div className="hud-actions">
          <SkinSelector
            value={skin}
            onChange={setSkin}
            disabled={pausedRef.current}
          />
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
            onClick={() => router.push('/games/arkanoid')}
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
            alignItems: 'flex-start',
            position: 'relative',
          }}
        >
          <ArkanoidGame
            key={`${gameKey}-${skin}`}
            ref={gameRef}
            callbacks={callbacks}
            skin={skin}
          />
        </div>

        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>ARKANOID · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      <VirtualGamepad config={ARKANOID_CONFIG} />

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
        <SkinSelector
          value={skin}
          onChange={setSkin}
          disabled={pausedRef.current}
        />
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
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
