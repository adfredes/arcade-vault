'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  initAsteroids,
  AsteroidsCallbacks,
  AsteroidsController,
} from '@/lib/games/asteroids';

export interface AsteroidsGameHandle {
  pause: () => void;
  resume: () => void;
}

interface Props {
  callbacks: AsteroidsCallbacks;
}

const AsteroidsGame = forwardRef<AsteroidsGameHandle, Props>(
  function AsteroidsGame({ callbacks }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const controllerRef = useRef<AsteroidsController | null>(null);

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
      const controller = initAsteroids(canvasRef.current, callbacks);
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
        height={600}
        style={{ display: 'block', maxWidth: '100%' }}
      />
    );
  },
);

export default AsteroidsGame;
