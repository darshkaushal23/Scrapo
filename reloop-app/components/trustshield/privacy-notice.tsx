import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/feedback";

export function PrivacyNotice({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="rounded-2xl border border-line bg-paper/60 p-4 text-xs leading-5 text-muted">
        <div className="flex items-center gap-2 font-semibold text-ink">
          <svg className="h-4 w-4 text-olive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>Scrapo TrustShield Privacy Guarantee</span>
        </div>
        <p className="mt-1">
          We only collect device condition and pickup area to arrange transport. We <strong className="text-ink">never</strong> request device passwords, PINs, OTPs, or financial details. Personal contact and address data are restricted strictly to authorized collection partners.
        </p>
      </div>
    );
  }

  return (
    <Card className="border-olive/30 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-olive/10 text-olive">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </span>
          <div>
            <h3 className="text-base font-semibold text-ink">Scrapo TrustShield Privacy Transparency</h3>
            <p className="text-xs text-muted">Transparent data protection for donated and recycled electronics</p>
          </div>
        </div>
        <Pill tone="paper">TrustShield Protocol</Pill>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs leading-5">
        <div className="rounded-xl border border-line bg-paper/40 p-3">
          <p className="font-semibold text-ink">1. What We Collect</p>
          <p className="mt-1 text-muted">
            Only necessary hardware details (category, model, condition, age) and pickup coordinates required to organize collection and student matching.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-paper/40 p-3">
          <p className="font-semibold text-ink">2. What We Never Ask For</p>
          <p className="mt-1 text-muted">
            Scrapo <strong className="text-ink">never</strong> asks for device screen-lock PINs, passwords, cloud credentials, OTPs, or bank account access.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-paper/40 p-3">
          <p className="font-semibold text-ink">3. Restricted Access</p>
          <p className="mt-1 text-muted">
            Personal contact numbers and street addresses are masked and accessible only by the verified partner handling your physical collection.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-line bg-paper/20 p-3 text-xs text-muted">
        <strong className="text-ink">Donor Best Practice:</strong> Before collection, please sign out of personal Apple/Google accounts and factory reset your device if it powers on. Our verified recyclers perform a verified NIST 800-88 sanitisation pass upon lab intake.
      </div>
    </Card>
  );
}

