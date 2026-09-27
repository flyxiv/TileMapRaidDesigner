'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { loadEncounter } from '../library';
import type { Plan } from '../plan';
import { Editor } from './Editor';

export function EncounterEditor({ id }: { id: string }) {
  const [plan, setPlan] = useState<Plan | null | 'loading'>('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setPlan('loading'); setError('');
    loadEncounter(id).then(p => { if (live) setPlan(p); }).catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [id, attempt]);

  if (error) return (
    <div className="empty-page">
      <h1>Could not load this encounter</h1>
      <p>{error}</p>
      <div className="dialog-actions"><Link href="/" className="button">Back to encounters</Link><button type="button" className="button primary" onClick={() => setAttempt(a => a + 1)}>Try again</button></div>
    </div>
  );
  if (plan === 'loading') return <div className="empty-page"><p>Loading encounter…</p></div>;
  if (!plan) return (
    <div className="empty-page">
      <h1>Encounter not found</h1>
      <p>It may have been deleted.</p>
      <Link href="/" className="button primary">Back to encounters</Link>
    </div>
  );
  return <Editor key={id} encounterId={id} initialPlan={plan} />;
}
