"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";
import { requestHelpAction } from "@/app/portal-actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/icons";
import { cx } from "@/components/ui";

/** "Need help?" on every teacher/student screen. Sends a message to Silora operations. */
export function HelpButton({ className }: { className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold text-navy-800 ring-1 ring-slate-300 hover:bg-slate-50", className)}
      >
        <Icon name="help" className="size-4" />
        Need help?
      </button>
      <dialog
        ref={dialog}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl p-0 shadow-xl backdrop:bg-navy-950/50"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-navy-900">Need help?</h2>
              <p className="mt-1 text-sm text-slate-600">Tell Silora Academy what&apos;s wrong. Someone will contact you soon.</p>
            </div>
            <button type="button" onClick={() => dialog.current?.close()} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
              <Icon name="x" />
              <span className="sr-only">Close</span>
            </button>
          </div>
          <ActionForm action={requestHelpAction} resetOnSuccess className="space-y-3">
            <input type="hidden" name="page" value={pathname} />
            <textarea
              name="note"
              required
              maxLength={1000}
              rows={4}
              placeholder="For example: I can't join my 6 PM class"
              className="w-full rounded-xl border-0 px-4 py-3 text-base ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-gold-500"
            />
            <SubmitButton className="h-12 w-full text-base">Send to Silora</SubmitButton>
          </ActionForm>
        </div>
      </dialog>
    </>
  );
}
