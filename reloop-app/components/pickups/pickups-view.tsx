"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, PageSkeleton, Pill } from "@/components/ui/feedback";
import { categoryLabel, formatDate, statusLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { loadPickups } from "@/lib/supabase/records";
import { useLive } from "@/lib/supabase/use-live";
import { usePrototype } from "@/lib/prototype/session";
import { pickups as mockPickups } from "@/lib/mock/data";
import { useState } from "react";
import type { PickupStatus } from "@/lib/types";

const filters: Array<PickupStatus | "all" | "unassigned"> = [
  "all",
  "requested",
  "scheduled",
  "processing",
  "donated",
  "unassigned",
];

export function PickupsView() {
  const { drafts } = usePrototype();
  const live = useLive("pickups", () => loadPickups(createClient()));
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const basePickups = (live.data && live.data.length > 0) ? live.data : mockPickups;
  const all = [...(drafts ?? []), ...basePickups.filter((p) => !drafts?.some((d) => d.id === p.id))];
  const visible = all.filter((pickup) => {
    if (filter === "all") return true;
    if (filter === "unassigned") return pickup.recycler.name === "Awaiting assignment";
    return pickup.status === filter;
  });

  if (live.phase === "loading") return <PageSkeleton cards={3} />;
  if (live.phase === "error") return <ErrorState title="Pickups did not load" text={live.message} onRetry={live.retry} />;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-sm font-semibold text-olive">Pickup tracking</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Collections</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
          Follow a request from the booking to the student handoff.
        </p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter pickups">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={filter === item}
            className={filter === item ? "rounded-full bg-olive px-3 py-1.5 text-xs font-semibold text-on-accent" : "rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold"}
            onClick={() => setFilter(item)}
          >
            {item === "all" ? "All" : item === "unassigned" ? "Unassigned" : statusLabel[item]}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <EmptyState
          title="No pickups in this filter"
          text="No collections match this filter. Request a pickup from a device listing."
          action={<Button variant="ghost" href="/devices/new">List a device</Button>}
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((pickup) => (
            <li key={pickup.id}>
              <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="paper">{statusLabel[pickup.status]}</Pill>
                  </div>
                  <h2 className="mt-3 text-xl font-medium">{pickup.deviceName}</h2>
                  <p className="text-sm text-muted">
                    {categoryLabel[pickup.category]} · {pickup.city}
                    {pickup.collectionDate ? ` · ${formatDate(pickup.collectionDate)}` : " · date not set"}
                  </p>
                  <p className="mt-1 text-sm text-muted">{pickup.recycler.name}</p>
                </div>
                <Button href={`/pickups/${pickup.id}`} variant="olive">
                  Open timeline
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
