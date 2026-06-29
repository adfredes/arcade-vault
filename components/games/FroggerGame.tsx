'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { DEFAULT_SKIN, type SkinId } from '@/lib/games/skins';
import { initFrogger } from '@/lib/games/frogger';

const CANVAS_W = 640;
const CANVAS_H = 560;

export interface FroggerGameHandle {
  pause(): void;
  resume(): void;
}

export interface FroggerGameProps {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  skin?: SkinId;
}

const FroggerGame = forwardRef<FroggerGameHandle, FroggerGameProps>(
  function FroggerGame(
    {
      onScoreChange,
      onLivesChange,
      onLevelChange,
      onGameOver,
      skin = DEFAULT_SKIN,
    },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ctrlRef = useRef<ReturnType<typeof initFrogger> | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      ctrlRef.current = initFrogger(
        canvas,
        { onScoreChange, onLivesChange, onLevelChange, onGameOver },
        skin,
      );
      return () => {
        ctrlRef.current?.destroy();
        ctrlRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      ctrlRef.current?.setSkin(skin);
    }, [skin]);

    useImperativeHandle(ref, () => ({
      pause() {
        ctrlRef.current?.pause();
      },
      resume() {
        ctrlRef.current?.resume();
      },
    }));

    return (
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{
          display: 'block',
          width: 'auto',
          height: 'auto',
          maxWidth: '100%',
          maxHeight: '100%',
          margin: '0 auto',
        }}
      />
    );
  },
);

export default FroggerGame;
