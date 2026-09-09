import { createClient } from "@/lib/supabase/server";

// Verifies the caller has a valid Supabase session. Use at the top of every
// API route handler — middleware only protects page navigation, not /api/*.
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Server routes often use the service-role client after this check. A valid Auth
  // account alone is therefore insufficient: only explicitly provisioned team profiles
  // may reach those privileged operations.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  return profile ? user : null;
}
