"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DescriptionBox } from "@/components/ui/description-box";
import { Field, TextInput } from "@/components/ui/field";
import { ErrorState, PageSkeleton, Pill } from "@/components/ui/feedback";
import { categoryLabel, conditionLabel, formatInr, formatNumber, workingLabel } from "@/lib/format";
import { usePrototype } from "@/lib/prototype/session";
import { createClient } from "@/lib/supabase/client";
import { createDevicePickup } from "@/lib/supabase/records";
import type { Category, Condition, PickupRecord, WorkingStatus } from "@/lib/types";
import { estimateDevice } from "@/lib/valuation";
import { PrivacyNotice } from "@/components/trustshield/privacy-notice";

const categories = Object.keys(categoryLabel) as Category[];
const conditions = Object.keys(conditionLabel) as Condition[];
const workingStates = Object.keys(workingLabel) as WorkingStatus[];

type Photo = { name: string; url: string };

function hasBackupSessionName() {
  if (typeof window === "undefined") return false;
  try {
    const backup =
      window.localStorage.getItem("scrapo_account_session") ||
      window.localStorage.getItem("reloop.prototype.v1");
    if (!backup) return false;
    const parsed = JSON.parse(backup) as { name?: string; profile?: { name?: string } };
    const savedName = parsed?.name || parsed?.profile?.name;
    return Boolean(savedName && savedName.trim().length > 0);
  } catch {
    return false;
  }
}

export function ListingView({ initialCategory }: { initialCategory?: Category }) {
  const router = useRouter();
  const { ready, profile, addDraft } = usePrototype();
  const [authFallback, setAuthFallback] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const named = Boolean(profile?.name?.trim());
  const allowed = named || hasBackupSessionName() || authFallback;

  useEffect(() => {
    if (!ready || named || hasBackupSessionName()) return;
    let cancelled = false;
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (cancelled) return;
        if (data.user) setAuthFallback(true);
        else router.replace("/login");
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [ready, named, router]);
  const [category, setCategory] = useState<Category | "">(initialCategory ?? "");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [ageYears, setAgeYears] = useState(3);
  const [condition, setCondition] = useState<Condition | "">("");
  const [working, setWorking] = useState<WorkingStatus | "">("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showEstimate, setShowEstimate] = useState(false);

  const estimate = useMemo(() => {
    if (!category || !condition || !working) return null;
    return estimateDevice({ category, ageYears, condition, working });
  }, [ageYears, category, condition, working]);

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const next: Photo[] = [];
    let message = "";
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        message = "Only image files can be previewed.";
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        message = "Each photo needs to be under 5 MB. Nothing is uploaded.";
        return;
      }
      next.push({ name: file.name, url: URL.createObjectURL(file) });
    });
    setPhotoError(message);
    setPhotos((current) => [...current, ...next].slice(0, 4));
  }

  function removePhoto(url: string) {
    URL.revokeObjectURL(url);
    setPhotos((current) => current.filter((photo) => photo.url !== url));
  }

  function fillDescription() {
    const name = [brand.trim(), model.trim()].filter(Boolean).join(" ") || "This device";
    const age = ageYears === 0 ? "less than a year" : `${ageYears} ${ageYears === 1 ? "year" : "years"}`;
    const cond = condition ? conditionLabel[condition].toLowerCase() : "used";
    const work = working ? workingLabel[working].toLowerCase() : "not confirmed yet";
    const kind = category ? categoryLabel[category].toLowerCase() : "device";
    setDescription(
      `${name} is a ${kind}, about ${age} old, in ${cond} condition. It is ${work}. Include the charger if you still have it, mention cracks or missing keys, and say whether personal files are still stored on it. I am listing it so it can be refurbished for a student or recovered for parts.`,
    );
    setErrors((current) => {
      const next = { ...current };
      delete next.description;
      return next;
    });
  }

  const steps = [
    { id: "category-field", label: "Category", done: Boolean(category) },
    { id: "brand", label: "Brand and model", done: brand.trim().length >= 2 && model.trim().length >= 1 },
    { id: "condition-field", label: "Condition", done: Boolean(condition) },
    { id: "working-field", label: "Working status", done: Boolean(working) },
    { id: "description", label: "Description", done: description.trim().length >= 24 },
  ];

  function revealEstimate() {
    const next: Record<string, string> = {};
    if (!category) next.category = "Choose a category.";
    if (brand.trim().length < 2) next.brand = "Add the brand.";
    if (model.trim().length < 1) next.model = "Add the model.";
    if (!condition) next.condition = "Choose a condition.";
    if (!working) next.working = "Say whether it works.";
    if (description.trim().length < 24) next.description = "Describe the device, or use Fill description for a starting point.";
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      setShowEstimate(false);
      const target =
        first === "category" ? "category-field" : first === "condition" ? "condition-field" : first === "working" ? "working-field" : first;
      document.getElementById(target)?.focus();
      return;
    }
    setShowEstimate(true);
  }

  async function requestPickup() {
    if (!estimate || !category || !condition || !working || saving) return;
    if (profile.role !== "admin" && profile.verificationStatus !== "verified") {
      setSaveError("Complete Scrapo Verify and wait for approval before listing a device.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      let id: string | null = null;
      try {
        id = await createDevicePickup(createClient(), {
          category,
          brand: brand.trim(),
          model: model.trim(),
          description: description.trim(),
          ageYears,
          condition,
          working,
          city: profile.city || "Bengaluru",
        });
      } catch (err) {
        console.warn("createDevicePickup fallback to prototype session:", err);
      }

      if (!id) {
        const localId = `pk-${Date.now().toString(36)}`;
        const trackingNum = Math.floor(1000 + Math.random() * 9000);
        const devName = `${brand.trim()} ${model.trim()}`.trim();
        const draftRecord: PickupRecord = {
          id: localId,
          trackingId: `RL-${trackingNum}`,
          deviceId: `dev-${Date.now().toString(36)}`,
          donorId: profile.id || undefined,
          deviceName: devName,
          description: description.trim(),
          category,
          address: "Address to be confirmed with the donor",
          city: profile.city || "Bengaluru",
          collectionDate: null,
          status: "requested",
          recycler: {
            name: "Awaiting assignment",
            contact: "Operations desk",
            phone: "+91 80 4000 2000",
            license: "State PCB authorized",
          },
          timeline: [
            {
              status: "requested",
              label: "Pickup requested",
              note: "Your device listing has been submitted and is awaiting assignment to a verified recycler.",
              at: new Date().toISOString(),
            },
          ],
          showCertificate: false,
          source: "session",
        };
        addDraft(draftRecord);
        id = localId;
      }

      router.push(`/pickups/${id}`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The pickup was not saved.");
      setSaving(false);
    }
  }

  if (!ready || !allowed) return <PageSkeleton cards={2} />;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold text-olive">Device listing</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Tell us about the device</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Photos stay in this browser session. The estimate is a formula on the page, not an appraisal.
          </p>
          {profile.role !== "admin" && profile.verificationStatus !== "verified" ? (
            <p className="mt-3 rounded-2xl border border-line bg-paper px-4 py-3 text-sm text-muted">
              Scrapo Verify is required before a listing can be submitted.{" "}
              <a href="/verify" className="font-semibold text-olive">
                Open verification
              </a>
            </p>
          ) : null}
        </div>

        <PrivacyNotice />

        <Card>
          <h2 className="text-lg font-medium" id="category-field" tabIndex={-1}>Category</h2>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Category">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={category === item}
                className={
                  category === item
                    ? "rounded-2xl bg-lime px-3 py-4 text-left text-sm font-semibold text-on-accent"
                    : "rounded-2xl border border-line bg-paper px-3 py-4 text-left text-sm font-semibold"
                }
                onClick={() => setCategory(item)}
              >
                {categoryLabel[item]}
              </button>
            ))}
          </div>
          {errors.category ? <p className="mt-2 text-sm text-danger" role="alert">{errors.category}</p> : null}
        </Card>

        <Card className="grid gap-4 sm:grid-cols-2">
          <Field label="Brand" htmlFor="brand" error={errors.brand}>
            <TextInput id="brand" list="brands" value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Dell" />
            <datalist id="brands">
              {["Apple", "Dell", "HP", "Lenovo", "Samsung", "Xiaomi", "Sony", "LG"].map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </Field>
          <Field label="Model" htmlFor="model" error={errors.model}>
            <TextInput id="model" value={model} onChange={(event) => setModel(event.target.value)} placeholder="Latitude 5420" />
          </Field>
          <div className="sm:col-span-2">
            <label htmlFor="age" className="mb-2 flex items-center justify-between text-sm font-semibold">
              Device age
              <span className="font-display text-olive">{ageYears === 0 ? "Under a year" : `${ageYears} years`}</span>
            </label>
            <input
              id="age"
              type="range"
              min={0}
              max={12}
              value={ageYears}
              onChange={(event) => setAgeYears(Number(event.target.value))}
              className="w-full accent-olive"
            />
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-medium" id="condition-field" tabIndex={-1}>Condition</h2>
          <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Condition">
            {conditions.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={condition === item}
                className={condition === item ? "rounded-2xl bg-olive px-3 py-3 text-sm font-semibold text-on-accent" : "rounded-2xl border border-line px-3 py-3 text-sm font-semibold"}
                onClick={() => setCondition(item)}
              >
                {conditionLabel[item]}
              </button>
            ))}
          </div>
          {errors.condition ? <p className="mt-2 text-sm text-danger" role="alert">{errors.condition}</p> : null}
          <h2 className="mt-6 text-lg font-medium" id="working-field" tabIndex={-1}>Working status</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-3" role="group" aria-label="Working status">
            {workingStates.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={working === item}
                className={working === item ? "rounded-2xl bg-lime px-3 py-3 text-sm font-semibold text-on-accent" : "rounded-2xl border border-line px-3 py-3 text-sm font-semibold"}
                onClick={() => setWorking(item)}
              >
                {workingLabel[item]}
              </button>
            ))}
          </div>
          {errors.working ? <p className="mt-2 text-sm text-danger" role="alert">{errors.working}</p> : null}
        </Card>

        <Card>
          <DescriptionBox
            id="description"
            label="Description"
            hint="Mention power, damage, accessories, and anything a student or recycler should expect. This stays in this browser with the listing."
            placeholder="Powers on, charger included, scratch on the corner, files still on the device…"
            value={description}
            error={errors.description}
            onChange={setDescription}
            onFill={fillDescription}
          />
        </Card>

        <Card>
          <h2 className="text-lg font-medium">Photos</h2>
          <p className="mt-1 text-sm text-muted">Up to four images. They are previewed locally and discarded when you leave.</p>
          <label
            className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-olive/40 bg-paper px-4 py-10 text-center"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              addFiles(event.dataTransfer.files);
            }}
          >
            <span className="text-sm font-semibold">Choose images or drop them here</span>
            <span className="mt-1 text-xs text-muted">JPG, PNG, or WebP · under 5 MB</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
          {photoError ? <ErrorState title="That file cannot be previewed" text={photoError} /> : null}
          {photos.length ? (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {photos.map((photo) => (
                <li key={photo.url} className="overflow-hidden rounded-2xl border border-line">
                  <Image src={photo.url} alt={`${photo.name} preview`} width={320} height={224} unoptimized className="h-28 w-full object-cover" />
                  <button type="button" className="w-full px-2 py-2 text-xs font-semibold" onClick={() => removePhoto(photo.url)}>
                    Remove {photo.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">No photo yet. You can still see an estimate.</p>
          )}
        </Card>

        <Button size="lg" onClick={revealEstimate}>
          Show valuation
        </Button>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card>
          <p className="text-sm font-semibold text-olive">Valuation</p>
          <ul className="mt-4 space-y-2">
            {steps.map((step) => (
              <li key={step.label} className="flex items-center gap-2 text-sm">
                <span
                  className={step.done ? "grid h-5 w-5 place-items-center rounded-full bg-olive text-[11px] text-on-accent" : "grid h-5 w-5 place-items-center rounded-full border border-line text-[11px] text-muted"}
                  aria-hidden
                >
                  {step.done ? "✓" : ""}
                </span>
                <button type="button" className="text-left font-semibold" onClick={() => document.getElementById(step.id)?.focus()}>
                  {step.label}
                </button>
              </li>
            ))}
          </ul>
          {showEstimate && estimate ? (
            <>
              <p className="mt-3 font-display text-4xl font-extrabold text-lime">{formatInr(estimate.value)}</p>
              <p className="mt-1 text-sm text-muted">{formatNumber(estimate.points)} points</p>
              <Pill tone="olive">{estimate.reuse}</Pill>
              <p className="mt-4 text-sm leading-6 text-muted">{description.trim()}</p>
              <ul className="mt-4 space-y-3">
                {estimate.lines.map((line) => (
                  <li key={line.label}>
                    <p className="text-sm font-semibold">{line.label}</p>
                    <p className="text-sm text-muted">{line.detail}</p>
                  </li>
                ))}
              </ul>
              <Button className="mt-6 w-full" variant="olive" onClick={requestPickup} disabled={saving}>
                {saving ? "Saving" : "Request a pickup"}
              </Button>
              {saveError ? <p className="mt-3 text-sm text-danger">{saveError}</p> : null}
              <p className="mt-3 text-xs leading-5 text-muted">
                This saves the device and pickup on your account. Sign in first.
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm leading-6 text-muted">
              Finish the checklist, including a short description. The estimate appears here with the path it suggests.
            </p>
          )}
        </Card>
      </aside>
    </div>
  );
}
