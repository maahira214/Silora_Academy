import { requirePageUser } from "@/lib/authz";
import { AppShell } from "@/components/app-shell";
import { totalUnread } from "@/server/chat";
import { unreadNotificationCount } from "@/server/notifications";
import { logout } from "@/app/login/actions";
import { WelcomeCards } from "@/components/portal/welcome-cards";

export default async function Layout({ children }: LayoutProps<"/student">) {
  const user = await requirePageUser("STUDENT");
  const [messages, notifications] = await Promise.all([totalUnread(user), unreadNotificationCount(user.id)]);
  return (
    <AppShell
      variant="portal"
      nav={[
        { href: "/student", label: "Home", icon: "home", exact: true },
        { href: "/student/messages", label: "Messages", icon: "chat", badge: messages },
        { href: "/student/classes", label: "My classes", icon: "book" },
      ]}
      user={{ name: user.name }}
      roleLabel="Student"
      notificationsHref="/student/notifications"
      unreadNotifications={notifications}
      logoutAction={logout}
    >
      {children}
      {!user.welcomedAt && <WelcomeCards role="STUDENT" joinOpensMinutesBefore={user.org.joinOpensMinutesBefore} />}
    </AppShell>
  );
}
