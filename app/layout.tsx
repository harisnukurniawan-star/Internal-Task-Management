import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Internal Task Management",
  description: "Weekly performance management for supervisors and employees",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
