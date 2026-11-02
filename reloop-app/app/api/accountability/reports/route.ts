import { requireAdmin, requireActor, resolveServerActor } from "@/lib/auth/server-actor";
import {
  hydrateListingReportsFromFirestore,
  listListingReports,
  publicListingReportView,
  resolveListingReport,
  submitListingReport,
} from "@/lib/accountability/reports";

export async function GET(request: Request) {
  try {
    await hydrateListingReportsFromFirestore();
    const url = new URL(request.url);
    const admin = url.searchParams.get("admin") === "1";
    const listingId = url.searchParams.get("listingId") || "";
    const actor = await resolveServerActor(request);

    if (admin) {
      requireAdmin(actor);
      return Response.json({
        reports: (await listListingReports()).map((row) => ({
          ...publicListingReportView(row),
          details: row.details,
          reporterName: row.reporterName,
          reporterRole: row.reporterRole,
          resolverName: row.resolverName,
        })),
      });
    }

    const authed = requireActor(actor);
    const mine = await listListingReports({
      reporterId: authed.id,
      ...(listingId ? { listingId } : {}),
    });
    return Response.json({ reports: mine.map(publicListingReportView) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load reports.";
    return Response.json({ error: message }, { status: /administrator|Sign in/i.test(message) ? 403 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = requireActor(await resolveServerActor(request));
    const body = (await request.json()) as Record<string, unknown>;
    const res = await submitListingReport({
      listingId: typeof body.listingId === "string" ? body.listingId : "",
      listingTitle: typeof body.listingTitle === "string" ? body.listingTitle : "",
      reason: typeof body.reason === "string" ? body.reason : "",
      details: typeof body.details === "string" ? body.details : "",
      reporterId: actor.id,
      reporterName: actor.name,
      reporterRole: actor.role,
    });
    if (!res.success) return Response.json({ error: res.error }, { status: 400 });
    return Response.json({ success: true, report: publicListingReportView(res.report!) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not submit report.";
    return Response.json({ error: message }, { status: /Sign in/i.test(message) ? 401 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = requireAdmin(await resolveServerActor(request));
    const body = (await request.json()) as Record<string, unknown>;
    const res = await resolveListingReport({
      reportId: typeof body.reportId === "string" ? body.reportId : "",
      resolverId: actor.id,
      resolverName: actor.name,
      resolverRole: actor.role,
      decision: body.decision === "dismissed" ? "dismissed" : "resolved",
      resolutionNote: typeof body.resolutionNote === "string" ? body.resolutionNote : undefined,
    });
    if (!res.success) return Response.json({ error: res.error }, { status: 403 });
    return Response.json({ success: true, report: publicListingReportView(res.report!) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not resolve report.";
    return Response.json({ error: message }, { status: /administrator/i.test(message) ? 403 : 500 });
  }
}
