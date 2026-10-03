import type { Metadata } from "next";
import { requirePageUser } from "@/lib/authz";
import { NotificationsPage } from "@/components/notifications-page";

export const metadata: Metadata = { title: "Notifications" };

export default async function Page() {
  return <NotificationsPage user={await requirePageUser("SUPER_ADMIN", "OPERATIONS")} />;
}
