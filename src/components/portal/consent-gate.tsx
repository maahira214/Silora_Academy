"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { acceptPolicyAction } from "@/app/portal-actions";
import { CONSENT_POINTS } from "@/lib/legal";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";

/**
 * Shown before anything else until the user agrees to the current privacy policy
 * (again whenever POLICY_VERSION changes). Can't be closed without agreeing.
 */
export function ConsentGate({ role, updated }: { role: "TEACHER" | "STUDENT"; updated: boolean }) {
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-navy-950/70 p-4" role="dialog" aria-modal aria-labelledby="consent-title">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="grid size-14 place-items-center rounded-2xl bg-gold-100 text-gold-700">
          <Icon name="shield" className="size-8" />
        </div>
        <h2 id="consent-title" className="mt-4 text-2xl font-bold text-navy-900">
          {updated ? "Our privacy policy has changed" : "Before you start"}
        </h2>
        <p className="mt-2 text-base text-slate-600">Please read how Silora Academy looks after your information.</p>
        <ul className="mt-4 space-y-2.5">
          {CONSENT_POINTS.map((p) => (
            <li key={p} className="flex gap-2.5 text-base leading-snug text-slate-800">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-gold-500" />
              {p}
            </li>
          ))}
        </ul>
        <Link href="/privacy" target="_blank" className="mt-4 inline-block text-base font-semibold text-gold-700 underline">
          Read the full privacy policy
        </Link>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-navy-800" />
          <span className="text-base text-slate-800">
            I have read the privacy policy and I agree.
            {role === "STUDENT" && " If I am under 18, my parent or guardian has agreed too."}
          </span>
        </label>
        <Button
          size="lg"
          className="mt-5 h-14 w-full text-lg"
          disabled={!checked || pending}
          onClick={() =>
            start(async () => {
              await acceptPolicyAction();
              setDone(true);
            })
          }
        >
          {pending ? "Saving…" : "I agree"}
        </Button>
      </div>
    </div>
  );
}
