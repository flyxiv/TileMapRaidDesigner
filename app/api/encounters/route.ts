import { NextResponse } from 'next/server';
import { listStored, location } from '../../lib/gcsStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ encounters: await listStored(), location: location() });
  } catch (e) {
    return NextResponse.json({ error: `Could not list encounters in ${location()}: ${(e as Error).message}` }, { status: 502 });
  }
}
