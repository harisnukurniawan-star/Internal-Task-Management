import Link from "next/link";
import { logout } from "@/app/(auth)/login/actions";

export function AppShell({ children, role, name }: { children: React.ReactNode; role: string; name: string }) {
  const supervisor = role === "supervisor";
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Internal Task Management<small>{name} · {supervisor ? "Supervisor" : "Employee"}</small></div>
        <nav className="nav">
          <Link href="/dashboard">Dashboard</Link>
          {supervisor ? <><Link href="/tasks">Team Tasks</Link><Link href="/reviews">Validation & Evaluation</Link></> : <><Link href="/my-week">My Week</Link><Link href="/my-tasks">My Tasks</Link></>}
          <Link href="/leaderboard">Leaderboard</Link>
        </nav>
        <form action={logout} style={{ marginTop: "auto" }}><button className="btn secondary" type="submit">Keluar</button></form>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
