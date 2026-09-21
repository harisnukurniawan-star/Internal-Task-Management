import { PageHeader } from "@/components/page-header";
import { requireProfile } from "@/lib/auth";
import { getCurrentPeriod, getEmployeeForProfile } from "@/lib/data";

export default async function DashboardPage() {
  const { supabase, profile } = await requireProfile();
  const period = await getCurrentPeriod();
  const employee = profile.role === "employee" ? await getEmployeeForProfile(profile.id) : null;
  let query = supabase.from("tasks").select("id,status,assigned_to", { count: "exact" });
  if (period) query = query.eq("period_id", period.id);
  if (employee) query = query.eq("assigned_to", employee.id);
  const { data: taskRows } = await query;
  const tasks = taskRows ?? [];
  const stats = {
    total: tasks.length,
    submitted: tasks.filter((t) => t.status === "submitted").length,
    approved: tasks.filter((t) => t.status === "approved").length,
    revision: tasks.filter((t) => t.status === "revision").length,
  };
  return <><PageHeader title="Dashboard" subtitle={period ? `${period.label} · ${period.week_start} s.d. ${period.week_end}` : "Periode aktif belum tersedia"}/><div className="cards"><div className="card"><span className="muted">Total task</span><div className="metric">{stats.total}</div></div><div className="card"><span className="muted">Submitted</span><div className="metric">{stats.submitted}</div></div><div className="card"><span className="muted">Approved</span><div className="metric">{stats.approved}</div></div><div className="card"><span className="muted">Revision</span><div className="metric">{stats.revision}</div></div></div></>;
}
