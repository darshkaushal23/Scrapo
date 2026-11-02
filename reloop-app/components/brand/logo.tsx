import Link from "next/link";
import { cx } from "@/lib/cx";

function LoopMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M16.6 8.2a5.2 5.2 0 1 0 1.2 4.4" strokeLinecap="round" />
      <path d="M18.2 6.4V12h-5.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({
  tone = "olive",
  className,
}: {
  tone?: "olive" | "lime";
  className?: string;
}) {
  const ink = tone === "lime" ? "text-lime" : "text-ink";
  return (
    <Link href="/" aria-label="Scrapo home" className={cx("inline-flex items-center gap-2", className)}>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-lime text-on-accent">
        <LoopMark />
      </span>
      <span className={cx("font-sans text-lg leading-none font-extrabold tracking-tight", ink)}>scrapo</span>
    </Link>
  );
}
