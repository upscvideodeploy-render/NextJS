import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      supabase: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'missing',
      a4f_api: process.env.A4F_API_KEY ? 'configured' : 'missing',
    },
  });
}
