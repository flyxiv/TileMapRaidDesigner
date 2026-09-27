import { createPlan, migratePlan, uid, validatePlan, type Entity, type Plan, type Terrain, type UnitKind } from './plan';

/** Encounters live in localStorage: an index of summaries plus one entry per plan. */
export type EncounterMeta = { id: string; name: string; updatedAt: number; phases: number; cols: number; rows: number };

const INDEX_KEY = 'raid-designer:encounters';
const LEGACY_KEY = 'raid-designer:plan';
const planKey = (id: string) => `raid-designer:encounter:${id}`;

const meta = (id: string, plan: Plan, updatedAt = Date.now()): EncounterMeta =>
  ({ id, name: plan.name, updatedAt, phases: plan.phases.length, cols: plan.cols, rows: plan.rows });

function readIndex(): EncounterMeta[] | null {
  const raw = localStorage.getItem(INDEX_KEY);
  if (raw === null) return null;
  try { const list = JSON.parse(raw); return Array.isArray(list) ? list : []; } catch { return []; }
}
const writeIndex = (list: EncounterMeta[]) => localStorage.setItem(INDEX_KEY, JSON.stringify(list));

/** Parses a stored or imported plan, upgrading older versions. Returns null when it is not a valid plan. */
export function parsePlan(text: string): Plan | null {
  try { const plan = migratePlan(JSON.parse(text)); return validatePlan(plan) ? plan : null; } catch { return null; }
}

/** Lists encounters, newest first. The first visit seeds the library with the single plan older versions saved, or the sample encounter. */
export function listEncounters(): EncounterMeta[] {
  let list = readIndex();
  if (list === null) {
    const legacy = localStorage.getItem(LEGACY_KEY);
    const seed = (legacy && parsePlan(legacy)) || createPlan();
    const id = uid('enc');
    localStorage.setItem(planKey(id), JSON.stringify(seed));
    list = [meta(id, seed)];
    writeIndex(list);
    localStorage.removeItem(LEGACY_KEY);
  }
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadEncounter(id: string): Plan | null {
  const raw = localStorage.getItem(planKey(id));
  return raw ? parsePlan(raw) : null;
}

export function saveEncounter(id: string, plan: Plan) {
  localStorage.setItem(planKey(id), JSON.stringify(plan));
  const list = readIndex() ?? [];
  writeIndex([...list.filter(e => e.id !== id), meta(id, plan)]);
}

export function createEncounter(plan: Plan) {
  const id = uid('enc');
  saveEncounter(id, plan);
  return id;
}

export function duplicateEncounter(id: string) {
  const plan = loadEncounter(id);
  return plan ? createEncounter({ ...plan, name: `${plan.name} (copy)`.slice(0, 120) }) : null;
}

export function deleteEncounter(id: string) {
  localStorage.removeItem(planKey(id));
  writeIndex((readIndex() ?? []).filter(e => e.id !== id));
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
    const unit = (id: string, kind: UnitKind, name: string, code: string, x: number, y: number): Entity => ({ id, kind, name, code, x: at(x), y, radius: 1, rotation: 0, turns: 0 });
    entities.push(
      unit('boss', 'boss', 'Boss', 'BOSS', cx - 1, m + 1),
      unit('mt', 'tank', 'Main tank', 'MT', cx - 1, m + 4), unit('ot', 'tank', 'Off tank', 'OT', cx, m + 4),
      unit('d1', 'dps', 'DPS 1', 'D1', cx - 3, m + 6), unit('d2', 'dps', 'DPS 2', 'D2', cx - 1, m + 6),
      unit('d3', 'dps', 'DPS 3', 'D3', cx + 1, m + 6), unit('d4', 'dps', 'DPS 4', 'D4', cx + 3, m + 6),
      unit('h1', 'healer', 'Healer 1', 'H1', cx - 2, m + 8), unit('h2', 'healer', 'Healer 2', 'H2', cx + 1, m + 8),
    );
  }
  return { version: 2, name, cols, rows, phases: [{ id: uid('phase'), name: 'Phase 1', notes: '', turns: 3, terrain, entities, dialogue: [] }] };
}
