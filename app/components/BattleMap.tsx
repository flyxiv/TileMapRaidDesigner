'use client';
import { forwardRef, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { center, colLabel, footprint, hazardTiles, isMechanic, isUnit, mechanicOrigin, mechanicTone, terrainTypes, tileLabel, tones, unitTypes, type Entity, type Plan } from '../plan';
import { glyphs } from './glyphs';
import { SpeechBubble, type Speech } from './SpeechBubble';

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
  /** Dialogue line to show as a bubble over its speaker. */
  speech?: Speech | null;
  onPointer?: (p: MapPointer) => void;
  onLeave?: () => void;
  /** Drag-and-drop from outside the map: the tile under the cursor while dragging (null when it leaves), and the drop tile. */
  onDragTile?: (tile: [number, number] | null) => void;
  onDropTile?: (tile: [number, number]) => void;
  className?: string;
};

const terrainFill: Record<string, string> = {
  floor: terrainTypes.floor.color, wall: terrainTypes.wall.color, water: 'url(#rd-water)', lava: 'url(#rd-lava)', grass: terrainTypes.grass.color, void: 'transparent',
};

export const BattleMap = forwardRef<SVGSVGElement, Props>(function BattleMap(
  { plan, phaseIndex, cell: C, coords = true, showMoves = true, showTerrain = true, showTelegraphs = true, selectedId, highlight, speech, onPointer, onLeave, onDragTile, onDropTile, className }, ref,
) {
  const phase = plan.phases[phaseIndex];
  const prev = phaseIndex > 0 ? plan.phases[phaseIndex - 1] : null;
  const G = coords ? 20 : 0;
  const W = plan.cols * C + G, H = plan.rows * C + G;
  const units = phase.entities.filter(e => isUnit(e.kind));
  const mechanics = phase.entities.filter(e => isMechanic(e.kind));
  const hazards = mechanics.map(m => ({ m, tiles: hazardTiles(m, phase, plan) }));

  const toTile = (e: ReactMouseEvent<SVGSVGElement>): [number, number] | null => {
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
      onDragOver={onDropTile && ((e: ReactDragEvent<SVGSVGElement>) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; onDragTile?.(toTile(e)); })}
      onDragLeave={onDragTile && (() => onDragTile(null))}
      onDrop={onDropTile && ((e: ReactDragEvent<SVGSVGElement>) => { e.preventDefault(); const t = toTile(e); onDragTile?.(null); if (t) onDropTile(t); })}
      fontFamily="'DM Sans', system-ui, sans-serif" overflow="visible"
    >
      <defs>
        <pattern id="rd-water" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
          <rect width="9" height="9" fill="#294a57" /><rect width="3" height="9" fill="#2f5463" />
        </pattern>
        <radialGradient id="rd-lava"><stop offset="0" stopColor="#c0643f" /><stop offset="0.75" stopColor="#8f4936" /></radialGradient>
        <pattern id="rd-tele" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="7" fill="rgba(219,179,109,0.14)" /><rect width="3" height="7" fill="rgba(219,179,109,0.38)" />
        </pattern>
        <pattern id="rd-share" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="7" fill="rgba(198,235,149,0.12)" /><rect width="3" height="7" fill="rgba(198,235,149,0.3)" />
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
            {tiles.map(([x, y, strength]) => <HazardTile key={`${x},${y}`} m={m} x={x} y={y} strength={strength} C={C} />)}
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

        {/* Labels sit under the tokens and stay translucent so they never hide a unit. */}
        {showTelegraphs && C >= 22 && mechanics.map(m => <MechanicChip key={m.id} m={m} plan={plan} entities={phase.entities} C={C} selected={selectedId === m.id} />)}

        {units.map(u => <UnitToken key={u.id} u={u} C={C} selected={selectedId === u.id} />)}

        {speech && <SpeechBubble speech={speech} units={units} C={C} mapWidth={plan.cols * C} gutter={G} />}

      </g>
    </svg>
  );
});

function HazardTile({ m, x, y, strength, C }: { m: Entity; x: number; y: number; strength: number; C: number }) {
  if (m.kind === 'marker') return <rect x={x * C + 0.5} y={y * C + 0.5} width={C - 1} height={C - 1} fill="rgba(198,235,149,0.2)" stroke="rgba(198,235,149,0.35)" />;
  if (m.kind === 'tower') return <rect x={x * C + 0.5} y={y * C + 0.5} width={C - 1} height={C - 1} fill="rgba(134,197,242,0.22)" stroke="rgba(134,197,242,0.4)" />;
  const fill = m.kind === 'stack' ? 'url(#rd-share)' : m.turns === 1 ? 'url(#rd-hot)' : 'url(#rd-tele)';
  return <rect x={x * C} y={y * C} width={C} height={C} fill={fill} opacity={m.kind === 'armageddon' ? 0.75 : strength} />;
}

/** Arrow from (x1, y1) toward (x2, y2) with a filled head at the far end. */
function arrow(x1: number, y1: number, x2: number, y2: number, head: number) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  const bx = x2 - ux * head, by = y2 - uy * head;
  return { line: `M${x1} ${y1} L${bx} ${by}`, head: `M${x2} ${y2} L${bx - uy * head * 0.6} ${by + ux * head * 0.6} L${bx + uy * head * 0.6} ${by - ux * head * 0.6} Z` };
}

function Arrows({ cx, cy, from, to, count, tone, head }: { cx: number; cy: number; from: number; to: number; count: number; tone: string; head: number }) {
  const arrows = Array.from({ length: count }, (_, i) => {
    const t = (i / count) * Math.PI * 2 + Math.PI / count, sx = Math.sin(t), sy = -Math.cos(t);
    return arrow(cx + sx * from, cy + sy * from, cx + sx * to, cy + sy * to, head);
  });
  return <g pointerEvents="none">
    {arrows.map((a, i) => <g key={i}><path d={a.line} stroke={tone} strokeWidth="1.6" strokeLinecap="round" /><path d={a.head} fill={tone} /></g>)}
  </g>;
}

function MechanicOutline({ m, entities, C, selected }: { m: Entity; entities: Entity[]; C: number; selected: boolean }) {
  const { point: [ox, oy], anchor } = mechanicOrigin(m, entities);
  const cx = ox * C, cy = oy * C, R = m.radius * C, tone = mechanicTone(m), width = selected ? 2.4 : 1.5;
  const a = (m.rotation * Math.PI) / 180, head = Math.max(4, C * 0.18);
  const ring = (r: number, dashed = true, opacity = 1) => <circle cx={cx} cy={cy} r={r} fill="none" stroke={tone} strokeWidth={width} strokeOpacity={opacity} strokeDasharray={dashed ? '5 4' : undefined} />;
  let shape = null;
  switch (m.kind) {
    case 'circle': shape = ring(R); break;
    case 'flare': shape = <>{ring(R, true, 0.5)}{ring(R * 0.66, true, 0.75)}{ring(R * 0.33)}</>; break;
    case 'spread': shape = <>{ring(R)}<Arrows cx={cx} cy={cy} from={R + 3} to={R + C * 0.7} count={4} tone={tone} head={head} /></>; break;
    case 'stack': shape = <>{ring(R, false)}<Arrows cx={cx} cy={cy} from={R + C * 0.7} to={R + 3} count={4} tone={tone} head={head} /></>; break;
    case 'tower': shape = <>{ring(R, false)}{ring(Math.max(3, R - C * 0.18), false, 0.6)}</>; break;
    case 'knockback': shape = <>{ring(R)}<Arrows cx={cx} cy={cy} from={C * 0.45} to={C * 0.45 + (m.push ?? 2) * C} count={8} tone={tone} head={head} /></>; break;
    case 'donut': shape = <>{ring(R)}<circle cx={cx} cy={cy} r={(m.inner ?? 1) * C} fill="none" stroke={tones.safe} strokeWidth={width} /></>; break;
    case 'cone': {
      const R2 = (m.radius + 0.3) * C, h = Math.PI / 4;
      const p = (t: number) => `${cx + R2 * Math.sin(t)} ${cy - R2 * Math.cos(t)}`;
      shape = <path d={`M${cx} ${cy} L${p(a - h)} A${R2} ${R2} 0 0 1 ${p(a + h)} Z`} fill="none" stroke={tone} strokeWidth={width} strokeDasharray="5 4" />;
      break;
    }
    case 'line': {
      const dx = Math.sin(a), dy = -Math.cos(a), hw = ((m.width ?? 1) / 2) * C, L = (m.radius + 0.3) * C;
      const pt = (along: number, across: number) => `${cx + dx * along - dy * across} ${cy + dy * along + dx * across}`;
      shape = <path d={`M${pt(0, -hw)} L${pt(L, -hw)} L${pt(L, hw)} L${pt(0, hw)} Z`} fill="none" stroke={tone} strokeWidth={width} strokeDasharray="5 4" />;
      break;
    }
    case 'marker': {
      const k = C * 0.55;
      shape = <path d={`M${cx} ${cy - k} L${cx + k} ${cy} L${cx} ${cy + k} L${cx - k} ${cy} Z`} fill="none" stroke={tone} strokeWidth={width} />;
      break;
    }
  }
  return <>
    {shape}
    {!anchor && m.kind !== 'marker' && m.kind !== 'armageddon' && <circle cx={cx} cy={cy} r={Math.max(3, C * 0.12)} fill={tone} stroke="#141819" strokeWidth="1.5" style={{ cursor: 'grab' }} />}
  </>;
}

function MechanicChip({ m, plan, entities, C, selected }: { m: Entity; plan: Plan; entities: Entity[]; C: number; selected: boolean }) {
  const { point: [ox, oy], anchor } = mechanicOrigin(m, entities);
  const a = (m.rotation * Math.PI) / 180;
  let [x, y] = [ox, oy];
  if (m.kind === 'cone' || m.kind === 'line') [x, y] = [ox + Math.sin(a) * m.radius * (m.kind === 'cone' ? 0.88 : 0.55), oy - Math.cos(a) * m.radius * (m.kind === 'cone' ? 0.88 : 0.55)];
  else if (m.kind === 'armageddon') [x, y] = [plan.cols / 2, 0.9];
  else if (m.kind === 'marker') y = oy + 1.25;
  else if (anchor) y = oy + Math.min(m.radius, 1.6) + 0.35; // keep the label off the targeted unit
  const tone = mechanicTone(m), badge = m.kind !== 'marker' && m.turns > 0;
  const label = m.kind === 'tower' ? `${m.name} ×${m.soak ?? 1}` : m.name;
  const w = label.length * 5.9 + (badge ? 30 : 16), h = 22;
  return (
    <g data-entity={m.id} className={`mech-label${selected ? ' selected' : ''}`} transform={`translate(${x * C - w / 2} ${y * C - h / 2})`}>
      <title>{m.kind === 'marker' ? m.name : `${m.name}: ${m.turns === 0 ? 'lasts the phase' : `resolves in ${m.turns} turn${m.turns > 1 ? 's' : ''}`}`}</title>
      <rect width={w} height={h} rx={h / 2} fill="rgba(15,19,20,0.75)" stroke={tone} />
      {badge && <>
        <circle cx={h / 2} cy={h / 2} r={8} fill={tone} />
        <text x={h / 2} y={h / 2 + 0.5} textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="700" fill="#141819">{m.turns}</text>
      </>}
      <text x={badge ? 25 : 8} y={h / 2 + 0.5} dominantBaseline="central" fontSize="10" fontWeight="600" fill={tone}>{label}</text>
    </g>
  );
}

function UnitToken({ u, C, selected }: { u: Entity; C: number; selected: boolean }) {
  const type = unitTypes[u.kind as keyof typeof unitTypes];
  const big = footprint(u) > 1, heavy = big || u.kind === 'miniboss';
  const [cx, cy] = center(u).map(v => v * C);
  // Tokens fill their whole footprint, inset just enough to keep the tile grid visible.
  const tiny = C < 12, inset = Math.min(2, C * 0.08), size = footprint(u) * C - inset * 2, r = size / 2, rx = Math.max(1, C * (big ? 0.18 : 0.14));
  const icon = Math.round(size * (big ? 0.46 : 0.54));
  return (
    <g data-entity={u.id} style={{ cursor: 'grab' }} aria-label={`${u.name}, ${tileLabel(u.x, u.y)}`}>
      {selected && <rect x={cx - r - 3} y={cy - r - 3} width={size + 6} height={size + 6} rx={rx + 3} fill="none" stroke={tones.safe} strokeWidth="2" />}
      <rect x={cx - r} y={cy - r + 1.5} width={size} height={size} rx={rx} fill="rgba(0,0,0,0.35)" />
      {tiny
        ? <rect x={cx - r} y={cy - r} width={size} height={size} rx={rx} fill={type.color} />
        : <rect x={cx - r + 1} y={cy - r + 1} width={size - 2} height={size - 2} rx={rx} fill={type.fill} stroke={type.color} strokeWidth={heavy ? 2.5 : 2} />}
      {!tiny && <svg x={cx - icon / 2} y={cy - icon / 2} width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke={type.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" overflow="visible">
        <path d={glyphs[u.kind]} />
      </svg>}
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
