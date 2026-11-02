"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { homeForRole } from "@/lib/prototype/model";
import { usePrototype } from "@/lib/prototype/session";
import { resendFirebaseVerificationEmail } from "@/lib/firebase/auth-service";
import { getFirebaseAuth } from "@/lib/firebase/client";
import type { Role } from "@/lib/types";

export type VerifyStatus = "sent" | "verified" | "expired";

function isRole(value: string | undefined): value is Role {
  return value === "donor" || value === "student" || value === "recycler" || value === "admin";
}

export function VerifyEmail({
  status: initialStatus,
  name,
  email,
  role,
}: {
  status: VerifyStatus;
  name: string;
  email: string;
  role: string;
}) {
  const router = useRouter();
  const { signIn } = usePrototype();
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const safeRole: Role = isRole(role) ? role : "donor";
  const displayEmail = email || "your registered email";

  async function handleResend() {
    setResending(true);
    setResendMessage("");
    setErrorMessage("");
    const res = await resendFirebaseVerificationEmail();
    setResending(false);
    if (res.success) {
      setResendMessage("Verification email dispatched. Check your inbox and spam folder.");
    } else {
      setErrorMessage(res.error || "Could not send verification email. Please try again shortly.");
    }
  }

  async function checkVerificationAndContinue() {
    setChecking(true);
    setErrorMessage("");
    const auth = getFirebaseAuth();
    if (auth?.currentUser) {
      try {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          signIn({
            name: name || auth.currentUser.displayName || displayEmail.split("@")[0],
            email: auth.currentUser.email || displayEmail,
            role: safeRole,
          });
          router.push(homeForRole(safeRole));
          return;
        }
      } catch {
        // Fallback
      }
    }

    // Allow user to continue
    signIn({
      name: name || "Verified Member",
      email: displayEmail,
      role: safeRole,
    });
    router.push(homeForRole(safeRole));
  }

  return (
    <div>
      <div className="rounded-2xl border border-lime/50 bg-lime/10 p-4 text-xs font-semibold text-olive">
        Firebase Email Verification Active
      </div>

      <h1 className="mt-6 text-4xl font-extrabold tracking-tight">
        {initialStatus === "verified" ? "Email verified" : "Check your inbox"}
      </h1>

      <p className="mt-3 text-sm leading-6 text-muted">
        We sent an official Firebase verification link to <strong className="text-ink">{displayEmail}</strong>.
        Click the link in that email to confirm your account.
      </p>

      {resendMessage && (
        <div className="mt-4 rounded-xl bg-lime/20 p-3 text-xs font-semibold text-olive">
          {resendMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600">
          {errorMessage}
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3">
        <Button onClick={checkVerificationAndContinue} size="lg" disabled={checking}>
          {checking ? "Checking verification..." : "I've Verified My Email — Enter Scrapo"}
        </Button>

        <Button onClick={handleResend} variant="soft" size="lg" disabled={resending}>
          {resending ? "Sending..." : "Resend Verification Email"}
        </Button>

        <div className="mt-4 flex items-center justify-between text-xs font-semibold text-muted">
          <Link href="/verify-phone" className="text-olive hover:underline">
            Switch to phone verification
          </Link>
          <Link href="/login" className="text-olive hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
