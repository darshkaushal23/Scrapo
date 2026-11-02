/**
 * Durable Trust & Safety document store.
 * 1) Firebase Admin Firestore when service account is configured
 * 2) Firestore REST with the verified request ID token (production-safe under security rules)
 * 3) Local JSON file only in non-production / test environments
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAuthRequestContext } from "../auth/request-context.ts";
import { getFirebaseAdminDb, isFirebaseAdminConfigured } from "../firebase/admin.ts";

type DocMap = Record<string, Record<string, unknown>>;

const memory: Record<string, Map<string, Record<string, unknown>>> = {};

function projectId() {
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "scrapo-613a1";
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.SCRAPO_PRODUCTION === "1";
}

function allowLocalFileFallback() {
  return !isProductionRuntime() || process.env.SCRAPO_ALLOW_FILE_STORE === "1";
}

function dataFile(collection: string) {
  const dir = join(process.cwd(), ".data", "trust-safety");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, `${collection}.json`);
}

function readFileCollection(collection: string): DocMap {
  try {
    const path = dataFile(collection);
    if (!existsSync(path)) return {};
    return JSON.parse(readFileSync(path, "utf8")) as DocMap;
  } catch {
    return {};
  }
}

function writeFileCollection(collection: string, docs: DocMap) {
  writeFileSync(dataFile(collection), JSON.stringify(docs, null, 2), "utf8");
}

function mem(collection: string) {
  if (!memory[collection]) {
    memory[collection] = new Map(Object.entries(readFileCollection(collection)));
  }
  return memory[collection];
}

function toFirestoreValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((item) => toFirestoreValue(item)) } };
  }
  if (typeof value === "object") {
    return { mapValue: { fields: toFirestoreFields(value as Record<string, unknown>) } };
  }
  return { stringValue: String(value) };
}

function toFirestoreFields(data: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    fields[key] = toFirestoreValue(value);
  }
  return fields;
}

function fromFirestoreValue(value: Record<string, unknown> | undefined): unknown {
  if (!value) return undefined;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) {
    const values = (value.arrayValue as { values?: Record<string, unknown>[] })?.values || [];
    return values.map((item) => fromFirestoreValue(item));
  }
  if ("mapValue" in value) {
    const fields = (value.mapValue as { fields?: Record<string, Record<string, unknown>> })?.fields || {};
    return fromFirestoreFields(fields);
  }
  return undefined;
}

function fromFirestoreFields(fields: Record<string, Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = fromFirestoreValue(value);
  }
  return out;
}

async function restPut(collection: string, id: string, data: Record<string, unknown>, idToken: string) {
  const name = `projects/${projectId()}/databases/(default)/documents/${collection}/${encodeURIComponent(id)}`;
  const fieldPaths = Object.keys(data).filter((key) => data[key] !== undefined);
  const url = `https://firestore.googleapis.com/v1/${name}?${fieldPaths.map((p) => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join("&")}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: toFirestoreFields({ ...data, id }) }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore REST write failed (${res.status}): ${text.slice(0, 300)}`);
  }
}

async function restGet(collection: string, id: string, idToken: string): Promise<(Record<string, unknown> & { id: string }) | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents/${collection}/${encodeURIComponent(id)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const body = (await res.json()) as { fields?: Record<string, Record<string, unknown>> };
  return { id, ...fromFirestoreFields(body.fields || {}) };
}

async function restList(collection: string, idToken: string): Promise<Array<Record<string, unknown> & { id: string }>> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents/${collection}?pageSize=300`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) return [];
  const body = (await res.json()) as {
    documents?: Array<{ name?: string; fields?: Record<string, Record<string, unknown>> }>;
  };
  return (body.documents || []).map((doc) => {
    const id = doc.name?.split("/").pop() || "";
    return { id, ...fromFirestoreFields(doc.fields || {}) };
  });
}

function cacheLocal(collection: string, id: string, data: Record<string, unknown>) {
  if (!allowLocalFileFallback()) return;
  const local = mem(collection);
  local.set(id, { ...data, id });
  writeFileCollection(collection, Object.fromEntries(local));
}

export async function trustPut(collection: string, id: string, data: Record<string, unknown>) {
  const db = getFirebaseAdminDb();
  if (db) {
    await db.collection(collection).doc(id).set(data, { merge: true });
    cacheLocal(collection, id, data);
    return;
  }

  const ctx = getAuthRequestContext();
  if (ctx?.idToken) {
    await restPut(collection, id, data, ctx.idToken);
    cacheLocal(collection, id, data);
    return;
  }

  if (!allowLocalFileFallback()) {
    throw new Error(
      "Durable Trust & Safety storage requires Firebase Admin credentials or a verified Firebase ID token in production.",
    );
  }

  const local = mem(collection);
  local.set(id, { ...data, id });
  writeFileCollection(collection, Object.fromEntries(local));
}

export async function trustGet<T extends Record<string, unknown>>(
  collection: string,
  id: string,
): Promise<(T & { id: string }) | null> {
  const db = getFirebaseAdminDb();
  if (db) {
    try {
      const snap = await db.collection(collection).doc(id).get();
      if (snap.exists) {
        const data = { id: snap.id, ...(snap.data() as object) } as T & { id: string };
        cacheLocal(collection, id, data);
        return data;
      }
    } catch {
      // fall through
    }
  }

  const ctx = getAuthRequestContext();
  if (ctx?.idToken) {
    const row = await restGet(collection, id, ctx.idToken);
    if (row) {
      cacheLocal(collection, id, row);
      return row as T & { id: string };
    }
  }

  if (!allowLocalFileFallback()) return null;
  const row = mem(collection).get(id);
  return row ? (row as T & { id: string }) : null;
}

export async function trustQuery<T extends Record<string, unknown>>(
  collection: string,
  predicate?: (row: T & { id: string }) => boolean,
): Promise<Array<T & { id: string }>> {
  const db = getFirebaseAdminDb();
  if (db) {
    try {
      const snap = await db.collection(collection).get();
      const rows: Array<T & { id: string }> = [];
      snap.forEach((doc) => {
        const row = { id: doc.id, ...(doc.data() as object) } as T & { id: string };
        cacheLocal(collection, doc.id, row);
        if (!predicate || predicate(row)) rows.push(row);
      });
      return rows;
    } catch {
      // fall through
    }
  }

  const ctx = getAuthRequestContext();
  if (ctx?.idToken) {
    const listed = await restList(collection, ctx.idToken);
    for (const row of listed) cacheLocal(collection, row.id, row);
    return listed
      .map((row) => row as T & { id: string })
      .filter((row) => (predicate ? predicate(row) : true));
  }

  if (!allowLocalFileFallback() && isFirebaseAdminConfigured() === false && isProductionRuntime()) {
    throw new Error("Trust & Safety queries require Firebase Admin or a verified ID token in production.");
  }

  return [...mem(collection).values()]
    .map((row) => row as T & { id: string })
    .filter((row) => (predicate ? predicate(row) : true));
}

export function trustReset(collection: string) {
  memory[collection] = new Map();
  if (!allowLocalFileFallback()) return;
  try {
    writeFileCollection(collection, {});
  } catch {
    // ignore
  }
}
