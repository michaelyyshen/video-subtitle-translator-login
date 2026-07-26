// translate Edge Function.
//
// Authenticated proxy that enforces a paid entitlement on every request.
// The user-supplied apiKey is no longer used at runtime; the extension
// calls this function with the user's Supabase JWT and the server holds
// the MiniMax provider key in the PROVIDER_API_KEY secret.
//
// Request body: { text: string, targetLang: string, sourceLang?: string }
// Response: { translation: string }
//
// NOTE: The translate Edge Function has Verify JWT enabled by default in
// supabase/config.toml, so we can trust the Authorization header here.

import { getServiceClient, errorResponse, jsonResponse } from '../_shared.ts';

interface TranslateRequest {
  text?: string;
  targetLang?: string;
  sourceLang?: string;
}

const TARGET_LANG_INSTRUCTIONS = {
  'Traditional Chinese':
    'Traditional Chinese (繁體中文), using standard written Mandarin grammar ' +
    'and vocabulary with traditional characters. Do NOT use Cantonese colloquial ' +
    'vocabulary or Cantonese grammar.',
  'Cantonese':
    'Cantonese (粵語), written the way Cantonese is actually spoken/written in ' +
    'Hong Kong — use Cantonese vocabulary and grammar (not standard Mandarin phrasing), ' +
    'in traditional characters.'
};

function targetLangInstruction(targetLang) {
  return TARGET_LANG_INSTRUCTIONS[targetLang] || targetLang;
}

function cleanTranslationContent(value) {
  let content = String(value || '').trim();
  if (!content) return null;

  const resultMatch = content.match(/<result>([\s\S]*?)<\/result>/i);
  if (resultMatch?.[1]?.trim()) content = resultMatch[1];

  if (
    /<(?:think|思考|analysis)>/i.test(content) &&
    !/<\/(?:think|思考|analysis)>/i.test(content)
  ) {
    return null;
  }

  content = content
    .replace(/<\/?result>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/```(?:[a-z]+)?\s*([\s\S]*?)```/gi, '$1')
    .replace(/^[\s"'`]+|[\s"'`]+$/g, '')
    .trim();

  return content || null;
}

async function isEntitled(userId) {
  const admin = getServiceClient();
  const { data, error } = await admin
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return false;
  if (data.status !== 'active' && data.status !== 'trialing') return false;
  if (data.current_period_end && new Date(data.current_period_end) < new Date()) return false;
  return true;
}

async function callProvider(text, targetLang, sourceLang, apiKey, endpoint) {
  const systemPrompt =
    'You are a professional translator specializing in video subtitles.\n' +
    'Translate the following subtitle to ' + targetLangInstruction(targetLang) + '.\n' +
    'Rules:\n' +
    '1. Preserve the natural tone and meaning\n' +
    '2. Keep the translation concise and readable\n' +
    '3. Output ONLY the translated subtitle text — no explanations, no thinking, no tags';

  const body = JSON.stringify({
    model: 'MiniMax-M3',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ],
    temperature: 0.3,
    max_tokens: 500,
    reasoning_split: true
  });

  const MAX_ATTEMPTS = 3;
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const delay = attempt === 1 ? 600 : 400 * attempt;
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey
        },
        body
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error('API error ' + resp.status + ': ' + text);
      }
      const data = await resp.json();
      const message = data.choices?.[0]?.message || {};
      let content = message.content || '';
      if (!content.trim() && message.reasoning_content) {
        // Reasoning_content carries an internal block; strip it and use whatever
        // came after the closing tag. For server-side use we don't try to fall
        // back to anything else — simply retry.
      }
      const cleaned = cleanTranslationContent(content);
      if (cleaned) return cleaned;
      lastError = new Error('API returned empty content');
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Translation failed');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, 'method');
  }

  // Verify JWT is enabled in supabase/config.toml, so the user client gets
  // a valid auth context here.
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return errorResponse('Missing authorization', 401, 'unauthorized');
  }

  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.0');
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } }
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return errorResponse('Invalid session', 401, 'unauthorized');
  }
  const userId = userData.user.id;

  let body: TranslateRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, 'bad_request');
  }
  const text = (body.text || '').trim();
  const targetLang = (body.targetLang || '').trim();
  if (!text || !targetLang) {
    return errorResponse('text and targetLang are required', 400, 'bad_request');
  }

  const entitled = await isEntitled(userId);
  if (!entitled) {
    return errorResponse('Active subscription required', 403, 'entitlement');
  }

  const apiKey = Deno.env.get('PROVIDER_API_KEY');
  const endpoint = Deno.env.get('PROVIDER_API_ENDPOINT') || 'https://zhi-api.com/v1/chat/completions';
  if (!apiKey) {
    return errorResponse('Server provider key not configured', 500, 'server_misconfigured');
  }

  try {
    const translation = await callProvider(text, targetLang, body.sourceLang || 'auto', apiKey, endpoint);
    return jsonResponse({ translation });
  } catch (err) {
    return errorResponse(String(err?.message || err), 502, 'provider_error');
  }
});
