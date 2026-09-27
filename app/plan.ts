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
export const tones = { telegraph: '#dbb36d', safe: '#c6eb95', soak: '#86c5f2' };
/** Which settings a mechanic kind uses. */
export const mechanicFields = (kind: Kind) => ({
  radius: kind !== 'armageddon', facing: kind === 'cone' || kind === 'line', angle: kind === 'cone', inner: kind === 'donut',
  width: kind === 'line', push: kind === 'knockback', soak: kind === 'tower', origin: kind !== 'armageddon',
});

export type Terrain = keyof typeof terrainTypes;
export type UnitKind = keyof typeof unitTypes;
export type MechanicKind = keyof typeof mechanicTypes;
export type Kind = UnitKind | MechanicKind;
/** Units occupy tiles; mechanics are telegraphs. */
export type Entity = {
  id: string; kind: Kind; name: string; code: string; x: number; y: number; radius: number; rotation: number; anchor?: string;
  /** Donut safe radius, line width, knockback distance and tower soak count, for the mechanics that use them. */
  inner?: number; width?: number; push?: number; soak?: number;
  /** Cones only: the spread in degrees (default 90). */
  angle?: number;
  /** Reaches the whole map: circles cover the arena, cones and lines run to its edge. */
  infinite?: boolean;
  /** Telegraphs only, optional: seconds from the telegraph appearing to it going off. */
  castTime?: number;
  /** Telegraphs only, optional: the map from its mechanic page shown as the event's image (a diagram id). */
  image?: string;
  /** Units only, optional: a head marker shown on the unit. */
  marker?: MarkerKind;
  /** Telegraphs only, optional: the units it targets (by id). */
  targets?: string[];
  /** Units only: tiles per side, overriding the type's usual size. */
  size?: number;
  /** Cones and lines that start from a unit: aim the way that unit faces instead of their own rotation. */
  followFacing?: boolean;
  /** Telegraphs only: when it goes off, and the mechanic page that explains it. */
  trigger?: DialogueTrigger;
  page?: string;
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
/**
 * A stage direction for a unit during a conversation: a motion or gesture described in words, turning to face a
 * direction (or toward another unit), or moving to a tile.
 */
export type StageAction =
  | { kind: 'motion'; motion: string }
  | { kind: 'face'; rotation: number; toward?: string }
  | { kind: 'move'; x: number; y: number };
export type ActionStep = { id: string; type: 'action'; actor: string; action: StageAction };
/** Conversations are sequences of spoken lines and actions. */
export type ConversationStep = DialogueLine | ActionStep;
export const isAction = (s: ConversationStep): s is ActionStep => (s as ActionStep).type === 'action';
export const actionKinds = { motion: 'Motion', face: 'Turn', move: 'Move' };
export const motionPresets = ['Kneels', 'Bows', 'Points', 'Raises weapon', 'Casts', 'Laughs', 'Staggers', 'Collapses'];
/** Lines spoken together, starting when the trigger fires. `lines` holds its steps: spoken lines and actions, in order. */
export type Conversation = { id: string; title: string; trigger: DialogueTrigger; lines: ConversationStep[]; scene?: Scene };
/**
 * A conversation's own map: terrain and units as they stand when it starts. Without one, a conversation starts from
 * where the previous one left off. Telegraphs are not part of a scene; they belong to the phase and show on every map.
 */
export type Scene = { terrain: Terrain[][]; units: Entity[] };
export const triggerTypes = { hp: 'Boss HP', time: 'Encounter time', mechanic: 'After mechanic' };
/** `timeline` orders the phase's conversations and telegraphs (by id); anything missing from it follows at the end. */
export type Phase = { id: string; name: string; notes: string; terrain: Terrain[][]; entities: Entity[]; conversations: Conversation[]; timeline?: string[]; waymarks?: Waymarks };
/** World markers on the floor, as in FFXIV: A–D circles and 1–4 squares, one of each, shown on every map of a phase. */
export const waymarkTypes = {
  A: { shape: 'circle', color: '#ec5b55' }, B: { shape: 'circle', color: '#eccb4c' }, C: { shape: 'circle', color: '#5aa6ee' }, D: { shape: 'circle', color: '#b877ec' },
  '1': { shape: 'square', color: '#ec5b55' }, '2': { shape: 'square', color: '#eccb4c' }, '3': { shape: 'square', color: '#5aa6ee' }, '4': { shape: 'square', color: '#b877ec' },
} as const;
export type WaymarkKey = keyof typeof waymarkTypes;
/** In palette order (object keys would put the numbers first). */
export const waymarkKeys: WaymarkKey[] = ['A', 'B', 'C', 'D', '1', '2', '3', '4'];
/** Placed waymarks by key: the tile each sits on. */
export type Waymarks = Partial<Record<WaymarkKey, [number, number]>>;
/** Selection ids for waymarks, so they share selection with units and telegraphs. */
export const waymarkId = (k: WaymarkKey) => `waymark:${k}`;
export const waymarkOf = (id: string | null | undefined): WaymarkKey | null => id?.startsWith('waymark:') && Object.hasOwn(waymarkTypes, id.slice(8)) ? id.slice(8) as WaymarkKey : null;
/** Places (or with no tile, removes) a waymark on a phase or diagram. */
export function setWaymark<T extends { waymarks?: Waymarks }>(o: T, k: WaymarkKey, tile: [number, number] | null): T {
  const next: Waymarks = { ...o.waymarks };
  if (tile) next[k] = tile; else delete next[k];
  return { ...o, waymarks: Object.keys(next).length ? next : undefined };
}
/** A write-up of one mechanic, shared by every telegraph that links to it (in any phase). */
/** `kind` is the telegraph shape placed when the page is added to the timeline. */
export type MechanicPage = { id: string; title: string; kind?: MechanicKind; blocks: PageBlock[] };
/** A page reads top to bottom as a list of blocks, like a conversation: paragraphs of text and maps. */
export type PageBlock = { id: string; type: 'text'; text: string } | ({ type: 'map' } & Diagram);
export const textBlock = (text = ''): PageBlock => ({ id: uid('text'), type: 'text', text });
export const mapBlock = (d: Diagram): PageBlock => ({ ...d, type: 'map' });
/** A page's text, all blocks joined, for excerpts. */
export const pageText = (page: MechanicPage) => page.blocks.flatMap(b => b.type === 'text' && b.text.trim() ? [b.text.trim()] : []).join('\n\n');
/** A page's maps, in order. */
export const pageMaps = (page: MechanicPage): Diagram[] => page.blocks.flatMap(b => b.type === 'map' ? [b] : []);
/** A small map that illustrates a mechanic: its own grid, terrain and units, edited on the mechanic's page. */
export type Diagram = { id: string; caption: string; cols: number; rows: number; terrain: Terrain[][]; entities: Entity[]; waymarks?: Waymarks };

/** A throwaway one-phase plan so a diagram can be drawn and edited with the map components. */
export function diagramPlan(d: Diagram): Plan {
  return { version: 2, name: d.caption, cols: d.cols, rows: d.rows, pages: [], phases: [{ id: d.id, name: d.caption, notes: '', terrain: d.terrain, entities: d.entities, conversations: [], waymarks: d.waymarks }] };
}
/** Copies a scene (a phase's terrain and units, or any staged version of it) into a new diagram. */
export function sceneToDiagram(phase: Phase, plan: Pick<Plan, 'cols' | 'rows'>, caption: string): Diagram {
  return { id: uid('map'), caption, cols: plan.cols, rows: plan.rows, terrain: phase.terrain.map(r => r.slice()), entities: phase.entities.map(e => ({ ...e })), ...(phase.waymarks ? { waymarks: { ...phase.waymarks } } : {}) };
}
export function blankDiagram(cols: number, rows: number, caption: string): Diagram {
  return { id: uid('map'), caption, cols, rows, terrain: Array.from({ length: rows }, () => Array.from({ length: cols }, (): Terrain => 'floor')), entities: [] };
}
export type Plan = { version: 2; name: string; cols: number; rows: number; phases: Phase[]; pages: MechanicPage[] };

export const isUnit = (kind: Kind): kind is UnitKind => kind in unitTypes;
export const isMechanic = (kind: Kind): kind is MechanicKind => kind in mechanicTypes;
export const MAX_UNIT_SIZE = 5;
export const MAX_RADIUS = 40;
/** Head markers that can be put on a unit. */
export const markerTypes = {
  star: { name: 'Star', color: '#f3d15a' }, circle: { name: 'Circle', color: '#f0a35e' }, diamond: { name: 'Diamond', color: '#c78bf0' },
  triangle: { name: 'Triangle', color: '#8fd67a' }, moon: { name: 'Moon', color: '#c9d4e0' }, square: { name: 'Square', color: '#7fb2f0' },
  cross: { name: 'Cross', color: '#f07a6e' }, skull: { name: 'Skull', color: '#eef1ef' },
  one: { name: '1', color: '#6fd6c8' }, two: { name: '2', color: '#6fd6c8' }, three: { name: '3', color: '#6fd6c8' }, four: { name: '4', color: '#6fd6c8' },
};
export type MarkerKind = keyof typeof markerTypes;
/** "2.5s" style cast time, or '' when a telegraph has none. */
export const castLabel = (m: Pick<Entity, 'castTime'>) => m.castTime === undefined ? '' : `${Number(m.castTime.toFixed(1))}s`;
/** How far a telegraph reaches, in tiles: its radius, or effectively unlimited when infinite. */
export const reach = (m: Pick<Entity, 'radius' | 'infinite'>) => m.infinite ? 1000 : m.radius;
export const footprint = (e: Pick<Entity, 'kind'> & { size?: number }) => isUnit(e.kind) ? e.size ?? unitTypes[e.kind].size : 1;
export const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

export const colLabel = (i: number) => i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + i - 26);
export const tileLabel = (x: number, y: number) => `${colLabel(x)}${y + 1}`;

export function mechanicTone(e: Pick<Entity, 'kind'>) {
  if (e.kind === 'marker' || e.kind === 'stack') return tones.safe;
  if (e.kind === 'tower') return tones.soak;
  return tones.telegraph;
}

export const createLine = (speaker: string): DialogueLine => ({ id: uid('line'), speaker, text: '', options: [] });
export const createConversation = (trigger: DialogueTrigger, speaker: string): Conversation => ({ id: uid('conv'), title: '', trigger, lines: [createLine(speaker)] });
/** Every line in a phase in playing order, with the conversation it belongs to. */
export const createAction = (actor: string): ActionStep => ({ id: uid('act'), type: 'action', actor, action: { kind: 'motion', motion: '' } });
export type TimelineItem = { kind: 'conversation'; id: string; conversation: Conversation } | { kind: 'mechanic'; id: string; mechanic: Entity };

/** Conversations and telegraphs of a phase in timeline order. */
export function timelineOf(phase: Phase): TimelineItem[] {
  const items = new Map<string, TimelineItem>();
  for (const c of phase.conversations) items.set(c.id, { kind: 'conversation', id: c.id, conversation: c });
  for (const m of phase.entities) if (isMechanic(m.kind)) items.set(m.id, { kind: 'mechanic', id: m.id, mechanic: m });
  const ordered = (phase.timeline ?? []).flatMap(id => { const item = items.get(id); items.delete(id); return item ? [item] : []; });
  return [...ordered, ...items.values()];
}
/** Every spoken line and action in the phase, in timeline order. */
export const scriptOf = (phase: Phase) => timelineOf(phase).flatMap(item => item.kind === 'conversation' ? item.conversation.lines.map(step => ({ conversation: item.conversation, step })) : []);
/** What present mode steps through: each line and action, and each telegraph as it comes up in the timeline. */
export type PresentStep = { conversation: Conversation; step: ConversationStep; mechanic?: undefined } | { mechanic: Entity; conversation?: undefined; step?: undefined };
export const presentSteps = (phase: Phase): PresentStep[] => timelineOf(phase).flatMap((item): PresentStep[] =>
  item.kind === 'conversation' ? item.conversation.lines.map(step => ({ conversation: item.conversation, step })) : [{ mechanic: item.mechanic }]);
export const createPage = (title: string, kind: MechanicKind = 'circle'): MechanicPage => ({ id: uid('page'), title, kind, blocks: [textBlock()] });
/** The shape a page's new telegraphs take: that of a telegraph already linked to it, else the page's saved shape, else a circle. */
export function pageKind(plan: Plan, page: MechanicPage): MechanicKind {
  for (const phase of plan.phases) for (const e of phase.entities) if (e.page === page.id && isMechanic(e.kind)) return e.kind;
  return page.kind ?? 'circle';
}

const compassNames = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
export const compassName = (deg: number) => deg % 45 === 0 ? compassNames[deg / 45] : `${deg}°`;

/** Where an action's actor ends up facing: a fixed direction, or toward another unit (snapped to 8 directions). */
export function faceRotation(step: ActionStep, entities: Entity[]) {
  if (step.action.kind !== 'face') return undefined;
  const { toward, rotation } = step.action;
  const actor = entities.find(e => e.id === step.actor), target = toward ? entities.find(e => e.id === toward) : undefined;
  if (!actor || !target) return rotation;
  const [ax, ay] = center(actor), [tx, ty] = center(target);
  return ((Math.round(Math.atan2(tx - ax, -(ty - ay)) * 180 / Math.PI / 45) * 45) % 360 + 360) % 360;
}

/** A short description of an action, e.g. "Boss moves to F7" or "Boss turns toward Main tank". */
export function actionText(step: ActionStep, phase: Phase) {
  const name = phase.entities.find(e => e.id === step.actor)?.name ?? 'Someone';
  const a = step.action;
  if (a.kind === 'motion') return `${name} ${a.motion ? a.motion.charAt(0).toLowerCase() + a.motion.slice(1) : '…'}`;
  if (a.kind === 'move') return `${name} moves to ${tileLabel(a.x, a.y)}`;
  const target = a.toward ? phase.entities.find(e => e.id === a.toward) : undefined;
  return target ? `${name} turns toward ${target.name}` : `${name} turns to face ${compassName(a.rotation)}`;
}

/** The phase as it stands after the given actions play, in order: units moved and turned. */
export function stagePhase(phase: Phase, plan: Plan, actions: ActionStep[]): Phase {
  let entities = phase.entities;
  for (const step of actions) {
    const a = step.action;
    if (a.kind === 'motion') continue;
    const rotation = a.kind === 'face' ? faceRotation(step, entities) : undefined;
    entities = entities.map(e => e.id !== step.actor ? e : a.kind === 'move' ? clampEntity({ ...e, x: a.x, y: a.y }, plan) : { ...e, rotation: rotation ?? e.rotation });
  }
  return entities === phase.entities ? phase : { ...phase, entities };
}
export const lineCount = (phase: Phase) => presentSteps(phase).length;

/** A phase with a scene's terrain and units in place of its own; the phase's telegraphs stay. */
export function withScene(phase: Phase, scene: Scene): Phase {
  return { ...phase, terrain: scene.terrain, entities: [...scene.units, ...phase.entities.filter(e => isMechanic(e.kind))] };
}
/** The scene a phase shows: its terrain and units, copied so it can be edited on its own. */
export const sceneOf = (phase: Phase): Scene => ({ terrain: phase.terrain.map(r => r.slice()), units: phase.entities.filter(e => isUnit(e.kind)).map(e => ({ ...e })) });

/**
 * The map at the start and end of each conversation, in timeline order. A conversation starts from its own scene when
 * it has one, else from where the previous conversation ended (the phase's starting map for the first); it ends after
 * its own actions play.
 */
export function conversationScenes(phase: Phase, plan: Plan) {
  const scenes = new Map<string, { start: Phase; end: Phase }>();
  let current = phase;
  for (const item of timelineOf(phase)) {
    if (item.kind !== 'conversation') continue;
    const c = item.conversation;
    const start = c.scene ? withScene(phase, c.scene) : current;
    const end = stagePhase(start, plan, c.lines.filter(isAction));
    scenes.set(c.id, { start, end });
    current = end;
  }
  return scenes;
}

/** The map when a timeline event comes up: where the last conversation before it left off (the starting map if none). */
export function sceneBeforeEvent(phase: Phase, plan: Plan, eventId: string): Phase {
  const scenes = conversationScenes(phase, plan);
  let current = phase;
  for (const item of timelineOf(phase)) {
    if (item.id === eventId) return current;
    if (item.kind === 'conversation') current = scenes.get(item.id)?.end ?? current;
  }
  return current;
}
/** A phase showing only its units and the given telegraphs: each telegraph appears only at its own point in the timeline. */
export const withTelegraphs = (phase: Phase, ids: string[]): Phase =>
  ({ ...phase, entities: phase.entities.filter(e => isUnit(e.kind) || ids.includes(e.id)) });

/** The map at a step of a conversation: its start, with the conversation's earlier actions played. */
export function sceneAtStep(phase: Phase, plan: Plan, conversationId: string, stepId: string | null) {
  const c = phase.conversations.find(x => x.id === conversationId);
  const start = conversationScenes(phase, plan).get(conversationId)?.start ?? phase;
  if (!c) return start;
  const index = stepId ? c.lines.findIndex(l => l.id === stepId) : 0;
  return stagePhase(start, plan, c.lines.slice(0, Math.max(0, index)).filter(isAction));
}

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


/** Center of an entity in tile units (tile edges are integers). */
export function center(e: Entity): [number, number] {
  const s = footprint(e);
  return [e.x + s / 2, e.y + s / 2];
}

export function mechanicOrigin(m: Entity, entities: Entity[]): { point: [number, number]; anchor?: Entity } {
  const anchor = m.anchor ? entities.find(e => e.id === m.anchor && isUnit(e.kind)) : undefined;
  return anchor ? { point: center(anchor), anchor } : { point: center(m) };
}

/**
 * The segments a line telegraph covers, from its origin, each its full length: one toward each of its targets when it
 * has any (so it can pass through them), else one along its facing. Directions are unit vectors in tile space.
 */
export function lineSegments(m: Entity, entities: Entity[]): { dir: [number, number]; length: number }[] {
  const [ox, oy] = mechanicOrigin(m, entities).point;
  const targets = (m.targets ?? []).flatMap(id => { const u = entities.find(e => e.id === id && isUnit(e.kind)); return u ? [center(u)] : []; });
  if (targets.length) return targets.flatMap(([tx, ty]) => {
    const len = Math.hypot(tx - ox, ty - oy);
    return len > 0.01 ? [{ dir: [(tx - ox) / len, (ty - oy) / len] as [number, number], length: reach(m) }] : [];
  });
  const a = (mechanicFacing(m, entities) * Math.PI) / 180;
  return [{ dir: [Math.sin(a), -Math.cos(a)], length: reach(m) }];
}
/** A line with targets aims itself at them; only its facing comes from the targets. */
export const aimedAtTargets = (m: Entity, entities: Entity[]) => m.kind === 'line' && (m.targets ?? []).some(id => entities.some(e => e.id === id && isUnit(e.kind)));

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
  // A tile is in a cone when its center is within half the spread of the facing (plus a degree of slack for edges).
  const halfAngle = Math.cos((Math.min(180, (m.angle ?? 90) / 2 + 1) * Math.PI) / 180);
  const inAnchor = (x: number, y: number) => !!anchor && x >= anchor.x && x < anchor.x + footprint(anchor) && y >= anchor.y && y < anchor.y + footprint(anchor);
  const r = reach(m);
  const segments = m.kind === 'line' ? lineSegments(m, phase.entities) : [];
  const safeZones = m.kind === 'armageddon' ? phase.entities.filter(e => e.kind === 'marker').map(s => ({ c: mechanicOrigin(s, phase.entities).point, r: s.radius })) : [];
  const tiles: [number, number, number][] = [];
  for (let y = 0; y < plan.rows; y++) for (let x = 0; x < plan.cols; x++) {
    if (terrainTypes[phase.terrain[y][x]].blocks) continue;
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
    let strength = 1;
    switch (m.kind) {
      case 'cone':
        if (inAnchor(x, y) || d < 0.3 || d > r + 0.2 || (dx * dir[0] + dy * dir[1]) / d < halfAngle) continue;
        break;
      case 'line': {
        if (inAnchor(x, y)) continue;
        const half = (m.width ?? 1) / 2 + 0.01;
        const onSegment = segments.some(({ dir: [ux, uy], length }) => {
          const along = dx * ux + dy * uy, across = Math.abs(dx * uy - dy * ux);
          return along >= -0.01 && along <= length + 0.2 && across <= half;
        });
        if (!onSegment) continue;
        break;
      }
      case 'donut':
        if (d > r || d <= (m.inner ?? 1)) continue;
        break;
      case 'flare':
        if (d > r) continue;
        strength = m.infinite ? 1 : Math.max(0.25, 1 - d / (r + 0.5));
        break;
      case 'armageddon':
        if (safeZones.some(s => Math.hypot(x + 0.5 - s.c[0], y + 0.5 - s.c[1]) <= s.r)) continue;
        break;
      default:
        if (d > r) continue;
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
    circle: { name: 'Impact', radius: 2, rotation: 0 },
    cone: { name: 'Cleave', radius: 3, rotation: 180 },
    line: { name: 'Charge', radius: 6, rotation: 180, width: 1 },
    donut: { name: 'Donut', radius: 4, rotation: 0, inner: 1.5 },
    flare: { name: 'Flare', radius: 5, rotation: 0 },
    stack: { name: 'Stack', radius: 1.5, rotation: 0 },
    spread: { name: 'Spread', radius: 1.5, rotation: 0 },
    tower: { name: 'Tower', radius: 1, rotation: 0, soak: 2 },
    knockback: { name: 'Knockback', radius: 3, rotation: 0, push: 2 },
    armageddon: { name: 'Armageddon', radius: 1, rotation: 0 },
    marker: { name: 'Safe zone', radius: 1.5, rotation: 0 },
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
  const unit = (id: string, kind: UnitKind, name: string, code: string, x: number, y: number): Entity => ({ id, kind, name, code, x, y, radius: 1, rotation: 0 });
  const roster = (pos: Record<string, [number, number]>) => [
    unit('boss', 'boss', 'Obsidian Sentinel', 'BOSS', ...pos.boss),
    unit('mt', 'tank', 'Main tank', 'MT', ...pos.mt), unit('ot', 'tank', 'Off tank', 'OT', ...pos.ot),
    unit('h1', 'healer', 'Healer 1', 'H1', ...pos.h1), unit('h2', 'healer', 'Healer 2', 'H2', ...pos.h2),
    unit('d1', 'dps', 'DPS 1', 'D1', ...pos.d1), unit('d2', 'dps', 'DPS 2', 'D2', ...pos.d2),
    unit('d3', 'dps', 'DPS 3', 'D3', ...pos.d3), unit('d4', 'dps', 'DPS 4', 'D4', ...pos.d4),
  ];
  const mech = (id: string, kind: MechanicKind, name: string, x: number, y: number, radius: number, rotation: number, anchor?: string): Entity =>
    ({ id, kind, name, code: '', x, y, radius, rotation, ...(anchor ? { anchor } : {}) });
  const scorched = baseTerrain(cols, rows).map((row, y) => row.map((t, x): Terrain => x >= 8 && x <= 11 && y >= 8 && y <= 9 ? 'lava' : t));
  return { version: 2, name: 'The Obsidian Sanctum', cols, rows, pages: [
    { id: 'page-cleave', title: 'Frontal cleave', kind: 'cone', blocks: [{ id: 'text-cleave', type: 'text', text: 'The Sentinel swings at whoever is in front of it.\n\nThe main tank holds it facing away from the raid. Everyone else stays out of the cone.' }] },
  ], phases: [
    { id: 'opening', name: 'The opening move', terrain: baseTerrain(cols, rows),
      notes: 'Tank holds the Sentinel facing north.\n\nSpread DPS on the flanks. Keep healers at the back, outside the impact zone.\n\nSave movement skills for the first cleave.',
      entities: [
        ...roster({ boss: [9, 3], mt: [9, 6], ot: [11, 6], h1: [6, 11], h2: [13, 11], d1: [7, 8], d2: [12, 8], d3: [8, 10], d4: [11, 10] }),
        { ...mech('cleave', 'cone', 'Frontal cleave', 9, 3, 4, 180, 'boss'), page: 'page-cleave', trigger: { type: 'time', seconds: 10 } },
        mech('impact', 'circle', 'Obsidian impact', 13, 8, 1.6, 0),
      ],
      conversations: [{ id: 'conv-wake', title: 'Awakening', trigger: { type: 'time', seconds: 0 }, lines: [
        { id: 'line-wake', speaker: 'Obsidian Sentinel', text: 'Who dares wake the Sanctum?', options: [] },
      ] }] },
    { id: 'shatter', name: 'Shattered ground', terrain: scorched,
      notes: 'Spread out for the impact. Move to the outer tiles and keep the center clear.',
      entities: [
        ...roster({ boss: [9, 3], mt: [9, 6], ot: [11, 6], h1: [4, 11], h2: [15, 11], d1: [4, 7], d2: [15, 7], d3: [7, 12], d4: [12, 12] }),
        mech('shatter-1', 'circle', 'Shatter', 9, 8, 2.6, 0),
        mech('debris', 'circle', 'Falling debris', 6, 3, 1.6, 0),
      ],
      conversations: [] },
    { id: 'stand', name: 'The final stand', terrain: baseTerrain(cols, rows),
      notes: 'Regroup at the center. Use defensive cooldowns and finish the Sentinel.',
      entities: [
        ...roster({ boss: [9, 5], mt: [9, 7], ot: [11, 7], h1: [8, 11], h2: [11, 11], d1: [9, 10], d2: [10, 10], d3: [9, 11], d4: [10, 11] }),
        { ...mech('cleave-2', 'cone', 'Frontal cleave', 9, 5, 3, 180, 'boss'), page: 'page-cleave', trigger: { type: 'hp', percent: 25, target: 'boss' } },
        mech('stack', 'stack', 'Stack', 9, 10, 1.6, 0),
      ],
      conversations: [{ id: 'conv-offer', title: 'The offer', trigger: { type: 'hp', percent: 30, target: 'boss' }, lines: [{ id: 'line-offer', speaker: 'Obsidian Sentinel', text: 'Kneel, and I will let the rest of you leave.', options: [
        { id: 'opt-refuse', text: 'Refuse', outcome: 'The Sentinel enrages. Finish it before the stack point collapses.' },
        { id: 'opt-kneel', text: 'Kneel', outcome: 'The Sentinel strikes the kneeling player. Healers spot-heal them next turn.' },
      ] }] }] },
  ] };
}

/** Upgrades a version 1 plan (shared terrain, no countdowns) to the current shape. */
export function migratePlan(value: unknown): unknown {
  const p = value as { version?: number; terrain?: unknown; pages?: unknown; phases?: { entities?: Record<string, unknown>[]; dialogue?: unknown; conversations?: unknown }[] };
  if (!p || typeof p !== 'object' || !Array.isArray(p.phases)) return value;
  if (p.version === 2) {
    const clean = Array.isArray(p.pages) && (p.pages as Record<string, unknown>[]).every(g => g && Array.isArray(g.blocks)) && p.phases.every(f => f && Array.isArray(f.conversations) && !('turns' in f) && !(f.entities ?? []).some(e => e && 'turns' in e));
    // Plans from before mechanic pages start with none.
    return clean ? value : { ...p, pages: Array.isArray(p.pages) ? (p.pages as Record<string, unknown>[]).map(toBlocks) : [], phases: p.phases.map(f => f && withoutTurns(Array.isArray(f.conversations) ? f : toConversations(f))) };
  }
  if (p.version !== 1) return value;
  return {
    ...p, version: 2, terrain: undefined, pages: [],
    phases: p.phases.map(f => withoutTurns({ ...f, terrain: p.terrain, conversations: [], entities: Array.isArray(f.entities) ? f.entities.map(e => ({ code: '', ...e })) : f.entities })),
  };
}

/** Pages from before blocks had one description and a list of maps; they become a text block followed by map blocks. */
function toBlocks(page: Record<string, unknown>) {
  if (!page || Array.isArray(page.blocks)) return page;
  const { description, diagrams, ...rest } = page as { description?: unknown; diagrams?: unknown };
  const blocks: PageBlock[] = [
    ...(typeof description === 'string' && description ? [{ id: uid('text'), type: 'text' as const, text: description }] : []),
    ...(Array.isArray(diagrams) ? (diagrams as Diagram[]).map(d => ({ ...d, type: 'map' as const })) : []),
  ];
  return { ...rest, blocks };
}

/** The game runs in real time: phase lengths and mechanic countdowns in turns from older plans are dropped. */
function withoutTurns<F extends { entities?: Record<string, unknown>[] }>(phase: F) {
  const { turns: _turns, ...rest } = phase as F & { turns?: unknown };
  return { ...rest, entities: Array.isArray(phase.entities) ? phase.entities.map(e => { const { turns: _t, ...entity } = e; return entity; }) : phase.entities };
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
  const validAction = (s: ActionStep) => typeof s.actor === 'string' && !!s.action && (
    (s.action.kind === 'motion' && typeof s.action.motion === 'string' && s.action.motion.length <= 120) ||
    (s.action.kind === 'face' && int(s.action.rotation, 0, 359) && (s.action.toward === undefined || typeof s.action.toward === 'string')) ||
    (s.action.kind === 'move' && int(s.action.x, 0, p.cols - 1) && int(s.action.y, 0, p.rows - 1)));
  /** Terrain grid and units/telegraphs for a map of the given size: a phase, or a diagram on a mechanic page. */
  const validScene = (terrain: Terrain[][], entities: Entity[], cols: number, rows: number) =>
    Array.isArray(terrain) && terrain.length === rows && terrain.every(row => Array.isArray(row) && row.length === cols && row.every(t => Object.hasOwn(terrainTypes, t))) &&
    Array.isArray(entities) && entities.length <= 500 && new Set(entities.map(e => e?.id)).size === entities.length &&
    entities.every(e => e && typeof e.id === 'string' && typeof e.name === 'string' && e.name.length <= 120 && typeof e.code === 'string' && e.code.length <= 6 &&
      (Object.hasOwn(unitTypes, e.kind) || Object.hasOwn(mechanicTypes, e.kind)) &&
      int(e.x, 0, cols - footprint(e)) && int(e.y, 0, rows - footprint(e)) &&
      Number.isFinite(e.radius) && e.radius >= 1 && e.radius <= MAX_RADIUS && (e.infinite === undefined || typeof e.infinite === 'boolean') && Number.isFinite(e.rotation) && e.rotation >= 0 && e.rotation < 360 &&
      num(e.inner, 0.5, MAX_RADIUS - 0.5) && num(e.angle, 10, 360) && num(e.castTime, 0, 600) && (e.image === undefined || (typeof e.image === 'string' && e.image.length <= 80)) && (e.marker === undefined || Object.hasOwn(markerTypes, e.marker)) && (e.targets === undefined || (Array.isArray(e.targets) && e.targets.length <= 60 && e.targets.every(t => typeof t === 'string'))) && num(e.width, 1, 8) && num(e.push, 1, 10) && (e.soak === undefined || int(e.soak, 1, 8)) && (e.size === undefined || int(e.size, 1, MAX_UNIT_SIZE)) &&
      (e.anchor === undefined || typeof e.anchor === 'string') && (e.followFacing === undefined || typeof e.followFacing === 'boolean') && (e.trigger === undefined || validTrigger(e.trigger)) && (e.page === undefined || typeof e.page === 'string'));
  const validWaymarks = (w: Waymarks | undefined, cols: number, rows: number) => w === undefined || (!!w && typeof w === 'object' && !Array.isArray(w) &&
    Object.entries(w).every(([k, v]) => Object.hasOwn(waymarkTypes, k) && Array.isArray(v) && v.length === 2 && int(v[0], 0, cols - 1) && int(v[1], 0, rows - 1)));
  const num = (n: unknown, min: number, max: number) => n === undefined || (typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max);
  return p.version === 2 && typeof p.name === 'string' && p.name.length <= 120 && int(p.cols, 8, 30) && int(p.rows, 8, 30) &&
    Array.isArray(p.pages) && p.pages.length <= 200 && new Set(p.pages.map(g => g?.id)).size === p.pages.length &&
    p.pages.every(g => g && typeof g.id === 'string' && typeof g.title === 'string' && g.title.length <= 120 && (g.kind === undefined || Object.hasOwn(mechanicTypes, g.kind)) &&
      Array.isArray(g.blocks) && g.blocks.length <= 80 && new Set(g.blocks.map(b => b?.id)).size === g.blocks.length &&
      g.blocks.every(b => b && typeof b.id === 'string' && (
        (b.type === 'text' && typeof b.text === 'string' && b.text.length <= 20000) ||
        (b.type === 'map' && typeof b.caption === 'string' && b.caption.length <= 200 && int(b.cols, 8, 30) && int(b.rows, 8, 30) && validScene(b.terrain, b.entities, b.cols, b.rows) && validWaymarks(b.waymarks, b.cols, b.rows))))) &&
    Array.isArray(p.phases) && p.phases.length > 0 && p.phases.length <= 30 && new Set(p.phases.map(f => f?.id)).size === p.phases.length &&
    p.phases.every(f => f && typeof f.id === 'string' && typeof f.name === 'string' && f.name.length <= 120 && typeof f.notes === 'string' && f.notes.length <= 10000 &&
      (f.timeline === undefined || (Array.isArray(f.timeline) && f.timeline.length <= 1000 && f.timeline.every(id => typeof id === 'string'))) &&
      validScene(f.terrain, f.entities, p.cols, p.rows) && validWaymarks(f.waymarks, p.cols, p.rows) &&
      Array.isArray(f.conversations) && f.conversations.length <= 100 && new Set(f.conversations.map(c => c?.id)).size === f.conversations.length &&
      f.conversations.every(c => c && typeof c.id === 'string' && typeof c.title === 'string' && c.title.length <= 120 && validTrigger(c.trigger) &&
        (c.scene === undefined || (!!c.scene && validScene(c.scene.terrain, c.scene.units, p.cols, p.rows) && c.scene.units.every(u => isUnit(u.kind)))) &&
        Array.isArray(c.lines) && c.lines.length <= 200 && new Set(c.lines.map(l => l?.id)).size === c.lines.length &&
      c.lines.every(l => l && typeof l.id === 'string' && (isAction(l) ? validAction(l) : typeof l.speaker === 'string' && l.speaker.length <= 60 &&
        typeof l.text === 'string' && l.text.length <= 2000 && Array.isArray(l.options) && l.options.length <= 6 &&
        (l.placement === undefined || l.placement === 'unit' || l.placement === 'top') &&
        l.options.every(o => o && typeof o.id === 'string' && typeof o.text === 'string' && o.text.length <= 200 &&
          typeof o.outcome === 'string' && o.outcome.length <= 1000 && (o.goto === undefined || typeof o.goto === 'string'))))));
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
      waymarks: p.waymarks && Object.fromEntries(Object.entries(p.waymarks).map(([k, [x, y]]) => [k, [Math.max(0, Math.min(cols - 1, x + dx)), Math.max(0, Math.min(rows - 1, y + dy))]])),
      // Conversation maps and move destinations shift with the map and stay inside it.
      conversations: p.conversations.map(c => ({ ...c,
        ...(c.scene ? { scene: {
          terrain: Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => c.scene!.terrain[y - dy]?.[x - dx] ?? fill)),
          units: c.scene.units.map(e => clampEntity({ ...e, x: e.x + dx, y: e.y + dy }, next)),
        } } : {}),
        lines: c.lines.map(l => isAction(l) && l.action.kind === 'move'
        ? { ...l, action: { ...l.action, x: Math.max(0, Math.min(cols - 1, l.action.x + dx)), y: Math.max(0, Math.min(rows - 1, l.action.y + dy)) } } : l) })),
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
