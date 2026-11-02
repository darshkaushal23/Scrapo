import { requireAdmin, requireActor, resolveServerActor } from "@/lib/auth/server-actor";
import {
  canAccessVerifiedFeature,
  getVerification,
  listPendingVerifications,
  requiredKindForRole,
  reviewVerification,
  submitVerification,
  type GatedFeature,
} from "@/lib/verify/service";
import type { VerificationKind } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || "";
    const kind = (url.searchParams.get("kind") as VerificationKind | null) || undefined;
    const pending = url.searchParams.get("pending") === "1";
    const feature = url.searchParams.get("feature") as GatedFeature | null;
    const status = url.searchParams.get("status") as "pending" | "verified" | "rejected" | "expired" | null;
    const actor = await resolveServerActor(request);

    if (pending) {
      requireAdmin(actor);
      const rows = await listPendingVerifications();
      return Response.json({
        applications: rows.map((row) => ({
          ...row,
          enrolmentEvidence: undefined,
          hasEvidence: Boolean(row.enrolmentEvidence),
        })),
      });
    }

    if (feature) {
      const authed = requireActor(actor);
      // Never trust a client-supplied role query param for gate decisions.
      const gate = canAccessVerifiedFeature(authed.role, feature, status || undefined);
      return Response.json(gate);
    }

    const authed = requireActor(actor);
    const targetId = userId || authed.id;
    if (authed.role !== "admin" && authed.id !== targetId) {
      return Response.json({ error: "Sign in to view your verification status." }, { status: 401 });
    }
    const application = await getVerification(targetId, kind || requiredKindForRole(authed.role));
    return Response.json({ application });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load verification.";
    const status = /administrator|Sign in/i.test(message) ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const actor = requireActor(await resolveServerActor(request));
    if (actor.role === "admin") {
      return Response.json({ error: "Admin accounts do not submit verification applications." }, { status: 400 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const kind = (typeof body.kind === "string" ? body.kind : requiredKindForRole(actor.role)) as VerificationKind;

    const res = await submitVerification({
      userId: actor.id,
      userName: actor.name,
      role: actor.role,
      kind,
      email: typeof body.email === "string" ? body.email : actor.email,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      institution: typeof body.institution === "string" ? body.institution : undefined,
      course: typeof body.course === "string" ? body.course : undefined,
      studentId: typeof body.studentId === "string" ? body.studentId : undefined,
      enrolmentEvidence: typeof body.enrolmentEvidence === "string" ? body.enrolmentEvidence : undefined,
      orgName: typeof body.orgName === "string" ? body.orgName : undefined,
      license: typeof body.license === "string" ? body.license : undefined,
      ownershipDeclared: body.ownershipDeclared === true,
    });

    if (!res.success) return Response.json({ error: res.error }, { status: 400 });
    return Response.json({ success: true, application: res.application });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not submit verification.";
    return Response.json({ error: message }, { status: /Sign in/i.test(message) ? 401 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = requireAdmin(await resolveServerActor(request));
    const body = (await request.json()) as Record<string, unknown>;
    const res = await reviewVerification({
      applicationId: typeof body.applicationId === "string" ? body.applicationId : "",
      reviewerId: actor.id,
      reviewerName: actor.name,
      reviewerRole: actor.role,
      decision: body.decision === "rejected" ? "rejected" : "verified",
      reviewNote: typeof body.reviewNote === "string" ? body.reviewNote : undefined,
    });
    if (!res.success) return Response.json({ error: res.error }, { status: 403 });
    return Response.json({ success: true, application: res.application });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not review verification.";
    return Response.json({ error: message }, { status: /administrator/i.test(message) ? 403 : 500 });
  }
}
