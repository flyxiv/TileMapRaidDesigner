import { center, footprint, isUnit, unitTypes, type Entity, type UnitKind } from '../plan';

export type Speech = { speaker: string; text: string; turnLabel: string; options: string[]; picked?: number };

/** Greedy word wrap by an estimated character width; long words are split. */
function wrap(text: string, maxChars: number, maxLines: number) {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (let word of para.split(/\s+/).filter(Boolean)) {
      while (word.length > maxChars) { if (line) { lines.push(line); line = ''; } lines.push(word.slice(0, maxChars)); word = word.slice(maxChars); }
      if (!line) line = word;
      else if (line.length + 1 + word.length <= maxChars) line += ' ' + word;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
  }
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, '…'); }
  return lines;
}

const CHAR = 6.1, LINE = 16, OPTION = 22, PAD = 12;

/**
 * A dialogue bubble drawn in map pixels (origin at the top-left tile). It points at the speaker's token when a unit
 * with that name is on the map, and otherwise sits as a narrator banner along the top edge.
 */
export function SpeechBubble({ speech, units, C, mapWidth, gutter }: { speech: Speech; units: Entity[]; C: number; mapWidth: number; gutter: number }) {
  const unit = units.find(u => isUnit(u.kind) && u.name === speech.speaker);
  const color = unit ? unitTypes[unit.kind as UnitKind].color : '#c9d0cd';
  const maxChars = 36;
  const text = wrap(speech.text || '…', maxChars, 5);
  const options = speech.options.map(o => wrap(o || 'Untitled choice', maxChars - 4, 1)[0]);
  const longest = Math.max((speech.speaker || 'Narrator').length + speech.turnLabel.length + 4, ...text.map(l => l.length), ...options.map(o => o.length + 4));
  const w = Math.min(maxChars * CHAR + PAD * 2, Math.max(140, longest * CHAR + PAD * 2));
  const h = PAD + 16 + text.length * LINE + (options.length ? 6 + options.length * OPTION : 0) + PAD - 4;

  let ax: number, ay: number, below = false;
  if (unit) {
    const [cx, cy] = center(unit).map(v => v * C);
    const half = (footprint(unit) * C) / 2;
    // Large tokens carry a name tag above them; clear it.
    ax = cx; ay = cy - half - 6 - (footprint(unit) > 1 && C >= 22 ? 24 : 0);
    // Flip under the token when there is no room above it.
    if (ay - h - 8 < -gutter) { below = true; ay = cy + half + 6; }
  } else {
    ax = mapWidth / 2; ay = 8 + h + 8; // banner hangs from the top edge, tail hidden
  }
  const x = Math.max(-gutter, Math.min(mapWidth - w + gutter, ax - w / 2));
  const y = below ? ay + 8 : ay - 8 - h;
  const tx = Math.max(x + 14, Math.min(x + w - 14, ax));
  const tail = below ? `M${tx - 7} ${y + 0.5} L${tx} ${y - 8} L${tx + 7} ${y + 0.5} Z` : `M${tx - 7} ${y + h - 0.5} L${tx} ${y + h + 8} L${tx + 7} ${y + h - 0.5} Z`;

  return (
    <g pointerEvents="none" className="speech">
      <rect x={x} y={y + 3} width={w} height={h} rx="9" fill="rgba(0,0,0,0.45)" />
      {unit && <path d={tail} fill="#101415" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />}
      <rect x={x} y={y} width={w} height={h} rx="9" fill="#101415" stroke={color} strokeWidth="1.5" />
      {unit && <path d={below ? `M${tx - 6} ${y + 1.5} L${tx + 6} ${y + 1.5}` : `M${tx - 6} ${y + h - 1.5} L${tx + 6} ${y + h - 1.5}`} stroke="#101415" strokeWidth="3" />}
      <text x={x + PAD} y={y + PAD + 7} fontSize="11" fontWeight="700" fill={color} dominantBaseline="central">{speech.speaker || 'Narrator'}</text>
      <text x={x + w - PAD} y={y + PAD + 7} fontSize="9" fontWeight="700" fill="#7f8c85" textAnchor="end" dominantBaseline="central" letterSpacing="0.6">{speech.turnLabel}</text>
      {text.map((l, i) => (
        <text key={i} x={x + PAD} y={y + PAD + 16 + i * LINE + LINE / 2} fontSize="12" fontStyle="italic" fill="#e3e7e5" dominantBaseline="central">{l}</text>
      ))}
      {options.map((o, i) => {
        const oy = y + PAD + 16 + text.length * LINE + 6 + i * OPTION, picked = speech.picked === i;
        return (
          <g key={i}>
            <rect x={x + PAD - 4} y={oy} width={w - PAD * 2 + 8} height={OPTION - 4} rx="4" fill={picked ? '#303a29' : '#1b2122'} stroke={picked ? '#c6eb95' : '#2f3637'} />
            <text x={x + PAD + 6} y={oy + (OPTION - 4) / 2} fontSize="10" fontWeight="700" fill="#c6eb95" textAnchor="middle" dominantBaseline="central">{String.fromCharCode(65 + i)}</text>
            <text x={x + PAD + 16} y={oy + (OPTION - 4) / 2} fontSize="11" fontWeight="600" fill={picked ? '#c6eb95' : '#c9d0cd'} dominantBaseline="central">{o}</text>
          </g>
        );
      })}
    </g>
  );
}
