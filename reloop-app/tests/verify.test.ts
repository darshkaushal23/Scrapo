import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  __resetVerificationStore,
  canAccessVerifiedFeature,
  requiredKindForRole,
  reviewVerification,
  submitVerification,
} from "../lib/verify/service.ts";

describe("Scrapo Verify", () => {
  beforeEach(() => {
    __resetVerificationStore();
  });

  it("maps roles to verification kinds", () => {
    assert.equal(requiredKindForRole("donor"), "donor_ownership");
    assert.equal(requiredKindForRole("student"), "student");
    assert.equal(requiredKindForRole("recycler"), "recycler");
  });

  it("blocks unverified donors from listing devices", () => {
    const gate = canAccessVerifiedFeature("donor", "list_device", undefined);
    assert.equal(gate.allowed, false);
  });

  it("blocks unverified students from assistance requests", () => {
    const gate = canAccessVerifiedFeature("student", "student_request", "pending");
    assert.equal(gate.allowed, false);
  });

  it("blocks unverified recyclers from ops", () => {
    const gate = canAccessVerifiedFeature("recycler", "recycler_ops", "rejected");
    assert.equal(gate.allowed, false);
  });

  it("allows verified users and admins", () => {
    assert.equal(canAccessVerifiedFeature("donor", "list_device", "verified").allowed, true);
    assert.equal(canAccessVerifiedFeature("admin", "recycler_ops", undefined).allowed, true);
  });

  it("rejects Aadhaar-like student submissions", async () => {
    const res = await submitVerification({
      userId: "stu-1",
      userName: "Student One",
      role: "student",
      kind: "student",
      institution: "Campus",
      course: "BSc",
      studentId: "123456789012",
    });
    assert.equal(res.success, false);
  });

  it("submits donor ownership and requires admin to verify", async () => {
    const submitted = await submitVerification({
      userId: "don-1",
      userName: "Donor One",
      role: "donor",
      kind: "donor_ownership",
      ownershipDeclared: true,
      email: "donor@example.com",
    });
    assert.equal(submitted.success, true);
    assert.equal(submitted.application?.status, "pending");

    const selfApprove = await reviewVerification({
      applicationId: submitted.application!.id,
      reviewerId: "don-1",
      reviewerName: "Donor One",
      reviewerRole: "donor",
      decision: "verified",
    });
    assert.equal(selfApprove.success, false);

    const adminApprove = await reviewVerification({
      applicationId: submitted.application!.id,
      reviewerId: "admin-1",
      reviewerName: "Admin",
      reviewerRole: "admin",
      decision: "verified",
    });
    assert.equal(adminApprove.success, true);
    assert.equal(adminApprove.application?.status, "verified");
    assert.ok(adminApprove.application?.reviewedAt);
    assert.ok(adminApprove.application?.expiresAt);
  });

  it("requires a rejection reason", async () => {
    const submitted = await submitVerification({
      userId: "rec-1",
      userName: "Recycler One",
      role: "recycler",
      kind: "recycler",
      orgName: "GreenCircuit",
      license: "PCB-1",
    });
    const rejected = await reviewVerification({
      applicationId: submitted.application!.id,
      reviewerId: "admin-1",
      reviewerName: "Admin",
      reviewerRole: "admin",
      decision: "rejected",
    });
    assert.equal(rejected.success, false);
  });
});
