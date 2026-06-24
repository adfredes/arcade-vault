'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  initArkanoid,
  ArkanoidCallbacks,
  ArkanoidController,
} from '@/lib/games/arkanoid';
import { DEFAULT_SKIN, type SkinId } from '@/lib/games/skins';

export interface ArkanoidGameHandle {
  pause: () => void;
  resume: () => void;
}

interface Props {
  callbacks: ArkanoidCallbacks;
  skin?: SkinId;
}

const ArkanoidGame = forwardRef<ArkanoidGameHandle, Props>(
  function ArkanoidGame({ callbacks, skin = DEFAULT_SKIN }, ref) {
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
      const controller = initArkanoid(canvasRef.current, callbacks, skin);
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
