"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, PageSkeleton, Pill } from "@/components/ui/feedback";
import { formatDate, statusLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { loadPickups } from "@/lib/supabase/records";
import { useLive } from "@/lib/supabase/use-live";
import { usePrototype } from "@/lib/prototype/session";
import { DonationCertificate } from "@/components/pickups/donation-certificate";
import { DigitalTrustPassport } from "@/components/trustshield/digital-trust-passport";
import { AITrackerPanel } from "@/components/tracker/ai-tracker-panel";
import { cx } from "@/lib/cx";
import { initialCustodyHistory, initialSanitisationRecords, pickups as mockPickups } from "@/lib/mock/data";

export function PickupDetail({ id }: { id: string }) {
  const router = useRouter();
  const { profile, sanitisations, custodyEvents, admin, verifySanitisation, drafts } = usePrototype();
  const live = useLive(`pickup:${id}`, () => loadPickups(createClient()));
  const pickup =
    live.data?.find((item) => item.id === id) ??
    drafts?.find((item) => item.id === id) ??
    mockPickups.find((item) => item.id === id);

  if (live.phase === "loading") return <PageSkeleton cards={2} />;
  if (live.phase === "error") {
    return <ErrorState title="This pickup did not load" text={live.message} onRetry={live.retry} />;
  }
  if (!pickup) {
    return (
      <ErrorState
        title="No pickup matches that link"
        text="That record is not in your account."
        onRetry={() => router.push("/pickups")}
      />
    );
  }

  // TrustShield Privacy Access Rules:
  // Full street address / phones only for the owning donor (donorId), collection recyclers, or admins.
  // Buyers/students and unrelated donors never see previous-owner PII.
  const ownsDraft = Boolean(drafts?.some((item) => item.id === pickup.id && item.donorId === profile.id));
  const isOwningDonor = Boolean(
    profile.id &&
      (pickup.donorId === profile.id || ownsDraft),
  );
  const isCollectionPartner = profile.role === "recycler";
  const isAuthorized =
    profile.role === "admin" || isOwningDonor || isCollectionPartner;

  const maskedAddress = isAuthorized
    ? `${pickup.address}, ${pickup.city}`
    : `Area in ${pickup.city} · Full street address restricted to authorized collection partner`;

  const maskedPhone = isAuthorized
    ? pickup.recycler.phone
    : "Protected by TrustShield · Visible to assigned donor & partner";

  const sanitisationRecord = sanitisations[pickup.id] ?? initialSanitisationRecords[pickup.id] ?? null;
  const deviceCustody = custodyEvents[pickup.id] ?? initialCustodyHistory[pickup.id] ?? [];

  // Check recycler verification
  const recyclerStatus = admin.recyclerStatus["rc-1"] ?? "verified";
  const isRecyclerVerified = recyclerStatus === "verified";

  // Only show certified badge if sanitisation has verified status
  const canShowCertificate =
    pickup.showCertificate &&
    sanitisationRecord?.status === "completed" &&
    sanitisationRecord?.verificationStatus === "verified";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-olive">Pickup {pickup.trackingId}</p>
            <Pill tone="paper">TrustShield Monitored</Pill>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{pickup.deviceName}</h1>
          <p className="mt-2 text-sm text-muted">{maskedAddress}</p>
        </div>
        <Button href="/pickups" variant="ghost">All pickups</Button>
      </div>

      {/* Scrapo AI Tracker: Live Status Intelligence & Assistant */}
      <AITrackerPanel
        pickup={pickup}
        currentUserRole={profile.role}
      />

      {/* Scrapo TrustShield: Digital Trust Passport */}
      <DigitalTrustPassport
        pickup={pickup}
        sanitisation={sanitisationRecord}
        custodyEvents={deviceCustody}
        currentUserRole={profile.role}
        isOwnerOrAuthorized={isAuthorized}
        onVerifySanitisation={
          profile.role === "admin"
            ? (status) => verifySanitisation(pickup.id, status)
            : undefined
        }
      />

      {canShowCertificate ? (
        <DonationCertificate
          donor={profile.name}
          device={pickup.deviceName}
          city={pickup.city}
          date={formatDate(
            pickup.timeline.find((event) => event.status === "donated" && event.at)?.at ??
              pickup.collectionDate ??
              pickup.timeline.find((event) => event.at)?.at ??
              new Date().toISOString(),
          )}
          certificateId={pickup.id}
        />
      ) : pickup.status === "donated" || pickup.status === "completed" ? (
        <div className="rounded-2xl border border-line bg-paper/30 p-4 text-xs text-muted">
          <strong className="text-ink">TrustShield Audit Note:</strong> Certificate of successful donation is held until verified sanitisation erasure evidence is validated by an administrator.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <h2 className="text-lg font-medium">Collection</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-semibold">Date</dt>
              <dd className="text-muted">{pickup.collectionDate ? formatDate(pickup.collectionDate) : "Not booked yet"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Status</dt>
              <dd className="mt-1"><Pill>{statusLabel[pickup.status]}</Pill></dd>
            </div>
            <div>
              <dt className="font-semibold">Description</dt>
              <dd className="mt-1 leading-6 text-muted">
                {pickup.description?.trim() || "No description was saved with this request."}
              </dd>
            </div>
          </dl>
          <h2 className="mt-6 text-lg font-medium">Recycler</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-semibold">{pickup.recycler.name}</dt>
              <dd className="text-muted">{pickup.recycler.contact}</dd>
            </div>
            <div>
              <dt className="font-semibold">Verification Status</dt>
              <dd className="mt-1">
                <Pill tone={isRecyclerVerified ? "lime" : "paper"}>
                  {isRecyclerVerified ? "Verified Partner" : "Pending Verification"}
                </Pill>
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Phone</dt>
              <dd className="text-muted">{maskedPhone}</dd>
            </div>
            <div>
              <dt className="font-semibold">License</dt>
              <dd className="text-muted">{pickup.recycler.license}</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <h2 className="text-lg font-medium">Status timeline</h2>
          <ol className="mt-6 space-y-0">
            {pickup.timeline.map((event, index) => {
              const done = Boolean(event.at);
              return (
                <li key={event.label} className="grid grid-cols-[1.25rem_1fr] gap-4">
                  <div className="flex flex-col items-center">
                    <span className={cx("mt-1 h-3 w-3 rounded-full", done ? "bg-olive" : "bg-line")} />
                    {index < pickup.timeline.length - 1 ? <span className="w-px flex-1 bg-line" /> : null}
                  </div>
                  <div className="pb-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{event.label}</h3>
                      {done ? <span className="text-xs text-muted">{formatDate(event.at as string)}</span> : <span className="text-xs text-muted">Upcoming</span>}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted">{event.note}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>
    </div>
  );
}
