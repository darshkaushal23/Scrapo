/**
 * Scrapo Trust & Safety — multi-role security scenarios (unit/service level).
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  canReleaseDevice,
  submitListingReport,
  resolveListingReport,
  tryMutateListingReport,
  listListingReports,
  __resetListingReports,
} from "../lib/accountability/reports.ts";
import { accountEmailFromName, sanitizeSelfAssignedRole } from "../lib/auth/identity.ts";
import { createSimpleAccount, findAccountByIdOrName } from "../lib/auth/account-service.ts";
import {
  evaluateEligibility,
  reviewFairAccessApplication,
  submitFairAccessApplication,
  __resetFairAccessStore,
  publicFairAccessView,
} from "../lib/fairaccess/service.ts";
import {
  canAccessVerifiedFeature,
  reviewVerification,
  submitVerification,
  __resetVerificationStore,
} from "../lib/verify/service.ts";

beforeEach(() => {
  __resetVerificationStore();
  __resetFairAccessStore();
  __resetListingReports();
});

describe("1. Auth & roles", () => {
  it("rejects self-registration as admin", async () => {
    assert.equal(sanitizeSelfAssignedRole("admin"), "donor");
    const res = await createSimpleAccount({
      name: `Admin Attempt ${Date.now()}`,
      password: "testpass",
      role: "admin",
    });
    assert.equal(res.success, false);
  });

  it("maps display names to Firebase Auth emails", () => {
    assert.equal(accountEmailFromName("Leela Thomas"), "leela-thomas@accounts.scrapo.app");
  });

  it("keeps seeded admin role only on pre-provisioned registry entries", () => {
    const admin = findAccountByIdOrName("us-6", "Leela Thomas");
    assert.ok(admin);
    assert.equal(admin.role, "admin");
  });
});

describe("2–3. Student verification & subsidy limits", () => {
  it("blocks unverified students from FairAccess", () => {
    const gate = evaluateEligibility({
      role: "student",
      verificationStatus: "pending",
      studentId: "stu-sec-1",
      acceptsResaleRestriction: true,
    });
    assert.equal(gate.eligible, false);
  });

  it("flags repeat subsidy within 12 months and blocks second approval", async () => {
    const first = await submitFairAccessApplication({
      studentId: "stu-sec-2",
      studentName: "Sana Qureshi",
      role: "student",
      verificationStatus: "verified",
      campus: "Bengaluru",
      course: "BSc CS",
      category: "laptop",
      educationalNeed: "Need a laptop for coursework and online labs this term.",
      acceptsResaleRestriction: true,
    });
    assert.equal(first.success, true);

    const approve = await reviewFairAccessApplication({
      applicationId: first.application!.id,
      reviewerId: "us-6",
      reviewerName: "Leela Thomas",
      reviewerRole: "admin",
      decision: "approved",
      deviceLabel: "ThinkPad T480",
    });
    assert.equal(approve.success, true);

    const second = await submitFairAccessApplication({
      studentId: "stu-sec-2",
      studentName: "Sana Qureshi",
      role: "student",
      verificationStatus: "verified",
      campus: "Bengaluru",
      course: "BSc CS",
      category: "laptop",
      educationalNeed: "Need another laptop after the first allocation this year.",
      acceptsResaleRestriction: true,
    });
    assert.equal(second.success, true);
    assert.equal(second.application?.status, "flagged");

    const approveAgain = await reviewFairAccessApplication({
      applicationId: second.application!.id,
      reviewerId: "us-6",
      reviewerName: "Leela Thomas",
      reviewerRole: "admin",
      decision: "approved",
    });
    assert.equal(approveAgain.success, false);
  });
});

describe("4. Multiple students same household", () => {
  it("allows a second genuine student with the same household token", async () => {
    const a = await submitFairAccessApplication({
      studentId: "stu-house-a",
      studentName: "Sibling One",
      role: "student",
      verificationStatus: "verified",
      campus: "Bengaluru",
      course: "BA History",
      category: "tablet",
      educationalNeed: "Need a tablet for reading course materials and notes.",
      householdKey: "family-token-9",
      acceptsResaleRestriction: true,
    });
    assert.equal(a.success, true);

    const b = await submitFairAccessApplication({
      studentId: "stu-house-b",
      studentName: "Sibling Two",
      role: "student",
      verificationStatus: "verified",
      campus: "Bengaluru",
      course: "BCom",
      category: "laptop",
      educationalNeed: "Need a laptop for accounting software and online exams.",
      householdKey: "family-token-9",
      acceptsResaleRestriction: true,
    });
    assert.equal(b.success, true);
    assert.ok(b.application?.status === "pending" || b.application?.status === "flagged");
  });

  it("never exposes household keys in public projections", async () => {
    const row = await submitFairAccessApplication({
      studentId: "stu-house-c",
      studentName: "Private Student",
      role: "student",
      verificationStatus: "verified",
      campus: "Kochi",
      course: "BTech",
      category: "laptop",
      educationalNeed: "Need a laptop for programming labs and project work.",
      householdKey: "secret-household",
      acceptsResaleRestriction: true,
    });
    const pub = publicFairAccessView(row.application!);
    assert.equal("householdKey" in pub, false);
    assert.equal(pub.hasHouseholdKey, true);
  });
});

describe("5–6. Ownership declaration & recycler verification", () => {
  it("accepts donor ownership declaration applications", async () => {
    const res = await submitVerification({
      userId: "don-sec-1",
      userName: "Kabir Menon",
      role: "donor",
      kind: "donor_ownership",
      ownershipDeclared: true,
      email: "kabir@example.com",
    });
    assert.equal(res.success, true);
    assert.equal(res.application?.ownershipDeclared, true);
  });

  it("blocks non-admin recycler verification approval", async () => {
    const app = await submitVerification({
      userId: "rec-sec-1",
      userName: "GreenCircuit Collective",
      role: "recycler",
      kind: "recycler",
      orgName: "GreenCircuit Collective",
      license: "DEMO-RC-1842",
    });
    const denied = await reviewVerification({
      applicationId: app.application!.id,
      reviewerId: "rec-sec-1",
      reviewerName: "GreenCircuit Collective",
      reviewerRole: "recycler",
      decision: "verified",
    });
    assert.equal(denied.success, false);

    const allowed = await reviewVerification({
      applicationId: app.application!.id,
      reviewerId: "us-6",
      reviewerName: "Leela Thomas",
      reviewerRole: "admin",
      decision: "verified",
    });
    assert.equal(allowed.success, true);
  });

  it("gates recycler ops until verified", () => {
    const gate = canAccessVerifiedFeature("recycler", "recycler_ops", "pending");
    assert.equal(gate.allowed, false);
  });
});

describe("7–8. Sanitisation release gate", () => {
  it("blocks release when sanitisation is not verified", () => {
    const blocked = canReleaseDevice({
      sanitisationVerificationStatus: "pending_review",
      recyclerVerified: true,
    });
    assert.equal(blocked.allowed, false);
  });

  it("allows release only when sanitisation and recycler are verified", () => {
    const ok = canReleaseDevice({
      sanitisationVerificationStatus: "verified",
      recyclerVerified: true,
    });
    assert.equal(ok.allowed, true);
  });
});

describe("9–11. Buyer privacy & accountability reports", () => {
  it("donors cannot approve FairAccess as themselves", async () => {
    const app = await submitFairAccessApplication({
      studentId: "stu-sec-3",
      studentName: "Arjun Deshpande",
      role: "student",
      verificationStatus: "verified",
      campus: "Bengaluru",
      course: "MSc",
      category: "phone",
      educationalNeed: "Need a phone for campus notifications and field surveys.",
      acceptsResaleRestriction: true,
    });
    const denied = await reviewFairAccessApplication({
      applicationId: app.application!.id,
      reviewerId: "us-ananya",
      reviewerName: "Ananya Iyer",
      reviewerRole: "donor",
      decision: "approved",
    });
    assert.equal(denied.success, false);
  });

  it("lets a buyer file a suspicious listing report", async () => {
    const res = await submitListingReport({
      listingId: "ls-1",
      listingTitle: "Refurbished Pixel",
      reason: "suspicious_listing",
      details: "Price looks fraudulent and photos look stock.",
      reporterId: "buyer-1",
      reporterName: "Buyer One",
      reporterRole: "donor",
    });
    assert.equal(res.success, true);
    assert.equal((await listListingReports({ status: "open" })).length, 1);
  });

  it("blocks silent mutation of listing reports", () => {
    assert.throws(() => tryMutateListingReport(), /append-only/i);
  });

  it("only admins resolve listing reports", async () => {
    const filed = await submitListingReport({
      listingId: "ls-2",
      listingTitle: "Laptop deal",
      reason: "scam_risk",
      details: "Seller asked for payment outside Scrapo.",
      reporterId: "buyer-2",
      reporterName: "Buyer Two",
      reporterRole: "student",
    });
    const denied = await resolveListingReport({
      reportId: filed.report!.id,
      resolverId: "buyer-2",
      resolverName: "Buyer Two",
      resolverRole: "student",
      decision: "resolved",
    });
    assert.equal(denied.success, false);

    const ok = await resolveListingReport({
      reportId: filed.report!.id,
      resolverId: "us-6",
      resolverName: "Leela Thomas",
      resolverRole: "admin",
      decision: "resolved",
      resolutionNote: "Listing removed after review.",
    });
    assert.equal(ok.success, true);
  });
});

describe("12. Admin access permissions", () => {
  it("admin can review student verification", async () => {
    const app = await submitVerification({
      userId: "stu-sec-4",
      userName: "Sana Qureshi",
      role: "student",
      kind: "student",
      institution: "Demo University",
      course: "BSc",
      studentId: "SID-44",
      enrolmentEvidence: "Enrolment letter reference DEMO-44",
    });
    const res = await reviewVerification({
      applicationId: app.application!.id,
      reviewerId: "us-6",
      reviewerName: "Leela Thomas",
      reviewerRole: "admin",
      decision: "verified",
    });
    assert.equal(res.success, true);
    assert.equal(res.application?.status, "verified");
  });
});
