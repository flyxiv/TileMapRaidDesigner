import { NextResponse } from 'next/server';
import { migratePlan, validatePlan } from '../../../plan';
import { deleteStored, location, readStored, validId, writeStored } from '../../../lib/gcsStore';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
const fail = (status: number, error: string) => NextResponse.json({ error }, { status });
const storageError = (id: string, e: unknown) => fail(502, `Storage error at ${location(id)}: ${(e as Error).message}`);

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!validId(id)) return fail(400, 'Invalid encounter id');
  try {
    const plan = await readStored(id);
    return plan ? NextResponse.json(plan) : fail(404, 'Encounter not found');
  } catch (e) { return storageError(id, e); }
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!validId(id)) return fail(400, 'Invalid encounter id');
  let plan: unknown;
  try { plan = migratePlan(await req.json()); } catch { return fail(400, 'Body is not JSON'); }
  if (!validatePlan(plan)) return fail(422, 'Not a valid raid plan');
  try {
    await writeStored(id, plan);
    return NextResponse.json({ ok: true, location: location(id) });
  } catch (e) { return storageError(id, e); }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!validId(id)) return fail(400, 'Invalid encounter id');
  try {
    await deleteStored(id);
    return NextResponse.json({ ok: true });
  } catch (e) { return storageError(id, e); }
}
