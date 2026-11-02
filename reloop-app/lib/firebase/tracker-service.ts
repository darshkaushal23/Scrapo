import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  addDoc,
  getDoc,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "./client.ts";
import type { CustodyEvent, PickupStatus } from "@/lib/types";
import type { AIStatusIntelligence } from "@/lib/gemini/types";

export type FirestoreTrackingDoc = {
  id: string;
  trackingId: string;
  deviceId: string;
  deviceName: string;
  status: PickupStatus;
  recyclerName: string;
  recyclerLicense: string;
  collectionDate: string | null;
  donorId?: string;
  lastUpdated?: unknown;
};

/**
 * Subscribes to realtime Firestore tracking updates for a given pickup.
 * If Firebase is unconfigured or offline, returns null unsubscribe.
 */
export function subscribeToPickupTracking(
  pickupId: string,
  onUpdate: (data: Partial<FirestoreTrackingDoc>) => void,
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    const pickupRef = doc(db, "pickups", pickupId);
    return onSnapshot(
      pickupRef,
      (snapshot) => {
        if (snapshot.exists()) {
          onUpdate({ id: snapshot.id, ...snapshot.data() } as Partial<FirestoreTrackingDoc>);
        }
      },
      (error) => {
        console.warn("Firestore realtime listener error:", error.message);
      },
    );
  } catch (err) {
    console.warn("Could not attach Firestore listener:", err);
    return null;
  }
}

/**
 * Subscribes to realtime Firestore tracking events subcollection.
 */
export function subscribeToTrackingEvents(
  pickupId: string,
  onEvents: (events: CustodyEvent[]) => void,
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    const eventsRef = collection(db, "pickups", pickupId, "tracking_events");
    return onSnapshot(
      eventsRef,
      (snapshot) => {
        const events: CustodyEvent[] = [];
        snapshot.forEach((docSnap) => {
          events.push({ id: docSnap.id, ...docSnap.data() } as CustodyEvent);
        });
        if (events.length > 0) {
          onEvents(events);
        }
      },
      (error) => {
        console.warn("Firestore events listener error:", error.message);
      },
    );
  } catch (err) {
    console.warn("Could not attach tracking events listener:", err);
    return null;
  }
}

/**
 * Writes a tracking event to Firestore.
 */
export async function addFirestoreTrackingEvent(
  pickupId: string,
  event: Omit<CustodyEvent, "id">,
): Promise<string | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    const eventsCol = collection(db, "pickups", pickupId, "tracking_events");
    const docRef = await addDoc(eventsCol, {
      ...event,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (err) {
    console.warn("Firestore tracking event write error:", err);
    return null;
  }
}

/**
 * Reads cached AI status intelligence from Firestore.
 */
export async function getCachedAIExplanation(
  pickupId: string,
  currentStatus: PickupStatus,
): Promise<AIStatusIntelligence | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    const cacheDocRef = doc(db, "ai_tracker_cache", pickupId);
    const snap = await getDoc(cacheDocRef);
    if (!snap.exists()) return null;

    const data = snap.data() as {
      cachedAtMs: number;
      statusWhenCached: PickupStatus;
      intelligence: AIStatusIntelligence;
    };

    // Cache invalidation: TTL of 1 hour or if pickup status changed
    const now = Date.now();
    const TTL_MS = 60 * 60 * 1000;
    if (data.statusWhenCached !== currentStatus || now - data.cachedAtMs > TTL_MS) {
      return null;
    }

    return data.intelligence;
  } catch {
    return null;
  }
}

/**
 * Caches Gemini AI status intelligence in Firestore.
 */
export async function cacheAIExplanationInFirestore(
  pickupId: string,
  currentStatus: PickupStatus,
  intelligence: AIStatusIntelligence,
): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;

  try {
    const cacheDocRef = doc(db, "ai_tracker_cache", pickupId);
    await setDoc(cacheDocRef, {
      pickupId,
      statusWhenCached: currentStatus,
      intelligence,
      cachedAtMs: Date.now(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Firestore cache write error:", err);
  }
}
