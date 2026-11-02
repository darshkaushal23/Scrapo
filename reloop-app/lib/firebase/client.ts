import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { firebaseConfig, isFirebaseConfigured } from "./config.ts";

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

export function getFirebaseClientApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;

  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    return app;
  } catch (error) {
    console.warn("Firebase init skipped:", error);
    return null;
  }
}

export function getFirebaseDb(): Firestore | null {
  if (db) return db;
  const clientApp = getFirebaseClientApp();
  if (!clientApp) return null;
  try {
    db = getFirestore(clientApp);
    return db;
  } catch {
    return null;
  }
}

export function getFirebaseAuth(): Auth | null {
  if (auth) return auth;
  const clientApp = getFirebaseClientApp();
  if (!clientApp) return null;
  try {
    auth = getAuth(clientApp);
    return auth;
  } catch {
    return null;
  }
}
