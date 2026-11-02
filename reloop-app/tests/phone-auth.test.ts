import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePhoneNumber,
  formatPhoneDisplay,
  isValidPhoneNumber,
  createOriginBoundSms,
  requestPhoneOtp,
  verifyPhoneOtp,
  findUserByPhone,
  saveUserProfile,
} from "../lib/auth/phone-service.ts";
import { homeForRole } from "../lib/prototype/model.ts";

describe("Scrapo Phone Verification & Login System", () => {
  describe("1. Phone Number Normalization & Formatting", () => {
    it("normalizes a 10-digit mobile number to international format with +91", () => {
      assert.equal(normalizePhoneNumber("9876543210"), "+919876543210");
      assert.equal(normalizePhoneNumber("98765 43210"), "+919876543210");
      assert.equal(normalizePhoneNumber("+91 98765 01001"), "+919876501001");
    });

    it("formats phone number for clean user-facing display", () => {
      const display = formatPhoneDisplay("+919876543210");
      assert.equal(display, "+91 98765 43210");
    });

    it("validates mobile phone number format", () => {
      assert.equal(isValidPhoneNumber("9876543210"), true);
      assert.equal(isValidPhoneNumber("+91 98765 01001"), true);
      assert.equal(isValidPhoneNumber("123"), false); // Too short
      assert.equal(isValidPhoneNumber("invalid-phone"), false);
    });
  });

  describe("2. Origin-Bound SMS Message & WebOTP Compliance", () => {
    it("creates origin-bound SMS adhering to W3C WebOTP / domain-bound specification", () => {
      const sms = createOriginBoundSms("849201", "scrapo.app");
      assert.ok(sms.includes("Your Scrapo verification code is 849201."));
      assert.ok(sms.includes("@scrapo.app #849201"));
    });

    it("generates real 6-digit numeric OTP code dynamically", () => {
      const res = requestPhoneOtp("+91 99999 88888");
      assert.equal(res.success, true);
      assert.match(res.code, /^\d{6}$/);
      assert.ok(res.originBoundSms.includes(res.code));
    });

    it("enforces resend cooldown between SMS requests", () => {
      const phone = "+91 98765 99999";
      const first = requestPhoneOtp(phone, "111111");
      assert.equal(first.success, true);

      // Immediate second request within 30s cooldown should be rejected
      const second = requestPhoneOtp(phone, "222222");
      assert.equal(second.success, false);
      assert.ok(second.cooldownRemaining && second.cooldownRemaining > 0);
    });
  });

  describe("3. OTP Verification & Lifecycle", () => {
    it("successfully verifies valid 6-digit OTP", () => {
      const phone = "+91 91234 56789";
      requestPhoneOtp(phone, "987123");
      const check = verifyPhoneOtp(phone, "987123");
      assert.equal(check.valid, true);
    });

    it("rejects incorrect OTP code", () => {
      const phone = "+91 91234 56780";
      requestPhoneOtp(phone, "456789");
      const check = verifyPhoneOtp(phone, "000000");
      assert.equal(check.valid, false);
      assert.ok(check.error?.includes("Invalid 6-digit"));
    });

    it("consumes OTP after successful verification (cannot be reused)", () => {
      const phone = "+91 91234 56781";
      requestPhoneOtp(phone, "333444");
      const first = verifyPhoneOtp(phone, "333444");
      assert.equal(first.valid, true);

      // Re-verifying consumed code should fail
      const second = verifyPhoneOtp(phone, "333444");
      assert.equal(second.valid, false);
    });
  });

  describe("4. Role Routing & Real User Profiles by Phone", () => {
    it("looks up existing users by their phone number", async () => {
      const donor = await findUserByPhone("+91 98765 01001");
      assert.ok(donor);
      assert.equal(donor.name, "Ananya Iyer");
      assert.equal(donor.role, "donor");

      const recycler = await findUserByPhone("+91 98765 01003");
      assert.ok(recycler);
      assert.equal(recycler.name, "Priya Nair");
      assert.equal(recycler.role, "recycler");
    });

    it("persists and retrieves a newly registered real profile dynamically", async () => {
      const testPhone = "+91 98111 22233";
      await saveUserProfile({
        name: "Vikram Malhotra",
        phone: testPhone,
        role: "donor",
        city: "Hyderabad",
      });

      const retrieved = await findUserByPhone(testPhone);
      assert.ok(retrieved);
      assert.equal(retrieved.name, "Vikram Malhotra");
      assert.equal(retrieved.role, "donor");
      assert.equal(retrieved.city, "Hyderabad");
    });

    it("routes users to appropriate dashboards following phone verification", () => {
      assert.equal(homeForRole("donor"), "/dashboard");
      assert.equal(homeForRole("student"), "/marketplace");
      assert.equal(homeForRole("recycler"), "/recycler");
      assert.equal(homeForRole("admin"), "/admin");
    });
  });
});
