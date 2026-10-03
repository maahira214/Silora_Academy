import Link from "next/link";
import { STATUS_META } from "@/lib/session-status";
import { fmtTime, fmt } from "@/lib/time";
import type { SessionRow } from "@/server/sessions";
import { Badge, EmptyState, Table, Td, Th } from "@/components/ui";

export function StatusBadge({ status }: { status: SessionRow["live"] }) {
  const meta = STATUS_META[status];
  return (
    <Badge tone={meta.tone} dot={status === "LIVE"}>
      {meta.label}
    </Badge>
  );
}

/** Staff view of lessons (dashboard, schedule, class page). */
export function SessionTable({
  sessions,
  timeZone,
  showDate,
  compact,
  empty = "No lessons.",
}: {
  sessions: SessionRow[];
  timeZone: string;
  showDate?: boolean;
  /** Hide class/teacher/student columns (when they're the same for every row). */
  compact?: boolean;
  empty?: string;
}) {
  if (!sessions.length) return <EmptyState title={empty} />;
  return (
    <Table>
      <thead>
        <tr>
          <Th>{showDate ? "Date & time" : "Time"}</Th>
          {!compact && (
            <>
              <Th>Class</Th>
              <Th>Teacher</Th>
              <Th>Student(s)</Th>
            </>
          )}
          <Th>Status</Th>
          <Th>Joined</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {sessions.map((s) => {
          const students = s.course.students;
          return (
            <tr key={s.id} className="hover:bg-slate-50/60">
              <Td className="whitespace-nowrap font-semibold text-navy-900">
                {showDate && <span className="block text-xs font-medium text-slate-500">{fmt(s.startsAt, timeZone, "EEE, d MMM")}</span>}
                {fmtTime(s.startsAt, timeZone)} – {fmtTime(s.endsAt, timeZone)}
                {s.originalStartsAt && <span className="block text-[11px] font-medium text-orange-700">Rescheduled</span>}
              </Td>
              {!compact && (
                <>
                  <Td>
                    <Link href={`/admin/classes/${s.courseId}`} className="font-semibold text-navy-800 hover:underline">
                      {s.course.subject.name}
                    </Link>
                    <span className="block text-xs text-slate-500">{s.course.type === "GROUP" ? "Group" : "One-to-one"}</span>
                  </Td>
                  <Td>{s.course.teacher.name}</Td>
                  <Td className="max-w-[220px]">
                    <span className="line-clamp-2">{students.map((cs) => cs.student.name).join(", ") || "—"}</span>
                  </Td>
                </>
              )}
              <Td>
                <StatusBadge status={s.live} />
              </Td>
              <Td className="whitespace-nowrap text-xs text-slate-600">
                <span className={s.teacherJoined ? "text-emerald-700" : ""}>T {s.teacherJoined ? "✓" : "–"}</span>
                {" · "}
                <span className={s.studentsJoined ? "text-emerald-700" : ""}>
                  S {s.studentsJoined}/{students.length}
                </span>
              </Td>
              <Td className="text-right">
                <Link href={`/admin/sessions/${s.id}`} className="text-xs font-semibold text-gold-700 hover:underline">
                  Details
                </Link>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
