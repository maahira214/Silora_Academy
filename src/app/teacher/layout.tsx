import { requirePageUser } from "@/lib/authz";
import { AppShell } from "@/components/app-shell";
import { totalUnread } from "@/server/chat";
import { unreadNotificationCount } from "@/server/notifications";
import { logout } from "@/app/login/actions";

export default async function Layout({ children }: LayoutProps<"/teacher">) {
  const user = await requirePageUser("TEACHER");
  const [messages, notifications] = await Promise.all([totalUnread(user), unreadNotificationCount(user.id)]);
  return (
    <AppShell
      nav={[
        { href: "/teacher", label: "Today", icon: "home", exact: true },
        { href: "/teacher/classes", label: "My classes", icon: "book" },
        { href: "/teacher/messages", label: "Messages", icon: "chat", badge: messages },
        { href: "/teacher/files", label: "Files", icon: "file" },
      ]}
      user={{ name: user.name }}
      roleLabel="Teacher"
      notificationsHref="/teacher/notifications"
      unreadNotifications={notifications}
      logoutAction={logout}
    >
      {children}
    </AppShell>
  );
}
