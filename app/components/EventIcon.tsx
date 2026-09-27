import { MessagesSquare, Zap } from 'lucide-react';

/** The two kinds of timeline event. Mechanics share one icon; their shape shows on the map, not here. */
export function EventIcon({ kind, size = 13 }: { kind: 'conversation' | 'mechanic'; size?: number }) {
  const Icon = kind === 'conversation' ? MessagesSquare : Zap;
  return <span className={`event-icon event-icon-${kind}`} aria-hidden="true"><Icon size={size} strokeWidth={2.2} /></span>;
}
