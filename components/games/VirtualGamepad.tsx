'use client';

import { useRef } from 'react';

export interface GamepadConfig {
  dpadUp?: string;
  dpadDown?: string;
  dpadLeft?: string;
  dpadRight?: string;
  buttonA?: string;
  buttonALabel?: string;
  buttonB?: string;
  buttonBLabel?: string;
}

interface Props {
  config: GamepadConfig;
}

const REPEAT_MS = 80;

// Maps key values to their corresponding e.code, for games that read e.code instead of e.key
const KEY_TO_CODE: Record<string, string> = {
  ' ': 'Space',
  Shift: 'ShiftLeft',
};

function dispatchKey(type: 'keydown' | 'keyup', key: string) {
  const code = KEY_TO_CODE[key] ?? key;
  window.dispatchEvent(new KeyboardEvent(type, { key, code, bubbles: true }));
}

const dpadBtn =
  'flex items-center justify-center w-12 h-12 rounded text-lg bg-black/50 border border-[var(--ink-faint)] text-[var(--ink)] active:bg-black/70 touch-none select-none';

const actionBtn =
  'flex items-center justify-center w-14 h-14 rounded-full bg-black/50 border border-[var(--ink-dim)] text-[var(--ink)] text-[11px] font-bold tracking-wide active:bg-black/70 touch-none select-none';

export default function VirtualGamepad({ config }: Props) {
  const intervals = useRef(new Map<string, ReturnType<typeof setInterval>>());

  function press(key: string | undefined) {
    if (!key) return;
    dispatchKey('keydown', key);
    if (!intervals.current.has(key)) {
      intervals.current.set(
        key,
        setInterval(() => dispatchKey('keydown', key), REPEAT_MS),
      );
    }
  }

  function release(key: string | undefined) {
    if (!key) return;
    dispatchKey('keyup', key);
    const id = intervals.current.get(key);
    if (id !== undefined) {
      clearInterval(id);
      intervals.current.delete(key);
    }
  }

  function handlers(key: string | undefined) {
    return {
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        press(key);
      },
      onPointerUp: () => release(key),
      onPointerLeave: () => release(key),
      onPointerCancel: () => release(key),
    };
  }

  const hasActions = config.buttonA || config.buttonB;

  return (
    <div
      className="virtual-gamepad hidden [@media(pointer:coarse)]:flex items-center justify-center gap-8 px-4 py-3"
      style={{
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* D-pad: 3×3 grid, arrows at cardinal positions */}
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: 'repeat(3, 3rem)',
          gridTemplateRows: 'repeat(3, 3rem)',
        }}
      >
        <span />
        {config.dpadUp ? (
          <button className={dpadBtn} {...handlers(config.dpadUp)}>
            ▲
          </button>
        ) : (
          <span />
        )}
        <span />

        {config.dpadLeft ? (
          <button className={dpadBtn} {...handlers(config.dpadLeft)}>
            ◀
          </button>
        ) : (
          <span />
        )}
        <div className="rounded bg-black/30 border border-[var(--ink-faint)]" />
        {config.dpadRight ? (
          <button className={dpadBtn} {...handlers(config.dpadRight)}>
            ▶
          </button>
        ) : (
          <span />
        )}

        <span />
        {config.dpadDown ? (
          <button className={dpadBtn} {...handlers(config.dpadDown)}>
            ▼
          </button>
        ) : (
          <span />
        )}
        <span />
      </div>

      {/* Action buttons A / B */}
      {hasActions && (
        <div className="flex flex-col gap-3 items-center justify-center">
          {config.buttonA && (
            <button className={actionBtn} {...handlers(config.buttonA)}>
              {config.buttonALabel ?? 'A'}
            </button>
          )}
          {config.buttonB && (
            <button className={actionBtn} {...handlers(config.buttonB)}>
              {config.buttonBLabel ?? 'B'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
