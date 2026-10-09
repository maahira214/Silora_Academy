import { Logo } from "@/components/logo";
import { ButtonLink, Card } from "@/components/ui";

const MESSAGES: Record<string, { title: string; body: string }> = {
  not_yet: { title: "This class isn't open yet", body: "The Join button opens a few minutes before the class starts. Please come back closer to the start time." },
  ended: { title: "This class has finished", body: "The lesson time is over. Check your dashboard for your next class." },
  cancelled: { title: "This lesson was cancelled", body: "Silora Academy cancelled this lesson. Check your dashboard for updates." },
  class_ended: { title: "This class has ended", body: "This class is no longer active. Contact Silora Academy if you think this is a mistake." },
  not_assigned: { title: "You aren't assigned to this class", body: "You can only join classes Silora Academy has assigned to you." },
  not_found: { title: "Class not found", body: "This link doesn't match any class." },
  no_meet: { title: "We're having trouble opening this class", body: "The meeting link isn't ready. Silora operations has been notified and will help you shortly." },
};

export default async function JoinStatusPage({ searchParams }: PageProps<"/join-status">) {
  const sp = await searchParams;
  const reason = typeof sp.reason === "string" ? sp.reason : "not_found";
  const home = typeof sp.home === "string" && sp.home.startsWith("/") && !sp.home.startsWith("//") ? sp.home : "/";
  const msg = MESSAGES[reason] ?? MESSAGES.not_found;
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mb-6 flex justify-center">
          <Logo className="h-12" />
        </div>
        <h1 className="text-xl font-bold text-navy-900">{msg.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{msg.body}</p>
        <ButtonLink href={home} className="mt-6">
          Back to my dashboard
        </ButtonLink>
      </Card>
    </div>
  );
}
