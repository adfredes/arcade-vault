'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { initSnake, SnakeCallbacks, SnakeController } from '@/lib/games/snake';
import { DEFAULT_SKIN, type SkinId } from '@/lib/games/skins';

export interface SnakeGameHandle {
  pause: () => void;
  resume: () => void;
}

interface Props {
  callbacks: SnakeCallbacks;
  skin?: SkinId;
}

const SnakeGame = forwardRef<SnakeGameHandle, Props>(function SnakeGame(
  { callbacks, skin = DEFAULT_SKIN },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<SnakeController | null>(null);

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
    const controller = initSnake(canvasRef.current, callbacks, skin);
    controllerRef.current = controller;
    return () => {
      controller.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={800}
      style={{ display: 'block', width: '100%', height: 'auto' }}
    />
  );
});

export default SnakeGame;
