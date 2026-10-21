// Title, description and image for a link shared in the chat (only for the two partners).
import { createClient } from 'npm:@supabase/supabase-js@2';

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 6000;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Hosts that point back into private networks are never fetched. */
function isPrivateHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^(10|127|0)\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    host.startsWith('[')
  );
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function meta(html: string, ...names: string[]): string | undefined {
  for (const name of names) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    if (content) return decode(content);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=86400' },
    });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: isMember } = await supabase.rpc('is_member');
  if (!isMember) return json({ error: 'forbidden' }, 403);

  let target: URL;
  try {
    const { url } = await req.json();
    target = new URL(url);
  } catch {
    return json({ error: 'bad url' }, 400);
  }
  if (!/^https?:$/.test(target.protocol) || isPrivateHost(target.hostname)) return json({ error: 'bad url' }, 400);

  try {
    const res = await fetch(target, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IvyLinkPreview/1.0)', Accept: 'text/html' },
    });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('text/html') || !res.body) return json({});

    // Read just the start of the page; the tags live in <head>
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
      if (new TextDecoder().decode(value).includes('</head>')) break;
    }
    void reader.cancel();
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }
    const html = new TextDecoder().decode(bytes);

    const title = meta(html, 'og:title', 'twitter:title') || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '');
    const description = meta(html, 'og:description', 'twitter:description', 'description');
    let image = meta(html, 'og:image', 'twitter:image');
    if (image) image = new URL(image, res.url).toString();
    if (image && !image.startsWith('https://')) image = undefined;

    return json({
      title: title?.slice(0, 200) || undefined,
      description: description?.slice(0, 300),
      image,
      site: meta(html, 'og:site_name') || new URL(res.url).hostname.replace(/^www\./, ''),
    });
  } catch {
    return json({});
  }
});
