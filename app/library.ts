import { migratePlan, uid, validatePlan, type Entity, type Plan, type Terrain, type UnitKind } from './plan';

/**
 * Client side of encounter storage. Encounters are saved in Google Cloud Storage through the app's /api/encounters
 * routes (one directory per encounter). Encounters left in this browser's localStorage by earlier versions are
 * uploaded once and then removed locally.
 */
export type EncounterMeta = { id: string; name: string; updatedAt: number; phases: number; cols: number; rows: number };

const LOCAL_INDEX_KEY = 'raid-designer:encounters';
const LOCAL_LEGACY_KEY = 'raid-designer:plan';
const localPlanKey = (id: string) => `raid-designer:encounter:${id}`;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

/** Parses an imported plan file, upgrading older versions. Returns null when it is not a valid plan. */
export function parsePlan(text: string): Plan | null {
  try { const plan = migratePlan(JSON.parse(text)); return validatePlan(plan) ? plan : null; } catch { return null; }
}

/** Uploads encounters saved in this browser by earlier versions, removing each one locally once it is stored. */
export async function uploadLocalEncounters(): Promise<number> {
  let uploaded = 0;
  try {
    const index = JSON.parse(localStorage.getItem(LOCAL_INDEX_KEY) ?? 'null') as { id: string }[] | null;
    for (const { id } of Array.isArray(index) ? index : []) {
      const raw = localStorage.getItem(localPlanKey(id));
      const plan = raw && parsePlan(raw);
      if (plan) { await saveEncounter(/^[a-z0-9][a-z0-9-]{0,63}$/.test(id) ? id : uid('enc'), plan); uploaded++; }
      localStorage.removeItem(localPlanKey(id));
    }
    localStorage.removeItem(LOCAL_INDEX_KEY);
    const legacy = localStorage.getItem(LOCAL_LEGACY_KEY);
    const plan = legacy && parsePlan(legacy);
    if (plan) { await saveEncounter(uid('enc'), plan); uploaded++; }
    localStorage.removeItem(LOCAL_LEGACY_KEY);
  } catch (e) {
    if (e instanceof Error && !(e instanceof SyntaxError)) throw e; // keep local copies if the upload failed
  }
  return uploaded;
}

export async function listEncounters(): Promise<{ encounters: EncounterMeta[]; location: string }> {
  return api('/api/encounters');
}

export async function loadEncounter(id: string): Promise<Plan | null> {
  const res = await fetch(`/api/encounters/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as Plan;
}

/** `keepalive` lets a final save finish while the page is closing. */
export async function saveEncounter(id: string, plan: Plan, keepalive = false) {
  await api(`/api/encounters/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(plan), keepalive });
}

export async function createEncounter(plan: Plan) {
  const id = uid('enc');
  await saveEncounter(id, plan);
  return id;
}

export async function duplicateEncounter(id: string) {
  const plan = await loadEncounter(id);
  return plan ? createEncounter({ ...plan, name: `${plan.name} (copy)`.slice(0, 120) }) : null;
}

export async function deleteEncounter(id: string) {
  await api(`/api/encounters/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export type Layout = 'walled' | 'open';
export const canHoldParty = (cols: number, rows: number) => cols >= 10 && rows >= 12;

/** A one-phase plan with an empty arena, optionally seeded with a boss and an 8-player party. */
export function createBlankPlan(name: string, cols: number, rows: number, layout: Layout, withParty: boolean): Plan {
  const m = layout === 'walled' ? 1 : 0;
  const terrain = Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x): Terrain =>
    m && (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) ? 'wall' : 'floor'));
  const entities: Entity[] = [];
  if (withParty && canHoldParty(cols, rows)) {
    const cx = Math.floor(cols / 2);
    const at = (x: number) => Math.max(m, Math.min(cols - 1 - m, x));
    const unit = (id: string, kind: UnitKind, name: string, code: string, x: number, y: number): Entity => ({ id, kind, name, code, x: at(x), y, radius: 1, rotation: 0 });
    entities.push(
      unit('boss', 'boss', 'Boss', 'BOSS', cx - 1, m + 1),
      unit('mt', 'tank', 'Main tank', 'MT', cx - 1, m + 4), unit('ot', 'tank', 'Off tank', 'OT', cx, m + 4),
      unit('d1', 'dps', 'DPS 1', 'D1', cx - 3, m + 6), unit('d2', 'dps', 'DPS 2', 'D2', cx - 1, m + 6),
      unit('d3', 'dps', 'DPS 3', 'D3', cx + 1, m + 6), unit('d4', 'dps', 'DPS 4', 'D4', cx + 3, m + 6),
      unit('h1', 'healer', 'Healer 1', 'H1', cx - 2, m + 8), unit('h2', 'healer', 'Healer 2', 'H2', cx + 1, m + 8),
    );
  }
  return { version: 2, name, cols, rows, phases: [{ id: uid('phase'), name: 'Phase 1', notes: '', terrain, entities, conversations: [] }] };
}
