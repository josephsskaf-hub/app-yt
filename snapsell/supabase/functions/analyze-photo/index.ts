// Supabase Edge Function: analyze-photo
// Receives a base64 image, calls OpenAI Vision, and returns a draft listing.
//
// Deploy:
//   supabase functions deploy analyze-photo --no-verify-jwt
// Set secret:
//   supabase secrets set OPENAI_API_KEY=sk-...

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const SYSTEM = `You are a US marketplace listing assistant. Given a single product photo, return a JSON object with:
- title: short attention-grabbing listing title (max 80 chars)
- description: 3-5 sentence description, factual and benefit-focused
- category: one of "Cars", "Real Estate", "Electronics", "Furniture", "Services", "Other"
- suggested_price: integer USD, a reasonable used-market price; if unsure, give a conservative estimate
- confidence: 0..1
Return STRICT JSON only.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not set' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    const { image } = await req.json();
    if (!image || typeof image !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing image (data URL)' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        max_tokens: 600,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: [
            { type: 'text', text: 'Analyze this item photo and produce the listing JSON.' },
            { type: 'image_url', image_url: { url: image, detail: 'low' } }
          ]}
        ]
      })
    });
    if (!r.ok) {
      const txt = await r.text();
      return new Response(JSON.stringify({ error: 'OpenAI error', detail: txt }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    const j = await r.json();
    const content = j.choices?.[0]?.message?.content || '{}';
    let parsed;
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    return new Response(JSON.stringify(parsed), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
