import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server client using the anon key + the user's session cookies.
// Reads/writes go through RLS as the authenticated user.
// Not parameterized with the Database generic: the installed postgrest-js version's
// generic query-parser resolves our hand-written schema types to `never` on writes.
// Row shapes are enforced via src/types/database.ts casts at call sites instead.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component without a mutable cookie jar; safe to ignore
            // because middleware refreshes the session on every request.
          }
        },
      },
    }
  );
}
