import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { getEmployeeForProfile } from "@/lib/data";
import { submitClaim } from "../actions";

export default async function MyTasksPage() {
  const { supabase, profile } = await requireProfile();
  const employee = await getEmployeeForProfile(profile.id);
  if (!employee) return <p>Employee profile belum ditautkan.</p>;
  const { data: taskRows } = await supabase.from("tasks").select("id,title,description,status,priority,due_at").eq("assigned_to", employee.id).order("created_at", { ascending: false });
  const tasks = taskRows ?? [];
  return <><PageHeader title="My Tasks" subtitle="Klaim realisasi dan unggah evidence pekerjaan."/><div className="grid-2">{tasks.map((task) => <section className="card" key={task.id}><div style={{display:"flex",justifyContent:"space-between",gap:10}}><strong>{task.title}</strong><StatusBadge status={task.status}/></div><p className="muted">{task.description || "Tanpa deskripsi"}</p><p><small>Priority: {task.priority} · Due: {task.due_at ? new Date(task.due_at).toLocaleString("id-ID") : "-"}</small></p>{task.status !== "approved" && task.status !== "rejected" ? <form action={submitClaim} className="form"><input type="hidden" name="task_id" value={task.id}/><div className="field"><label>Realisasi</label><textarea name="realization_summary" required/></div><div className="field"><label>Completion %</label><input name="completion_percent" type="number" min="0" max="100" defaultValue="100"/></div><div className="field"><label>Evidence (maks. 10 MB/file)</label><input name="evidence" type="file" multiple/></div><button className="btn" type="submit">Submit Realisasi</button></form> : null}</section>)}</div></>;
}
