/**
 * Scrapo Verify — durable verification applications.
 * Authoritative writes go through the server trust store (Admin Firestore / local durable file).
 */

import { trustGet, trustPut, trustQuery, trustReset } from "../persistence/trust-store.ts";
import type { Role, VerificationApplication, VerificationKind } from "../types.ts";
import { requiredKindForRole } from "./gates.ts";

export { canAccessVerifiedFeature, requiredKindForRole, type GatedFeature } from "./gates.ts";

const COLLECTION = "verifications";

function expireIfNeeded(row: VerificationApplication): VerificationApplication {
  if (row.status === "verified" && row.expiresAt && Date.parse(row.expiresAt) < Date.now()) {
    return { ...row, status: "expired" as const };
  }
  return row;
}

export async function getVerification(
  userId: string,
  kind?: VerificationKind,
): Promise<VerificationApplication | null> {
  if (!userId) return null;
  const rows = await trustQuery<VerificationApplication>(COLLECTION, (row) => {
    if (row.userId !== userId) return false;
    if (kind && row.kind !== kind) return false;
    return true;
  });
  if (!rows.length) return null;
  rows.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const current = expireIfNeeded(rows[0]!);
  if (current.status === "expired" && rows[0]!.status !== "expired") {
    await trustPut(COLLECTION, current.id, current as unknown as Record<string, unknown>);
  }
  return current;
}

export async function listPendingVerifications(): Promise<VerificationApplication[]> {
  const rows = await trustQuery<VerificationApplication>(COLLECTION, (row) => expireIfNeeded(row).status === "pending");
  return rows.map(expireIfNeeded).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
}

export async function submitVerification(input: {
  userId: string;
  userName: string;
  role: Role;
  kind: VerificationKind;
  email?: string;
  phone?: string;
  institution?: string;
  course?: string;
  studentId?: string;
  enrolmentEvidence?: string;
  orgName?: string;
  license?: string;
  ownershipDeclared?: boolean;
}): Promise<{ success: boolean; application?: VerificationApplication; error?: string }> {
  if (!input.userId || !input.userName.trim()) {
    return { success: false, error: "Sign in before submitting Scrapo Verify." };
  }
  if (input.role === "admin") {
    return { success: false, error: "Admin accounts do not submit verification applications." };
  }

  const expected = requiredKindForRole(input.role);
  if (input.kind !== expected && input.kind !== "contact") {
    return { success: false, error: `Submit a ${expected.replace("_", " ")} verification for this role.` };
  }

  if (input.kind === "contact") {
    if (!input.email?.trim() && !input.phone?.trim()) {
      return { success: false, error: "Provide an email or phone number for contact verification." };
    }
  }
  if (input.kind === "student") {
    if (!input.institution?.trim() || !input.course?.trim() || !input.studentId?.trim()) {
      return { success: false, error: "Institution, course, and student ID are required." };
    }
    if (/aadhaar|aadhar|\d{12}/i.test(`${input.studentId} ${input.enrolmentEvidence || ""}`)) {
      return { success: false, error: "Do not submit Aadhaar numbers. Use a campus student ID or enrolment note only." };
    }
  }
  if (input.kind === "recycler") {
    if (!input.orgName?.trim() || !input.license?.trim()) {
      return { success: false, error: "Organisation name and licence number are required for recycler verification." };
    }
  }
  if (input.kind === "donor_ownership" && !input.ownershipDeclared) {
    return { success: false, error: "Confirm ownership of devices before listing." };
  }

  const existing = await getVerification(input.userId, input.kind);
  if (existing?.status === "pending") {
    return { success: false, error: "An application is already pending review." };
  }

  const now = new Date().toISOString();
  const application: VerificationApplication = {
    id: existing?.id || `vf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    userId: input.userId,
    userName: input.userName.trim(),
    role: input.role,
    kind: input.kind,
    status: "pending",
    email: input.email?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    institution: input.institution?.trim() || undefined,
    course: input.course?.trim() || undefined,
    studentId: input.studentId?.trim() || undefined,
    enrolmentEvidence: input.enrolmentEvidence?.trim().slice(0, 400) || undefined,
    orgName: input.orgName?.trim() || undefined,
    license: input.license?.trim() || undefined,
    ownershipDeclared: input.ownershipDeclared || undefined,
    submittedAt: now,
  };

  await trustPut(COLLECTION, application.id, application as unknown as Record<string, unknown>);
  return { success: true, application };
}

export async function reviewVerification(input: {
  applicationId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerRole: Role;
  decision: "verified" | "rejected";
  reviewNote?: string;
}): Promise<{ success: boolean; application?: VerificationApplication; error?: string }> {
  if (input.reviewerRole !== "admin") {
    return { success: false, error: "Only authorised administrators can review verification applications." };
  }

  let target = await trustGet<VerificationApplication>(COLLECTION, input.applicationId);
  if (!target) {
    const pending = await listPendingVerifications();
    target = pending.find((row) => row.id === input.applicationId) || null;
  }
  if (!target) return { success: false, error: "Application not found." };
  if (target.status !== "pending") return { success: false, error: "Only pending applications can be reviewed." };
  if (input.decision === "rejected" && !input.reviewNote?.trim()) {
    return { success: false, error: "Provide a reason when rejecting an application." };
  }

  const now = new Date();
  const expires = new Date(now);
  expires.setFullYear(expires.getFullYear() + 1);

  const updated: VerificationApplication = {
    ...target,
    status: input.decision,
    reviewNote: input.reviewNote?.trim() || undefined,
    reviewerId: input.reviewerId,
    reviewerName: input.reviewerName,
    reviewedAt: now.toISOString(),
    expiresAt: input.decision === "verified" ? expires.toISOString() : undefined,
  };

  await trustPut(COLLECTION, updated.id, updated as unknown as Record<string, unknown>);
  return { success: true, application: updated };
}

export function __resetVerificationStore() {
  trustReset(COLLECTION);
}
