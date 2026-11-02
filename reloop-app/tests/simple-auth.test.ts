/**
 * Firebase Auth identity helpers — name maps to Auth email; admin cannot self-assign.
 * Full Firebase network login is covered in manual steps (requires live Auth).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { accountEmailFromName, isSelfAssignableRole, sanitizeSelfAssignedRole } from "../lib/auth/identity.ts";
import { createSimpleAccount } from "../lib/auth/account-service.ts";
import { homeForRole } from "../lib/prototype/model.ts";

describe("Scrapo Firebase Auth identity mapping", () => {
  describe("1. Account name → Auth email", () => {
    it("derives a stable Auth email from display name", () => {
      assert.equal(accountEmailFromName("Ananya Iyer"), "ananya-iyer@accounts.scrapo.app");
      assert.equal(accountEmailFromName("GreenCircuit Collective"), "greencircuit-collective@accounts.scrapo.app");
    });

    it("rejects empty names", () => {
      assert.throws(() => accountEmailFromName("   "), /required/i);
    });
  });

  describe("2. Role sanitisation", () => {
    it("blocks self-assigned admin", () => {
      assert.equal(sanitizeSelfAssignedRole("admin"), "donor");
      assert.equal(isSelfAssignableRole("admin"), false);
    });

    it("allows donor, student, recycler", () => {
      assert.equal(sanitizeSelfAssignedRole("student"), "student");
      assert.equal(sanitizeSelfAssignedRole("recycler"), "recycler");
      assert.equal(sanitizeSelfAssignedRole("donor"), "donor");
    });
  });

  describe("3. Legacy registry cannot mint admins", () => {
    it("rejects admin self-registration on legacy helper", async () => {
      const res = await createSimpleAccount({
        name: `Legacy Admin Block ${Date.now()}`,
        password: "password123",
        role: "admin",
      });
      assert.equal(res.success, false);
    });
  });

  describe("4. Role dashboard routing", () => {
    it("routes users to the correct desk", () => {
      assert.equal(homeForRole("donor"), "/dashboard");
      assert.equal(homeForRole("student"), "/marketplace");
      assert.equal(homeForRole("recycler"), "/recycler");
      assert.equal(homeForRole("admin"), "/admin");
    });
  });
});
