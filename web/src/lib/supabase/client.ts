// Client-side Supabase client for browser usage
// Used in Client Components with 'use client' directive

import { createBrowserClient as createClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

export function createBrowserClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Singleton instance for client-side usage
let client: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseBrowserClient() {
  if (!client) {
    client = createBrowserClient()
  }
  return client
}

// Export type for use in components
export type TypedSupabaseClient = ReturnType<typeof createBrowserClient>
