/**
 * Scrapo Accountability — durable suspicious listing reports and device release gates.
 * Reports are append-only for reporters; only admins resolve them.
 */

import { trustPut, trustQuery, trustReset } from "../persistence/trust-store.ts";
import type { Role, SanitisationVerificationStatus } from "../types.ts";

export type ListingReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

export type ListingReport = {
  id: string;
  listingId: string;
  listingTitle: string;
  reason: string;
  details: string;
  reporterId: string;
  reporterName: string;
  reporterRole: Role;
  status: ListingReportStatus;
  createdAt: string;
  resolvedAt?: string;
  resolverId?: string;
  resolverName?: string;
  resolutionNote?: string;
};

const COLLECTION = "listing_reports";

export function canReleaseDevice(input: {
  sanitisationVerificationStatus?: SanitisationVerificationStatus | null;
  recyclerVerified?: boolean;
}): { allowed: boolean; reason?: string } {
  if (input.recyclerVerified === false) {
    return { allowed: false, reason: "Device cannot be released until the recycler partner is verified." };
  }
  if (input.sanitisationVerificationStatus !== "verified") {
    return {
      allowed: false,
      reason: "Device cannot be released until TrustShield sanitisation is verified by an administrator.",
    };
  }
  return { allowed: true };
}

export async function submitListingReport(input: {
  listingId: string;
  listingTitle: string;
  reason: string;
  details: string;
  reporterId: string;
  reporterName: string;
  reporterRole: Role;
}): Promise<{ success: boolean; report?: ListingReport; error?: string }> {
  if (!input.reporterId || !input.reporterName.trim()) {
    return { success: false, error: "Sign in before reporting a listing." };
  }
  if (!input.listingId.trim()) return { success: false, error: "Listing id is required." };
  if (input.reason.trim().length < 4) return { success: false, error: "Select or enter a short reason." };
  if (input.details.trim().length < 12) {
    return { success: false, error: "Add at least a brief description of the concern." };
  }

  const existing = await trustQuery<ListingReport>(
    COLLECTION,
    (row) =>
      row.listingId === input.listingId &&
      row.reporterId === input.reporterId &&
      (row.status === "open" || row.status === "reviewing"),
  );
  if (existing.length) {
    return { success: false, error: "You already have an open report for this listing." };
  }

  const report: ListingReport = {
    id: `lr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    listingId: input.listingId.trim(),
    listingTitle: input.listingTitle.trim().slice(0, 120) || input.listingId,
    reason: input.reason.trim().slice(0, 80),
    details: input.details.trim().slice(0, 800),
    reporterId: input.reporterId,
    reporterName: input.reporterName.trim(),
    reporterRole: input.reporterRole,
    status: "open",
    createdAt: new Date().toISOString(),
  };

  await trustPut(COLLECTION, report.id, report as unknown as Record<string, unknown>);
  return { success: true, report };
}

export async function resolveListingReport(input: {
  reportId: string;
  resolverId: string;
  resolverName: string;
  resolverRole: Role;
  decision: "resolved" | "dismissed";
  resolutionNote?: string;
}): Promise<{ success: boolean; report?: ListingReport; error?: string }> {
  if (input.resolverRole !== "admin") {
    return { success: false, error: "Only authorised administrators can resolve listing reports." };
  }
  const rows = await trustQuery<ListingReport>(COLLECTION, (row) => row.id === input.reportId);
  const existing = rows[0];
  if (!existing) return { success: false, error: "Report not found." };
  if (existing.status === "resolved" || existing.status === "dismissed") {
    return { success: false, error: "This report is already closed." };
  }

  const updated: ListingReport = {
    ...existing,
    status: input.decision,
    resolvedAt: new Date().toISOString(),
    resolverId: input.resolverId,
    resolverName: input.resolverName,
    resolutionNote: input.resolutionNote?.trim().slice(0, 400) || undefined,
  };
  await trustPut(COLLECTION, updated.id, updated as unknown as Record<string, unknown>);
  return { success: true, report: updated };
}

/** Reports cannot be silently edited — updates are admin resolve only. */
export function tryMutateListingReport(): never {
  throw new Error("Listing reports are append-only; silent mutation is not permitted.");
}

export async function listListingReports(filter?: {
  status?: ListingReportStatus;
  listingId?: string;
  reporterId?: string;
}) {
  const rows = await trustQuery<ListingReport>(COLLECTION, (row) => {
    if (filter?.status && row.status !== filter.status) return false;
    if (filter?.listingId && row.listingId !== filter.listingId) return false;
    if (filter?.reporterId && row.reporterId !== filter.reporterId) return false;
    return true;
  });
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function publicListingReportView(row: ListingReport) {
  return {
    id: row.id,
    listingId: row.listingId,
    listingTitle: row.listingTitle,
    reason: row.reason,
    status: row.status,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
    resolutionNote: row.resolutionNote,
  };
}

export async function hydrateListingReportsFromFirestore() {
  await listListingReports();
}

export function __resetListingReports() {
  trustReset(COLLECTION);
}
