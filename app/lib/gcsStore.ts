import { Storage } from '@google-cloud/storage';
import { migratePlan, validatePlan, type Plan } from '../plan';

/**
 * Server-only encounter storage in Google Cloud Storage. Each encounter gets its own directory,
 * gs://<bucket>/<prefix>/<encounter id>/, holding plan.json. Summary fields ride along as object metadata so the
 * library can be listed without downloading every plan. Credentials come from Application Default Credentials.
 */
const BUCKET = process.env.RAIDPLANS_BUCKET ?? 'realtime-tactics';
const PREFIX = (process.env.RAIDPLANS_PREFIX ?? 'raidplans').replace(/^\/+|\/+$/g, '');

let storage: Storage | null = null;
const bucket = () => (storage ??= new Storage()).bucket(BUCKET);

export type StoredEncounter = { id: string; name: string; updatedAt: number; phases: number; cols: number; rows: number };

/** Encounter ids become directory names, so only a strict lowercase slug is allowed. */
export const validId = (id: string) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(id);
const planPath = (id: string) => `${PREFIX}/${id}/plan.json`;

export const location = (id?: string) => `gs://${BUCKET}/${PREFIX}/${id ? `${id}/` : ''}`;

export async function listStored(): Promise<StoredEncounter[]> {
  const [files] = await bucket().getFiles({ prefix: `${PREFIX}/`, matchGlob: `${PREFIX}/*/plan.json` });
  return files.map(f => {
    const meta = (f.metadata.metadata ?? {}) as Record<string, string>;
    return {
      id: f.name.slice(PREFIX.length + 1, -'/plan.json'.length),
      name: meta.name ? decodeURIComponent(meta.name) : 'Untitled encounter',
      updatedAt: Date.parse(String(f.metadata.updated ?? '')) || 0,
      phases: Number(meta.phases) || 1, cols: Number(meta.cols) || 0, rows: Number(meta.rows) || 0,
    };
  }).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function readStored(id: string): Promise<Plan | null> {
  const file = bucket().file(planPath(id));
  const [exists] = await file.exists();
  if (!exists) return null;
  const [data] = await file.download();
  const plan = migratePlan(JSON.parse(data.toString('utf8')));
  return validatePlan(plan) ? plan : null;
}

export async function writeStored(id: string, plan: Plan) {
  await bucket().file(planPath(id)).save(JSON.stringify(plan), {
    resumable: false,
    contentType: 'application/json',
    metadata: {
      cacheControl: 'no-store',
      metadata: { name: encodeURIComponent(plan.name), phases: String(plan.phases.length), cols: String(plan.cols), rows: String(plan.rows) },
    },
  });
}

/** Removes the encounter's whole directory, and nothing outside it. */
export async function deleteStored(id: string) {
  if (!validId(id)) throw new Error('invalid id');
  await bucket().deleteFiles({ prefix: `${PREFIX}/${id}/` });
}
