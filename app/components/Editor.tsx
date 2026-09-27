'use client';
import { Copy, Download, Eraser, FileJson, Image as ImageIcon, Keyboard, MessageSquare, Minus, MousePointer2, Play, Plus, Redo2, Trash2, Undo2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  clampEntity, createMechanic, entityAt, isMechanic, isUnit, mechanicTypes, nextCode, phaseTurnRanges,
  terrainTypes, tileLabel, turnRangeText, uid, unitTypes, type Entity, type MechanicKind, type Phase, type Plan, type Terrain, type UnitKind,
} from '../plan';
import { duplicateEncounter, saveEncounter } from '../library';
import { BattleMap, type MapPointer } from './BattleMap';
import { Glyph, Logo } from './glyphs';
import { Inspector } from './Inspector';
import { PresentView } from './PresentView';
import { StoryPanel } from './StoryPanel';

type Tool = { type: 'select' } | { type: 'erase' } | { type: 'terrain'; terrain: Terrain } | { type: 'unit'; kind: UnitKind } | { type: 'mechanic'; kind: MechanicKind };
type History = { past: Plan[]; present: Plan; future: Plan[] };
type Gesture = { base: Plan; mode: 'drag' | 'paint'; id?: string; offset?: [number, number] };

const BASE_CELL = 32;
const zoomSteps = [0.5, 0.625, 0.75, 0.875, 1, 1.25, 1.5, 1.75, 2];

const updatePhase = (plan: Plan, index: number, fn: (p: Phase) => Phase): Plan =>
  ({ ...plan, phases: plan.phases.map((p, i) => i === index ? fn(p) : p) });

function paint(plan: Plan, index: number, all: boolean, tiles: [number, number][], terrain: Terrain): Plan {
  let changed = false;
  const phases = plan.phases.map((p, i) => {
    if (!all && i !== index) return p;
    const hits = tiles.filter(([x, y]) => p.terrain[y][x] !== terrain);
    if (!hits.length) return p;
    changed = true;
    const grid = p.terrain.map(row => row.slice());
    hits.forEach(([x, y]) => { grid[y][x] = terrain; });
    return { ...p, terrain: grid };
  });
  return changed ? { ...plan, phases } : plan;
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'raid-plan';

export function Editor({ encounterId, initialPlan }: { encounterId: string; initialPlan: Plan }) {
  const router = useRouter();
  const [hist, setHist] = useState<History>(() => ({ past: [], present: initialPlan, future: [] }));
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>({ type: 'select' });
  const [brush, setBrush] = useState(1);
  const [paintAll, setPaintAll] = useState(true);
  const [zoom, setZoom] = useState(1);
  const viewportRef = useRef<HTMLDivElement>(null);
  /** Largest zoom step (up to 100%) at which the whole map fits the viewport. */
  const fitZoom = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const fit = Math.min((el.clientWidth - 48) / (initialPlan.cols * BASE_CELL + 20), (el.clientHeight - 68) / (initialPlan.rows * BASE_CELL + 20));
    setZoom([...zoomSteps].reverse().find(z => z <= Math.min(1, fit)) ?? zoomSteps[0]);
  }, [initialPlan.cols, initialPlan.rows]);
  useLayoutEffect(fitZoom, [fitZoom]);
  const [layers, setLayers] = useState({ terrain: true, telegraphs: true, moves: true });
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [toast, setToast] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [panel, setPanel] = useState<'details' | 'story'>('details');
  const gesture = useRef<Gesture | null>(null);
  const lastEdit = useRef<{ key: string; at: number } | null>(null);
  const presentRef = useRef(hist.present);
  presentRef.current = hist.present;
  const mapRef = useRef<SVGSVGElement>(null);

  const plan = hist.present;
  const pi = Math.min(phaseIndex, plan.phases.length - 1);
  const phase = plan.phases[pi];
  const prevPhase = pi > 0 ? plan.phases[pi - 1] : null;
  const selected = phase.entities.find(e => e.id === selectedId) ?? null;
  const ranges = phaseTurnRanges(plan);

  const notify = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(t => t === msg ? null : t), 2600); }, []);

  /** Records an undo step. Edits sharing a `key` within 1.5s (typing, sliders) fold into one step. */
  const commit = useCallback((fn: (p: Plan) => Plan, key?: string) => {
    const now = Date.now(), fold = key && lastEdit.current?.key === key && now - lastEdit.current.at < 1500;
    lastEdit.current = key ? { key, at: now } : null;
    setHist(h => {
      const next = fn(h.present);
      if (next === h.present) return h;
      return fold ? { ...h, present: next } : { past: [...h.past.slice(-99), h.present], present: next, future: [] };
    });
  }, []);
  const preview = (fn: (p: Plan) => Plan) => setHist(h => ({ ...h, present: fn(h.present) }));
  const endGesture = () => {
    const g = gesture.current;
    gesture.current = null;
    if (g) setHist(h => h.present === g.base ? h : { past: [...h.past.slice(-99), g.base], present: h.present, future: [] });
  };
  const undo = useCallback(() => { lastEdit.current = null; setHist(h => h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h); }, []);
  const redo = useCallback(() => { lastEdit.current = null; setHist(h => h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h); }, []);

  // Flush unsaved edits when leaving the editor or closing the tab.
  const latest = useRef(plan);
  latest.current = plan;
  useEffect(() => {
    const flush = () => { if (latest.current !== initialPlan) try { saveEncounter(encounterId, latest.current); } catch { /* storage full or blocked */ } };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, [encounterId, initialPlan]);
  // Autosave after edits settle.
  useEffect(() => {
    if (plan === initialPlan) return;
    setSaveState('saving');
    const t = setTimeout(() => {
      try { saveEncounter(encounterId, plan); setSaveState('saved'); } catch { setSaveState('error'); }
    }, 400);
    return () => clearTimeout(t);
  }, [plan, initialPlan, encounterId]);

  const patchEntity = useCallback((id: string, patch: Partial<Entity>, key?: string) => {
    commit(p => updatePhase(p, pi, f => ({ ...f, entities: f.entities.map(e => e.id === id ? clampEntity({ ...e, ...patch }, p) : e) })), key);
  }, [commit, pi]);

  const deleteEntity = useCallback((id: string) => {
    commit(p => updatePhase(p, pi, f => ({ ...f, entities: f.entities.filter(e => e.id !== id).map(e => e.anchor === id ? { ...e, anchor: undefined, x: f.entities.find(a => a.id === id)!.x, y: f.entities.find(a => a.id === id)!.y } : e) })));
    setSelectedId(s => s === id ? null : s);
  }, [commit, pi]);

  const brushTiles = (x: number, y: number): [number, number][] => {
    const o = Math.floor((brush - 1) / 2), out: [number, number][] = [];
    for (let dy = 0; dy < brush; dy++) for (let dx = 0; dx < brush; dx++) {
      const tx = x - o + dx, ty = y - o + dy;
      if (tx >= 0 && ty >= 0 && tx < plan.cols && ty < plan.rows) out.push([tx, ty]);
    }
    return out;
  };

  const onPointer = (p: MapPointer) => {
    if (p.type === 'up') { endGesture(); return; }
    if (p.type === 'move') {
      setHover(p.tile);
      const g = gesture.current;
      if (!g || !p.tile) return;
      if (g.mode === 'paint' && tool.type === 'terrain') preview(pl => paint(pl, pi, paintAll, brushTiles(...p.tile!), tool.terrain));
      if (g.mode === 'drag' && g.id && g.offset) {
        const [x, y] = [p.tile[0] - g.offset[0], p.tile[1] - g.offset[1]];
        preview(pl => updatePhase(pl, pi, f => ({ ...f, entities: f.entities.map(e => e.id === g.id ? clampEntity({ ...e, x, y }, pl) : e) })));
      }
      return;
    }
    const tile = p.tile;
    const hit = p.entityId ? phase.entities.find(e => e.id === p.entityId) : tile ? entityAt(phase, ...tile) : undefined;
    switch (tool.type) {
      case 'select': {
        setSelectedId(hit?.id ?? null);
        if (hit && tile && !(isMechanic(hit.kind) && hit.anchor)) gesture.current = { base: presentRef.current, mode: 'drag', id: hit.id, offset: [tile[0] - hit.x, tile[1] - hit.y] };
        break;
      }
      case 'erase':
        if (hit) deleteEntity(hit.id);
        break;
      case 'terrain':
        if (!tile) break;
        gesture.current = { base: presentRef.current, mode: 'paint' };
        preview(pl => paint(pl, pi, paintAll, brushTiles(...tile), tool.terrain));
        break;
      case 'unit': {
        if (!tile) break;
        const kind = tool.kind, { code, name } = nextCode(phase, kind);
        const e = clampEntity({ id: uid(kind), kind, name, code, x: tile[0], y: tile[1], radius: 1, rotation: 0, turns: 0 }, plan);
        commit(pl => updatePhase(pl, pi, f => ({ ...f, entities: [...f.entities, e] })));
        setSelectedId(e.id);
        break;
      }
      case 'mechanic': {
        if (!tile) break;
        const e = createMechanic(tool.kind, tile[0], tile[1]);
        commit(pl => updatePhase(pl, pi, f => ({ ...f, entities: [...f.entities, e] })));
        setSelectedId(e.id);
        break;
      }
    }
  };

  const goPhase = (i: number) => setPhaseIndex(Math.max(0, Math.min(plan.phases.length - 1, i)));
  const addPhase = () => {
    const next: Phase = { id: uid('phase'), name: `Phase ${plan.phases.length + 1}`, notes: '', turns: 3, terrain: phase.terrain.map(r => r.slice()), entities: phase.entities.filter(e => isUnit(e.kind)).map(e => ({ ...e })), dialogue: [] };
    commit(p => ({ ...p, phases: [...p.phases.slice(0, pi + 1), next, ...p.phases.slice(pi + 1)] }));
    setPhaseIndex(pi + 1);
  };
  const duplicatePhase = () => {
    const copy: Phase = { ...phase, id: uid('phase'), name: `${phase.name} (copy)`, terrain: phase.terrain.map(r => r.slice()), entities: phase.entities.map(e => ({ ...e })), dialogue: phase.dialogue.map(l => ({ ...l, id: uid('line'), options: l.options.map(o => ({ ...o, id: uid('opt') })) })) };
    commit(p => ({ ...p, phases: [...p.phases.slice(0, pi + 1), copy, ...p.phases.slice(pi + 1)] }));
    setPhaseIndex(pi + 1);
  };
  const deletePhase = () => {
    if (plan.phases.length === 1 || !confirm(`Delete phase "${phase.name}"? You can undo this.`)) return;
    commit(p => ({ ...p, phases: p.phases.filter((_, i) => i !== pi) }));
    setPhaseIndex(Math.max(0, pi - 1));
  };

  const exportJson = () => { setMenu(false); download(`${slug(plan.name)}.json`, new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' })); };
  const exportPng = () => {
    setMenu(false);
    const svg = mapRef.current;
    if (!svg) return;
    const w = svg.width.baseVal.value, h = svg.height.baseVal.value, pad = 24, scale = 2;
    const src = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = (w + pad * 2) * scale; canvas.height = (h + pad * 2) * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#141819'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, pad * scale, pad * scale, w * scale, h * scale);
      canvas.toBlob(b => b && download(`${slug(plan.name)}-phase-${pi + 1}.png`, b));
    };
    img.onerror = () => notify('Could not render the map image');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
  };
  const duplicate = () => {
    setMenu(false);
    try {
      saveEncounter(encounterId, plan);
      const id = duplicateEncounter(encounterId);
      if (id) router.push(`/encounters/${id}`);
    } catch { notify('Could not duplicate this encounter'); }
  };

  // Keyboard shortcuts (ignored while typing in a field).
  useEffect(() => {
    if (presenting) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && k === 'y') { e.preventDefault(); redo(); return; }
      if (mod) return;
      if (k === 'v' || k === 'escape') { setTool({ type: 'select' }); if (k === 'escape') { setSelectedId(null); setShortcuts(false); setMenu(false); } }
      else if (k === 'e') setTool({ type: 'erase' });
      else if (k === 't') setTool(tl => tl.type === 'terrain' ? tl : { type: 'terrain', terrain: 'floor' });
      else if (k === 'u') setTool(tl => tl.type === 'unit' ? tl : { type: 'unit', kind: 'dps' });
      else if (k === 'm') setTool(tl => tl.type === 'mechanic' ? tl : { type: 'mechanic', kind: 'circle' });
      else if (k === 'p') setPresenting(true);
      else if (k === '[') goPhase(pi - 1);
      else if (k === ']') goPhase(pi + 1);
      else if (k === '?') setShortcuts(s => !s);
      else if ((k === 'delete' || k === 'backspace') && selected) deleteEntity(selected.id);
      else if (k.startsWith('arrow') && selected && !(isMechanic(selected.kind) && selected.anchor)) {
        e.preventDefault();
        const d = { arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0] }[k]!;
        patchEntity(selected.id, { x: selected.x + d[0], y: selected.y + d[1] }, `nudge-${selected.id}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (presenting) return <PresentView plan={plan} index={pi} onIndex={setPhaseIndex} onExit={() => setPresenting(false)} />;

  const cell = Math.round(BASE_CELL * zoom);
  const toolLabel = tool.type === 'select' ? 'Select' : tool.type === 'erase' ? 'Erase'
    : tool.type === 'terrain' ? `Paint ${terrainTypes[tool.terrain].name}` : tool.type === 'unit' ? `Place ${unitTypes[tool.kind].name}` : `Draw ${mechanicTypes[tool.kind].name}`;
  const highlight = hover && tool.type === 'terrain' ? (() => { const o = Math.floor((brush - 1) / 2); return { x: hover[0] - o, y: hover[1] - o, size: brush }; })()
    : hover && (tool.type === 'unit' || tool.type === 'mechanic') ? { x: Math.min(hover[0], plan.cols - (tool.type === 'unit' && tool.kind === 'boss' ? 2 : 1)), y: Math.min(hover[1], plan.rows - (tool.type === 'unit' && tool.kind === 'boss' ? 2 : 1)), size: tool.type === 'unit' && tool.kind === 'boss' ? 2 : 1 } : null;
  const units = phase.entities.filter(e => isUnit(e.kind));
  const moveCount = prevPhase ? units.filter(u => { const b = prevPhase.entities.find(e => e.id === u.id); return b && (b.x !== u.x || b.y !== u.y); }).length : 0;
  const isTool = (t: Tool) => JSON.stringify(t) === JSON.stringify(tool);

  return (
    <div className="app">
      <header className="topbar">
        <Link href="/" className="brand"><Logo /><span>Raid<em>Designer</em></span></Link>
        <nav className="crumb" aria-label="Breadcrumb"><Link href="/">Encounters</Link><i>/</i><b>{plan.name}</b></nav>
        <div className="header-actions">
          <span className={`save-status ${saveState}`}><i />{saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Not saved'}</span>
          <div className="menu-wrap">
            <button type="button" className="button" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu(m => !m)}><Download size={14} /> Export</button>
            {menu && (
              <div className="menu" role="menu">
                <button type="button" role="menuitem" onClick={exportPng}><ImageIcon size={14} /> Current phase as PNG</button>
                <button type="button" role="menuitem" onClick={exportJson}><FileJson size={14} /> Plan as JSON</button>
                <hr />
                <button type="button" role="menuitem" onClick={duplicate}><Copy size={14} /> Duplicate encounter</button>
              </div>
            )}
          </div>
          <button type="button" className="button primary" onClick={() => setPresenting(true)}><Play size={12} fill="currentColor" /> Present</button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar left" aria-label="Tools">
          <div className="project-heading">
            <label className="eyebrow" htmlFor="plan-name">Encounter</label>
            <input id="plan-name" className="plan-name" value={plan.name} maxLength={120} onChange={e => commit(p => ({ ...p, name: e.target.value }), 'plan-name')} />
            <div className="badges"><span>{plan.cols} × {plan.rows} tiles</span><span>{plan.phases.length} phase{plan.phases.length > 1 ? 's' : ''}</span></div>
          </div>
          <div className="tool-sections">
            <section>
              <div className="section-title">Terrain <span>Paint · T</span></div>
              <div className="grid-3">
                {(Object.keys(terrainTypes) as Terrain[]).map(t => (
                  <button key={t} type="button" className={`tool-tile${isTool({ type: 'terrain', terrain: t }) ? ' active' : ''}`} aria-pressed={isTool({ type: 'terrain', terrain: t })} onClick={() => setTool({ type: 'terrain', terrain: t })}>
                    <span className={`swatch ${t}`} />{terrainTypes[t].name}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <div className="section-title">Units <span>Place · U</span></div>
              <div className="grid-2">
                {(Object.keys(unitTypes) as UnitKind[]).map(k => (
                  <button key={k} type="button" className={`tool-unit${isTool({ type: 'unit', kind: k }) ? ' active' : ''}`} aria-pressed={isTool({ type: 'unit', kind: k })} onClick={() => setTool({ type: 'unit', kind: k })}>
                    <span className="unit-dot" style={{ borderColor: unitTypes[k].color }}><Glyph kind={k} size={13} color={unitTypes[k].color} strokeWidth={2.2} /></span>{unitTypes[k].name}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <div className="section-title">Mechanics <span>Draw · M</span></div>
              <div className="grid-3">
                {(Object.keys(mechanicTypes) as MechanicKind[]).map(k => (
                  <button key={k} type="button" className={`tool-tile tall${isTool({ type: 'mechanic', kind: k }) ? ' active' : ''}`} aria-pressed={isTool({ type: 'mechanic', kind: k })} onClick={() => setTool({ type: 'mechanic', kind: k })}>
                    <Glyph kind={k} size={22} color={k === 'marker' ? '#c6eb95' : '#dbb36d'} strokeWidth={1.8} />{mechanicTypes[k].name}
                  </button>
                ))}
              </div>
            </section>
            {tool.type === 'terrain' && (
              <section className="tool-options">
                <label className="field"><span className="field-line">Brush size <b>{brush} × {brush}</b></span>
                  <input type="range" min={1} max={5} value={brush} onChange={e => setBrush(Number(e.target.value))} />
                </label>
                <label className="check"><input type="checkbox" checked={paintAll} onChange={e => setPaintAll(e.target.checked)} /> Paint every phase</label>
              </section>
            )}
          </div>
          <button type="button" className="sidebar-bottom" onClick={() => setShortcuts(true)}><Keyboard size={14} /> Keyboard shortcuts <kbd>?</kbd></button>
        </aside>

        <main className="editor">
          <div className="editor-heading">
            <div className="phase-heading">
              <div className="eyebrow">Phase {pi + 1} of {plan.phases.length} · {turnRangeText(ranges[pi])}</div>
              <input aria-label="Phase name" className="phase-name" value={phase.name} maxLength={120} onChange={e => commit(p => updatePhase(p, pi, f => ({ ...f, name: e.target.value })), `phase-name-${phase.id}`)} />
            </div>
            <div className="heading-actions">
              <label className="turns-field">Turns
                <input type="number" min={1} max={20} value={phase.turns} onChange={e => { const n = Math.max(1, Math.min(20, Math.round(Number(e.target.value)) || 1)); commit(p => updatePhase(p, pi, f => ({ ...f, turns: n })), `phase-turns-${phase.id}`); }} />
              </label>
              <button type="button" className="icon-button bordered" aria-label="Previous phase" disabled={pi === 0} onClick={() => goPhase(pi - 1)}>‹</button>
              <button type="button" className="icon-button bordered" aria-label="Next phase" disabled={pi === plan.phases.length - 1} onClick={() => goPhase(pi + 1)}>›</button>
            </div>
          </div>

          <div className="canvas-toolbar">
            <div className="toolbar-group">
              <button type="button" className={`icon-button${tool.type === 'select' ? ' active' : ''}`} aria-label="Select and move (V)" title="Select and move (V)" onClick={() => setTool({ type: 'select' })}><MousePointer2 size={16} /></button>
              <button type="button" className={`icon-button${tool.type === 'erase' ? ' active' : ''}`} aria-label="Erase (E)" title="Erase (E)" onClick={() => setTool({ type: 'erase' })}><Eraser size={16} /></button>
              <span className="divider" />
              <button type="button" className="icon-button" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!hist.past.length} onClick={undo}><Undo2 size={16} /></button>
              <button type="button" className="icon-button" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!hist.future.length} onClick={redo}><Redo2 size={16} /></button>
            </div>
            <div className="toolbar-center">
              <span>Tool: <b>{toolLabel}</b></span>
              {hover && <><i>·</i><span>Tile <b>{tileLabel(...hover)}</b> {terrainTypes[phase.terrain[hover[1]][hover[0]]].name}</span></>}
            </div>
            <div className="toolbar-group">
              <button type="button" className="icon-button" aria-label="Zoom out" disabled={zoom <= zoomSteps[0]} onClick={() => setZoom(z => zoomSteps[Math.max(0, zoomSteps.indexOf(z) - 1)])}><Minus size={15} /></button>
              <button type="button" className="zoom-label" title="Fit map to screen" onClick={fitZoom}>{Math.round(zoom * 100)}%</button>
              <button type="button" className="icon-button" aria-label="Zoom in" disabled={zoom >= zoomSteps[zoomSteps.length - 1]} onClick={() => setZoom(z => zoomSteps[Math.min(zoomSteps.length - 1, zoomSteps.indexOf(z) + 1)])}><Plus size={15} /></button>
            </div>
          </div>

          <div ref={viewportRef} className={`map-viewport tool-${tool.type}`}>
            <div className="map-scroll">
              <BattleMap
                ref={mapRef} className="battlemap" plan={plan} phaseIndex={pi} cell={cell} selectedId={selectedId}
                showMoves={layers.moves} showTerrain={layers.terrain} showTelegraphs={layers.telegraphs}
                highlight={highlight} onPointer={onPointer} onLeave={() => setHover(null)}
              />
            </div>
            <div className="map-legend">
              <span><i className="party" />Party</span><span><i className="enemy" />Enemy</span>
              <span><i className="tele" />Telegraph</span><span><i className="hot" />Resolves next turn</span>
              <span><i className="move" />Movement</span>
            </div>
          </div>

          <section className="phase-panel" aria-label="Phases">
            <div className="phase-top">
              <div className="section-title">Phases <span className="plain">New phases keep units and terrain</span></div>
              <div className="phase-actions">
                <button type="button" className="text-button" onClick={duplicatePhase}><Copy size={12} /> Duplicate</button>
                <button type="button" className="text-button danger" disabled={plan.phases.length === 1} onClick={deletePhase}><Trash2 size={12} /> Delete</button>
                <button type="button" className="text-button" onClick={addPhase}><Plus size={13} /> Add phase</button>
              </div>
            </div>
            <div className="phase-list">
              {plan.phases.map((p, i) => (
                <button key={p.id} type="button" className={`phase-card${i === pi ? ' active' : ''}`} aria-current={i === pi ? 'step' : undefined} onClick={() => setPhaseIndex(i)}>
                  <span className="phase-number"><span>Phase {i + 1}{p.dialogue.length > 0 && <span className="phase-lines" title={`${p.dialogue.length} dialogue line${p.dialogue.length > 1 ? 's' : ''}`}><MessageSquare size={10} /> {p.dialogue.length}</span>}</span><span>{ranges[i].start === ranges[i].end ? `T${ranges[i].start}` : `T${ranges[i].start}–${ranges[i].end}`}</span></span>
                  <b>{p.name}</b>
                  <span className="ticks">{Array.from({ length: p.turns }, (_, t) => <i key={t} />)}</span>
                </button>
              ))}
            </div>
          </section>

          <div className="canvas-status">
            <span>{units.length} units · {phase.entities.length - units.length} telegraphs{prevPhase ? ` · ${moveCount} moved since phase ${pi}` : ''}</span>
            <span>Drag a token to move it · Arrow keys nudge · [ and ] switch phases</span>
          </div>
        </main>

        <aside className="sidebar right" aria-label="Inspector">
          <div className="panel-tabs" role="tablist">
            <button type="button" role="tab" id="tab-details" aria-selected={panel === 'details'} aria-controls="panel-details" onClick={() => setPanel('details')}>Details</button>
            <button type="button" role="tab" id="tab-story" aria-selected={panel === 'story'} aria-controls="panel-story" onClick={() => setPanel('story')}>
              Story{phase.dialogue.length > 0 && <span className="tab-count">{phase.dialogue.length}</span>}
            </button>
          </div>
          {panel === 'story' ? (
            <div id="panel-story" role="tabpanel" aria-labelledby="tab-story">
              <StoryPanel
                plan={plan} phaseIndex={pi}
                defaultSpeaker={(selected && isUnit(selected.kind) ? selected : phase.entities.find(e => e.kind === 'boss'))?.name ?? 'Narrator'}
                onChange={(fn, key) => commit(p => updatePhase(p, pi, f => ({ ...f, dialogue: fn(f.dialogue) })), key)}
              />
            </div>
          ) : <div id="panel-details" role="tabpanel" aria-labelledby="tab-details" className="details-panel">
          <Inspector
            plan={plan} phase={phase} prevPhase={prevPhase} entity={selected}
            onChange={(patch, key) => selected && patchEntity(selected.id, patch, key)}
            onDelete={() => selected && deleteEntity(selected.id)}
            onSelect={setSelectedId}
          />
          <div className="notes-section">
            <label className="section-title" htmlFor="phase-notes">Phase notes</label>
            <textarea id="phase-notes" value={phase.notes} maxLength={10000} placeholder="What should the raid do this phase? Each line becomes a step in Present mode."
              onChange={e => commit(p => updatePhase(p, pi, f => ({ ...f, notes: e.target.value })), `notes-${phase.id}`)} />
          </div>
          <div className="layers-section">
            <div className="section-title">Layers</div>
            <label className="check"><input type="checkbox" checked={layers.terrain} onChange={e => setLayers(l => ({ ...l, terrain: e.target.checked }))} /> Terrain</label>
            <label className="check"><input type="checkbox" checked={layers.telegraphs} onChange={e => setLayers(l => ({ ...l, telegraphs: e.target.checked }))} /> Telegraphs</label>
            <label className="check"><input type="checkbox" checked={layers.moves} onChange={e => setLayers(l => ({ ...l, moves: e.target.checked }))} /> Movement from previous phase</label>
          </div>
          </div>}
        </aside>
      </div>

      {shortcuts && (
        <div className="dialog-backdrop" onClick={() => setShortcuts(false)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" onClick={e => e.stopPropagation()}>
            <button type="button" className="icon-button dialog-close" aria-label="Close" onClick={() => setShortcuts(false)}><X size={16} /></button>
            <h2 id="shortcuts-title">Keyboard shortcuts</h2>
            <dl>
              {[['V', 'Select and move'], ['E', 'Erase'], ['T / U / M', 'Terrain, unit, mechanic tools'], ['Arrow keys', 'Nudge selection one tile'], ['Delete', 'Remove selection'],
                ['[ and ]', 'Previous / next phase'], ['Ctrl+Z', 'Undo'], ['Ctrl+Shift+Z', 'Redo'], ['P', 'Present mode'], ['Esc', 'Deselect']].map(([k, v]) => (
                <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>
              ))}
            </dl>
          </div>
        </div>
      )}
      <div className={`toast${toast ? ' visible' : ''}`} role="status">{toast}</div>
    </div>
  );
}
