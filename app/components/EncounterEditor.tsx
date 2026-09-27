'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { loadEncounter } from '../library';
import type { Plan } from '../plan';
import { Editor } from './Editor';

export function EncounterEditor({ id }: { id: string }) {
  const [plan, setPlan] = useState<Plan | null | 'loading'>('loading');
  useEffect(() => {
    try { setPlan(loadEncounter(id)); } catch { setPlan(null); }
  }, [id]);

  if (plan === 'loading') return <div className="empty-page" />;
  if (!plan) return (
    <div className="empty-page">
      <h1>Encounter not found</h1>
      <p>It may have been deleted, or it was saved in a different browser.</p>
      <Link href="/" className="button primary">Back to encounters</Link>
    </div>
  );
  return <Editor key={id} encounterId={id} initialPlan={plan} />;
}
