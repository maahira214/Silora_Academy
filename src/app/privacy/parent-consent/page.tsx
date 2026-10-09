import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL, PARENT_CONSENT } from "@/lib/legal";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Parent consent" };

/** A form Silora can print, email or share with parents of students under 18. */
export default function ParentConsentPage() {
  return (
    <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-10 print:p-0 print:shadow-none print:ring-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy-900">{PARENT_CONSENT.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{LEGAL.academy}</p>
        </div>
        <PrintButton />
      </div>

      <p className="mt-6 text-base leading-relaxed text-slate-700">{PARENT_CONSENT.intro}</p>
      <h2 className="mt-6 text-lg font-bold text-navy-900">What this means</h2>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-base leading-relaxed text-slate-700">
        {PARENT_CONSENT.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-slate-600">
        The full privacy policy is at{" "}
        <Link href="/privacy" className="font-semibold text-gold-700 underline">
          {LEGAL.website}/privacy
        </Link>
        .
      </p>

      <h2 className="mt-8 text-lg font-bold text-navy-900">Agreement</h2>
      <p className="mt-2 rounded-xl bg-gold-50 p-4 text-base leading-relaxed text-navy-900 ring-1 ring-gold-200">{PARENT_CONSENT.agreement}</p>
      <dl className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {PARENT_CONSENT.fields.map((f) => (
          <div key={f}>
            <dt className="text-sm font-semibold text-slate-700">{f}</dt>
            <dd className="mt-6 border-b border-slate-400" />
          </div>
        ))}
      </dl>
    </article>
  );
}
