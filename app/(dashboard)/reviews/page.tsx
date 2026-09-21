import { FlashMessage, type FlashParams } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { evaluateClaim } from "../actions";

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<FlashParams>;
}) {
  const params = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "supervisor") return <p>Unauthorized</p>;

  const { data: claimRows } = await supabase
    .from("task_claims")
    .select("id,task_id,version,realization_summary,completion_percent,submitted_at,tasks(title,status),employees(full_name),task_evaluations(decision,score,feedback),evidence_files(file_name,file_size,storage_path)")
    .order("submitted_at", { ascending: false });

  const latestByTask = new Map<string, any>();
  for (const claim of claimRows ?? []) {
    if (!latestByTask.has(claim.task_id)) latestByTask.set(claim.task_id, claim);
  }
  const claims = [...latestByTask.values()];

  const evidenceLinks = new Map<string, string>();
  for (const claim of claims) {
    const evidence = claim.evidence_files?.[0];
    if (!evidence) continue;
    const signed = await supabase.storage
      .from("task-evidence")
      .createSignedUrl(evidence.storage_path, 300, { download: evidence.file_name });
    if (signed.data?.signedUrl) evidenceLinks.set(claim.id, signed.data.signedUrl);
  }

  return (
    <>
      <PageHeader
        title="Validation & Evaluation"
        subtitle="Hanya submission terbaru per task yang ditampilkan."
      />
      <FlashMessage params={params} />

      <div className="grid-2">
        {claims.map((claim) => {
          const evaluation = claim.task_evaluations;
          return (
            <section className="card compact" key={claim.id}>
              <div className="card-head">
                <strong>{claim.tasks?.title}</strong>
                <StatusBadge status={claim.tasks?.status || "submitted"} />
              </div>
              <div className="task-meta">
                <span>{claim.employees?.full_name}</span>
                <span>Submission v{claim.version}</span>
                <span>{claim.completion_percent}%</span>
              </div>
              <p>{claim.realization_summary}</p>

              {evidenceLinks.get(claim.id) ? (
                <a className="evidence-link" href={evidenceLinks.get(claim.id)} target="_blank" rel="noreferrer">
                  Buka evidence
                </a>
              ) : (
                <p className="muted small">Tidak ada evidence file.</p>
              )}

              <form action={evaluateClaim} className="form section-sm">
                <input type="hidden" name="claim_id" value={claim.id} />
                <div className="form-row">
                  <div className="field">
                    <label>Decision</label>
                    <select name="decision" defaultValue={evaluation?.decision || "approved"}>
                      <option value="approved">Approved</option>
                      <option value="revision">Revision</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Score 0–100</label>
                    <input
                      name="score"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      defaultValue={evaluation?.score ?? ""}
                      placeholder="Wajib jika Approved"
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Feedback</label>
                  <textarea name="feedback" maxLength={1600} defaultValue={evaluation?.feedback || ""} />
                </div>
                <button className="btn" type="submit">Simpan Evaluasi</button>
              </form>
            </section>
          );
        })}
      </div>

      {claims.length === 0 ? <div className="card empty">Belum ada submission untuk direview.</div> : null}
    </>
  );
}
