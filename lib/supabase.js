import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = "https://quruzppflgdbddxyylxu.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cnV6cHBmbGdkYmRkeHl5bHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDQ1NTEsImV4cCI6MjA4OTE4MDU1MX0.y6acgCo6EZZiEDIJHSx6J3T60L1P6M_DH3vTIulFvJ0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
