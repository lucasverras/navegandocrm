import { createBrowserClient } from "@supabase/ssr";

// Not parameterized with the Database generic: the installed postgrest-js version's
// generic query-parser resolves our hand-written schema types to `never` on writes.
// Row shapes are enforced via src/types/database.ts casts at call sites instead.
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
