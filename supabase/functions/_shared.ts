// Shared helpers for Supabase Edge Functions. Loaded via the Supabase
// functions import map (https://esm.sh/@supabase/functions-js).
// Kept tiny to avoid runtime overhead.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export function getServiceClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export function getUserClient(request) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !key) {
    throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY missing');
  }
  const authHeader = request.headers.get('Authorization') ?? '';
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } }
  });
}

export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  });
}

export function errorResponse(error, status = 400, code = 'error') {
  return jsonResponse({ error, code }, status);
}

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
  };
}
