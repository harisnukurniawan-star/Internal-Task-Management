import { createClient } from "@/lib/supabase/server";

export async function getCurrentPeriod() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from("weekly_periods").select("*").lte("week_start", today).gte("week_end", today).maybeSingle();
  return data;
}

export async function getEmployeeForProfile(profileId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("employees").select("*").eq("profile_id", profileId).maybeSingle();
  return data;
}
