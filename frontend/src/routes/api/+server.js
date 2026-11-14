import { json } from '@sveltejs/kit';

export async function GET() {
  return json({
    status: 'online',
    app: 'SIAKAD Nawawi Demo (Vercel Cloud Edition)',
    version: '1.0.0-demo',
    server_time: new Date().toISOString()
  });
}
