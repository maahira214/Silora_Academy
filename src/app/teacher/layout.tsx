import { requirePageUser } from "@/lib/authz";
import { AppShell } from "@/components/app-shell";
import { totalUnread } from "@/server/chat";
import { unreadNotificationCount } from "@/server/notifications";
import { logout } from "@/app/login/actions";
import { POLICY_VERSION } from "@/lib/legal";
import { ConsentGate } from "@/components/portal/consent-gate";
import { WelcomeCards } from "@/components/portal/welcome-cards";

export default async function Layout({ children }: LayoutProps<"/teacher">) {
  const user = await requirePageUser("TEACHER");
  const [messages, notifications] = await Promise.all([totalUnread(user), unreadNotificationCount(user.id)]);
  return (
    <AppShell
      variant="portal"
      nav={[
        { href: "/teacher", label: "Home", icon: "home", exact: true },
        { href: "/teacher/messages", label: "Messages", icon: "chat", badge: messages },
        { href: "/teacher/classes", label: "My classes", icon: "book" },
      ]}
      user={{ name: user.name }}
      roleLabel="Teacher"
      notificationsHref="/teacher/notifications"
      unreadNotifications={notifications}
      logoutAction={logout}
    >
      {children}
      {user.policyVersion !== POLICY_VERSION ? (
        <ConsentGate role="TEACHER" updated={!!user.policyVersion} />
      ) : (
        !user.welcomedAt && <WelcomeCards role="TEACHER" joinOpensMinutesBefore={user.org.joinOpensMinutesBefore} />
      )}
    </AppShell>
  );
}
