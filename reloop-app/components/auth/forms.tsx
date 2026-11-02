"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { accountEmailFromName, sanitizeSelfAssignedRole } from "@/lib/auth/identity";
import {
  loginFirebaseEmailUser,
  registerFirebaseEmailUser,
  signInWithFirebaseCustomToken,
} from "@/lib/firebase/auth-service";
import { homeForRole } from "@/lib/prototype/model";
import { usePrototype } from "@/lib/prototype/session";
import type { Role } from "@/lib/types";

export function LoginForm() {
  const router = useRouter();
  const { signIn } = usePrototype();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; password?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = "Please enter your account name.";
    if (!password.trim()) nextErrors.password = "Please enter your password.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const email = accountEmailFromName(name.trim());
      const res = await loginFirebaseEmailUser(email, password.trim());
      setLoading(false);

      if (!res.success || !res.user) {
        setErrors({ general: res.error || "Invalid name or password." });
        return;
      }

      const profile = res.profile;
      signIn({
        id: res.user.uid,
        name: profile?.name || name.trim(),
        email: profile?.email || email,
        role: profile?.role || "donor",
        city: profile?.city || "Bengaluru",
        verificationStatus: profile?.verificationStatus,
      });

      router.push(homeForRole(profile?.role || "donor"));
    } catch (err) {
      setLoading(false);
      setErrors({
        general: err instanceof Error ? err.message : "Sign-in error. Please try again.",
      });
    }
  }

  function quickFill(presetName: string) {
    setName(presetName);
    setPassword("password123");
    setErrors({});
  }

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight">Log in</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Sign in with your Scrapo account name and password via Firebase Authentication.
      </p>

      {errors.general && (
        <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-xs font-semibold text-danger">
          {errors.general}
        </div>
      )}

      <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
        <Field label="Account Name" htmlFor="login-name" error={errors.name}>
          <TextInput
            id="login-name"
            autoComplete="username"
            placeholder="e.g. Darsh Kaushal or Ananya Iyer"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((prev) => ({ ...prev, name: "", general: "" }));
            }}
          />
        </Field>

        <Field label="Password" htmlFor="login-password" error={errors.password}>
          <div className="relative">
            <TextInput
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((prev) => ({ ...prev, password: "", general: "" }));
              }}
              className="pr-20"
            />
            <button
              type="button"
              className="absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-olive hover:underline"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </Field>

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "Signing in..." : "Log in"}
        </Button>
      </form>

      <div className="mt-8 rounded-2xl border border-line bg-card/60 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Quick Demo Login</p>
        <p className="mt-1 text-[11px] text-muted">
          Demo accounts must exist in Firebase Auth. Create them once via Sign up or Admin bootstrap.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => quickFill("Ananya Iyer")}
            className="rounded-xl border border-line bg-paper px-3 py-2 text-left text-xs transition hover:border-olive hover:bg-lime/10"
          >
            <div className="font-semibold text-ink">Ananya Iyer</div>
            <div className="text-[11px] text-muted">Donor Desk</div>
          </button>
          <button
            type="button"
            onClick={() => quickFill("Arjun Deshpande")}
            className="rounded-xl border border-line bg-paper px-3 py-2 text-left text-xs transition hover:border-olive hover:bg-lime/10"
          >
            <div className="font-semibold text-ink">Arjun Deshpande</div>
            <div className="text-[11px] text-muted">Student Desk</div>
          </button>
          <button
            type="button"
            onClick={() => quickFill("GreenCircuit Collective")}
            className="rounded-xl border border-line bg-paper px-3 py-2 text-left text-xs transition hover:border-olive hover:bg-lime/10"
          >
            <div className="font-semibold text-ink">GreenCircuit</div>
            <div className="text-[11px] text-muted">Recycler Desk</div>
          </button>
          <button
            type="button"
            onClick={() => quickFill("Leela Thomas")}
            className="rounded-xl border border-line bg-paper px-3 py-2 text-left text-xs transition hover:border-olive hover:bg-lime/10"
          >
            <div className="font-semibold text-ink">Leela Thomas</div>
            <div className="text-[11px] text-muted">Admin Console</div>
          </button>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="font-semibold text-olive hover:underline">
          Reset password
        </Link>
        <Link href="/signup" className="font-semibold text-olive hover:underline">
          Create an account
        </Link>
      </div>
    </div>
  );
}

export function SignupForm() {
  const router = useRouter();
  const { signIn } = usePrototype();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>("donor");
  const [city, setCity] = useState("Bengaluru");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (name.trim().length < 2) nextErrors.name = "Please enter your full name or organisation name.";
    if (password.trim().length < 6) nextErrors.password = "Choose a password with at least 6 characters.";
    if (role === "admin") nextErrors.role = "Admin accounts cannot be self-registered.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    const safeRole = sanitizeSelfAssignedRole(role);
    const displayName = name.trim();
    const email = accountEmailFromName(displayName);

    try {
      // Prefer Admin bootstrap when available (sets profile server-side, blocks admin).
      const bootstrap = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: displayName,
          password: password.trim(),
          role: safeRole,
          city: city.trim() || "Bengaluru",
        }),
      });
      const bootstrapBody = await bootstrap.json();

      if (bootstrap.ok && bootstrapBody.success && bootstrapBody.customToken) {
        const signed = await signInWithFirebaseCustomToken(bootstrapBody.customToken as string);
        if (!signed.success || !signed.user) {
          setLoading(false);
          setErrors({ name: signed.error || "Could not complete Firebase sign-in." });
          return;
        }
        signIn({
          id: signed.user.uid,
          name: displayName,
          email,
          role: safeRole,
          city: city.trim() || "Bengaluru",
        });
        setLoading(false);
        router.push(safeRole === "admin" ? homeForRole(safeRole) : "/verify");
        return;
      }

      // Browser Firebase Auth path when Admin SDK is not configured.
      const res = await registerFirebaseEmailUser(
        email,
        password.trim(),
        displayName,
        safeRole,
        city.trim() || "Bengaluru",
      );
      setLoading(false);
      if (!res.success || !res.user) {
        setErrors({
          name:
            bootstrapBody.code === "ADMIN_REQUIRED"
              ? res.error || "Could not create account with Firebase Auth."
              : bootstrapBody.error || res.error || "Could not create account.",
        });
        return;
      }

      signIn({
        id: res.user.uid,
        name: displayName,
        email,
        role: safeRole,
        city: city.trim() || "Bengaluru",
      });
      router.push("/verify");
    } catch {
      setLoading(false);
      setErrors({ name: "Network error. Please try again." });
    }
  }

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight">Create an account</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Create a Firebase-authenticated Scrapo account. Your display name maps to a private auth email; admin cannot be self-assigned.
      </p>

      <form className="mt-8 space-y-4" onSubmit={submit} noValidate>
        <Field label="Your Name" htmlFor="signup-name" error={errors.name}>
          <TextInput
            id="signup-name"
            autoComplete="name"
            placeholder="e.g. Darsh Kaushal or GreenCircuit"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((prev) => ({ ...prev, name: "" }));
            }}
          />
        </Field>

        <Field label="Password" htmlFor="signup-password" error={errors.password}>
          <div className="relative">
            <TextInput
              id="signup-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((prev) => ({ ...prev, password: "" }));
              }}
              className="pr-20"
            />
            <button
              type="button"
              className="absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-olive hover:underline"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </Field>

        <Field label="I am joining as" htmlFor="signup-role" error={errors.role}>
          <SelectInput
            id="signup-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="donor">Donor</option>
            <option value="student">Student</option>
            <option value="recycler">Recycler partner</option>
          </SelectInput>
        </Field>

        <Field label="City" htmlFor="signup-city">
          <TextInput
            id="signup-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Bengaluru"
          />
        </Field>

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-olive hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Please enter your account name.");
      return;
    }
    if (newPassword.trim().length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), newPassword: newPassword.trim() }),
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok || !data.success) {
        setError(
          data.error ||
            "Could not update password. Firebase Admin credentials are required for server-side resets.",
        );
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 1200);
    } catch {
      setLoading(false);
      setError("Network error. Please try again.");
    }
  }

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight">Reset Password</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Enter your account name and choose a new Firebase Auth password. Requires server Admin credentials.
      </p>

      {error ? (
        <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-xs font-semibold text-danger">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-4 rounded-2xl border border-lime/40 bg-lime/10 p-3 text-xs font-semibold text-olive">
          Password updated. Redirecting to login...
        </div>
      ) : null}

      <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
        <Field label="Account Name" htmlFor="reset-name">
          <TextInput
            id="reset-name"
            placeholder="e.g. Darsh Kaushal"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="New password" htmlFor="reset-password">
          <TextInput
            id="reset-password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 6 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "Updating..." : "Update password"}
        </Button>
      </form>
    </div>
  );
}
