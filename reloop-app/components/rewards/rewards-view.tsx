"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, PageSkeleton, Pill } from "@/components/ui/feedback";
import { formatDate, formatNumber } from "@/lib/format";
import { ecoLevels } from "@/lib/mock/data";
import { usePrototype } from "@/lib/prototype/session";
import { createClient } from "@/lib/supabase/client";
import { loadRewards } from "@/lib/supabase/records";
import { useLive } from "@/lib/supabase/use-live";

export function RewardsView() {
  const { ready, profile } = usePrototype();
  const live = useLive("rewards", () => loadRewards(createClient()));
  const [monthOnly, setMonthOnly] = useState(false);
  const board = live.data?.board ?? [];
  const winners = board.slice(0, 3);
  const history = live.data?.history ?? [];
  const results = live.data?.results ?? [];
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthName = new Date().toLocaleDateString("en-IN", { month: "long", timeZone: "UTC" });
  const visibleHistory = monthOnly ? history.filter((event) => event.at.startsWith(monthKey)) : history;
  const nextLevel = ecoLevels.find((level) => level.from > profile.pointsLifetime);
  const currentLevel = [...ecoLevels].reverse().find((level) => profile.pointsLifetime >= level.from) ?? ecoLevels[0];
  const progress = nextLevel
    ? Math.min(100, Math.round((profile.pointsLifetime / nextLevel.from) * 100))
    : 100;

  if (!ready || live.phase === "loading") return <PageSkeleton />;
  if (live.phase === "error") return <ErrorState title="Rewards did not load" text={live.message} onRetry={live.retry} />;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <p className="text-sm font-semibold text-olive">Scrapo Rewards</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{monthName} board</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Monthly points decide the podium. Lifetime points decide the eco level.
        </p>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        {winners.map((entry) => (
          <Card key={entry.rank} className={entry.rank === 1 ? "border-lime md:-translate-y-2" : ""}>
            <p className="text-sm font-semibold text-olive">Winner #{entry.rank}</p>
            <h2 className="mt-2 text-2xl font-medium">{entry.name}</h2>
            <p className="text-sm text-muted">{entry.city}</p>
            <p className="mt-4 font-display text-3xl">{formatNumber(entry.points)}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <h2 className="text-xl font-medium">Monthly leaderboard</h2>
          <ol className="mt-4 divide-y divide-line">
            {board.map((entry) => (
              <li key={entry.rank} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold">
                    #{entry.rank} {entry.name}
                    {entry.highlight ? <span className="ml-2 text-olive">You</span> : null}
                  </p>
                  <p className="text-xs text-muted">{entry.city}</p>
                </div>
                <p className="font-display text-lg">{formatNumber(entry.points)}</p>
              </li>
            ))}
          </ol>
        </Card>
        <div className="space-y-4">
          <Card>
            <h2 className="text-xl font-medium">Points</h2>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-paper p-4">
                <dt className="text-xs font-semibold text-muted">This month</dt>
                <dd className="mt-1 font-display text-3xl">{formatNumber(profile.pointsMonth)}</dd>
              </div>
              <div className="rounded-2xl bg-paper p-4">
                <dt className="text-xs font-semibold text-muted">Lifetime</dt>
                <dd className="mt-1 font-display text-3xl">{formatNumber(profile.pointsLifetime)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm font-semibold">Eco level · {currentLevel.name}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
              <div className="h-full bg-olive" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">
              {nextLevel
                ? `${formatNumber(nextLevel.from - profile.pointsLifetime)} lifetime points to ${nextLevel.name}.`
                : "Top eco level."}
            </p>
          </Card>
          <Card>
            <h2 className="text-xl font-medium">Eco levels</h2>
            <ul className="mt-4 space-y-3">
              {ecoLevels.map((level) => (
                <li key={level.name} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{level.name}</p>
                    <p className="text-xs text-muted">{level.summary}</p>
                  </div>
                  <Pill tone={level.name === currentLevel.name ? "olive" : "paper"}>{formatNumber(level.from)}+</Pill>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-medium">Reward history</h2>
          <Button variant={monthOnly ? "olive" : "ghost"} size="sm" onClick={() => setMonthOnly((value) => !value)}>
            {monthOnly ? "All history" : "This month"}
          </Button>
        </div>
        {visibleHistory.length === 0 ? (
          <EmptyState
            title="No rewards in this view"
            text="Verified donations are added here. Nothing in this account matches the filter."
          />
        ) : (
          <ul className="space-y-3">
            {visibleHistory.map((event) => (
              <li key={event.id}>
                <Card className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{event.label}</p>
                    <p className="text-xs text-muted">{formatDate(event.at)}</p>
                  </div>
                  <p className="font-display text-xl text-olive">+{formatNumber(event.points)}</p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-medium">Previous monthly results</h2>
        {results.length === 0 ? (
          <EmptyState
            title="No earlier results"
            text="Finalized months show up here after an admin publishes the top three."
          />
        ) : (
          <ul className="space-y-3">
            {results.map((result) => (
              <li key={`${result.month}-${result.rank}`}>
                <Card className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">#{result.rank} {result.full_name}</p>
                    <p className="text-xs text-muted">{formatDate(result.month)} · {result.city || "City not set"}</p>
                  </div>
                  <p className="font-display text-xl text-olive">{formatNumber(result.points)}</p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
