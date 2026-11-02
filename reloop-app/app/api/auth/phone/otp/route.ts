import {
  requestPhoneOtp,
  verifyPhoneOtp,
  findUserByPhone,
  normalizePhoneNumber,
  saveUserProfile,
} from "@/lib/auth/phone-service";
import { sanitizeSelfAssignedRole } from "@/lib/auth/identity";
import type { Role } from "@/lib/types";

const isProd = process.env.NODE_ENV === "production" || process.env.SCRAPO_PRODUCTION === "1";

export async function POST(request: Request) {
  try {
    if (isProd && process.env.SCRAPO_ALLOW_PHONE_OTP_FALLBACK !== "1") {
      return Response.json(
        {
          error:
            "Prototype phone OTP gateway is disabled in production. Use Firebase Phone Authentication from the client.",
          code: "USE_FIREBASE_PHONE_AUTH",
        },
        { status: 503 },
      );
    }

    const body = (await request.json()) as { phone?: unknown };
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";

    if (!phone) {
      return Response.json({ error: "Phone number is required." }, { status: 400 });
    }

    const res = requestPhoneOtp(phone);
    if (!res.success) {
      return Response.json(
        { error: res.error, cooldownRemaining: res.cooldownRemaining },
        { status: 400 },
      );
    }

    const existingUser = await findUserByPhone(phone);

    return Response.json({
      success: true,
      phoneNumber: res.phoneNumber,
      originBoundSms: res.originBoundSms,
      isExistingUser: Boolean(existingUser),
      user: existingUser,
      // Never return OTP codes outside local/dev.
      ...(isProd ? {} : { code: res.code }),
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
    if (isProd && process.env.SCRAPO_ALLOW_PHONE_OTP_FALLBACK !== "1") {
      return Response.json(
        {
          error: "Prototype phone OTP verification is disabled in production. Use Firebase Phone Authentication.",
          code: "USE_FIREBASE_PHONE_AUTH",
        },
        { status: 503 },
      );
    }

    const body = (await request.json()) as {
      phone?: unknown;
      code?: unknown;
      name?: unknown;
      role?: unknown;
      city?: unknown;
    };
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const role = sanitizeSelfAssignedRole(body.role);
    const city = typeof body.city === "string" ? body.city.trim() : "Bengaluru";

    if (!phone || !code) {
      return Response.json({ error: "Phone number and 6-digit code are required." }, { status: 400 });
    }

    const res = verifyPhoneOtp(phone, code);
    if (!res.valid) {
      return Response.json({ error: res.error || "Invalid verification code." }, { status: 400 });
    }

    const norm = normalizePhoneNumber(phone);
    let user = await findUserByPhone(phone);

    if (!user && name) {
      user = await saveUserProfile({
        name,
        phone: norm,
        role,
        city,
      });
    }

    return Response.json({
      valid: true,
      user: user || {
        id: `phone_${Date.now()}`,
        name: name || "Verified Member",
        role: role as Role,
        city,
        phone: norm,
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
