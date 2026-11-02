import type { Role, VerificationKind, VerificationStatus } from "../types.ts";

const FEATURE_GATES = {
  list_device: ["donor", "admin"] as Role[],
  student_request: ["student", "admin"] as Role[],
  recycler_ops: ["recycler", "admin"] as Role[],
} as const;

export type GatedFeature = keyof typeof FEATURE_GATES;

export function requiredKindForRole(role: Role): VerificationKind {
  if (role === "student") return "student";
  if (role === "recycler") return "recycler";
  return "donor_ownership";
}

export function canAccessVerifiedFeature(
  role: Role,
  feature: GatedFeature,
  status: VerificationStatus | undefined,
): { allowed: boolean; reason?: string } {
  if (role === "admin") return { allowed: true };
  if (!FEATURE_GATES[feature].includes(role)) {
    return { allowed: false, reason: "This action is not available for your account type." };
  }
  if (status === "verified") return { allowed: true };
  if (status === "pending") {
    return { allowed: false, reason: "Your Scrapo Verify application is still pending review." };
  }
  if (status === "rejected") {
    return { allowed: false, reason: "Your Scrapo Verify application was rejected. Update and resubmit from Verify." };
  }
  if (status === "expired") {
    return { allowed: false, reason: "Your Scrapo Verify status expired. Submit a new application." };
  }
  return { allowed: false, reason: "Complete Scrapo Verify before using this feature." };
}
