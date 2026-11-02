/**
 * Seeds Firebase Auth users + Firestore profiles for Scrapo production bootstrap.
 * Uses the public Identity Toolkit API key + Firestore REST with each user's ID token.
 *
 * Usage: node scripts/seed-firebase-users.mjs
 */

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "scrapo-613a1";
const PASSWORD = process.env.SCRAPO_SEED_PASSWORD || "password123";

if (!API_KEY) {
  console.error("Missing NEXT_PUBLIC_FIREBASE_API_KEY");
  process.exit(1);
}

const seeds = [
  { name: "Ananya Iyer", role: "donor", city: "Bengaluru", email: "ananya-iyer@accounts.scrapo.app" },
  { name: "Arjun Deshpande", role: "student", city: "Bengaluru", email: "arjun-deshpande@accounts.scrapo.app" },
  { name: "GreenCircuit Collective", role: "recycler", city: "Bengaluru", email: "greencircuit-collective@accounts.scrapo.app" },
  { name: "Leela Thomas", role: "admin", city: "Bengaluru", email: "leela-thomas@accounts.scrapo.app" },
  { name: "Sana Qureshi", role: "student", city: "Bengaluru", email: "sana-qureshi@accounts.scrapo.app" },
];

async function signUpOrSignIn(email, password) {
  const signUp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const signUpBody = await signUp.json();
  if (signUp.ok) return signUpBody;

  if (signUpBody.error?.message === "EMAIL_EXISTS") {
    const signIn = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    );
    const signInBody = await signIn.json();
    if (!signIn.ok) throw new Error(signInBody.error?.message || "Sign-in failed");
    return signInBody;
  }

  throw new Error(signUpBody.error?.message || "Sign-up failed");
}

function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") fields[k] = { stringValue: v };
    else if (typeof v === "number") fields[k] = { integerValue: String(v) };
    else if (typeof v === "boolean") fields[k] = { booleanValue: v };
  }
  return fields;
}

async function upsertProfile(idToken, uid, profile) {
  const name = `projects/${PROJECT_ID}/databases/(default)/documents/profiles/${uid}`;
  const paths = Object.keys(profile);
  const url = `https://firestore.googleapis.com/v1/${name}?${paths.map((p) => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join("&")}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: toFields(profile) }),
  });
  if (!res.ok) {
    const text = await res.text();
    // Admin role create is denied by rules for non-admins; seed admin profile via MCP after.
    throw new Error(`Profile write failed for ${uid}: ${text.slice(0, 240)}`);
  }
}

async function main() {
  const results = [];
  for (const seed of seeds) {
    const auth = await signUpOrSignIn(seed.email, PASSWORD);
    const roleForCreate = seed.role === "admin" ? "donor" : seed.role;
    try {
      await upsertProfile(auth.idToken, auth.localId, {
        id: auth.localId,
        full_name: seed.name,
        email: seed.email,
        role: roleForCreate,
        city: seed.city,
        points_month: 0,
        points_lifetime: 0,
      });
      results.push({
        name: seed.name,
        email: seed.email,
        uid: auth.localId,
        roleRequested: seed.role,
        profileRole: roleForCreate,
        note: seed.role === "admin" ? "Promote via Firebase MCP auth_update_user + Firestore admin role" : "ok",
      });
    } catch (err) {
      results.push({
        name: seed.name,
        email: seed.email,
        uid: auth.localId,
        roleRequested: seed.role,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  console.log(JSON.stringify({ password: PASSWORD, users: results }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
