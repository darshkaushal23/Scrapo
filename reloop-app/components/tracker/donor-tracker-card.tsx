"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { formatDate, statusLabel } from "@/lib/format";
import type { PickupRecord } from "@/lib/types";
import { detectPickupDelay } from "@/lib/gemini/delay-detector";

export function DonorTrackerCard({ pickups }: { pickups: PickupRecord[] }) {
  const delayedCount = useMemo(() => {
    return pickups.filter((p) => detectPickupDelay(p).delayDetected).length;
  }, [pickups]);

  return (
    <Card className="border border-line bg-card">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-olive">
              Scrapo AI Tracker
            </span>
            <Pill tone="paper">Live Tracking</Pill>
          </div>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-ink sm:text-2xl">
            My Donated Devices & Live Journey
          </h2>
          <p className="text-xs text-muted">
            Track pickup coordination, recycler intake, data sanitisation, and student matching.
          </p>
        </div>

        {delayedCount > 0 && (
          <Pill tone="danger">
            {delayedCount} Pickup{delayedCount > 1 ? "s" : ""} Experiencing Delay
          </Pill>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {pickups.map((pickup) => {
          const delay = detectPickupDelay(pickup);
          return (
            <div
              key={pickup.id}
              className="flex flex-col gap-3 rounded-2xl border border-line bg-paper/30 p-4 transition-colors hover:border-olive/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-ink">{pickup.deviceName}</h3>
                  <Pill tone="paper">{statusLabel[pickup.status]}</Pill>
                  {delay.delayDetected ? (
                    <Pill tone="danger">Delay ({delay.daysOverdue}d overdue)</Pill>
                  ) : (
                    <Pill tone="lime">On Track</Pill>
                  )}
                </div>

                <p className="text-xs text-muted">
                  Tracking ID: <span className="font-mono text-ink">{pickup.trackingId}</span> · Partner: <strong>{pickup.recycler.name}</strong>
                  {pickup.collectionDate ? ` · Scheduled: ${formatDate(pickup.collectionDate)}` : ""}
                </p>

                {delay.delayDetected && (
                  <p className="text-[11px] text-danger font-medium">
                    ⚠️ {delay.delayReason}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button href={`/pickups/${pickup.id}`} variant="olive" size="sm">
                  View AI Tracker & Passport
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
