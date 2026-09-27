'use client';
import { ArrowRight, ChevronLeft, ChevronRight, Footprints, Hand, RotateCw } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { withTelegraphs, castLabel, conversationScenes, sceneAtStep, diagramPlan, actionText, faceRotation, isAction, stagePhase, isMechanic, lineCount, mechanicTone, presentSteps, timelineOf, triggerLabel, type ConversationStep, mechanicTypes, type MechanicKind, type Plan } from '../plan';
import { BattleMap } from './BattleMap';
import { EventIcon } from './EventIcon';
import { Glyph } from './glyphs';
import { speakerColor } from './StoryPanel';

function steps(notes: string) {
  const lines = notes.split(/\n+/).map(l => l.trim()).filter(Boolean);
  return lines.length > 1 ? lines : (lines[0] ?? '').split(/(?<=[.!?])\s+/).filter(Boolean);
}

export function PresentView({ plan, index, onIndex, onExit }: { plan: Plan; index: number; onIndex: (i: number) => void; onExit: () => void }) {
  const phase = plan.phases[index];
  const stage = useRef<HTMLElement>(null);
  const [cell, setCell] = useState(36);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  // The dialogue line on screen; it starts at the first line whenever the phase changes some other way.
  const [cursor, setCursor] = useState({ phase: index, line: 0 });
  // The phase's timeline in order: every line and action, and each telegraph as it comes up.
  const script = presentSteps(phase);
  const line = cursor.phase === index ? Math.min(cursor.line, Math.max(0, script.length - 1)) : 0;

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
      // Arrow keys step through the phase's dialogue first, then move between phases.
      else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        if (line < script.length - 1) setCursor({ phase: index, line: line + 1 });
        else onIndex(Math.min(plan.phases.length - 1, index + 1));
      } else if (e.key === 'ArrowLeft') {
        if (line > 0) setCursor({ phase: index, line: line - 1 });
        else if (index > 0) { setCursor({ phase: index - 1, line: lineCount(plan.phases[index - 1]) - 1 }); onIndex(index - 1); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, line, script.length, onExit, onIndex, plan.phases]);

  const step = script[line]?.step;
  const current = step && !isAction(step) ? step : undefined;
  const currentConversation = script[line]?.conversation;
  // Actions play as you step: the map shows the scene after every earlier action, and previews the current one.
  // Each conversation plays on its own map (or where the previous one left off); a telegraph shows the scene as the
  // last conversation before it ended.
  const staged = (() => {
    const cur = script[line];
    if (cur?.conversation && cur.step) return sceneAtStep(phase, plan, cur.conversation.id, cur.step.id);
    const before = script.slice(0, line).reverse().find(s => s.conversation);
    return before?.conversation ? conversationScenes(phase, plan).get(before.conversation.id)?.end ?? phase : phase;
  })();
  const mechanicStep = script[line]?.mechanic;
  const shownScene = withTelegraphs(staged, script[line]?.mechanic ? [script[line].mechanic!.id] : []);
  const stagedPlan = { ...plan, phases: plan.phases.map((p, i) => i === index ? shownScene : p) };
  const acting = step && isAction(step) ? step : undefined;
  const actor = acting && staged.entities.find(e => e.id === acting.actor);
  const stageMark = acting && actor ? { step: acting, from: actor, text: actionText(acting, phase), rotation: faceRotation(acting, staged.entities) } : null;
  const speech = current && currentConversation ? {
    speaker: current.speaker, text: current.text, options: current.options.map(o => o.text), placement: current.placement,
    turnLabel: [currentConversation.title, triggerLabel(currentConversation.trigger, phase)].filter(Boolean).join(' · ').toUpperCase(),
    picked: current.options.findIndex(o => o.id === chosen[current.id]),
  } : null;

  return (
    <div className="present">
      <header className="present-top">
        <button type="button" className="link-button" onClick={onExit}><ChevronLeft size={15} /> Back to editor</button>
        <div className="present-title">{plan.name}</div>
        <div className="present-live"><i /> Presenting · → next line · Esc to exit</div>
      </header>
      <div className="present-body">
        <section className="present-story">
          <div className="present-kicker">PHASE {index + 1} OF {plan.phases.length}</div>
          <h1>{phase.name}</h1>
          <ol className="present-steps">
            {steps(phase.notes).map((s, i) => <li key={i}><span>{i + 1}</span>{s}</li>)}
          </ol>
          {script.length > 0 && (
            <div className="present-story-script">
              <div className="section-title">Events</div>
              {timelineOf(phase).map(item => {
                if (item.kind === 'mechanic') {
                  const m = item.mechanic, li = script.findIndex(s => s.mechanic?.id === m.id), page = plan.pages.find(g => g.id === m.page);
                  return (
                    <div key={m.id} className={`script-mechanic${li === line ? ' active' : ''}`} style={{ '--tone': mechanicTone(m) } as React.CSSProperties} onClick={() => setCursor({ phase: index, line: li })}>
                      <div className="script-conversation-head">
                        <span className="script-turn">{m.trigger ? triggerLabel(m.trigger, phase).toUpperCase() : 'MECHANIC'}</span>
                        <EventIcon kind="mechanic" size={12} /><b>{m.name}</b>{m.castTime !== undefined && <span className="script-cast">{castLabel(m)} cast</span>}
                      </div>
                      {li === line && page && page.blocks.length > 0 && (
                        <div className="script-mechanic-blocks">
                          {page.blocks.map(b => b.type === 'text'
                            ? (b.text.trim() && <p key={b.id} className="script-mechanic-page">{b.text}</p>)
                            : (
                              <figure key={b.id} className="script-mechanic-map">
                                <BattleMap plan={diagramPlan(b)} phaseIndex={0} cell={Math.max(6, Math.floor(260 / b.cols))} coords={false} showMoves={false} />
                                {b.caption && <figcaption>{b.caption}</figcaption>}
                              </figure>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                }
                const c = item.conversation;
                return (
                <div key={c.id} className="script-conversation">
                  <div className="script-conversation-head"><span className="script-turn">{triggerLabel(c.trigger, phase).toUpperCase()}</span><EventIcon kind="conversation" size={12} /><b>{c.title || `Conversation ${phase.conversations.indexOf(c) + 1}`}</b></div>
                  {c.lines.map(l => {
                    const li = script.findIndex(s => s.step?.id === l.id);
                    if (isAction(l)) return (
                      <div key={l.id} className={`script-action${li === line ? ' active' : ''}`} onClick={() => setCursor({ phase: index, line: li })}>
                        {(() => { const Icon = { motion: Hand, face: RotateCw, move: Footprints }[l.action.kind]; return <Icon size={14} aria-hidden="true" />; })()}<i>{actionText(l, phase)}</i>
                      </div>
                    );
                    const pick = l.options.find(o => o.id === chosen[l.id]);
                    const target = pick?.goto ? plan.phases.findIndex(p => p.id === pick.goto) : -1;
                    return (
                      <div key={l.id} className={`script-line${li === line ? ' active' : ''}`} onClick={() => setCursor({ phase: index, line: li })} style={{ '--speaker': speakerColor(phase, l.speaker) } as React.CSSProperties}>
                        <div className="script-meta"><b>{l.speaker || 'Narrator'}</b></div>
                        {l.text && <p>{l.text}</p>}
                        {l.options.length > 0 && (
                          <div className="script-options">
                            {l.options.map((o, oi) => (
                              <button key={o.id} type="button" aria-pressed={chosen[l.id] === o.id} className={chosen[l.id] === o.id ? 'picked' : ''}
                                onClick={() => setChosen(c => ({ ...c, [l.id]: o.id }))}>
                                <span>{String.fromCharCode(65 + oi)}</span>{o.text || 'Untitled choice'}
                              </button>
                            ))}
                          </div>
                        )}
                        {pick && (pick.outcome || target >= 0) && (
                          <div className="script-outcome">
                            {pick.outcome && <p>{pick.outcome}</p>}
                            {target >= 0 && <button type="button" className="text-button" onClick={() => onIndex(target)}>Go to phase {target + 1}: {plan.phases[target].name} <ArrowRight size={13} /></button>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                );
              })}
            </div>
          )}
        </section>
        <section className="present-stage" ref={stage} aria-label="Battle map">
          <BattleMap plan={stagedPlan} phaseIndex={index} cell={cell} speech={speech} stage={stageMark} selectedId={mechanicStep?.id ?? null} />
        </section>
      </div>
      <footer className="present-controls">
        <div className="present-nav">
          <button type="button" aria-label="Previous phase" disabled={index === 0} onClick={() => onIndex(index - 1)}><ChevronLeft size={18} /></button>
          <button type="button" aria-label="Next phase" className="primary" disabled={index === plan.phases.length - 1} onClick={() => onIndex(index + 1)}><ChevronRight size={18} /></button>
        </div>
        <div className="present-segments" style={{ gridTemplateColumns: `repeat(${plan.phases.length}, minmax(0, 1fr))` }}>
          {plan.phases.map((p, i) => (
            <button key={p.id} type="button" aria-current={i === index ? 'step' : undefined} className={i === index ? 'current' : i < index ? 'done' : ''} onClick={() => onIndex(i)}>
              <span className="ticks"><i /></span>
              <span className="seg-label"><b>{p.name}</b></span>
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
