"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DescriptionBox } from "@/components/ui/description-box";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { EmptyState, ErrorState, PageSkeleton, Pill } from "@/components/ui/feedback";
import { scrapoAuthHeaders } from "@/lib/auth/auth-headers";
import { categoryLabel, formatInr } from "@/lib/format";
import { usePrototype } from "@/lib/prototype/session";
import { createClient } from "@/lib/supabase/client";
import { loadListings } from "@/lib/supabase/records";
import { useLive } from "@/lib/supabase/use-live";
import type { Category, Condition, FairAccessAllocation } from "@/lib/types";

type MatchFit = "suitable" | "repair" | "unsuitable";
type MatchCard = {
  id: string;
  title: string;
  category: Category;
  condition: Condition;
  campus: string;
  fit: MatchFit;
  explanation: string;
};

type FairAccessRow = {
  id: string;
  studentName: string;
  campus: string;
  course: string;
  category: Category;
  educationalNeed: string;
  status: string;
  reviewFlags: string[];
  submittedAt: string;
  reviewedAt?: string;
  reviewerName?: string;
  reviewNote?: string;
};

const deviceWords: Category[] = ["phone", "laptop", "tablet", "monitor", "appliance", "accessory"];

export function MarketplaceView() {
  const { ready, profile } = usePrototype();
  const live = useLive("marketplace", async () => {
    const supabase = createClient();
    const listings = await loadListings(supabase);
    return { listings };
  });
  const [query, setQuery] = useState("");
  const [purchaseNote, setPurchaseNote] = useState("");
  const [course, setCourse] = useState("");
  const [category, setCategory] = useState<Category>("laptop");
  const [need, setNeed] = useState("");
  const [preference, setPreference] = useState("");
  const [householdKey, setHouseholdKey] = useState("");
  const [acceptResale, setAcceptResale] = useState(false);
  const [assistError, setAssistError] = useState("");
  const [assistMessage, setAssistMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matchNote, setMatchNote] = useState("");
  const [matches, setMatches] = useState<MatchCard[] | null>(null);
  const [myApps, setMyApps] = useState<FairAccessRow[]>([]);
  const [myAllocations, setMyAllocations] = useState<FairAccessAllocation[]>([]);
  const [resaleCopy, setResaleCopy] = useState("");
  const [reportNote, setReportNote] = useState("");
  const listings = live.data?.listings;
  const studentId = profile.id || profile.name.trim().toLowerCase();
  

  const pricedDevices = useMemo(() => {
    const rows = (listings ?? []).filter((item) => item.donation === "available" && item.studentPrice !== null);
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((item) => `${item.title} ${item.campus} ${item.category}`.toLowerCase().includes(needle));
  }, [listings, query]);

  const donationPool = useMemo(() => {
    return (listings ?? []).filter((item) => item.donation === "available" && item.studentPrice === null);
  }, [listings]);

  async function loadMine() {
    if (!studentId) return;
    fetch(`/api/fairaccess?studentId=${encodeURIComponent(studentId)}`, { headers: await scrapoAuthHeaders() })
      .then(async (res) => {
        const body = await res.json();
        setMyApps(body.applications ?? []);
        setMyAllocations(body.allocations ?? []);
        if (body.resaleRestriction) setResaleCopy(body.resaleRestriction);
      })
      .catch(() => {});
  }

  useEffect(() => {
    if (!ready) return;
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, studentId]);

  if (!ready || live.phase === "loading") return <PageSkeleton />;
  if (live.phase === "error") return <ErrorState title="The marketplace did not load" text={live.message} onRetry={live.retry} />;

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <div>
        <p className="text-sm font-semibold text-olive">Scrapo FairAccess</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Buy refurbished, or apply for student support</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Two separate paths: a public refurbished marketplace for paid purchases, and a Student Assistance Programme for verified students only.
          {profile.personalized ? ` Signed in as ${profile.name}.` : " Sign in to buy or apply."}
        </p>
      </div>

      {/* 1. PUBLIC REFURBISHED MARKETPLACE */}
      <section id="public-marketplace" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-medium">Public refurbished marketplace</h2>
            <p className="text-sm text-muted">Normal buyers purchase at the listed price. Standard account rules apply.</p>
          </div>
          <label className="block w-full sm:max-w-xs">
            <span className="sr-only">Search devices</span>
            <TextInput value={query} placeholder="Search title, campus, or category" onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>
        {pricedDevices.length === 0 ? (
          <EmptyState
            title="No priced refurbished devices"
            text="Paid stock will appear here when listings include a student price."
            action={<Button variant="ghost" onClick={() => setQuery("")}>Clear search</Button>}
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {pricedDevices.map((item) => (
              <li key={item.id}>
                <Card className="h-full">
                  <div className="flex items-center justify-between gap-2">
                    <Pill tone="lime">For sale</Pill>
                    <span className="text-xs font-semibold text-muted">{categoryLabel[item.category]}</span>
                  </div>
                  <h3 className="mt-4 text-2xl font-medium">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{item.note}</p>
                  <p className="mt-4 font-display text-2xl text-olive">{formatInr(item.studentPrice!)}</p>
                  <p className="mt-1 text-xs text-muted">{item.campus}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="olive"
                      onClick={() => {
                        if (!profile.personalized) {
                          setPurchaseNote("Sign in before purchasing a refurbished device.");
                          return;
                        }
                        setPurchaseNote(`Purchase interest recorded for ${item.title} at ${formatInr(item.studentPrice!)}. Previous-owner contact details are never shown to buyers.`);
                      }}
                    >
                      Buy at listed price
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!profile.personalized) {
                          setReportNote("Sign in before reporting a listing.");
                          return;
                        }
                        try {
                          const res = await fetch("/api/accountability/reports", {
                            method: "POST",
                            headers: await scrapoAuthHeaders(),
                            body: JSON.stringify({
                              listingId: item.id,
                              listingTitle: item.title,
                              reason: "suspicious_listing",
                              details: `Buyer flagged ${item.title} on the public marketplace for review.`,
                            }),
                          });
                          const body = await res.json();
                          if (!res.ok || !body.success) throw new Error(body.error || "Report failed.");
                          setReportNote(`Report submitted for ${item.title}. Admins will review via Accountability.`);
                        } catch (error: unknown) {
                          setReportNote(error instanceof Error ? error.message : "Report failed.");
                        }
                      }}
                    >
                      Report listing
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {purchaseNote ? <p className="text-sm font-semibold text-olive">{purchaseNote}</p> : null}
        {reportNote ? <p className="text-sm font-semibold text-olive">{reportNote}</p> : null}
      </section>

      {/* 2. STUDENT ASSISTANCE PROGRAMME */}
      <section id="student-assistance" className="space-y-4">
        <div>
          <h2 className="text-xl font-medium">Student Assistance Programme</h2>
          <p className="text-sm text-muted">
            Only verified students may apply for donated or subsidised devices. Limit: one subsidised allocation per student within 12 months.
            Repeated applications are flagged for manual review. Multiple genuine students from the same household remain eligible.
          </p>
          {resaleCopy ? <p className="mt-2 rounded-2xl border border-line bg-paper px-4 py-3 text-xs leading-5 text-muted">{resaleCopy}</p> : null}
        </div>

        {donationPool.length > 0 ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {donationPool.map((item) => (
              <li key={item.id}>
                <Card>
                  <Pill tone="olive">Donation pool</Pill>
                  <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted">{categoryLabel[item.category]} · {item.campus}</p>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="space-y-4">
            <h3 className="text-lg font-medium">Apply for support</h3>
            {profile.role !== "student" && profile.role !== "admin" ? (
              <p className="text-sm text-muted">Switch to a verified student account to apply.</p>
            ) : profile.verificationStatus !== "verified" && profile.role === "student" ? (
              <p className="text-sm text-muted">
                Complete <a className="font-semibold text-olive" href="/verify">Scrapo Verify</a> before applying.
              </p>
            ) : (
              <>
                <Field label="Course / programme" htmlFor="fa-course">
                  <TextInput id="fa-course" value={course} onChange={(e) => setCourse(e.target.value)} placeholder="e.g. BSc Computer Science, Year 2" />
                </Field>
                <Field label="Device category" htmlFor="fa-category">
                  <SelectInput id="fa-category" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                    {deviceWords.map((word) => (
                      <option key={word} value={word}>{categoryLabel[word]}</option>
                    ))}
                  </SelectInput>
                </Field>
                <DescriptionBox
                  id="fa-need"
                  label="Educational requirement"
                  hint="Explain the coursework or project need. Do not submit identity documents here."
                  placeholder="I need a laptop for lab coursework and online classes this semester."
                  value={need}
                  error={assistError}
                  onChange={(value) => {
                    setNeed(value);
                    setAssistError("");
                    setAssistMessage("");
                  }}
                  onFill={() => {
                    setNeed("I need a working laptop for lab coursework and video classes this semester. A refurbished donated device is fine.");
                    setAssistError("");
                  }}
                />
                <Field label="Preferred device note (optional)" htmlFor="fa-pref">
                  <TextInput id="fa-pref" value={preference} onChange={(e) => setPreference(e.target.value)} placeholder="e.g. 8GB RAM if available" />
                </Field>
                <Field label="Private household token (optional)" htmlFor="fa-house">
                  <TextInput
                    id="fa-house"
                    value={householdKey}
                    onChange={(e) => setHouseholdKey(e.target.value)}
                    placeholder="Admin-only code if another sibling also applies"
                  />
                </Field>
                <p className="text-xs text-muted">Household tokens stay private and are never shown on public boards. Family members are not auto-rejected.</p>
                <label className="flex items-start gap-3 text-sm text-ink">
                  <input type="checkbox" className="mt-1" checked={acceptResale} onChange={(e) => setAcceptResale(e.target.checked)} />
                  <span>I accept the disclosed 12-month resale restriction on subsidised devices.</span>
                </label>
                {assistMessage ? <p className="text-sm font-semibold text-olive">{assistMessage}</p> : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="olive"
                    disabled={saving}
                    onClick={async () => {
                      setSaving(true);
                      setAssistError("");
                      setAssistMessage("");
                      try {
                        const res = await fetch("/api/fairaccess", {
                          method: "POST",
                          headers: await scrapoAuthHeaders(),
                          body: JSON.stringify({
                            studentId,
                            studentName: profile.name,
                            role: profile.role,
                            verificationStatus: profile.verificationStatus,
                            campus: profile.city,
                            course,
                            category,
                            educationalNeed: need,
                            devicePreference: preference,
                            householdKey,
                            acceptsResaleRestriction: acceptResale,
                          }),
                        });
                        const body = await res.json();
                        if (!res.ok || !body.success) throw new Error(body.error || "Application failed.");
                        setAssistMessage(
                          body.application?.status === "flagged"
                            ? "Application submitted and flagged for manual review because of a prior request or recent allocation."
                            : "Application submitted for review.",
                        );
                        await loadMine();
                      } catch (error: unknown) {
                        setAssistError(error instanceof Error ? error.message : "Application failed.");
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    {saving ? "Submitting" : "Submit assistance application"}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={matching}
                    onClick={() => {
                      const note = need.trim() || `I need a ${category} for classes.`;
                      setMatching(true);
                      fetch("/api/match", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ need: note }),
                      })
                        .then(async (response) => {
                          const body = (await response.json()) as { error?: string; message?: string; ai?: string; matches?: MatchCard[] };
                          if (!response.ok) throw new Error(body.error || "The match could not be loaded.");
                          setMatches(body.matches ?? []);
                          setMatchNote(body.ai === "unavailable" ? "Match used listing condition and category only." : body.message || "");
                        })
                        .catch((error: unknown) => {
                          setMatches(null);
                          setAssistError(error instanceof Error ? error.message : "The match could not be loaded.");
                        })
                        .finally(() => setMatching(false));
                    }}
                  >
                    {matching ? "Matching" : "Find a match"}
                  </Button>
                </div>
                {matchNote ? <p className="text-sm text-muted">{matchNote}</p> : null}
                {matches && matches.length > 0 ? (
                  <ul className="space-y-3">
                    {matches.map((item) => (
                      <li key={item.id}>
                        <Pill tone={item.fit === "suitable" ? "lime" : item.fit === "repair" ? "paper" : "danger"}>
                          {item.fit === "suitable" ? "Suitable" : item.fit === "repair" ? "Repair candidate" : "Unsuitable"}
                        </Pill>
                        <p className="mt-2 text-sm font-semibold text-ink">{item.title}</p>
                        <p className="mt-1 text-sm text-muted">{item.explanation}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </Card>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Your applications</h3>
              {myApps.length === 0 ? (
                <EmptyState title="No FairAccess applications yet" text="Verified students can apply from this page." />
              ) : (
                <ul className="mt-3 space-y-3">
                  {myApps.map((row) => (
                    <li key={row.id}>
                      <Card>
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill tone={row.status === "approved" ? "lime" : row.status === "rejected" ? "danger" : "paper"}>{row.status}</Pill>
                          <span className="text-xs text-muted">{categoryLabel[row.category]}</span>
                          {row.reviewFlags?.length ? <Pill tone="paper">flagged for review</Pill> : null}
                        </div>
                        <p className="mt-2 text-sm font-semibold">{row.course}</p>
                        <p className="mt-1 text-sm text-muted">{row.educationalNeed}</p>
                        {row.reviewNote ? <p className="mt-2 text-xs text-muted">Reviewer: {row.reviewNote}</p> : null}
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-lg font-medium">Previous allocations</h3>
              {myAllocations.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No subsidised allocations on this account.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {myAllocations.map((row) => (
                    <li key={row.id}>
                      <Card>
                        <p className="text-sm font-semibold">{row.deviceLabel}</p>
                        <p className="mt-1 text-xs text-muted">
                          Allocated {new Date(row.allocatedAt).toLocaleDateString()} · Resale restricted until{" "}
                          {new Date(row.expiresAt).toLocaleDateString()}
                        </p>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
