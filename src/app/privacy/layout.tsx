import Link from "next/link";
import { Logo } from "@/components/logo";

/** Public pages (no sign-in needed): privacy policy and the parent consent form. */
export default function Layout({ children }: LayoutProps<"/privacy">) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/">
            <Logo />
          </Link>
          <nav className="flex gap-4 text-sm font-semibold text-slate-600">
            <Link href="/privacy" className="hover:text-navy-900">
              Privacy policy
            </Link>
            <Link href="/privacy/parent-consent" className="hover:text-navy-900">
              Parent consent
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">{children}</main>
    </div>
  );
}
