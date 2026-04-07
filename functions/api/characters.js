export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'GET') {
    try {
      const url = new URL(request.url);
      const assetUrl = new URL('/characters.txt', url.origin);
      const assetResponse = await env.ASSETS.fetch(assetUrl.toString(), request);

      if (!assetResponse.ok) {
        return new Response('Failed to read characters.txt', { status: 500 });
      }

      const text = await assetResponse.text();
      return new Response(text, {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    } catch {
      return new Response('Failed to read characters.txt', { status: 500 });
    }
  }

  if (request.method === 'PUT') {
    return Response.json(
      {
        error: 'Saving is not supported on Cloudflare Pages static deployment. Edit in Git and redeploy.',
      },
      { status: 501 }
    );
  }

  return new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'GET, PUT' },
  });
}
