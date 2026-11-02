import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  __resetFairAccessStore,
  __seedAllocation,
  evaluateEligibility,
  listFairAccessAllocations,
  publicFairAccessView,
  reviewFairAccessApplication,
  submitFairAccessApplication,
} from "../lib/fairaccess/service.ts";

describe("Scrapo FairAccess", () => {
  beforeEach(() => {
    __resetFairAccessStore();
  });

  it("blocks unverified students", async () => {
    const gate = evaluateEligibility({
      role: "student",
      verificationStatus: "pending",
      studentId: "stu-1",
      acceptsResaleRestriction: true,
    });
    assert.equal(gate.eligible, false);

    const res = await submitFairAccessApplication({
      studentId: "stu-1",
      studentName: "Asha",
      role: "student",
      verificationStatus: "pending",
      campus: "Campus",
      course: "BSc",
      category: "laptop",
      educationalNeed: "I need a laptop for lab classes this semester.",
      acceptsResaleRestriction: true,
    });
    assert.equal(res.success, false);
  });

  it("accepts a verified student application and does not auto-reject family members", async () => {
    const first = await submitFairAccessApplication({
      studentId: "stu-a",
      studentName: "Student A",
      role: "student",
      verificationStatus: "verified",
      campus: "Campus",
      course: "BSc CS",
      category: "laptop",
      educationalNeed: "I need a laptop for coursework and online labs this year.",
      householdKey: "family-42",
      acceptsResaleRestriction: true,
    });
    assert.equal(first.success, true);
    assert.equal(first.application?.status, "pending");

    const sibling = await submitFairAccessApplication({
      studentId: "stu-b",
      studentName: "Student B",
      role: "student",
      verificationStatus: "verified",
      campus: "Campus",
      course: "BA English",
      category: "tablet",
      educationalNeed: "I need a tablet for reading assignments and notes this semester.",
      householdKey: "family-42",
      acceptsResaleRestriction: true,
    });
    assert.equal(sibling.success, true);
    assert.notEqual(sibling.application?.status, "rejected");
  });

  it("flags repeated applications for manual review", async () => {
    const first = await submitFairAccessApplication({
      studentId: "stu-repeat",
      studentName: "Repeat Student",
      role: "student",
      verificationStatus: "verified",
      campus: "Campus",
      course: "BCom",
      category: "laptop",
      educationalNeed: "I need a laptop for accounting software labs this term.",
      acceptsResaleRestriction: true,
    });
    assert.equal(first.success, true);

    await reviewFairAccessApplication({
      applicationId: first.application!.id,
      reviewerId: "admin-1",
      reviewerName: "Admin",
      reviewerRole: "admin",
      decision: "rejected",
      reviewNote: "Need more course detail",
    });

    const second = await submitFairAccessApplication({
      studentId: "stu-repeat",
      studentName: "Repeat Student",
      role: "student",
      verificationStatus: "verified",
      campus: "Campus",
      course: "BCom",
      category: "laptop",
      educationalNeed: "I need a laptop for Tally labs and online exams this semester.",
      acceptsResaleRestriction: true,
    });
    assert.equal(second.success, true);
    assert.equal(second.application?.status, "flagged");
    assert.ok(second.application?.reviewFlags.includes("repeat_application"));
  });

  it("approves once and blocks a second allocation inside 12 months", async () => {
    const first = await submitFairAccessApplication({
      studentId: "stu-once",
      studentName: "Once Student",
      role: "student",
      verificationStatus: "verified",
      campus: "Campus",
      course: "BTech",
      category: "laptop",
      educationalNeed: "I need a laptop for engineering CAD coursework this year.",
      acceptsResaleRestriction: true,
    });

    const approved = await reviewFairAccessApplication({
      applicationId: first.application!.id,
      reviewerId: "admin-1",
      reviewerName: "Admin",
      reviewerRole: "admin",
      decision: "approved",
      deviceLabel: "Refurbished Latitude",
    });
    assert.equal(approved.success, true);
    assert.equal(approved.allocation?.resaleRestricted, true);
    assert.equal((await listFairAccessAllocations("stu-once")).length, 1);

    const again = await submitFairAccessApplication({
      studentId: "stu-once",
      studentName: "Once Student",
      role: "student",
      verificationStatus: "verified",
      campus: "Campus",
      course: "BTech",
      category: "laptop",
      educationalNeed: "I need another laptop for the next semester project work.",
      acceptsResaleRestriction: true,
    });
    assert.equal(again.success, true);
    assert.equal(again.application?.status, "flagged");
    assert.ok(again.application?.reviewFlags.includes("repeat_within_12_months"));

    const blocked = await reviewFairAccessApplication({
      applicationId: again.application!.id,
      reviewerId: "admin-1",
      reviewerName: "Admin",
      reviewerRole: "admin",
      decision: "approved",
      deviceLabel: "Second device",
    });
    assert.equal(blocked.success, false);
  });

  it("never exposes household keys in the public projection", () => {
    const view = publicFairAccessView({
      id: "fa-1",
      studentId: "stu-1",
      studentName: "Asha",
      campus: "Campus",
      course: "BSc",
      category: "laptop",
      educationalNeed: "Need laptop",
      householdKey: "secret-home",
      acceptsResaleRestriction: true,
      status: "pending",
      reviewFlags: [],
      submittedAt: new Date().toISOString(),
    });
    assert.equal("householdKey" in view, false);
    assert.equal(view.hasHouseholdKey, true);
  });

  it("keeps household siblings eligible after one sibling allocation", async () => {
    await __seedAllocation({
      id: "alloc-sib",
      applicationId: "fa-old",
      studentId: "stu-sibling-1",
      studentName: "Sibling One",
      category: "laptop",
      deviceLabel: "Laptop A",
      allocatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1000).toISOString(),
      resaleRestricted: true,
    });

    const sibling = await submitFairAccessApplication({
      studentId: "stu-sibling-2",
      studentName: "Sibling Two",
      role: "student",
      verificationStatus: "verified",
      campus: "Campus",
      course: "BSc",
      category: "tablet",
      educationalNeed: "I need a tablet for reading course packs this semester.",
      householdKey: "same-home",
      acceptsResaleRestriction: true,
    });
    assert.equal(sibling.success, true);
  });
});
