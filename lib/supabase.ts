import { createClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}
if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
}

// Client for browser-side operations
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

// Admin client for server-side operations (API routes)
export function getSupabaseAdmin() {
  if (!process.env.SUPABASE_SECRET_KEY) {
    throw new Error('Missing env.SUPABASE_SECRET_KEY');
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
