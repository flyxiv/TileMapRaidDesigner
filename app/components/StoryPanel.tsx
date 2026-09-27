'use client';
import { ArrowDown, ArrowUp, MessageSquare, PanelTop, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { createLine, createOption, hpTarget, isMechanic, isUnit, triggerTypes, unitCategories, unitTypes, type DialogueLine, type DialogueOption, type DialogueTrigger, type Phase, type Plan, type UnitCategory, type UnitKind } from '../plan';

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
    // New lines reuse the previous line's trigger so a run of lines at the same moment is quick to write.
    const line = createLine(lines.length ? { ...lines[lines.length - 1].trigger } : { type: 'time', seconds: 0 }, defaultSpeaker);
    onChange(d => [...d, line]);
    onActivate(line.id);
  };

  return (
    <div className="story">
      <p className="hint">Dialogue spoken during this phase, in order. Each line is triggered by boss HP, encounter time, or time after a mechanic. The line you are editing appears on the map. Add choices to let the raid pick a response; a choice can send the fight to another phase.</p>
      {lines.map((l, i) => (
        <article key={l.id} className={`story-line${l.id === activeLineId ? ' active' : ''}`} onFocusCapture={() => onActivate(l.id)} onPointerDown={() => onActivate(l.id)} style={{ '--speaker': speakerColor(phase, l.speaker) } as React.CSSProperties}>
          <div className="story-line-top">
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
          <TriggerFields phase={phase} trigger={l.trigger} onChange={(t, key) => patchLine(l.id, { trigger: t }, key && `${key}-${l.id}`)} />
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
