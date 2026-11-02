/**
 * Scrapo FairAccess — durable subsidised / donated device eligibility.
 * Default: one subsidised allocation per verified student in 12 months.
 * Repeated applications are flagged for manual review, not auto-rejected.
 * Multiple genuine students from one household remain eligible.
 */

import { trustPut, trustQuery, trustReset } from "../persistence/trust-store.ts";
import type {
  Category,
  FairAccessAllocation,
  FairAccessApplication,
  FairAccessStatus,
  Role,
  VerificationStatus,
} from "../types.ts";

export const SUBSIDY_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;
export const RESALE_RESTRICTION_COPY =
  "Subsidised and donated devices must not be resold for 12 months after allocation. Breach may block future FairAccess support.";

const APPS = "fairaccess_applications";
const ALLOCS = "fairaccess_allocations";

function withinWindow(iso: string, now = Date.now()) {
  return now - Date.parse(iso) < SUBSIDY_WINDOW_MS;
}

export async function recentAllocationForStudent(
  studentId: string,
  now = Date.now(),
): Promise<FairAccessAllocation | null> {
  const rows = await trustQuery<FairAccessAllocation>(ALLOCS, (row) => row.studentId === studentId);
  let latest: FairAccessAllocation | null = null;
  for (const row of rows) {
    if (!withinWindow(row.allocatedAt, now)) continue;
    if (!latest || row.allocatedAt > latest.allocatedAt) latest = row;
  }
  return latest;
}

export function evaluateEligibility(input: {
  role: Role;
  verificationStatus?: VerificationStatus;
  studentId: string;
  acceptsResaleRestriction: boolean;
  recentAllocation?: FairAccessAllocation | null;
  openApplicationCount?: number;
  priorApplicationCount?: number;
}): { eligible: boolean; flags: string[]; reason?: string } {
  const flags: string[] = [];
  if (input.role !== "student" && input.role !== "admin") {
    return { eligible: false, flags, reason: "Only verified students can apply for the Student Assistance Programme." };
  }
  if (input.role === "student" && input.verificationStatus !== "verified") {
    return { eligible: false, flags, reason: "Complete Scrapo Verify before applying for a subsidised device." };
  }
  if (!input.acceptsResaleRestriction) {
    return { eligible: false, flags, reason: "You must accept the disclosed resale restriction for subsidised devices." };
  }
  if (input.recentAllocation) flags.push("repeat_within_12_months");
  if ((input.openApplicationCount || 0) > 0) flags.push("open_application_exists");
  if ((input.priorApplicationCount || 0) > 0) flags.push("repeat_application");
  return { eligible: true, flags };
}

export async function submitFairAccessApplication(input: {
  studentId: string;
  studentName: string;
  role: Role;
  verificationStatus?: VerificationStatus;
  campus: string;
  course: string;
  category: Category;
  educationalNeed: string;
  devicePreference?: string;
  householdKey?: string;
  acceptsResaleRestriction: boolean;
}): Promise<{ success: boolean; application?: FairAccessApplication; error?: string }> {
  if (!input.studentId || !input.studentName.trim()) {
    return { success: false, error: "Sign in before applying." };
  }
  if (input.course.trim().length < 2) return { success: false, error: "Add your course or programme." };
  if (input.educationalNeed.trim().length < 24) {
    return { success: false, error: "Describe the educational requirement in at least 24 characters." };
  }
  if (/aadhaar|aadhar|\b\d{12}\b/i.test(`${input.educationalNeed} ${input.householdKey || ""}`)) {
    return { success: false, error: "Do not submit Aadhaar numbers or other national ID numbers." };
  }

  const apps = await trustQuery<FairAccessApplication>(APPS, (row) => row.studentId === input.studentId);
  const recent = await recentAllocationForStudent(input.studentId);
  const openCount = apps.filter((row) => row.status === "pending" || row.status === "flagged").length;
  const gate = evaluateEligibility({
    role: input.role,
    verificationStatus: input.verificationStatus,
    studentId: input.studentId,
    acceptsResaleRestriction: input.acceptsResaleRestriction,
    recentAllocation: recent,
    openApplicationCount: openCount,
    priorApplicationCount: apps.length,
  });
  if (!gate.eligible) return { success: false, error: gate.reason };

  const household = input.householdKey?.trim().toLowerCase();
  if (household) {
    const allApps = await trustQuery<FairAccessApplication>(APPS);
    const allAllocs = await trustQuery<FairAccessAllocation>(ALLOCS);
    for (const row of allAllocs) {
      const related = allApps.find((app) => app.id === row.applicationId);
      if (!related?.householdKey) continue;
      if (related.householdKey === household && related.studentId !== input.studentId && withinWindow(row.allocatedAt)) {
        gate.flags.push("household_recent_allocation");
      }
    }
  }

  const status: FairAccessStatus =
    gate.flags.includes("repeat_within_12_months") || gate.flags.includes("repeat_application")
      ? "flagged"
      : "pending";

  const application: FairAccessApplication = {
    id: `fa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    studentId: input.studentId,
    studentName: input.studentName.trim(),
    campus: input.campus.trim() || "Not set",
    course: input.course.trim(),
    category: input.category,
    educationalNeed: input.educationalNeed.trim().slice(0, 800),
    devicePreference: input.devicePreference?.trim().slice(0, 200) || undefined,
    householdKey: household || undefined,
    acceptsResaleRestriction: true,
    status,
    reviewFlags: gate.flags,
    submittedAt: new Date().toISOString(),
  };

  await trustPut(APPS, application.id, application as unknown as Record<string, unknown>);
  return { success: true, application };
}

export async function reviewFairAccessApplication(input: {
  applicationId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerRole: Role;
  decision: "approved" | "rejected";
  reviewNote?: string;
  deviceLabel?: string;
}): Promise<{ success: boolean; application?: FairAccessApplication; allocation?: FairAccessAllocation; error?: string }> {
  if (input.reviewerRole !== "admin") {
    return { success: false, error: "Only authorised administrators can review FairAccess applications." };
  }
  const apps = await trustQuery<FairAccessApplication>(APPS, (row) => row.id === input.applicationId);
  const application = apps[0];
  if (!application) return { success: false, error: "Application not found." };
  if (application.status !== "pending" && application.status !== "flagged") {
    return { success: false, error: "Only pending or flagged applications can be reviewed." };
  }
  if (input.decision === "rejected" && !input.reviewNote?.trim()) {
    return { success: false, error: "Provide a reason when rejecting an application." };
  }

  const now = new Date();
  let allocation: FairAccessAllocation | undefined;

  if (input.decision === "approved") {
    const recent = await recentAllocationForStudent(application.studentId, now.getTime());
    if (recent) {
      return {
        success: false,
        error: "This student already received a subsidised device within the last 12 months. Reject or wait until the window ends.",
      };
    }
    const expires = new Date(now.getTime() + SUBSIDY_WINDOW_MS);
    allocation = {
      id: `alloc_${Date.now().toString(36)}`,
      applicationId: application.id,
      studentId: application.studentId,
      studentName: application.studentName,
      category: application.category,
      deviceLabel: input.deviceLabel?.trim() || `${application.category} allocation`,
      allocatedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      resaleRestricted: true,
    };
    await trustPut(ALLOCS, allocation.id, allocation as unknown as Record<string, unknown>);
  }

  const updated: FairAccessApplication = {
    ...application,
    status: input.decision === "approved" ? "approved" : "rejected",
    reviewNote: input.reviewNote?.trim() || undefined,
    reviewerId: input.reviewerId,
    reviewerName: input.reviewerName,
    reviewedAt: now.toISOString(),
    allocationId: allocation?.id,
  };
  await trustPut(APPS, updated.id, updated as unknown as Record<string, unknown>);
  return { success: true, application: updated, allocation };
}

export async function listFairAccessApplications(filter?: { status?: FairAccessStatus; studentId?: string }) {
  const rows = await trustQuery<FairAccessApplication>(APPS, (row) => {
    if (filter?.status && row.status !== filter.status) return false;
    if (filter?.studentId && row.studentId !== filter.studentId) return false;
    return true;
  });
  return rows.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export async function listFairAccessAllocations(studentId?: string) {
  const rows = await trustQuery<FairAccessAllocation>(ALLOCS, (row) =>
    studentId ? row.studentId === studentId : true,
  );
  return rows.sort((a, b) => b.allocatedAt.localeCompare(a.allocatedAt));
}

/** Public-safe projection — strips household keys and private evidence. */
export function publicFairAccessView(row: FairAccessApplication) {
  return {
    id: row.id,
    studentName: row.studentName,
    campus: row.campus,
    course: row.course,
    category: row.category,
    educationalNeed: row.educationalNeed,
    status: row.status,
    reviewFlags: row.reviewFlags,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    reviewerName: row.reviewerName,
    reviewNote: row.reviewNote,
    hasHouseholdKey: Boolean(row.householdKey),
  };
}

export async function hydrateFairAccessFromFirestore() {
  await listFairAccessApplications();
  await listFairAccessAllocations();
}

export function __resetFairAccessStore() {
  trustReset(APPS);
  trustReset(ALLOCS);
}

export async function __seedAllocation(row: FairAccessAllocation) {
  await trustPut(ALLOCS, row.id, row as unknown as Record<string, unknown>);
}
