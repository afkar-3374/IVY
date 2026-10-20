// Sends a web push to the partner's devices. Bodies are fixed, generic texts so no
// message content ever reaches a push service or a lock screen.
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KINDS: Record<string, { title: string; body: string; tag: string; urgency: 'high' | 'normal'; url: string }> = {
  message: { title: 'Ivy', body: '💌 You have a new message', tag: 'ivy-message', urgency: 'high', url: '/chat' },
  call: { title: 'Ivy', body: '📞 Incoming call — open Ivy to answer', tag: 'ivy-call', urgency: 'high', url: '/chat' },
  tap: { title: 'Ivy', body: '💗 Someone is thinking of you', tag: 'ivy-love', urgency: 'normal', url: '/us' },
  hug: { title: 'Ivy', body: '🤗 Someone wants a hug — open Ivy', tag: 'ivy-love', urgency: 'normal', url: '/love' },
  game: { title: 'Ivy', body: '🎮 Your turn to play', tag: 'ivy-game', urgency: 'normal', url: '/play' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  const authHeader = req.headers.get('Authorization') ?? '';
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await asUser.auth.getUser();
  const me = userData.user?.id;
  const { data: isMember } = await asUser.rpc('is_member');
  if (!me || !isMember) return json({ error: 'forbidden' }, 403);

  const { kind } = await req.json().catch(() => ({ kind: '' }));
  const note = KINDS[kind];
  if (!note) return json({ error: 'unknown kind' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: partner } = await admin.from('profiles').select('id').neq('id', me).limit(1).single();
  if (!partner) return json({ sent: 0 });
  const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', partner.id);

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:ivy@example.com',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!
  );

  const payload = JSON.stringify({ title: note.title, body: note.body, tag: note.tag, url: note.url, kind });
  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: kind === 'call' ? 60 : 3600, urgency: note.urgency, topic: note.tag }
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.id); // device unsubscribed
        else console.error('push failed', status, (err as Error).message);
      }
    })
  );
  if (gone.length) await admin.from('push_subscriptions').delete().in('id', gone);
  return json({ sent, removed: gone.length });
});
