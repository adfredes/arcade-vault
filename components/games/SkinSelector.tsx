'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_SKIN,
  SKIN_IDS,
  SKIN_LABELS,
  type SkinId,
} from '@/lib/games/skins';

const STORAGE_KEY = 'arcade-skin';

function isSkinId(value: string | null): value is SkinId {
  return value !== null && (SKIN_IDS as string[]).includes(value);
}

/**
 * Reads/persists the active skin in localStorage (key `arcade-skin`).
 * Defaults to `classic`. The play page drives the game with this value.
 */
export function useSkin(): [SkinId, (skin: SkinId) => void] {
  const [skin, setSkinState] = useState<SkinId>(DEFAULT_SKIN);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isSkinId(stored)) setSkinState(stored);
  }, []);

  const setSkin = useCallback((next: SkinId) => {
    setSkinState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return [skin, setSkin];
}

interface Props {
  value: SkinId;
  onChange: (skin: SkinId) => void;
  disabled?: boolean;
}

export default function SkinSelector({ value, onChange, disabled }: Props) {
  return (
    <label className="skin-selector">
      <span className="skin-selector-label">SKIN</span>
      <span className="skin-select-wrap">
        <select
          className="skin-select"
          aria-label="Estilo visual"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as SkinId)}
        >
          {SKIN_IDS.map((id) => (
            <option key={id} value={id}>
              {SKIN_LABELS[id]}
            </option>
          ))}
        </select>
        <span className="skin-select-caret" aria-hidden>
          ▾
        </span>
      </span>
    </label>
  );
}
