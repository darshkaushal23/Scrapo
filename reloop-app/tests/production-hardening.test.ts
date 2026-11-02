/**
 * Production hardening — auth bypass, escalation, persistence, privacy.
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  __resetListingReports,
  canReleaseDevice,
  listListingReports,
  publicListingReportView,
  submitListingReport,
  tryMutateListingReport,
} from "../lib/accountability/reports.ts";
import { accountEmailFromName, sanitizeSelfAssignedRole } from "../lib/auth/identity.ts";
import { resolveServerActor } from "../lib/auth/server-actor.ts";
import {
  __resetFairAccessStore,
  publicFairAccessView,
  submitFairAccessApplication,
} from "../lib/fairaccess/service.ts";
import { trustPut, trustQuery, trustReset } from "../lib/persistence/trust-store.ts";
import {
  __resetVerificationStore,
  reviewVerification,
  submitVerification,
} from "../lib/verify/service.ts";

beforeEach(() => {
  __resetVerificationStore();
  __resetFairAccessStore();
  __resetListingReports();
  trustReset("hardening_probe");
});

describe("Auth bypass attempts", () => {
  it("ignores forged x-scrapo-actor-* headers without a Bearer token", async () => {
    const req = new Request("http://localhost/api/verify", {
      headers: {
        "x-scrapo-actor-id": "us-6",
        "x-scrapo-actor-name": "Leela Thomas",
      },
    });
    const actor = await resolveServerActor(req);
    assert.equal(actor, null);
  });

  it("rejects Bearer tokens when Firebase Admin is not configured / token invalid", async () => {
    const req = new Request("http://localhost/api/verify", {
      headers: { Authorization: "Bearer totally-forged-token" },
    });
    const actor = await resolveServerActor(req);
    assert.equal(actor, null);
  });
});

describe("Role escalation", () => {
  it("maps admin self-assignment attempts to donor", () => {
    assert.equal(sanitizeSelfAssignedRole("admin"), "donor");
  });

  it("blocks non-admin verification approval", async () => {
    const app = await submitVerification({
      userId: "donor-harden-1",
      userName: "Donor Harden",
      role: "donor",
      kind: "donor_ownership",
      ownershipDeclared: true,
      email: accountEmailFromName("Donor Harden"),
    });
    const denied = await reviewVerification({
      applicationId: app.application!.id,
      reviewerId: "donor-harden-1",
      reviewerName: "Donor Harden",
      reviewerRole: "donor",
      decision: "verified",
    });
    assert.equal(denied.success, false);
  });
});

describe("Durable persistence", () => {
  it("survives trustPut + trustQuery round trip via durable store", async () => {
    const id = `probe_${Date.now()}`;
    await trustPut("hardening_probe", id, { id, value: "durable", at: new Date().toISOString() });
    const rows = await trustQuery<{ id: string; value: string }>("hardening_probe", (row) => row.id === id);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.value, "durable");

    const file = join(process.cwd(), ".data", "trust-safety", "hardening_probe.json");
    assert.equal(existsSync(file), true);
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Record<string, { value: string }>;
    assert.equal(parsed[id]?.value, "durable");
  });

  it("persists FairAccess applications outside the process Map", async () => {
    const res = await submitFairAccessApplication({
      studentId: "stu-persist-1",
      studentName: "Persist Student",
      role: "student",
      verificationStatus: "verified",
      campus: "Bengaluru",
      course: "BSc",
      category: "laptop",
      educationalNeed: "Need a laptop for durable persistence verification tests.",
      acceptsResaleRestriction: true,
    });
    assert.equal(res.success, true);
    const file = join(process.cwd(), ".data", "trust-safety", "fairaccess_applications.json");
    assert.equal(existsSync(file), true);
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Record<string, { studentId: string }>;
    assert.ok(Object.values(parsed).some((row) => row.studentId === "stu-persist-1"));
  });
});

describe("Privacy leaks", () => {
  it("strips household keys from public FairAccess views", async () => {
    const res = await submitFairAccessApplication({
      studentId: "stu-priv-1",
      studentName: "Private Student",
      role: "student",
      verificationStatus: "verified",
      campus: "Kochi",
      course: "BTech",
      category: "laptop",
      educationalNeed: "Need a laptop for programming labs without leaking household ids.",
      householdKey: "very-secret-household",
      acceptsResaleRestriction: true,
    });
    const view = publicFairAccessView(res.application!);
    assert.equal("householdKey" in view, false);
    assert.equal(JSON.stringify(view).includes("very-secret-household"), false);
  });

  it("public listing report view omits reporter private details by default", async () => {
    const filed = await submitListingReport({
      listingId: "ls-priv",
      listingTitle: "Suspicious laptop",
      reason: "scam_risk",
      details: "Asked for UPI outside Scrapo checkout flow.",
      reporterId: "buyer-priv",
      reporterName: "Buyer Private",
      reporterRole: "donor",
    });
    const view = publicListingReportView(filed.report!);
    assert.equal("details" in view, false);
    assert.equal("reporterId" in view, false);
    assert.equal((await listListingReports({ reporterId: "buyer-priv" })).length, 1);
  });

  it("blocks silent mutation of accountability reports", () => {
    assert.throws(() => tryMutateListingReport(), /append-only/i);
  });
});

describe("CleanDevice release gate", () => {
  it("prevents release without verified sanitisation", () => {
    assert.equal(
      canReleaseDevice({ sanitisationVerificationStatus: "pending_review", recyclerVerified: true }).allowed,
      false,
    );
    assert.equal(
      canReleaseDevice({ sanitisationVerificationStatus: "verified", recyclerVerified: true }).allowed,
      true,
    );
  });
});

describe("Cross-module privacy & gate hardening", () => {
  it("does not treat client role query params as authoritative for feature gates", async () => {
    // Without a verified Bearer token, resolveServerActor is null — APIs must 401/403.
    const req = new Request("http://localhost/api/verify?feature=recycler_ops&role=admin&status=verified", {
      headers: { "x-scrapo-actor-id": "us-6", "x-scrapo-actor-name": "Leela Thomas" },
    });
    assert.equal(await resolveServerActor(req), null);
  });
});

describe("Unauthorised access patterns", () => {
  it("keeps open reports isolated by reporter id filter", async () => {
    await submitListingReport({
      listingId: "ls-a",
      listingTitle: "A",
      reason: "spam",
      details: "Looks like spam listing content.",
      reporterId: "r1",
      reporterName: "R1",
      reporterRole: "student",
    });
    await submitListingReport({
      listingId: "ls-b",
      listingTitle: "B",
      reason: "spam",
      details: "Looks like another spam listing.",
      reporterId: "r2",
      reporterName: "R2",
      reporterRole: "student",
    });
    const mine = await listListingReports({ reporterId: "r1" });
    assert.equal(mine.length, 1);
    assert.equal(mine[0]!.listingId, "ls-a");
  });
});
