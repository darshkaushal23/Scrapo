"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { buttonClass } from "@/components/ui/button";
import { formatNumber, roleLabel } from "@/lib/format";
import { usePrototype } from "@/lib/prototype/session";
import { cx } from "@/lib/cx";
import type { Role } from "@/lib/types";

const donorNav = [
  { href: "/dashboard", label: "Overview" },
  { href: "/verify", label: "Scrapo Verify" },
  { href: "/devices/new", label: "List a device" },
  { href: "/pickups", label: "Pickups" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/rewards", label: "Rewards" },
];

const recyclerNav = [
  { href: "/verify", label: "Scrapo Verify" },
  { href: "/recycler", label: "Assigned pickups" },
];

const adminNav = [
  { href: "/admin#users", label: "Users" },
  { href: "/admin#scrapo-verify", label: "Scrapo Verify" },
  { href: "/admin#fairaccess", label: "FairAccess" },
  { href: "/admin#recyclers", label: "Recyclers" },
  { href: "/admin#trustshield", label: "TrustShield" },
  { href: "/admin#donations", label: "Donations" },
  { href: "/admin#reward-desk", label: "Rewards" },
  { href: "/admin#winners", label: "Winners" },
  { href: "/admin#impact", label: "Impact" },
];

function navFor(role: Role) {
  if (role === "admin") return adminNav;
  if (role === "recycler") return recyclerNav;
  return donorNav;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { profile, ready, signOut } = usePrototype();
  const [open, setOpen] = useState(false);
  const items = navFor(profile.role);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const nav = (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Workspace">
      {items.map((item) => {
        const active = pathname === item.href || (item.href.indexOf("#") === -1 && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={() => setOpen(false)}
            className={cx(
              "rounded-2xl px-3 py-2.5 text-sm font-semibold",
              active ? "bg-lime text-on-accent" : "text-muted hover:bg-paper hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-sidebar px-4 py-5 lg:flex">
        <Logo />
        <p className="mt-6 px-3 text-xs font-semibold tracking-wide text-olive">Workspace</p>
        <div className="mt-2">{nav}</div>
        <div className="mt-auto rounded-3xl bg-paper p-4">
          <p className="text-sm font-semibold">{ready ? profile.name : "Loading profile"}</p>
          <p className="text-xs text-muted">{roleLabel[profile.role]} · {profile.city}</p>
          {profile.role === "donor" || profile.role === "student" ? (
            <p className="mt-2 font-display text-lg text-olive">{formatNumber(profile.pointsMonth)} pts this month</p>
          ) : null}
          <Link href="/" className="mt-3 inline-block text-xs font-semibold text-olive">
            Back to the site
          </Link>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-background px-4 py-3 sm:px-6">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full border border-line bg-card lg:hidden"
            aria-expanded={open}
            aria-controls="workspace-nav"
            onClick={() => setOpen(true)}
          >
            <span className="sr-only">Open workspace menu</span>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <div className="lg:hidden">
            <Logo />
          </div>
          <button type="button" className={buttonClass("ghost", "sm", "ml-auto")} onClick={signOut}>
            Sign out
          </button>
        </header>
        <div className="px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div id="workspace-nav" role="dialog" aria-modal="true" aria-label="Workspace menu" className="absolute inset-y-0 left-0 flex w-[min(100%,20rem)] flex-col bg-sidebar p-4">
            <div className="mb-4 flex items-center justify-between">
              <Logo />
              <button type="button" className="text-sm font-semibold" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            {nav}
          </div>
        </div>
      ) : null}
    </div>
  );
}
