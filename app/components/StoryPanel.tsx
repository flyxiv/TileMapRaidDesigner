'use client';
import { ArrowDown, ArrowUp, BookOpen, Crosshair, Footprints, GripVertical, Hand, MapPin, MessageSquare, PanelTop, Plus, RotateCw, Trash2, X } from 'lucide-react';
import { Fragment, useRef, useState } from 'react';
import { BattleMap } from './BattleMap';
import { MapPreviews } from './MapPreview';
import { Glyph } from './glyphs';
import { scriptOf, sceneToDiagram, stagePhase, type Diagram, mechanicTone, mechanicTypes, pageKind, timelineOf, type MechanicKind, type MechanicPage, actionKinds, compassName, createAction, isAction, motionPresets, tileLabel, type ActionStep, type ConversationStep, type Entity, type StageAction, createConversation, createLine, uid, createOption, hpTarget, isMechanic, isUnit, triggerTypes, unitCategories, unitTypes, type Conversation, type DialogueLine, type DialogueOption, type DialogueTrigger, type Phase, type Plan, type UnitCategory, type UnitKind } from '../plan';

type Props = {
  plan: Plan;
  phaseIndex: number;
  /** Speaker for new lines: the selected unit, else the first boss. */
  defaultSpeaker: string;
  /** The line shown as a bubble on the map. */
  activeLineId: string | null;
  onActivate: (id: string) => void;
  onChange: (fn: (conversations: Conversation[]) => Conversation[], coalesceKey?: string) => void;
  /** Changes to the phase beyond its conversations: timeline order, and conversations created by splitting. */
  onPhase: (fn: (phase: Phase) => Phase, coalesceKey?: string) => void;
  /** Telegraphs in the timeline: edit, select on the map, and link to mechanic pages. */
  onMechanic: (id: string, patch: Partial<Entity>, coalesceKey?: string) => void;
  onSelectMechanic: (id: string) => void;
  onCreatePage: (title: string) => string;
  onOpenPage: (id: string) => void;
  /** Copy a map into a mechanic page's Maps (`null` makes a new page for it). */
  onSaveDiagram: (pageId: string | null, diagram: Diagram) => void;
  /** Main-screen layout: each conversation shows `renderMap` beside its script, and `start` heads the timeline. */
  wide?: boolean;
  renderMap?: (c: Conversation) => React.ReactNode;
  start?: React.ReactNode;
  /** Start placing a telegraph for a mechanic page: the next map click puts it there. */
  onNewMechanic: (pageId: string) => void;
  /** The page whose telegraph is waiting to be placed. */
  placingMechanic: string | null;
  /** Asks the editor for the next tile clicked on the map; `null` while no pick is pending. */
  onPickTile: (apply: ((tile: [number, number]) => void) | null) => void;
  pickingFor: string | null;
};

/** Role color for a speaker whose name matches a unit in the phase. */
export function speakerColor(phase: Phase, speaker: string) {
  const unit = phase.entities.find(e => isUnit(e.kind) && e.name === speaker);
  return unit ? unitTypes[unit.kind as UnitKind].color : '#c9d0cd';
}

const swap = <T,>(list: T[], i: number, j: number) => { const next = list.slice(); [next[i], next[j]] = [next[j], next[i]]; return next; };
/** Moves item `from` so it lands at position `to` among the other items. */
const moveTo = <T,>(list: T[], from: number, to: number) => { const next = list.slice(); const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; };

/**
 * Drag-to-reorder for the conversation cards, using pointer events on a handle so it works with mouse, touch and pen.
 * While dragging, `target` is where the card would land among the other cards (0 = first).
 */
function useReorder(count: number, onMove: (from: number, to: number) => void) {
  const cards = useRef(new Map<number, HTMLElement>());
  const [drag, setDrag] = useState<{ from: number; target: number } | null>(null);
  const targetAt = (from: number, y: number) => {
    let target = 0;
    for (let i = 0; i < count; i++) {
      if (i === from) continue;
      const r = cards.current.get(i)?.getBoundingClientRect();
      if (r && y > r.top + r.height / 2) target++;
    }
    return target;
  };
  const handleProps = (index: number) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ from: index, target: index });
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (!drag) return;
      // Scroll the sidebar when dragging near its edges.
      const scroller = e.currentTarget.closest('.sidebar');
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        if (e.clientY < r.top + 48) scroller.scrollTop -= 12;
        else if (e.clientY > r.bottom - 48) scroller.scrollTop += 12;
      }
      const target = targetAt(drag.from, e.clientY);
      if (target !== drag.target) setDrag({ ...drag, target });
    },
    onPointerUp: () => { if (drag && drag.target !== drag.from) onMove(drag.from, drag.target); setDrag(null); },
    onPointerCancel: () => setDrag(null),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowUp' && index > 0) { e.preventDefault(); onMove(index, index - 1); }
      else if (e.key === 'ArrowDown' && index < count - 1) { e.preventDefault(); onMove(index, index + 1); }
    },
  });
  /** Class for card `index`: the dragged card, or the card the drop line sits against. */
  const cardClass = (index: number) => {
    if (!drag) return '';
    if (index === drag.from) return ' dragging';
    const others = Array.from({ length: count }, (_, i) => i).filter(i => i !== drag.from);
    if (drag.target < others.length && others[drag.target] === index) return ' drop-before';
    if (drag.target === others.length && others[others.length - 1] === index) return ' drop-after';
    return '';
  };
  const cardRef = (index: number) => (el: HTMLElement | null) => { if (el) cards.current.set(index, el); else cards.current.delete(index); };
  return { handleProps, cardClass, cardRef, dragging: !!drag };
}

type LineTarget = { conv: string; index: number } | { newAt: number };

/**
 * Dragging a line by the strip along its left edge. It can land between lines of any conversation, or on one of the
 * "New conversation" zones that appear between conversations while dragging, which splits it out on its own.
 */
function useLineDrag(conversations: Conversation[], onDrop: (from: { conv: string; index: number }, to: LineTarget) => void) {
  const lineEls = useRef(new Map<string, HTMLElement>());
  const listEls = useRef(new Map<string, HTMLElement>());
  const zoneEls = useRef(new Map<number, HTMLElement>());
  const [drag, setDrag] = useState<{ conv: string; index: number; lineId: string; target: LineTarget | null } | null>(null);

  const targetAt = (y: number, from: { conv: string; lineId: string }): LineTarget | null => {
    for (const [newAt, el] of zoneEls.current) {
      const r = el.getBoundingClientRect();
      if (y >= r.top - 4 && y <= r.bottom + 4) return { newAt };
    }
    let best: { conv: string; dist: number } | null = null;
    for (const [conv, el] of listEls.current) {
      const r = el.getBoundingClientRect();
      const dist = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      if (dist < 40 && (!best || dist < best.dist)) best = { conv, dist };
    }
    if (!best) return null;
    const c = conversations.find(x => x.id === best!.conv);
    if (!c) return null;
    const index = c.lines.filter(l => l.id !== from.lineId).filter(l => {
      const r = lineEls.current.get(l.id)?.getBoundingClientRect();
      return r && y > r.top + r.height / 2;
    }).length;
    return { conv: c.id, index };
  };

  const handleProps = (conv: string, index: number, lineId: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ conv, index, lineId, target: null });
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (!drag) return;
      const scroller = e.currentTarget.closest('.sidebar');
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        if (e.clientY < r.top + 48) scroller.scrollTop -= 12;
        else if (e.clientY > r.bottom - 48) scroller.scrollTop += 12;
      }
      const target = targetAt(e.clientY, drag);
      if (JSON.stringify(target) !== JSON.stringify(drag.target)) setDrag({ ...drag, target });
    },
    onPointerUp: () => {
      if (drag?.target) {
        const t = drag.target;
        const unchanged = 'conv' in t && t.conv === drag.conv && t.index === drag.index;
        if (!unchanged) onDrop({ conv: drag.conv, index: drag.index }, t);
      }
      setDrag(null);
    },
    onPointerCancel: () => setDrag(null),
  });

  /** Drop-line class for a line card, or for an empty conversation's list. */
  const lineClass = (conv: Conversation, lineId: string) => {
    if (!drag) return '';
    if (lineId === drag.lineId) return ' dragging';
    const t = drag.target;
    if (!t || !('conv' in t) || t.conv !== conv.id) return '';
    const others = conv.lines.filter(l => l.id !== drag.lineId);
    if (others[t.index]?.id === lineId) return ' drop-before';
    if (t.index === others.length && others[others.length - 1]?.id === lineId) return ' drop-after';
    return '';
  };
  const listClass = (conv: Conversation) => {
    const t = drag?.target;
    return t && 'conv' in t && t.conv === conv.id && conv.lines.every(l => l.id === drag!.lineId) ? ' drop-into' : '';
  };
  const zoneActive = (newAt: number) => { const t = drag?.target; return !!t && 'newAt' in t && t.newAt === newAt; };
  const refFor = <K,>(map: Map<K, HTMLElement>, key: K) => (el: HTMLElement | null) => { if (el) map.set(key, el); else map.delete(key); };
  return {
    dragging: !!drag, handleProps, lineClass, listClass, zoneActive,
    lineRef: (id: string) => refFor(lineEls.current, id), listRef: (id: string) => refFor(listEls.current, id), zoneRef: (i: number) => refFor(zoneEls.current, i),
  };
}

export function StoryPanel({ plan, phaseIndex, defaultSpeaker, activeLineId, onActivate, onChange, onPhase, onMechanic, onSelectMechanic, onCreatePage, onOpenPage, onNewMechanic, placingMechanic, onSaveDiagram, onPickTile, pickingFor, wide, renderMap, start }: Props) {
  const [mechanicMenu, setMechanicMenu] = useState(false);
  const placingPage = placingMechanic ? plan.pages.find(g => g.id === placingMechanic) : undefined;
  const phase = plan.phases[phaseIndex];
  const conversations = phase.conversations;
  const items = timelineOf(phase);
  const idsOf = (f: Phase) => timelineOf(f).map(i => i.id);

  const patchConversation = (id: string, fn: (c: Conversation) => Conversation, key?: string) => onChange(cs => cs.map(c => c.id === id ? fn(c) : c), key);
  const reorder = useReorder(items.length, (from, to) => onPhase(f => ({ ...f, timeline: moveTo(idsOf(f), from, to) })));
  const lineDrag = useLineDrag(conversations, (from, to) => onPhase(f => {
    const source = f.conversations.find(c => c.id === from.conv);
    const line = source?.lines[from.index];
    if (!source || !line) return f;
    let conversations = f.conversations.map(c => c.id === from.conv ? { ...c, lines: c.lines.filter((_, i) => i !== from.index) } : c);
    let timeline = idsOf(f);
    if ('newAt' in to) {
      // Splitting a step out starts a new conversation on the same trigger, at that spot in the timeline.
      const split: Conversation = { id: uid('conv'), title: '', trigger: { ...source.trigger }, lines: [line] };
      conversations = [...conversations, split];
      timeline = [...timeline.slice(0, to.newAt), split.id, ...timeline.slice(to.newAt)];
    } else {
      conversations = conversations.map(c => c.id === to.conv ? { ...c, lines: [...c.lines.slice(0, to.index), line, ...c.lines.slice(to.index)] } : c);
    }
    // A conversation whose last step was dragged away goes with it, unless it has a title worth keeping.
    const emptied = conversations.find(c => c.id === from.conv && c.lines.length === 0 && !c.title);
    return emptied
      ? { ...f, conversations: conversations.filter(c => c !== emptied), timeline: timeline.filter(id => id !== emptied.id) }
      : { ...f, conversations, timeline };
  }));
  const zone = (newAt: number) => lineDrag.dragging && (
    <div ref={lineDrag.zoneRef(newAt)} className={`new-conversation-zone${lineDrag.zoneActive(newAt) ? ' active' : ''}`}>Drop here for a new conversation</div>
  );
  const addConversation = () => {
    // A new conversation starts from the previous one's trigger so follow-ups are quick to set up.
    const last = conversations[conversations.length - 1];
    const conversation = createConversation(last ? { ...last.trigger } : { type: 'time', seconds: 0 }, defaultSpeaker);
    onChange(cs => [...cs, conversation]);
    onActivate(conversation.lines[0].id);
  };

  return (
    <div className={`story${wide ? ' wide' : ''}${reorder.dragging || lineDrag.dragging ? ' reordering' : ''}`}>
      {!wide && <p className="hint">The phase in order: conversations and the telegraphs on the map. Each starts when its trigger fires (boss HP, encounter time, or time after a mechanic). Drag cards to reorder; link telegraphs to mechanic pages to explain them.</p>}
      {start}
      {items.map((item, ci) => item.kind === 'mechanic' ? (
        <Fragment key={item.id}>
          {zone(ci)}
          <MechanicItem m={item.mechanic} phase={phase} pages={plan.pages} cardRef={reorder.cardRef(ci)} cardClass={reorder.cardClass(ci)} handleProps={reorder.handleProps(ci)}
            onChange={(patch, key) => onMechanic(item.id, patch, key)} onSelect={() => onSelectMechanic(item.id)}
            onCreatePage={onCreatePage} onOpenPage={onOpenPage} />
        </Fragment>
      ) : (c => (
        <Fragment key={c.id}>
        {zone(ci)}
        <section ref={reorder.cardRef(ci)} className={`conversation${reorder.cardClass(ci)}`} aria-label={c.title || `Conversation ${conversations.indexOf(c) + 1}`}>
          <div className="conv-main">
          <header className="conversation-head">
            <button type="button" className="drag-handle" aria-label={`Reorder ${c.title || `conversation ${conversations.indexOf(c) + 1}`}`} title="Drag to reorder (or focus and use the arrow keys)" {...reorder.handleProps(ci)}>
              <GripVertical size={15} />
            </button>
            <input aria-label="Conversation title" className="conversation-title" value={c.title} maxLength={120} placeholder={`Conversation ${conversations.indexOf(c) + 1}`}
              onChange={e => patchConversation(c.id, x => ({ ...x, title: e.target.value }), `title-${c.id}`)} />
            <div className="story-tools">
              <button type="button" className="icon-button danger" aria-label="Delete conversation"
                onClick={() => { if (c.lines.every(l => !isAction(l) && !l.text) || confirm(`Delete "${c.title || `Conversation ${conversations.indexOf(c) + 1}`}" and its ${c.lines.length} step${c.lines.length > 1 ? 's' : ''}?`)) onChange(cs => cs.filter(x => x.id !== c.id)); }}>
                <Trash2 size={13} />
              </button>
            </div>
          </header>
          <TriggerFields phase={phase} trigger={c.trigger} onChange={(t, key) => t && patchConversation(c.id, x => ({ ...x, trigger: t }), key && `${key}-${c.id}`)} />
          {!renderMap && <ConversationMap plan={plan} phaseIndex={phaseIndex} conversation={c} caption={c.title || `Conversation ${conversations.indexOf(c) + 1}`} onSave={onSaveDiagram} />}
          <ol ref={lineDrag.listRef(c.id)} className={`conversation-lines${lineDrag.listClass(c)}`}>
            {c.lines.map((l, li) => {
              const common = {
                phase, index: li, count: c.lines.length, active: l.id === activeLineId,
                liRef: lineDrag.lineRef(l.id), dragClass: lineDrag.lineClass(c, l.id), handleProps: lineDrag.handleProps(c.id, li, l.id),
                onActivate: () => onActivate(l.id),
                onMove: (by: number) => patchConversation(c.id, x => ({ ...x, lines: swap(x.lines, li, li + by) })),
                onDelete: () => patchConversation(c.id, x => ({ ...x, lines: x.lines.filter(y => y.id !== l.id) })),
              };
              const change = <T extends ConversationStep,>(fn: (s: T) => T, key?: string) => patchConversation(c.id, x => ({ ...x, lines: x.lines.map(y => y.id === l.id ? fn(y as T) : y) }), key);
              return isAction(l)
                ? <ActionCard key={l.id} {...common} plan={plan} step={l} onChange={change}
                    picking={pickingFor === l.id} onPick={() => pickingFor === l.id ? onPickTile(null) : onPickTile(([x, y]) => change<ActionStep>(st => ({ ...st, action: { kind: 'move', x, y } })))} />
                : <LineCard key={l.id} {...common} plan={plan} phaseIndex={phaseIndex} line={l} onChange={change} />;
            })}
          </ol>
          <div className="conversation-add">
            <button type="button" className="text-button" onClick={() => {
              // Follow-up lines default to whoever spoke last in this conversation.
              const line = createLine(lastSpeaker(c) ?? defaultSpeaker);
              patchConversation(c.id, x => ({ ...x, lines: [...x.lines, line] }));
              onActivate(line.id);
            }}><Plus size={12} /> Add line</button>
            <button type="button" className="text-button" onClick={() => {
              // Actions default to the last speaker's unit, so "says something, then turns" is quick.
              const units = phase.entities.filter(e => isUnit(e.kind));
              const actor = units.find(u => u.name === lastSpeaker(c)) ?? units.find(u => u.name === defaultSpeaker) ?? units[0];
              if (!actor) return;
              const step = createAction(actor.id);
              patchConversation(c.id, x => ({ ...x, lines: [...x.lines, step] }));
              onActivate(step.id);
            }}><Plus size={12} /> Add action</button>
          </div>
          </div>
          {renderMap && <div className="conv-side">{renderMap(c)}</div>}
        </section>
        </Fragment>
      ))(item.conversation))}
      {zone(items.length)}
      <div className="timeline-add">
        <button type="button" className="button story-add" onClick={addConversation}><Plus size={14} /> New conversation</button>
        <div className="menu-wrap">
          <button type="button" className={`button story-add${placingMechanic ? ' placing' : ''}`} aria-haspopup="menu" aria-expanded={mechanicMenu} onClick={() => setMechanicMenu(o => !o)}>
            <Plus size={14} /> {placingPage ? `Click the map to place ${placingPage.title || 'it'}` : 'New mechanic'}
          </button>
          {mechanicMenu && (
            <div className="menu mechanic-menu" role="menu">
              {plan.pages.length === 0 && <p className="hint menu-hint">No mechanic pages yet. Create one to describe the mechanic, then place it from here.</p>}
              {plan.pages.map(g => {
                const kind = pageKind(plan, g);
                return (
                  <button key={g.id} type="button" role="menuitem" onClick={() => { setMechanicMenu(false); onNewMechanic(g.id); }}>
                    <Glyph kind={kind} size={14} color={mechanicTone({ kind })} />
                    <span><b>{g.title || 'Untitled page'}</b><small>{mechanicTypes[kind].name}{g.description ? ` · ${g.description.split('\n')[0].slice(0, 60)}` : ''}</small></span>
                    <MapPreviews diagrams={g.diagrams} width={56} max={1} />
                  </button>
                );
              })}
              <hr />
              <button type="button" role="menuitem" onClick={() => { setMechanicMenu(false); onOpenPage(onCreatePage('New mechanic')); }}>
                <BookOpen size={14} /> <span><b>New mechanic page</b><small>Describe a mechanic, then place it on the timeline</small></span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** The speaker of the conversation's most recent spoken line. */
const lastSpeaker = (c: Conversation) => [...c.lines].reverse().find((l): l is DialogueLine => !isAction(l))?.speaker;

/** Units in the phase grouped like the toolbox, for pickers. */
function UnitOptions({ phase, exclude }: { phase: Phase; exclude?: string }) {
  return <>
    {(Object.keys(unitCategories) as UnitCategory[]).map(cat => {
      const units = phase.entities.filter(e => isUnit(e.kind) && e.id !== exclude && unitTypes[e.kind as UnitKind].category === cat);
      return units.length > 0 && <optgroup key={cat} label={unitCategories[cat].name}>{units.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup>;
    })}
  </>;
}

const actionIcons = { motion: Hand, face: RotateCw, move: Footprints };

type ActionProps = {
  plan: Plan; phase: Phase; step: ActionStep; index: number; count: number; active: boolean; picking: boolean;
  onActivate: () => void;
  onChange: (fn: (s: ActionStep) => ActionStep, coalesceKey?: string) => void;
  onPick: () => void;
  onMove: (by: number) => void;
  onDelete: () => void;
  liRef: (el: HTMLElement | null) => void;
  dragClass: string;
  handleProps: React.HTMLAttributes<HTMLElement>;
};

function ActionCard({ plan, phase, step, index, count, active, picking, onActivate, onChange, onPick, onMove, onDelete, liRef, dragClass, handleProps }: ActionProps) {
  const a = step.action;
  const actor = phase.entities.find(e => e.id === step.actor);
  const setAction = (action: StageAction, key?: string) => onChange(s => ({ ...s, action }), key && `${key}-${step.id}`);
  const setKind = (kind: StageAction['kind']) => setAction(
    kind === 'motion' ? { kind, motion: '' } : kind === 'face' ? { kind, rotation: actor?.rotation ?? 0 } : { kind, x: actor?.x ?? 0, y: actor?.y ?? 0 });
  const Icon = actionIcons[a.kind];
  return (
    <li ref={liRef} className={`story-line action${active ? ' active' : ''}${dragClass}`} onFocusCapture={onActivate} onPointerDown={onActivate} style={{ '--speaker': actor ? unitTypes[actor.kind as UnitKind]?.color ?? '#c6b3ff' : '#c6b3ff' } as React.CSSProperties}>
      <span className="line-grip" title="Drag to move this step, into another conversation, or out into a new one" aria-hidden="true" {...handleProps}><GripVertical size={12} /></span>
      <div className="story-line-top">
        <span className="line-number action-number" title="Action"><Icon size={11} /></span>
        <select aria-label="Who acts" className="story-speaker" value={step.actor} onChange={e => onChange(s => ({ ...s, actor: e.target.value }))}>
          {!actor && <option value={step.actor}>Removed unit</option>}
          <UnitOptions phase={phase} />
        </select>
      </div>
      <div className="placement" role="group" aria-label="Action">
        <span>Does</span>
        {(Object.keys(actionKinds) as StageAction['kind'][]).map(k => {
          const KIcon = actionIcons[k];
          return <button key={k} type="button" aria-pressed={a.kind === k} onClick={() => a.kind !== k && setKind(k)}><KIcon size={12} /> {actionKinds[k]}</button>;
        })}
      </div>
      {a.kind === 'motion' && <>
        <input aria-label="Motion" className="story-custom" value={a.motion} maxLength={120} placeholder="What do they do? e.g. raises sword" onChange={e => setAction({ ...a, motion: e.target.value }, 'motion')} />
        <div className="motion-presets">
          {motionPresets.map(m => <button key={m} type="button" aria-pressed={a.motion === m} onClick={() => setAction({ ...a, motion: m })}>{m}</button>)}
        </div>
      </>}
      {a.kind === 'face' && (
        <select aria-label="Turn to" value={a.toward ? `unit:${a.toward}` : `dir:${a.rotation}`}
          onChange={e => { const [t, v] = e.target.value.split(':'); setAction(t === 'unit' ? { ...a, toward: v } : { kind: 'face', rotation: Number(v) }); }}>
          <optgroup label="Face a direction">{[0, 45, 90, 135, 180, 225, 270, 315].map(d => <option key={d} value={`dir:${d}`}>Face {compassName(d)}</option>)}</optgroup>
          {(Object.keys(unitCategories) as UnitCategory[]).map(cat => {
            const units = phase.entities.filter(e => isUnit(e.kind) && e.id !== step.actor && unitTypes[e.kind as UnitKind].category === cat);
            return units.length > 0 && <optgroup key={cat} label={`Turn toward (${unitCategories[cat].name.toLowerCase()})`}>{units.map(e => <option key={e.id} value={`unit:${e.id}`}>{e.name}</option>)}</optgroup>;
          })}
        </select>
      )}
      {a.kind === 'move' && (
        <div className="move-fields">
          <span>To</span>
          <select aria-label="Column" value={a.x} onChange={e => setAction({ ...a, x: Number(e.target.value) })}>
            {Array.from({ length: plan.cols }, (_, x) => <option key={x} value={x}>{tileLabel(x, 0).replace(/\d+$/, '')}</option>)}
          </select>
          <select aria-label="Row" value={a.y} onChange={e => setAction({ ...a, y: Number(e.target.value) })}>
            {Array.from({ length: plan.rows }, (_, y) => <option key={y} value={y}>{y + 1}</option>)}
          </select>
          <button type="button" className={`pick-button${picking ? ' active' : ''}`} aria-pressed={picking} title="Pick the destination on the map" onClick={onPick}><Crosshair size={12} /> {picking ? 'Click map…' : 'Pick'}</button>
        </div>
      )}
      <div className="story-line-bottom">
        <div className="story-tools">
          <button type="button" className="icon-button" aria-label="Move step up" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={13} /></button>
          <button type="button" className="icon-button" aria-label="Move step down" disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown size={13} /></button>
          <button type="button" className="icon-button danger" aria-label="Delete action" onClick={onDelete}><Trash2 size={13} /></button>
        </div>
      </div>
    </li>
  );
}

type LineProps = {
  plan: Plan; phase: Phase; phaseIndex: number; line: DialogueLine; index: number; count: number; active: boolean;
  onActivate: () => void;
  onChange: (fn: (l: DialogueLine) => DialogueLine, coalesceKey?: string) => void;
  onMove: (by: number) => void;
  onDelete: () => void;
  liRef: (el: HTMLElement | null) => void;
  dragClass: string;
  handleProps: React.HTMLAttributes<HTMLElement>;
};

function LineCard({ plan, phase, phaseIndex, line: l, index, count, active, onActivate, onChange, onMove, onDelete, liRef, dragClass, handleProps }: LineProps) {
  const patch = (p: Partial<DialogueLine>, key?: string) => onChange(x => ({ ...x, ...p }), key && `${key}-${l.id}`);
  const patchOption = (id: string, p: Partial<DialogueOption>, key?: string) => onChange(x => ({ ...x, options: x.options.map(o => o.id === id ? { ...o, ...p } : o) }), key && `${key}-${id}`);
  // Every unit on this phase's map can speak, grouped like the toolbox.
  const groups = (Object.keys(unitCategories) as UnitCategory[]).map(cat => ({
    cat, names: [...new Set(phase.entities.filter(e => isUnit(e.kind) && unitTypes[e.kind as UnitKind].category === cat).map(e => e.name))],
  })).filter(g => g.names.length);
  const known = new Set(['Narrator', ...groups.flatMap(g => g.names)]);
  const [customPicked, setCustomPicked] = useState(false);
  const custom = customPicked || !known.has(l.speaker);

  return (
    <li ref={liRef} className={`story-line${active ? ' active' : ''}${dragClass}`} onFocusCapture={onActivate} onPointerDown={onActivate} style={{ '--speaker': speakerColor(phase, l.speaker) } as React.CSSProperties}>
      <span className="line-grip" title="Drag to move this line, into another conversation, or out into a new one" aria-hidden="true" {...handleProps}><GripVertical size={12} /></span>
      <div className="story-line-top">
        <span className="line-number">{index + 1}</span>
        <select aria-label="Speaker" className="story-speaker" value={custom ? '__custom' : l.speaker}
          onChange={e => { const v = e.target.value; setCustomPicked(v === '__custom'); if (v !== '__custom') patch({ speaker: v }); }}>
          {groups.map(g => (
            <optgroup key={g.cat} label={unitCategories[g.cat].name}>
              {g.names.map(n => <option key={n} value={n}>{n}</option>)}
            </optgroup>
          ))}
          <optgroup label="Other">
            <option value="Narrator">Narrator</option>
            <option value="__custom">Custom name…</option>
          </optgroup>
        </select>
      </div>
      {custom && (
        <input aria-label="Custom speaker name" className="story-custom" value={l.speaker} maxLength={60} placeholder="Speaker name (not on the map)"
          onChange={e => patch({ speaker: e.target.value }, 'speaker')} />
      )}
      <div className="placement" role="group" aria-label="Show on map">
        <span>Show</span>
        <button type="button" aria-pressed={(l.placement ?? 'unit') === 'unit'} onClick={() => patch({ placement: 'unit' })}><MessageSquare size={12} /> Speak</button>
        <button type="button" aria-pressed={l.placement === 'top'} onClick={() => patch({ placement: 'top' })}><PanelTop size={12} /> Banner</button>
      </div>
      <textarea aria-label="Line" rows={2} value={l.text} maxLength={2000} placeholder="What do they say?" onChange={e => patch({ text: e.target.value }, 'text')} />
      {l.options.map((o, oi) => (
        <div key={o.id} className="story-option">
          <div className="story-option-top">
            <span className="option-key">{String.fromCharCode(65 + oi)}</span>
            <input aria-label="Choice" value={o.text} maxLength={200} placeholder="Choice the raid can pick" onChange={e => patchOption(o.id, { text: e.target.value }, 'opt')} />
            <button type="button" className="icon-button danger" aria-label="Remove choice" onClick={() => patch({ options: l.options.filter(x => x.id !== o.id) })}><X size={13} /></button>
          </div>
          <input aria-label="Outcome" value={o.outcome} maxLength={1000} placeholder="What happens" onChange={e => patchOption(o.id, { outcome: e.target.value }, 'out')} />
          <select aria-label="Then" value={o.goto && plan.phases.some(p => p.id === o.goto) ? o.goto : ''} onChange={e => patchOption(o.id, { goto: e.target.value || undefined })}>
            <option value="">Then continue this phase</option>
            {plan.phases.map((p, pi) => pi !== phaseIndex && <option key={p.id} value={p.id}>Then go to phase {pi + 1}: {p.name}</option>)}
          </select>
        </div>
      ))}
      <div className="story-line-bottom">
        {l.options.length < 6 && (
          <button type="button" className="text-button" onClick={() => patch({ options: [...l.options, createOption()] })}><Plus size={12} /> {l.options.length ? 'Add choice' : 'Add choices'}</button>
        )}
        <div className="story-tools">
          <button type="button" className="icon-button" aria-label="Move line up" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={13} /></button>
          <button type="button" className="icon-button" aria-label="Move line down" disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown size={13} /></button>
          <button type="button" className="icon-button danger" aria-label="Delete line" onClick={onDelete}><Trash2 size={13} /></button>
        </div>
      </div>
    </li>
  );
}

const clampInt = (v: string, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(v)) || 0));

function TriggerFields({ phase, trigger: t, onChange, exclude }: { phase: Phase; trigger?: DialogueTrigger; onChange: (t: DialogueTrigger | undefined, coalesceKey?: string) => void; exclude?: string }) {
  const enemies = phase.entities.filter(e => isUnit(e.kind) && unitTypes[e.kind as UnitKind].category === 'enemies');
  const mechanics = phase.entities.filter(e => isMechanic(e.kind) && e.id !== exclude);
  const setType = (type: DialogueTrigger['type']) => onChange(
    type === 'hp' ? { type, percent: 50, target: hpTarget({}, phase)?.id }
      : type === 'time' ? { type, seconds: 0 }
      : { type, mechanic: mechanics[0]?.id ?? '', seconds: 0 });
  return (
    <div className="trigger">
      <span>When</span>
      <select aria-label="Trigger" className="grow" value={t?.type ?? ''} onChange={e => e.target.value ? setType(e.target.value as DialogueTrigger['type']) : onChange(undefined)}>
        {exclude && <option value="">Not set</option>}
        {(Object.keys(triggerTypes) as DialogueTrigger['type'][]).map(k => <option key={k} value={k}>{triggerTypes[k]}</option>)}
      </select>
      <div className="trigger-params">
      {t?.type === 'hp' && <>
        <select aria-label="Enemy" className="grow" value={hpTarget(t, phase)?.id ?? ''} onChange={e => onChange({ ...t, target: e.target.value || undefined })}>
          {enemies.length === 0 && <option value="">No enemies on the map</option>}
          {enemies.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <label className="unit-input"><input aria-label="HP percent" type="number" min={0} max={100} value={t.percent} onChange={e => onChange({ ...t, percent: clampInt(e.target.value, 0, 100) }, 'hp')} />%</label>
      </>}
      {t?.type === 'time' && <>
        <label className="unit-input"><input aria-label="Minutes" type="number" min={0} max={99} value={Math.floor(t.seconds / 60)} onChange={e => onChange({ ...t, seconds: clampInt(e.target.value, 0, 99) * 60 + (t.seconds % 60) }, 'min')} />m</label>
        <label className="unit-input"><input aria-label="Seconds" type="number" min={0} max={59} value={t.seconds % 60} onChange={e => onChange({ ...t, seconds: Math.floor(t.seconds / 60) * 60 + clampInt(e.target.value, 0, 59) }, 'sec')} />s</label>
      </>}
      {t?.type === 'mechanic' && <>
        <label className="unit-input"><input aria-label="Seconds after" type="number" min={0} max={5999} value={t.seconds} onChange={e => onChange({ ...t, seconds: clampInt(e.target.value, 0, 5999) }, 'after')} />s after</label>
        <select aria-label="Mechanic" className="grow" value={mechanics.some(m => m.id === t.mechanic) ? t.mechanic : ''} onChange={e => onChange({ ...t, mechanic: e.target.value })}>
          {!mechanics.some(m => m.id === t.mechanic) && <option value="">{mechanics.length ? 'Pick a mechanic' : 'No mechanics in this phase'}</option>}
          {mechanics.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </>}
      </div>
    </div>
  );
}

/** A telegraph in the timeline: when it goes off, and the mechanic page that explains it. */
function MechanicItem({ m, phase, pages, cardRef, cardClass, handleProps, onChange, onSelect, onCreatePage, onOpenPage }: {
  m: Entity; phase: Phase; pages: MechanicPage[]; cardRef: (el: HTMLElement | null) => void; cardClass: string; handleProps: React.HTMLAttributes<HTMLElement>;
  onChange: (patch: Partial<Entity>, coalesceKey?: string) => void; onSelect: () => void; onCreatePage: (title: string) => string; onOpenPage: (id: string) => void;
}) {
  const page = pages.find(g => g.id === m.page);
  const tone = mechanicTone(m);
  return (
    <section ref={cardRef} className={`conversation mechanic-item${cardClass}`} style={{ '--tone': tone } as React.CSSProperties} aria-label={`Mechanic: ${m.name}`}>
      <header className="conversation-head">
        <button type="button" className="drag-handle" aria-label={`Reorder ${m.name}`} title="Drag to reorder (or focus and use the arrow keys)" {...handleProps}><GripVertical size={15} /></button>
        <span className="mechanic-item-icon"><Glyph kind={m.kind} size={14} color="#141819" strokeWidth={2.2} /></span>
        <input aria-label="Mechanic name" className="conversation-title" value={m.name} maxLength={120} onChange={e => onChange({ name: e.target.value }, `name-${m.id}`)} />
        <button type="button" className="icon-button" aria-label={`Show ${m.name} on the map`} title="Select on the map" onClick={onSelect}><MapPin size={14} /></button>
      </header>
      <div className="mechanic-item-kind">{mechanicTypes[m.kind as MechanicKind].name} · {mechanicTypes[m.kind as MechanicKind].description}</div>
      <TriggerFields phase={phase} trigger={m.trigger} exclude={m.id} onChange={(t, key) => onChange({ trigger: t }, key && `${key}-${m.id}`)} />
      <div className="page-link">
        <BookOpen size={13} />
        <select aria-label="Mechanic page" value={page ? page.id : ''} onChange={e => {
          const v = e.target.value;
          onChange({ page: v === '__new' ? onCreatePage(m.name) : v || undefined });
        }}>
          <option value="">No mechanic page</option>
          {pages.map(g => <option key={g.id} value={g.id}>{g.title || 'Untitled page'}</option>)}
          <option value="__new">+ New page “{m.name}”</option>
        </select>
        {page && <button type="button" className="text-button" onClick={() => onOpenPage(page.id)}>Open</button>}
      </div>
      {page?.description && <p className="page-excerpt">{page.description.length > 160 ? `${page.description.slice(0, 160)}…` : page.description}</p>}
      {page && <MapPreviews diagrams={page.diagrams} width={120} captions />}
    </section>
  );
}

/**
 * The map as it stands once a conversation has played (every action up to and including its own), with a way to copy
 * it into a mechanic page's Maps for reuse.
 */
function ConversationMap({ plan, phaseIndex, conversation, caption, onSave }: { plan: Plan; phaseIndex: number; conversation: Conversation; caption: string; onSave: (pageId: string | null, d: Diagram) => void }) {
  const [menu, setMenu] = useState(false);
  const phase = plan.phases[phaseIndex];
  const script = scriptOf(phase);
  let last = -1;
  script.forEach((s, i) => { if (s.conversation.id === conversation.id) last = i; });
  const scene = stagePhase(phase, plan, script.slice(0, last + 1).map(s => s.step).filter(isAction));
  const scenePlan = { ...plan, phases: plan.phases.map((f, i) => i === phaseIndex ? scene : f) };
  const cell = Math.max(5, Math.min(12, Math.floor(250 / plan.cols)));
  const save = (pageId: string | null) => { setMenu(false); onSave(pageId, sceneToDiagram(scene, plan, caption)); };
  return (
    <div className="conv-map">
      <div className="conv-map-head">
        <span>Map after this conversation</span>
        <div className="menu-wrap">
          <button type="button" className="text-button" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(o => !o)}><BookOpen size={12} /> Save to page</button>
          {menu && (
            <div className="menu conv-map-menu" role="menu">
              {plan.pages.map(g => (
                <button key={g.id} type="button" role="menuitem" onClick={() => save(g.id)}>
                  <Glyph kind={pageKind(plan, g)} size={14} color={mechanicTone({ kind: pageKind(plan, g) })} /> <span><b>{g.title || 'Untitled page'}</b><small>{(g.diagrams ?? []).length} map{(g.diagrams ?? []).length === 1 ? '' : 's'}</small></span>
                </button>
              ))}
              {plan.pages.length > 0 && <hr />}
              <button type="button" role="menuitem" onClick={() => save(null)}><Plus size={14} /> <span><b>New mechanic page</b><small>Start a page with this map</small></span></button>
            </div>
          )}
        </div>
      </div>
      <div className="conv-map-image"><BattleMap plan={scenePlan} phaseIndex={phaseIndex} cell={cell} coords={false} showMoves={false} /></div>
    </div>
  );
}

/** "Save to page": copy a map into a mechanic page's Maps, or start a new page with it. */
export function SaveToPageMenu({ plan, onSave }: { plan: Plan; onSave: (pageId: string | null) => void }) {
  const [menu, setMenu] = useState(false);
  const save = (pageId: string | null) => { setMenu(false); onSave(pageId); };
  return (
    <div className="menu-wrap save-map">
      <button type="button" className="text-button" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(o => !o)}><BookOpen size={12} /> Save to page</button>
      {menu && (
        <div className="menu conv-map-menu" role="menu">
          {plan.pages.map(g => (
            <button key={g.id} type="button" role="menuitem" onClick={() => save(g.id)}>
              <Glyph kind={pageKind(plan, g)} size={14} color={mechanicTone({ kind: pageKind(plan, g) })} /> <span><b>{g.title || 'Untitled page'}</b><small>{(g.diagrams ?? []).length} map{(g.diagrams ?? []).length === 1 ? '' : 's'}</small></span>
            </button>
          ))}
          {plan.pages.length > 0 && <hr />}
          <button type="button" role="menuitem" onClick={() => save(null)}><Plus size={14} /> <span><b>New mechanic page</b><small>Start a page with this map</small></span></button>
        </div>
      )}
    </div>
  );
}
