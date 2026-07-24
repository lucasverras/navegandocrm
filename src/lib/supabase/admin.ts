import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// SERVER-ONLY. Uses the service role key which bypasses RLS.
// Never import this file from any "use client" component or expose it to the browser.
// Not parameterized with the Database generic: the installed postgrest-js version's
// generic query-parser resolves our hand-written schema types to `never` on writes.
// Row shapes are enforced via src/types/database.ts casts at call sites instead.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
