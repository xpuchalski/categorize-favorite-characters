const KV_KEY = 'characters_txt';

async function readFromAsset(request, env) {
  const url = new URL(request.url);
  const assetUrl = new URL('/characters.txt', url.origin);
  const assetResponse = await env.ASSETS.fetch(assetUrl.toString(), request);

  if (!assetResponse.ok) {
    throw new Error('Asset read failed');
  }

  return assetResponse.text();
}

export async function onRequest(context) {
  const { request, env } = context;
  const kv = env.CHARACTERS_KV;

  if (request.method === 'GET') {
    try {
      if (kv) {
        const fromKv = await kv.get(KV_KEY);
        if (typeof fromKv === 'string' && fromKv.length > 0) {
          return new Response(fromKv, {
            status: 200,
            headers: { 'content-type': 'text/plain; charset=utf-8' },
          });
        }
      }

      const text = await readFromAsset(request, env);

      return new Response(text, {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    } catch {
      return new Response('Failed to read characters.txt', { status: 500 });
    }
  }

  if (request.method === 'PUT') {
    if (!kv) {
      return Response.json(
        {
          error: 'Missing KV binding. Add CHARACTERS_KV in Cloudflare Pages settings.',
        },
        { status: 500 }
      );
    }

    try {
      const body = await request.json();
      const content = body?.content;

      if (typeof content !== 'string') {
        return Response.json(
          { error: 'Expected JSON body: { "content": "..." }' },
          { status: 400 }
        );
      }

      await kv.put(KV_KEY, content);
      return new Response(null, { status: 204 });
    } catch {
      return Response.json({ error: 'Failed to save characters data' }, { status: 500 });
    }
  }

  return new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'GET, PUT' },
  });
}
