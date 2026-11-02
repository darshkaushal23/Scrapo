import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/ui/card";

const explore = [
  { href: "/dashboard", label: "Donor dashboard" },
  { href: "/devices/new", label: "List a device" },
  { href: "/pickups", label: "Pickup tracking" },
  { href: "/marketplace", label: "Student marketplace" },
  { href: "/rewards", label: "Rewards" },
  { href: "/recycler", label: "Recycler desk" },
  { href: "/admin", label: "Admin desk" },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-sidebar text-ink">
      <Container className="grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo tone="lime" />
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
            Give electronics a second life. Scrapo collects devices, matches students, and records verified rewards.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-lime">On this page</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/#how" className="hover:text-lime">How it works</Link></li>
            <li><Link href="/#impact" className="hover:text-lime">Why it matters</Link></li>
            <li><Link href="/#donate" className="hover:text-lime">Device donation</Link></li>
            <li><Link href="/#students" className="hover:text-lime">Students</Link></li>
            <li><Link href="/#rewards" className="hover:text-lime">Rewards</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-lime">Workspace</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {explore.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-lime">{item.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
      <div className="border-t border-line">
        <Container className="py-5 text-xs text-muted">
          Listed devices, rankings, and points on this site come from Supabase.
        </Container>
      </div>
    </footer>
  );
}
