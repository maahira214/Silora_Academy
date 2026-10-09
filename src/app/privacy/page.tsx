import type { Metadata } from "next";
import { LEGAL, PRIVACY_SECTIONS } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-10">
      <h1 className="text-3xl font-bold text-navy-900">Privacy policy</h1>
      <p className="mt-2 text-sm text-slate-500">
        {LEGAL.academy} · Last updated {LEGAL.lastUpdated}
      </p>
      <p className="mt-6 text-base leading-relaxed text-slate-700">
        This explains what information the {LEGAL.academy} app keeps about teachers, students and parents, why, who can see it and how
        long we keep it. We have written it in plain words. If anything is unclear, write to{" "}
        <a href={`mailto:${LEGAL.privacyEmail}`} className="font-semibold text-gold-700 underline">
          {LEGAL.privacyEmail}
        </a>
        .
      </p>

      <nav aria-label="Contents" className="mt-6 rounded-xl bg-slate-50 p-4 text-sm">
        <ol className="grid gap-1 sm:grid-cols-2">
          {PRIVACY_SECTIONS.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-navy-800 hover:underline">
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {PRIVACY_SECTIONS.map((s, i) => (
        <section key={s.id} id={s.id} className="mt-10 scroll-mt-6">
          <h2 className="text-xl font-bold text-navy-900">
            {i + 1}. {s.title}
          </h2>
          {s.bullets && (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-slate-700">
              {s.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          {s.paragraphs?.map((p) => (
            <p key={p} className="mt-3 text-base leading-relaxed text-slate-700">
              {p}
            </p>
          ))}
          {s.table && (
            <table className="mt-3 w-full text-left text-sm">
              <tbody className="divide-y divide-slate-100">
                {s.table.map(([what, how]) => (
                  <tr key={what}>
                    <th className="py-2 pr-4 align-top font-semibold text-slate-800">{what}</th>
                    <td className="py-2 text-slate-700">{how}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </article>
  );
}
