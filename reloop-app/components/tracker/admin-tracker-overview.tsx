import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/feedback";
import type { PickupRecord } from "@/lib/types";
import { detectPickupDelay } from "@/lib/gemini/delay-detector";

export function AdminTrackerOverview({ pickups }: { pickups: PickupRecord[] }) {
  const total = pickups.length;
  const pendingPickups = pickups.filter((p) => p.status === "requested" || p.status === "scheduled").length;
  const delayedPickups = pickups.filter((p) => detectPickupDelay(p).delayDetected).length;
  const awaitingInspection = pickups.filter((p) => p.status === "collected").length;
  const underRepair = pickups.filter((p) => p.status === "processing").length;
  const donated = pickups.filter((p) => p.status === "donated").length;
  const recycled = pickups.filter((p) => p.status === "completed").length;

  return (
    <Card className="border border-line bg-card">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-olive">
              Scrapo AI Tracker
            </span>
            <Pill tone="paper">Operations Overview</Pill>
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Live Device Logistics & Delay Monitoring
          </h2>
          <p className="text-xs text-muted">
            Deterministic stage deadline metrics across active circular electronics inventory.
          </p>
        </div>

        {delayedPickups > 0 ? (
          <Pill tone="danger">{delayedPickups} Delayed Shipments</Pill>
        ) : (
          <Pill tone="lime">All Stages Healthy</Pill>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7 text-center">
        <div className="rounded-2xl border border-line bg-paper/40 p-3">
          <p className="text-xs text-muted">Total Devices</p>
          <p className="mt-1 text-2xl font-bold text-ink">{total}</p>
        </div>

        <div className="rounded-2xl border border-line bg-paper/40 p-3">
          <p className="text-xs text-muted">Pending Pickups</p>
          <p className="mt-1 text-2xl font-bold text-ink">{pendingPickups}</p>
        </div>

        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-3">
          <p className="text-xs text-danger font-semibold">Delayed Pickups</p>
          <p className="mt-1 text-2xl font-bold text-danger">{delayedPickups}</p>
        </div>

        <div className="rounded-2xl border border-line bg-paper/40 p-3">
          <p className="text-xs text-muted">Awaiting Inspection</p>
          <p className="mt-1 text-2xl font-bold text-ink">{awaitingInspection}</p>
        </div>

        <div className="rounded-2xl border border-line bg-paper/40 p-3">
          <p className="text-xs text-muted">Repair Assessment</p>
          <p className="mt-1 text-2xl font-bold text-ink">{underRepair}</p>
        </div>

        <div className="rounded-2xl border border-olive/30 bg-olive/10 p-3">
          <p className="text-xs text-olive font-semibold">Devices Donated</p>
          <p className="mt-1 text-2xl font-bold text-olive">{donated}</p>
        </div>

        <div className="rounded-2xl border border-line bg-paper/40 p-3">
          <p className="text-xs text-muted">Parts Recovery</p>
          <p className="mt-1 text-2xl font-bold text-ink">{recycled}</p>
        </div>
      </div>
    </Card>
  );
}

