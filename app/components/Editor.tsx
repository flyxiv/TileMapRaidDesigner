'use client';
import { Copy, Download, FileJson, Image as ImageIcon, BookOpen, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Keyboard, ListOrdered, MapPin, MousePointerClick, Maximize2, MessageSquare, Play, Plus, Redo2, Trash2, Undo2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  bossOf, unitFacing, MAX_RADIUS, MAX_UNIT_SIZE, aims, center, createPage, mapBlock, pageKind, timelineOf, setWaymark, waymarkId, waymarkKeys, waymarkOf, type WaymarkKey, actionText, faceRotation, isAction, stagePhase, conversationScenes, sceneAtStep, sceneBeforeEvent, sceneOf, withTelegraphs, sceneToDiagram, type Conversation, type Diagram, clampEntity, createMechanic, mechanicOrigin, resizePlan, scriptOf, triggerLabel, mechanicTone, entityAt, footprint, unitCategories, unitsIn, isMechanic, isUnit, mechanicTypes, nextCode,
  terrainTypes, tileLabel, uid, unitTypes, type Entity, type MechanicKind, type Phase, type Plan, type Terrain, type UnitKind,
} from '../plan';
import { duplicateEncounter, saveEncounter } from '../library';
import { BattleMap, type MapPointer, type TransformHandle } from './BattleMap';
import { Glyph, Logo, WaymarkIcon } from './glyphs';
import { Inspector } from './Inspector';
import { PresentView } from './PresentView';
import { MapSizeDialog } from './MapSizeDialog';
import { MechanicPages } from './MechanicPages';
import { SaveToPageMenu, StoryPanel } from './StoryPanel';

type Tool = { type: 'select' } | { type: 'erase' } | { type: 'terrain'; terrain: Terrain } | { type: 'unit'; kind: UnitKind } | { type: 'mechanic'; kind: MechanicKind } | { type: 'waymark'; key: WaymarkKey };
type History = { past: Plan[]; present: Plan; future: Plan[] };
type Gesture = { base: Plan; mode: 'drag' | 'paint' | 'rotate' | 'resize' | 'waymark'; waymark?: WaymarkKey; id?: string; offset?: [number, number]; corner?: TransformHandle };
/**
 * The map an edit goes to: the phase's starting map, a conversation's own map (by conversation id), or a telegraph's
 * own map on its timeline card (`m:` + telegraph id), where only that telegraph can be edited.
 */
type Target = 'base' | string;
const mechTarget = (id: string) => `m:${id}`;
const mechOf = (t: Target) => t.startsWith('m:') ? t.slice(2) : null;


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
  const [layers, setLayers] = useState({ terrain: true, telegraphs: true, moves: true });
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [toast, setToast] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [panel, setPanel] = useState<'details' | 'story'>('details');
  /** The map editor, or the encounter's mechanic pages. */
  const [view, setView] = useState<'timeline' | 'pages'>('timeline');
  const [pageId, setPageId] = useState<string | null>(null);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  /** A Story tab action waiting for a tile click (a move destination). */
  const [picking, setPicking] = useState<{ id?: string; apply: (tile: [number, number], target: Target) => void; label?: string; placing?: string } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const lastEdit = useRef<{ key: string; at: number } | null>(null);
  const presentRef = useRef(hist.present);
  presentRef.current = hist.present;
  const mapRef = useRef<SVGSVGElement>(null);

  const plan = hist.present;
  const pi = Math.min(phaseIndex, plan.phases.length - 1);
  const phase = plan.phases[pi];
  const prevPhase = pi > 0 ? plan.phases[pi - 1] : null;
  /** The map the palette and Details panel work on. */
  const [activeTarget, setActiveTarget] = useState<Target>('base');
  const [hoverTarget, setHoverTarget] = useState<Target>('base');
  /** The editable phase behind a map: the phase's starting map, or where a conversation's map starts. */
  const phaseFor = (t: Target, f: Phase = phase, pl: Plan = plan) => t === 'base' ? f
    : mechOf(t) ? sceneBeforeEvent(f, pl, mechOf(t)!)
    : (conversationScenes(f, pl).get(t)?.start ?? f);
  /** What a map shows: units, plus only the telegraph whose card it is. */
  const visibleOn = (t: Target) => (e: Entity) => isUnit(e.kind) || e.id === mechOf(t);
  /**
   * Applies an edit made on a map. Conversation maps keep their own terrain and units (taken from the scene before them
   * the first time they are edited); telegraphs are shared by the phase, so telegraph edits land on the phase itself.
   */
  const updateTarget = (pl: Plan, t: Target, fn: (v: Phase) => Phase): Plan => updatePhase(pl, pi, f => {
    if (mechOf(t)) {
      // A telegraph's card edits only telegraphs; its units belong to earlier maps.
      const v = fn(phaseFor(t, f, pl));
      return { ...f, entities: [...f.entities.filter(e => isUnit(e.kind)), ...v.entities.filter(e => isMechanic(e.kind))] };
    }
    if (t === 'base' || !f.conversations.some(c => c.id === t)) return fn(f);
    const start = phaseFor(t, f, pl), v = fn(start);
    if (v === start) return f;
    return {
      ...f, entities: [...f.entities.filter(e => isUnit(e.kind)), ...v.entities.filter(e => isMechanic(e.kind))],
      conversations: f.conversations.map(c => c.id === t ? { ...c, scene: sceneOf(v) } : c),
    };
  });
  const paintOn = (pl: Plan, t: Target, tiles: [number, number][], terrain: Terrain) =>
    t === 'base' ? paint(pl, pi, paintAll, tiles, terrain) : updateTarget(pl, t, f => { const one = paint({ ...pl, phases: [f] }, 0, false, tiles, terrain); return one.phases[0]; });
  const targetPhase = phaseFor(activeTarget);
  const selected = targetPhase.entities.find(e => e.id === selectedId) ?? null;

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

  // Saving to cloud storage: uploads run one at a time so an older plan never lands after a newer one.
  const latest = useRef(plan);
  latest.current = plan;
  const stored = useRef(initialPlan);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [saveError, setSaveError] = useState('');
  const pushSave = useCallback((p: Plan) => {
    const run = queue.current.catch(() => {}).then(async () => {
      if (p === stored.current) return;
      await saveEncounter(encounterId, p);
      stored.current = p;
    });
    queue.current = run;
    return run;
  }, [encounterId]);
  const saveNow = useCallback((p: Plan) => {
    setSaveState('saving');
    pushSave(p).then(() => { if (latest.current === p) setSaveState('saved'); })
      .catch((e: Error) => { setSaveState('error'); setSaveError(e.message); });
  }, [pushSave]);
  // Autosave once edits settle.
  useEffect(() => {
    if (plan === stored.current) return;
    setSaveState('saving');
    const t = setTimeout(() => saveNow(plan), 800);
    return () => clearTimeout(t);
  }, [plan, saveNow]);
  // Leaving the editor sends any unsaved edits; closing the tab with unsaved edits asks first.
  useEffect(() => {
    const unsaved = () => latest.current !== stored.current;
    const warn = (e: BeforeUnloadEvent) => { if (unsaved()) e.preventDefault(); };
    const flush = () => { if (unsaved()) saveEncounter(encounterId, latest.current, true).catch(() => {}); };
    window.addEventListener('beforeunload', warn);
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('beforeunload', warn); window.removeEventListener('pagehide', flush); flush(); };
  }, [encounterId]);

  const patchEntity = (id: string, patch: Partial<Entity>, key?: string, t: Target = activeTarget) => {
    commit(p => updateTarget(p, t, f => ({ ...f, entities: f.entities.map(e => e.id === id ? clampEntity({ ...e, ...patch }, p) : e) })), key);
  };

  const deleteEntity = (id: string, t: Target = activeTarget) => {
    commit(p => updateTarget(p, t, f => ({ ...f, entities: f.entities.filter(e => e.id !== id).map(e => e.anchor === id ? { ...e, anchor: undefined, x: f.entities.find(a => a.id === id)!.x, y: f.entities.find(a => a.id === id)!.y } : e) })));
    setSelectedId(s => s === id ? null : s);
  };

  const brushTiles = (x: number, y: number): [number, number][] => {
    const o = Math.floor((brush - 1) / 2), out: [number, number][] = [];
    for (let dy = 0; dy < brush; dy++) for (let dx = 0; dx < brush; dx++) {
      const tx = x - o + dx, ty = y - o + dy;
      if (tx >= 0 && ty >= 0 && tx < plan.cols && ty < plan.rows) out.push([tx, ty]);
    }
    return out;
  };

  /** Pointer handling for one map; `t` says which map it edits. */
  const pointerFor = (t: Target) => (p: MapPointer) => {
    const tphase = phaseFor(t);
    if (p.type === 'up') { endGesture(); return; }
    if (p.type === 'down') setActiveTarget(t);
    if (p.type === 'move') {
      setHover(p.tile); setHoverTarget(t);
      const g = gesture.current;
      if (!g) return;
      const target = g.id ? tphase.entities.find(e => e.id === g.id) : undefined;
      const setTarget = (patch: Partial<Entity>) => preview(pl => updateTarget(pl, t, f => ({ ...f, entities: f.entities.map(e => e.id === g.id ? clampEntity({ ...e, ...patch }, pl) : e) })));
      if (g.mode === 'rotate' && target && p.point) {
        // Point at the cursor: units snap to the 8 compass directions, telegraphs to 15° steps.
        const [cx, cy] = isUnit(target.kind) ? center(target) : mechanicOrigin(target, tphase.entities).point;
        const step = isUnit(target.kind) ? 45 : 15, deg = (Math.atan2(p.point[0] - cx, -(p.point[1] - cy)) * 180) / Math.PI;
        const rotation = ((Math.round(deg / step) * step) % 360 + 360) % 360;
        if (rotation !== target.rotation || target.faceToward) setTarget({ rotation, faceToward: undefined });
      }
      if (g.mode === 'resize' && target && p.point && g.corner) {
        if (isUnit(target.kind)) {
          // Whole tiles, keeping the corner opposite the dragged one in place.
          const s = footprint(target), left = g.corner === 'nw' || g.corner === 'sw', top = g.corner === 'nw' || g.corner === 'ne';
          const ax = left ? target.x + s : target.x, ay = top ? target.y + s : target.y;
          const size = Math.max(1, Math.min(MAX_UNIT_SIZE, plan.cols, plan.rows, Math.round(Math.max(Math.abs(p.point[0] - ax), Math.abs(p.point[1] - ay)))));
          if (size !== s) setTarget({ size: size === unitTypes[target.kind as UnitKind].size ? undefined : size, x: left ? ax - size : ax, y: top ? ay - size : ay });
        } else {
          const [cx, cy] = mechanicOrigin(target, tphase.entities).point;
          // The corner sits at radius × √2 from the center along the diagonal; snap to half tiles.
          const radius = Math.max(1, Math.min(MAX_RADIUS, Math.round((Math.hypot(p.point[0] - cx, p.point[1] - cy) / Math.SQRT2) * 2) / 2));
          if (radius !== target.radius) setTarget({ radius, ...(target.inner !== undefined && target.inner >= radius ? { inner: Math.max(0.5, radius - 0.5) } : {}) });
        }
      }
      if (!p.tile) return;
      if (g.mode === 'waymark' && g.waymark) { const at = p.tile, k = g.waymark; preview(pl => updatePhase(pl, pi, f => setWaymark(f, k, at))); return; }
      if (g.mode === 'paint' && tool.type === 'terrain') preview(pl => paintOn(pl, t, brushTiles(...p.tile!), tool.terrain));
      if (g.mode === 'drag' && g.id && g.offset) {
        const [x, y] = [p.tile[0] - g.offset[0], p.tile[1] - g.offset[1]];
        preview(pl => updateTarget(pl, t, f => ({ ...f, entities: f.entities.map(e => e.id === g.id ? clampEntity({ ...e, x, y }, pl) : e) })));
      }
      return;
    }
    const tile = p.tile;
    if (picking) { if (tile) { picking.apply(tile, t); setPicking(null); } return; }
    const shown = { ...tphase, entities: tphase.entities.filter(visibleOn(t)) };
    const found = p.entityId ? shown.entities.find(e => e.id === p.entityId) : tile ? entityAt(shown, ...tile) : undefined;
    const hit = mechOf(t) && found && isUnit(found.kind) ? undefined : found;
    switch (tool.type) {
      case 'select': {
        if (p.handle) {
          gesture.current = p.handle.kind === 'rotate'
            ? { base: presentRef.current, mode: 'rotate', id: p.handle.id }
            : { base: presentRef.current, mode: 'resize', id: p.handle.id, corner: p.handle.kind };
          break;
        }
        // World markers lie under units: a press on one (not on a unit) picks it up.
        if (p.waymark && !(hit && isUnit(hit.kind))) {
          setSelectedId(waymarkId(p.waymark));
          gesture.current = { base: presentRef.current, mode: 'waymark', waymark: p.waymark };
          break;
        }
        setSelectedId(hit?.id ?? null);
        // A unit shown where a story action put it keeps its starting position; edit that from the Details tab.
        if (hit && displacedIn(t, hit.id)) { notify('This unit is shown where the story moved it. Open Details to edit its starting position.'); break; }
        if (hit && tile && !(isMechanic(hit.kind) && hit.anchor)) gesture.current = { base: presentRef.current, mode: 'drag', id: hit.id, offset: [tile[0] - hit.x, tile[1] - hit.y] };
        break;
      }
      case 'erase':
        if (hit) deleteEntity(hit.id, t);
        break;
      case 'terrain':
        if (!tile) break;
        gesture.current = { base: presentRef.current, mode: 'paint' };
        preview(pl => paintOn(pl, t, brushTiles(...tile), tool.terrain));
        break;
      default:
        if (tile) spawn(tool, tile, undefined, t);
    }
  };

  const onPointer = pointerFor('base');

  /** Adds a unit or telegraph at a tile, or paints one brush of terrain, as one undo step. */
  /** `extra` overrides the new telegraph's defaults, e.g. the name and page it gets when placed from a mechanic page. */
  const spawn = (item: Tool, tile: [number, number], extra?: Partial<Entity>, t: Target = activeTarget) => {
    const tphase = phaseFor(t);
    setActiveTarget(t);
    if (item.type === 'terrain') { if (!mechOf(t)) commit(pl => paintOn(pl, t, brushTiles(...tile), item.terrain)); return; }
    let e: Entity;
    if (item.type === 'unit') {
      const { code, name } = nextCode(tphase, item.kind);
      e = clampEntity({ id: uid(item.kind), kind: item.kind, name, code, x: tile[0], y: tile[1], radius: 1, rotation: 0 }, plan);
    } else if (item.type === 'mechanic') {
      e = { ...createMechanic(item.kind, tile[0], tile[1]), ...extra };
      // Dropped on a unit: the telegraph starts from that unit, and cones and lines aim where it faces.
      const on = entityAt(tphase, ...tile);
      if (on && isUnit(on.kind) && item.kind !== 'armageddon') {
        e = { ...e, anchor: on.id, ...(aims(item.kind) ? { followFacing: true } : {}) };
        notify(`${e.name} starts from ${on.name}`);
      } else if (item.kind === 'slash') {
        const boss = bossOf(tphase.entities);
        if (boss) { e = { ...e, anchor: boss.id, followFacing: true }; notify(`${e.name} starts from ${boss.name}`); }
      }
    } else return;
    if (isMechanic(e.kind)) {
      if (mechOf(t) === null && t !== 'base' && !phase.conversations.some(c => c.id === t)) t = 'base';
      const created = e;
      commit(pl => {
        const added = updatePhase(pl, pi, f => ({ ...f, entities: [...f.entities, created] }));
        // New events go to the bottom of the timeline.
        return updatePhase(added, pi, f => ({ ...f, timeline: [...timelineOf(f).map(i => i.id).filter(id => id !== created.id), created.id] }));
      });
      setActiveTarget(mechTarget(e.id));
      setSelectedId(e.id);
      requestAnimationFrame(() => document.querySelector(`[data-timeline-id="${created.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return e.id;
    }
    if (mechOf(t)) { notify('Place units on the starting map or a conversation map'); return; }
    commit(pl => updateTarget(pl, t, f => ({ ...f, entities: [...f.entities, e] })));
    setSelectedId(e.id);
    return e.id;
  };

  // Toolbox items can also be dragged straight onto the map.
  const [dragItem, setDragItem] = useState<Tool | null>(null);
  const dragProps = (item: Tool) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', item.type); setDragItem(item); },
    onDragEnd: () => { setDragItem(null); setHover(null); },
  });

  // Right-click menu for a unit or telegraph.
  const [ctx, setCtx] = useState<{ id: string; x: number; y: number; t: Target } | null>(null);
  const openMenu = (id: string, x: number, y: number, t: Target) => {
    if (waymarkOf(id)) { setActiveTarget(t); setSelectedId(id); setCtx({ id, x, y, t }); return; }
    const e = phaseFor(t).entities.find(x => x.id === id);
    if (!e) return;
    // Select in place: scrolling would close the menu.
    if (isMechanic(e.kind)) selectTelegraph(id, false); else { setActiveTarget(t); setSelectedId(id); }
    setCtx({ id, x, y, t });
  };
  useEffect(() => {
    if (!ctx) return;
    const close = (e: Event) => { if (!(e.target as Element | null)?.closest?.('.context-menu')) setCtx(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setCtx(null); };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', esc);
    window.addEventListener('scroll', () => setCtx(null), { capture: true, once: true });
    return () => { window.removeEventListener('pointerdown', close, true); window.removeEventListener('keydown', esc); };
  }, [ctx]);
  /** Moves a timeline event to the top or bottom, or one place up or down. */
  const moveEvent = (id: string, where: 'top' | 'up' | 'down' | 'bottom') => commit(pl => updatePhase(pl, pi, f => {
    const ids = timelineOf(f).map(i => i.id), from = ids.indexOf(id);
    if (from < 0) return f;
    const to = where === 'top' ? 0 : where === 'bottom' ? ids.length - 1 : Math.max(0, Math.min(ids.length - 1, from + (where === 'up' ? -1 : 1)));
    if (to === from) return f;
    const next = ids.slice(); next.splice(from, 1); next.splice(to, 0, id);
    return { ...f, timeline: next };
  }));
  const duplicateTelegraph = (id: string) => {
    const src = phase.entities.find(e => e.id === id);
    if (!src) return;
    const copy: Entity = { ...src, id: uid(src.kind), name: `${src.name} (copy)`.slice(0, 120) };
    commit(pl => updatePhase(pl, pi, f => {
      const ids = timelineOf(f).map(i => i.id);
      const at = ids.indexOf(id) + 1;
      return { ...f, entities: [...f.entities, copy], timeline: [...ids.slice(0, at), copy.id, ...ids.slice(at)] };
    }));
    selectTelegraph(copy.id);
  };
  const contextMenu = () => {
    if (!ctx) return null;
    const wm = waymarkOf(ctx.id);
    if (wm) return (
      <div className="menu context-menu" role="menu" aria-label={`Waymark ${wm}`} style={{ left: Math.min(ctx.x, window.innerWidth - 230), top: Math.min(ctx.y, window.innerHeight - 110) }}>
        <div className="menu-heading">Waymark {wm}</div>
        <button type="button" role="menuitem" className="danger" onClick={() => { setCtx(null); commit(pl => updatePhase(pl, pi, f => setWaymark(f, wm, null))); setSelectedId(null); }}><Trash2 size={14} />Remove</button>
      </div>
    );
    const e = phaseFor(ctx.t).entities.find(x => x.id === ctx.id);
    if (!e) return null;
    const mech = isMechanic(e.kind);
    const ids = timelineOf(phase).map(i => i.id), pos = ids.indexOf(e.id);
    const page = mech && e.page ? plan.pages.find(g => g.id === e.page) : undefined;
    const item = (label: string, run: () => void, opts: { disabled?: boolean; danger?: boolean; icon?: React.ReactNode } = {}) => (
      <button type="button" role="menuitem" disabled={opts.disabled} className={opts.danger ? 'danger' : ''} onClick={() => { setCtx(null); run(); }}>{opts.icon}{label}</button>
    );
    return (
      <div className="menu context-menu" role="menu" aria-label={e.name}
        style={{ left: Math.min(ctx.x, window.innerWidth - 230), top: Math.min(ctx.y, window.innerHeight - (mech ? 330 : 150)) }}>
        <div className="menu-heading">{e.name}</div>
        {mech ? <>
          {item('Select on its map', () => selectTelegraph(e.id), { icon: <MapPin size={14} /> })}
          {item('Duplicate', () => duplicateTelegraph(e.id), { icon: <Copy size={14} /> })}
          <hr />
          {item('Move to top', () => moveEvent(e.id, 'top'), { disabled: pos <= 0, icon: <ChevronsUp size={14} /> })}
          {item('Move up', () => moveEvent(e.id, 'up'), { disabled: pos <= 0, icon: <ChevronUp size={14} /> })}
          {item('Move down', () => moveEvent(e.id, 'down'), { disabled: pos === ids.length - 1, icon: <ChevronDown size={14} /> })}
          {item('Move to bottom', () => moveEvent(e.id, 'bottom'), { disabled: pos === ids.length - 1, icon: <ChevronsDown size={14} /> })}
          {page && <><hr />{item(`Open page "${page.title || 'Untitled'}"`, () => { setPageId(page.id); setView('pages'); }, { icon: <BookOpen size={14} /> })}</>}
        </> : <>
          {item('Select', () => { setActiveTarget(ctx.t); setSelectedId(e.id); }, { icon: <MousePointerClick size={14} /> })}
          {e.marker && item('Remove marker', () => patchEntity(e.id, { marker: undefined }, undefined, ctx.t), { icon: <X size={14} /> })}
        </>}
        <hr />
        {item('Delete', () => { deleteEntity(e.id, mech ? 'base' : ctx.t); notify(`${e.name} deleted. Ctrl+Z to undo.`); }, { danger: true, icon: <Trash2 size={14} /> })}
      </div>
    );
  };
  const selectTelegraph = (id: string, scroll = true) => {
    setActiveTarget(mechTarget(id));
    setSelectedId(id);
    if (scroll) requestAnimationFrame(() => document.querySelector(`[data-timeline-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };
  const saveDiagram = (pageId: string | null, diagram: Diagram) => {
    const page = pageId ? plan.pages.find(g => g.id === pageId) : createPage(diagram.caption || 'New mechanic');
    if (!page) return;
    commit(p => ({ ...p, pages: pageId
      ? p.pages.map(g => g.id === pageId ? { ...g, blocks: [...g.blocks, mapBlock(diagram)] } : g)
      : [...p.pages, { ...page, blocks: [...page.blocks, mapBlock(diagram)] }] }));
    notify(`Map saved to "${page.title || 'Untitled page'}"`);
  };
  const dragOver = (tile: [number, number] | null, t: Target) => {
    if (!dragItem) return;
    setHover(tile); setHoverTarget(t);
    if (tile && dragItem.type === 'terrain' && !mechOf(t)) { setActiveTarget(t); commit(pl => paintOn(pl, t, brushTiles(...tile), dragItem.terrain), `drag-paint-${t}`); }
  };
  const dropOn = (tile: [number, number], t: Target) => {
    if (dragItem?.type === 'waymark') { const k = dragItem.key; commit(pl => updatePhase(pl, pi, f => setWaymark(f, k, tile))); setActiveTarget(t); setSelectedId(waymarkId(k)); }
    else if (dragItem && dragItem.type !== 'terrain') spawn(dragItem, tile, undefined, t);
    setDragItem(null);
  };
  const goPhase = (i: number) => setPhaseIndex(Math.max(0, Math.min(plan.phases.length - 1, i)));
  const addPhase = () => {
    const next: Phase = { id: uid('phase'), name: `Phase ${plan.phases.length + 1}`, notes: '', terrain: phase.terrain.map(r => r.slice()), entities: phase.entities.filter(e => isUnit(e.kind)).map(e => ({ ...e })), conversations: [] };
    commit(p => ({ ...p, phases: [...p.phases.slice(0, pi + 1), next, ...p.phases.slice(pi + 1)] }));
    setPhaseIndex(pi + 1);
  };
  const duplicatePhase = () => {
    const copy: Phase = { ...phase, id: uid('phase'), name: `${phase.name} (copy)`, terrain: phase.terrain.map(r => r.slice()), entities: phase.entities.map(e => ({ ...e })), conversations: phase.conversations.map(c => ({ ...c, id: uid('conv'), lines: c.lines.map(l => isAction(l) ? { ...l, id: uid('act') } : { ...l, id: uid('line'), options: l.options.map(o => ({ ...o, id: uid('opt') })) }) })) };
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
  const duplicate = async () => {
    setMenu(false);
    try {
      await pushSave(plan);
      const id = await duplicateEncounter(encounterId);
      if (id) router.push(`/encounters/${id}`);
    } catch (e) { notify(`Could not duplicate this encounter: ${(e as Error).message}`); }
  };

  // Keyboard shortcuts (ignored while typing in a field).
  useEffect(() => {
    if (presenting) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      if (view === 'pages' && !(e.ctrlKey || e.metaKey)) return;
      const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && k === 'y') { e.preventDefault(); redo(); return; }
      if (mod) return;
      if (k === 'escape' && picking) { setPicking(null); return; }
      if (k === 'escape') { setSelectedId(null); setShortcuts(false); setMenu(false); }
      else if (k === 'r' && selected && isUnit(selected.kind)) patchEntity(selected.id, { rotation: (unitFacing(selected, targetPhase.entities) - (unitFacing(selected, targetPhase.entities) % 45) + (e.shiftKey ? 315 : 45)) % 360, faceToward: undefined }, `rotate-${selected.id}`);
      else if (k === 'p') setPresenting(true);
      else if (k === '[') goPhase(pi - 1);
      else if (k === ']') goPhase(pi + 1);
      else if (k === '?') setShortcuts(s => !s);
      else if ((k === 'delete' || k === 'backspace') && selected) deleteEntity(selected.id);
      else if ((k === 'delete' || k === 'backspace') && waymarkOf(selectedId)) { const w = waymarkOf(selectedId)!; commit(pl => updatePhase(pl, pi, f => setWaymark(f, w, null))); setSelectedId(null); }
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

  const placing = dragItem ?? tool;
  const highlight = hover && placing.type === 'terrain' ? (() => { const o = Math.floor((brush - 1) / 2); return { x: hover[0] - o, y: hover[1] - o, size: brush }; })()
    : hover && (placing.type === 'unit' || placing.type === 'mechanic') ? { x: Math.min(hover[0], plan.cols - footprint(placing)), y: Math.min(hover[1], plan.rows - footprint(placing)), size: footprint(placing) } : null;
  const units = phase.entities.filter(e => isUnit(e.kind));
  const moveCount = prevPhase ? units.filter(u => { const b = prevPhase.entities.find(e => e.id === u.id); return b && (b.x !== u.x || b.y !== u.y); }).length : 0;
  // While the Story tab is open, the line being edited shows as a bubble over its speaker.
  // Actions preview from where earlier actions in the phase leave the actor.
  const script = scriptOf(phase);
  const activeIndex = Math.max(0, script.findIndex(s => s.step.id === activeLineId));
  const active = script[activeIndex];
  const activeLine = active?.step;
  const spoken = view === 'timeline' && active && !isAction(active.step) ? active.step : null;
  const speech = spoken && active ? {
    speaker: spoken.speaker, text: spoken.text, options: spoken.options.map(o => o.text), placement: spoken.placement,
    turnLabel: [active.conversation.title, triggerLabel(active.conversation.trigger, phase)].filter(Boolean).join(' · ').toUpperCase(),
  } : null;
  const acting = view === 'timeline' && active && isAction(active.step) ? active.step : null;
  // In the Story tab the map shows the scene at the selected step: units where earlier actions moved and turned them,
  // so a line spoken after a turn appears over the unit facing its new way.
  const scene = view === 'timeline' && active ? sceneAtStep(phase, plan, active.conversation.id, active.step.id) : phase;
  const staged = scene !== phase;
  const mapPlan = staged ? { ...plan, phases: plan.phases.map((p, i) => i === pi ? scene : p) } : plan;
  /** Units standing somewhere other than their starting position because of earlier actions. */
  /** What a map shows: its editable map, or, while a step of its conversation is selected, the scene at that step. */
  const displayFor = (t: Target): Phase => t !== 'base' && active && active.conversation.id === t ? sceneAtStep(phase, plan, t, active.step.id) : phaseFor(t);
  const displacedIn = (t: Target, id: string) => {
    const a = displayFor(t).entities.find(e => e.id === id), b = phaseFor(t).entities.find(e => e.id === id);
    return !!a && !!b && (a.x !== b.x || a.y !== b.y || a.rotation !== b.rotation);
  };
  const displaced = (id: string) => displacedIn(activeTarget, id);
  const stage = (() => {
    if (!acting) return null;
    const from = scene.entities.find(e => e.id === acting.actor);
    return from ? { step: acting, from, text: actionText(acting, phase), rotation: faceRotation(acting, scene.entities) } : null;
  })();
  const mapCard = (t: Target, conv?: Conversation) => {
    const display = withTelegraphs(displayFor(t), mechOf(t) ? [mechOf(t)!] : []);
    const shown = { ...plan, phases: plan.phases.map((f, i) => i === pi ? display : f) };
    const isActive = activeTarget === t, here = !!conv && !!active && active.conversation.id === conv.id;
    const cellSize = Math.max(10, Math.min(24, Math.floor(420 / (plan.cols + 1))));
    return (
      <div className={`timeline-map${isActive ? ' active' : ''}`}>
        <div className="timeline-map-head">
          <span>{t === 'base' ? 'Starting map' : mechOf(t) ? 'At this moment' : conv?.scene ? 'Own map' : 'Continues from before'}{isActive && <b> · editing</b>}</span>
          {conv?.scene && <button type="button" className="text-button" title="Drop this conversation's own map and continue from the one before" onClick={() => commit(p => updatePhase(p, pi, f => ({ ...f, conversations: f.conversations.map(c => c.id === conv.id ? { ...c, scene: undefined } : c) })))}>Reset</button>}
          {(conv || mechOf(t)) && <SaveToPageMenu plan={plan} onSave={pageId => saveDiagram(pageId, sceneToDiagram(display, plan, conv?.title || phase.entities.find(e => e.id === mechOf(t))?.name || 'Map'))} />}
        </div>
        <div className={`timeline-map-canvas mode-${tool.type}`}>
          <BattleMap ref={t === 'base' ? mapRef : undefined} className="battlemap" plan={shown} phaseIndex={pi} cell={cellSize} selectedId={isActive ? selectedId : null}
            showMoves={t === 'base' && layers.moves} showTerrain={layers.terrain} showTelegraphs={layers.telegraphs}
            transform={isActive && tool.type === 'select' && !(selectedId && displacedIn(t, selectedId))}
            highlight={hoverTarget === t ? highlight : null} speech={here ? speech : null} stage={here ? stage : null}
            onPointer={pointerFor(t)} onLeave={() => setHover(null)} onEntityMenu={(id, x, y) => openMenu(id, x, y, t)}
            onDragTile={tile => dragOver(tile, t)} onDropTile={tile => dropOn(tile, t)} />
        </div>
      </div>
    );
  };
  const isTool = (t: Tool) => JSON.stringify(t) === JSON.stringify(tool);

  return (
    <div className="app">
      <header className="topbar">
        <Link href="/" className="brand"><Logo /><span>Raid<em>Designer</em></span></Link>
        <nav className="crumb" aria-label="Breadcrumb"><Link href="/">Encounters</Link><i>/</i><b>{plan.name}</b></nav>
        <div className="view-switch" role="tablist" aria-label="View">
          <button type="button" role="tab" aria-selected={view === 'timeline'} onClick={() => setView('timeline')}><ListOrdered size={13} /> Timeline</button>
          <button type="button" role="tab" aria-selected={view === 'pages'} onClick={() => setView('pages')}><BookOpen size={13} /> Mechanics{plan.pages.length > 0 && <span className="tab-count">{plan.pages.length}</span>}</button>
        </div>
        <div className="header-actions">
          {saveState === 'error'
            ? <button type="button" className="save-status error" title={saveError} onClick={() => saveNow(latest.current)}><i />Not saved · Retry</button>
            : <span className={`save-status ${saveState}`} title="Saved to cloud storage"><i />{saveState === 'saved' ? 'Saved' : 'Saving…'}</span>}
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

      {view === 'pages' ? (
        <MechanicPages
          plan={plan} pageId={pageId} onSelect={setPageId}
          onCreate={() => { const page = createPage('New mechanic'); commit(p => ({ ...p, pages: [...p.pages, page] })); setPageId(page.id); }}
          onChange={(id, patch, key) => commit(p => ({ ...p, pages: p.pages.map(g => g.id === id ? { ...g, ...patch } : g) }), key)}
          onUpdate={(id, fn, key) => commit(p => ({ ...p, pages: p.pages.map(g => g.id === id ? fn(g) : g) }), key)}
          onDelete={id => {
            commit(p => ({ ...p, pages: p.pages.filter(g => g.id !== id), phases: p.phases.map(f => ({ ...f, entities: f.entities.map(e => e.page === id ? { ...e, page: undefined } : e) })) }));
            setPageId(null);
          }}
          onShow={(phaseIndex, entityId) => { setView('timeline'); setPhaseIndex(phaseIndex); setActiveTarget('base'); setSelectedId(entityId); }}
        />
      ) : (
      <div className="workspace">
        <aside className="sidebar left" aria-label="Tools">
          <div className="project-heading">
            <label className="eyebrow" htmlFor="plan-name">Encounter</label>
            <input id="plan-name" className="plan-name" value={plan.name} maxLength={120} onChange={e => commit(p => ({ ...p, name: e.target.value }), 'plan-name')} />
            <div className="badges"><button type="button" title="Change map size" onClick={() => setResizing(true)}><Maximize2 size={10} /> {plan.cols} × {plan.rows} tiles</button><span>{plan.phases.length} phase{plan.phases.length > 1 ? 's' : ''}</span></div>
          </div>
          <div className="tool-sections">
            <section>
              <div className="section-title">Terrain <span>Drag or paint · T</span></div>
              <div className="grid-3">
                {(Object.keys(terrainTypes) as Terrain[]).map(t => (
                  <button key={t} type="button" className="tool-tile" title={`Drag across a map to paint ${terrainTypes[t].name.toLowerCase()}`} onClick={() => notify('Drag it onto a map to place it')} {...dragProps({ type: 'terrain', terrain: t })}>
                    <span className={`swatch ${t}`} />{terrainTypes[t].name}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <div className="section-title">Units <span>Drag or place · U</span></div>
              {(Object.keys(unitCategories) as (keyof typeof unitCategories)[]).map(cat => (
                <div key={cat} className="unit-group" role="group" aria-label={unitCategories[cat].name}>
                  <div className="unit-group-title">{unitCategories[cat].name}</div>
                  <div className="grid-3">
                    {unitsIn(cat).map(k => (
                      <button key={k} type="button" className="tool-tile unit" title={`Drag onto a map to place a ${unitTypes[k].name.toLowerCase()}`} onClick={() => notify('Drag it onto a map to place it')} {...dragProps({ type: 'unit', kind: k })}>
                        <span className="unit-dot" style={{ borderColor: unitTypes[k].color }}><Glyph kind={k} size={13} color={unitTypes[k].color} strokeWidth={2.2} /></span>{unitTypes[k].name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
            <section>
              <div className="section-title">Waymarks <span>Drag onto the floor</span></div>
              <div className="grid-4">
                {waymarkKeys.map(k => (
                  <button key={k} type="button" className={`tool-tile marker-tile${phase.waymarks?.[k] ? ' placed' : ''}`} title={phase.waymarks?.[k] ? `Waymark ${k} is placed; drag again to move it` : `Drag onto the map to place waymark ${k}`} aria-label={`Waymark ${k}`}
                    onClick={() => notify('Drag it onto a map to place it')} {...dragProps({ type: 'waymark', key: k })}>
                    <WaymarkIcon k={k} size={22} />
                  </button>
                ))}
              </div>
            </section>
            <section>
              <div className="section-title">Mechanics <span>Drag or place · M</span></div>
              <div className="grid-3">
                {(Object.keys(mechanicTypes) as MechanicKind[]).map(k => (
                  <button key={k} type="button" className="tool-tile tall" title={`${mechanicTypes[k].description}. Drag onto a map to place it.`} onClick={() => notify('Drag it onto a map to place it')} {...dragProps({ type: 'mechanic', kind: k })}>
                    <Glyph kind={k} size={22} color={mechanicTone({ kind: k })} strokeWidth={1.8} />{mechanicTypes[k].name}
                  </button>
                ))}
              </div>
            </section>
            {(
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
              <div className="eyebrow">Phase {pi + 1} of {plan.phases.length}</div>
              <input aria-label="Phase name" className="phase-name" value={phase.name} maxLength={120} onChange={e => commit(p => updatePhase(p, pi, f => ({ ...f, name: e.target.value })), `phase-name-${phase.id}`)} />
            </div>
            <div className="heading-actions">
              <button type="button" className="icon-button bordered" aria-label="Previous phase" disabled={pi === 0} onClick={() => goPhase(pi - 1)}>‹</button>
              <button type="button" className="icon-button bordered" aria-label="Next phase" disabled={pi === plan.phases.length - 1} onClick={() => goPhase(pi + 1)}>›</button>
            </div>
          </div>

          <div className="canvas-toolbar">
            <div className="toolbar-group">
              <button type="button" className="icon-button" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!hist.past.length} onClick={undo}><Undo2 size={16} /></button>
              <button type="button" className="icon-button" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!hist.future.length} onClick={redo}><Redo2 size={16} /></button>
            </div>
            <div className="toolbar-center">
              {picking ? <span><b>{picking.label ?? 'Click a tile to set where they move'}</b> · Esc to cancel</span> : <span>Drag from the palette onto a map · click to select, drag to move · Delete removes</span>}
              {hover && phase.terrain[hover[1]]?.[hover[0]] && <><i>·</i><span>Tile <b>{tileLabel(...hover)}</b> {terrainTypes[phase.terrain[hover[1]][hover[0]]].name}</span></>}
            </div>
          </div>

            <div className={`timeline-main${picking ? ' picking' : ''}`}>
              <StoryPanel wide
                plan={plan} phaseIndex={pi} activeLineId={activeLine?.id ?? null} onActivate={setActiveLineId}
                defaultSpeaker={(selected && isUnit(selected.kind) ? selected : phase.entities.find(e => e.kind === 'boss'))?.name ?? 'Narrator'}
                onChange={(fn, key) => commit(p => updatePhase(p, pi, f => ({ ...f, conversations: fn(f.conversations) })), key)}
                onPhase={(fn, key) => commit(p => updatePhase(p, pi, fn), key)}
                onMechanic={(id, patch, key) => patchEntity(id, patch, key)}
                onSelectMechanic={id => selectTelegraph(id)}
                onMechanicMenu={(id, x, y) => openMenu(id, x, y, mechTarget(id))}
                onDeleteMechanic={id => { deleteEntity(id, 'base'); notify('Telegraph deleted. Ctrl+Z to undo.'); }}
                onCreatePage={title => { const page = createPage(title); commit(p => ({ ...p, pages: [...p.pages, page] })); return page.id; }}
                onOpenPage={id => { setPageId(id); setView('pages'); }}
                onSaveDiagram={saveDiagram}
                onNewMechanic={id => {
                  // A telegraph placed from a page takes the page's shape and name, and links back to it.
                  const page = plan.pages.find(g => g.id === id);
                  if (!page) return;
                  const kind = pageKind(plan, page), extra = { name: page.title || mechanicTypes[kind].name, page: page.id };
                  // It goes straight onto the timeline: cones and lines start from the boss (facing where it faces), anything
                  // else sits mid-arena, ready to be dragged into place on the map.
                  const boss = bossOf(phase.entities);
                  const freeNearCenter = (): [number, number] => {
                    const cx = Math.floor(plan.cols / 2), cy = Math.floor(plan.rows / 2);
                    for (let r = 0; r < Math.max(plan.cols, plan.rows); r++)
                      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
                        const x = cx + dx, y = cy + dy;
                        if (x >= 0 && y >= 0 && x < plan.cols && y < plan.rows && !entityAt(phase, x, y)) return [x, y];
                      }
                    return [cx, cy];
                  };
                  const tile: [number, number] = aims(kind) && boss ? [boss.x, boss.y] : freeNearCenter();
                  const id2 = spawn({ type: 'mechanic', kind }, tile, extra, 'base');
                  requestAnimationFrame(() => document.querySelector(`[data-timeline-id="${id2}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
                }}
                pickingFor={picking?.id ?? null} onPickTile={apply => setPicking(apply ? { id: activeLine?.id, apply } : null)}
                renderMap={c => mapCard(c.id, c)}
                renderMechanicMap={m => mapCard(mechTarget(m.id))}
                start={(
                  <section className="conversation timeline-start" aria-label="Start of phase">
                    <div className="conv-main">
                      <header className="conversation-head"><span className="timeline-start-title">Start of phase</span></header>
                      <p className="hint">Where everyone stands when the phase begins. Each conversation continues from the one before, or from its own map once you edit it.</p>
                    </div>
                    <div className="conv-side">{mapCard('base')}</div>
                  </section>
                )}
              />
            </div>

          <div className="canvas-status">
            <span>{units.length} units · {phase.entities.length - units.length} telegraphs{prevPhase ? ` · ${moveCount} moved since phase ${pi}` : ''}</span>
            <span>Click a map to edit it · Drag from the palette onto any map · Arrow keys nudge</span>
          </div>
        </main>

        <aside className="sidebar right" aria-label="Phases and details">
          <section className="phases-side" aria-label="Phases">
            <div className="section-title">Phases
              <div className="phase-actions">
                <button type="button" className="icon-button" aria-label="Duplicate phase" title="Duplicate phase" onClick={duplicatePhase}><Copy size={13} /></button>
                <button type="button" className="icon-button danger" aria-label="Delete phase" title="Delete phase" disabled={plan.phases.length === 1} onClick={deletePhase}><Trash2 size={13} /></button>
                <button type="button" className="text-button" onClick={addPhase}><Plus size={13} /> Add</button>
              </div>
            </div>
            <div className="phase-list vertical">
              {plan.phases.map((p, i) => (
                <button key={p.id} type="button" className={`phase-card${i === pi ? ' active' : ''}`} aria-current={i === pi ? 'step' : undefined} onClick={() => setPhaseIndex(i)}>
                  <span className="phase-number"><span>Phase {i + 1}</span>{p.conversations.length > 0 && <span className="phase-lines" title={`${p.conversations.length} conversation${p.conversations.length > 1 ? 's' : ''}`}><MessageSquare size={10} /> {p.conversations.length}</span>}</span>
                  <b>{p.name}</b>
                </button>
              ))}
            </div>
          </section>
          <div className="details-panel">
          {activeTarget !== 'base' && view === 'timeline' && (
            <div className="target-note">{mechOf(activeTarget)
              ? <>Editing <b>{phase.entities.find(e => e.id === mechOf(activeTarget))?.name || 'a telegraph'}</b> on its own map</>
              : <>Editing the map of <b>{phase.conversations.find(c => c.id === activeTarget)?.title || 'a conversation'}</b></>}</div>
          )}
          <Inspector
            plan={plan} phase={targetPhase} prevPhase={prevPhase} entity={selected}
            onChange={(patch, key) => selected && patchEntity(selected.id, patch, key)}
            onDelete={() => selected && deleteEntity(selected.id)}
            onSelect={id => { const e = phase.entities.find(x => x.id === id); if (e && isMechanic(e.kind)) selectTelegraph(id); else setSelectedId(id); }}
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
          </div>
        </aside>
      </div>
      )}

      {resizing && (
        <MapSizeDialog plan={plan} onClose={() => setResizing(false)} onApply={(cols, rows, anchor, fill) => {
          commit(p => resizePlan(p, cols, rows, anchor, fill));
          setResizing(false);
          notify(`Map resized to ${cols} × ${rows}`);
        }} />
      )}
      {shortcuts && (
        <div className="dialog-backdrop" onClick={() => setShortcuts(false)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" onClick={e => e.stopPropagation()}>
            <button type="button" className="icon-button dialog-close" aria-label="Close" onClick={() => setShortcuts(false)}><X size={16} /></button>
            <h2 id="shortcuts-title">Keyboard shortcuts</h2>
            <dl>
              {[['Drag from palette', 'Place a unit or telegraph; drag terrain across tiles to paint'], ['Arrow keys', 'Nudge selection one tile'], ['R / Shift+R', 'Rotate unit 45°'], ['Delete', 'Remove selection'],
                ['[ and ]', 'Previous / next phase'], ['Ctrl+Z', 'Undo'], ['Ctrl+Shift+Z', 'Redo'], ['P', 'Present mode'], ['Esc', 'Deselect']].map(([k, v]) => (
                <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>
              ))}
            </dl>
          </div>
        </div>
      )}
      {contextMenu()}
      <div className={`toast${toast ? ' visible' : ''}`} role="status">{toast}</div>
    </div>
  );
}
