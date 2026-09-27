'use client';
import { ArrowDown, ArrowUp, GripVertical, Map as MapIcon, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  MAX_RADIUS, MAX_UNIT_SIZE, aims, center, clampEntity, createMechanic, diagramPlan, entityAt, footprint, isMechanic, isUnit, mechanicOrigin, mechanicTone, mechanicTypes,
  nextCode, setWaymark, terrainTypes, uid, unitTypes, waymarkId, waymarkKeys, waymarkOf, type WaymarkKey, type Diagram, type Entity, type MechanicKind, type Terrain, type UnitKind,
} from '../plan';
import { BattleMap, type MapPointer, type TransformHandle } from './BattleMap';
import { Glyph, WaymarkIcon } from './glyphs';

type Tool = { type: 'select' } | { type: 'erase' } | { type: 'terrain'; terrain: Terrain } | { type: 'unit'; kind: UnitKind } | { type: 'mechanic'; kind: MechanicKind } | { type: 'waymark'; key: WaymarkKey };
type Gesture = { mode: 'drag' | 'paint' | 'rotate' | 'resize' | 'waymark'; waymark?: WaymarkKey; id?: string; offset?: [number, number]; corner?: TransformHandle };

type Props = {
  diagram: Diagram;
  index: number;
  count: number;
  /** Edits fold into one undo step per gesture through the shared coalescing key. */
  onChange: (fn: (d: Diagram) => Diagram, coalesceKey?: string) => void;
  onMove: (by: number) => void;
  onDelete: () => void;
  /** The selected unit or telegraph on this map (owned by the page, which shows its details). */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Drag-to-reorder wiring from the page's block list. */
  cardRef?: (el: HTMLElement | null) => void;
  cardClass?: string;
  handleProps?: React.HTMLAttributes<HTMLElement>;
};

/** A compact map editor for one illustration on a mechanic page: paint terrain, place, move, resize and rotate. */
export function DiagramEditor({ diagram: d, index, count, onChange, onMove, onDelete, selectedId, onSelect: setSelectedId, cardRef, cardClass = '', handleProps }: Props) {
  // The mouse on the map always selects and moves; palette items are dragged onto the map instead.
  const [dragItem, setDragItem] = useState<Tool | null>(null);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const plan = diagramPlan(d), phase = plan.phases[0];
  const selected = d.entities.find(e => e.id === selectedId) ?? null;
  const cell = Math.max(12, Math.min(26, Math.floor(540 / (d.cols + 1))));
  const key = `diagram-${d.id}`;

  const setEntities = (fn: (entities: Entity[], dd: Diagram) => Entity[], k = key) => onChange(x => ({ ...x, entities: fn(x.entities, x) }), k);
  const patch = (id: string, p: Partial<Entity>, k?: string) => setEntities((es, x) => es.map(e => e.id === id ? clampEntity({ ...e, ...p }, diagramPlan(x)) : e), k);
  const selectedMark = waymarkOf(selectedId);
  const placeMark = (k: WaymarkKey, tile: [number, number] | null, kk = `${key}-waymark`) => onChange(x => setWaymark(x, k, tile), kk);
  const remove = (id: string) => {
    const w = waymarkOf(id);
    if (w) { placeMark(w, null, `${key}-delete`); setSelectedId(null); return; } setEntities(es => es.filter(e => e.id !== id).map(e => e.anchor === id ? { ...e, anchor: undefined } : e), `${key}-delete`); if (selectedId === id) setSelectedId(null); };

  const onPointer = (p: MapPointer) => {
    if (p.type === 'up') { gesture.current = null; return; }
    if (p.type === 'down') sectionRef.current?.focus({ preventScroll: true });
    if (p.type === 'move') {
      setHover(p.tile);
      const g = gesture.current;
      if (!g) return;
      const target = g.id ? d.entities.find(e => e.id === g.id) : undefined;
      if (g.mode === 'rotate' && target && p.point) {
        const [cx, cy] = isUnit(target.kind) ? center(target) : mechanicOrigin(target, d.entities).point;
        const step = isUnit(target.kind) ? 45 : 15, deg = (Math.atan2(p.point[0] - cx, -(p.point[1] - cy)) * 180) / Math.PI;
        const rotation = ((Math.round(deg / step) * step) % 360 + 360) % 360;
        if (rotation !== target.rotation || target.faceToward) patch(target.id, { rotation, faceToward: undefined });
      }
      if (g.mode === 'resize' && target && p.point && g.corner) {
        if (isUnit(target.kind)) {
          const s = footprint(target), left = g.corner === 'nw' || g.corner === 'sw', top = g.corner === 'nw' || g.corner === 'ne';
          const ax = left ? target.x + s : target.x, ay = top ? target.y + s : target.y;
          const size = Math.max(1, Math.min(MAX_UNIT_SIZE, d.cols, d.rows, Math.round(Math.max(Math.abs(p.point[0] - ax), Math.abs(p.point[1] - ay)))));
          if (size !== s) patch(target.id, { size: size === unitTypes[target.kind as UnitKind].size ? undefined : size, x: left ? ax - size : ax, y: top ? ay - size : ay });
        } else {
          const [cx, cy] = mechanicOrigin(target, d.entities).point;
          const radius = Math.max(1, Math.min(MAX_RADIUS, Math.round((Math.hypot(p.point[0] - cx, p.point[1] - cy) / Math.SQRT2) * 2) / 2));
          if (radius !== target.radius) patch(target.id, { radius, ...(target.inner !== undefined && target.inner >= radius ? { inner: Math.max(0.5, radius - 0.5) } : {}) });
        }
      }
      if (!p.tile) return;
      if (g.mode === 'waymark' && g.waymark) { const at = d.waymarks?.[g.waymark]; if (!at || at[0] !== p.tile[0] || at[1] !== p.tile[1]) placeMark(g.waymark, p.tile); return; }
      if (g.mode === 'drag' && target && g.offset) {
        const [x, y] = [p.tile[0] - g.offset[0], p.tile[1] - g.offset[1]];
        if (x !== target.x || y !== target.y) patch(target.id, { x, y });
      }
      return;
    }
    const tile = p.tile;
    const hit = p.entityId ? d.entities.find(e => e.id === p.entityId) : tile ? entityAt(phase, ...tile) : undefined;
    if (p.handle) { gesture.current = p.handle.kind === 'rotate' ? { mode: 'rotate', id: p.handle.id } : { mode: 'resize', id: p.handle.id, corner: p.handle.kind }; return; }
    if (p.waymark && !(hit && isUnit(hit.kind))) { setSelectedId(waymarkId(p.waymark)); gesture.current = { mode: 'waymark', waymark: p.waymark }; return; }
    setSelectedId(hit?.id ?? null);
    if (hit && tile && !(isMechanic(hit.kind) && hit.anchor)) gesture.current = { mode: 'drag', id: hit.id, offset: [tile[0] - hit.x, tile[1] - hit.y] };
  };
  const placeAt = (item: Tool, tile: [number, number]) => {
    if (item.type === 'waymark') { placeMark(item.key, tile, `${key}-add`); setSelectedId(waymarkId(item.key)); return; }
    let e: Entity;
    if (item.type === 'unit') {
      const { code, name } = nextCode(phase, item.kind);
      e = clampEntity({ id: uid(item.kind), kind: item.kind, name, code, x: tile[0], y: tile[1], radius: 1, rotation: 0 }, plan);
    } else if (item.type === 'mechanic') {
      e = createMechanic(item.kind, tile[0], tile[1]);
      const on = entityAt(phase, ...tile);
      if (on && isUnit(on.kind) && item.kind !== 'armageddon') e = { ...e, anchor: on.id, ...(aims(item.kind) ? { followFacing: true } : {}) };
    } else return;
    setEntities(es => [...es, e], `${key}-add`);
    setSelectedId(e.id);
  };
  const paint = ([x, y]: [number, number], terrain: Terrain) => {
    if (d.terrain[y][x] === terrain) return;
    onChange(dd => ({ ...dd, terrain: dd.terrain.map((row, ry) => ry === y ? row.map((t, rx) => rx === x ? terrain : t) : row) }), `${key}-paint`);
  };

  const placing = dragItem && (dragItem.type === 'unit' || dragItem.type === 'mechanic') ? dragItem : null;
  const highlight = hover && dragItem?.type === 'terrain' ? { x: hover[0], y: hover[1], size: 1 }
    : hover && placing ? { x: Math.min(hover[0], d.cols - footprint(placing)), y: Math.min(hover[1], d.rows - footprint(placing)), size: footprint(placing) } : null;
  const toolButton = (t: Tool, label: string, icon: React.ReactNode) => (
    <button key={label} type="button" className="diagram-tool" aria-label={label} title={`Drag onto the map: ${label.toLowerCase()}`} draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', t.type); setDragItem(t); }}
      onDragEnd={() => { setDragItem(null); setHover(null); }}>{icon}</button>
  );

  return (
    <section ref={el => { sectionRef.current = el; cardRef?.(el); }} tabIndex={-1} className={`diagram page-block${cardClass}`} aria-label={d.caption || `Map ${index + 1}`}
      onKeyDown={e => { if ((e.key === 'Delete' || e.key === 'Backspace') && (selected || selectedMark) && !(e.target as HTMLElement).closest('input, textarea, select')) { e.preventDefault(); remove(selected?.id ?? selectedId!); } }}>
      <header className="diagram-head">
        {handleProps && <button type="button" className="drag-handle" aria-label={`Reorder ${d.caption || `block ${index + 1}`}`} title="Drag to reorder (or focus and use the arrow keys)" {...handleProps}><GripVertical size={15} /></button>}
        <span className="line-number" title="Map"><MapIcon size={11} /></span>
        <input aria-label="Map caption" className="conversation-title" value={d.caption} maxLength={200} placeholder={`Map ${index + 1}`} onChange={e => onChange(x => ({ ...x, caption: e.target.value }), `${key}-caption`)} />
        <div className="story-tools">
          <button type="button" className="icon-button" aria-label="Move block up" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={13} /></button>
          <button type="button" className="icon-button" aria-label="Move block down" disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown size={13} /></button>
          <button type="button" className="icon-button danger" aria-label="Delete map" onClick={() => { if (confirm(`Delete "${d.caption || `Map ${index + 1}`}"?`)) onDelete(); }}><Trash2 size={13} /></button>
        </div>
      </header>
      <div className="diagram-tools" role="toolbar" aria-label="Drag onto the map">
        {(Object.keys(terrainTypes) as Terrain[]).map(t => toolButton({ type: 'terrain', terrain: t }, `Paint ${terrainTypes[t].name}`, <span className={`swatch mini ${t}`} />))}
        <span className="divider" />
        {(Object.keys(unitTypes) as UnitKind[]).map(k => toolButton({ type: 'unit', kind: k }, `Place ${unitTypes[k].name}`, <Glyph kind={k} size={14} color={unitTypes[k].color} strokeWidth={2.2} />))}
        <span className="divider" />
        {(Object.keys(mechanicTypes) as MechanicKind[]).map(k => toolButton({ type: 'mechanic', kind: k }, `Place ${mechanicTypes[k].name}`, <Glyph kind={k} size={14} color={mechanicTone({ kind: k })} />))}
        <span className="divider" />
        {waymarkKeys.map(k => toolButton({ type: 'waymark', key: k }, `Place waymark ${k}`, <WaymarkIcon k={k} size={16} />))}
      </div>
      <div className="diagram-map">
        <BattleMap className="battlemap" plan={plan} phaseIndex={0} cell={cell} showMoves={false} selectedId={selectedId}
          transform highlight={highlight} onPointer={onPointer} onLeave={() => setHover(null)}
          onDragTile={tile => { setHover(tile); if (tile && dragItem?.type === 'terrain') paint(tile, dragItem.terrain); }}
          onDropTile={tile => { if (dragItem) placeAt(dragItem, tile); setDragItem(null); }} />
      </div>
      {selectedMark && (
        <div className="diagram-selection">
          <b>Waymark {selectedMark}</b>
          <span>World marker</span>
          <button type="button" className="text-button danger" onClick={() => remove(waymarkId(selectedMark))}><Trash2 size={12} /> Remove</button>
        </div>
      )}
      {selected && (
        <div className="diagram-selection">
          <b>{selected.name}</b>
          <span>{isUnit(selected.kind) ? unitTypes[selected.kind as UnitKind].name : mechanicTypes[selected.kind as MechanicKind].name}</span>
          <button type="button" className="icon-button" aria-label="Rotate left" onClick={() => patch(selected.id, { rotation: (selected.rotation + (isUnit(selected.kind) ? 315 : 345)) % 360, faceToward: undefined }, `${key}-rot`)}><RotateCcw size={13} /></button>
          <button type="button" className="icon-button" aria-label="Rotate right" onClick={() => patch(selected.id, { rotation: (selected.rotation + (isUnit(selected.kind) ? 45 : 15)) % 360, faceToward: undefined }, `${key}-rot`)}><RotateCw size={13} /></button>
          <button type="button" className="text-button danger" onClick={() => remove(selected.id)}><Trash2 size={12} /> Remove</button>
        </div>
      )}
    </section>
  );
}
