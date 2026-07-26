import type { NextRequest } from 'next/server';
import { forwardToEdge } from '../_proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const path = `/users?${params.toString()}`;
  return forwardToEdge(req, { method: 'GET', path });
}
