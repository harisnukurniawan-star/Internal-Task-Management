import { PageHeader } from "@/components/page-header";
import { requireProfile } from "@/lib/auth";
import { evaluateClaim } from "../actions";

export default async function ReviewsPage() {
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "supervisor") return <p>Unauthorized</p>;
  const { data: claimRows } = await supabase.from("task_claims").select("id,realization_summary,completion_percent,submitted_at,tasks(title),employees(full_name),task_evaluations(decision,score,feedback)").order("submitted_at", { ascending: false });
  const claims = claimRows ?? [];
  return <><PageHeader title="Validation & Evaluation" subtitle="Review realisasi, beri feedback, dan nilai pencapaian."/><div className="grid-2">{claims.map((claim: any) => <section className="card" key={claim.id}><strong>{claim.tasks?.title}</strong><p className="muted">{claim.employees?.full_name} · {claim.completion_percent}%</p><p>{claim.realization_summary}</p><form action={evaluateClaim} className="form"><input type="hidden" name="claim_id" value={claim.id}/><div className="form-row"><div className="field"><label>Decision</label><select name="decision" defaultValue={claim.task_evaluations?.decision || "approved"}><option value="approved">Approved</option><option value="revision">Revision</option><option value="rejected">Rejected</option></select></div><div className="field"><label>Score 0-100</label><input name="score" type="number" min="0" max="100" defaultValue={claim.task_evaluations?.score ?? ""}/></div></div><div className="field"><label>Feedback</label><textarea name="feedback" defaultValue={claim.task_evaluations?.feedback || ""}/></div><button className="btn" type="submit">Simpan Evaluasi</button></form></section>)}</div></>;
}
