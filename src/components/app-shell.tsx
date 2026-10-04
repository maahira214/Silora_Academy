"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/logo";
import { Icon, type IconName } from "@/components/icons";
import { HelpButton } from "@/components/help-button";
import { Avatar, cx } from "@/components/ui";

/** `more: true` puts an item in the collapsible "More" group (admin only). */
export type NavItem = { href: string; label: string; icon: IconName; badge?: number; exact?: boolean; more?: boolean };

/**
 * Page frame for every signed-in screen.
 * - variant "portal" (teachers, students): 3 menu items, shown as a bottom bar on phones,
 *   with "Need help?" always in the header.
 * - variant "admin" (Silora staff): sidebar, a menu drawer on phones, rarely used pages under "More".
 */
export function AppShell({
  nav,
  user,
  roleLabel,
  notificationsHref,
  unreadNotifications,
  logoutAction,
  variant = "admin",
  children,
}: {
  nav: NavItem[];
  user: { name: string };
  roleLabel: string;
  notificationsHref: string;
  unreadNotifications: number;
  logoutAction: () => Promise<void>;
  variant?: "admin" | "portal";
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
  const main = nav.filter((i) => !i.more);
  const more = nav.filter((i) => i.more);
  const [moreOpen, setMoreOpen] = useState(() => more.some(isActive));
  const portal = variant === "portal";

  const navLink = (item: NavItem) => {
    const active = isActive(item);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        className={cx(
          "flex items-center gap-3 rounded-xl px-3 font-semibold transition-colors",
          portal ? "py-3 text-base" : "py-2.5 text-sm",
          active ? "bg-gold-500 text-navy-900" : "text-navy-100 hover:bg-navy-700 hover:text-white",
        )}
      >
        <Icon name={item.icon} />
        <span className="flex-1">{item.label}</span>
        <CountBadge n={item.badge} active={active} />
      </Link>
    );
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-navy-800 text-navy-100">
      <div className="flex h-16 items-center px-5">
        <Link href={nav[0]?.href ?? "/"} onClick={() => setOpen(false)}>
          <Logo inverted />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {main.map(navLink)}
        {more.length > 0 && (
          <div className="pt-3">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-navy-200 hover:bg-navy-700 hover:text-white"
            >
              <Icon name="more" />
              <span className="flex-1 text-left">More</span>
              <Icon name="chevronDown" className={cx("size-4 transition-transform", moreOpen && "rotate-180")} />
            </button>
            {moreOpen && <div className="mt-1 space-y-1 pl-3">{more.map(navLink)}</div>}
          </div>
        )}
      </nav>
      <div className="border-t border-navy-700 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar name={user.name} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{user.name}</div>
            <div className="text-xs text-navy-300">{roleLabel}</div>
          </div>
          <form action={logoutAction}>
            <button title="Sign out" className="rounded-lg p-2 text-navy-200 hover:bg-navy-700 hover:text-white">
              <Icon name="logout" />
              <span className="sr-only">Sign out</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {/* Admin menu drawer on phones */}
      {!portal && open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw]">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          {!portal && (
            <button className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)}>
              <Icon name="menu" />
              <span className="sr-only">Open menu</span>
            </button>
          )}
          <div className="lg:hidden">
            <Logo compact={portal} />
          </div>
          <div className="flex-1" />
          {portal && <HelpButton />}
          <Link href={notificationsHref} className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100" title="Notifications">
            <Icon name="bell" className="size-6" />
            {unreadNotifications > 0 && (
              <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
            <span className="sr-only">Notifications</span>
          </Link>
          {portal && (
            // Phones have no sidebar, so the account and sign-out live here.
            <details className="relative lg:hidden">
              <summary className="list-none rounded-full p-1 [&::-webkit-details-marker]:hidden" title="Account">
                <Avatar name={user.name} />
              </summary>
              <div className="absolute right-0 top-12 w-56 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-slate-200">
                <div className="truncate px-2 font-semibold text-navy-900">{user.name}</div>
                <div className="px-2 text-xs text-slate-500">{roleLabel}</div>
                <form action={logoutAction} className="mt-2">
                  <button className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                    <Icon name="logout" /> Sign out
                  </button>
                </form>
              </div>
            </details>
          )}
        </header>
        <main className={cx("mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8", portal && "pb-28 lg:pb-6")}>{children}</main>
      </div>

      {/* Teacher/student menu on phones: always visible at the bottom */}
      {portal && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${main.length}, minmax(0, 1fr))` }}>
            {main.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx("relative flex flex-col items-center gap-1 py-2.5 text-xs font-semibold", active ? "text-navy-900" : "text-slate-500")}
                >
                  <span className={cx("grid h-8 w-14 place-items-center rounded-full", active && "bg-gold-500")}>
                    <Icon name={item.icon} className="size-6" />
                  </span>
                  {item.label}
                  {!!item.badge && (
                    <span className="absolute left-1/2 top-1.5 ml-3 min-w-5 rounded-full bg-red-500 px-1.5 text-center text-[11px] font-bold leading-5 text-white">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

function CountBadge({ n, active }: { n?: number; active: boolean }) {
  if (!n) return null;
  return (
    <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-bold", active ? "bg-navy-900 text-white" : "bg-red-500 text-white")}>
      {n > 99 ? "99+" : n}
    </span>
  );
}
