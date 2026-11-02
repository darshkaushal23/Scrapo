import type { Role } from "../types.ts";

const ALLOWED_SELF_ROLES: Role[] = ["donor", "student", "recycler"];

/**
 * Stable Firebase Auth email derived from display name.
 * Keeps the existing name+password UI while using Email/Password Auth under the hood.
 */
export function accountEmailFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (!slug) throw new Error("Account name is required.");
  return `${slug}@accounts.scrapo.app`;
}

/** Non-admins may only choose donor / student / recycler. */
export function sanitizeSelfAssignedRole(role: unknown): Role {
  if (typeof role !== "string") return "donor";
  if (role === "admin") return "donor";
  if (ALLOWED_SELF_ROLES.includes(role as Role)) return role as Role;
  return "donor";
}

export function isSelfAssignableRole(role: Role): boolean {
  return ALLOWED_SELF_ROLES.includes(role);
}
