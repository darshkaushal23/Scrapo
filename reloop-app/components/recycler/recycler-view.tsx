"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextArea, TextInput } from "@/components/ui/field";
import { EmptyState, ErrorState, PageSkeleton, Pill } from "@/components/ui/feedback";
import { formatDate, statusLabel, workingLabel } from "@/lib/format";
import type { InspectionNote } from "@/lib/prototype/model";
import { usePrototype } from "@/lib/prototype/session";
import { createClient } from "@/lib/supabase/client";
import { loadPickups, saveInspectionEvent, submitSanitisationRecord } from "@/lib/supabase/records";
import { useLive } from "@/lib/supabase/use-live";
import type {
  PickupRecord,
  SanitisationRecord,
  SanitisationStatus,
  WorkingStatus,
} from "@/lib/types";
import { initialSanitisationRecords } from "@/lib/mock/data";
import { detectPickupDelay } from "@/lib/gemini/delay-detector";

const SANITISATION_METHODS = [
  "NIST 800-88 Rev 1 Overwrite / Purge",
  "ATA Secure Erase",
  "Factory Cryptographic Wipe",
  "Physical Degaussing & Shredding",
  "Mobile Factory Reset & Firmware Re-flash",
];

function SanitisationSection({
  pickup,
  existingRecord,
  onSubmit,
}: {
  pickup: PickupRecord;
  existingRecord?: SanitisationRecord | null;
  onSubmit: (record: SanitisationRecord) => void;
}) {
  const [status, setStatus] = useState<SanitisationStatus>(existingRecord?.status ?? "pending");
  const [method, setMethod] = useState(existingRecord?.method ?? SANITISATION_METHODS[0]);
  const [technicianName, setTechnicianName] = useState(existingRecord?.technicianName ?? "Priya Nair");
  const [evidence, setEvidence] = useState(existingRecord?.verificationEvidence ?? "");
  const [notes, setNotes] = useState(existingRecord?.notes ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSaveSanitisation = async () => {
    setError("");
    setMessage("");

    // Scrapo TrustShield rule: Never claim successful erasure without evidence!
    if (status === "completed" && !evidence.trim()) {
      setError("Verification evidence or erasure reference log is strictly required to mark sanitisation completed.");
      return;
    }

    const record: SanitisationRecord = {
      id: existingRecord?.id || `san-${Date.now()}`,
      deviceId: pickup.deviceId,
      pickupId: pickup.id,
      status,
      method,
      responsibleRecycler: pickup.recycler.name || "Authorized Recycler",
      technicianId: "us-3",
      technicianName: technicianName.trim() || "Technician",
      completedAt: status === "completed" ? new Date().toISOString() : null,
      verificationEvidence: evidence.trim(),
      verificationStatus: existingRecord?.verificationStatus ?? "pending_review",
      verifiedBy: existingRecord?.verifiedBy ?? null,
      verifiedAt: existingRecord?.verifiedAt ?? null,
      notes: notes.trim(),
    };

    try {
      // Save locally to prototype session
      onSubmit(record);

      // Attempt Supabase live record
      await submitSanitisationRecord(createClient(), {
        deviceId: pickup.deviceId,
        pickupId: pickup.id,
        status,
        method,
        verificationEvidence: evidence.trim(),
        notes: notes.trim(),
      }).catch(() => {});

      setMessage(`TrustShield: Sanitisation record set to ${status.replace("_", " ")}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record sanitisation.");
    }
  };

  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-ink flex items-center gap-1.5">
            <svg className="h-4 w-4 text-olive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            TrustShield Data Sanitisation Lab
          </h3>
          <p className="text-xs text-muted">
            Log technical erasure status, method, and audit evidence reference.
          </p>
        </div>
        <Pill tone={status === "completed" ? "lime" : status === "failed" ? "danger" : "paper"}>
          {status.replace("_", " ")}
        </Pill>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div>
          <label className="block text-xs font-semibold" htmlFor="san-status">Sanitisation Status</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {(["pending", "in_progress", "completed", "failed"] as SanitisationStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                className={
                  status === s
                    ? "rounded-full bg-olive px-3 py-1 text-xs font-semibold text-on-accent"
                    : "rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold"
                }
                onClick={() => setStatus(s)}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold" htmlFor="san-method">Sanitisation Method</label>
          <select
            id="san-method"
            className="mt-1 w-full rounded-2xl border border-line bg-card px-3 py-2 text-xs"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            {SANITISATION_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold" htmlFor="san-tech">Technician In Charge</label>
            <TextInput
              id="san-tech"
              value={technicianName}
              onChange={(e) => setTechnicianName(e.target.value)}
              placeholder="e.g. Priya Nair"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold" htmlFor="san-evidence">
              Audit Evidence Reference {status === "completed" ? "*" : ""}
            </label>
            <TextInput
              id="san-evidence"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="e.g. LOG-WIPE-2026-98124 or hash"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold" htmlFor="san-notes">Sanitisation Notes</label>
          <TextArea
            id="san-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Wipe sectors, partition table zeroed, OS installation note..."
          />
        </div>

        <Button
          type="button"
          size="sm"
          variant="olive"
          onClick={handleSaveSanitisation}
        >
          Submit Sanitisation Record
        </Button>

        {error && <p className="text-xs text-danger font-semibold">{error}</p>}
        {message && <p className="text-xs text-olive font-semibold">{message}</p>}
      </div>
    </div>
  );
}

function InspectionForm({
  pickup,
  saved,
  onSave,
  sanitisationRecord,
  onSubmitSanitisation,
}: {
  pickup: PickupRecord;
  saved?: InspectionNote;
  onSave: (note: InspectionNote) => void;
  sanitisationRecord?: SanitisationRecord | null;
  onSubmitSanitisation: (record: SanitisationRecord) => void;
}) {
  const [notes, setNotes] = useState(saved?.notes ?? "");
  const [working, setWorking] = useState<WorkingStatus>(saved?.working ?? "working");
  const [donationReady, setDonationReady] = useState(saved?.donationReady ?? true);
  const [savedMessage, setSavedMessage] = useState("");

  return (
    <Card>
      <h2 className="text-xl font-medium">Inspection · {pickup.deviceName}</h2>
      <p className="mt-1 text-sm text-muted">Processing status: {statusLabel[pickup.status]}</p>
      {saved ? (
        <p className="mt-3 text-sm text-olive">Last note saved in this browser: {saved.notes || "No written note."}</p>
      ) : null}
      <label className="mt-4 block text-sm font-semibold" htmlFor="notes">Inspection notes</label>
      <TextArea
        id="notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Battery, screen, charger, diagnostic"
      />
      <fieldset className="mt-4">
        <legend className="text-sm font-semibold">Working status after inspection</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(workingLabel) as WorkingStatus[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={working === item}
              className={working === item ? "rounded-full bg-lime px-3 py-1.5 text-xs font-semibold text-on-accent" : "rounded-full border border-line px-3 py-1.5 text-xs font-semibold"}
              onClick={() => setWorking(item)}
            >
              {workingLabel[item]}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="mt-4 flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 accent-olive"
          checked={donationReady}
          onChange={(event) => setDonationReady(event.target.checked)}
        />
        <span>
          <span className="font-semibold">Available for student donation</span>
          <span className="mt-1 block text-muted">Leave this off if the device should go to parts recovery.</span>
        </span>
      </label>
      <Button
        className="mt-5"
        variant="olive"
        onClick={async () => {
          try {
            await saveInspectionEvent(createClient(), pickup.id, {
              notes: notes.trim() || "Inspection saved.",
              working,
              donationReady,
            });
            onSave({ notes: notes.trim(), donationReady, working });
            setSavedMessage("Inspection saved.");
          } catch (error) {
            setSavedMessage(error instanceof Error ? error.message : "The inspection was not saved.");
          }
        }}
      >
        Save inspection
      </Button>
      {savedMessage ? <p className="mt-3 text-sm font-semibold text-olive" role="status">{savedMessage}</p> : null}

      {/* Embedded TrustShield Sanitisation Recording Section */}
      <SanitisationSection
        pickup={pickup}
        existingRecord={sanitisationRecord}
        onSubmit={onSubmitSanitisation}
      />
    </Card>
  );
}

export function RecyclerView() {
  const { inspections, saveInspection, sanitisations, submitSanitisation, admin, profile } = usePrototype();
  const live = useLive("recycler", async () => {
    const supabase = createClient();
    const pickups = (await loadPickups(supabase)).filter((pickup) => pickup.recycler.name !== "Awaiting assignment");
    const { data: auth } = await supabase.auth.getUser();
    let org = "Recycler desk";
    if (auth.user) {
      const { data } = await supabase.from("recycler_profiles").select("org_name").eq("profile_id", auth.user.id).maybeSingle();
      if (data?.org_name) org = data.org_name;
    }
    return { org, pickups };
  });
  const assigned = live.data?.pickups ?? [];
  const [filter, setFilter] = useState<"open" | "closed">("open");
  const [activeId, setActiveId] = useState("");

  const visible = assigned.filter((pickup) =>
    filter === "open"
      ? pickup.status !== "donated" && pickup.status !== "completed"
      : pickup.status === "donated" || pickup.status === "completed",
  );
  const active = visible.find((pickup) => pickup.id === activeId) ?? visible[0];

  // Scrapo Verify + legacy recyclerStatus overlay
  const recyclerStatus = admin.recyclerStatus["rc-1"] ?? profile.verificationStatus ?? "pending";
  const isVerified = profile.verificationStatus === "verified" || recyclerStatus === "verified";

  if (live.phase === "loading") return <PageSkeleton cards={2} />;
  if (live.phase === "error") return <ErrorState title="Assigned pickups did not load" text={live.message} onRetry={live.retry} />;

  if (!isVerified) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <EmptyState
          title="Recycler verification required"
          text="Complete Scrapo Verify and wait for an administrator to approve your organisation before handling assigned pickups."
          action={<Button href="/verify">Open Scrapo Verify</Button>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-olive">Recycler desk</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{live.data?.org ?? "GreenCircuit Collective"}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Pickups assigned to your recycler account. Saving an inspection writes a pickup event. Log sanitisation in the TrustShield lab.
          </p>
        </div>

        {/* Verification Status Pill */}
        <div>
          {isVerified ? (
            <div className="flex items-center gap-2 rounded-2xl border border-olive/30 bg-olive/10 px-4 py-2">
              <svg className="h-5 w-5 text-olive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <p className="text-xs font-bold text-olive">Verified Recycler Partner</p>
                <p className="text-[10px] text-muted">TrustShield Audited · License DEMO-RC-1842</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-line bg-paper px-4 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-muted" />
              <div>
                <p className="text-xs font-bold text-ink">Pending Administrator Verification</p>
                <p className="text-[10px] text-muted">Profile under compliance check</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2" role="group" aria-label="Pickup queue">
        <button type="button" aria-pressed={filter === "open"} className={filter === "open" ? "rounded-full bg-olive px-3 py-1.5 text-xs font-semibold text-on-accent" : "rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold"} onClick={() => setFilter("open")}>
          Open
        </button>
        <button type="button" aria-pressed={filter === "closed"} className={filter === "closed" ? "rounded-full bg-olive px-3 py-1.5 text-xs font-semibold text-on-accent" : "rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold"} onClick={() => setFilter("closed")}>
          Closed
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No pickups in this queue" text="Assigned collections show up here after a pickup is linked to your recycler account." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <ul className="space-y-3">
            {visible.map((pickup) => (
              <li key={pickup.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(pickup.id)}
                  className="w-full rounded-3xl border border-line bg-card p-5 text-left transition-colors hover:border-olive/50"
                  aria-pressed={active?.id === pickup.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Pill tone="paper">{statusLabel[pickup.status]}</Pill>
                      {detectPickupDelay(pickup).delayDetected && (
                        <Pill tone="danger">Delay Alert</Pill>
                      )}
                    </div>
                    <span className="text-xs text-muted">{pickup.collectionDate ? formatDate(pickup.collectionDate) : "No date"}</span>
                  </div>
                  <h2 className="mt-3 text-lg font-medium">{pickup.deviceName}</h2>
                  <p className="text-sm text-muted">{pickup.address}</p>
                </button>
              </li>
            ))}
          </ul>
          {active ? (
            <InspectionForm
              key={active.id}
              pickup={active}
              saved={inspections[active.id]}
              onSave={(note) => saveInspection(active.id, note)}
              sanitisationRecord={sanitisations[active.id] ?? initialSanitisationRecords[active.id]}
              onSubmitSanitisation={(rec) => submitSanitisation(rec)}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

