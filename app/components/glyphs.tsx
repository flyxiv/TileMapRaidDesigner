import { markerTypes, type Kind, type MarkerKind } from '../plan';

/** 24×24 stroke paths for role tokens and mechanic tools. */
export const glyphs: Record<Kind, string> = {
  boss: 'M4 17h16l1-10-5 4-4-6-4 6-5-4z M5 20h14',
  tank: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z',
  healer: 'M12 5v14 M5 12h14',
  dps: 'M19 5L9 15 M15 5h4v4 M7 13l4 4 M5 19l3-3',
  miniboss: 'M12 3a7 7 0 0 0-7 7v3l2 2v4h10v-4l2-2v-3a7 7 0 0 0-7-7z M9.5 11.5h.01 M14.5 11.5h.01 M10.5 19v-2 M13.5 19v-2',
  add: 'M6 19c2.5-4 3.2-9 2.2-14 M12 20c2.5-4.5 3-10 1.8-15 M18 19c1.8-3.5 2.3-8 1.3-12',
  npc: 'M12 4a3.2 3.2 0 1 0 0 6.4a3.2 3.2 0 1 0 0-6.4z M5.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2',
  circle: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 9v6 M9 12h6',
  cone: 'M12 20L4 6a12 12 0 0 1 16 0z',
  line: 'M4.5 16.5l12-12 3 3-12 12z',
  donut: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z',
  flare: 'M12 10a2 2 0 1 0 0 4a2 2 0 1 0 0-4z M12 6a6 6 0 1 0 0 12a6 6 0 1 0 0-12z M12 2.5a9.5 9.5 0 1 0 0 19a9.5 9.5 0 1 0 0-19z',
  stack: 'M12 3v6 M9.5 6.5L12 9l2.5-2.5 M12 21v-6 M9.5 17.5L12 15l2.5 2.5 M3 12h6 M6.5 9.5L9 12l-2.5 2.5 M21 12h-6 M17.5 9.5L15 12l2.5 2.5',
  spread: 'M12 9V3 M9.5 5.5L12 3l2.5 2.5 M12 15v6 M9.5 18.5L12 21l2.5-2.5 M9 12H3 M5.5 9.5L3 12l2.5 2.5 M15 12h6 M18.5 9.5L21 12l-2.5 2.5',
  tower: 'M7 21V8l5-5 5 5v13z M10 21v-5h4v5 M7 11h10',
  knockback: 'M12 10a2 2 0 1 0 0 4a2 2 0 1 0 0-4z M16 8l4-4 M16 4h4v4 M8 16l-4 4 M4 16v4h4',
  armageddon: 'M12 2v4 M12 18v4 M2 12h4 M18 12h4 M4.9 4.9l2.8 2.8 M16.3 16.3l2.8 2.8 M4.9 19.1l2.8-2.8 M16.3 7.7l2.8-2.8 M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z',
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

const markerNumbers: Partial<Record<MarkerKind, string>> = { one: '1', two: '2', three: '3', four: '4' };

/** The shape of a head marker in a 24×24 box, filled with its colour. */
export function MarkerShape({ kind, edge = '#141819', edgeWidth = 1 }: { kind: MarkerKind; edge?: string; edgeWidth?: number }) {
  const c = markerTypes[kind].color, dark = '#141819';
  const n = markerNumbers[kind];
  if (n) return <>
    <rect x="3" y="3" width="18" height="18" rx="4" fill={c} stroke={edge} strokeWidth={edgeWidth} />
    <text x="12" y="12.8" textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight="800" fill={dark} fontFamily="'DM Sans', sans-serif">{n}</text>
  </>;
  switch (kind) {
    case 'star': return <path d="M12 2.5l2.8 6 6.6.7-5 4.4 1.4 6.5L12 16.8 6.2 20.1l1.4-6.5-5-4.4 6.6-.7z" fill={c} stroke={edge} strokeWidth={edgeWidth} strokeLinejoin="round" />;
    case 'circle': return <circle cx="12" cy="12" r="8.5" fill={c} stroke={edge} strokeWidth={edgeWidth} />;
    case 'diamond': return <path d="M12 2.5l8 9.5-8 9.5-8-9.5z" fill={c} stroke={edge} strokeWidth={edgeWidth} strokeLinejoin="round" />;
    case 'triangle': return <path d="M12 3l9.5 17h-19z" fill={c} stroke={edge} strokeWidth={edgeWidth} strokeLinejoin="round" />;
    case 'moon': return <path d="M15.5 3.5a8.8 8.8 0 1 0 5 12.8 7 7 0 1 1-5-12.8z" fill={c} stroke={edge} strokeWidth={edgeWidth} strokeLinejoin="round" />;
    case 'square': return <rect x="4" y="4" width="16" height="16" rx="1.5" fill={c} stroke={edge} strokeWidth={edgeWidth} />;
    case 'cross': return <path d="M5 8l3-3 4 4 4-4 3 3-4 4 4 4-3 3-4-4-4 4-3-3 4-4z" fill={c} stroke={edge} strokeWidth={edgeWidth} strokeLinejoin="round" />;
    case 'skull': return <>
      <path d="M12 3a8 8 0 0 0-8 8c0 2.6 1.2 4.3 3 5.4V20h10v-3.6c1.8-1.1 3-2.8 3-5.4a8 8 0 0 0-8-8z" fill={c} stroke={edge} strokeWidth={edgeWidth} />
      <circle cx="9" cy="11.5" r="2" fill={dark} /><circle cx="15" cy="11.5" r="2" fill={dark} /><path d="M10 20v-2M14 20v-2" stroke={dark} strokeWidth="1.3" />
    </>;
    default: return null;
  }
}

export function MarkerIcon({ kind, size = 18 }: { kind: MarkerKind; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><MarkerShape kind={kind} /></svg>;
}
