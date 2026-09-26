'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isMechanic, mechanicTone, phaseTurnRanges, turnRangeText, type Plan } from '../plan';
import { BattleMap } from './BattleMap';

function steps(notes: string) {
  const lines = notes.split(/\n+/).map(l => l.trim()).filter(Boolean);
  return lines.length > 1 ? lines : (lines[0] ?? '').split(/(?<=[.!?])\s+/).filter(Boolean);
}

export function PresentView({ plan, index, onIndex, onExit }: { plan: Plan; index: number; onIndex: (i: number) => void; onExit: () => void }) {
  const phase = plan.phases[index];
  const ranges = phaseTurnRanges(plan);
  const stage = useRef<HTMLElement>(null);
  const [cell, setCell] = useState(36);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => setCell(Math.max(14, Math.floor(Math.min((el.clientWidth - 64) / (plan.cols + 0.7), (el.clientHeight - 64) / (plan.rows + 0.7)))));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [plan.cols, plan.rows]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
      else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); onIndex(Math.min(plan.phases.length - 1, index + 1)); }
      else if (e.key === 'ArrowLeft') onIndex(Math.max(0, index - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, onExit, onIndex, plan.phases.length]);

  const mechanics = phase.entities.filter(e => isMechanic(e.kind));
  return (
    <div className="present">
      <header className="present-top">
        <button type="button" className="link-button" onClick={onExit}><ChevronLeft size={15} /> Back to editor</button>
        <div className="present-title">{plan.name}</div>
        <div className="present-live"><i /> Presenting · Esc to exit</div>
      </header>
      <div className="present-body">
        <section className="present-story">
          <div className="present-kicker">PHASE {index + 1} OF {plan.phases.length}<span />{turnRangeText(ranges[index]).toUpperCase()}</div>
          <h1>{phase.name}</h1>
          <ol className="present-steps">
            {steps(phase.notes).map((s, i) => <li key={i}><span>{i + 1}</span>{s}</li>)}
          </ol>
          {mechanics.length > 0 && (
            <div className="present-watch">
              <div className="section-title">Watch for</div>
              {mechanics.map(m => (
                <div key={m.id} className="watch-row">
                  <span className="watch-badge" style={{ background: mechanicTone(m) }}>{m.kind !== 'marker' && m.turns > 0 ? m.turns : ''}</span>
                  <span><b>{m.name}</b><small>{m.kind === 'marker' ? 'Safe tiles for this phase' : m.turns === 0 ? 'Active for the whole phase' : m.turns === 1 ? 'Resolves next turn' : `Resolves in ${m.turns} turns`}</small></span>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="present-stage" ref={stage} aria-label="Battle map">
          <BattleMap plan={plan} phaseIndex={index} cell={cell} />
        </section>
      </div>
      <footer className="present-controls">
        <div className="present-nav">
          <button type="button" aria-label="Previous phase" disabled={index === 0} onClick={() => onIndex(index - 1)}><ChevronLeft size={18} /></button>
          <button type="button" aria-label="Next phase" className="primary" disabled={index === plan.phases.length - 1} onClick={() => onIndex(index + 1)}><ChevronRight size={18} /></button>
        </div>
        <div className="present-segments" style={{ gridTemplateColumns: plan.phases.map(p => `${p.turns}fr`).join(' ') }}>
          {plan.phases.map((p, i) => (
            <button key={p.id} type="button" aria-current={i === index ? 'step' : undefined} className={i === index ? 'current' : i < index ? 'done' : ''} onClick={() => onIndex(i)}>
              <span className="ticks">{Array.from({ length: p.turns }, (_, t) => <i key={t} />)}</span>
              <span className="seg-label"><b>{p.name}</b><span>{turnRangeText(ranges[i])}</span></span>
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
