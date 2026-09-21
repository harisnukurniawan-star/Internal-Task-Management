import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPeriod } from "@/lib/data";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const period = await getCurrentPeriod();
  let query = supabase
    .from("leaderboard_weekly")
    .select("rank,weighted_points,avg_score,completion_rate,on_time_rate,total_assigned,total_approved,employees(full_name)")
    .order("rank", { ascending: true });
  if (period) query = query.eq("period_id", period.id);
  const { data: rowData } = await query;
  const rows = rowData ?? [];
  return <><PageHeader title="Weekly Leaderboard" subtitle={period?.label || "Periode aktif"}/><div className="table-wrap"><table><thead><tr><th>Rank</th><th>Employee</th><th>Points</th><th>Avg Score</th><th>Completion</th><th>On-time</th><th>Approved / Assigned</th></tr></thead><tbody>{rows.map((row: any) => <tr key={`${row.rank}-${row.employees?.full_name}`}><td><strong>#{row.rank || "-"}</strong></td><td>{row.employees?.full_name}</td><td>{Number(row.weighted_points).toFixed(1)}</td><td>{Number(row.avg_score).toFixed(1)}</td><td>{Number(row.completion_rate).toFixed(0)}%</td><td>{Number(row.on_time_rate).toFixed(0)}%</td><td>{row.total_approved} / {row.total_assigned}</td></tr>)}</tbody></table></div></>;
}
