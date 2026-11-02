"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, PageSkeleton, Pill } from "@/components/ui/feedback";
import { formatDate, formatInr, formatNumber } from "@/lib/format";
import { usePrototype } from "@/lib/prototype/session";
import { createClient } from "@/lib/supabase/client";
import { loadDashboard } from "@/lib/supabase/records";
import { useLive } from "@/lib/supabase/use-live";
import type { ActivityItem } from "@/lib/types";
import { DonorTrackerCard } from "@/components/tracker/donor-tracker-card";
import { pickups } from "@/lib/mock/data";

const filters: Array<{ id: "all" | ActivityItem["kind"] | "archive"; label: string }> = [
  { id: "all", label: "All" },
  { id: "pickup", label: "Pickups" },
  { id: "reward", label: "Rewards" },
  { id: "donation", label: "Donations" },
  { id: "archive", label: "Archive" },
];

export function DashboardView() {
  const { profile, ready } = usePrototype();
  const live = useLive("dashboard", () => loadDashboard(createClient()));
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const activity = live.data?.activity;
  const { drafts } = usePrototype();
  const donorPickups = useMemo(() => [...drafts, ...pickups], [drafts]);

  const items = useMemo(() => {
    const rows = activity ?? [];
    if (filter === "archive") return [];
    if (filter === "all") return rows;
    return rows.filter((item) => item.kind === filter);
  }, [activity, filter]);

  if (!ready || live.phase === "loading") return <PageSkeleton />;
  if (live.phase === "error") {
    return (
      <ErrorState
        title="The dashboard did not load"
        text={live.message}
        onRetry={live.retry}
      />
    );
  }

  const stats = [
    { label: "Donated devices", value: String(live.data?.donatedCount ?? 0), hint: "Devices marked donated or completed" },
    { label: "Estimated value", value: formatInr(live.data?.estimatedValue ?? 0), hint: "Sum of those devices" },
    { label: "Reward points", value: formatNumber(profile.pointsMonth), hint: "This month" },
    { label: "Leaderboard", value: profile.rank ? `#${profile.rank}` : "—", hint: "Rank by points this month" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-olive">
            {profile.personalized ? profile.role : "Sign in to see your records"}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Hello{profile.name ? `, ${profile.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            {profile.role === "student"
              ? "Your student tools live in the marketplace. Counts here come from your account."
              : "Track what you have handed over, what it was worth, and where you sit on the monthly board."}
          </p>
        </div>
        <Button href="/devices/new">List a device</Button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Summary">
        {stats.map((stat, index) => (
          <Card key={stat.label} className={index === 0 ? "bg-lime text-on-accent sm:col-span-2 xl:col-span-2" : ""}>
            <p className={index === 0 ? "text-sm font-semibold text-on-accent/70" : "text-sm font-semibold text-muted"}>{stat.label}</p>
            <p className={index === 0 ? "mt-3 font-display text-5xl font-extrabold text-on-accent" : "mt-2 font-display text-3xl font-extrabold text-ink"}>{stat.value}</p>
            <p className={index === 0 ? "mt-2 text-xs leading-5 text-on-accent/70" : "mt-2 text-xs leading-5 text-muted"}>{stat.hint}</p>
          </Card>
        ))}
      </section>

      {/* Scrapo AI Tracker: Donated Devices Live Journey */}
      <DonorTrackerCard pickups={donorPickups} />

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-medium">Recent activity</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter activity">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                className={
                  filter === item.id
                    ? "rounded-full bg-olive px-3 py-1.5 text-xs font-semibold text-on-accent"
                    : "rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold"
                }
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {items.length === 0 ? (
          <EmptyState
            title={filter === "archive" ? "Nothing in the archive" : "No activity yet"}
            text="Pickups and reward events for this account show up here."
            action={
              filter === "all" ? (
                <Button href="/devices/new">List a device</Button>
              ) : (
                <Button variant="ghost" onClick={() => setFilter("all")}>
                  Show all activity
                </Button>
              )
            }
          />
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id}>
                <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Pill tone="paper">{item.kind}</Pill>
                      <span className="text-xs text-muted">{formatDate(item.at)}</span>
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-ink">{item.title}</h3>
                    <p className="text-sm text-muted">{item.detail}</p>
                  </div>
                  {"href" in item && item.href ? (
                    <Button href={item.href} variant="ghost" size="sm">
                      {"certificate" in item && item.certificate ? "View certificate" : "Track pickup"}
                    </Button>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
