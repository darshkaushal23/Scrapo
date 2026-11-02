"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/card";
import { usePrototype } from "@/lib/prototype/session";

const links = [
  { href: "/#how", label: "How it works" },
  { href: "/#impact", label: "Impact" },
  { href: "/#donate", label: "Donate" },
  { href: "/#students", label: "Students" },
  { href: "/#rewards", label: "Rewards" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { ready, profile, signOut } = usePrototype();
  const isLoggedIn = ready && Boolean(profile.name);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm font-semibold text-muted lg:flex" aria-label="Primary">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-lime">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {isLoggedIn ? (
            <>
              <Link href="/dashboard" className={buttonClass("lime", "sm")}>
                Go to Dashboard
              </Link>
              <button type="button" onClick={signOut} className={buttonClass("ghost", "sm")}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={buttonClass("ghost", "sm")}>
                Log in
              </Link>
              <Link href="/signup" className={buttonClass("lime", "sm")}>
                Get started
              </Link>
            </>
          )}
        </div>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-line bg-card lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </Container>
      {open ? (
        <div id="mobile-nav" className="border-t border-line bg-card lg:hidden">
          <Container className="flex flex-col gap-1 py-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-2xl px-3 py-3 text-sm font-semibold"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {isLoggedIn ? (
              <>
                <Link href="/dashboard" className={buttonClass("lime", "md", "mt-2")} onClick={() => setOpen(false)}>
                  Go to Dashboard
                </Link>
                <button
                  type="button"
                  className={buttonClass("ghost", "md")}
                  onClick={() => {
                    signOut();
                    setOpen(false);
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className={buttonClass("ghost", "md", "mt-2")} onClick={() => setOpen(false)}>
                  Log in
                </Link>
                <Link href="/signup" className={buttonClass("lime", "md")} onClick={() => setOpen(false)}>
                  Get started
                </Link>
              </>
            )}
          </Container>
        </div>
      ) : null}
    </header>
  );
}
