import { requirePageUser } from "@/lib/authz";
import { AppShell } from "@/components/app-shell";
import { totalUnread } from "@/server/chat";
import { unreadNotificationCount } from "@/server/notifications";
import { logout } from "@/app/login/actions";

export default async function Layout({ children }: LayoutProps<"/student">) {
  const user = await requirePageUser("STUDENT");
  const [messages, notifications] = await Promise.all([totalUnread(user), unreadNotificationCount(user.id)]);
  return (
    <AppShell
      nav={[
        { href: "/student", label: "Today", icon: "home", exact: true },
        { href: "/student/classes", label: "My classes", icon: "book" },
        { href: "/student/messages", label: "Messages", icon: "chat", badge: messages },
        { href: "/student/files", label: "Files", icon: "file" },
      ]}
      user={{ name: user.name }}
      roleLabel="Student"
      notificationsHref="/student/notifications"
      unreadNotifications={notifications}
      logoutAction={logout}
    >
      {children}
    </AppShell>
  );
}
