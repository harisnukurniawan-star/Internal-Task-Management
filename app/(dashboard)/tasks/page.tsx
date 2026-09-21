import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { getCurrentPeriod } from "@/lib/data";
import { createTask } from "../actions";

export default async function TasksPage() {
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "supervisor") return <p>Unauthorized</p>;
  const period = await getCurrentPeriod();
  const [{ data: employees = [] }, { data: tasks = [] }] = await Promise.all([
    supabase.from("employees").select("id,full_name").eq("active", true).order("display_order"),
    supabase.from("tasks").select("id,title,status,priority,weight,due_at,employees!tasks_assigned_to_fkey(full_name)").order("created_at", { ascending: false }),
  ]);
  return <><PageHeader title="Team Tasks" subtitle="Assign dan monitor pekerjaan mingguan tim."/>{period ? <section className="card"><h3>Assign task</h3><form action={createTask} className="form"><input type="hidden" name="period_id" value={period.id}/><div className="form-row"><div className="field"><label>Judul task</label><input name="title" required/></div><div className="field"><label>Assign ke</label><select name="assigned_to" required>{employees.map(e=><option key={e.id} value={e.id}>{e.full_name}</option>)}</select></div></div><div className="field"><label>Deskripsi</label><textarea name="description"/></div><div className="form-row"><div className="field"><label>Priority</label><select name="priority" defaultValue="medium"><option>low</option><option>medium</option><option>high</option><option>critical</option></select></div><div className="field"><label>Weight</label><input name="weight" type="number" min="0.1" step="0.1" defaultValue="1"/></div></div><div className="field"><label>Due</label><input name="due_at" type="datetime-local"/></div><button className="btn" type="submit">Assign Task</button></form></section>:null}<section className="section table-wrap"><table><thead><tr><th>Task</th><th>Employee</th><th>Status</th><th>Priority</th><th>Weight</th><th>Due</th></tr></thead><tbody>{tasks.map((t:any)=><tr key={t.id}><td>{t.title}</td><td>{t.employees?.full_name}</td><td><StatusBadge status={t.status}/></td><td>{t.priority}</td><td>{t.weight}</td><td>{t.due_at ? new Date(t.due_at).toLocaleString("id-ID") : "-"}</td></tr>)}</tbody></table></section></>;
}
