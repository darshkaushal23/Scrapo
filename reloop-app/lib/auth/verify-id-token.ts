/**
 * Verify Firebase ID tokens using Google JWKS.
 * Works without a service account — suitable for production API auth.
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export type VerifiedFirebaseToken = {
  uid: string;
  email?: string;
  name?: string;
  admin?: boolean;
  role?: string;
  raw: JWTPayload;
};

const jwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseToken | null> {
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    "scrapo-613a1";

  try {
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    const uid = typeof payload.user_id === "string" ? payload.user_id : typeof payload.sub === "string" ? payload.sub : "";
    if (!uid) return null;

    return {
      uid,
      email: typeof payload.email === "string" ? payload.email : undefined,
      name: typeof payload.name === "string" ? payload.name : undefined,
      admin: payload.admin === true,
      role: typeof payload.role === "string" ? payload.role : undefined,
      raw: payload,
    };
  } catch {
    return null;
  }
}
