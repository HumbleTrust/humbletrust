import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key =
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(url && key);

export const getClient = () => {
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key);
};

