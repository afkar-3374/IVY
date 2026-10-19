// Issues short-lived Cloudflare TURN relay credentials to the two partners only.
// Secrets: CF_TURN_KEY_ID, CF_TURN_API_TOKEN (supabase secrets set ...)
import { createClient } from 'npm:@supabase/supabase-js@2';

const TTL_SECONDS = 6 * 60 * 60;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  // Only signed-in partners (the JWT is verified by the platform; membership checked here)
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: isMember } = await supabase.rpc('is_member');
  if (!isMember) return json({ error: 'forbidden' }, 403);

  const keyId = Deno.env.get('CF_TURN_KEY_ID');
  const token = Deno.env.get('CF_TURN_API_TOKEN');
  if (!keyId || !token) return json({ iceServers: [], ttl: TTL_SECONDS });

  const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl: TTL_SECONDS }),
  });
  if (!res.ok) return json({ error: `turn provider ${res.status}` }, 502);
  const data = await res.json();
  const iceServers = Array.isArray(data.iceServers) ? data.iceServers : [data.iceServers];
  return json({ iceServers, ttl: TTL_SECONDS });
});
