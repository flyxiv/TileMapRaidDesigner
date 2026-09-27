'use client';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { countDisplaced, terrainTypes, type Plan, type Terrain } from '../plan';
import { IntInput } from './IntInput';

const clampSize = (n: number) => Math.max(8, Math.min(30, Math.round(n) || 8));
const anchors: [number, number][] = [[0, 0], [0.5, 0], [1, 0], [0, 0.5], [0.5, 0.5], [1, 0.5], [0, 1], [0.5, 1], [1, 1]];
const anchorNames = ['top left', 'top', 'top right', 'left', 'center', 'right', 'bottom left', 'bottom', 'bottom right'];

export function MapSizeDialog({ plan, onClose, onApply }: { plan: Plan; onClose: () => void; onApply: (cols: number, rows: number, anchor: [number, number], fill: Terrain) => void }) {
  const [cols, setCols] = useState(plan.cols);
  const [rows, setRows] = useState(plan.rows);
  const [anchor, setAnchor] = useState(4);
  const [fill, setFill] = useState<Terrain>('floor');
  const c = clampSize(cols), r = clampSize(rows);
  const displaced = countDisplaced(plan, c, r, anchors[anchor]);
  const unchanged = c === plan.cols && r === plan.rows;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <form className="dialog new-encounter" role="dialog" aria-modal="true" aria-labelledby="size-title" onClick={e => e.stopPropagation()}
        onSubmit={e => { e.preventDefault(); if (!unchanged) onApply(c, r, anchors[anchor], fill); }}>
        <button type="button" className="icon-button dialog-close" aria-label="Close" onClick={onClose}><X size={16} /></button>
        <h2 id="size-title">Map size</h2>
        <p className="hint">Currently {plan.cols} × {plan.rows} tiles. Changes apply to every phase and can be undone.</p>
        <div className="field-grid">
          <label className="field">Columns<IntInput min={8} max={30} value={cols} onChange={setCols} /></label>
          <label className="field">Rows<IntInput min={8} max={30} value={rows} onChange={setRows} /></label>
        </div>
        <div className="size-anchor-row">
          <div className="field">
            <span>Keep content anchored to</span>
            <div className="anchor-grid" role="radiogroup" aria-label="Anchor">
              {anchors.map((_, i) => (
                <button key={i} type="button" role="radio" aria-checked={anchor === i} aria-label={anchorNames[i]} className={anchor === i ? 'active' : ''} onClick={() => setAnchor(i)} />
              ))}
            </div>
          </div>
          <label className="field">New tiles
            <select value={fill} onChange={e => setFill(e.target.value as Terrain)}>
              {(Object.keys(terrainTypes) as Terrain[]).map(t => <option key={t} value={t}>{terrainTypes[t].name}</option>)}
            </select>
          </label>
        </div>
        {displaced > 0 && <p className="hint warn">{displaced} unit{displaced > 1 ? 's or telegraphs' : ' or telegraph'} across all phases will be moved inside the new edge.</p>}
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="button primary" disabled={unchanged}>Resize to {c} × {r}</button>
        </div>
      </form>
    </div>
  );
}
