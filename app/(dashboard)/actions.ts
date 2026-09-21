"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

export async function createTask(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "supervisor") throw new Error("Unauthorized");
  const payload = {
    period_id: String(formData.get("period_id")),
    assigned_to: String(formData.get("assigned_to")),
    assigned_by: profile.id,
    title: String(formData.get("title")),
    description: String(formData.get("description") || "") || null,
    priority: String(formData.get("priority") || "medium"),
    weight: Number(formData.get("weight") || 1),
    due_at: String(formData.get("due_at") || "") || null,
  };
  const { error } = await supabase.from("tasks").insert(payload);
  if (error) throw error;
  revalidatePath("/tasks"); revalidatePath("/dashboard");
}

export async function submitClaim(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  const { data: employee } = await supabase.from("employees").select("id").eq("profile_id", profile.id).single();
  if (!employee) throw new Error("Employee profile not linked");
  const taskId = String(formData.get("task_id"));
  const summary = String(formData.get("realization_summary"));
  const completion = Number(formData.get("completion_percent") || 100);
  const { data: oldClaims } = await supabase.from("task_claims").select("version").eq("task_id", taskId).order("version", { ascending: false }).limit(1);
  const version = (oldClaims?.[0]?.version || 0) + 1;
  const { data: claim, error } = await supabase.from("task_claims").insert({ task_id: taskId, employee_id: employee.id, realization_summary: summary, completion_percent: completion, version }).select("id").single();
  if (error) throw error;
  const files = formData.getAll("evidence").filter((v): v is File => v instanceof File && v.size > 0);
  for (const file of files) {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${employee.id}/${claim.id}/${crypto.randomUUID()}-${safe}`;
    const upload = await supabase.storage.from("task-evidence").upload(path, file, { contentType: file.type || undefined });
    if (upload.error) throw upload.error;
    const meta = await supabase.from("evidence_files").insert({ claim_id: claim.id, file_name: file.name, file_size: file.size, mime_type: file.type || null, storage_path: path });
    if (meta.error) throw meta.error;
  }
  revalidatePath("/my-tasks"); revalidatePath("/dashboard");
}

export async function evaluateClaim(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "supervisor") throw new Error("Unauthorized");
  const claimId = String(formData.get("claim_id"));
  const decision = String(formData.get("decision"));
  const scoreRaw = String(formData.get("score") || "");
  const feedback = String(formData.get("feedback") || "") || null;
  const score = scoreRaw === "" ? null : Number(scoreRaw);
  const { error } = await supabase.from("task_evaluations").upsert({ claim_id: claimId, evaluator_id: profile.id, decision, score, feedback, evaluated_at: new Date().toISOString() }, { onConflict: "claim_id" });
  if (error) throw error;
  revalidatePath("/reviews"); revalidatePath("/leaderboard"); revalidatePath("/dashboard");
}
