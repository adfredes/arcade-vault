'use client';

import { useRef } from 'react';

export interface GamepadConfig {
  dpadUp?: string;
  dpadDown?: string;
  dpadLeft?: string;
  dpadRight?: string;
  buttonA?: string; // key code despachado por el botón A (magenta, derecha)
  buttonB?: string; // key code despachado por el botón B (cian, izquierda)
}

// SVG arrow paths (triangular), one per cardinal direction
const ARROW_PATHS = {
  up: 'M12 4 L20 16 L4 16 Z',
  right: 'M8 4 L20 12 L8 20 Z',
  down: 'M4 8 L20 8 L12 20 Z',
  left: 'M16 4 L16 20 L4 12 Z',
} as const;

function DpadArrow({ dir }: { dir: keyof typeof ARROW_PATHS }) {
  return (
    <svg className="dp-arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d={ARROW_PATHS[dir]} fill="currentColor" />
    </svg>
  );
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
      className="virtual-gamepad hidden [@media(pointer:coarse)]:flex items-center justify-center px-4 py-3"
      style={{
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <div className="gp" role="group" aria-label="Gamepad">
        <div className="gp-body">
          {/* Left column: D-pad with SVG arrows + pulsing hub gem */}
          <div className="gp-col gp-col-left">
            <div className="gp-dpad" aria-label="D-pad">
              {config.dpadUp && (
                <button
                  className="dp dp-up"
                  aria-label="up"
                  {...handlers(config.dpadUp)}
                >
                  <DpadArrow dir="up" />
                </button>
              )}
              {config.dpadRight && (
                <button
                  className="dp dp-right"
                  aria-label="right"
                  {...handlers(config.dpadRight)}
                >
                  <DpadArrow dir="right" />
                </button>
              )}
              {config.dpadDown && (
                <button
                  className="dp dp-down"
                  aria-label="down"
                  {...handlers(config.dpadDown)}
                >
                  <DpadArrow dir="down" />
                </button>
              )}
              {config.dpadLeft && (
                <button
                  className="dp dp-left"
                  aria-label="left"
                  {...handlers(config.dpadLeft)}
                >
                  <DpadArrow dir="left" />
                </button>
              )}
              <div className="dp-hub" aria-hidden="true">
                <span className="dp-hub-gem" />
              </div>
            </div>
          </div>

          {/* Right column: A/B action buttons (B cyan left, A magenta right) */}
          <div className="gp-col gp-col-right">
            {hasActions && (
              <div className="gp-actions">
                {config.buttonB && (
                  <button
                    className="ab b"
                    aria-label="B"
                    {...handlers(config.buttonB)}
                  >
                    <span className="ab-ring" />
                    <span className="ab-letter">B</span>
                  </button>
                )}
                {config.buttonA && (
                  <button
                    className="ab a"
                    aria-label="A"
                    {...handlers(config.buttonA)}
                  >
                    <span className="ab-ring" />
                    <span className="ab-letter">A</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
