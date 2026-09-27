'use client';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { createLine, createOption, isUnit, phaseTurnRanges, unitTypes, type DialogueLine, type DialogueOption, type Phase, type Plan, type UnitKind } from '../plan';

type Props = {
  plan: Plan;
  phaseIndex: number;
  /** Speaker for new lines: the selected unit, else the first boss. */
  defaultSpeaker: string;
  onChange: (fn: (dialogue: DialogueLine[]) => DialogueLine[], coalesceKey?: string) => void;
};

/** Role color for a speaker whose name matches a unit in the phase. */
export function speakerColor(phase: Phase, speaker: string) {
  const unit = phase.entities.find(e => isUnit(e.kind) && e.name === speaker);
  return unit ? unitTypes[unit.kind as UnitKind].color : '#c9d0cd';
}

export function StoryPanel({ plan, phaseIndex, defaultSpeaker, onChange }: Props) {
  const phase = plan.phases[phaseIndex];
  const start = phaseTurnRanges(plan)[phaseIndex].start;
  const speakers = [...new Set(phase.entities.filter(e => isUnit(e.kind)).map(e => e.name)), 'Narrator'];
  const lines = phase.dialogue;

  const patchLine = (id: string, patch: Partial<DialogueLine>, key?: string) => onChange(d => d.map(l => l.id === id ? { ...l, ...patch } : l), key);
  const patchOption = (lineId: string, optId: string, patch: Partial<DialogueOption>, key?: string) =>
    onChange(d => d.map(l => l.id === lineId ? { ...l, options: l.options.map(o => o.id === optId ? { ...o, ...patch } : o) } : l), key);
  const move = (i: number, by: number) => onChange(d => { const next = d.slice(); [next[i], next[i + by]] = [next[i + by], next[i]]; return next; });
  const add = () => {
    const turn = lines.length ? Math.min(phase.turns, lines[lines.length - 1].turn) : 1;
    onChange(d => [...d, createLine(turn, defaultSpeaker)]);
  };

  return (
    <div className="story">
      <datalist id="story-speakers">{speakers.map(s => <option key={s} value={s} />)}</datalist>
      <p className="hint">Dialogue spoken during this phase, in order. Add choices to let the raid pick a response; a choice can send the fight to another phase.</p>
      {lines.map((l, i) => (
        <article key={l.id} className="story-line" style={{ '--speaker': speakerColor(phase, l.speaker) } as React.CSSProperties}>
          <div className="story-line-top">
            <select aria-label="Turn" value={Math.min(l.turn, phase.turns)} onChange={e => patchLine(l.id, { turn: Number(e.target.value) })}>
              {Array.from({ length: phase.turns }, (_, t) => <option key={t} value={t + 1}>T{start + t}</option>)}
            </select>
            <input aria-label="Speaker" className="story-speaker" list="story-speakers" value={l.speaker} maxLength={60} placeholder="Speaker"
              onChange={e => patchLine(l.id, { speaker: e.target.value }, `speaker-${l.id}`)} />
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
