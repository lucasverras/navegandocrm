import { createClient } from "@/lib/supabase/server";

// Verifies the caller has a valid Supabase session. Use at the top of every
// API route handler — middleware only protects page navigation, not /api/*.
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
