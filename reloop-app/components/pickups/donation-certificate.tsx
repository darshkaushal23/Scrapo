"use client";

import { Logo } from "@/components/brand/logo";

export function DonationCertificate({
  donor,
  device,
  city,
  date,
  certificateId,
}: {
  donor: string;
  device: string;
  city: string;
  date: string;
  certificateId: string;
}) {
  return (
    <section className="certificate rounded-[20px] border border-lime bg-card px-6 py-8 sm:px-10">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .certificate, .certificate * { visibility: visible; }
          .certificate {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none;
            background: white;
            color: black;
          }
        }
      `}</style>
      <div className="flex items-center justify-between gap-4">
        <Logo />
        <p className="text-xs font-semibold tracking-wide text-muted">Certificate {certificateId.slice(0, 8)}</p>
      </div>
      <p className="mt-8 text-sm font-semibold text-lime">Donation complete</p>
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Certificate of Donation</h2>
      <p className="mt-6 text-sm text-muted">This confirms that</p>
      <p className="mt-1 text-2xl font-bold text-ink">{donor || "Donor"}</p>
      <p className="mt-4 text-sm text-muted">gave</p>
      <p className="mt-1 text-xl font-semibold text-ink">{device}</p>
      <p className="mt-6 text-sm text-muted">
        {city ? `${city} · ` : ""}
        {date}
      </p>
      <p className="mt-6 max-w-xl text-sm leading-6 text-muted">
        The device was recorded as donated through Scrapo and kept in use instead of being discarded.
      </p>
      <button
        type="button"
        className="mt-8 inline-flex h-11 items-center rounded-full bg-lime px-5 text-sm font-semibold text-on-accent print:hidden"
        onClick={() => window.print()}
      >
        Print certificate
      </button>
    </section>
  );
}
