// Cliente Supabase con carga perezosa: en modo local no se importa nada de red.
import { SUPABASE_URL, SUPABASE_ANON_KEY, CLOUD_ENABLED } from "../config.js";

let client = null;

export async function getSupabase() {
  if (!CLOUD_ENABLED) return null;
  if (!client) {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

export { CLOUD_ENABLED };
