/**
 * Client auth headers for Trust & Safety APIs.
 * Sends a Firebase ID token only — never role or actor id spoof headers.
 */

import { getFirebaseAuth } from "@/lib/firebase/client";

/** @deprecated Actor spoof headers are no longer trusted. Prefer scrapoAuthHeaders(). */
export function scrapoActorHeaders(actor: { id?: string; name?: string }): HeadersInit {
  void actor;
  return { "Content-Type": "application/json" };
}

export async function scrapoAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      headers.Authorization = `Bearer ${token}`;
    } catch {
      // leave unauthenticated; server will 401
    }
  }
  return headers;
}
