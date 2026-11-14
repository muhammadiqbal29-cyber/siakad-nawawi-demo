import { json } from '@sveltejs/kit';

function getCorsHeaders(request) {
  const origin = request.headers.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Cookie',
    'Access-Control-Allow-Credentials': 'true'
  };
}

export async function OPTIONS({ request }) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request)
  });
}

export async function GET({ request }) {
  return json({
    status: 'online',
    app: 'SIAKAD Nawawi Demo (Vercel Cloud Edition)',
    version: '1.0.0-demo',
    server_time: new Date().toISOString()
  }, { headers: getCorsHeaders(request) });
}
