'use client';
import { Trash2 } from 'lucide-react';
import { footprint, isMechanic, isUnit, mechanicTone, mechanicTypes, tileLabel, unitTypes, type Entity, type MechanicKind, type Phase, type Plan, type UnitKind } from '../plan';
import { Glyph } from './glyphs';

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
        {mechanics.length === 0 && <p className="hint">No telegraphs yet. Pick Circle, Cone or Marker and click the map.</p>}
        <div className="chip-row">
          {mechanics.map(m => (
            <button key={m.id} type="button" className={`mech-chip${entity?.id === m.id ? ' active' : ''}`} style={{ '--tone': mechanicTone(m) } as React.CSSProperties} aria-pressed={entity?.id === m.id} onClick={() => onSelect(m.id)}>
              <span className="mech-badge">{m.kind !== 'marker' && m.turns > 0 ? m.turns : ''}</span>{m.name}
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
      <span className="selected-icon" style={{ borderColor: color, borderRadius: round ? '50%' : 8 }}><Glyph kind={kind} size={20} color={color} /></span>
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
  const type = unitTypes[u.kind as UnitKind];
  const before = prevPhase?.entities.find(e => e.id === u.id);
  const moved = before && (before.x !== u.x || before.y !== u.y);
  return <>
    <Header label="Selected unit" title={u.name} sub={`${type.name}${u.code ? ` · ${u.code}` : ''} · ${tileLabel(u.x, u.y)}`} kind={u.kind} color={type.color} round />
    <div className="field-grid">
      <label className="field span-2">Name
        <input value={u.name} maxLength={120} onChange={ev => onChange({ name: ev.target.value }, `name-${u.id}`)} />
      </label>
      <label className="field">Role
        <select value={u.kind} onChange={ev => onChange({ kind: ev.target.value as UnitKind })}>
          {Object.entries(unitTypes).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}
        </select>
      </label>
      <label className="field">Label
        <input value={u.code} maxLength={6} onChange={ev => onChange({ code: ev.target.value.toUpperCase() }, `code-${u.id}`)} />
      </label>
    </div>
    <PositionFields plan={plan} e={u} onChange={onChange} />
    {moved && <div className="move-note"><span>Moves this phase</span><b>{tileLabel(before.x, before.y)} → {tileLabel(u.x, u.y)}</b></div>}
    {phase.entities.some(e => e.anchor === u.id) && <p className="hint">Telegraphs attached to this unit move with it.</p>}
  </>;
}

function MechanicFields({ plan, phase, m, onChange }: { plan: Plan; phase: Phase; m: Entity; onChange: Props['onChange'] }) {
  const tone = mechanicTone(m);
  const anchor = m.anchor ? phase.entities.find(e => e.id === m.anchor) : undefined;
  return <>
    <Header label="Selected telegraph" title={m.name} sub={`${mechanicTypes[m.kind as MechanicKind].name} · ${mechanicTypes[m.kind as MechanicKind].description}`} kind={m.kind} color={tone} round={false} />
    <div className="field-grid">
      <label className="field span-2">Name
        <input value={m.name} maxLength={120} onChange={ev => onChange({ name: ev.target.value }, `name-${m.id}`)} />
      </label>
      <label className="field">Shape
        <select value={m.kind} onChange={ev => onChange({ kind: ev.target.value as MechanicKind })}>
          {Object.entries(mechanicTypes).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}
        </select>
      </label>
      <label className="field">Origin
        <select value={m.anchor ?? ''} onChange={ev => onChange(ev.target.value ? { anchor: ev.target.value } : { anchor: undefined, ...(anchor ? { x: anchor.x, y: anchor.y } : {}) })}>
          <option value="">Fixed tile</option>
          {phase.entities.filter(e => isUnit(e.kind)).map(e => <option key={e.id} value={e.id}>Follows {e.name}</option>)}
        </select>
      </label>
    </div>
    {!anchor && <PositionFields plan={plan} e={m} onChange={onChange} />}
    <label className="field">
      <span className="field-line">Radius <b>{m.radius} tiles</b></span>
      <input type="range" min={1} max={8} step={0.1} value={m.radius} onChange={ev => onChange({ radius: Number(ev.target.value) }, `radius-${m.id}`)} />
    </label>
    {m.kind === 'cone' && (
      <label className="field">
        <span className="field-line">Facing <b>{facingLabel(m.rotation)}</b></span>
        <input type="range" min={0} max={345} step={15} value={m.rotation} onChange={ev => onChange({ rotation: Number(ev.target.value) }, `rot-${m.id}`)} />
      </label>
    )}
    <div className="field">
      <span className="field-line">Resolves in <b>{m.turns === 0 ? 'Lasts the phase' : m.turns === 1 ? 'Next turn' : `${m.turns} turns`}</b></span>
      <div className="turn-steps" role="group" aria-label="Resolves in">
        {[0, 1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" aria-pressed={m.turns === n} className={m.turns === n ? 'active' : ''} style={m.turns === n ? { background: tone } : undefined} onClick={() => onChange({ turns: n })}>
            {n === 0 ? '∞' : n}
          </button>
        ))}
      </div>
    </div>
  </>;
}
