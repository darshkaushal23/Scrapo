import { accountEmailFromName, sanitizeSelfAssignedRole } from "@/lib/auth/identity";
import { getFirebaseAdminAuth, getFirebaseAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type { Role } from "@/lib/types";

/**
 * Account bootstrap via Firebase Auth (Admin SDK).
 * Clients should prefer client-side Email/Password Auth and send ID tokens to APIs.
 * This route creates users / issues custom tokens when Admin credentials are present.
 */

export async function POST(request: Request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return Response.json(
        {
          error:
            "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON, or create the account from the browser with Firebase Auth.",
          code: "ADMIN_REQUIRED",
        },
        { status: 503 },
      );
    }

    const body = (await request.json()) as {
      name?: unknown;
      password?: unknown;
      role?: unknown;
      city?: unknown;
    };

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = sanitizeSelfAssignedRole(body.role);
    const city = typeof body.city === "string" && body.city.trim() ? body.city.trim() : "Bengaluru";

    if (name.length < 2) {
      return Response.json({ error: "Please enter your full name (at least 2 characters)." }, { status: 400 });
    }
    if (password.length < 6) {
      return Response.json({ error: "Password must be at least 6 characters for Firebase Auth." }, { status: 400 });
    }
    if (body.role === "admin") {
      return Response.json({ error: "Administrator accounts cannot be self-registered." }, { status: 400 });
    }

    const auth = getFirebaseAdminAuth();
    const db = getFirebaseAdminDb();
    if (!auth || !db) {
      return Response.json({ error: "Firebase Admin Auth is unavailable." }, { status: 503 });
    }

    const email = accountEmailFromName(name);
    let user;
    try {
      user = await auth.createUser({
        email,
        password,
        displayName: name,
        emailVerified: false,
      });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/email-already-exists") {
        return Response.json({ error: `An account named "${name}" already exists. Please log in instead.` }, { status: 400 });
      }
      throw err;
    }

    await db.collection("profiles").doc(user.uid).set(
      {
        id: user.uid,
        full_name: name,
        email,
        role,
        city,
        points_month: 0,
        points_lifetime: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { merge: true },
    );

    const customToken = await auth.createCustomToken(user.uid, { role });

    return Response.json({
      success: true,
      customToken,
      user: { id: user.uid, name, role, city, email },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    // Password verification must happen in the browser via Firebase Auth.
    // This endpoint only resolves the auth email for a display name.
    const body = (await request.json()) as { name?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return Response.json({ error: "Please enter your account name." }, { status: 400 });
    }
    const email = accountEmailFromName(name);
    return Response.json({
      success: true,
      email,
      message: "Use Firebase Email/Password sign-in with this email and your password.",
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return Response.json(
        { error: "Firebase Admin is required to reset passwords server-side. Use Firebase client reset otherwise." },
        { status: 503 },
      );
    }
    const body = (await request.json()) as { name?: unknown; newPassword?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (!name) return Response.json({ error: "Please enter your account name." }, { status: 400 });
    if (newPassword.length < 6) {
      return Response.json({ error: "New password must be at least 6 characters." }, { status: 400 });
    }

    const auth = getFirebaseAdminAuth();
    if (!auth) return Response.json({ error: "Firebase Admin Auth is unavailable." }, { status: 503 });
    const email = accountEmailFromName(name);
    const user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password: newPassword });
    return Response.json({ success: true, message: "Password updated successfully." });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "auth/user-not-found") {
      return Response.json({ error: `No account found with the name provided.` }, { status: 400 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

// Keep Role import used for documentation of response shape.
export type AccountRole = Role;
