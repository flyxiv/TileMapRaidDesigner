import { Users } from 'lucide-react';
import { MAX_SOAK } from '../plan';
import { IntInput } from './IntInput';

/** How many players a tower needs standing in it. */
export function SoakField({ value, onChange }: { value: number | undefined; onChange: (v: number) => void }) {
  const n = value ?? 1;
  return (
    <div className="soak-field">
      <Users size={13} aria-hidden="true" />
      <label className="unit-input">Soaked by
        <IntInput aria-label="Players needed to soak" min={1} max={MAX_SOAK} value={n} onChange={onChange} />
        {n === 1 ? 'player' : 'players'}
      </label>
    </div>
  );
}
