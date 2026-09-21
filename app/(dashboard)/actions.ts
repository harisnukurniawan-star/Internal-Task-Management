"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

const ALLOWED_PRIORITIES = new Set(["low", "medium", "high", "critical"]);
const ALLOWED_DECISIONS = new Set(["approved", "revision", "rejected"]);
const ALLOWED_EVIDENCE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_EVIDENCE_BYTES = 3 * 1024 * 1024;

function jump(path: string, type: "ok" | "error" | "warning", message: string): never {
  redirect(`${path}?${type}=${encodeURIComponent(message)}`);
  throw new Error("Redirect failed");
}

export async function createTask(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "supervisor") jump("/dashboard", "error", "Akses Supervisor diperlukan.");

  const periodId = String(formData.get("period_id") || "").trim();
  const assignedTo = String(formData.get("assigned_to") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const priority = String(formData.get("priority") || "medium").trim();
  const weight = Number(formData.get("weight") || 1);
  const dueDate = String(formData.get("due_date") || "").trim();

  if (!periodId || !assignedTo || title.length < 3) {
    jump("/tasks", "error", "Periode, pegawai, dan judul task wajib diisi.");
  }
  if (!ALLOWED_PRIORITIES.has(priority)) jump("/tasks", "error", "Priority tidak valid.");
  if (!Number.isFinite(weight) || weight <= 0 || weight > 100) {
    jump("/tasks", "error", "Weight harus lebih dari 0 dan maksimal 100.");
  }

  const [periodResult, employeeResult] = await Promise.all([
    supabase.from("weekly_periods").select("id,status").eq("id", periodId).maybeSingle(),
    supabase.from("employees").select("id").eq("id", assignedTo).eq("active", true).maybeSingle(),
  ]);
  if (!periodResult.data || periodResult.data.status === "closed") {
    jump("/tasks", "error", "Periode tidak aktif atau sudah ditutup.");
  }
  if (!employeeResult.data) jump("/tasks", "error", "Pegawai tidak aktif atau tidak ditemukan.");

  let dueAt: string | null = null;
  if (dueDate) {
    const parsed = new Date(`${dueDate}T23:59:59+07:00`);
    if (Number.isNaN(parsed.getTime())) jump("/tasks", "error", "Tanggal jatuh tempo tidak valid.");
    dueAt = parsed.toISOString();
  }

  const { error } = await supabase.from("tasks").insert({
    period_id: periodId,
    assigned_to: assignedTo,
    assigned_by: profile.id,
    title,
    description,
    priority,
    weight,
    due_at: dueAt,
  });
  if (error) jump("/tasks", "error", "Task gagal disimpan.");

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  jump("/tasks", "ok", "Task berhasil di-assign.");
}

export async function submitClaim(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "employee") jump("/dashboard", "error", "Akses Employee diperlukan.");

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("active", true)
    .maybeSingle();
  if (!employee) jump("/my-tasks", "error", "Profil employee belum ditautkan.");

  const taskId = String(formData.get("task_id") || "").trim();
  const summary = String(formData.get("realization_summary") || "").trim();
  const completion = Number(formData.get("completion_percent") || 100);
  const fileValue = formData.get("evidence");
  const evidence = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;

  if (!taskId || summary.length < 3) {
    jump("/my-tasks", "error", "Realisasi wajib diisi.");
  }
  if (!Number.isInteger(completion) || completion < 0 || completion > 100) {
    jump("/my-tasks", "error", "Completion harus 0 sampai 100.");
  }

  const { data: task } = await supabase
    .from("tasks")
    .select("id,status,assigned_to")
    .eq("id", taskId)
    .maybeSingle();
  if (!task || task.assigned_to !== employee.id) {
    jump("/my-tasks", "error", "Task tidak ditemukan atau bukan milik Anda.");
  }
  if (!["assigned", "in_progress", "revision"].includes(task.status)) {
    jump("/my-tasks", "error", "Task ini sedang menunggu review atau sudah ditutup.");
  }

  if (evidence) {
    if (evidence.size > MAX_EVIDENCE_BYTES) {
      jump("/my-tasks", "error", "Evidence maksimal 3 MB.");
    }
    if (!ALLOWED_EVIDENCE_TYPES.has(evidence.type)) {
      jump("/my-tasks", "error", "Evidence hanya PDF, JPG, PNG, atau WebP.");
    }
  }

  const { data: oldClaims } = await supabase
    .from("task_claims")
    .select("version")
    .eq("task_id", taskId)
    .order("version", { ascending: false })
    .limit(1);
  const version = (oldClaims?.[0]?.version || 0) + 1;

  const { data: claim, error: claimError } = await supabase
    .from("task_claims")
    .insert({
      task_id: taskId,
      employee_id: employee.id,
      realization_summary: summary,
      completion_percent: completion,
      version,
    })
    .select("id")
    .single();
  if (claimError || !claim) jump("/my-tasks", "error", "Realisasi gagal disimpan.");

  let warning = "";
  if (evidence) {
    const safe = evidence.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const path = `${employee.id}/${claim.id}/${crypto.randomUUID()}-${safe}`;
    const upload = await supabase.storage.from("task-evidence").upload(path, evidence, {
      contentType: evidence.type,
      upsert: false,
    });

    if (upload.error) {
      warning = "Realisasi tersimpan, tetapi evidence gagal diunggah.";
    } else {
      const meta = await supabase.from("evidence_files").insert({
        claim_id: claim.id,
        file_name: evidence.name,
        file_size: evidence.size,
        mime_type: evidence.type,
        storage_path: path,
      });
      if (meta.error) {
        await supabase.storage.from("task-evidence").remove([path]);
        warning = "Realisasi tersimpan, tetapi metadata evidence gagal disimpan.";
      }
    }
  }

  revalidatePath("/my-tasks");
  revalidatePath("/my-week");
  revalidatePath("/reviews");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");

  if (warning) jump("/my-tasks", "warning", warning);
  jump("/my-tasks", "ok", `Realisasi versi ${version} berhasil dikirim.`);
}

export async function evaluateClaim(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "supervisor") jump("/dashboard", "error", "Akses Supervisor diperlukan.");

  const claimId = String(formData.get("claim_id") || "").trim();
  const decision = String(formData.get("decision") || "").trim();
  const scoreRaw = String(formData.get("score") || "").trim();
  const feedback = String(formData.get("feedback") || "").trim() || null;

  if (!claimId || !ALLOWED_DECISIONS.has(decision)) {
    jump("/reviews", "error", "Submission atau keputusan tidak valid.");
  }

  let score: number | null = null;
  if (scoreRaw !== "") {
    score = Number(scoreRaw);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      jump("/reviews", "error", "Score harus 0 sampai 100.");
    }
  }
  if (decision === "approved" && score === null) {
    jump("/reviews", "error", "Score wajib diisi untuk approval.");
  }

  const { data: claim } = await supabase
    .from("task_claims")
    .select("id,task_id")
    .eq("id", claimId)
    .maybeSingle();
  if (!claim) jump("/reviews", "error", "Submission tidak ditemukan.");

  const { data: latestClaims } = await supabase
    .from("task_claims")
    .select("id")
    .eq("task_id", claim.task_id)
    .order("version", { ascending: false })
    .limit(1);
  if (latestClaims?.[0]?.id !== claimId) {
    jump("/reviews", "error", "Submission ini bukan versi terbaru.");
  }

  const { error } = await supabase.from("task_evaluations").upsert(
    {
      claim_id: claimId,
      evaluator_id: profile.id,
      decision,
      score,
      feedback,
      evaluated_at: new Date().toISOString(),
    },
    { onConflict: "claim_id" },
  );
  if (error) jump("/reviews", "error", "Evaluasi gagal disimpan.");

  revalidatePath("/reviews");
  revalidatePath("/my-tasks");
  revalidatePath("/my-week");
  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");
  jump("/reviews", "ok", "Evaluasi berhasil disimpan.");
}
