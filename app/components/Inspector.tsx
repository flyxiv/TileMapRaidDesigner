'use client';
import { Trash2 } from 'lucide-react';
import { unitFacing, aimedAtTargets, markerTypes, type MarkerKind, MAX_RADIUS, MAX_UNIT_SIZE, footprint, isMechanic, isUnit, aims, mechanicFacing, mechanicFields, mechanicTone, mechanicTypes, tileLabel, unitCategories, unitsIn, unitTypes, type UnitCategory, type Entity, type MechanicKind, type Phase, type Plan, type UnitKind } from '../plan';
import { CastTimeField } from './CastTimeField';
import { TargetsField } from './TargetsField';
import { EventIcon } from './EventIcon';
import { Glyph, MarkerIcon } from './glyphs';

type Props = {
  plan: Plan;
  phase: Phase;
  prevPhase: Phase | null;
  entity: Entity | null;
  onChange: (patch: Partial<Entity>, coalesceKey?: string) => void;
  onDelete: () => void;
  onSelect: (id: string) => void;
};

const facings = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const facingLabel = (deg: number) => deg % 45 === 0 ? facings[deg / 45] : `${deg}°`;

export function Inspector({ plan, phase, prevPhase, entity, onChange, onDelete, onSelect }: Props) {
  const mechanics = phase.entities.filter(e => isMechanic(e.kind));
  return (
    <>
      <div className="inspector-block">
        <div className="section-title">Telegraphs this phase</div>
        {mechanics.length === 0 && <p className="hint">No telegraphs yet. Drag one from the palette onto the map.</p>}
        <div className="chip-row">
          {mechanics.map(m => (
            <button key={m.id} type="button" className={`mech-chip${entity?.id === m.id ? ' active' : ''}`} style={{ '--tone': mechanicTone(m) } as React.CSSProperties} aria-pressed={entity?.id === m.id} onClick={() => onSelect(m.id)}>
              <EventIcon kind="mechanic" size={11} />{m.name}
            </button>
          ))}
        </div>
      </div>
      <div className="inspector-block">
        {!entity ? <p className="hint">Select a unit or telegraph on the map to edit it. Arrow keys nudge the selection one tile.</p>
          : isUnit(entity.kind) ? <UnitFields plan={plan} phase={phase} prevPhase={prevPhase} u={entity} onChange={onChange} />
          : <MechanicFields plan={plan} phase={phase} m={entity} onChange={onChange} />}
        {entity && <button type="button" className="delete-button" onClick={onDelete}><Trash2 size={13} /> Delete {isUnit(entity.kind) ? 'unit' : 'telegraph'}</button>}
      </div>
    </>
  );
}

function Header({ label, title, sub, kind, color, round }: { label: string; title: string; sub: string; kind: Entity['kind']; color: string; round: boolean }) {
  return <>
    <div className="eyebrow">{label}</div>
    <div className="selected-title">
      <span className="selected-icon" style={{ borderColor: color, borderRadius: round ? 8 : '50%' }}><Glyph kind={kind} size={20} color={color} /></span>
      <div><h2>{title}</h2><p>{sub}</p></div>
    </div>
  </>;
}

function PositionFields({ plan, e, onChange }: { plan: Plan; e: Entity; onChange: Props['onChange'] }) {
  const s = footprint(e);
  return (
    <div className="field-grid">
      <label className="field">Column
        <select value={e.x} onChange={ev => onChange({ x: Number(ev.target.value) })}>
          {Array.from({ length: plan.cols - s + 1 }, (_, x) => <option key={x} value={x}>{tileLabel(x, 0).replace(/\d+$/, '')}</option>)}
        </select>
      </label>
      <label className="field">Row
        <select value={e.y} onChange={ev => onChange({ y: Number(ev.target.value) })}>
          {Array.from({ length: plan.rows - s + 1 }, (_, y) => <option key={y} value={y}>{y + 1}</option>)}
        </select>
      </label>
    </div>
  );
}

function UnitFields({ plan, phase, prevPhase, u, onChange }: { plan: Plan; phase: Phase; prevPhase: Phase | null; u: Entity; onChange: Props['onChange'] }) {
  const toward = u.faceToward ? phase.entities.find(e => e.id === u.faceToward && isUnit(e.kind)) : undefined;
  const type = unitTypes[u.kind as UnitKind];
  const before = prevPhase?.entities.find(e => e.id === u.id);
  const moved = before && (before.x !== u.x || before.y !== u.y);
  return <>
    <Header label={`Selected ${{ characters: 'character', enemies: 'enemy', neutral: 'neutral unit' }[type.category]}`} title={u.name} sub={`${type.name}${u.code ? ` · ${u.code}` : ''} · ${tileLabel(u.x, u.y)}`} kind={u.kind} color={type.color} round />
    <div className="field-grid">
      <label className="field span-2">Name
        <input value={u.name} maxLength={120} onChange={ev => onChange({ name: ev.target.value }, `name-${u.id}`)} />
      </label>
      <label className="field">Type
        <select value={u.kind} onChange={ev => onChange({ kind: ev.target.value as UnitKind })}>
          {(Object.keys(unitCategories) as UnitCategory[]).map(cat => (
            <optgroup key={cat} label={unitCategories[cat].name}>
              {unitsIn(cat).map(k => <option key={k} value={k}>{unitTypes[k].name}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="field">Label
        <input value={u.code} maxLength={6} onChange={ev => onChange({ code: ev.target.value.toUpperCase() }, `code-${u.id}`)} />
      </label>
      <label className="field span-2">Size
        <select value={u.size ?? ''} onChange={ev => onChange({ size: ev.target.value ? Number(ev.target.value) : undefined })}>
          <option value="">{type.name} default ({type.size} × {type.size})</option>
          {Array.from({ length: MAX_UNIT_SIZE }, (_, i) => i + 1).filter(n => n <= Math.min(plan.cols, plan.rows)).map(n => <option key={n} value={n}>{n} × {n} tiles</option>)}
        </select>
      </label>
    </div>
    <PositionFields plan={plan} e={u} onChange={onChange} />
    <label className="field">Faces
      <select value={toward ? toward.id : ''} onChange={ev => onChange(ev.target.value
        ? { faceToward: ev.target.value }
        : { faceToward: undefined, rotation: unitFacing(u, phase.entities) - (unitFacing(u, phase.entities) % 45) })}>
        <option value="">A direction</option>
        {(Object.keys(unitCategories) as UnitCategory[]).map(cat => {
          const units = phase.entities.filter(e => e.id !== u.id && isUnit(e.kind) && unitTypes[e.kind as UnitKind].category === cat);
          return units.length > 0 && (
            <optgroup key={cat} label={unitCategories[cat].name}>
              {units.map(e => <option key={e.id} value={e.id}>Toward {e.name}</option>)}
            </optgroup>
          );
        })}
      </select>
    </label>
    {toward
      ? <p className="hint">Keeps facing {toward.name} ({facingLabel(unitFacing(u, phase.entities))}), even as either of them moves.</p>
      : (
        <label className="field">
          <span className="field-line">Facing <b>{facingLabel(u.rotation)}</b></span>
          <input type="range" min={0} max={315} step={45} value={u.rotation - (u.rotation % 45)} onChange={ev => onChange({ rotation: Number(ev.target.value) }, `rot-${u.id}`)} />
        </label>
      )}
    <div className="field">
      <span className="field-line">Marker <b>{u.marker ? markerTypes[u.marker].name : 'None'}</b></span>
      <div className="marker-picker" role="group" aria-label="Marker">
        <button type="button" aria-pressed={!u.marker} className={!u.marker ? 'active' : ''} onClick={() => onChange({ marker: undefined })}>None</button>
        {(Object.keys(markerTypes) as MarkerKind[]).map(k => (
          <button key={k} type="button" aria-label={markerTypes[k].name} aria-pressed={u.marker === k} className={u.marker === k ? 'active' : ''} onClick={() => onChange({ marker: k })}><MarkerIcon kind={k} size={16} /></button>
        ))}
      </div>
    </div>
    {moved && <div className="move-note"><span>Moves this phase</span><b>{tileLabel(before.x, before.y)} → {tileLabel(u.x, u.y)}</b></div>}
    {phase.entities.some(e => e.anchor === u.id) && <p className="hint">Telegraphs attached to this unit move with it.</p>}
  </>;
}

function Slider({ label, value, unit, min, max, step, onChange }: { label: string; value: number; unit: string; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="field">
      <span className="field-line">{label} <b>{value} {unit}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={ev => onChange(Number(ev.target.value))} />
    </label>
  );
}

/** A titled group of settings; groups are separated by divider lines. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="field-group" aria-label={title}><div className="field-group-title">{title}</div>{children}</section>;
}

function MechanicFields({ plan, phase, m, onChange }: { plan: Plan; phase: Phase; m: Entity; onChange: Props['onChange'] }) {
  const tone = mechanicTone(m);
  const show = mechanicFields(m.kind);
  const anchor = m.anchor ? phase.entities.find(e => e.id === m.anchor) : undefined;
  const aimed = aimedAtTargets(m, phase.entities);
  const hasSize = show.radius || show.inner || show.width || show.push || show.soak || show.angle;
  return <>
    <Header label="Selected telegraph" title={m.name} sub={`${mechanicTypes[m.kind as MechanicKind].name} · ${mechanicTypes[m.kind as MechanicKind].description}`} kind={m.kind} color={tone} round={false} />
    <Group title="Mechanic">
      <div className="field-grid">
        <label className="field span-2">Name
          <input value={m.name} maxLength={120} onChange={ev => onChange({ name: ev.target.value }, `name-${m.id}`)} />
        </label>
        <label className="field">Shape
          <select value={m.kind} onChange={ev => onChange({ kind: ev.target.value as MechanicKind })}>
            {Object.entries(mechanicTypes).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}
          </select>
        </label>
        {m.kind === 'slash' && (
          <label className="field">Side
            <select value={m.side ?? 'left'} onChange={ev => onChange({ side: ev.target.value as 'left' | 'right' })}>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </label>
        )}
      </div>
      {m.kind === 'armageddon' && <p className="hint">Hits every walkable tile except Marker safe zones in this phase.</p>}
    </Group>

    <Group title="Position">
      {show.origin && (
        <label className="field">Starts from
          <select value={m.anchor ?? ''} onChange={ev => onChange(ev.target.value
            ? { anchor: ev.target.value, ...(aims(m.kind) && m.followFacing === undefined ? { followFacing: true } : {}) }
            : { anchor: undefined, followFacing: undefined, ...(anchor ? { x: anchor.x, y: anchor.y, rotation: mechanicFacing(m, phase.entities) } : {}) })}>
            <option value="">A fixed tile</option>
            {(Object.keys(unitCategories) as UnitCategory[]).map(cat => {
              const units = phase.entities.filter(e => isUnit(e.kind) && unitTypes[e.kind as UnitKind].category === cat);
              return units.length > 0 && (
                <optgroup key={cat} label={unitCategories[cat].name}>
                  {units.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </optgroup>
              );
            })}
          </select>
        </label>
      )}
      {anchor && <p className="hint">Moves with {anchor.name}. Drop a telegraph onto a unit to attach it there.</p>}
      {show.origin && !anchor && <PositionFields plan={plan} e={m} onChange={onChange} />}
      {anchor && aims(m.kind) && !aimed && (
        <label className="check"><input type="checkbox" checked={!!m.followFacing} onChange={ev => onChange({ followFacing: ev.target.checked, ...(ev.target.checked ? {} : { rotation: anchor.rotation }) })} /> Face the way {anchor.name} faces</label>
      )}
      {show.facing && !(anchor && m.followFacing) && !aimed && (
        <label className="field">
          <span className="field-line">Facing <b>{facingLabel(m.rotation)}</b></span>
          <input type="range" min={0} max={345} step={15} value={m.rotation} onChange={ev => onChange({ rotation: Number(ev.target.value) }, `rot-${m.id}`)} />
        </label>
      )}
      <TargetsField phase={phase} value={m.targets} onChange={v => onChange({ targets: v })} />
      {aimed && <p className="hint">Aims from its start toward each target, running its full length (through the target).</p>}
    </Group>

    {hasSize && (
      <Group title="Size">
        {show.radius && <>
          {!m.infinite && <Slider label={m.kind === 'line' ? 'Length' : 'Radius'} value={m.radius} unit="tiles" min={1} max={MAX_RADIUS} step={0.5} onChange={v => onChange({ radius: v, ...(m.inner !== undefined && m.inner >= v ? { inner: Math.max(0.5, v - 0.5) } : {}) }, `radius-${m.id}`)} />}
          <label className="check"><input type="checkbox" checked={!!m.infinite} onChange={ev => onChange({ infinite: ev.target.checked || undefined })} />
            Infinite {m.kind === 'line' ? 'length' : 'radius'} <span className="hint">{aims(m.kind) ? '(runs to the edge of the map)' : '(covers the whole arena)'}</span></label>
        </>}
        {show.width && <Slider label="Width" value={m.width ?? 1} unit={(m.width ?? 1) === 1 ? 'tile' : 'tiles'} min={1} max={8} step={1} onChange={v => onChange({ width: v }, `width-${m.id}`)} />}
        {show.angle && <Slider label="Spread" value={m.angle ?? 90} unit="°" min={15} max={360} step={15} onChange={v => onChange({ angle: v }, `angle-${m.id}`)} />}
        {show.inner && <Slider label="Safe radius" value={m.inner ?? 1} unit="tiles" min={0.5} max={Math.max(0.5, m.radius - 0.5)} step={0.1} onChange={v => onChange({ inner: v }, `inner-${m.id}`)} />}
        {show.push && <Slider label="Push distance" value={m.push ?? 2} unit="tiles" min={1} max={10} step={1} onChange={v => onChange({ push: v }, `push-${m.id}`)} />}
        {show.soak && <Slider label="Players needed" value={m.soak ?? 1} unit={(m.soak ?? 1) === 1 ? 'player' : 'players'} min={1} max={8} step={1} onChange={v => onChange({ soak: v }, `soak-${m.id}`)} />}
      </Group>
    )}

    {m.kind !== 'marker' && (
      <Group title="Timing">
        <CastTimeField value={m.castTime} onChange={(v, key) => onChange({ castTime: v }, key && `${key}-${m.id}`)} />
      </Group>
    )}
  </>;
}
