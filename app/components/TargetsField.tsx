import { Crosshair } from 'lucide-react';
import { isUnit, unitTypes, type Entity, type Phase, type UnitKind } from '../plan';

/** Optional targets for a telegraph: toggle any unit in the phase. */
export function TargetsField({ phase, value, onChange }: { phase: Phase; value: string[] | undefined; onChange: (v: string[] | undefined) => void }) {
  const units = phase.entities.filter((e): e is Entity => isUnit(e.kind));
  const picked = new Set(value ?? []);
  const toggle = (id: string) => {
    const next = picked.has(id) ? [...picked].filter(x => x !== id) : [...picked, id];
    onChange(next.length ? next : undefined);
  };
  return (
    <div className="targets-field" role="group" aria-label="Targets">
      <span className="targets-label"><Crosshair size={13} aria-hidden="true" /> Targets</span>
      {units.length === 0 && <span className="hint">No units in this phase</span>}
      {units.map(u => {
        const color = unitTypes[u.kind as UnitKind].color, on = picked.has(u.id);
        return (
          <button key={u.id} type="button" className={`target-chip${on ? ' on' : ''}`} aria-pressed={on} style={{ '--unit': color } as React.CSSProperties} onClick={() => toggle(u.id)}>
            {u.code || u.name}
          </button>
        );
      })}
    </div>
  );
}
