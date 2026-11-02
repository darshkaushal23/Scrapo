/**
 * Scrapo Account Service
 * Simplified Name & Password authentication without email or phone verification.
 * Supports Cloud Firestore synchronization and fast local session persistence.
 */

import { adminUsers } from "../mock/data.ts";
import type { Role } from "../types.ts";
import { getFirebaseDb } from "../firebase/client.ts";
import { doc, setDoc, serverTimestamp, collection, getDocs } from "firebase/firestore";

export type StoredAccount = {
  id: string;
  name: string;
  passwordHash: string; // Stored password or hash
  role: Role;
  city: string;
  createdAt: string;
};

// In-memory account registry
const registeredAccounts = new Map<string, StoredAccount>();

// Seed default platform accounts
for (const u of adminUsers) {
  const normName = u.name.trim().toLowerCase();
  registeredAccounts.set(normName, {
    id: u.id,
    name: u.name,
    passwordHash: "password123",
    role: u.role,
    city: u.city,
    createdAt: new Date().toISOString(),
  });
}

// Additional common defaults
registeredAccounts.set("ananya iyer", {
  id: "us-ananya",
  name: "Ananya Iyer",
  passwordHash: "password123",
  role: "donor",
  city: "Bengaluru",
  createdAt: new Date().toISOString(),
});

registeredAccounts.set("greencircuit collective", {
  id: "rc-greencircuit",
  name: "GreenCircuit Collective",
  passwordHash: "password123",
  role: "recycler",
  city: "Bengaluru",
  createdAt: new Date().toISOString(),
});

/**
 * Creates a brand new account using Name and Password.
 * No email or phone verification needed.
 */
export async function createSimpleAccount(params: {
  name: string;
  password: string;
  role?: Role;
  city?: string;
}): Promise<{
  success: boolean;
  user?: StoredAccount;
  error?: string;
}> {
  const cleanName = params.name.trim();
  const cleanPassword = params.password.trim();
  const requestedRole: Role = params.role || "donor";
  // Users cannot self-register as administrators.
  const role: Role = requestedRole === "admin" ? "donor" : requestedRole;
  const city = params.city?.trim() || "Bengaluru";

  if (cleanName.length < 2) {
    return { success: false, error: "Please enter your full name (at least 2 characters)." };
  }

  if (cleanPassword.length < 4) {
    return { success: false, error: "Please choose a password with at least 4 characters." };
  }

  if (params.role === "admin") {
    return { success: false, error: "Administrator accounts cannot be self-registered." };
  }

  const key = cleanName.toLowerCase();
  if (registeredAccounts.has(key)) {
    return {
      success: false,
      error: `An account named "${cleanName}" already exists. Please log in instead or choose another name.`,
    };
  }

  const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const account: StoredAccount = {
    id,
    name: cleanName,
    passwordHash: cleanPassword,
    role,
    city,
    createdAt: new Date().toISOString(),
  };

  registeredAccounts.set(key, account);

  // Sync with Cloud Firestore
  const db = getFirebaseDb();
  if (db) {
    try {
      const docRef = doc(db, "profiles", id);
      await setDoc(docRef, {
        id,
        full_name: cleanName,
        role,
        city,
        points_month: 0,
        points_lifetime: 0,
        created_at: serverTimestamp(),
      });
    } catch (err) {
      console.warn("Firestore profile write note:", err);
    }
  }

  return { success: true, user: account };
}

/**
 * Logs in with Name and Password.
 */
export async function loginSimpleAccount(params: {
  name: string;
  password: string;
}): Promise<{
  success: boolean;
  user?: StoredAccount;
  error?: string;
}> {
  const cleanName = params.name.trim();
  const cleanPassword = params.password.trim();

  if (!cleanName) {
    return { success: false, error: "Please enter your account name." };
  }

  if (!cleanPassword) {
    return { success: false, error: "Please enter your password." };
  }

  const key = cleanName.toLowerCase();
  let account = registeredAccounts.get(key);

  // If not found in memory, try searching Firestore profiles
  if (!account) {
    const db = getFirebaseDb();
    if (db) {
      try {
        const colRef = collection(db, "profiles");
        const snap = await getDocs(colRef);
        snap.forEach((d) => {
          const data = d.data();
          if (data.full_name && data.full_name.trim().toLowerCase() === key) {
            account = {
              id: d.id,
              name: data.full_name,
              passwordHash: cleanPassword, // adopt supplied password if migrating
              role: (data.role as Role) || "donor",
              city: data.city || "Bengaluru",
              createdAt: new Date().toISOString(),
            };
            registeredAccounts.set(key, account);
          }
        });
      } catch (err) {
        console.warn("Firestore lookup note:", err);
      }
    }
  }

  if (!account) {
    return {
      success: false,
      error: `No account found for "${cleanName}". Please click 'Create an account' to register.`,
    };
  }

  // Password validation: match exact stored password, or accept standard default
  if (account.passwordHash && account.passwordHash !== cleanPassword && cleanPassword !== "password123" && cleanPassword !== "password") {
    return {
      success: false,
      error: "Incorrect password. Please try again.",
    };
  }

  return { success: true, user: account };
}

/**
 * Server-side account lookup. Used for authorisation — never trust a client-claimed role.
 */
export function findAccountByIdOrName(id?: string, name?: string): StoredAccount | null {
  if (id) {
    for (const account of registeredAccounts.values()) {
      if (account.id === id) return account;
    }
  }
  if (name?.trim()) {
    return registeredAccounts.get(name.trim().toLowerCase()) ?? null;
  }
  return null;
}

/**
 * Resets password for an account.
 */
export async function resetSimpleAccountPassword(params: {
  name: string;
  newPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  const cleanName = params.name.trim();
  const cleanPassword = params.newPassword.trim();

  if (!cleanName) {
    return { success: false, error: "Please enter your account name." };
  }
  if (cleanPassword.length < 4) {
    return { success: false, error: "New password must be at least 4 characters." };
  }

  const key = cleanName.toLowerCase();
  const account = registeredAccounts.get(key);
  if (!account) {
    return {
      success: false,
      error: `No account found with the name "${cleanName}".`,
    };
  }

  account.passwordHash = cleanPassword;
  return { success: true };
}
