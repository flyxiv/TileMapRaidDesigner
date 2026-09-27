'use client';
import { useState } from 'react';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max' | 'type'> & {
  value: number; min: number; max: number; onChange: (v: number) => void;
};

/**
 * A whole-number field that can be cleared and retyped: while focused it keeps what is typed and only reports values
 * that are in range, so typing "15" never passes through a clamped "150" or snaps an empty field back to 0. On blur
 * it clamps whatever is left and shows the value again.
 */
export function IntInput({ value, min, max, onChange, onFocus, onBlur, ...rest }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input {...rest} type="number" inputMode="numeric" min={min} max={max} value={draft ?? value}
      onFocus={e => { e.currentTarget.select(); onFocus?.(e); }}
      onChange={e => {
        const text = e.target.value;
        setDraft(text);
        const n = Number(text);
        if (text.trim() !== '' && Number.isInteger(n) && n >= min && n <= max && n !== value) onChange(n);
      }}
      onBlur={e => {
        if (draft !== null && draft.trim() !== '') {
          const n = Math.max(min, Math.min(max, Math.round(Number(draft)) || 0));
          if (n !== value) onChange(n);
        }
        setDraft(null);
        onBlur?.(e);
      }} />
  );
}
