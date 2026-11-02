import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <Logo />
      <h1 className="mt-8 text-4xl font-extrabold tracking-tight">That page is not on the loop</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        The address does not match a Scrapo screen. Head home, or open the dashboard.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button href="/">Back home</Button>
        <Button href="/dashboard" variant="ghost">
          Donor dashboard
        </Button>
      </div>
      <Link href="/pickups" className="mt-6 text-sm font-semibold text-olive">
        Or check pickup tracking
      </Link>
    </main>
  );
}
