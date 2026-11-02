/**
 * Firebase Admin SDK — server-only. Used to verify ID tokens and persist Trust & Safety data.
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON (stringified service account) or GOOGLE_APPLICATION_CREDENTIALS.
 */

import { cert, getApps, initializeApp, type App, type ServiceAccount } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | null = null;
let initAttempted = false;

function parseServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount & { private_key?: string };
    if (typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch {
    console.warn("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
    return null;
  }
}

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim(),
  );
}

export function getFirebaseAdminApp(): App | null {
  if (app) return app;
  if (initAttempted) return getApps()[0] ?? null;
  initAttempted = true;

  try {
    if (getApps().length) {
      app = getApps()[0]!;
      return app;
    }

    const projectId =
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      process.env.GCLOUD_PROJECT ||
      "scrapo-613a1";
    const serviceAccount = parseServiceAccount();

    if (serviceAccount) {
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
      return app;
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      app = initializeApp({ projectId });
      return app;
    }

    return null;
  } catch (err) {
    console.warn("Firebase Admin init skipped:", err);
    return null;
  }
}

export function getFirebaseAdminAuth(): Auth | null {
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) return null;
  try {
    return getAuth(adminApp);
  } catch {
    return null;
  }
}

export function getFirebaseAdminDb(): Firestore | null {
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) return null;
  try {
    return getFirestore(adminApp);
  } catch {
    return null;
  }
}
