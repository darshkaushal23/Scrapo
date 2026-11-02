"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  emptyAdmin,
  type InspectionNote,
} from "@/lib/prototype/model";
import { initialCustodyHistory, initialSanitisationRecords } from "@/lib/mock/data";
import { createClient } from "@/lib/supabase/client";
import { loadProfile } from "@/lib/supabase/records";
import type {
  CustodyEvent,
  DemoProfile,
  PickupRecord,
  RewardEvent,
  Role,
  SanitisationRecord,
  SanitisationVerificationStatus,
} from "@/lib/types";
import type { PrototypeState } from "@/lib/prototype/model";

const STORAGE_KEY = "reloop.prototype.v1";

const guestProfile: DemoProfile = {
  name: "",
  email: "",
  phone: "",
  role: "donor",
  city: "",
  pointsMonth: 0,
  pointsLifetime: 0,
  rank: 0,
  personalized: false,
};

const serverSnapshot: PrototypeState = {
  profile: guestProfile,
  drafts: [],
  inspections: {},
  admin: emptyAdmin(),
  sanitisations: initialSanitisationRecords,
  custodyEvents: initialCustodyHistory,
};

let current: PrototypeState = serverSnapshot;
let hydrated = false;
const listeners = new Set<() => void>();

function emit(next: PrototypeState) {
  current = next;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  listeners.forEach((listener) => listener());
}

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    let savedProfile: DemoProfile | null = null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    let parsed: Partial<PrototypeState> | null = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
        if (parsed?.profile?.name && parsed?.profile?.role) {
          savedProfile = { ...guestProfile, ...parsed.profile, personalized: true };
        }
      } catch {}
    }

    // Check backup key in case STORAGE_KEY was reset or guestProfile was saved
    if (!savedProfile) {
      const backup = window.localStorage.getItem("scrapo_account_session");
      if (backup) {
        try {
          const u = JSON.parse(backup);
          if (u?.name) {
            savedProfile = {
              ...guestProfile,
              name: u.name,
              role: u.role || "donor",
              city: u.city || "Bengaluru",
              personalized: true,
            };
          }
        } catch {}
      }
    }

    current = {
      profile: savedProfile ?? guestProfile,
      drafts: Array.isArray(parsed?.drafts) ? parsed!.drafts! : [],
      inspections: parsed?.inspections ?? {},
      admin: { ...emptyAdmin(), ...(parsed?.admin ?? {}) },
      sanitisations: { ...initialSanitisationRecords, ...(parsed?.sanitisations ?? {}) },
      custodyEvents: { ...initialCustodyHistory, ...(parsed?.custodyEvents ?? {}) },
    };
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  hydrate();
  return current;
}

function getServerSnapshot() {
  return serverSnapshot;
}

function emptySubscribe() {
  return () => {};
}

type SessionContextValue = PrototypeState & {
  ready: boolean;
  signIn: (
    next: Pick<DemoProfile, "name" | "role"> & {
      id?: string;
      email?: string;
      phone?: string;
      city?: string;
      verificationStatus?: DemoProfile["verificationStatus"];
    },
  ) => void;
  signOut: () => void;
  setRole: (role: Role) => void;
  addDraft: (pickup: PickupRecord) => void;
  saveInspection: (pickupId: string, note: InspectionNote) => void;
  toggleSuspended: (userId: string) => void;
  setRecyclerStatus: (
    id: string,
    status: "pending" | "verified" | "needs_info",
  ) => void;
  setDonationStatus: (
    id: string,
    status: "pending" | "approved" | "declined",
  ) => void;
  addReward: (event: RewardEvent) => void;
  publishWinners: () => void;
  submitSanitisation: (record: SanitisationRecord) => void;
  verifySanitisation: (
    pickupId: string,
    status: SanitisationVerificationStatus,
  ) => void;
  addCustodyEvent: (event: CustodyEvent) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function PrototypeSessionProvider({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    const supabase = createClient();
    loadProfile(supabase)
      .then((profile) => {
        if (!profile) return;
        emit({ ...current, profile });
      })
      .catch(() => {});
  }, []);

  const value = useMemo<SessionContextValue>(() => {
    const update = (recipe: (snapshot: PrototypeState) => PrototypeState) => {
      emit(recipe(current));
    };

    return {
      ...state,
      ready,
      signIn: (next) => {
        try {
          window.localStorage.setItem("scrapo_account_session", JSON.stringify(next));
        } catch {}
        update((snapshot) => ({
          ...snapshot,
          profile: { ...snapshot.profile, ...next, personalized: true },
        }));
      },
      signOut: () => {
        try {
          window.localStorage.removeItem("scrapo_account_session");
        } catch {}
        void createClient().auth.signOut();
        void import("@/lib/firebase/auth-service").then((mod) => mod.signOutFirebase());
        update((snapshot) => ({
          ...snapshot,
          profile: guestProfile,
        }));
      },
      // Roles are assigned at account creation / by admins only — never escalate from the client.
      setRole: () => {
        // no-op: prevents privilege escalation via session.setRole("admin")
      },
      addDraft: (pickup) =>
        update((snapshot) => ({
          ...snapshot,
          drafts: [pickup, ...snapshot.drafts.filter((item) => item.id !== pickup.id)],
        })),
      saveInspection: (pickupId, note) =>
        update((snapshot) => ({
          ...snapshot,
          inspections: { ...snapshot.inspections, [pickupId]: note },
        })),
      toggleSuspended: (userId) =>
        update((snapshot) => {
          const ids = snapshot.admin.suspendedUserIds;
          const suspendedUserIds = ids.includes(userId)
            ? ids.filter((id) => id !== userId)
            : [...ids, userId];
          return { ...snapshot, admin: { ...snapshot.admin, suspendedUserIds } };
        }),
      setRecyclerStatus: (id, status) => {
        if (state.profile.role !== "admin") {
          throw new Error("Only authorised administrators can update recycler verification.");
        }
        update((snapshot) => ({
          ...snapshot,
          admin: {
            ...snapshot.admin,
            recyclerStatus: { ...snapshot.admin.recyclerStatus, [id]: status },
          },
        }));
      },
      setDonationStatus: (id, status) => {
        if (state.profile.role !== "admin") {
          throw new Error("Only authorised administrators can update donation release status.");
        }
        if (status === "approved") {
          const san = state.sanitisations[id] ?? initialSanitisationRecords[id];
          if (!san || san.verificationStatus !== "verified") {
            throw new Error(
              "Device cannot be released until TrustShield sanitisation is verified by an administrator.",
            );
          }
        }
        update((snapshot) => ({
          ...snapshot,
          admin: {
            ...snapshot.admin,
            donationStatus: { ...snapshot.admin.donationStatus, [id]: status },
          },
        }));
      },
      addReward: (event) =>
        update((snapshot) => ({
          ...snapshot,
          admin: {
            ...snapshot.admin,
            extraRewards: [event, ...snapshot.admin.extraRewards],
          },
        })),
      publishWinners: () =>
        update((snapshot) => ({
          ...snapshot,
          admin: { ...snapshot.admin, winnersPublished: true },
        })),
      submitSanitisation: (record) => {
        if (state.profile.role !== "recycler" && state.profile.role !== "admin") {
          throw new Error("Only authorised recyclers or admins can submit sanitisation records.");
        }
        if (record.status === "completed" && !record.verificationEvidence?.trim()) {
          throw new Error("Verification evidence or reference is required when marking sanitisation completed.");
        }
        update((snapshot) => {
          const prevEvents = snapshot.custodyEvents[record.pickupId] ?? [];
          const custodyEvent: CustodyEvent = {
            id: `cst-san-${Date.now()}`,
            pickupId: record.pickupId,
            deviceId: record.deviceId,
            stage: "sanitisation",
            action: `Sanitisation recorded: ${record.status.replace("_", " ")} via ${record.method}`,
            responsibleUserId: snapshot.profile.email || "recycler-auth",
            responsibleUserName: record.technicianName || snapshot.profile.name || "Technician",
            responsibleRole: snapshot.profile.role,
            responsibleOrg: record.responsibleRecycler,
            timestamp: new Date().toISOString(),
            notes: record.notes || `Evidence: ${record.verificationEvidence || "None"}`,
          };
          return {
            ...snapshot,
            sanitisations: {
              ...snapshot.sanitisations,
              [record.pickupId]: record,
            },
            custodyEvents: {
              ...snapshot.custodyEvents,
              [record.pickupId]: [...prevEvents, custodyEvent],
            },
          };
        });
      },
      verifySanitisation: (pickupId, status) => {
        if (state.profile.role !== "admin") {
          throw new Error("Only authorised administrators can approve or verify sanitisation records.");
        }
        update((snapshot) => {
          const existing = snapshot.sanitisations[pickupId];
          if (!existing) return snapshot;
          const updated: SanitisationRecord = {
            ...existing,
            verificationStatus: status,
            verifiedBy: snapshot.profile.name || "Administrator",
            verifiedAt: new Date().toISOString(),
          };
          const prevEvents = snapshot.custodyEvents[pickupId] ?? [];
          const auditEvent: CustodyEvent = {
            id: `cst-ver-${Date.now()}`,
            pickupId,
            deviceId: existing.deviceId,
            stage: "sanitisation",
            action: `TrustShield Sanitisation ${status === "verified" ? "Approved" : "Rejected"} by Admin`,
            responsibleUserId: snapshot.profile.email || "admin-auth",
            responsibleUserName: snapshot.profile.name || "Administrator",
            responsibleRole: "admin",
            responsibleOrg: "Scrapo TrustShield Verification",
            timestamp: new Date().toISOString(),
            notes: `Status changed to ${status}. Verification audit confirmed.`,
          };
          return {
            ...snapshot,
            sanitisations: {
              ...snapshot.sanitisations,
              [pickupId]: updated,
            },
            custodyEvents: {
              ...snapshot.custodyEvents,
              [pickupId]: [...prevEvents, auditEvent],
            },
          };
        });
      },
      addCustodyEvent: (event) => {
        update((snapshot) => {
          const prev = snapshot.custodyEvents[event.pickupId] ?? [];
          return {
            ...snapshot,
            custodyEvents: {
              ...snapshot.custodyEvents,
              [event.pickupId]: [...prev, event],
            },
          };
        });
      },
    };
  }, [ready, state]);

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function usePrototype() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("usePrototype must be used inside PrototypeSessionProvider");
  }
  return value;
}
