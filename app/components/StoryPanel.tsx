'use client';
import { ArrowDown, ArrowUp, MessageSquare, PanelTop, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { createLine, createOption, isUnit, phaseTurnRanges, unitCategories, unitTypes, type DialogueLine, type DialogueOption, type Phase, type Plan, type UnitCategory, type UnitKind } from '../plan';

type Props = {
  plan: Plan;
  phaseIndex: number;
  /** Speaker for new lines: the selected unit, else the first boss. */
  defaultSpeaker: string;
  /** The line shown as a bubble on the map. */
  activeLineId: string | null;
  onActivate: (id: string) => void;
  onChange: (fn: (dialogue: DialogueLine[]) => DialogueLine[], coalesceKey?: string) => void;
};

/** Role color for a speaker whose name matches a unit in the phase. */
export function speakerColor(phase: Phase, speaker: string) {
  const unit = phase.entities.find(e => isUnit(e.kind) && e.name === speaker);
  return unit ? unitTypes[unit.kind as UnitKind].color : '#c9d0cd';
}

export function StoryPanel({ plan, phaseIndex, defaultSpeaker, activeLineId, onActivate, onChange }: Props) {
  const phase = plan.phases[phaseIndex];
  const start = phaseTurnRanges(plan)[phaseIndex].start;
  const lines = phase.dialogue;
  // Every unit on this phase's map can speak, grouped like the toolbox.
  const groups = (Object.keys(unitCategories) as UnitCategory[]).map(cat => ({
    cat, names: [...new Set(phase.entities.filter(e => isUnit(e.kind) && unitTypes[e.kind as UnitKind].category === cat).map(e => e.name))],
  })).filter(g => g.names.length);
  const known = new Set(['Narrator', ...groups.flatMap(g => g.names)]);
  const [customIds, setCustomIds] = useState<Set<string>>(new Set());

  const patchLine = (id: string, patch: Partial<DialogueLine>, key?: string) => onChange(d => d.map(l => l.id === id ? { ...l, ...patch } : l), key);
  const patchOption = (lineId: string, optId: string, patch: Partial<DialogueOption>, key?: string) =>
    onChange(d => d.map(l => l.id === lineId ? { ...l, options: l.options.map(o => o.id === optId ? { ...o, ...patch } : o) } : l), key);
  const move = (i: number, by: number) => onChange(d => { const next = d.slice(); [next[i], next[i + by]] = [next[i + by], next[i]]; return next; });
  const add = () => {
    const turn = lines.length ? Math.min(phase.turns, lines[lines.length - 1].turn) : 1;
    const line = createLine(turn, defaultSpeaker);
    onChange(d => [...d, line]);
    onActivate(line.id);
  };

  return (
    <div className="story">
      <p className="hint">Dialogue spoken during this phase, in order. Turns count from the start of the fight, so this phase covers turns {start}–{start + phase.turns - 1}. The line you are editing appears on the map over its speaker. Add choices to let the raid pick a response; a choice can send the fight to another phase.</p>
      {lines.map((l, i) => (
        <article key={l.id} className={`story-line${l.id === activeLineId ? ' active' : ''}`} onFocusCapture={() => onActivate(l.id)} onPointerDown={() => onActivate(l.id)} style={{ '--speaker': speakerColor(phase, l.speaker) } as React.CSSProperties}>
          <div className="story-line-top">
            <select aria-label="Spoken on turn" title="Turn of the fight when this line is spoken" value={Math.min(l.turn, phase.turns)} onChange={e => patchLine(l.id, { turn: Number(e.target.value) })}>
              {Array.from({ length: phase.turns }, (_, t) => <option key={t} value={t + 1}>Turn {start + t}</option>)}
            </select>
            {(() => {
              const custom = customIds.has(l.id) || !known.has(l.speaker);
              return (
                <select aria-label="Speaker" className="story-speaker" value={custom ? '__custom' : l.speaker}
                  onChange={e => {
                    const v = e.target.value;
                    setCustomIds(ids => { const next = new Set(ids); if (v === '__custom') next.add(l.id); else next.delete(l.id); return next; });
                    if (v !== '__custom') patchLine(l.id, { speaker: v });
                  }}>
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
              );
            })()}
          </div>
          {(customIds.has(l.id) || !known.has(l.speaker)) && (
            <input aria-label="Custom speaker name" className="story-custom" value={l.speaker} maxLength={60} placeholder="Speaker name (not on the map)"
              onChange={e => patchLine(l.id, { speaker: e.target.value }, `speaker-${l.id}`)} />
          )}
          <div className="placement" role="group" aria-label="Show on map">
            <span>Show</span>
            <button type="button" aria-pressed={(l.placement ?? 'unit') === 'unit'} onClick={() => patchLine(l.id, { placement: 'unit' })}><MessageSquare size={12} /> On speaker</button>
            <button type="button" aria-pressed={l.placement === 'top'} onClick={() => patchLine(l.id, { placement: 'top' })}><PanelTop size={12} /> Top banner</button>
          </div>
          <textarea aria-label="Line" rows={2} value={l.text} maxLength={2000} placeholder="What do they say?" onChange={e => patchLine(l.id, { text: e.target.value }, `text-${l.id}`)} />
          {l.options.map((o, oi) => (
            <div key={o.id} className="story-option">
              <div className="story-option-top">
                <span className="option-key">{String.fromCharCode(65 + oi)}</span>
                <input aria-label="Choice" value={o.text} maxLength={200} placeholder="Choice the raid can pick" onChange={e => patchOption(l.id, o.id, { text: e.target.value }, `opt-${o.id}`)} />
                <button type="button" className="icon-button danger" aria-label="Remove choice" onClick={() => patchLine(l.id, { options: l.options.filter(x => x.id !== o.id) })}><X size={13} /></button>
              </div>
              <input aria-label="Outcome" value={o.outcome} maxLength={1000} placeholder="What happens" onChange={e => patchOption(l.id, o.id, { outcome: e.target.value }, `out-${o.id}`)} />
              <select aria-label="Then" value={o.goto && plan.phases.some(p => p.id === o.goto) ? o.goto : ''} onChange={e => patchOption(l.id, o.id, { goto: e.target.value || undefined })}>
                <option value="">Then continue this phase</option>
                {plan.phases.map((p, pi) => pi !== phaseIndex && <option key={p.id} value={p.id}>Then go to phase {pi + 1}: {p.name}</option>)}
              </select>
            </div>
          ))}
          <div className="story-line-bottom">
            {l.options.length < 6 && (
              <button type="button" className="text-button" onClick={() => patchLine(l.id, { options: [...l.options, createOption()] })}><Plus size={12} /> {l.options.length ? 'Add choice' : 'Add choices'}</button>
            )}
            <div className="story-tools">
              <button type="button" className="icon-button" aria-label="Move line up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={13} /></button>
              <button type="button" className="icon-button" aria-label="Move line down" disabled={i === lines.length - 1} onClick={() => move(i, 1)}><ArrowDown size={13} /></button>
              <button type="button" className="icon-button danger" aria-label="Delete line" onClick={() => onChange(d => d.filter(x => x.id !== l.id))}><Trash2 size={13} /></button>
            </div>
          </div>
        </article>
      ))}
      <button type="button" className="button story-add" onClick={add}><Plus size={14} /> Add line</button>
    </div>
  );
}
