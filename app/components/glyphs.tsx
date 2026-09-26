import type { Kind } from '../plan';

/** 24×24 stroke paths for role tokens and mechanic tools. */
export const glyphs: Record<Kind, string> = {
  boss: 'M4 17h16l1-10-5 4-4-6-4 6-5-4z M5 20h14',
  tank: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z',
  healer: 'M12 5v14 M5 12h14',
  dps: 'M19 5L9 15 M15 5h4v4 M7 13l4 4 M5 19l3-3',
  circle: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 9v6 M9 12h6',
  cone: 'M12 20L4 6a12 12 0 0 1 16 0z',
  marker: 'M12 3l9 9-9 9-9-9z',
};

export function Glyph({ kind, size = 16, color = 'currentColor', strokeWidth = 2 }: { kind: Kind; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={glyphs[kind]} />
    </svg>
  );
}

export function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="11" height="11" rx="2" stroke="#c6eb95" strokeWidth="1.6" />
      <rect x="14" y="1" width="11" height="11" rx="2" stroke="#56615a" strokeWidth="1.6" />
      <rect x="1" y="14" width="11" height="11" rx="2" stroke="#56615a" strokeWidth="1.6" />
      <rect x="14" y="14" width="11" height="11" rx="2" fill="#c6eb95" />
    </svg>
  );
}
