'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  initArkanoid,
  ArkanoidCallbacks,
  ArkanoidController,
} from '@/lib/games/arkanoid';

export interface ArkanoidGameHandle {
  pause: () => void;
  resume: () => void;
}

interface Props {
  callbacks: ArkanoidCallbacks;
}

const ArkanoidGame = forwardRef<ArkanoidGameHandle, Props>(
  function ArkanoidGame({ callbacks }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const controllerRef = useRef<ArkanoidController | null>(null);

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
      const controller = initArkanoid(canvasRef.current, callbacks);
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

export default ArkanoidGame;
