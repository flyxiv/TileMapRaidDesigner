import { diagramPlan, type Diagram } from '../plan';
import { BattleMap } from './BattleMap';

/** Small, non-interactive pictures of a mechanic page's maps, sized to fit `width` pixels each. */
export function MapPreviews({ diagrams, width, max = 3, captions = false }: { diagrams: Diagram[] | undefined; width: number; max?: number; captions?: boolean }) {
  const maps = diagrams ?? [];
  if (!maps.length) return null;
  const shown = maps.slice(0, max);
  return (
    <div className="map-previews" aria-label={`${maps.length} map${maps.length > 1 ? 's' : ''}`}>
      {shown.map(d => (
        <figure key={d.id} className="map-preview" title={d.caption}>
          <BattleMap plan={diagramPlan(d)} phaseIndex={0} cell={Math.max(3, Math.floor(width / d.cols))} coords={false} showMoves={false} />
          {captions && d.caption && <figcaption>{d.caption}</figcaption>}
        </figure>
      ))}
      {maps.length > shown.length && <span className="map-preview-more">+{maps.length - shown.length}</span>}
    </div>
  );
}
