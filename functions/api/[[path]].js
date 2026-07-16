export async function onRequest({ request, env }) {
  const service = env?.VS_CACHE_SERVICE;
  if (!service?.fetch) {
    return Response.json({ error: 'Cache service is not configured.' }, { status: 503 });
  }

  return service.fetch(request);
}
