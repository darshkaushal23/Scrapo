/**
 * Server-side actor resolution for Trust & Safety APIs.
 * Verifies Firebase ID tokens via Admin SDK (if configured) or Google JWKS.
 * Client-supplied x-scrapo-actor-* headers are ignored.
 */

import { getFirebaseAdminAuth, getFirebaseAdminDb, isFirebaseAdminConfigured } from "../firebase/admin.ts";
import type { Role } from "../types.ts";
import { authRequestContext } from "./request-context.ts";
import { verifyFirebaseIdToken } from "./verify-id-token.ts";

export type ServerActor = {
  id: string;
  name: string;
  role: Role;
  email?: string;
  source: "firebase";
  idToken: string;
};

async function loadProfile(uid: string, idToken?: string): Promise<{ name: string; role: Role; email?: string } | null> {
  const db = getFirebaseAdminDb();
  if (db) {
    try {
      const snap = await db.collection("profiles").doc(uid).get();
      if (!snap.exists) return null;
      const data = snap.data() || {};
      return {
        name: typeof data.full_name === "string" ? data.full_name : "Member",
        role: (data.role as Role) || "donor",
        email: typeof data.email === "string" ? data.email : undefined,
      };
    } catch {
      // fall through to REST
    }
  }

  if (!idToken) return null;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "scrapo-613a1";
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/profiles/${encodeURIComponent(uid)}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      fields?: Record<string, { stringValue?: string }>;
    };
    const fields = body.fields || {};
    return {
      name: fields.full_name?.stringValue || "Member",
      role: (fields.role?.stringValue as Role) || "donor",
      email: fields.email?.stringValue,
    };
  } catch {
    return null;
  }
}

/**
 * Verifies Authorization: Bearer <Firebase ID token>.
 */
export async function resolveServerActor(request: Request): Promise<ServerActor | null> {
  if (
    process.env.NODE_ENV === "development" &&
    (request.headers.get("x-scrapo-actor-id") || request.headers.get("x-scrapo-actor-name"))
  ) {
    console.warn("Ignoring untrusted x-scrapo-actor-* headers; use Authorization Bearer ID token.");
  }

  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;
  const idToken = match[1].trim();

  let uid = "";
  let email: string | undefined;
  let name: string | undefined;
  let claimAdmin = false;
  let claimRole: string | undefined;

  const adminAuth = isFirebaseAdminConfigured() ? getFirebaseAdminAuth() : null;
  if (adminAuth) {
    try {
      const decoded = await adminAuth.verifyIdToken(idToken, true);
      uid = decoded.uid;
      email = decoded.email;
      name = typeof decoded.name === "string" ? decoded.name : undefined;
      claimAdmin = decoded.admin === true;
      claimRole = typeof decoded.role === "string" ? decoded.role : undefined;
    } catch {
      return null;
    }
  } else {
    const verified = await verifyFirebaseIdToken(idToken);
    if (!verified) return null;
    uid = verified.uid;
    email = verified.email;
    name = verified.name;
    claimAdmin = verified.admin === true;
    claimRole = verified.role;
  }

  const profile = await loadProfile(uid, idToken);
  let role: Role = profile?.role || "donor";
  if (profile?.role === "admin" || claimAdmin || claimRole === "admin") {
    role = "admin";
  } else if (profile?.role) {
    role = profile.role;
  } else if (claimRole === "donor" || claimRole === "student" || claimRole === "recycler") {
    role = claimRole;
  } else {
    role = "donor";
  }

  const actor: ServerActor = {
    id: uid,
    name: profile?.name || name || email || "Member",
    role,
    email: profile?.email || email,
    source: "firebase",
    idToken,
  };

  // Make the verified token available to durable stores for rule-compliant Firestore REST writes.
  authRequestContext.enterWith({ idToken, uid });
  return actor;
}

export function requireAdmin(actor: ServerActor | null): ServerActor {
  if (!actor || actor.role !== "admin") {
    throw new Error("Only authorised administrators can perform this action.");
  }
  return actor;
}

export function requireActor(actor: ServerActor | null): ServerActor {
  if (!actor) {
    throw new Error("Sign in with Firebase Authentication to continue.");
  }
  return actor;
}
