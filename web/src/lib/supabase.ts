import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || "https://bkorysuqkcsfcpmugthr.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrb3J5c3Vxa2NzZmNwbXVndGhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNzQ1ODksImV4cCI6MjA5NDg1MDU4OX0.T70C2J0VBTxuBSygx58Wdzu2ZGi1bq5MfRKtmfesQLc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { flowType: "implicit" },
});
