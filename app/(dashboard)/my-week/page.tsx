import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { getCurrentPeriod, getEmployeeForProfile } from "@/lib/data";

export default async function MyWeekPage(){const {supabase,profile}=await requireProfile();const employee=await getEmployeeForProfile(profile.id);const period=await getCurrentPeriod();if(!employee)return <p>Employee profile belum ditautkan.</p>;let q=supabase.from("tasks").select("id,title,status,priority,due_at").eq("assigned_to",employee.id);if(period)q=q.eq("period_id",period.id);const {data:tasks=[]}=await q.order("due_at");return <><PageHeader title="My Week" subtitle={period?.label || "Periode aktif"}/><div className="table-wrap"><table><thead><tr><th>Task</th><th>Priority</th><th>Status</th><th>Due</th></tr></thead><tbody>{tasks.map(t=><tr key={t.id}><td>{t.title}</td><td>{t.priority}</td><td><StatusBadge status={t.status}/></td><td>{t.due_at?new Date(t.due_at).toLocaleString("id-ID"):"-"}</td></tr>)}</tbody></table></div></>}
