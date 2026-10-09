import { db } from "@/lib/db";
import { can, requirePageUser } from "@/lib/authz";
import { AppShell, type NavItem } from "@/components/app-shell";
import { unreadNotificationCount } from "@/server/notifications";
import { logout } from "@/app/login/actions";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requirePageUser("SUPER_ADMIN", "OPERATIONS");
  const [openAlerts, flagged, unread] = await Promise.all([
    db.alert.count({ where: { orgId: user.orgId, status: "OPEN" } }),
    can(user, "chat.review") ? db.message.count({ where: { flagged: true, reviewedAt: null, thread: { course: { orgId: user.orgId } } } }) : 0,
    unreadNotificationCount(user.id),
  ]);

  const nav: NavItem[] = [
    { href: "/admin", label: "Dashboard", icon: "home", exact: true },
    { href: "/admin/sessions", label: "Schedule", icon: "calendar" },
    { href: "/admin/classes", label: "Classes", icon: "book" },
    { href: "/admin/people", label: "People", icon: "people" },
    { href: "/admin/alerts", label: "Alerts", icon: "alert", badge: openAlerts },
  ];
  if (can(user, "chat.review")) nav.push({ href: "/admin/moderation", label: "Chat review", icon: "shield", badge: flagged });
  // Rarely used pages sit under "More"
  if (can(user, "staff.manage")) nav.push({ href: "/admin/staff", label: "Staff", icon: "staff", more: true });
  nav.push({ href: "/admin/emails", label: "Emails", icon: "mail", more: true });
  if (can(user, "audit.view")) nav.push({ href: "/admin/audit", label: "Audit log", icon: "log", more: true });
  if (can(user, "settings.manage")) nav.push({ href: "/admin/settings", label: "Settings", icon: "settings", more: true });

  return (
    <AppShell
      nav={nav}
      user={{ name: user.name }}
      roleLabel={user.role === "SUPER_ADMIN" ? "Super Admin" : "Operations"}
      notificationsHref="/admin/notifications"
      unreadNotifications={unread}
      logoutAction={logout}
    >
      {children}
    </AppShell>
  );
}
