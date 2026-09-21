import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { getCurrentPeriod, getEmployeeForProfile } from "@/lib/data";

export default async function MyWeekPage() {
  const { supabase, profile } = await requireProfile();
  const employee = await getEmployeeForProfile(profile.id);
  const period = await getCurrentPeriod();
  if (!employee) return <p>Employee profile belum ditautkan.</p>;
  let query = supabase.from("tasks").select("id,title,status,priority,due_at").eq("assigned_to", employee.id);
  if (period) query = query.eq("period_id", period.id);
  const { data: taskRows } = await query.order("due_at");
  const tasks = taskRows ?? [];
  return <><PageHeader title="My Week" subtitle={period?.label || "Periode aktif"}/><div className="table-wrap"><table><thead><tr><th>Task</th><th>Priority</th><th>Status</th><th>Due</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id}><td>{task.title}</td><td>{task.priority}</td><td><StatusBadge status={task.status}/></td><td>{task.due_at ? new Date(task.due_at).toLocaleString("id-ID") : "-"}</td></tr>)}</tbody></table></div></>;
}
