'use client';
import { forwardRef, type PointerEvent as ReactPointerEvent } from 'react';
import { center, colLabel, footprint, hazardTiles, isMechanic, isUnit, mechanicOrigin, mechanicTone, terrainTypes, tileLabel, tones, unitTypes, type Entity, type Plan } from '../plan';
import { glyphs } from './glyphs';

export type MapPointer = { type: 'down' | 'move' | 'up'; tile: [number, number] | null; entityId?: string; event: ReactPointerEvent<SVGSVGElement> };

type Props = {
  plan: Plan;
  phaseIndex: number;
  cell: number;
  coords?: boolean;
  showMoves?: boolean;
  showTerrain?: boolean;
  showTelegraphs?: boolean;
  selectedId?: string | null;
  highlight?: { x: number; y: number; size: number } | null;
  onPointer?: (p: MapPointer) => void;
  onLeave?: () => void;
  className?: string;
};

const terrainFill: Record<string, string> = {
  floor: terrainTypes.floor.color, wall: terrainTypes.wall.color, water: 'url(#rd-water)', lava: 'url(#rd-lava)', grass: terrainTypes.grass.color, void: 'transparent',
};

export const BattleMap = forwardRef<SVGSVGElement, Props>(function BattleMap(
  { plan, phaseIndex, cell: C, coords = true, showMoves = true, showTerrain = true, showTelegraphs = true, selectedId, highlight, onPointer, onLeave, className }, ref,
) {
  const phase = plan.phases[phaseIndex];
  const prev = phaseIndex > 0 ? plan.phases[phaseIndex - 1] : null;
  const G = coords ? 20 : 0;
  const W = plan.cols * C + G, H = plan.rows * C + G;
  const units = phase.entities.filter(e => isUnit(e.kind));
  const mechanics = phase.entities.filter(e => isMechanic(e.kind));
  const hazards = mechanics.map(m => ({ m, tiles: hazardTiles(m, phase, plan) }));

  const toTile = (e: ReactPointerEvent<SVGSVGElement>): [number, number] | null => {
    const svg = e.currentTarget, ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const x = Math.floor((pt.x - G) / C), y = Math.floor((pt.y - G) / C);
    return x >= 0 && y >= 0 && x < plan.cols && y < plan.rows ? [x, y] : null;
  };
  const handle = (type: MapPointer['type']) => onPointer && ((event: ReactPointerEvent<SVGSVGElement>) => {
    const target = (event.target as Element).closest('[data-entity]');
    if (type === 'down') event.currentTarget.setPointerCapture(event.pointerId);
    onPointer({ type, tile: toTile(event), entityId: type === 'down' ? target?.getAttribute('data-entity') ?? undefined : undefined, event });
  });

  const moves = showMoves && prev ? units.flatMap(u => {
    const before = prev.entities.find(e => e.id === u.id);
    if (!before || (before.x === u.x && before.y === u.y)) return [];
    const [x1, y1] = center(before).map(v => v * C), [x2, y2] = center(u).map(v => v * C);
    const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    // Half-size of the square token, and the distance from its center to its edge along the move direction.
    const r = (footprint(u) * C) / 2 - 2, edge = r / Math.max(Math.abs(ux), Math.abs(uy)), hs = Math.max(4, C * 0.2);
    const ex = x2 - ux * (edge + 4), ey = y2 - uy * (edge + 4);
    return [{ id: u.id, x1, y1, r, sx: x1 + ux * edge, sy: y1 + uy * edge, ex, ey,
      head: `M${ex + ux * hs} ${ey + uy * hs} L${ex - uy * hs * 0.6} ${ey + ux * hs * 0.6} L${ex + uy * hs * 0.6} ${ey - ux * hs * 0.6} Z` }];
  }) : [];

  return (
    <svg
      ref={ref} className={className} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`${plan.name}, phase ${phaseIndex + 1}: ${phase.name}`}
      onPointerDown={handle('down')} onPointerMove={handle('move')} onPointerUp={handle('up')} onPointerLeave={onLeave}
      fontFamily="'DM Sans', system-ui, sans-serif"
    >
      <defs>
        <pattern id="rd-water" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
          <rect width="9" height="9" fill="#294a57" /><rect width="3" height="9" fill="#2f5463" />
        </pattern>
        <radialGradient id="rd-lava"><stop offset="0" stopColor="#c0643f" /><stop offset="0.75" stopColor="#8f4936" /></radialGradient>
        <pattern id="rd-tele" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="7" fill="rgba(219,179,109,0.14)" /><rect width="3" height="7" fill="rgba(219,179,109,0.38)" />
        </pattern>
        <pattern id="rd-hot" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="7" fill="rgba(236,140,96,0.28)" /><rect width="3" height="7" fill="rgba(236,140,96,0.58)" />
        </pattern>
        <filter id="rd-shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000" floodOpacity="0.4" /></filter>
      </defs>

      {coords && (
        <g fontSize="9" fontWeight="600" fill="#6f7c77" textAnchor="middle" dominantBaseline="central">
          {Array.from({ length: plan.cols }, (_, x) => <text key={`c${x}`} x={G + x * C + C / 2} y={10}>{colLabel(x)}</text>)}
          {Array.from({ length: plan.rows }, (_, y) => <text key={`r${y}`} x={10} y={G + y * C + C / 2}>{y + 1}</text>)}
        </g>
      )}

      <g transform={`translate(${G} ${G})`}>
        <g filter="url(#rd-shadow)">
          {phase.terrain.map((row, y) => row.map((t, x) => {
            if (t === 'void' && showTerrain) return null;
            return (
              <g key={`${x},${y}`}>
                <rect x={x * C} y={y * C} width={C} height={C} fill={showTerrain ? terrainFill[t] : '#2b3432'} stroke="rgba(10,14,14,0.6)" strokeWidth="1" />
                {showTerrain && t === 'wall' && <>
                  <rect x={x * C} y={y * C} width={C} height={2} fill="rgba(255,255,255,0.16)" />
                  <rect x={x * C} y={y * C + C - 3} width={C} height={3} fill="rgba(0,0,0,0.32)" />
                </>}
              </g>
            );
          }))}
        </g>

        {showTelegraphs && hazards.map(({ m, tiles }) => (
          <g key={m.id} data-entity={m.id} opacity={selectedId && selectedId !== m.id ? 0.8 : 1}>
            {tiles.map(([x, y]) => m.kind === 'marker'
              ? <rect key={`${x},${y}`} x={x * C + 0.5} y={y * C + 0.5} width={C - 1} height={C - 1} fill="rgba(198,235,149,0.2)" stroke="rgba(198,235,149,0.35)" />
              : <rect key={`${x},${y}`} x={x * C} y={y * C} width={C} height={C} fill={m.turns === 1 ? 'url(#rd-hot)' : 'url(#rd-tele)'} />)}
            <MechanicOutline m={m} entities={phase.entities} C={C} selected={selectedId === m.id} />
          </g>
        ))}

        {moves.map(mv => (
          <g key={mv.id} pointerEvents="none">
            <rect x={mv.x1 - mv.r} y={mv.y1 - mv.r} width={mv.r * 2} height={mv.r * 2} rx={Math.max(3, C * 0.12)} fill="none" stroke={tones.safe} strokeOpacity="0.45" strokeWidth="1.2" strokeDasharray="3 3" />
            <line x1={mv.sx} y1={mv.sy} x2={mv.ex} y2={mv.ey} stroke={tones.safe} strokeOpacity="0.8" strokeWidth="1.6" strokeDasharray="4 3" strokeLinecap="round" />
            <path d={mv.head} fill={tones.safe} fillOpacity="0.9" />
          </g>
        ))}

        {highlight && (
          <rect x={highlight.x * C + 1} y={highlight.y * C + 1} width={highlight.size * C - 2} height={highlight.size * C - 2} rx="2"
            fill="rgba(198,235,149,0.12)" stroke={tones.safe} strokeWidth="1.5" pointerEvents="none" />
        )}

        {units.map(u => <UnitToken key={u.id} u={u} C={C} selected={selectedId === u.id} />)}

        {showTelegraphs && C >= 22 && mechanics.map(m => <MechanicChip key={m.id} m={m} entities={phase.entities} C={C} />)}
      </g>
    </svg>
  );
});

function MechanicOutline({ m, entities, C, selected }: { m: Entity; entities: Entity[]; C: number; selected: boolean }) {
  const { point: [ox, oy], anchor } = mechanicOrigin(m, entities);
  const cx = ox * C, cy = oy * C, tone = mechanicTone(m), width = selected ? 2.4 : 1.5;
  let shape;
  if (m.kind === 'circle') {
    shape = <circle cx={cx} cy={cy} r={m.radius * C} fill="none" stroke={tone} strokeWidth={width} strokeDasharray="5 4" />;
  } else if (m.kind === 'cone') {
    const R = (m.radius + 0.3) * C, a = (m.rotation * Math.PI) / 180, h = Math.PI / 4;
    const p = (t: number) => `${cx + R * Math.sin(t)} ${cy - R * Math.cos(t)}`;
    shape = <path d={`M${cx} ${cy} L${p(a - h)} A${R} ${R} 0 0 1 ${p(a + h)} Z`} fill="none" stroke={tone} strokeWidth={width} strokeDasharray="5 4" />;
  } else {
    const k = C * 0.55;
    shape = <path d={`M${cx} ${cy - k} L${cx + k} ${cy} L${cx} ${cy + k} L${cx - k} ${cy} Z`} fill="none" stroke={tone} strokeWidth={width} />;
  }
  return <>
    {shape}
    {!anchor && m.kind !== 'marker' && <circle cx={cx} cy={cy} r={Math.max(3, C * 0.12)} fill={tone} stroke="#141819" strokeWidth="1.5" style={{ cursor: 'grab' }} />}
  </>;
}

function MechanicChip({ m, entities, C }: { m: Entity; entities: Entity[]; C: number }) {
  const { point: [ox, oy] } = mechanicOrigin(m, entities);
  const a = (m.rotation * Math.PI) / 180;
  const x = (m.kind === 'cone' ? ox + Math.sin(a) * m.radius * 0.88 : ox) * C;
  const y = (m.kind === 'cone' ? oy - Math.cos(a) * m.radius * 0.88 : m.kind === 'marker' ? oy + 1.25 : oy) * C;
  const tone = mechanicTone(m), badge = m.kind !== 'marker' && m.turns > 0;
  const w = m.name.length * 5.9 + (badge ? 30 : 16), h = 22;
  return (
    <g data-entity={m.id} transform={`translate(${x - w / 2} ${y - h / 2})`} style={{ cursor: 'pointer' }}>
      <title>{m.kind === 'marker' ? m.name : `${m.name}: ${m.turns === 0 ? 'lasts the phase' : `resolves in ${m.turns} turn${m.turns > 1 ? 's' : ''}`}`}</title>
      <rect width={w} height={h} rx={h / 2} fill="rgba(15,19,20,0.92)" stroke={tone} />
      {badge && <>
        <circle cx={h / 2} cy={h / 2} r={8} fill={tone} />
        <text x={h / 2} y={h / 2 + 0.5} textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="700" fill="#141819">{m.turns}</text>
      </>}
      <text x={badge ? 25 : 8} y={h / 2 + 0.5} dominantBaseline="central" fontSize="10" fontWeight="600" fill={tone}>{m.name}</text>
    </g>
  );
}

function UnitToken({ u, C, selected }: { u: Entity; C: number; selected: boolean }) {
  const type = unitTypes[u.kind as keyof typeof unitTypes];
  const big = u.kind === 'boss';
  const [cx, cy] = center(u).map(v => v * C);
  // Tokens fill their whole footprint, inset just enough to keep the tile grid visible.
  const inset = 2, size = footprint(u) * C - inset * 2, r = size / 2, rx = Math.max(3, C * (big ? 0.18 : 0.14));
  const icon = Math.round(size * (big ? 0.46 : 0.54));
  return (
    <g data-entity={u.id} style={{ cursor: 'grab' }} aria-label={`${u.name}, ${tileLabel(u.x, u.y)}`}>
      {selected && <rect x={cx - r - 3} y={cy - r - 3} width={size + 6} height={size + 6} rx={rx + 3} fill="none" stroke={tones.safe} strokeWidth="2" />}
      <rect x={cx - r} y={cy - r + 1.5} width={size} height={size} rx={rx} fill="rgba(0,0,0,0.35)" />
      <rect x={cx - r + 1} y={cy - r + 1} width={size - 2} height={size - 2} rx={rx} fill={type.fill} stroke={type.color} strokeWidth={big ? 2.5 : 2} />
      <svg x={cx - icon / 2} y={cy - icon / 2} width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke={type.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" overflow="visible">
        <path d={glyphs[u.kind]} />
      </svg>
      {!big && C >= 28 && u.code && (
        <g transform={`translate(${cx} ${cy + r - 1})`}>
          <rect x={-(u.code.length * 3 + 5)} y={-5} width={u.code.length * 6 + 10} height={11} rx="3" fill="#0f1314" stroke={type.color} />
          <text textAnchor="middle" dominantBaseline="central" y={0.5} fontSize="8" fontWeight="700" fill={type.color}>{u.code}</text>
        </g>
      )}
      {big && C >= 22 && (
        <g transform={`translate(${cx} ${u.y * C - 6})`}>
          <rect x={-(u.name.length * 3.1 + 9)} y={-18} width={u.name.length * 6.2 + 18} height={18} rx="4" fill="#2a1c18" stroke={type.color} />
          <text textAnchor="middle" dominantBaseline="central" y={-8.5} fontSize="10" fontWeight="600" fill="#f1c4b5" fontFamily="'Space Grotesk', sans-serif">{u.name}</text>
        </g>
      )}
    </g>
  );
}
