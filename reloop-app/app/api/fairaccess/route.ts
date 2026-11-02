import { requireAdmin, requireActor, resolveServerActor } from "@/lib/auth/server-actor";
import {
  evaluateEligibility,
  hydrateFairAccessFromFirestore,
  listFairAccessAllocations,
  listFairAccessApplications,
  publicFairAccessView,
  recentAllocationForStudent,
  RESALE_RESTRICTION_COPY,
  reviewFairAccessApplication,
  submitFairAccessApplication,
} from "@/lib/fairaccess/service";
import type { Category, FairAccessStatus, VerificationStatus } from "@/lib/types";

export async function GET(request: Request) {
  try {
    await hydrateFairAccessFromFirestore();
    const url = new URL(request.url);
    const admin = url.searchParams.get("admin") === "1";
    const studentId = url.searchParams.get("studentId") || "";
    const status = url.searchParams.get("status") as FairAccessStatus | null;
    const check = url.searchParams.get("check") === "1";
    const verificationStatus = url.searchParams.get("verificationStatus") as VerificationStatus | null;
    const actor = await resolveServerActor(request);

    if (check) {
      const authed = requireActor(actor);
      const targetId = studentId || authed.id;
      if (authed.role !== "admin" && authed.id !== targetId) {
        return Response.json({ error: "Sign in to check eligibility." }, { status: 401 });
      }
      const recent = await recentAllocationForStudent(targetId);
      const apps = await listFairAccessApplications({ studentId: targetId });
      const gate = evaluateEligibility({
        role: authed.role === "admin" ? "student" : authed.role,
        verificationStatus: verificationStatus || undefined,
        studentId: targetId,
        acceptsResaleRestriction: true,
        recentAllocation: recent,
        openApplicationCount: apps.filter((row) => row.status === "pending" || row.status === "flagged").length,
        priorApplicationCount: apps.length,
      });
      return Response.json({
        ...gate,
        recentAllocation: recent,
        resaleRestriction: RESALE_RESTRICTION_COPY,
      });
    }

    if (admin) {
      requireAdmin(actor);
      return Response.json({
        applications: (await listFairAccessApplications(status ? { status } : undefined)).map(publicFairAccessView),
        allocations: await listFairAccessAllocations(),
        resaleRestriction: RESALE_RESTRICTION_COPY,
      });
    }

    const authed = requireActor(actor);
    const targetId = studentId || authed.id;
    if (authed.role !== "admin" && authed.id !== targetId) {
      return Response.json({ error: "Sign in to view your FairAccess records." }, { status: 401 });
    }

    return Response.json({
      applications: (await listFairAccessApplications({ studentId: targetId })).map(publicFairAccessView),
      allocations: await listFairAccessAllocations(targetId),
      resaleRestriction: RESALE_RESTRICTION_COPY,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load FairAccess.";
    return Response.json({ error: message }, { status: /administrator|Sign in/i.test(message) ? 403 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = requireActor(await resolveServerActor(request));
    const body = (await request.json()) as Record<string, unknown>;
    const res = await submitFairAccessApplication({
      studentId: actor.id,
      studentName: actor.name,
      role: actor.role,
      verificationStatus: (typeof body.verificationStatus === "string" ? body.verificationStatus : undefined) as
        | VerificationStatus
        | undefined,
      campus: typeof body.campus === "string" ? body.campus : "",
      course: typeof body.course === "string" ? body.course : "",
      category: (typeof body.category === "string" ? body.category : "laptop") as Category,
      educationalNeed: typeof body.educationalNeed === "string" ? body.educationalNeed : "",
      devicePreference: typeof body.devicePreference === "string" ? body.devicePreference : undefined,
      householdKey: typeof body.householdKey === "string" ? body.householdKey : undefined,
      acceptsResaleRestriction: body.acceptsResaleRestriction === true,
    });
    if (!res.success) return Response.json({ error: res.error }, { status: 400 });
    return Response.json({
      success: true,
      application: publicFairAccessView(res.application!),
      resaleRestriction: RESALE_RESTRICTION_COPY,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not submit application.";
    return Response.json({ error: message }, { status: /Sign in/i.test(message) ? 401 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = requireAdmin(await resolveServerActor(request));
    const body = (await request.json()) as Record<string, unknown>;
    const res = await reviewFairAccessApplication({
      applicationId: typeof body.applicationId === "string" ? body.applicationId : "",
      reviewerId: actor.id,
      reviewerName: actor.name,
      reviewerRole: actor.role,
      decision: body.decision === "rejected" ? "rejected" : "approved",
      reviewNote: typeof body.reviewNote === "string" ? body.reviewNote : undefined,
      deviceLabel: typeof body.deviceLabel === "string" ? body.deviceLabel : undefined,
    });
    if (!res.success) return Response.json({ error: res.error }, { status: 403 });
    return Response.json({
      success: true,
      application: publicFairAccessView(res.application!),
      allocation: res.allocation,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not review application.";
    return Response.json({ error: message }, { status: /administrator/i.test(message) ? 403 : 500 });
  }
}
