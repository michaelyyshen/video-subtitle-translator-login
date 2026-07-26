import type { NextRequest } from 'next/server';
import { forwardToEdge } from '../../_proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)) {
    return new Response(JSON.stringify({ error: 'Invalid user id', code: 'bad_request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  }
  return forwardToEdge(req, { method: 'GET', path: `/users/${params.id}` });
}
