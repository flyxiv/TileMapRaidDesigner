'use client';
import { Copy, Plus, Trash2, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { canHoldParty, createBlankPlan, createEncounter, deleteEncounter, duplicateEncounter, listEncounters, loadEncounter, parsePlan, uploadLocalEncounters, type EncounterMeta, type Layout } from '../library';
import { createPlan } from '../plan';
import type { Plan } from '../plan';
import { BattleMap } from './BattleMap';
import { Logo } from './glyphs';
import { IntInput } from './IntInput';

type Row = EncounterMeta & { plan: Plan | null };

function ago(t: number) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'Edited just now';
  const units: [number, string][] = [[86400 * 365, 'year'], [86400 * 30, 'month'], [86400, 'day'], [3600, 'hour'], [60, 'minute']];
  const [size, name] = units.find(([u]) => s >= u)!;
  const n = Math.floor(s / size);
  return `Edited ${n} ${name}${n > 1 ? 's' : ''} ago`;
}

export function EncounterList() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [where, setWhere] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    try {
      const uploaded = await uploadLocalEncounters();
      if (uploaded) setToast(`Moved ${uploaded} encounter${uploaded > 1 ? 's' : ''} from this browser to cloud storage`);
      const { encounters, location } = await listEncounters();
      setWhere(location); setError('');
      setRows(encounters.map(e => ({ ...e, plan: null })));
      // Thumbnails need the full plans; fill them in as they arrive.
      encounters.forEach(e => loadEncounter(e.id).then(plan => setRows(rs => rs && rs.map(r => r.id === e.id ? { ...r, plan } : r))).catch(() => {}));
    } catch (e) { setError((e as Error).message); setRows(rs => rs ?? []); }
  };
  useEffect(() => { refresh(); }, []);
  /** Runs a storage action, reporting failures instead of throwing. */
  const act = async (fn: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    try { await fn(); } catch (e) { setToast(`${failure}: ${(e as Error).message}`); } finally { setBusy(false); }
  };
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2800); return () => clearTimeout(t); }, [toast]);

  const importFile = async (file: File) => {
    const plan = parsePlan(await file.text());
    if (!plan) { setToast('That file is not a valid raid plan'); return; }
    await act(async () => router.push(`/encounters/${await createEncounter(plan)}`), 'Could not import');
  };
  const create = (plan: Plan) => act(async () => router.push(`/encounters/${await createEncounter(plan)}`), 'Could not create the encounter');
  const duplicate = (e: Row) => act(async () => { await duplicateEncounter(e.id); await refresh(); }, 'Could not duplicate');
  const remove = (e: Row) => {
    if (!confirm(`Delete "${e.name}"? This removes it from cloud storage and cannot be undone.`)) return;
    act(async () => { await deleteEncounter(e.id); await refresh(); }, 'Could not delete');
  };

  return (
    <div className="library">
      <header className="topbar">
        <Link href="/" className="brand"><Logo /><span>Raid<em>Designer</em></span></Link>
        <div className="header-actions">
          <button type="button" className="button" onClick={() => fileRef.current?.click()}><Upload size={14} /> Import</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
          <button type="button" className="button primary" onClick={() => setCreating(true)}><Plus size={14} /> New encounter</button>
        </div>
      </header>

      <main className="library-body">
        <div className="library-heading">
          <div>
            <div className="eyebrow">Your raids</div>
            <h1>Encounters</h1>
          </div>
          {rows && where && <span className="library-count">{rows.length} encounter{rows.length === 1 ? '' : 's'} · saved to <code>{where}</code></span>}
        </div>

        {error && (
          <div className="library-empty">
            <h2>Could not reach cloud storage</h2>
            <p>{error}</p>
            <button type="button" className="button primary" onClick={() => refresh()}>Try again</button>
          </div>
        )}
        {!rows && !error && <p className="hint">Loading encounters…</p>}
        {rows && !error && rows.length === 0 && (
          <div className="library-empty">
            <h2>No encounters yet</h2>
            <p>Start with an empty arena, try the sample encounter, or import a plan someone exported as JSON.</p>
            <div className="dialog-actions">
              <button type="button" className="button" disabled={busy} onClick={() => create(createPlan())}>Open the sample encounter</button>
              <button type="button" className="button primary" onClick={() => setCreating(true)}><Plus size={14} /> New encounter</button>
            </div>
          </div>
        )}

        <div className="encounter-grid">
          {rows?.map(e => (
            <article key={e.id} className="encounter-card">
              <Link href={`/encounters/${e.id}`} className="encounter-open">
                <div className="encounter-thumb">
                  {e.plan && e.cols > 0 && <BattleMap plan={e.plan} phaseIndex={0} cell={Math.max(4, Math.min(Math.floor(280 / e.cols), Math.floor(150 / e.rows)))} coords={false} showMoves={false} />}
                </div>
                <div className="encounter-info">
                  <h2>{e.name}</h2>
                  <p>{e.phases} phase{e.phases > 1 ? 's' : ''} · {e.cols} × {e.rows} tiles</p>
                  <p className="dim">{ago(e.updatedAt)}</p>
                </div>
              </Link>
              <div className="encounter-actions">
                <button type="button" className="icon-button" aria-label={`Duplicate ${e.name}`} title="Duplicate" disabled={busy} onClick={() => duplicate(e)}><Copy size={15} /></button>
                <button type="button" className="icon-button danger" aria-label={`Delete ${e.name}`} title="Delete" disabled={busy} onClick={() => remove(e)}><Trash2 size={15} /></button>
              </div>
            </article>
          ))}
          {rows && rows.length > 0 && (
            <button type="button" className="encounter-new" onClick={() => setCreating(true)}><Plus size={22} /> New encounter</button>
          )}
        </div>
      </main>

      {creating && <NewEncounterDialog onClose={() => setCreating(false)} onCreate={plan => { setCreating(false); create(plan); }} />}
      <div className={`toast${toast ? ' visible' : ''}`} role="status">{toast}</div>
    </div>
  );
}

const sizes = [{ label: 'Small', cols: 12, rows: 12 }, { label: 'Medium', cols: 20, rows: 16 }, { label: 'Large', cols: 28, rows: 22 }];
const clampSize = (n: number) => Math.max(8, Math.min(30, Math.round(n) || 8));

function NewEncounterDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (plan: Plan) => void }) {
  const [name, setName] = useState('New encounter');
  const [cols, setCols] = useState(20);
  const [rows, setRows] = useState(16);
  const [layout, setLayout] = useState<Layout>('walled');
  const [party, setParty] = useState(true);
  const partyFits = canHoldParty(cols, rows);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(createBlankPlan(name.trim() || 'New encounter', clampSize(cols), clampSize(rows), layout, party && partyFits));
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <form className="dialog new-encounter" role="dialog" aria-modal="true" aria-labelledby="new-title" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <button type="button" className="icon-button dialog-close" aria-label="Close" onClick={onClose}><X size={16} /></button>
        <h2 id="new-title">New encounter</h2>
        <label className="field">Name
          <input autoFocus value={name} maxLength={120} onChange={e => setName(e.target.value)} onFocus={e => e.target.select()} />
        </label>
        <div className="field">
          <span>Map size</span>
          <div className="segmented" role="group" aria-label="Map size presets">
            {sizes.map(s => (
              <button key={s.label} type="button" aria-pressed={cols === s.cols && rows === s.rows} className={cols === s.cols && rows === s.rows ? 'active' : ''} onClick={() => { setCols(s.cols); setRows(s.rows); }}>
                {s.label}<small>{s.cols} × {s.rows}</small>
              </button>
            ))}
          </div>
          <div className="field-grid">
            <label className="field">Columns<IntInput min={8} max={30} value={cols} onChange={setCols} /></label>
            <label className="field">Rows<IntInput min={8} max={30} value={rows} onChange={setRows} /></label>
          </div>
        </div>
        <div className="field">
          <span>Arena</span>
          <div className="segmented" role="group" aria-label="Arena layout">
            <button type="button" aria-pressed={layout === 'walled'} className={layout === 'walled' ? 'active' : ''} onClick={() => setLayout('walled')}>Walled<small>Wall border</small></button>
            <button type="button" aria-pressed={layout === 'open'} className={layout === 'open' ? 'active' : ''} onClick={() => setLayout('open')}>Open<small>Floor to the edge</small></button>
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={party && partyFits} disabled={!partyFits} onChange={e => setParty(e.target.checked)} />
          {partyFits ? 'Start with a boss and an 8-player party' : 'A starting party needs at least 10 × 12 tiles'}
        </label>
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="button primary">Create encounter</button>
        </div>
      </form>
    </div>
  );
}
