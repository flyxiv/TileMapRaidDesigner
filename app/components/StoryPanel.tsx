'use client';
import { ArrowDown, ArrowUp, GripVertical, MessageSquare, PanelTop, Plus, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { createConversation, createLine, createOption, hpTarget, isMechanic, isUnit, triggerTypes, unitCategories, unitTypes, type Conversation, type DialogueLine, type DialogueOption, type DialogueTrigger, type Phase, type Plan, type UnitCategory, type UnitKind } from '../plan';

type Props = {
  plan: Plan;
  phaseIndex: number;
  /** Speaker for new lines: the selected unit, else the first boss. */
  defaultSpeaker: string;
  /** The line shown as a bubble on the map. */
  activeLineId: string | null;
  onActivate: (id: string) => void;
  onChange: (fn: (conversations: Conversation[]) => Conversation[], coalesceKey?: string) => void;
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

export function StoryPanel({ plan, phaseIndex, defaultSpeaker, activeLineId, onActivate, onChange }: Props) {
  const phase = plan.phases[phaseIndex];
  const conversations = phase.conversations;

  const patchConversation = (id: string, fn: (c: Conversation) => Conversation, key?: string) => onChange(cs => cs.map(c => c.id === id ? fn(c) : c), key);
  const reorder = useReorder(conversations.length, (from, to) => onChange(cs => moveTo(cs, from, to)));
  const addConversation = () => {
    // A new conversation starts from the previous one's trigger so follow-ups are quick to set up.
    const last = conversations[conversations.length - 1];
    const conversation = createConversation(last ? { ...last.trigger } : { type: 'time', seconds: 0 }, defaultSpeaker);
    onChange(cs => [...cs, conversation]);
    onActivate(conversation.lines[0].id);
  };

  return (
    <div className={`story${reorder.dragging ? ' reordering' : ''}`}>
      <p className="hint">Group lines spoken together into a conversation. A conversation starts when its trigger fires (boss HP, encounter time, or time after a mechanic) and its lines play in order. The line you are editing appears on the map.</p>
      {conversations.map((c, ci) => (
        <section key={c.id} ref={reorder.cardRef(ci)} className={`conversation${reorder.cardClass(ci)}`} aria-label={c.title || `Conversation ${ci + 1}`}>
          <header className="conversation-head">
            <button type="button" className="drag-handle" aria-label={`Reorder ${c.title || `conversation ${ci + 1}`}`} title="Drag to reorder (or focus and use the arrow keys)" {...reorder.handleProps(ci)}>
              <GripVertical size={15} />
            </button>
            <input aria-label="Conversation title" className="conversation-title" value={c.title} maxLength={120} placeholder={`Conversation ${ci + 1}`}
              onChange={e => patchConversation(c.id, x => ({ ...x, title: e.target.value }), `title-${c.id}`)} />
            <div className="story-tools">
              <button type="button" className="icon-button danger" aria-label="Delete conversation"
                onClick={() => { if (c.lines.every(l => !l.text) || confirm(`Delete "${c.title || `Conversation ${ci + 1}`}" and its ${c.lines.length} line${c.lines.length > 1 ? 's' : ''}?`)) onChange(cs => cs.filter(x => x.id !== c.id)); }}>
                <Trash2 size={13} />
              </button>
            </div>
          </header>
          <TriggerFields phase={phase} trigger={c.trigger} onChange={(t, key) => patchConversation(c.id, x => ({ ...x, trigger: t }), key && `${key}-${c.id}`)} />
          <ol className="conversation-lines">
            {c.lines.map((l, li) => (
              <LineCard key={l.id} phase={phase} plan={plan} phaseIndex={phaseIndex} line={l} index={li} count={c.lines.length} active={l.id === activeLineId}
                onActivate={() => onActivate(l.id)}
                onChange={(fn, key) => patchConversation(c.id, x => ({ ...x, lines: x.lines.map(y => y.id === l.id ? fn(y) : y) }), key)}
                onMove={by => patchConversation(c.id, x => ({ ...x, lines: swap(x.lines, li, li + by) }))}
                onDelete={() => patchConversation(c.id, x => ({ ...x, lines: x.lines.filter(y => y.id !== l.id) }))} />
            ))}
          </ol>
          <button type="button" className="text-button" onClick={() => {
            // Follow-up lines default to whoever spoke last in this conversation.
            const line = createLine(c.lines[c.lines.length - 1]?.speaker ?? defaultSpeaker);
            patchConversation(c.id, x => ({ ...x, lines: [...x.lines, line] }));
            onActivate(line.id);
          }}><Plus size={12} /> Add line</button>
        </section>
      ))}
      <button type="button" className="button story-add" onClick={addConversation}><Plus size={14} /> New conversation</button>
    </div>
  );
}

type LineProps = {
  plan: Plan; phase: Phase; phaseIndex: number; line: DialogueLine; index: number; count: number; active: boolean;
  onActivate: () => void;
  onChange: (fn: (l: DialogueLine) => DialogueLine, coalesceKey?: string) => void;
  onMove: (by: number) => void;
  onDelete: () => void;
};

function LineCard({ plan, phase, phaseIndex, line: l, index, count, active, onActivate, onChange, onMove, onDelete }: LineProps) {
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
    <li className={`story-line${active ? ' active' : ''}`} onFocusCapture={onActivate} onPointerDown={onActivate} style={{ '--speaker': speakerColor(phase, l.speaker) } as React.CSSProperties}>
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
        <button type="button" aria-pressed={(l.placement ?? 'unit') === 'unit'} onClick={() => patch({ placement: 'unit' })}><MessageSquare size={12} /> On speaker</button>
        <button type="button" aria-pressed={l.placement === 'top'} onClick={() => patch({ placement: 'top' })}><PanelTop size={12} /> Top banner</button>
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

function TriggerFields({ phase, trigger: t, onChange }: { phase: Phase; trigger: DialogueTrigger; onChange: (t: DialogueTrigger, coalesceKey?: string) => void }) {
  const enemies = phase.entities.filter(e => isUnit(e.kind) && unitTypes[e.kind as UnitKind].category === 'enemies');
  const mechanics = phase.entities.filter(e => isMechanic(e.kind));
  const setType = (type: DialogueTrigger['type']) => onChange(
    type === 'hp' ? { type, percent: 50, target: hpTarget({}, phase)?.id }
      : type === 'time' ? { type, seconds: 0 }
      : { type, mechanic: mechanics[0]?.id ?? '', seconds: 0 });
  return (
    <div className="trigger">
      <span>When</span>
      <select aria-label="Trigger" className="grow" value={t.type} onChange={e => setType(e.target.value as DialogueTrigger['type'])}>
        {(Object.keys(triggerTypes) as DialogueTrigger['type'][]).map(k => <option key={k} value={k}>{triggerTypes[k]}</option>)}
      </select>
      <div className="trigger-params">
      {t.type === 'hp' && <>
        <select aria-label="Enemy" className="grow" value={hpTarget(t, phase)?.id ?? ''} onChange={e => onChange({ ...t, target: e.target.value || undefined })}>
          {enemies.length === 0 && <option value="">No enemies on the map</option>}
          {enemies.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <label className="unit-input"><input aria-label="HP percent" type="number" min={0} max={100} value={t.percent} onChange={e => onChange({ ...t, percent: clampInt(e.target.value, 0, 100) }, 'hp')} />%</label>
      </>}
      {t.type === 'time' && <>
        <label className="unit-input"><input aria-label="Minutes" type="number" min={0} max={99} value={Math.floor(t.seconds / 60)} onChange={e => onChange({ ...t, seconds: clampInt(e.target.value, 0, 99) * 60 + (t.seconds % 60) }, 'min')} />m</label>
        <label className="unit-input"><input aria-label="Seconds" type="number" min={0} max={59} value={t.seconds % 60} onChange={e => onChange({ ...t, seconds: Math.floor(t.seconds / 60) * 60 + clampInt(e.target.value, 0, 59) }, 'sec')} />s</label>
      </>}
      {t.type === 'mechanic' && <>
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
