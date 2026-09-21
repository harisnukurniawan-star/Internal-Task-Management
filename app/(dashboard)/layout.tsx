import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  return <AppShell role={profile.role} name={profile.full_name}>{children}</AppShell>;
}
