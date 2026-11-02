import { canReleaseDevice } from "@/lib/accountability/reports";
import { requireActor, requireAdmin, resolveServerActor } from "@/lib/auth/server-actor";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";
import { trustPut } from "@/lib/persistence/trust-store";
import type { SanitisationStatus, SanitisationVerificationStatus } from "@/lib/types";

const ALLOWED_STATUSES: SanitisationStatus[] = ["pending", "in_progress", "completed", "failed"];
const ALLOWED_VERIFICATIONS: SanitisationVerificationStatus[] = ["pending_review", "verified", "rejected"];

export async function POST(request: Request) {
  try {
    const actor = requireActor(await resolveServerActor(request));
    if (actor.role !== "recycler" && actor.role !== "admin") {
      return Response.json(
        { error: "Access denied. Only authorised recyclers or administrators can record device sanitisation." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      deviceId?: unknown;
      pickupId?: unknown;
      status?: unknown;
      method?: unknown;
      verificationEvidence?: unknown;
      notes?: unknown;
    };

    const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
    const pickupId = typeof body.pickupId === "string" ? body.pickupId.trim() : "";
    const status = body.status as SanitisationStatus;
    const method = typeof body.method === "string" ? body.method.trim() : "";
    const verificationEvidence = typeof body.verificationEvidence === "string" ? body.verificationEvidence.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";

    if (!deviceId || !pickupId) {
      return Response.json({ error: "Missing required deviceId or pickupId." }, { status: 400 });
    }
    if (!ALLOWED_STATUSES.includes(status)) {
      return Response.json(
        { error: "Invalid status. Must be pending, in_progress, completed, or failed." },
        { status: 400 },
      );
    }
    if (!method) {
      return Response.json({ error: "A sanitisation method is required." }, { status: 400 });
    }
    if (status === "completed" && !verificationEvidence) {
      return Response.json(
        {
          error:
            "Verification evidence reference (e.g. erasure log ID, certificate hash) is strictly required to mark sanitisation completed.",
        },
        { status: 400 },
      );
    }

    const id = `san_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const record = {
      id,
      device_id: deviceId,
      pickup_id: pickupId,
      status,
      method,
      technician_id: actor.id,
      technician_name: actor.name,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      // Evidence is stored server-side; clients cannot later mark verification_status themselves.
      verification_evidence: verificationEvidence,
      verification_status: "pending_review" as const,
      notes,
      created_at: new Date().toISOString(),
    };

    await trustPut("device_sanitisation_records", id, record);

    const db = getFirebaseAdminDb();
    if (db) {
      await db.collection("device_custody_history").add({
        device_id: deviceId,
        pickup_id: pickupId,
        stage: "sanitisation",
        action: `Sanitisation recorded: ${status} via ${method}`,
        responsible_user_id: actor.id,
        responsible_role: actor.role,
        notes: notes || `Evidence on file (reference withheld from public views).`,
        timestamp: new Date().toISOString(),
      });
    } else {
      await trustPut("device_custody_history", `cust_${id}`, {
        id: `cust_${id}`,
        device_id: deviceId,
        pickup_id: pickupId,
        stage: "sanitisation",
        action: `Sanitisation recorded: ${status} via ${method}`,
        responsible_user_id: actor.id,
        responsible_role: actor.role,
        notes: notes || "Evidence on file.",
        timestamp: new Date().toISOString(),
      });
    }

    return Response.json({
      success: true,
      id,
      message: "Sanitisation record submitted for review.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error.";
    return Response.json({ error: message }, { status: /Sign in/i.test(message) ? 401 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = requireAdmin(await resolveServerActor(request));
    const body = (await request.json()) as {
      recordId?: unknown;
      verificationStatus?: unknown;
      releaseDevice?: unknown;
    };

    const recordId = typeof body.recordId === "string" ? body.recordId.trim() : "";
    const verificationStatus = body.verificationStatus as SanitisationVerificationStatus;

    if (!recordId || !ALLOWED_VERIFICATIONS.includes(verificationStatus)) {
      return Response.json({ error: "Invalid recordId or verificationStatus." }, { status: 400 });
    }

    const rows = await (await import("@/lib/persistence/trust-store")).trustQuery<{
      id: string;
      pickup_id: string;
      device_id: string;
      verification_status: string;
      verification_evidence?: string;
    }>("device_sanitisation_records", (row) => row.id === recordId);
    const record = rows[0];
    if (!record) {
      return Response.json({ error: "Sanitisation record not found." }, { status: 404 });
    }

    if (verificationStatus === "verified" && !record.verification_evidence) {
      return Response.json(
        { error: "Cannot verify sanitisation without stored evidence reference." },
        { status: 400 },
      );
    }

    const updated = {
      ...record,
      verification_status: verificationStatus,
      verified_by: actor.id,
      verified_at: new Date().toISOString(),
    };
    await trustPut("device_sanitisation_records", recordId, updated);

    if (body.releaseDevice === true) {
      const gate = canReleaseDevice({
        sanitisationVerificationStatus: verificationStatus,
        recyclerVerified: true,
      });
      if (!gate.allowed) {
        return Response.json({ error: gate.reason, success: false }, { status: 403 });
      }
    }

    await trustPut("device_custody_history", `cust_verify_${recordId}`, {
      id: `cust_verify_${recordId}`,
      device_id: record.device_id,
      pickup_id: record.pickup_id,
      stage: "sanitisation",
      action: `Sanitisation record marked ${verificationStatus} by administrator`,
      responsible_user_id: actor.id,
      responsible_role: "admin",
      responsible_org: "Scrapo TrustShield Verification",
      notes: `Verification status updated to ${verificationStatus}.`,
      timestamp: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      message: `Sanitisation record successfully marked as ${verificationStatus}.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error.";
    return Response.json({ error: message }, { status: /administrator|Sign in/i.test(message) ? 403 : 500 });
  }
}
