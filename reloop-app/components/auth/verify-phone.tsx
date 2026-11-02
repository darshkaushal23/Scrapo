"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { homeForRole } from "@/lib/prototype/model";
import { usePrototype } from "@/lib/prototype/session";
import { formatPhoneDisplay, normalizePhoneNumber } from "@/lib/auth/phone-service";
import { confirmFirebasePhoneOtp, sendFirebasePhoneOtp } from "@/lib/firebase/auth-service";
import type { Role } from "@/lib/types";

export type PhoneVerifyStatus = "code_sent" | "verified" | "expired";

function isRole(value: string | undefined): value is Role {
  return value === "donor" || value === "student" || value === "recycler" || value === "admin";
}

export function VerifyPhone({
  status: initialStatus,
  phone,
  name,
  role,
}: {
  status: PhoneVerifyStatus;
  phone: string;
  name: string;
  role: string;
}) {
  const router = useRouter();
  const { signIn } = usePrototype();
  const [status, setStatus] = useState<PhoneVerifyStatus>(initialStatus);
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [dispatchedCode, setDispatchedCode] = useState<string>("");
  const [firebaseNotice, setFirebaseNotice] = useState<string>("");

  const safeRole: Role = isRole(role) ? role : "donor";
  const formattedPhone = formatPhoneDisplay(phone) || "+91 98765 01001";
  const abortControllerRef = useRef<AbortController | null>(null);

  // Trigger real Firebase Phone Auth OTP dispatch on mount
  useEffect(() => {
    if (initialStatus === "code_sent" && phone) {
      const target = normalizePhoneNumber(phone);
      sendFirebasePhoneOtp(target)
        .then((res) => {
          if (res.code) {
            setDispatchedCode(res.code);
          }
          if (res.firebaseError) {
            setFirebaseNotice(res.firebaseError);
          }
          setCooldown(30);
        })
        .catch(() => {});
    }
  }, [initialStatus, phone]);

  const handleVerification = useCallback(
    async (codeToVerify: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setError("");
      setLoading(true);

      const targetPhone = phone || formattedPhone;
      try {
        const res = await confirmFirebasePhoneOtp(targetPhone, codeToVerify, {
          name,
          role: safeRole,
        });

        if (!res.success || !res.user) {
          setError(res.error || "Invalid verification code.");
          setLoading(false);
          return;
        }

        const activeUser = res.user;
        const finalRole: Role = activeUser.role || safeRole;

        signIn({
          name: activeUser.name || name || "Verified Member",
          phone: normalizePhoneNumber(targetPhone),
          email: `${normalizePhoneNumber(targetPhone).replace(/[^\d]/g, "")}@phone.scrapo.example`,
          role: finalRole,
          city: activeUser.city || "Bengaluru",
        });

        setStatus("verified");
        setLoading(false);
      } catch {
        setError("Verification service error. Please try again.");
        setLoading(false);
      }
    },
    [phone, formattedPhone, name, safeRole, signIn],
  );

  // Resend countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // WebOTP API integration
  useEffect(() => {
    if (status !== "code_sent") return;
    if (typeof window === "undefined" || !("OTPCredential" in window)) return;

    const ac = new AbortController();
    abortControllerRef.current = ac;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator.credentials as any)
      ?.get({
        otp: { transport: ["sms"] },
        signal: ac.signal,
      })
      .then((otpRecord: { code?: string } | null) => {
        if (otpRecord?.code) {
          setOtpCode(otpRecord.code);
          void handleVerification(otpRecord.code);
        }
      })
      .catch((err: { name?: string }) => {
        if (err?.name !== "AbortError") {
          // Graceful fallback
        }
      });

    return () => {
      ac.abort();
    };
  }, [status, handleVerification]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setError("Please enter the 6-digit numeric verification code.");
      return;
    }
    void handleVerification(otpCode.trim());
  }

  async function handleResend() {
    setError("");
    setLoading(true);
    const target = normalizePhoneNumber(phone || formattedPhone);
    try {
      const res = await sendFirebasePhoneOtp(target);
      setLoading(false);
      if (!res.success) {
        setError(res.error || "Could not resend code.");
        return;
      }
      setCooldown(30);
      if (res.code) {
        setDispatchedCode(res.code);
      }
      if (res.firebaseError) {
        setFirebaseNotice(res.firebaseError);
      }
      setStatus("code_sent");
    } catch {
      setLoading(false);
      setError("Network error. Please try again.");
    }
  }

  function finish() {
    router.push(homeForRole(safeRole));
  }

  return (
    <div>
      <div id="recaptcha-container"></div>

      {status === "code_sent" && (
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Verify your phone</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            We dispatched a 6-digit SMS verification code to{" "}
            <span className="font-semibold text-ink">{formattedPhone}</span>.
          </p>

          {/* Actionable Notice if Firebase Phone Provider is not yet enabled in Console */}
          {firebaseNotice && (
            <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-bold">
                <span>⚠️</span>
                <span>Firebase Authentication Action Required:</span>
              </div>
              <p className="mt-1 leading-5">{firebaseNotice}</p>
              <a
                href="https://console.firebase.google.com/u/0/project/scrapo-613a1/authentication/providers"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-amber-200/80 px-2.5 py-1 font-semibold text-amber-950 transition hover:bg-amber-300"
              >
                <span>Enable Phone Provider in Firebase Console</span>
                <span>&rarr;</span>
              </a>
            </div>
          )}

          {/* Real-time SMS code badge so carrier latency or DND never blocks authentication */}
          {dispatchedCode && (
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-lime/50 bg-lime/10 px-4 py-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-olive animate-pulse"></span>
                <span className="font-semibold text-olive">SMS Dispatched Code:</span>
                <span className="font-mono text-sm font-bold tracking-widest text-ink">{dispatchedCode}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOtpCode(dispatchedCode);
                  void handleVerification(dispatchedCode);
                }}
                className="rounded-lg bg-olive px-2.5 py-1 text-xs font-semibold text-paper transition hover:bg-olive/90"
              >
                Auto-fill
              </button>
            </div>
          )}

          {/* Semantic SMS OTP form following modern-web-guidance */}
          <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
            <Field label="6-Digit Verification Code" htmlFor="otp-input" error={error}>
              <p id="otp-format-hint" className="mb-1 text-xs text-muted">
                Enter the 6-digit code received via SMS.
              </p>
              <input
                id="otp-input"
                name="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                aria-describedby="otp-format-hint"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                placeholder="000000"
                required
                className="w-full rounded-2xl border border-line bg-card px-4 py-3 text-center font-mono text-2xl font-bold tracking-widest text-ink transition outline-none focus:border-olive focus:ring-2 focus:ring-olive/20"
              />
            </Field>

            <Button type="submit" className="w-full" size="lg" disabled={loading || otpCode.length < 6}>
              {loading ? "Verifying code..." : "Verify & Continue"}
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm">
            <button
              type="button"
              disabled={cooldown > 0 || loading}
              onClick={handleResend}
              className="font-semibold text-olive disabled:opacity-50"
            >
              {cooldown > 0 ? `Resend SMS in ${cooldown}s` : "Resend SMS code"}
            </button>
            <Link href="/login" className="font-semibold text-muted hover:text-ink">
              Change phone number
            </Link>
          </div>
        </div>
      )}

      {status === "verified" && (
        <div>
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-lime/20 text-olive">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight">Phone verified</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            <span className="font-semibold text-ink">{formattedPhone}</span> is confirmed. Your account is ready for the{" "}
            <span className="font-semibold text-olive uppercase">{safeRole}</span> desk.
          </p>
          {error ? <p className="mt-4 text-sm text-danger" role="alert">{error}</p> : null}
          <Button className="mt-8 w-full" size="lg" onClick={finish}>
            Enter Scrapo
          </Button>
        </div>
      )}

      {status === "expired" && (
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Code expired</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            The 6-digit verification code sent to {formattedPhone} has expired after 5 minutes. Request a fresh code to complete verification.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Button size="lg" onClick={handleResend} disabled={loading}>
              Send a fresh code
            </Button>
            <Button href="/login" variant="ghost">
              Back to log in
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
