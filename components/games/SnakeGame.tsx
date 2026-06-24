'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { initSnake, SnakeCallbacks, SnakeController } from '@/lib/games/snake';

export interface SnakeGameHandle {
  pause: () => void;
  resume: () => void;
}

interface Props {
  callbacks: SnakeCallbacks;
}

const SnakeGame = forwardRef<SnakeGameHandle, Props>(function SnakeGame(
  { callbacks },
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
    const controller = initSnake(canvasRef.current, callbacks);
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
      style={{ display: 'block', maxWidth: '100%' }}
    />
  );
});

export default SnakeGame;
