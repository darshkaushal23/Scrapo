"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, TextInput, TextArea } from "@/components/ui/field";
import { PageSkeleton, Pill } from "@/components/ui/feedback";
import { scrapoAuthHeaders } from "@/lib/auth/auth-headers";
import { usePrototype } from "@/lib/prototype/session";
import { requiredKindForRole } from "@/lib/verify/gates";
import type { VerificationApplication, VerificationStatus } from "@/lib/types";

function statusTone(status: VerificationStatus) {
  if (status === "verified") return "lime" as const;
  if (status === "rejected") return "danger" as const;
  if (status === "expired") return "paper" as const;
  return "paper" as const;
}

export function VerifyView() {
  const { ready, profile, signIn } = usePrototype();
  const kind = requiredKindForRole(profile.role);
  const userId = profile.id || profile.name.trim().toLowerCase();
  const [application, setApplication] = useState<VerificationApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState(profile.email || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [institution, setInstitution] = useState("");
  const [course, setCourse] = useState("");
  const [studentId, setStudentId] = useState("");
  const [enrolmentEvidence, setEnrolmentEvidence] = useState("");
  const [orgName, setOrgName] = useState(profile.name);
  const [license, setLicense] = useState("");
  const [ownershipDeclared, setOwnershipDeclared] = useState(false);

  useEffect(() => {
    if (!ready || !userId) return;
    let cancelled = false;
    void (async () => {
      const headers = await scrapoAuthHeaders();
      return fetch(`/api/verify?userId=${encodeURIComponent(userId)}&role=${profile.role}&kind=${kind}`, {
        headers,
      });
    })()
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        setApplication(body.application ?? null);
        if (body.application?.status && body.application.status !== profile.verificationStatus) {
          signIn({
            id: profile.id || userId,
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
            role: profile.role,
            city: profile.city,
            verificationStatus: body.application.status,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setApplication(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Load once per account/role. signIn updates verificationStatus without re-fetch loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, userId, kind, profile.role]);

  async function submit() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: await scrapoAuthHeaders(),
        body: JSON.stringify({
          userId,
          userName: profile.name,
          role: profile.role,
          kind,
          email,
          phone,
          institution,
          course,
          studentId,
          enrolmentEvidence,
          orgName,
          license,
          ownershipDeclared,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setError(body.error || "Could not submit verification.");
        setSaving(false);
        return;
      }
      setApplication(body.application);
      signIn({
        id: profile.id || userId,
        name: profile.name,
        email: email || profile.email,
        phone: phone || profile.phone,
        role: profile.role,
        city: profile.city,
        verificationStatus: "pending",
      });
    } catch {
      setError("Could not submit verification.");
    }
    setSaving(false);
  }

  if (!ready || loading) return <PageSkeleton cards={2} />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm font-semibold text-olive">Scrapo Verify</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Confirm who you are</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          We collect only what is needed for donors, students, and recyclers. Identity documents stay private and are never shown on public pages. Do not submit Aadhaar numbers.
        </p>
      </div>

      {application ? (
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={statusTone(application.status)}>{application.status}</Pill>
            <span className="text-xs text-muted">{application.kind.replace("_", " ")}</span>
          </div>
          <p className="mt-3 text-sm text-muted">Submitted {new Date(application.submittedAt).toLocaleString()}</p>
          {application.reviewedAt ? (
            <p className="mt-1 text-sm text-muted">
              Reviewed {new Date(application.reviewedAt).toLocaleString()}
              {application.reviewerName ? ` by ${application.reviewerName}` : ""}
            </p>
          ) : null}
          {application.reviewNote ? <p className="mt-3 text-sm text-ink">{application.reviewNote}</p> : null}
          {application.expiresAt && application.status === "verified" ? (
            <p className="mt-2 text-xs text-muted">Expires {new Date(application.expiresAt).toLocaleDateString()}</p>
          ) : null}
        </Card>
      ) : null}

      {(!application || application.status === "rejected" || application.status === "expired") && profile.role !== "admin" ? (
        <Card className="space-y-4">
          <h2 className="text-xl font-medium">
            {kind === "student"
              ? "Student / buyer verification"
              : kind === "recycler"
                ? "Recycler partner verification"
                : "Donor ownership declaration"}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact email" htmlFor="vf-email">
              <TextInput id="vf-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" />
            </Field>
            <Field label="Contact phone" htmlFor="vf-phone">
              <TextInput id="vf-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />
            </Field>
          </div>

          {kind === "student" ? (
            <>
              <Field label="Institution" htmlFor="vf-institution">
                <TextInput id="vf-institution" value={institution} onChange={(e) => setInstitution(e.target.value)} />
              </Field>
              <Field label="Course" htmlFor="vf-course">
                <TextInput id="vf-course" value={course} onChange={(e) => setCourse(e.target.value)} />
              </Field>
              <Field label="Student ID" htmlFor="vf-student-id">
                <TextInput id="vf-student-id" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
              </Field>
              <Field label="Enrolment evidence note" htmlFor="vf-evidence">
                <TextArea
                  id="vf-evidence"
                  value={enrolmentEvidence}
                  onChange={(e) => setEnrolmentEvidence(e.target.value)}
                  placeholder="Describe campus ID card or enrolment letter. Do not paste Aadhaar."
                />
              </Field>
            </>
          ) : null}

          {kind === "recycler" ? (
            <>
              <Field label="Organisation name" htmlFor="vf-org">
                <TextInput id="vf-org" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </Field>
              <Field label="Licence / PCB authorisation" htmlFor="vf-license">
                <TextInput id="vf-license" value={license} onChange={(e) => setLicense(e.target.value)} />
              </Field>
            </>
          ) : null}

          {kind === "donor_ownership" ? (
            <label className="flex items-start gap-3 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-1"
                checked={ownershipDeclared}
                onChange={(e) => setOwnershipDeclared(e.target.checked)}
              />
              <span>
                I declare that devices I list are lawfully in my possession, and I am authorised to hand them over for
                collection, sanitisation, and donation.
              </span>
            </label>
          ) : null}

          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button variant="olive" disabled={saving} onClick={submit}>
            {saving ? "Submitting" : "Submit for review"}
          </Button>
        </Card>
      ) : null}

      {profile.role === "admin" ? (
        <Card>
          <p className="text-sm text-muted">Administrators review applications from the Admin desk → Scrapo Verify queue.</p>
        </Card>
      ) : null}
    </div>
  );
}
