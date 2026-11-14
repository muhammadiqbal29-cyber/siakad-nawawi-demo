/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  const origin = event.request.headers.get('origin') || '*';

  // 1. Tangani CORS Preflight (OPTIONS request) secara instan di layer terluar
  if (event.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Sekolah-ID, Accept, Cookie',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  // 2. Lanjutkan pemrosesan request
  const response = await resolve(event);

  // 3. Tambahkan CORS headers untuk semua rute /api
  if (event.url.pathname.startsWith('/api')) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Sekolah-ID, Accept, Cookie');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  }

  return response;
}
