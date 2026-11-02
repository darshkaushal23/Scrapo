import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  sendEmailVerification,
  PhoneAuthProvider,
  signInWithCredential,
  RecaptchaVerifier,
  signOut,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { sanitizeSelfAssignedRole } from "@/lib/auth/identity";
import { getFirebaseAuth, getFirebaseDb } from "./client.ts";
import type { Role, DemoProfile } from "@/lib/types";

declare global {
  interface Window {
    scrapoRecaptchaVerifier?: RecaptchaVerifier;
    scrapoConfirmationResult?: ConfirmationResult;
    scrapoVerificationId?: string;
  }
}

export function setConfirmationResult(result: ConfirmationResult | null) {
  if (typeof window !== "undefined") {
    if (result) {
      window.scrapoConfirmationResult = result;
    } else {
      delete window.scrapoConfirmationResult;
    }
  }
}

export function getConfirmationResult(): ConfirmationResult | null {
  if (typeof window !== "undefined") {
    return window.scrapoConfirmationResult || null;
  }
  return null;
}

export function getStoredVerificationId(): string | null {
  if (typeof window === "undefined") return null;
  return window.scrapoVerificationId || window.sessionStorage.getItem("scrapo_phone_verification_id") || null;
}

export function setStoredVerificationId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) {
    window.scrapoVerificationId = id;
    try {
      window.sessionStorage.setItem("scrapo_phone_verification_id", id);
    } catch {
      // ignore
    }
  } else {
    delete window.scrapoVerificationId;
    try {
      window.sessionStorage.removeItem("scrapo_phone_verification_id");
    } catch {
      // ignore
    }
  }
}

/**
 * Initializes or reuses an invisible reCAPTCHA verifier for Firebase Phone Auth.
 * Container is rendered in the visible DOM (not display:none) to adhere to reCAPTCHA requirements.
 */
export async function getOrCreateRecaptchaVerifier(containerId = "recaptcha-container"): Promise<RecaptchaVerifier | null> {
  const auth = getFirebaseAuth();
  if (!auth || typeof window === "undefined") return null;

  try {
    if (window.scrapoRecaptchaVerifier) {
      return window.scrapoRecaptchaVerifier;
    }

    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement("div");
      container.id = containerId;
      container.className = "fixed bottom-0 right-0 z-50 pointer-events-none opacity-0";
      document.body.appendChild(container);
    }

    const verifier = new RecaptchaVerifier(auth, containerId, {
      size: "invisible",
      callback: () => {
        // reCAPTCHA solved automatically by invisible flow
      },
      "expired-callback": () => {
        console.warn("reCAPTCHA expired, resetting...");
        if (window.scrapoRecaptchaVerifier) {
          try {
            window.scrapoRecaptchaVerifier.clear();
          } catch {
            // ignore
          }
          delete window.scrapoRecaptchaVerifier;
        }
      },
    });

    await verifier.render();
    window.scrapoRecaptchaVerifier = verifier;
    return verifier;
  } catch (err) {
    console.warn("Failed to create RecaptchaVerifier:", err);
    return null;
  }
}

/**
 * Translates Firebase Phone Auth error codes into clear, actionable advice.
 */
export function getFirebasePhoneErrorMessage(errCode?: string, fallback = ""): string {
  switch (errCode) {
    case "auth/operation-not-allowed":
      return "Phone Sign-In is not enabled yet in your Firebase Console. Go to console.firebase.google.com/project/scrapo-613a1/authentication/providers and enable 'Phone'.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized for Firebase Auth. Add 'reloop-app-five.vercel.app' in Firebase Console > Authentication > Settings > Authorized domains.";
    case "auth/invalid-phone-number":
      return "Invalid phone number format. Please provide full mobile number with country code (e.g. +91 98765 43210).";
    case "auth/quota-exceeded":
      return "Firebase daily SMS quota exceeded. Add test phone numbers in Firebase Console or upgrade to Blaze plan.";
    case "auth/too-many-requests":
      return "Too many SMS requests sent to this number. Please wait a few minutes before trying again.";
    case "auth/captcha-check-failed":
      return "reCAPTCHA verification failed. Please refresh the page and try again.";
    default:
      return fallback || "Could not dispatch SMS. Please check your network and phone number.";
  }
}

/**
 * Sends a real SMS verification code using PhoneAuthProvider.verifyPhoneNumber.
 * Exactly matches the pattern:
 * PhoneAuthProvider.verifyPhoneNumber(phoneNumber, applicationVerifier)
 * Returns verificationId to be used with PhoneAuthProvider.credential(verificationId, verificationCode).
 */
export async function sendFirebasePhoneOtp(
  phoneNumber: string,
): Promise<{
  success: boolean;
  source: "firebase" | "server";
  verificationId?: string;
  confirmationResult?: ConfirmationResult;
  code?: string;
  firebaseError?: string;
  error?: string;
}> {
  const auth = getFirebaseAuth();
  let firebaseFailureReason: string | undefined;

  if (auth) {
    try {
      const verifier = await getOrCreateRecaptchaVerifier("recaptcha-container");
      if (verifier) {
        console.log(`[Firebase PhoneAuthProvider] Sending SMS verification code to ${phoneNumber}...`);
        
        // 1. PhoneAuthProvider.verifyPhoneNumber
        const provider = new PhoneAuthProvider(auth);
        const verificationId = await provider.verifyPhoneNumber(phoneNumber, verifier);
        
        setStoredVerificationId(verificationId);
        console.log(`[Firebase PhoneAuthProvider] Verification code dispatched, verificationId:`, verificationId);
        
        return {
          success: true,
          source: "firebase",
          verificationId,
        };
      }
    } catch (firebaseErr: unknown) {
      const errObj = firebaseErr as { code?: string; message?: string };
      console.warn("Firebase PhoneAuthProvider failed:", errObj.code, errObj.message);
      firebaseFailureReason = getFirebasePhoneErrorMessage(errObj.code, errObj.message);

      // Clean up verifier to allow fresh attempt
      if (window.scrapoRecaptchaVerifier) {
        try {
          window.scrapoRecaptchaVerifier.clear();
        } catch {
          // ignore
        }
        delete window.scrapoRecaptchaVerifier;
      }
    }
  }

  // Prototype server SMS gateway — disabled in production.
  if (process.env.NODE_ENV === "production" || process.env.SCRAPO_PRODUCTION === "1") {
    return {
      success: false,
      source: "firebase",
      error:
        firebaseFailureReason ||
        "Firebase Phone Auth is required in production. Enable Phone provider and authorized domains in Firebase Console.",
      firebaseError: firebaseFailureReason,
    };
  }

  try {
    const res = await fetch("/api/auth/phone/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phoneNumber }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        source: "server",
        code: data.code,
        firebaseError: firebaseFailureReason,
      };
    }
    return {
      success: false,
      source: "server",
      error: firebaseFailureReason || data.error || "Could not dispatch verification code.",
      firebaseError: firebaseFailureReason,
    };
  } catch {
    return {
      success: false,
      source: "server",
      error: firebaseFailureReason || "Network error sending verification code.",
      firebaseError: firebaseFailureReason,
    };
  }
}

/**
 * Confirms the phone verification code using PhoneAuthProvider.credential(verificationId, verificationCode)
 * exactly matching:
 * val credential = PhoneAuthProvider.getCredential(verificationId, verificationCode)
 * followed by signInWithCredential(auth, credential).
 */
export async function confirmFirebasePhoneOtp(
  phoneNumber: string,
  code: string,
  profileData?: { name?: string; role?: Role; city?: string },
  customVerificationId?: string,
): Promise<{
  success: boolean;
  user?: { uid: string; name: string; phone: string; role: Role; city: string };
  error?: string;
}> {
  const auth = getFirebaseAuth();
  const verificationId = customVerificationId || getStoredVerificationId();

  // 1. First attempt: PhoneAuthProvider.credential + signInWithCredential
  if (auth && verificationId) {
    try {
      console.log(`[Firebase PhoneAuthProvider] Verifying credential with verificationId and code...`);
      const phoneCredential = PhoneAuthProvider.credential(verificationId, code);
      const userCredential = await signInWithCredential(auth, phoneCredential);
      const user = userCredential.user;

      // Sync or retrieve Firestore profile
      const profile = await syncUserProfileInFirestore(user.uid, {
        name: profileData?.name || user.displayName || "Verified Member",
        phone: user.phoneNumber || phoneNumber,
        role: profileData?.role || "donor",
        city: profileData?.city || "Bengaluru",
      });

      setStoredVerificationId(null);
      return {
        success: true,
        user: {
          uid: user.uid,
          name: profile.name,
          phone: profile.phone || phoneNumber,
          role: profile.role,
          city: profile.city,
        },
      };
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      console.warn("PhoneAuthProvider credential verification failed:", errObj.code, errObj.message);
      if (errObj.code === "auth/invalid-verification-code") {
        return {
          success: false,
          error: "Invalid 6-digit code. Please enter the exact code received via SMS.",
        };
      }
      if (errObj.code === "auth/code-expired") {
        return {
          success: false,
          error: "SMS verification code has expired. Please request a new code.",
        };
      }
    }
  }

  // 2. Second attempt: ConfirmationResult.confirm (if active)
  const activeConfirmation = getConfirmationResult();
  if (activeConfirmation) {
    try {
      const credential = await activeConfirmation.confirm(code);
      const user = credential.user;

      const profile = await syncUserProfileInFirestore(user.uid, {
        name: profileData?.name || user.displayName || "Verified Member",
        phone: user.phoneNumber || phoneNumber,
        role: profileData?.role || "donor",
        city: profileData?.city || "Bengaluru",
      });

      setConfirmationResult(null);
      return {
        success: true,
        user: {
          uid: user.uid,
          name: profile.name,
          phone: profile.phone || phoneNumber,
          role: profile.role,
          city: profile.city,
        },
      };
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      console.warn("ConfirmationResult confirm failed:", errObj.message);
    }
  }

  if (process.env.NODE_ENV === "production" || process.env.SCRAPO_PRODUCTION === "1") {
    return {
      success: false,
      error: "Firebase Phone Auth verification failed. Prototype OTP fallback is disabled in production.",
    };
  }

  // 3. Dev-only fallback: Server API verification
  try {
    const res = await fetch("/api/auth/phone/otp", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phoneNumber,
        code,
        name: profileData?.name,
        role: profileData?.role,
        city: profileData?.city,
      }),
    });
    const data = await res.json();
    if (res.ok && data.valid) {
      const u = data.user;
      return {
        success: true,
        user: {
          uid: u?.id || `phone_${Date.now()}`,
          name: u?.name || profileData?.name || "Verified Member",
          phone: phoneNumber,
          role: sanitizeSelfAssignedRole(u?.role || profileData?.role || "donor"),
          city: u?.city || profileData?.city || "Bengaluru",
        },
      };
    }
    return {
      success: false,
      error: data.error || "Invalid 6-digit verification code.",
    };
  } catch {
    return {
      success: false,
      error: "Verification failed. Please check your code and try again.",
    };
  }
}

/**
 * Registers a user with Firebase Email and Password and dispatches a verification email.
 */
export async function signInWithFirebaseCustomToken(customToken: string): Promise<{
  success: boolean;
  user?: User;
  error?: string;
}> {
  const auth = getFirebaseAuth();
  if (!auth) {
    return { success: false, error: "Firebase Authentication is not initialized." };
  }
  try {
    const cred = await signInWithCustomToken(auth, customToken);
    return { success: true, user: cred.user };
  } catch (err: unknown) {
    const errObj = err as { message?: string };
    return { success: false, error: errObj.message || "Could not sign in with custom token." };
  }
}

export async function registerFirebaseEmailUser(
  email: string,
  pass: string,
  name: string,
  role: Role = "donor",
  city = "Bengaluru",
): Promise<{
  success: boolean;
  user?: User;
  error?: string;
}> {
  const auth = getFirebaseAuth();
  if (!auth) {
    return { success: false, error: "Firebase Authentication is not initialized." };
  }

  const safeRole = sanitizeSelfAssignedRole(role);

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const user = cred.user;

    // Synthetic @accounts.scrapo.app emails are not mailbox-backed; skip verification mail noise.
    if (!email.endsWith("@accounts.scrapo.app")) {
      await sendEmailVerification(user).catch((e) => {
        console.warn("Email verification send note:", e.message);
      });
    }

    // Save profile to Firestore (never admin via client path)
    await syncUserProfileInFirestore(user.uid, {
      name,
      email: user.email || email,
      role: safeRole,
      city,
    });

    return {
      success: true,
      user,
    };
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    let msg = "Could not create account.";
    if (errObj.code === "auth/email-already-in-use") {
      msg = "An account with this email already exists. Please log in.";
    } else if (errObj.code === "auth/weak-password") {
      msg = "Password must be at least 6 characters.";
    } else if (errObj.code === "auth/invalid-email") {
      msg = "Invalid email format.";
    } else if (errObj.message) {
      msg = errObj.message;
    }
    return { success: false, error: msg };
  }
}

/**
 * Signs in a user with Firebase Email and Password.
 */
export async function loginFirebaseEmailUser(
  email: string,
  pass: string,
): Promise<{
  success: boolean;
  user?: User;
  profile?: DemoProfile;
  error?: string;
}> {
  const auth = getFirebaseAuth();
  if (!auth) {
    return { success: false, error: "Firebase Authentication is not configured." };
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const user = cred.user;

    // Fetch profile from Firestore
    const profile = await fetchUserProfileFromFirestore(user.uid);

    return {
      success: true,
      user,
      profile: profile || {
        name: user.displayName || email.split("@")[0],
        email: user.email || email,
        role: "donor",
        city: "Bengaluru",
        pointsMonth: 120,
        pointsLifetime: 540,
        rank: 14,
        personalized: true,
      },
    };
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    let msg = "Invalid email or password.";
    if (errObj.code === "auth/user-not-found" || errObj.code === "auth/wrong-password" || errObj.code === "auth/invalid-credential") {
      msg = "Incorrect email or password.";
    } else if (errObj.message) {
      msg = errObj.message;
    }
    return { success: false, error: msg };
  }
}

/**
 * Resends the verification email to the current Firebase user.
 */
export async function resendFirebaseVerificationEmail(): Promise<{ success: boolean; error?: string }> {
  const auth = getFirebaseAuth();
  if (!auth || !auth.currentUser) {
    return { success: false, error: "No authenticated user found to verify." };
  }

  try {
    await sendEmailVerification(auth.currentUser);
    return { success: true };
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj.code === "auth/too-many-requests") {
      return { success: false, error: "Please wait a few moments before requesting another email." };
    }
    return { success: false, error: errObj.message || "Failed to resend verification email." };
  }
}

/**
 * Syncs user profile data into Cloud Firestore (`profiles` collection).
 */
export async function syncUserProfileInFirestore(
  uid: string,
  data: {
    name: string;
    email?: string;
    phone?: string;
    role: Role;
    city?: string;
  },
): Promise<{ name: string; email?: string; phone?: string; role: Role; city: string }> {
  const db = getFirebaseDb();
  const safeRole = sanitizeSelfAssignedRole(data.role);
  const profileRecord = {
    id: uid,
    full_name: data.name,
    email: data.email || null,
    phone: data.phone || null,
    role: safeRole,
    city: data.city || "Bengaluru",
    points_month: 0,
    points_lifetime: 0,
    updated_at: serverTimestamp(),
  };

  if (db) {
    try {
      const docRef = doc(db, "profiles", uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const existing = snap.data();
        // Never allow clients to change an existing role (including escalate to admin).
        return {
          name: existing.full_name || data.name,
          email: existing.email || data.email,
          phone: existing.phone || data.phone,
          role: (existing.role as Role) || safeRole,
          city: existing.city || data.city || "Bengaluru",
        };
      }
      await setDoc(docRef, {
        ...profileRecord,
        created_at: serverTimestamp(),
      });
    } catch (err) {
      console.warn("Firestore profile sync error:", err);
    }
  }

  return {
    name: data.name,
    email: data.email,
    phone: data.phone,
    role: safeRole,
    city: data.city || "Bengaluru",
  };
}

/**
 * Fetches user profile from Firestore by UID.
 */
export async function fetchUserProfileFromFirestore(uid: string): Promise<DemoProfile | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    const docRef = doc(db, "profiles", uid);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;

    const data = snap.data();
    return {
      name: data.full_name || "Member",
      email: data.email || "",
      phone: data.phone || undefined,
      role: (data.role as Role) || "donor",
      city: data.city || "Bengaluru",
      pointsMonth: data.points_month || 0,
      pointsLifetime: data.points_lifetime || 0,
      rank: 1,
      personalized: true,
    };
  } catch {
    return null;
  }
}

/**
 * Signs the user out of Firebase.
 */
export async function signOutFirebase(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  try {
    await signOut(auth);
  } catch (err) {
    console.warn("Sign out error:", err);
  }
}
