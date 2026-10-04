"use client";

import { useState, useTransition } from "react";
import { finishWelcomeAction } from "@/app/portal-actions";
import { Icon, type IconName } from "@/components/icons";
import { Button, cx } from "@/components/ui";

/** Three short cards shown once, the first time a teacher or student signs in. */
export function WelcomeCards({ role, joinOpensMinutesBefore }: { role: "TEACHER" | "STUDENT"; joinOpensMinutesBefore: number }) {
  const [step, setStep] = useState(0);
  const [closed, setClosed] = useState(false);
  const [pending, start] = useTransition();
  const other = role === "TEACHER" ? "your students" : "your teacher";

  const cards: { icon: IconName; title: string; body: string[] }[] = [
    {
      icon: "video",
      title: "Join your class in one tap",
      body: [
        `Your next class is at the top of Home. The gold Join class button opens ${joinOpensMinutesBefore} minutes before it starts.`,
        "When Google Meet opens, use the same Google account you signed in with here.",
      ],
    },
    {
      icon: "chat",
      title: `Message ${other} here`,
      body: [
        `Open Messages to talk with ${other}. You can send photos, worksheets and documents.`,
        "Every class has its own chat, and its files are under the Files tab.",
      ],
    },
    {
      icon: "shield",
      title: "Keep contact details private",
      body: [
        "Don't share phone numbers, WhatsApp, email or social media in messages. Silora checks for them.",
        "Need something? Tap Need help? at the top of any screen.",
      ],
    },
  ];
  if (closed) return null;
  const card = cards[step];
  const last = step === cards.length - 1;
  const finish = () =>
    start(async () => {
      await finishWelcomeAction();
      setClosed(true);
    });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/60 p-4" role="dialog" aria-modal aria-labelledby="welcome-title">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-gold-700">Welcome to Silora Academy</span>
          <span className="text-sm font-semibold text-slate-400">
            {step + 1} of {cards.length}
          </span>
        </div>
        <div className="mt-6 grid size-16 place-items-center rounded-2xl bg-gold-100 text-gold-700">
          <Icon name={card.icon} className="size-9" />
        </div>
        <h2 id="welcome-title" className="mt-5 text-2xl font-bold text-navy-900">
          {card.title}
        </h2>
        {card.body.map((p) => (
          <p key={p} className="mt-3 text-base leading-relaxed text-slate-700">
            {p}
          </p>
        ))}
        <div className="mt-6 flex items-center justify-center gap-2" aria-hidden>
          {cards.map((_, i) => (
            <span key={i} className={cx("h-2 rounded-full transition-all", i === step ? "w-6 bg-gold-500" : "w-2 bg-slate-200")} />
          ))}
        </div>
        <div className="mt-6 flex gap-3">
          {step > 0 && (
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button size="lg" className="flex-1" disabled={pending} onClick={last ? finish : () => setStep(step + 1)}>
            {last ? "Got it" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
