'use client';
import { forwardRef, useId, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { waymarkId, waymarkTypes, type WaymarkKey, aimedAtTargets, lineSegments, castLabel, reach, aims, mechanicTypes, type ActionStep, type MechanicKind, center, colLabel, mechanicFacing, footprint, hazardTiles, isMechanic, isUnit, mechanicOrigin, mechanicTone, terrainTypes, tileLabel, tones, unitTypes, type Entity, type Plan } from '../plan';
import { MarkerShape, glyphs } from './glyphs';
import { SpeechBubble, type Speech } from './SpeechBubble';

/**
 * `point` is the pointer in tile units (fractional); `handle` is set when a press starts on the selection's
 * transform box: a corner (resize) or the rotation handle.
 */
export type TransformHandle = 'rotate' | 'nw' | 'ne' | 'sw' | 'se';
export type MapPointer = {
  type: 'down' | 'move' | 'up'; tile: [number, number] | null; point: [number, number] | null;
  entityId?: string; waymark?: WaymarkKey; handle?: { id: string; kind: TransformHandle }; event: ReactPointerEvent<SVGSVGElement>;
};

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
  /** Show resize and rotate handles on the selected unit or telegraph. */
  transform?: boolean;
  /** Action step to preview: `from` is the actor as it stands before the action plays. */
  stage?: { step: ActionStep; from: Entity; text: string; rotation?: number } | null;
  /** Dialogue line to show as a bubble over its speaker. */
  speech?: Speech | null;
  onPointer?: (p: MapPointer) => void;
  onLeave?: () => void;
  /** Right-click on a unit or telegraph (screen position for a menu). */
  onEntityMenu?: (id: string, x: number, y: number) => void;
  /** Drag-and-drop from outside the map: the tile under the cursor while dragging (null when it leaves), and the drop tile. */
  onDragTile?: (tile: [number, number] | null) => void;
  onDropTile?: (tile: [number, number]) => void;
  className?: string;
};

const terrainFill: Record<string, string> = {
  floor: terrainTypes.floor.color, wall: terrainTypes.wall.color, water: 'url(#rd-water)', lava: 'url(#rd-lava)', grass: terrainTypes.grass.color, void: 'transparent',
};

export const BattleMap = forwardRef<SVGSVGElement, Props>(function BattleMap(
  { plan, phaseIndex, cell: C, coords = true, showMoves = true, showTerrain = true, showTelegraphs = true, selectedId, highlight, speech, stage, transform, onPointer, onLeave, onEntityMenu, onDragTile, onDropTile, className }, ref,
) {
  const phase = plan.phases[phaseIndex];
  const prev = phaseIndex > 0 ? plan.phases[phaseIndex - 1] : null;
  const G = coords ? 20 : 0;
  const W = plan.cols * C + G, H = plan.rows * C + G;
  const units = phase.entities.filter(e => isUnit(e.kind));
  const mechanics = phase.entities.filter(e => isMechanic(e.kind));
  const hazards = mechanics.map(m => ({ m, tiles: hazardTiles(m, phase, plan) }));
  const clipId = useId().replace(/:/g, '');
  const selected = selectedId ? phase.entities.find(e => e.id === selectedId && e.kind !== 'armageddon') : undefined;

  const toTile = (e: ReactMouseEvent<SVGSVGElement>): [number, number] | null => {
    const svg = e.currentTarget, ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const x = Math.floor((pt.x - G) / C), y = Math.floor((pt.y - G) / C);
    return x >= 0 && y >= 0 && x < plan.cols && y < plan.rows ? [x, y] : null;
  };
  const handle = (type: MapPointer['type']) => onPointer && ((event: ReactPointerEvent<SVGSVGElement>) => {
    const target = (event.target as Element).closest('[data-entity]');
    const grip = (event.target as Element).closest('[data-handle]');
    const mark = (event.target as Element).closest('[data-waymark]')?.getAttribute('data-waymark') as WaymarkKey | null | undefined;
    const ctm = event.currentTarget.getScreenCTM();
    const pt = ctm && new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    const point: [number, number] | null = pt ? [(pt.x - G) / C, (pt.y - G) / C] : null;
    if (type === 'down') event.currentTarget.setPointerCapture(event.pointerId);
    onPointer({
      type, tile: toTile(event), point, event,
      entityId: type === 'down' ? target?.getAttribute('data-entity') ?? undefined : undefined,
      waymark: type === 'down' && mark ? mark : undefined,
      handle: type === 'down' && grip ? { id: grip.getAttribute('data-for')!, kind: grip.getAttribute('data-handle') as TransformHandle } : undefined,
    });
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
      onContextMenu={onEntityMenu && (e => {
        const el = (e.target as Element).closest('[data-entity], [data-waymark]');
        const id = el?.getAttribute('data-entity') ?? (el ? waymarkId(el.getAttribute('data-waymark') as WaymarkKey) : null);
        if (id) { e.preventDefault(); onEntityMenu(id, e.clientX, e.clientY); }
      })}
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

        <clipPath id={`rd-clip-${clipId}`}><rect x={0} y={0} width={plan.cols * C} height={plan.rows * C} /></clipPath>
        {showTelegraphs && hazards.map(({ m, tiles }) => (
          <g key={m.id} data-entity={m.id} opacity={selectedId && selectedId !== m.id ? 0.8 : 1} clipPath={`url(#rd-clip-${clipId})`}>
            {tiles.map(([x, y, strength]) => <HazardTile key={`${x},${y}`} m={m} x={x} y={y} strength={strength} C={C} />)}
            <MechanicOutline m={m} entities={phase.entities} C={C} selected={selectedId === m.id} />
          </g>
        ))}

        {/* World markers lie on the floor: over telegraph shading, under units. */}
        {(Object.keys(phase.waymarks ?? {}) as WaymarkKey[]).map(k => <Waymark key={k} k={k} at={phase.waymarks![k]!} C={C} selected={selectedId === waymarkId(k)} />)}

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

        {units.map(u => <UnitToken key={u.id} u={u} C={C} />)}

        {/* Head markers float above their unit, drawn over every token so a neighbour never hides one. */}
        {C >= 12 && units.map(u => u.marker && <HeadMarker key={`mark-${u.id}`} u={u} C={C} />)}

        {showTelegraphs && mechanics.flatMap(m => (m.targets ?? []).flatMap(id => {
          const u = units.find(x => x.id === id);
          return u ? [<TargetMark key={`${m.id}-${id}`} u={u} C={C} tone={mechanicTone(m)} />] : [];
        }))}

        {transform && selected && <TransformBox e={selected} entities={phase.entities} C={C} />}

        {stage && <StageMarker stage={stage} C={C} />}

        {speech && <SpeechBubble speech={speech} units={units} C={C} mapWidth={plan.cols * C} gutter={G} />}

      </g>
    </svg>
  );
});

function HazardTile({ m, x, y, strength, C }: { m: Entity; x: number; y: number; strength: number; C: number }) {
  if (m.kind === 'marker') return <rect x={x * C + 0.5} y={y * C + 0.5} width={C - 1} height={C - 1} fill="rgba(198,235,149,0.2)" stroke="rgba(198,235,149,0.35)" />;
  if (m.kind === 'tower') return <rect x={x * C + 0.5} y={y * C + 0.5} width={C - 1} height={C - 1} fill="rgba(134,197,242,0.22)" stroke="rgba(134,197,242,0.4)" />;
  const fill = m.kind === 'stack' ? 'url(#rd-share)' : 'url(#rd-tele)';
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
  const cx = ox * C, cy = oy * C, R = reach(m) * C, tone = mechanicTone(m), width = selected ? 2.4 : 1.5;
  const a = (mechanicFacing(m, entities) * Math.PI) / 180, head = Math.max(4, C * 0.18);
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
      const R2 = (reach(m) + 0.3) * C, spread = Math.min(360, m.angle ?? 90), h = (spread * Math.PI) / 360;
      const p = (t: number) => `${cx + R2 * Math.sin(t)} ${cy - R2 * Math.cos(t)}`;
      shape = spread >= 360
        ? <circle cx={cx} cy={cy} r={R2} fill="none" stroke={tone} strokeWidth={width} strokeDasharray="5 4" />
        : <path d={`M${cx} ${cy} L${p(a - h)} A${R2} ${R2} 0 ${spread > 180 ? 1 : 0} 1 ${p(a + h)} Z`} fill="none" stroke={tone} strokeWidth={width} strokeDasharray="5 4" />;
      break;
    }
    case 'line': {
      // One band per target (ending at it), or one along the facing.
      const hw = ((m.width ?? 1) / 2) * C;
      shape = <>{lineSegments(m, entities).map(({ dir: [dx, dy], length }, i) => {
        const L = (length + 0.3) * C;
        const pt = (along: number, across: number) => `${cx + dx * along - dy * across} ${cy + dy * along + dx * across}`;
        return <path key={i} d={`M${pt(0, -hw)} L${pt(L, -hw)} L${pt(L, hw)} L${pt(0, hw)} Z`} fill="none" stroke={tone} strokeWidth={width} strokeDasharray="5 4" />;
      })}</>;
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
  const a = (mechanicFacing(m, entities) * Math.PI) / 180;
  let [x, y] = [ox, oy];
  const labelAt = Math.min(reach(m), 4) * (m.kind === 'cone' ? 0.88 : 0.55);
  if (m.kind === 'line') { const [s] = lineSegments(m, entities); if (s) [x, y] = [ox + s.dir[0] * Math.min(s.length * 0.5, labelAt), oy + s.dir[1] * Math.min(s.length * 0.5, labelAt)]; }
  else if (m.kind === 'cone') [x, y] = [ox + Math.sin(a) * labelAt, oy - Math.cos(a) * labelAt];
  else if (m.kind === 'armageddon') [x, y] = [plan.cols / 2, 0.9];
  else if (m.kind === 'marker') y = oy + 1.25;
  else if (m.infinite) y = oy + 1.2;
  else if (anchor) y = oy + Math.min(m.radius, 1.6) + 0.35; // keep the label off the targeted unit
  const tone = mechanicTone(m);
  const label = [m.kind === 'tower' ? `${m.name} ×${m.soak ?? 1}` : m.name, castLabel(m)].filter(Boolean).join(' · ');
  const w = label.length * 5.9 + 16, h = 22;
  return (
    <g data-entity={m.id} className={`mech-label${selected ? ' selected' : ''}`} transform={`translate(${x * C - w / 2} ${y * C - h / 2})`}>
      <title>{`${m.name}: ${mechanicTypes[m.kind as MechanicKind].description}`}</title>
      <rect width={w} height={h} rx={h / 2} fill="rgba(15,19,20,0.75)" stroke={tone} />
      <text x={8} y={h / 2 + 0.5} dominantBaseline="central" fontSize="10" fontWeight="600" fill={tone}>{label}</text>
    </g>
  );
}

const compass = (deg: number) => deg % 45 === 0 ? ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][deg / 45] : `${deg}°`;

function UnitToken({ u, C }: { u: Entity; C: number }) {
  const type = unitTypes[u.kind as keyof typeof unitTypes];
  const big = footprint(u) > 1, heavy = big || u.kind === 'miniboss';
  const [cx, cy] = center(u).map(v => v * C);
  // Tokens fill their whole footprint, inset just enough to keep the tile grid visible.
  const tiny = C < 12, inset = Math.min(2, C * 0.08), size = footprint(u) * C - inset * 2, r = size / 2, rx = Math.max(1, C * (big ? 0.18 : 0.14));
  const icon = Math.round(size * (big ? 0.46 : 0.54));
  // Facing, in compass degrees (0 = up): the icon turns with it and a notch marks the front edge.
  const turn = `rotate(${u.rotation} ${cx} ${cy})`, notch = Math.max(3, Math.min(C * 0.2, r * 0.35));
  return (
    <g data-entity={u.id} style={{ cursor: 'grab' }} aria-label={`${u.name}, ${tileLabel(u.x, u.y)}, facing ${compass(u.rotation)}`}>
      <rect x={cx - r} y={cy - r + 1.5} width={size} height={size} rx={rx} fill="rgba(0,0,0,0.35)" />
      {tiny
        ? <rect x={cx - r} y={cy - r} width={size} height={size} rx={rx} fill={type.color} />
        : <rect x={cx - r + 1} y={cy - r + 1} width={size - 2} height={size - 2} rx={rx} fill={type.fill} stroke={type.color} strokeWidth={heavy ? 2.5 : 2} />}
      {!tiny && <g transform={turn}>
        <svg x={cx - icon / 2} y={cy - icon / 2} width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke={type.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" overflow="visible">
          <path d={glyphs[u.kind]} />
        </svg>
        <path d={`M${cx} ${cy - r + 2.5} L${cx + notch} ${cy - r + 2.5 + notch} L${cx - notch} ${cy - r + 2.5 + notch} Z`} fill={type.color} />
      </g>}
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

const resizeCursor: Record<TransformHandle, string> = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', rotate: 'grab' };

/** Handle square; the larger transparent square under it is the hit area. */
function Grip({ x, y, id, kind }: { x: number; y: number; id: string; kind: TransformHandle }) {
  return (
    <g data-handle={kind} data-for={id} style={{ cursor: resizeCursor[kind] }}>
      <rect x={x - 9} y={y - 9} width={18} height={18} fill="transparent" />
      <rect x={x - 4.5} y={y - 4.5} width={9} height={9} fill="#eef1ef" stroke="#141819" strokeWidth="1.2" />
    </g>
  );
}

/**
 * Selection box with corner handles that resize and, for units and directional telegraphs, a stem with a rotation
 * handle pointing the way it faces. Units resize by whole tiles; telegraphs change their radius.
 */
function TransformBox({ e, entities, C }: { e: Entity; entities: Entity[]; C: number }) {
  const unit = isUnit(e.kind);
  const [ox, oy] = unit ? center(e) : mechanicOrigin(e, entities).point;
  const cx = ox * C, cy = oy * C;
  const half = unit ? (footprint(e) * C) / 2 + 3 : e.infinite ? C * 0.6 : e.radius * C;
  // A telegraph that follows its unit's facing is aimed by rotating the unit instead.
  // Targeted lines aim themselves at their targets: they keep their length handles but have nothing to rotate.
  const aimed = aimedAtTargets(e, entities);
  const rotates = unit || (aims(e.kind) && !(e.followFacing && e.anchor) && !aimed);
  const a = ((unit ? e.rotation : mechanicFacing(e, entities)) * Math.PI) / 180, dx = Math.sin(a), dy = -Math.cos(a);
  // The stem leaves the box edge in the facing direction.
  const edge = half / Math.max(Math.abs(dx), Math.abs(dy)), stem = Math.max(22, C * 0.8);
  const sx = cx + dx * edge, sy = cy + dy * edge, hx = cx + dx * (edge + stem), hy = cy + dy * (edge + stem);
  return (
    <g className="transform-box">
      <rect x={cx - half} y={cy - half} width={half * 2} height={half * 2} fill="none" stroke="#eef1ef" strokeOpacity="0.85" strokeWidth="1" pointerEvents="none" />
      {rotates && <line x1={sx} y1={sy} x2={hx} y2={hy} stroke="#eef1ef" strokeOpacity="0.85" strokeWidth="1" pointerEvents="none" />}
      {!e.infinite && <>
        <Grip x={cx - half} y={cy - half} id={e.id} kind="nw" />
        <Grip x={cx + half} y={cy - half} id={e.id} kind="ne" />
        <Grip x={cx - half} y={cy + half} id={e.id} kind="sw" />
        <Grip x={cx + half} y={cy + half} id={e.id} kind="se" />
      </>}
      {rotates && <Grip x={hx} y={hy} id={e.id} kind="rotate" />}
    </g>
  );
}

const STAGE = '#c6b3ff';

/** Preview of an action step: where the actor walks, which way it turns, or what it does, with a caption. */
function StageMarker({ stage, C }: { stage: { step: ActionStep; from: Entity; text: string; rotation?: number }; C: number }) {
  const { step, from, text } = stage, a = step.action;
  const size = footprint(from) * C, half = size / 2;
  const [cx, cy] = center(from).map(v => v * C);
  const head = Math.max(5, C * 0.22);
  let marks = null;
  if (a.kind === 'move') {
    const tx = (a.x + footprint(from) / 2) * C, ty = (a.y + footprint(from) / 2) * C;
    const len = Math.hypot(tx - cx, ty - cy);
    if (len > 1) {
      const ux = (tx - cx) / len, uy = (ty - cy) / len, edge = half / Math.max(Math.abs(ux), Math.abs(uy));
      const ar = arrow(cx + ux * edge, cy + uy * edge, tx - ux * (edge + 2), ty - uy * (edge + 2), head);
      marks = <>
        <rect x={a.x * C + 2} y={a.y * C + 2} width={size - 4} height={size - 4} rx={Math.max(3, C * 0.14)} fill="rgba(198,179,255,0.12)" stroke={STAGE} strokeWidth="1.5" strokeDasharray="4 3" />
        <path d={ar.line} stroke={STAGE} strokeWidth="2" strokeLinecap="round" /><path d={ar.head} fill={STAGE} />
      </>;
    }
  } else if (a.kind === 'face' && stage.rotation !== undefined) {
    const t = (stage.rotation * Math.PI) / 180, ux = Math.sin(t), uy = -Math.cos(t), edge = half / Math.max(Math.abs(ux), Math.abs(uy));
    const ar = arrow(cx + ux * (edge + 3), cy + uy * (edge + 3), cx + ux * (edge + C * 1.2), cy + uy * (edge + C * 1.2), head);
    marks = <><path d={ar.line} stroke={STAGE} strokeWidth="2" strokeLinecap="round" /><path d={ar.head} fill={STAGE} /></>;
  }
  const w = Math.min(260, text.length * 6 + 20), capY = from.y * C - (footprint(from) > 1 && C >= 22 ? 30 : 8);
  return (
    <g pointerEvents="none">
      <rect x={cx - half - 3} y={cy - half - 3} width={size + 6} height={size + 6} rx={Math.max(4, C * 0.18)} fill="none" stroke={STAGE} strokeWidth="1.5" />
      {marks}
      <g transform={`translate(${cx - w / 2} ${capY - 20})`}>
        <rect width={w} height={20} rx={10} fill="rgba(15,19,20,0.92)" stroke={STAGE} />
        <text x={w / 2} y={10.5} textAnchor="middle" dominantBaseline="central" fontSize="10.5" fontStyle="italic" fontWeight="600" fill={STAGE}>{text}</text>
      </g>
    </g>
  );
}

/** A reticle around a unit a telegraph targets. */
function TargetMark({ u, C, tone }: { u: Entity; C: number; tone: string }) {
  const [cx, cy] = center(u).map(v => v * C);
  const r = (footprint(u) * C) / 2 + 4, t = Math.max(3, C * 0.18);
  return (
    <g pointerEvents="none" className="target-mark">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={tone} strokeWidth="1.8" strokeDasharray="4 3" />
      <path d={`M${cx} ${cy - r - t} V${cy - r + t} M${cx} ${cy + r - t} V${cy + r + t} M${cx - r - t} ${cy} H${cx - r + t} M${cx + r - t} ${cy} H${cx + r + t}`} stroke={tone} strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

/** A unit's head marker, centred on the top edge of its token with a white outline. */
function HeadMarker({ u, C }: { u: Entity; C: number }) {
  if (!u.marker) return null;
  const size = Math.max(14, Math.min(26, C * 0.75));
  const [cx] = center(u).map(v => v * C);
  const edge = u.y * C + 2; // the token's top edge
  return (
    <g pointerEvents="none" className="head-marker">
      <svg x={cx - size / 2} y={edge - size * 0.62} width={size} height={size} viewBox="0 0 24 24" overflow="visible"><MarkerShape kind={u.marker} edge="#ffffff" edgeWidth={1.8} /></svg>
    </g>
  );
}

/** A world marker: a translucent circle (A–D) or square (1–4) with its letter or number. */
function Waymark({ k, at: [x, y], C, selected }: { k: WaymarkKey; at: [number, number]; C: number; selected: boolean }) {
  const { color } = waymarkTypes[k];
  const cx = (x + 0.5) * C, cy = (y + 0.5) * C, r = C * 0.44;
  const outline = { fill: color, fillOpacity: 0.22, stroke: color, strokeWidth: Math.max(1.5, C * 0.07) };
  return (
    <g data-waymark={k} className="waymark" aria-label={`Waymark ${k}`}>
      {selected && <rect x={x * C - 2} y={y * C - 2} width={C + 4} height={C + 4} rx={4} fill="none" stroke="#e8f5d8" strokeWidth="1.5" strokeDasharray="4 3" />}
      <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} rx={C * 0.06} {...outline} />
      {C >= 12 && <text x={cx} y={cy + 0.5} textAnchor="middle" dominantBaseline="central" fontSize={C * 0.52} fontWeight="800" fill="#fff" stroke={color} strokeWidth={C * 0.06} paintOrder="stroke">{k}</text>}
    </g>
  );
}
