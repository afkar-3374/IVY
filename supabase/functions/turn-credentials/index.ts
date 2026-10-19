// Hands the TURN relay login to the two partners only, so it never ships in the website code.
// Secrets: TURN_HOST (e.g. relay1.expressturn.com:3478), TURN_USERNAME, TURN_PASSWORD
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

  const host = Deno.env.get('TURN_HOST')?.replace(/^turns?:/, '');
  const username = Deno.env.get('TURN_USERNAME');
  const credential = Deno.env.get('TURN_PASSWORD');
  if (!host || !username || !credential) return json({ iceServers: [], ttl: TTL_SECONDS });

  return json({
    iceServers: [{ urls: [`turn:${host}?transport=udp`, `turn:${host}?transport=tcp`], username, credential }],
    ttl: TTL_SECONDS,
  });
});
