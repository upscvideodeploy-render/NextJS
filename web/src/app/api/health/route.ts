import { NextResponse } from 'next/server';

export async function GET() {
  const startTime = Date.now();
  const version = '1.0.0';

  // Check Supabase connection
  let supabaseStatus = 'unknown';
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      supabaseStatus = 'configured';
    }
  } catch {
    supabaseStatus = 'error';
  }

  // Check A4F API
  let a4fStatus = 'unknown';
  try {
    const a4fKey = process.env.A4F_API_KEY;
    if (a4fKey) {
      a4fStatus = 'configured';
    }
  } catch {
    a4fStatus = 'error';
  }

  const responseTime = Date.now() - startTime;

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version,
    uptime_seconds: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      supabase: supabaseStatus,
      a4f_api: a4fStatus,
    },
    metrics: {
      response_time_ms: responseTime,
      memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    },
  });
}
