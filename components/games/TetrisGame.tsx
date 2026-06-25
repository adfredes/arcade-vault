'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  initTetris,
  TetrisCallbacks,
  TetrisController,
} from '@/lib/games/tetris';
import { DEFAULT_SKIN, type SkinId } from '@/lib/games/skins';

export interface TetrisGameHandle {
  pause: () => void;
  resume: () => void;
}

interface Props {
  callbacks: TetrisCallbacks;
  /** El padre renderiza este canvas en el HUD y pasa la ref aquí. */
  nextCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  /** Skin activa; cambia vía remontaje por key en la play page. */
  skin?: SkinId;
}

const TetrisGame = forwardRef<TetrisGameHandle, Props>(function TetrisGame(
  { callbacks, nextCanvasRef, skin = DEFAULT_SKIN },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<TetrisController | null>(null);

  useImperativeHandle(ref, () => ({
    pause() {
      controllerRef.current?.pause();
    },
    resume() {
      controllerRef.current?.resume();
    },
  }));

  useEffect(() => {
    if (!canvasRef.current) return;
    const controller = initTetris(
      canvasRef.current,
      callbacks,
      nextCanvasRef?.current ?? undefined,
      skin,
    );
    controllerRef.current = controller;
    return () => {
      controller.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={600}
      style={{ display: 'block', maxWidth: '100%' }}
    />
  );
});

export default TetrisGame;
