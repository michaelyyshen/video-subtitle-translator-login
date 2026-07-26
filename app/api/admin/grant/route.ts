import type { NextRequest } from 'next/server';
import { forwardToEdge } from '../_proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface GrantBody {
  userId?: string;
  email?: string;
  days?: number;
  plan?: 'monthly' | 'yearly';
}

export async function POST(req: NextRequest) {
  let body: GrantBody;
  try {
    body = (await req.json()) as GrantBody;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body', code: 'bad_request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  }
  return forwardToEdge(req, { method: 'POST', path: '/grant', body });
}
