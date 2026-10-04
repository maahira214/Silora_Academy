"use client";

import type { SessionStatus } from "@prisma/client";
import { useEffect, useState } from "react";
import { canJoin, durationText, lessonPhase, phaseLabel, type LessonPhase } from "@/lib/lesson-phase";
import { Icon } from "@/components/icons";
import { buttonClass, cx } from "@/components/ui";

const CHIP: Record<LessonPhase, string> = {
  later: "bg-slate-100 text-slate-700",
  soon: "bg-sky-50 text-sky-800",
  open: "bg-gold-100 text-gold-800",
  in_progress: "bg-emerald-50 text-emerald-800",
  finished: "bg-slate-100 text-slate-600",
  cancelled: "bg-slate-100 text-slate-600",
};

/**
 * Status line + Join button for one lesson. Ticks every second in the browser, so the
 * countdown moves and the button turns gold the moment joining opens, without a refresh.
 * The /join route checks access and timing again on the server.
 */
export function LessonLive({
  sessionId,
  status,
  startsAt,
  endsAt,
  joinOpensMinutesBefore,
  startTime,
  serverNow,
  joined,
  waitingFor,
  hero,
}: {
  sessionId: string;
  status: SessionStatus;
  startsAt: string;
  endsAt: string;
  joinOpensMinutesBefore: number;
  /** Local start time, already formatted for the viewer ("6:00 PM"). */
  startTime: string;
  /** Server time when the page rendered, so the first paint matches the server HTML. */
  serverNow: string;
  joined: boolean;
  /** Shown instead of "Class in progress" while the other side hasn't joined, e.g. "Waiting for your teacher". */
  waitingFor?: string;
  hero?: boolean;
}) {
  const [now, setNow] = useState(() => new Date(serverNow));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- switch from the server's clock to the browser's after hydration
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const s = { status, startsAt: new Date(startsAt), endsAt: new Date(endsAt) };
  const phase = lessonPhase(s, joinOpensMinutesBefore, now);
  const label = phase === "in_progress" && waitingFor ? waitingFor : phaseLabel(phase, s.startsAt, now, startTime);
  const opensIn = s.startsAt.getTime() - joinOpensMinutesBefore * 60_000 - now.getTime();

  return (
    <div className={cx("flex gap-3", hero ? "flex-col items-stretch" : "flex-col items-stretch sm:flex-row sm:items-center")}>
      <span
        aria-live="polite"
        className={cx(
          "inline-flex items-center gap-1.5 self-start rounded-full font-bold",
          hero ? "px-4 py-1.5 text-base" : "px-3 py-1 text-xs",
          CHIP[phase],
        )}
      >
        {(phase === "open" || phase === "in_progress") && <span className="size-2 animate-pulse rounded-full bg-current" />}
        {label}
      </span>

      {canJoin(phase) ? (
        <a
          href={`/join/${sessionId}`}
          target="_blank"
          rel="noreferrer"
          className={buttonClass("primary", "lg", cx("w-full sm:w-auto", hero && "h-14 text-lg sm:w-full"))}
        >
          <Icon name="video" className={hero ? "size-6" : "size-5"} />
          {joined ? "Rejoin class" : "Join class"}
        </a>
      ) : phase === "soon" || phase === "later" ? (
        <span
          aria-disabled
          className={buttonClass("secondary", "lg", cx("w-full cursor-default text-slate-500 sm:w-auto", hero && "h-14 sm:w-full"))}
        >
          <Icon name="video" className={hero ? "size-6" : "size-5"} />
          {phase === "soon" ? `Join opens in ${durationText(opensIn)}` : `Join opens ${joinOpensMinutesBefore} min before`}
        </span>
      ) : null}
    </div>
  );
}
