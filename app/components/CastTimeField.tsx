import { Timer, X } from 'lucide-react';

/** Optional cast time in seconds; empty means the telegraph has none. */
export function CastTimeField({ value, onChange }: { value: number | undefined; onChange: (v: number | undefined, coalesceKey?: string) => void }) {
  return (
    <div className="cast-time">
      <Timer size={13} aria-hidden="true" />
      <label className="unit-input">Cast time
        <input type="number" min={0} max={600} step={0.5} placeholder="None" value={value ?? ''}
          onChange={e => onChange(e.target.value === '' ? undefined : Math.max(0, Math.min(600, Number(e.target.value))), 'cast')} />s
      </label>
      {value !== undefined && <button type="button" className="icon-button" aria-label="Remove cast time" title="No cast time" onClick={() => onChange(undefined)}><X size={12} /></button>}
    </div>
  );
}
