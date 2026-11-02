import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

function Shell({
  className,
  children,
  label,
}: {
  className?: string;
  children: ReactNode;
  label: string;
}) {
  return (
    <svg viewBox="0 0 180 150" className={cx("drop-shadow-[0_18px_24px_rgba(0,0,0,0.45)]", className)} role="img" aria-label={label}>
      {children}
    </svg>
  );
}

export function DeviceRadio({ className }: { className?: string }) {
  return (
    <Shell className={className} label="Illustrated radio">
      <rect x="16" y="28" width="148" height="104" rx="28" fill="#1D201C" />
      <rect x="28" y="40" width="124" height="80" rx="22" fill="#2FCF54" />
      <circle cx="68" cy="80" r="26" fill="#39E75F" />
      <circle cx="68" cy="80" r="10" fill="#080908" />
      <rect x="108" y="58" width="30" height="7" rx="3.5" fill="#080908" opacity="0.35" />
      <rect x="108" y="74" width="22" height="7" rx="3.5" fill="#080908" opacity="0.25" />
      <circle cx="116" cy="100" r="5" fill="#080908" />
      <circle cx="132" cy="100" r="5" fill="#171917" />
    </Shell>
  );
}

export function DeviceLaptop({ className }: { className?: string }) {
  return (
    <Shell className={className} label="Illustrated laptop">
      <rect x="28" y="22" width="124" height="84" rx="14" fill="#171917" />
      <rect x="38" y="32" width="104" height="64" rx="8" fill="#39E75F" />
      <path d="M18 112h144c6 0 10 6 8 12H10c-2-6 2-12 8-12z" fill="#292C27" />
    </Shell>
  );
}

export function DeviceCamera({ className }: { className?: string }) {
  return (
    <Shell className={className} label="Illustrated camera">
      <rect x="22" y="48" width="136" height="80" rx="26" fill="#292C27" />
      <rect x="58" y="32" width="46" height="22" rx="8" fill="#171917" />
      <circle cx="92" cy="90" r="28" fill="#39E75F" />
      <circle cx="92" cy="90" r="14" fill="#080908" />
      <circle cx="140" cy="70" r="6" fill="#171917" />
    </Shell>
  );
}

export function DevicePhone({ className }: { className?: string }) {
  return (
    <Shell className={className} label="Illustrated phone">
      <rect x="58" y="16" width="64" height="118" rx="16" fill="#171917" />
      <rect x="66" y="28" width="48" height="86" rx="8" fill="#39E75F" />
      <circle cx="90" cy="122" r="4" fill="#171917" />
    </Shell>
  );
}

export function DeviceCollage({ className }: { className?: string }) {
  return (
    <div className={cx("relative mx-auto h-[420px] w-full max-w-xl", className)} aria-hidden>
      <div className="absolute top-6 left-0 w-40 -rotate-6 sm:w-48">
        <div className="float-slow">
          <DeviceRadio className="w-full" />
        </div>
      </div>
      <div className="absolute top-0 right-0 w-44 rotate-3 sm:w-56">
        <div className="float-delayed">
          <DeviceLaptop className="w-full" />
        </div>
      </div>
      <div className="absolute bottom-2 left-6 w-36 rotate-2 sm:w-44">
        <DeviceCamera className="w-full" />
      </div>
      <div className="absolute right-6 bottom-0 w-28 sm:w-32">
        <div className="float-slow">
          <DevicePhone className="w-full" />
        </div>
      </div>
    </div>
  );
}

export function GlobeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 160" className={className} aria-hidden>
      <circle cx="80" cy="80" r="62" fill="#292C27" />
      <ellipse cx="80" cy="80" rx="28" ry="62" fill="none" stroke="#39E75F" strokeWidth="6" />
      <path d="M22 80h116M34 50h92M34 110h92" fill="none" stroke="#39E75F" strokeWidth="6" strokeLinecap="round" />
      <circle cx="112" cy="46" r="10" fill="#39E75F" opacity="0.85" />
    </svg>
  );
}
