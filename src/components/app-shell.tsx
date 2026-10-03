"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/logo";
import { Icon, type IconName } from "@/components/icons";
import { Avatar, cx } from "@/components/ui";

export type NavItem = { href: string; label: string; icon: IconName; badge?: number; exact?: boolean };

export function AppShell({
  nav,
  user,
  roleLabel,
  notificationsHref,
  unreadNotifications,
  logoutAction,
  children,
}: {
  nav: NavItem[];
  user: { name: string };
  roleLabel: string;
  notificationsHref: string;
  unreadNotifications: number;
  logoutAction: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");

  const sidebar = (
    <div className="flex h-full flex-col bg-navy-800 text-navy-100">
      <div className="flex h-16 items-center px-5">
        <Link href={nav[0]?.href ?? "/"} onClick={() => setOpen(false)}>
          <Logo inverted />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {nav.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                active ? "bg-gold-500 text-navy-900" : "text-navy-100 hover:bg-navy-700 hover:text-white",
              )}
            >
              <Icon name={item.icon} />
              <span className="flex-1">{item.label}</span>
              {!!item.badge && (
                <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-bold", active ? "bg-navy-900 text-white" : "bg-red-500 text-white")}>
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </Link>
          );
        })}
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

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw]">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)}>
            <Icon name="menu" />
            <span className="sr-only">Open menu</span>
          </button>
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="flex-1" />
          <Link href={notificationsHref} className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100" title="Notifications">
            <Icon name="bell" />
            {unreadNotifications > 0 && (
              <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
            <span className="sr-only">Notifications</span>
          </Link>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
