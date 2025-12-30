import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(req: NextRequest) {
  const { supabaseResponse, user } = await updateSession(req)

  const isAuthenticated = !!user
  const isAuthRoute = req.nextUrl.pathname.startsWith('/login') ||
                      req.nextUrl.pathname.startsWith('/signup') ||
                      req.nextUrl.pathname.startsWith('/forgot-password')
  const isProtectedRoute = req.nextUrl.pathname.startsWith('/dashboard') ||
                           req.nextUrl.pathname.startsWith('/search') ||
                           req.nextUrl.pathname.startsWith('/admin') ||
                           req.nextUrl.pathname.startsWith('/notes')

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Redirect unauthenticated users to login
  if (isProtectedRoute && !isAuthenticated) {
    const redirectUrl = new URL('/login', req.url)
    redirectUrl.searchParams.set('redirect', req.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/search/:path*',
    '/admin/:path*',
    '/login',
    '/signup',
    '/forgot-password',
  ],
};
