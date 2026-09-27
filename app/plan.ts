export const terrainTypes = {
  floor: { name: 'Floor', color: '#3e4943', blocks: false },
  wall: { name: 'Wall', color: '#777e70', blocks: true },
  water: { name: 'Water', color: '#294a57', blocks: false },
  lava: { name: 'Lava', color: '#8f4936', blocks: false },
  grass: { name: 'Grass', color: '#495b39', blocks: false },
  void: { name: 'Void', color: '#1c2523', blocks: true },
};
export const unitCategories = {
  characters: { name: 'Characters', description: 'The raid party' },
  enemies: { name: 'Enemies', description: 'Hostile to the party' },
  neutral: { name: 'Neutral', description: 'Story characters and bystanders' },
};
export type UnitCategory = keyof typeof unitCategories;
/** `size` is the footprint in tiles per side. */
export const unitTypes: Record<'tank' | 'healer' | 'dps' | 'boss' | 'miniboss' | 'add' | 'npc', { name: string; category: UnitCategory; color: string; fill: string; prefix: string; size: number }> = {
  tank: { name: 'Tank', category: 'characters', color: '#8babeb', fill: '#1a2130', prefix: 'T', size: 1 },
  healer: { name: 'Healer', category: 'characters', color: '#9acc99', fill: '#1a261c', prefix: 'H', size: 1 },
  dps: { name: 'DPS', category: 'characters', color: '#c3a0e2', fill: '#241c2d', prefix: 'D', size: 1 },
  boss: { name: 'Boss', category: 'enemies', color: '#e49780', fill: '#2a1c18', prefix: 'B', size: 2 },
  miniboss: { name: 'Mini-boss', category: 'enemies', color: '#ef8fa6', fill: '#2c1a20', prefix: 'MB', size: 1 },
  add: { name: 'Add', category: 'enemies', color: '#b98a7d', fill: '#241c1a', prefix: 'A', size: 1 },
  npc: { name: 'NPC', category: 'neutral', color: '#cfd6d3', fill: '#252a2a', prefix: 'N', size: 1 },
};
export const unitsIn = (category: UnitCategory) => (Object.keys(unitTypes) as UnitKind[]).filter(k => unitTypes[k].category === category);
export const mechanicTypes = {
  circle: { name: 'Circle', description: 'Area damage around a point' },
  cone: { name: 'Cone', description: 'Frontal area damage' },
  line: { name: 'Line', description: 'Charge or beam in a straight line' },
  donut: { name: 'Donut', description: 'Safe inside, damage in the ring' },
  flare: { name: 'Flare', description: 'Proximity damage that falls off with distance' },
  stack: { name: 'Stack', description: 'Shared damage: stand together' },
  spread: { name: 'Spread', description: 'Personal damage: stand apart' },
  tower: { name: 'Tower', description: 'Must be soaked by players standing in it' },
  knockback: { name: 'Knockback', description: 'Pushes units away from the origin' },
  armageddon: { name: 'Armageddon', description: 'Arena-wide damage outside safe zones' },
  marker: { name: 'Marker', description: 'Safe zone' },
};
export const tones = { telegraph: '#dbb36d', imminent: '#ec8c60', safe: '#c6eb95', soak: '#86c5f2' };
/** Which settings a mechanic kind uses. */
export const mechanicFields = (kind: Kind) => ({
  radius: kind !== 'armageddon', facing: kind === 'cone' || kind === 'line', inner: kind === 'donut',
  width: kind === 'line', push: kind === 'knockback', soak: kind === 'tower', origin: kind !== 'armageddon',
});

export type Terrain = keyof typeof terrainTypes;
export type UnitKind = keyof typeof unitTypes;
export type MechanicKind = keyof typeof mechanicTypes;
export type Kind = UnitKind | MechanicKind;
/** Units occupy tiles; mechanics are telegraphs. `turns` is the countdown until a mechanic resolves (0 = lasts the whole phase). */
export type Entity = {
  id: string; kind: Kind; name: string; code: string; x: number; y: number; radius: number; rotation: number; turns: number; anchor?: string;
  /** Donut safe radius, line width, knockback distance and tower soak count, for the mechanics that use them. */
  inner?: number; width?: number; push?: number; soak?: number;
  /** Units only: tiles per side, overriding the type's usual size. */
  size?: number;
  /** Cones and lines that start from a unit: aim the way that unit faces instead of their own rotation. */
  followFacing?: boolean;
};
/** A choice offered on a dialogue line. `goto` names the phase the fight jumps to when it is picked. */
export type DialogueOption = { id: string; text: string; outcome: string; goto?: string };
/** Where a line appears on the map: over the speaking unit (the default) or as a banner across the top. */
export type DialoguePlacement = 'unit' | 'top';
/**
 * When a line is spoken: at a boss HP percentage (`target` is the enemy's unit id; none means the first boss),
 * at a time from the start of the encounter, or a number of seconds after a mechanic (by entity id) goes off.
 */
export type DialogueTrigger =
  | { type: 'hp'; percent: number; target?: string }
  | { type: 'time'; seconds: number }
  | { type: 'mechanic'; mechanic: string; seconds: number };
/** One line of dialogue. Lines belong to a conversation and play in order. */
export type DialogueLine = { id: string; speaker: string; text: string; options: DialogueOption[]; placement?: DialoguePlacement };
/** Lines spoken together, starting when the trigger fires. */
export type Conversation = { id: string; title: string; trigger: DialogueTrigger; lines: DialogueLine[] };
export const triggerTypes = { hp: 'Boss HP', time: 'Encounter time', mechanic: 'After mechanic' };
export type Phase = { id: string; name: string; notes: string; turns: number; terrain: Terrain[][]; entities: Entity[]; conversations: Conversation[] };
export type Plan = { version: 2; name: string; cols: number; rows: number; phases: Phase[] };

export const isUnit = (kind: Kind): kind is UnitKind => kind in unitTypes;
export const isMechanic = (kind: Kind): kind is MechanicKind => kind in mechanicTypes;
export const MAX_UNIT_SIZE = 5;
export const footprint = (e: Pick<Entity, 'kind'> & { size?: number }) => isUnit(e.kind) ? e.size ?? unitTypes[e.kind].size : 1;
export const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

export const colLabel = (i: number) => i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + i - 26);
export const tileLabel = (x: number, y: number) => `${colLabel(x)}${y + 1}`;

export function mechanicTone(e: Pick<Entity, 'kind' | 'turns'>) {
  if (e.kind === 'marker' || e.kind === 'stack') return tones.safe;
  if (e.kind === 'tower') return tones.soak;
  return e.turns === 1 ? tones.imminent : tones.telegraph;
}

/** Turn range covered by each phase, counted from turn 1. */
export function phaseTurnRanges(plan: Plan) {
  let start = 1;
  return plan.phases.map(p => { const range = { start, end: start + p.turns - 1 }; start += p.turns; return range; });
}
export const createLine = (speaker: string): DialogueLine => ({ id: uid('line'), speaker, text: '', options: [] });
export const createConversation = (trigger: DialogueTrigger, speaker: string): Conversation => ({ id: uid('conv'), title: '', trigger, lines: [createLine(speaker)] });
/** Every line in a phase in playing order, with the conversation it belongs to. */
export const scriptOf = (phase: Phase) => phase.conversations.flatMap(conversation => conversation.lines.map(line => ({ conversation, line })));
export const lineCount = (phase: Phase) => phase.conversations.reduce((n, c) => n + c.lines.length, 0);

export const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
/** The enemy a boss HP trigger watches: its target, else the phase's first boss, mini-boss or add. */
export const hpTarget = (t: { target?: string }, phase: Phase) =>
  phase.entities.find(e => e.id === t.target && isUnit(e.kind)) ?? phase.entities.find(e => e.kind === 'boss') ?? phase.entities.find(e => isUnit(e.kind) && unitTypes[e.kind].category === 'enemies');
/** Short description of when a line is spoken, e.g. "Obsidian Sentinel HP 30%", "1:45" or "5s after Frontal cleave". */
export function triggerLabel(t: DialogueTrigger, phase: Phase) {
  if (t.type === 'hp') return `${hpTarget(t, phase)?.name ?? 'Boss'} HP ${t.percent}%`;
  if (t.type === 'time') return formatTime(t.seconds);
  const m = phase.entities.find(e => e.id === t.mechanic);
  return `${t.seconds}s after ${m ? m.name : 'a removed mechanic'}`;
}
export const createOption = (): DialogueOption => ({ id: uid('opt'), text: '', outcome: '' });

export const turnRangeText = ({ start, end }: { start: number; end: number }) => start === end ? `Turn ${start}` : `Turns ${start}–${end}`;

/** Center of an entity in tile units (tile edges are integers). */
export function center(e: Entity): [number, number] {
  const s = footprint(e);
  return [e.x + s / 2, e.y + s / 2];
}

export function mechanicOrigin(m: Entity, entities: Entity[]): { point: [number, number]; anchor?: Entity } {
  const anchor = m.anchor ? entities.find(e => e.id === m.anchor && isUnit(e.kind)) : undefined;
  return anchor ? { point: center(anchor), anchor } : { point: center(m) };
}

/** Direction a telegraph points, in compass degrees: its own rotation, or its unit's facing when it follows it. */
export function mechanicFacing(m: Entity, entities: Entity[]) {
  const anchor = m.followFacing ? mechanicOrigin(m, entities).anchor : undefined;
  return anchor ? anchor.rotation : m.rotation;
}
export const aims = (kind: Kind) => kind === 'cone' || kind === 'line';

/** Walkable tiles a mechanic covers. Walls and void never take damage. */
/** Walkable tiles a mechanic covers, each with a strength from 0 to 1 (below 1 only for flare falloff). Walls and void never take damage. */
export function hazardTiles(m: Entity, phase: Phase, plan: Plan): [number, number, number][] {
  const { point: [cx, cy], anchor } = mechanicOrigin(m, phase.entities);
  const a = (mechanicFacing(m, phase.entities) * Math.PI) / 180, dir = [Math.sin(a), -Math.cos(a)];
  const halfAngle = Math.cos((46 * Math.PI) / 180);
  const inAnchor = (x: number, y: number) => !!anchor && x >= anchor.x && x < anchor.x + footprint(anchor) && y >= anchor.y && y < anchor.y + footprint(anchor);
  const safeZones = m.kind === 'armageddon' ? phase.entities.filter(e => e.kind === 'marker').map(s => ({ c: mechanicOrigin(s, phase.entities).point, r: s.radius })) : [];
  const tiles: [number, number, number][] = [];
  for (let y = 0; y < plan.rows; y++) for (let x = 0; x < plan.cols; x++) {
    if (terrainTypes[phase.terrain[y][x]].blocks) continue;
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
    let strength = 1;
    switch (m.kind) {
      case 'cone':
        if (inAnchor(x, y) || d < 0.3 || d > m.radius + 0.2 || (dx * dir[0] + dy * dir[1]) / d < halfAngle) continue;
        break;
      case 'line': {
        const along = dx * dir[0] + dy * dir[1], across = Math.abs(dx * dir[1] - dy * dir[0]);
        if (inAnchor(x, y) || along < -0.01 || along > m.radius + 0.2 || across > (m.width ?? 1) / 2 + 0.01) continue;
        break;
      }
      case 'donut':
        if (d > m.radius || d <= (m.inner ?? 1)) continue;
        break;
      case 'flare':
        if (d > m.radius) continue;
        strength = Math.max(0.25, 1 - d / (m.radius + 0.5));
        break;
      case 'armageddon':
        if (safeZones.some(s => Math.hypot(x + 0.5 - s.c[0], y + 0.5 - s.c[1]) <= s.r)) continue;
        break;
      default:
        if (d > m.radius) continue;
    }
    tiles.push([x, y, strength]);
  }
  return tiles;
}

export function entityAt(phase: Phase, x: number, y: number) {
  return phase.entities.find(e => isUnit(e.kind) && x >= e.x && x < e.x + footprint(e) && y >= e.y && y < e.y + footprint(e))
    ?? phase.entities.find(e => isMechanic(e.kind) && !e.anchor && e.x === x && e.y === y);
}

export function clampEntity(e: Entity, plan: Plan): Entity {
  const s = footprint(e);
  return { ...e, x: Math.max(0, Math.min(plan.cols - s, e.x)), y: Math.max(0, Math.min(plan.rows - s, e.y)) };
}

export function nextCode(phase: Phase, kind: UnitKind) {
  const prefix = unitTypes[kind].prefix;
  let n = phase.entities.filter(e => e.kind === kind).length + 1;
  while (phase.entities.some(e => e.code === `${prefix}${n}`)) n++;
  return { code: `${prefix}${n}`, name: `${unitTypes[kind].name} ${n}` };
}

export function createMechanic(kind: MechanicKind, x: number, y: number): Entity {
  const defaults = {
    circle: { name: 'Impact', radius: 2, rotation: 0, turns: 2 },
    cone: { name: 'Cleave', radius: 3, rotation: 180, turns: 2 },
    line: { name: 'Charge', radius: 6, rotation: 180, turns: 2, width: 1 },
    donut: { name: 'Donut', radius: 4, rotation: 0, turns: 2, inner: 1.5 },
    flare: { name: 'Flare', radius: 5, rotation: 0, turns: 3 },
    stack: { name: 'Stack', radius: 1.5, rotation: 0, turns: 2 },
    spread: { name: 'Spread', radius: 1.5, rotation: 0, turns: 2 },
    tower: { name: 'Tower', radius: 1, rotation: 0, turns: 3, soak: 2 },
    knockback: { name: 'Knockback', radius: 3, rotation: 0, turns: 2, push: 2 },
    armageddon: { name: 'Armageddon', radius: 1, rotation: 0, turns: 3 },
    marker: { name: 'Safe zone', radius: 1.5, rotation: 0, turns: 0 },
  }[kind];
  return { id: uid(kind), kind, code: '', x, y, ...defaults };
}

function baseTerrain(cols: number, rows: number): Terrain[][] {
  return Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x): Terrain => {
    if (x < 2 || x > 17 || y < 1 || y > 14) return 'void';
    if ((x < 4 || x > 15) && (y < 3 || y > 12)) return 'void';
    if (x === 2 || x === 17 || y === 1 || y === 14 || ((x === 3 || x === 16) && (y === 2 || y === 13))) return 'wall';
    if ((x === 5 || x === 14) && (y === 5 || y === 10)) return 'wall';
    if ((x === 3 || x === 16) && y >= 6 && y <= 9) return 'water';
    return 'floor';
  }));
}

export function createPlan(): Plan {
  const cols = 20, rows = 16;
  const unit = (id: string, kind: UnitKind, name: string, code: string, x: number, y: number): Entity => ({ id, kind, name, code, x, y, radius: 1, rotation: 0, turns: 0 });
  const roster = (pos: Record<string, [number, number]>) => [
    unit('boss', 'boss', 'Obsidian Sentinel', 'BOSS', ...pos.boss),
    unit('mt', 'tank', 'Main tank', 'MT', ...pos.mt), unit('ot', 'tank', 'Off tank', 'OT', ...pos.ot),
    unit('h1', 'healer', 'Healer 1', 'H1', ...pos.h1), unit('h2', 'healer', 'Healer 2', 'H2', ...pos.h2),
    unit('d1', 'dps', 'DPS 1', 'D1', ...pos.d1), unit('d2', 'dps', 'DPS 2', 'D2', ...pos.d2),
    unit('d3', 'dps', 'DPS 3', 'D3', ...pos.d3), unit('d4', 'dps', 'DPS 4', 'D4', ...pos.d4),
  ];
  const mech = (id: string, kind: MechanicKind, name: string, x: number, y: number, radius: number, rotation: number, turns: number, anchor?: string): Entity =>
    ({ id, kind, name, code: '', x, y, radius, rotation, turns, ...(anchor ? { anchor } : {}) });
  const scorched = baseTerrain(cols, rows).map((row, y) => row.map((t, x): Terrain => x >= 8 && x <= 11 && y >= 8 && y <= 9 ? 'lava' : t));
  return { version: 2, name: 'The Obsidian Sanctum', cols, rows, phases: [
    { id: 'opening', name: 'The opening move', turns: 3, terrain: baseTerrain(cols, rows),
      notes: 'Tank holds the Sentinel facing north.\n\nSpread DPS on the flanks. Keep healers at the back, outside the impact zone.\n\nSave movement skills for the first cleave.',
      entities: [
        ...roster({ boss: [9, 3], mt: [9, 6], ot: [11, 6], h1: [6, 11], h2: [13, 11], d1: [7, 8], d2: [12, 8], d3: [8, 10], d4: [11, 10] }),
        mech('cleave', 'cone', 'Frontal cleave', 9, 3, 4, 180, 2, 'boss'),
        mech('impact', 'circle', 'Obsidian impact', 13, 8, 1.6, 0, 3),
      ],
      conversations: [{ id: 'conv-wake', title: 'Awakening', trigger: { type: 'time', seconds: 0 }, lines: [
        { id: 'line-wake', speaker: 'Obsidian Sentinel', text: 'Who dares wake the Sanctum?', options: [] },
      ] }] },
    { id: 'shatter', name: 'Shattered ground', turns: 3, terrain: scorched,
      notes: 'Spread out for the impact. Move to the outer tiles and keep the center clear.',
      entities: [
        ...roster({ boss: [9, 3], mt: [9, 6], ot: [11, 6], h1: [4, 11], h2: [15, 11], d1: [4, 7], d2: [15, 7], d3: [7, 12], d4: [12, 12] }),
        mech('shatter-1', 'circle', 'Shatter', 9, 8, 2.6, 0, 1),
        mech('debris', 'circle', 'Falling debris', 6, 3, 1.6, 0, 2),
      ],
      conversations: [] },
    { id: 'stand', name: 'The final stand', turns: 3, terrain: baseTerrain(cols, rows),
      notes: 'Regroup at the center. Use defensive cooldowns and finish the Sentinel.',
      entities: [
        ...roster({ boss: [9, 5], mt: [9, 7], ot: [11, 7], h1: [8, 11], h2: [11, 11], d1: [9, 10], d2: [10, 10], d3: [9, 11], d4: [10, 11] }),
        mech('cleave-2', 'cone', 'Frontal cleave', 9, 5, 3, 180, 1, 'boss'),
        mech('stack', 'stack', 'Stack', 9, 10, 1.6, 0, 2),
      ],
      conversations: [{ id: 'conv-offer', title: 'The offer', trigger: { type: 'hp', percent: 30, target: 'boss' }, lines: [{ id: 'line-offer', speaker: 'Obsidian Sentinel', text: 'Kneel, and I will let the rest of you leave.', options: [
        { id: 'opt-refuse', text: 'Refuse', outcome: 'The Sentinel enrages. Finish it before the stack point collapses.' },
        { id: 'opt-kneel', text: 'Kneel', outcome: 'The Sentinel strikes the kneeling player. Healers spot-heal them next turn.' },
      ] }] }] },
  ] };
}

/** Upgrades a version 1 plan (shared terrain, no countdowns) to the current shape. */
export function migratePlan(value: unknown): unknown {
  const p = value as { version?: number; terrain?: unknown; phases?: { entities?: Record<string, unknown>[]; dialogue?: unknown; conversations?: unknown }[] };
  if (!p || typeof p !== 'object' || !Array.isArray(p.phases)) return value;
  if (p.version === 2) {
    if (p.phases.every(f => f && Array.isArray(f.conversations))) return value;
    return { ...p, phases: p.phases.map(f => f && !Array.isArray(f.conversations) ? toConversations(f) : f) };
  }
  if (p.version !== 1) return value;
  return {
    ...p, version: 2, terrain: undefined,
    phases: p.phases.map(f => ({ ...f, turns: 1, terrain: p.terrain, conversations: [], entities: Array.isArray(f.entities) ? f.entities.map(e => ({ code: '', turns: e.kind === 'marker' ? 0 : 2, ...e })) : f.entities })),
  };
}

/**
 * Older plans kept a flat list of lines (`dialogue`), each with its own trigger, and before that a turn number.
 * Consecutive lines with the same trigger become one conversation; lines without a trigger start at 0:00.
 */
function toConversations<F extends { dialogue?: unknown }>(phase: F) {
  const { dialogue, ...rest } = phase;
  const conversations: Conversation[] = [];
  for (const raw of Array.isArray(dialogue) ? dialogue as Record<string, unknown>[] : []) {
    if (!raw || typeof raw !== 'object') continue;
    const { trigger = { type: 'time', seconds: 0 }, turn: _turn, ...line } = raw;
    const last = conversations[conversations.length - 1];
    if (last && JSON.stringify(last.trigger) === JSON.stringify(trigger)) last.lines.push(line as DialogueLine);
    else conversations.push({ id: uid('conv'), title: '', trigger: trigger as DialogueTrigger, lines: [line as DialogueLine] });
  }
  return { ...rest, conversations };
}

export function validatePlan(value: unknown): value is Plan {
  if (!value || typeof value !== 'object') return false;
  const p = value as Plan;
  const int = (n: unknown, min: number, max: number) => Number.isInteger(n) && (n as number) >= min && (n as number) <= max;
  const validTrigger = (t: DialogueTrigger) => !!t && typeof t === 'object' && (
    (t.type === 'hp' && int(t.percent, 0, 100) && (t.target === undefined || typeof t.target === 'string')) ||
    (t.type === 'time' && int(t.seconds, 0, 5999)) ||
    (t.type === 'mechanic' && typeof t.mechanic === 'string' && int(t.seconds, 0, 5999)));
  const num = (n: unknown, min: number, max: number) => n === undefined || (typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max);
  return p.version === 2 && typeof p.name === 'string' && p.name.length <= 120 && int(p.cols, 8, 30) && int(p.rows, 8, 30) &&
    Array.isArray(p.phases) && p.phases.length > 0 && p.phases.length <= 30 && new Set(p.phases.map(f => f?.id)).size === p.phases.length &&
    p.phases.every(f => f && typeof f.id === 'string' && typeof f.name === 'string' && f.name.length <= 120 && typeof f.notes === 'string' && f.notes.length <= 10000 && int(f.turns, 1, 20) &&
      Array.isArray(f.terrain) && f.terrain.length === p.rows && f.terrain.every(row => Array.isArray(row) && row.length === p.cols && row.every(t => Object.hasOwn(terrainTypes, t))) &&
      Array.isArray(f.entities) && f.entities.length <= 500 && new Set(f.entities.map(e => e?.id)).size === f.entities.length &&
      f.entities.every(e => e && typeof e.id === 'string' && typeof e.name === 'string' && e.name.length <= 120 && typeof e.code === 'string' && e.code.length <= 6 &&
        (Object.hasOwn(unitTypes, e.kind) || Object.hasOwn(mechanicTypes, e.kind)) &&
        int(e.x, 0, p.cols - footprint(e)) && int(e.y, 0, p.rows - footprint(e)) &&
        Number.isFinite(e.radius) && e.radius >= 1 && e.radius <= 8 && Number.isFinite(e.rotation) && e.rotation >= 0 && e.rotation < 360 && int(e.turns, 0, 9) &&
        num(e.inner, 0.5, 7.5) && num(e.width, 1, 8) && num(e.push, 1, 10) && (e.soak === undefined || int(e.soak, 1, 8)) && (e.size === undefined || int(e.size, 1, MAX_UNIT_SIZE)) &&
        (e.anchor === undefined || typeof e.anchor === 'string') && (e.followFacing === undefined || typeof e.followFacing === 'boolean')) &&
      Array.isArray(f.conversations) && f.conversations.length <= 100 && new Set(f.conversations.map(c => c?.id)).size === f.conversations.length &&
      f.conversations.every(c => c && typeof c.id === 'string' && typeof c.title === 'string' && c.title.length <= 120 && validTrigger(c.trigger) &&
        Array.isArray(c.lines) && c.lines.length <= 200 && new Set(c.lines.map(l => l?.id)).size === c.lines.length &&
      c.lines.every(l => l && typeof l.id === 'string' && typeof l.speaker === 'string' && l.speaker.length <= 60 &&
        typeof l.text === 'string' && l.text.length <= 2000 && Array.isArray(l.options) && l.options.length <= 6 &&
        (l.placement === undefined || l.placement === 'unit' || l.placement === 'top') &&
        l.options.every(o => o && typeof o.id === 'string' && typeof o.text === 'string' && o.text.length <= 200 &&
          typeof o.outcome === 'string' && o.outcome.length <= 1000 && (o.goto === undefined || typeof o.goto === 'string')))));
}

/**
 * Resizes every phase's grid. `anchor` (0, 0.5 or 1 per axis) picks which edge stays put: 0 keeps the left/top edge,
 * 1 keeps the right/bottom edge, 0.5 grows or trims both sides evenly. New tiles take `fill`; units and telegraphs
 * shift with the content and are pulled back inside if the new edge cuts them off.
 */
export function resizePlan(plan: Plan, cols: number, rows: number, anchor: [number, number], fill: Terrain): Plan {
  const dx = Math.round((cols - plan.cols) * anchor[0]), dy = Math.round((rows - plan.rows) * anchor[1]);
  const next = { ...plan, cols, rows };
  return {
    ...next,
    phases: plan.phases.map(p => ({
      ...p,
      terrain: Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => p.terrain[y - dy]?.[x - dx] ?? fill)),
      entities: p.entities.map(e => clampEntity({ ...e, x: e.x + dx, y: e.y + dy }, next)),
    })),
  };
}

/** How many units and telegraphs a resize would push back inside the map. */
export function countDisplaced(plan: Plan, cols: number, rows: number, anchor: [number, number]) {
  const dx = Math.round((cols - plan.cols) * anchor[0]), dy = Math.round((rows - plan.rows) * anchor[1]);
  return plan.phases.reduce((n, p) => n + p.entities.filter(e => {
    const x = e.x + dx, y = e.y + dy, s = footprint(e);
    return x < 0 || y < 0 || x + s > cols || y + s > rows;
  }).length, 0);
}
