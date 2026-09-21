import { FlashMessage, type FlashParams } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { getCurrentPeriod, getEmployeeForProfile } from "@/lib/data";
import { submitClaim } from "../actions";

export default async function MyTasksPage({
  searchParams,
}: {
  searchParams: Promise<FlashParams>;
}) {
  const params = await searchParams;
  const { supabase, profile } = await requireProfile();
  const employee = await getEmployeeForProfile(profile.id);
  const period = await getCurrentPeriod();
  if (!employee) return <p>Employee profile belum ditautkan.</p>;

  let taskQuery = supabase
    .from("tasks")
    .select("id,title,description,status,priority,due_at")
    .eq("assigned_to", employee.id);
  if (period) taskQuery = taskQuery.eq("period_id", period.id);
  const { data: taskRows } = await taskQuery.order("created_at", { ascending: false });
  const tasks = taskRows ?? [];
  const taskIds = tasks.map((task) => task.id);

  const latestByTask = new Map<string, any>();
  if (taskIds.length > 0) {
    const { data: claimRows } = await supabase
      .from("task_claims")
      .select("id,task_id,version,realization_summary,completion_percent,submitted_at,task_evaluations(decision,score,feedback,evaluated_at),evidence_files(file_name,file_size,storage_path)")
      .in("task_id", taskIds)
      .order("version", { ascending: false });
    for (const claim of claimRows ?? []) {
      if (!latestByTask.has(claim.task_id)) latestByTask.set(claim.task_id, claim);
    }
  }

  const evidenceLinks = new Map<string, string>();
  for (const claim of latestByTask.values()) {
    const evidence = claim.evidence_files?.[0];
    if (!evidence) continue;
    const signed = await supabase.storage
      .from("task-evidence")
      .createSignedUrl(evidence.storage_path, 300, { download: evidence.file_name });
    if (signed.data?.signedUrl) evidenceLinks.set(claim.id, signed.data.signedUrl);
  }

  return (
    <>
      <PageHeader title="My Tasks" subtitle={period?.label || "Task periode aktif"} />
      <FlashMessage params={params} />

      <div className="grid-2">
        {tasks.map((task) => {
          const claim = latestByTask.get(task.id);
          const evaluation = claim?.task_evaluations;
          const canSubmit = ["assigned", "in_progress", "revision"].includes(task.status);
          return (
            <section className="card compact" key={task.id}>
              <div className="card-head">
                <strong>{task.title}</strong>
                <StatusBadge status={task.status} />
              </div>
              <p className="muted clamp">{task.description || "Tanpa deskripsi"}</p>
              <div className="task-meta">
                <span>Priority: {task.priority}</span>
                <span>Due: {task.due_at ? new Date(task.due_at).toLocaleDateString("id-ID") : "-"}</span>
              </div>

              {claim ? (
                <div className="submission-box">
                  <div className="task-meta">
                    <span>Submission v{claim.version}</span>
                    <span>{claim.completion_percent}% selesai</span>
                  </div>
                  <p>{claim.realization_summary}</p>
                  {evidenceLinks.get(claim.id) ? (
                    <a className="evidence-link" href={evidenceLinks.get(claim.id)} target="_blank" rel="noreferrer">
                      Buka evidence
                    </a>
                  ) : (
                    <span className="muted small">Tanpa evidence file</span>
                  )}
                  {evaluation ? (
                    <div className={`feedback ${evaluation.decision}`}>
                      <strong>{evaluation.decision === "revision" ? "Perlu revisi" : evaluation.decision}</strong>
                      {evaluation.score !== null ? <span>Score: {evaluation.score}</span> : null}
                      {evaluation.feedback ? <p>{evaluation.feedback}</p> : null}
                    </div>
                  ) : task.status === "submitted" ? (
                    <div className="notice neutral">Menunggu review Supervisor.</div>
                  ) : null}
                </div>
              ) : null}

              {canSubmit ? (
                <form action={submitClaim} className="form section-sm">
                  <input type="hidden" name="task_id" value={task.id} />
                  <div className="field">
                    <label>{task.status === "revision" ? "Realisasi revisi" : "Realisasi"}</label>
                    <textarea name="realization_summary" required maxLength={2000} />
                  </div>
                  <div className="form-row">
                    <div className="field">
                      <label>Completion %</label>
                      <input name="completion_percent" type="number" min="0" max="100" step="1" defaultValue="100" />
                    </div>
                    <div className="field">
                      <label>Evidence · opsional</label>
                      <input name="evidence" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />
                      <small className="muted">1 file · maks. 3 MB</small>
                    </div>
                  </div>
                  <button className="btn" type="submit">
                    {task.status === "revision" ? "Kirim Revisi" : "Submit Realisasi"}
                  </button>
                </form>
              ) : null}
            </section>
          );
        })}
      </div>

      {tasks.length === 0 ? <div className="card empty">Belum ada task untuk minggu ini.</div> : null}
    </>
  );
}
