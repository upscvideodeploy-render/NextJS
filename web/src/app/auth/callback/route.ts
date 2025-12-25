import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const error_description = searchParams.get('error_description');

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error, error_description);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error_description || error)}`
    );
  }

  // If no code, redirect to login
  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );

  try {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('Session exchange error:', exchangeError);
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
      );
    }

    // Get the user to ensure session is valid
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) {
      console.error('User fetch error:', userError);
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(userError.message)}`
      );
    }

    if (!user) {
      return NextResponse.redirect(`${origin}/login?error=No user found`);
    }

    // Check if user has a profile, if not create one
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      // Create user profile
      await supabase.from('user_profiles').insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
        avatar_url: user.user_metadata?.avatar_url,
        trial_started_at: new Date().toISOString(),
        trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        plan: 'pro', // Trial users get pro access
      });
    }

    // URL to redirect to after successful authentication
    const redirectTo = request.nextUrl.searchParams.get('redirect_to') || '/dashboard';

    return NextResponse.redirect(`${origin}${redirectTo}`);
  } catch (err) {
    console.error('Callback error:', err);
    return NextResponse.redirect(
      `${origin}/login?error=An unexpected error occurred during authentication`
    );
  }
}
