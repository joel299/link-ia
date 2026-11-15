import { redirect } from "next/navigation";
import { AdminUsersPanel } from "@/components/panel/AdminUsersPanel";
import { AppShell } from "@/components/panel/AppShell";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "admin") {
    redirect("/painel");
  }

  return (
    <AppShell
      userName={user.name}
      userRole={user.role}
      permissions={user.permissions}
    >
      <AdminUsersPanel currentUserId={user.id} />
    </AppShell>
  );
}

