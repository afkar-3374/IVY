// Sends a web push to the partner's devices, titled with the sender's name. Message text
// only travels sealed with the couple key ("preview"); the partner's phone decrypts it.
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KINDS: Record<string, { title: string; body: string; tag: string; urgency: 'high' | 'normal'; url: string }> = {
  message: { title: 'Ivy', body: '💌 New message', tag: 'ivy-message', urgency: 'high', url: '/chat' },
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

  const { kind, preview, id } = await req.json().catch(() => ({ kind: '' }));
  const note = KINDS[kind];
  if (!note) return json({ error: 'unknown kind' }, 400);
  const sealed = typeof preview === 'string' && preview.startsWith('enc1:') && preview.length <= 2000 ? preview : undefined;

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: profiles } = await admin.from('profiles').select('id, display_name, nickname');
  const sender = profiles?.find((p) => p.id === me);
  const partner = profiles?.find((p) => p.id !== me);
  if (!partner) return json({ sent: 0 });
  // The name the partner gave the sender, like a saved contact name
  const name = partner.nickname?.trim() || sender?.display_name || note.title;
  const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', partner.id);

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:ivy@example.com',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!
  );

  const payload = JSON.stringify({
    title: name,
    body: note.body,
    tag: kind === 'message' ? `ivy-message-${me}` : note.tag,
    url: note.url,
    kind,
    from: me,
    to: partner.id,
    preview: sealed,
    // Message id, so the phone shows a message once even if Ivy also reported it
    id: typeof id === 'string' && id.length <= 64 ? id : undefined,
  });
  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: kind === 'call' ? 60 : 86400, urgency: note.urgency }
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
