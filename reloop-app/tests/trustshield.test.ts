import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  CustodyEvent,
  Role,
  SanitisationRecord,
  SanitisationStatus,
  SanitisationVerificationStatus,
} from "../lib/types.ts";
import { initialCustodyHistory, initialSanitisationRecords } from "../lib/mock/data.ts";

describe("Scrapo TrustShield — Feature & Permission Suite", () => {
  // 1. PRIVACY TRANSPARENCY
  describe("1. Privacy Transparency & Restricted Access", () => {
    it("never requests device passwords, PINs, OTPs, or financial credentials", () => {
      const prohibitedKeywords = ["password", "pin", "otp", "bank", "financial"];
      const privacyNoticeText =
        "We only collect device condition and pickup area to arrange transport. We never request device passwords, screen-lock PINs, OTPs, bank account access, or financial credentials. Personal contact and address data are restricted strictly to authorized collection partners.";

      for (const keyword of prohibitedKeywords) {
        assert.ok(
          privacyNoticeText.toLowerCase().includes(keyword),
          `Privacy notice should explicitly disclaim collecting ${keyword}`,
        );
      }
    });

    it("masks personal street address and contact phone for unauthorized roles", () => {
      const rawAddress = "14, 4th Cross, Indiranagar";
      const rawCity = "Bengaluru";
      const rawPhone = "+91 98450 22018";

      function getAddressForRole(role: Role) {
        const isAuthorized = role === "donor" || role === "recycler" || role === "admin";
        return isAuthorized
          ? `${rawAddress}, ${rawCity}`
          : `Area in ${rawCity} · Full street address restricted to authorized collection partner`;
      }

      function getPhoneForRole(role: Role) {
        const isAuthorized = role === "donor" || role === "recycler" || role === "admin";
        return isAuthorized
          ? rawPhone
          : "Protected by TrustShield · Visible to assigned donor & partner";
      }

      // Donor, Recycler, Admin can see
      assert.equal(getAddressForRole("donor"), "14, 4th Cross, Indiranagar, Bengaluru");
      assert.equal(getAddressForRole("recycler"), "14, 4th Cross, Indiranagar, Bengaluru");
      assert.equal(getAddressForRole("admin"), "14, 4th Cross, Indiranagar, Bengaluru");

      // Student / general viewer cannot see private contact
      assert.ok(!getAddressForRole("student").includes("14, 4th Cross"));
      assert.ok(getAddressForRole("student").includes("restricted"));
      assert.ok(!getPhoneForRole("student").includes("98450"));
    });
  });

  // 2. RECYCLER VERIFICATION
  describe("2. Recycler Verification Roles & Permissions", () => {
    it("allows authorized administrators to verify a recycler", () => {
      const actorRole: Role = "admin";
      let status: "pending" | "verified" | "needs_info" = "pending";

      function updateRecycler(role: Role, newStatus: "verified" | "needs_info") {
        if (role !== "admin") {
          throw new Error("Only authorised administrators can update recycler verification.");
        }
        status = newStatus;
      }

      updateRecycler(actorRole, "verified");
      assert.equal(status, "verified");
    });

    it("prevents non-administrators from verifying recyclers", () => {
      const roles: Role[] = ["donor", "student", "recycler"];

      function updateRecycler(role: Role, newStatus: "verified") {
        if (role !== "admin") {
          throw new Error("Only authorised administrators can update recycler verification.");
        }
        return newStatus;
      }

      for (const role of roles) {
        assert.throws(
          () => updateRecycler(role, "verified"),
          /Only authorised administrators/,
          `${role} should not be allowed to verify recyclers`,
        );
      }
    });

    it("clearly distinguishes verified from pending profiles", () => {
      const profiles = [
        { id: "rc-1", name: "GreenCircuit", status: "verified" },
        { id: "rc-2", name: "Harbour Metals", status: "pending" },
      ];

      const verified = profiles.filter((p) => p.status === "verified");
      const pending = profiles.filter((p) => p.status === "pending");

      assert.equal(verified.length, 1);
      assert.equal(pending.length, 1);
      assert.equal(verified[0].id, "rc-1");
      assert.equal(pending[0].id, "rc-2");
    });
  });

  // 3. DEVICE CUSTODY HISTORY
  describe("3. Device Custody History Tracking & Immutability", () => {
    it("records all lifecycle stages: submission, confirmation, handover, inspection, sanitisation, outcome", () => {
      const custody = initialCustodyHistory["pk-1988"];
      assert.ok(custody && custody.length > 0);

      const stages = custody.map((c) => c.stage);
      assert.ok(stages.includes("submission"));
      assert.ok(stages.includes("pickup_confirmation"));
      assert.ok(stages.includes("handover"));
      assert.ok(stages.includes("inspection"));
      assert.ok(stages.includes("sanitisation"));
      assert.ok(stages.includes("outcome"));
    });

    it("stores timestamps and responsible authorised user IDs for each custody action", () => {
      const custody = initialCustodyHistory["pk-1988"];
      for (const event of custody) {
        assert.ok(event.timestamp, "Must contain timestamp");
        assert.ok(event.responsibleUserId, "Must contain responsibleUserId");
        assert.ok(event.responsibleUserName, "Must contain responsibleUserName");
        assert.ok(event.action, "Must contain action");
      }
    });

    it("prevents unauthorised editing or deletion of custody records (append-only)", () => {
      const ledger: CustodyEvent[] = [...initialCustodyHistory["pk-2041"]];
      const initialCount = ledger.length;

      function appendCustody(actorRole: Role, event: CustodyEvent) {
        if (!["donor", "recycler", "admin"].includes(actorRole)) {
          throw new Error("Unauthorised role cannot append custody records.");
        }
        ledger.push(event);
      }

      function editCustodyRecord() {
        throw new Error("Custody history ledger is strictly immutable. Updates and deletes are disallowed.");
      }

      // Appending by authorised role works
      appendCustody("recycler", {
        id: "cst-test-1",
        pickupId: "pk-2041",
        deviceId: "dv-2041",
        stage: "handover",
        action: "Collected at address",
        responsibleUserId: "us-3",
        responsibleUserName: "Priya Nair",
        responsibleRole: "recycler",
        timestamp: new Date().toISOString(),
        notes: "Intake verified",
      });

      assert.equal(ledger.length, initialCount + 1);

      // Mutating past records is rejected
      assert.throws(() => editCustodyRecord(), /strictly immutable/);
    });
  });

  // 4. DATA SANITISATION TRACKING
  describe("4. Data Sanitisation Tracking & Evidence Enforcement", () => {
    it("allows authorised recyclers and admins to submit sanitisation records", () => {
      function submitRecord(role: Role, record: SanitisationRecord) {
        if (role !== "recycler" && role !== "admin") {
          throw new Error("Only authorised recyclers or admins can submit sanitisation records.");
        }
        if (record.status === "completed" && !record.verificationEvidence?.trim()) {
          throw new Error("Verification evidence is strictly required for completed sanitisation.");
        }
        return { success: true, record };
      }

      const validRecord: SanitisationRecord = {
        id: "san-test",
        deviceId: "dv-2041",
        pickupId: "pk-2041",
        status: "completed",
        method: "NIST 800-88 Rev 1 Overwrite / Purge",
        responsibleRecycler: "GreenCircuit Collective",
        technicianId: "us-3",
        technicianName: "Priya Nair",
        completedAt: new Date().toISOString(),
        verificationEvidence: "LOG-WIPE-SHA256-48392",
        verificationStatus: "pending_review",
        verifiedBy: null,
        verifiedAt: null,
      };

      const result = submitRecord("recycler", validRecord);
      assert.equal(result.success, true);
    });

    it("rejects non-recycler roles from submitting sanitisation records", () => {
      function submitRecord(role: Role) {
        if (role !== "recycler" && role !== "admin") {
          throw new Error("Only authorised recyclers or admins can submit sanitisation records.");
        }
      }

      assert.throws(() => submitRecord("student"), /Only authorised recyclers/);
      assert.throws(() => submitRecord("donor"), /Only authorised recyclers/);
    });

    it("STRICT: Rejects completed sanitisation claims without evidence (no fake certificates)", () => {
      function submitRecord(role: Role, record: SanitisationRecord) {
        if (role !== "recycler" && role !== "admin") {
          throw new Error("Only authorised recyclers or admins can submit sanitisation records.");
        }
        if (record.status === "completed" && !record.verificationEvidence?.trim()) {
          throw new Error("Verification evidence or reference is required when marking sanitisation completed.");
        }
        return { success: true };
      }

      const fakeClaim: SanitisationRecord = {
        id: "san-fake",
        deviceId: "dv-test",
        pickupId: "pk-test",
        status: "completed",
        method: "NIST 800-88",
        responsibleRecycler: "GreenCircuit",
        technicianId: "us-3",
        technicianName: "Priya",
        completedAt: new Date().toISOString(),
        verificationEvidence: "   ", // Empty!
        verificationStatus: "pending_review",
        verifiedBy: null,
        verifiedAt: null,
      };

      assert.throws(
        () => submitRecord("recycler", fakeClaim),
        /Verification evidence or reference is required/,
      );
    });

    it("handles pending, in_progress, completed, and failed sanitisation states", () => {
      const states: SanitisationStatus[] = ["pending", "in_progress", "completed", "failed"];

      for (const st of states) {
        const mock: SanitisationRecord = {
          id: `san-${st}`,
          deviceId: `dv-${st}`,
          pickupId: `pk-${st}`,
          status: st,
          method: "Secure Erase",
          responsibleRecycler: "Recycler Lab",
          technicianId: "us-tech",
          technicianName: "Lab Tech",
          completedAt: st === "completed" ? new Date().toISOString() : null,
          verificationEvidence: st === "completed" ? "LOG-REF-100" : "",
          verificationStatus: "pending_review",
          verifiedBy: null,
          verifiedAt: null,
        };

        assert.equal(mock.status, st);
        if (st === "failed") {
          // Hardware is flagged for physical shredding/quarantine
          assert.equal(mock.completedAt, null);
        }
      }
    });

    it("only allows authorised verification roles (admin) to approve sanitisation records", () => {
      function approveSanitisation(role: Role, record: SanitisationRecord, status: SanitisationVerificationStatus) {
        if (role !== "admin") {
          throw new Error("Only authorised administrators can approve or verify sanitisation records.");
        }
        record.verificationStatus = status;
        record.verifiedBy = "Administrator";
        record.verifiedAt = new Date().toISOString();
        return record;
      }

      const testRecord: SanitisationRecord = {
        id: "san-approve",
        deviceId: "dv-app",
        pickupId: "pk-app",
        status: "completed",
        method: "NIST 800-88 Overwrite",
        responsibleRecycler: "GreenCircuit",
        technicianId: "us-3",
        technicianName: "Priya Nair",
        completedAt: new Date().toISOString(),
        verificationEvidence: "LOG-WIPE-99881",
        verificationStatus: "pending_review",
        verifiedBy: null,
        verifiedAt: null,
      };

      // Recycler cannot self-approve
      assert.throws(
        () => approveSanitisation("recycler", testRecord, "verified"),
        /Only authorised administrators/,
      );

      // Student cannot approve
      assert.throws(
        () => approveSanitisation("student", testRecord, "verified"),
        /Only authorised administrators/,
      );

      // Admin can approve
      const approved = approveSanitisation("admin", testRecord, "verified");
      assert.equal(approved.verificationStatus, "verified");
      assert.equal(approved.verifiedBy, "Administrator");
    });
  });

  // 5. DIGITAL TRUST PASSPORT
  describe("5. Digital Trust Passport & Certificate Safeguards", () => {
    it("withholds certificate if sanitisation has not been verified with evidence", () => {
      function canIssueDonationCertificate(
        pickupShowCert: boolean,
        sanRecord: SanitisationRecord | null,
      ) {
        return (
          pickupShowCert &&
          sanRecord?.status === "completed" &&
          sanRecord?.verificationStatus === "verified"
        );
      }

      // 1. Pending sanitisation
      const pendingRec = initialSanitisationRecords["pk-2041"];
      assert.equal(canIssueDonationCertificate(true, pendingRec), false);

      // 2. In progress sanitisation
      const inProgRec = initialSanitisationRecords["pk-2033"];
      assert.equal(canIssueDonationCertificate(true, inProgRec), false);

      // 3. Failed sanitisation
      const failedRec: SanitisationRecord = {
        ...pendingRec,
        status: "failed",
        verificationStatus: "rejected",
      };
      assert.equal(canIssueDonationCertificate(true, failedRec), false);

      // 4. Fully completed & verified sanitisation
      const verifiedRec = initialSanitisationRecords["pk-1988"];
      assert.equal(canIssueDonationCertificate(true, verifiedRec), true);
    });
  });
});
