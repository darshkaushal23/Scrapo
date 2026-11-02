"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type {
  CustodyEvent,
  PickupRecord,
  Role,
  SanitisationRecord,
  SanitisationVerificationStatus,
} from "@/lib/types";
import { cx } from "@/lib/cx";

export function DigitalTrustPassport({
  pickup,
  sanitisation,
  custodyEvents,
  currentUserRole,
  isOwnerOrAuthorized,
  onVerifySanitisation,
}: {
  pickup: PickupRecord;
  sanitisation?: SanitisationRecord | null;
  custodyEvents: CustodyEvent[];
  currentUserRole: Role;
  isOwnerOrAuthorized: boolean;
  onVerifySanitisation?: (status: SanitisationVerificationStatus) => void;
}) {
  const [activeTab, setActiveTab] = useState<"passport" | "custody" | "sanitisation">("passport");

  const sanitisationStatus = sanitisation?.status ?? "pending";
  const verificationStatus = sanitisation?.verificationStatus ?? "pending_review";
  const hasVerifiedErasure = sanitisationStatus === "completed" && verificationStatus === "verified";
  const hasFailedErasure = sanitisationStatus === "failed";
  const isInProgress = sanitisationStatus === "in_progress";

  const isRecyclerVerified = pickup.recycler.license && !pickup.recycler.license.includes("pending");

  // Determine stage outcomes for the Passport timeline
  const collectionEvent = custodyEvents.find((e) => e.stage === "handover") ||
    pickup.timeline.find((t) => t.status === "collected" && t.at);
  const inspectionEvent = custodyEvents.find((e) => e.stage === "inspection") ||
    pickup.timeline.find((t) => t.status === "inspected" && t.at);
  const outcomeEvent = custodyEvents.find((e) => e.stage === "outcome") ||
    pickup.timeline.find((t) => (t.status === "donated" || t.status === "completed") && t.at);

  return (
    <Card className="overflow-hidden border-2 border-line bg-card shadow-sm">
      {/* TrustShield Header Badge */}
      <div className="flex flex-col gap-4 border-b border-line bg-paper/30 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-olive">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Scrapo TrustShield
            </span>
            <span className="text-muted">·</span>
            <span className="text-xs text-muted">Device ID: {pickup.deviceId}</span>
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Digital Trust Passport
          </h2>
          <p className="mt-1 text-xs text-muted">
            Cryptographically audited device chain of custody & data sanitisation verification
          </p>
        </div>

        {/* Dynamic Trust Status */}
        <div className="flex flex-col items-start gap-1 sm:items-end">
          {hasVerifiedErasure ? (
            <div className="flex items-center gap-2 rounded-full border border-olive/30 bg-olive/10 px-3 py-1.5 text-xs font-semibold text-olive">
              <svg className="h-4 w-4 text-olive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              TrustShield Certified · Verified Wiped
            </div>
          ) : hasFailedErasure ? (
            <div className="flex items-center gap-2 rounded-full border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Sanitisation Failed · Hardware Quarantined
            </div>
          ) : isInProgress ? (
            <div className="flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink">
              <span className="h-2 w-2 animate-ping rounded-full bg-olive" />
              Sanitisation In Progress
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-muted">
              <span className="h-2 w-2 rounded-full bg-muted" />
              Pending Sanitisation Lab Handover
            </div>
          )}

          <span className="text-[11px] text-muted">
            Recycler:{" "}
            <strong className="text-ink">{pickup.recycler.name}</strong>{" "}
            {isRecyclerVerified ? (
              <span className="text-olive">✓ Verified Partner</span>
            ) : (
              <span className="text-muted">(Review Pending)</span>
            )}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-2 border-b border-line pb-3 text-xs font-semibold" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "passport"}
          className={cx(
            "rounded-full px-3 py-1.5 transition-colors",
            activeTab === "passport" ? "bg-olive text-on-accent" : "border border-line bg-card text-muted hover:text-ink",
          )}
          onClick={() => setActiveTab("passport")}
        >
          Trust Passport Timeline
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "sanitisation"}
          className={cx(
            "rounded-full px-3 py-1.5 transition-colors",
            activeTab === "sanitisation" ? "bg-olive text-on-accent" : "border border-line bg-card text-muted hover:text-ink",
          )}
          onClick={() => setActiveTab("sanitisation")}
        >
          Data Sanitisation Audit Record
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "custody"}
          className={cx(
            "rounded-full px-3 py-1.5 transition-colors",
            activeTab === "custody" ? "bg-olive text-on-accent" : "border border-line bg-card text-muted hover:text-ink",
          )}
          onClick={() => setActiveTab("custody")}
        >
          Custody Chain ({custodyEvents.length})
        </button>
      </div>

      {/* TAB 1: Trust Passport Timeline */}
      {activeTab === "passport" && (
        <div className="mt-5 space-y-6">
          <p className="text-xs leading-5 text-muted">
            The Digital Trust Passport verifies the journey of <strong>{pickup.deviceName}</strong> from donor intake to certified sanitisation and final reuse or recycling.
          </p>

          <ol className="relative space-y-6 border-l border-line pl-6">
            {/* Step 1: Device Collected */}
            <li className="relative">
              <span
                className={cx(
                  "absolute -left-[31px] top-1 grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold",
                  collectionEvent ? "bg-olive text-on-accent" : "border border-line bg-card text-muted",
                )}
              >
                1
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-ink">1. Device Collected</h4>
                  {collectionEvent ? (
                    <Pill tone="lime">Completed</Pill>
                  ) : (
                    <Pill tone="paper">Scheduled</Pill>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted">
                  Responsible Partner: <strong>{pickup.recycler.name}</strong> ({pickup.recycler.license || "Licensed Partner"})
                </p>
                <p className="text-xs text-muted">
                  Timestamp: {collectionEvent && ("timestamp" in collectionEvent ? formatDate(collectionEvent.timestamp) : collectionEvent.at ? formatDate(collectionEvent.at) : "Awaiting slot")}
                </p>
              </div>
            </li>

            {/* Step 2: Device Inspected */}
            <li className="relative">
              <span
                className={cx(
                  "absolute -left-[31px] top-1 grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold",
                  inspectionEvent ? "bg-olive text-on-accent" : "border border-line bg-card text-muted",
                )}
              >
                2
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-ink">2. Technical Inspection</h4>
                  {inspectionEvent ? (
                    <Pill tone="lime">Inspected</Pill>
                  ) : (
                    <Pill tone="paper">Pending Lab Intake</Pill>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted">
                  Diagnostic of hardware integrity, battery health, and physical safety components.
                </p>
                <p className="text-xs text-muted">
                  Responsible Partner: <strong>{pickup.recycler.name} Lab Desk</strong> · {inspectionEvent ? ("timestamp" in inspectionEvent ? formatDate(inspectionEvent.timestamp) : inspectionEvent.at ? formatDate(inspectionEvent.at) : "Pending") : "In queue"}
                </p>
              </div>
            </li>

            {/* Step 3: Sanitisation Completed or Pending */}
            <li className="relative">
              <span
                className={cx(
                  "absolute -left-[31px] top-1 grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold",
                  hasVerifiedErasure
                    ? "bg-olive text-on-accent"
                    : hasFailedErasure
                    ? "bg-danger text-white"
                    : isInProgress
                    ? "bg-lime text-on-accent"
                    : "border border-line bg-card text-muted",
                )}
              >
                3
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-ink">3. Data Sanitisation</h4>
                  <Pill tone={hasVerifiedErasure ? "lime" : hasFailedErasure ? "danger" : isInProgress ? "olive" : "paper"}>
                    {hasVerifiedErasure
                      ? "Verified Sanitised"
                      : hasFailedErasure
                      ? "Sanitisation Failed"
                      : isInProgress
                      ? "In Progress"
                      : "Pending"}
                  </Pill>
                </div>
                {sanitisation ? (
                  <div className="mt-1 space-y-1 text-xs text-muted">
                    <p>
                      Method: <strong className="text-ink">{sanitisation.method}</strong>
                    </p>
                    <p>
                      Responsible: <strong>{sanitisation.technicianName}</strong> ({sanitisation.responsibleRecycler})
                    </p>
                    {sanitisation.verificationEvidence ? (
                      <p className="font-mono text-[11px] text-ink">
                        Audit Evidence Ref: {sanitisation.verificationEvidence}
                      </p>
                    ) : (
                      <p className="italic text-muted">Awaiting erasure log generation</p>
                    )}
                    {sanitisation.verifiedBy ? (
                      <p className="text-olive">
                        Verified by Administrator: {sanitisation.verifiedBy} ({formatDate(sanitisation.verifiedAt || "")})
                      </p>
                    ) : (
                      <p className="text-muted">Verification Status: {sanitisation.verificationStatus.replace("_", " ")}</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted">
                    No erasure record submitted yet. Devices are never certified without verified erasure evidence.
                  </p>
                )}
              </div>
            </li>

            {/* Step 4: Refurbished, Donated, or Parts Recovery */}
            <li className="relative">
              <span
                className={cx(
                  "absolute -left-[31px] top-1 grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold",
                  outcomeEvent ? "bg-olive text-on-accent" : "border border-line bg-card text-muted",
                )}
              >
                4
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-ink">4. Device Lifecycle Outcome</h4>
                  {outcomeEvent ? (
                    <Pill tone="lime">Lifecycle Transition Complete</Pill>
                  ) : (
                    <Pill tone="paper">Awaiting Sanitisation & Approval</Pill>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted">
                  Outcome: {hasFailedErasure ? "Quarantined for physical degaussing & e-waste parts recycling." : outcomeEvent ? "Refurbished and matched for student education aid." : "Will be refurbished for student aid once verified, or allocated for circular parts recovery."}
                </p>
                {outcomeEvent && (
                  <p className="text-xs text-muted">
                    Logged: {"timestamp" in outcomeEvent ? formatDate(outcomeEvent.timestamp) : outcomeEvent.at ? formatDate(outcomeEvent.at) : ""}
                  </p>
                )}
              </div>
            </li>
          </ol>
        </div>
      )}

      {/* TAB 2: Sanitisation Audit Record */}
      {activeTab === "sanitisation" && (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-line bg-paper/30 p-4">
            <h3 className="text-sm font-semibold text-ink">Certified Data Sanitisation Record</h3>
            <p className="mt-1 text-xs text-muted">
              Per Scrapo TrustShield policy, devices must undergo verified data erasure adhering to NIST 800-88 Rev 1 guidelines before refurbishment or redistribution.
            </p>

            {sanitisation ? (
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-xl border border-line bg-card p-3">
                  <dt className="font-semibold text-muted">Device Identification</dt>
                  <dd className="mt-1 font-medium text-ink">{pickup.deviceName} (ID: {pickup.deviceId})</dd>
                </div>

                <div className="rounded-xl border border-line bg-card p-3">
                  <dt className="font-semibold text-muted">Sanitisation Status</dt>
                  <dd className="mt-1 font-medium capitalize text-ink">
                    <Pill tone={hasVerifiedErasure ? "lime" : hasFailedErasure ? "danger" : "olive"}>
                      {sanitisation.status.replace("_", " ")}
                    </Pill>
                  </dd>
                </div>

                <div className="rounded-xl border border-line bg-card p-3">
                  <dt className="font-semibold text-muted">Sanitisation Method</dt>
                  <dd className="mt-1 font-medium text-ink">{sanitisation.method || "Unspecified"}</dd>
                </div>

                <div className="rounded-xl border border-line bg-card p-3">
                  <dt className="font-semibold text-muted">Responsible Technician & Recycler</dt>
                  <dd className="mt-1 font-medium text-ink">
                    {sanitisation.technicianName} · {sanitisation.responsibleRecycler}
                  </dd>
                </div>

                <div className="rounded-xl border border-line bg-card p-3">
                  <dt className="font-semibold text-muted">Completion Timestamp</dt>
                  <dd className="mt-1 font-medium text-ink">
                    {sanitisation.completedAt ? formatDate(sanitisation.completedAt) : "Pending completion"}
                  </dd>
                </div>

                <div className="rounded-xl border border-line bg-card p-3">
                  <dt className="font-semibold text-muted">Verification Evidence Reference</dt>
                  <dd className="mt-1 font-mono text-[11px] text-ink break-all">
                    {sanitisation.verificationEvidence || "None submitted (No claim without evidence)"}
                  </dd>
                </div>

                <div className="rounded-xl border border-line bg-card p-3 sm:col-span-2">
                  <dt className="font-semibold text-muted">Admin Verification Status</dt>
                  <dd className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium capitalize text-ink">
                      {sanitisation.verificationStatus.replace("_", " ")}
                      {sanitisation.verifiedBy ? ` by ${sanitisation.verifiedBy}` : ""}
                    </span>

                    {/* Admin Verification Quick Controls */}
                    {currentUserRole === "admin" && onVerifySanitisation && (
                      <div className="flex gap-2">
                        {sanitisation.verificationStatus !== "verified" && (
                          <Button
                            size="sm"
                            variant="olive"
                            onClick={() => onVerifySanitisation("verified")}
                          >
                            Approve & Mark Verified
                          </Button>
                        )}
                        {sanitisation.verificationStatus !== "rejected" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onVerifySanitisation("rejected")}
                          >
                            Reject Evidence
                          </Button>
                        )}
                      </div>
                    )}
                  </dd>
                </div>
              </dl>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-line bg-paper/20 p-5 text-center text-xs text-muted">
                No sanitisation record has been recorded by the assigned recycler yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Device Custody Chain */}
      {activeTab === "custody" && (
        <div className="mt-5 space-y-4">
          <p className="text-xs leading-5 text-muted">
            Immutable custody event ledger recording all authorized handovers, inspections, and status transitions for this hardware.
          </p>

          {custodyEvents.length === 0 ? (
            <p className="text-xs text-muted">No custody events recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {custodyEvents.map((evt) => (
                <li key={evt.id} className="rounded-2xl border border-line bg-paper/30 p-3.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold text-ink">
                      <span className="rounded-full bg-olive/10 px-2 py-0.5 text-[10px] text-olive uppercase font-bold">
                        {evt.stage}
                      </span>
                      <span>{evt.action}</span>
                    </div>
                    <span className="text-[11px] text-muted">{formatDate(evt.timestamp)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-muted">
                    <span>
                      Actor: <strong className="text-ink">{evt.responsibleUserName}</strong> ({evt.responsibleRole})
                    </span>
                    {evt.responsibleOrg && (
                      <span>Org: <strong>{evt.responsibleOrg}</strong></span>
                    )}
                  </div>
                  {evt.notes && (
                    <p className="mt-1 text-[11px] text-muted border-t border-line/50 pt-1">
                      {evt.notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Privacy & Authorized Access Guard Banner */}
      <div className="mt-5 border-t border-line pt-3 text-[11px] text-muted flex flex-wrap items-center justify-between gap-2">
        <span>
          Privacy Guard: {isOwnerOrAuthorized ? (
            <span className="text-olive">Full pickup credentials authorized for your account role ({currentUserRole}).</span>
          ) : (
            <span>Personal contact numbers and private pickup address are masked for privacy.</span>
          )}
        </span>
        <span className="font-semibold text-ink">Scrapo TrustShield v1.0</span>
      </div>
    </Card>
  );
}

