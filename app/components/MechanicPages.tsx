'use client';
import { BookOpen, Map as MapIcon, MapPin, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { DiagramEditor } from './DiagramEditor';
import { Inspector } from './Inspector';
import { MapPreviews } from './MapPreview';
import { clampEntity, diagramPlan, blankDiagram, sceneToDiagram, isMechanic, mechanicTone, mechanicTypes, pageKind, triggerLabel, type Diagram, type MechanicKind, type MechanicPage, type Plan } from '../plan';
import { Glyph } from './glyphs';

type Props = {
  plan: Plan;
  pageId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onChange: (id: string, patch: Partial<MechanicPage>, coalesceKey?: string) => void;
  /** Functional page update, for edits that build on the latest saved page (map drags). */
  onUpdate: (id: string, fn: (page: MechanicPage) => MechanicPage, coalesceKey?: string) => void;
  onDelete: (id: string) => void;
  /** Jump to a telegraph that uses the page: its phase on the map, selected. */
  onShow: (phaseIndex: number, entityId: string) => void;
};

/** Every telegraph, in any phase, that links to a page. */
export function pageUses(plan: Plan, pageId: string) {
  return plan.phases.flatMap((phase, phaseIndex) => phase.entities
    .filter(e => isMechanic(e.kind) && e.page === pageId)
    .map(mechanic => ({ phase, phaseIndex, mechanic })));
}

/** One write-up per mechanic, shared by every telegraph that links to it from the map or the timeline. */
export function MechanicPages({ plan, pageId, onSelect, onCreate, onChange, onUpdate, onDelete, onShow }: Props) {
  const [addMenu, setAddMenu] = useState(false);
  /** The unit or telegraph selected on one of the page's maps, shown in the Details column. */
  const [sel, setSel] = useState<{ diagramId: string; entityId: string } | null>(null);
  const page = plan.pages.find(p => p.id === pageId) ?? plan.pages[0];
  const uses = page ? pageUses(plan, page.id) : [];
  return (
    <div className="pages">
      <aside className="pages-list" aria-label="Mechanic pages">
        <div className="section-title">Mechanic pages <span>{plan.pages.length}</span></div>
        <button type="button" className="button" onClick={onCreate}><Plus size={14} /> New page</button>
        <nav>
          {plan.pages.map(p => {
            const count = pageUses(plan, p.id).length;
            return (
              <button key={p.id} type="button" className={`pages-item${p.id === page?.id ? ' active' : ''}`} aria-current={p.id === page?.id ? 'page' : undefined} onClick={() => onSelect(p.id)}>
                <b>{p.title || 'Untitled page'}</b>
                <small>{count ? `Used ${count} time${count > 1 ? 's' : ''}` : 'Not linked yet'}{(p.diagrams ?? []).length ? ` · ${(p.diagrams ?? []).length} map${(p.diagrams ?? []).length > 1 ? 's' : ''}` : ''}</small>
                <MapPreviews diagrams={p.diagrams} width={110} max={1} />
              </button>
            );
          })}
        </nav>
      </aside>
      {page ? (
        <article className="page-editor">
          <div className="eyebrow"><BookOpen size={11} /> Mechanic page</div>
          <input aria-label="Page title" className="page-title" value={page.title} maxLength={120} placeholder="Mechanic name" onChange={e => onChange(page.id, { title: e.target.value }, `page-title-${page.id}`)} />
          <label className="field page-shape">
            <span>Shape on the map</span>
            <div className="page-shape-row">
              <span className="page-use-icon" style={{ background: mechanicTone({ kind: pageKind(plan, page) }) }}><Glyph kind={pageKind(plan, page)} size={13} color="#141819" strokeWidth={2.2} /></span>
              <select value={pageKind(plan, page)} onChange={e => onChange(page.id, { kind: e.target.value as MechanicKind })}>
                {(Object.keys(mechanicTypes) as MechanicKind[]).map(k => <option key={k} value={k}>{mechanicTypes[k].name} · {mechanicTypes[k].description}</option>)}
              </select>
            </div>
            <small className="hint">Used when you place this mechanic from the Timeline's New mechanic menu.</small>
          </label>
          <label className="field page-description">
            <span>Description</span>
            <textarea value={page.description} maxLength={20000} placeholder="What the mechanic does, how to spot it, and how the raid should handle it."
              onChange={e => onChange(page.id, { description: e.target.value }, `page-desc-${page.id}`)} />
          </label>
          <section className="page-maps">
            <div className="section-title">Maps <span className="plain">Illustrate the mechanic step by step</span></div>
            {(page.diagrams ?? []).length === 0 && <p className="hint">No maps yet. Add a blank map, copy a phase, or save a conversation's map from the Timeline.</p>}
            {(page.diagrams ?? []).map((d, i, all) => (
              <DiagramEditor key={d.id} diagram={d} index={i} count={all.length}
                selectedId={sel?.diagramId === d.id ? sel.entityId : null} onSelect={id => setSel(id ? { diagramId: d.id, entityId: id } : null)}
                onChange={(fn, key) => onUpdate(page.id, g => ({ ...g, diagrams: (g.diagrams ?? []).map(x => x.id === d.id ? fn(x) : x) }), key)}
                onMove={by => onUpdate(page.id, g => { const ds = (g.diagrams ?? []).slice(); [ds[i], ds[i + by]] = [ds[i + by], ds[i]]; return { ...g, diagrams: ds }; })}
                onDelete={() => onUpdate(page.id, g => ({ ...g, diagrams: (g.diagrams ?? []).filter(x => x.id !== d.id) }))} />
            ))}
            <div className="menu-wrap">
              <button type="button" className="button" aria-haspopup="menu" aria-expanded={addMenu} onClick={() => setAddMenu(o => !o)}><Plus size={14} /> Add map</button>
              {addMenu && (
                <div className="menu mechanic-menu" role="menu">
                  {[{ label: 'Blank map', sub: `${plan.cols} × ${plan.rows} floor`, make: () => blankDiagram(plan.cols, plan.rows, `Map ${(page.diagrams ?? []).length + 1}`) },
                    ...plan.phases.map((f, fi) => ({ label: `Copy phase ${fi + 1}: ${f.name}`, sub: 'Terrain and units as placed in that phase', make: (): Diagram => sceneToDiagram(f, plan, f.name) }))]
                    .map(o => (
                      <button key={o.label} type="button" role="menuitem" onClick={() => { setAddMenu(false); const d = o.make(); onUpdate(page.id, g => ({ ...g, diagrams: [...(g.diagrams ?? []), d] })); }}>
                        <MapIcon size={14} /> <span><b>{o.label}</b><small>{o.sub}</small></span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </section>
          <section className="page-uses">
            <div className="section-title">Used in the timeline</div>
            {uses.length === 0 && <p className="hint">No telegraph links here yet. In a phase's Timeline tab, pick this page on a telegraph's card.</p>}
            {uses.map(({ phase, phaseIndex, mechanic }) => (
              <button key={`${phase.id}-${mechanic.id}`} type="button" className="page-use" onClick={() => onShow(phaseIndex, mechanic.id)}>
                <span className="page-use-icon" style={{ background: mechanicTone(mechanic) }}><Glyph kind={mechanic.kind} size={13} color="#141819" strokeWidth={2.2} /></span>
                <span className="page-use-text">
                  <b>{mechanic.name}</b>
                  <small>Phase {phaseIndex + 1}: {phase.name} · {mechanicTypes[mechanic.kind as MechanicKind].name}{mechanic.trigger ? ` · ${triggerLabel(mechanic.trigger, phase)}` : ''}</small>
                </span>
                <MapPin size={14} />
              </button>
            ))}
          </section>
          <button type="button" className="delete-button" onClick={() => { if (confirm(`Delete the page "${page.title || 'Untitled page'}"? Telegraphs linked to it keep working but lose the link.`)) onDelete(page.id); }}>
            <Trash2 size={13} /> Delete page
          </button>
        </article>
      ) : (
        <div className="page-empty">
          <BookOpen size={28} />
          <h2>No mechanic pages yet</h2>
          <p className="hint">Write up a mechanic once and link every telegraph that uses it, in any phase.</p>
          <button type="button" className="button primary" onClick={onCreate}><Plus size={14} /> New page</button>
        </div>
      )}
      <aside className="sidebar right pages-details" aria-label="Details">
        {(() => {
          const diagram = page?.diagrams?.find(d => d.id === sel?.diagramId);
          const entity = diagram?.entities.find(e => e.id === sel?.entityId);
          if (!page || !diagram || !entity) return <p className="hint pages-details-hint">Select a unit or telegraph on one of this page's maps to edit its details.</p>;
          const scene = diagramPlan(diagram);
          const patchDiagram = (fn: (d: Diagram) => Diagram, key?: string) =>
            onUpdate(page.id, g => ({ ...g, diagrams: (g.diagrams ?? []).map(x => x.id === diagram.id ? fn(x) : x) }), key);
          return <>
            <div className="target-note">Editing <b>{diagram.caption || 'a map'}</b></div>
            <Inspector
              plan={scene} phase={scene.phases[0]} prevPhase={null} entity={entity}
              onChange={(patch, key) => patchDiagram(d => ({ ...d, entities: d.entities.map(e => e.id === entity.id ? clampEntity({ ...e, ...patch }, diagramPlan(d)) : e) }), key && `page-${key}`)}
              onDelete={() => { patchDiagram(d => ({ ...d, entities: d.entities.filter(e => e.id !== entity.id).map(e => e.anchor === entity.id ? { ...e, anchor: undefined } : e) })); setSel(null); }}
              onSelect={id => setSel({ diagramId: diagram.id, entityId: id })}
            />
          </>;
        })()}
      </aside>
    </div>
  );
}
