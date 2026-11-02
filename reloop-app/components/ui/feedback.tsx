import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";

export function Pill({
  children,
  tone = "lime",
}: {
  children: ReactNode;
  tone?: "lime" | "olive" | "paper" | "danger";
}) {
  const tones = {
    lime: "bg-lime text-on-accent",
    olive: "bg-lime text-on-accent",
    paper: "bg-paper text-muted",
    danger: "bg-danger/10 text-danger",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function DemoBanner({ children }: { children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-paper px-4 py-3 text-sm leading-6 text-ink">
      <span className="font-semibold text-lime">Demo data.</span>{" "}
      {children ??
        "Names, points, prices, and pickups on this screen come from Supabase."}
    </div>
  );
}

export function PageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="h-8 w-56 animate-pulse rounded-full bg-paper" />
      <div className="h-16 animate-pulse rounded-2xl bg-paper" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: cards }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-[20px] bg-paper" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-[20px] bg-paper" />
    </div>
  );
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-dashed border-line bg-card px-6 py-12 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-lime text-on-accent">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="11" cy="11" r="6" />
          <path d="M16 16l4 4" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="text-xl font-medium text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{text}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "This view did not load",
  text = "Try again. If you are signed in, your records stay in Supabase.",
  onRetry,
}: {
  title?: string;
  text?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-[20px] border border-danger/30 bg-card px-6 py-12 text-center" role="alert">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-danger/10 text-danger">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M12 8v5" strokeLinecap="round" />
          <circle cx="12" cy="16.5" r="0.8" fill="currentColor" />
          <circle cx="12" cy="12" r="8" />
        </svg>
      </div>
      <h2 className="text-xl font-medium text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{text}</p>
      {onRetry ? (
        <Button className="mt-5" variant="olive" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
