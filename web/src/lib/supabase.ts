import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || "https://bkorysuqkcsfcpmugthr.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON || "", {
  auth: { flowType: "pkce" },
});
