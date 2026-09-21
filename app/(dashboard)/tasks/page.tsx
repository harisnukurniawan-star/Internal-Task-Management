import { FlashMessage, type FlashParams } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { getCurrentPeriod } from "@/lib/data";
import { createTask } from "../actions";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<FlashParams>;
}) {
  const params = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "supervisor") return <p>Unauthorized</p>;

  const period = await getCurrentPeriod();
  const employeeResult = await supabase
    .from("employees")
    .select("id,full_name")
    .eq("active", true)
    .order("display_order");
  const employees = employeeResult.data ?? [];

  let tasks: any[] = [];
  if (period) {
    const taskResult = await supabase
      .from("tasks")
      .select("id,title,status,priority,weight,due_at,employees!tasks_assigned_to_fkey(full_name)")
      .eq("period_id", period.id)
      .order("created_at", { ascending: false });
    tasks = taskResult.data ?? [];
  }

  return (
    <>
      <PageHeader
        title="Team Tasks"
        subtitle={period ? `${period.label} · assign dan monitor task minggu berjalan.` : "Periode aktif belum tersedia."}
      />
      <FlashMessage params={params} />

      {period ? (
        <section className="card compact">
          <h3>Assign task</h3>
          <form action={createTask} className="form">
            <input type="hidden" name="period_id" value={period.id} />
            <div className="form-row">
              <div className="field">
                <label>Judul task</label>
                <input name="title" required maxLength={160} />
              </div>
              <div className="field">
                <label>Assign ke</label>
                <select name="assigned_to" required>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.full_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Deskripsi</label>
              <textarea name="description" maxLength={1200} />
            </div>
            <div className="form-row three">
              <div className="field">
                <label>Priority</label>
                <select name="priority" defaultValue="medium">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="field">
                <label>Weight</label>
                <input name="weight" type="number" min="0.1" max="100" step="0.1" defaultValue="1" />
              </div>
              <div className="field">
                <label>Due date</label>
                <input name="due_date" type="date" />
              </div>
            </div>
            <button className="btn" type="submit">Assign Task</button>
          </form>
        </section>
      ) : null}

      <section className="section table-wrap">
        <table>
          <thead>
            <tr><th>Task</th><th>Employee</th><th>Status</th><th>Priority</th><th>Weight</th><th>Due</th></tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td><strong>{task.title}</strong></td>
                <td>{task.employees?.full_name}</td>
                <td><StatusBadge status={task.status} /></td>
                <td>{task.priority}</td>
                <td>{task.weight}</td>
                <td>{task.due_at ? new Date(task.due_at).toLocaleDateString("id-ID") : "-"}</td>
              </tr>
            ))}
            {tasks.length === 0 ? (
              <tr><td colSpan={6} className="empty">Belum ada task pada periode aktif.</td></tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </>
  );
}
