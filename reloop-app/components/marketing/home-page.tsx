import Link from "next/link";
import { DeviceCollage, GlobeMark } from "@/components/brand/illustrations";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card, Container, SectionHeading } from "@/components/ui/card";
import { Pill } from "@/components/ui/feedback";
import { categoryLabel, formatInr, formatNumber } from "@/lib/format";
import type { LeaderboardEntry, ListingRecord } from "@/lib/types";

const steps = [
  {
    n: "01",
    title: "List the device",
    text: "Choose a category, add the brand and condition, and attach a photo that stays in your browser.",
  },
  {
    n: "02",
    title: "See an estimate",
    text: "The estimate shows a value and the points a verified donation can earn.",
  },
  {
    n: "03",
    title: "Book a pickup",
    text: "A verified recycler gets the request, with a collection date and a status you can follow.",
  },
  {
    n: "04",
    title: "Refurbish",
    text: "Working devices are wiped and prepared. The rest goes to parts recovery, not a drawer.",
  },
  {
    n: "05",
    title: "Donate and earn",
    text: "Students request what they need. You collect points and climb the monthly board.",
  },
];

const categories = [
  ["phone", "The one in the drawer"],
  ["laptop", "Still fine for coursework"],
  ["tablet", "Notes, reading, classes"],
  ["monitor", "A second screen for someone"],
  ["appliance", "Small kit, not landfill"],
  ["accessory", "Cables, audio, chargers"],
] as const;

export function HomePage({ listings, board }: { listings: ListingRecord[]; board: LeaderboardEntry[] }) {
  const podium = board.slice(0, 3);

  return (
    <>
      <SiteHeader />
      <main>
        <Container className="grid items-center gap-10 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div>
            <p className="text-sm font-semibold tracking-wide text-olive">Collect . Refurbish . Donate .</p>
            <h1 className="mt-4 max-w-xl text-5xl leading-[1.02] font-extrabold tracking-tight text-ink sm:text-6xl lg:text-7xl">
              Give electronics <span className="text-lime">a second life.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
              Scrapo collects devices you have stopped using, gets the useful ones refurbished, and routes them to students. You earn points for keeping them out of a landfill.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href="/devices/new" size="lg">
                List a device
              </Button>
              <Button href="/#how" variant="ghost" size="lg">
                See how it works
              </Button>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-3">
              {[
                [formatNumber(listings.length), "Devices listed"],
                [formatNumber(listings.filter((item) => item.donation === "donated").length), "Donated"],
                [formatNumber(board[0]?.points ?? 0), "Top monthly points"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-3xl border border-line bg-card px-3 py-4">
                  <dt className="font-display text-xl font-medium text-ink sm:text-2xl">{value}</dt>
                  <dd className="mt-1 text-xs leading-5 text-muted">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
          <DeviceCollage />
        </Container>

        <section id="how" className="scroll-mt-20 py-16">
          <Container>
            <SectionHeading
              eyebrow="How Scrapo works"
              title={
                <>
                  Five steps from a drawer <span className="font-bold">to a desk</span>
                </>
              }
              text="The same path a donor, a recycler, and a student share. Pickup tracking and rewards sit on top of it."
            />
            <ol className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {steps.map((step) => (
                <li key={step.n}>
                  <Card className="h-full">
                    <span className="font-display text-sm font-medium text-olive">{step.n}</span>
                    <h3 className="mt-4 text-lg font-medium text-ink">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{step.text}</p>
                  </Card>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        <section id="impact" className="scroll-mt-20 py-16">
          <Container>
            <p className="text-sm font-semibold tracking-wide text-lime">Why it matters</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">
              Most electronics are retired long before they are <span className="font-bold">actually finished</span>
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
              These figures are published context, rounded for this page. They are not Scrapo measurements.
            </p>
            <dl className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["62 Mt", "Global e-waste generated in 2022"],
                ["< 25%", "Documented as formally collected"],
                ["1 laptop", "Can carry a student through a year"],
                ["0 drawers", "Is not a recycling plan"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-[20px] border border-line bg-card p-5">
                  <dt className="font-display text-4xl font-extrabold text-lime">{value}</dt>
                  <dd className="mt-3 text-sm leading-6 text-muted">{label}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-xs leading-5 text-muted">
              Global tonnage and collection share follow the Global E-waste Monitor 2024, which reports 2022 data. The laptop and drawer lines are product statements, not statistics.
            </p>
          </Container>
        </section>

        <section id="donate" className="scroll-mt-20 py-16">
          <Container className="grid items-start gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <SectionHeading
              eyebrow="Device donation"
              title={
                <>
                  Hand it over while it can still <span className="font-bold">be useful</span>
                </>
              }
              text="Phones, laptops, tablets, monitors, small appliances, and accessories. You describe the condition. A recycler confirms it at pickup."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {categories.map(([key, line]) => (
                <Link
                  key={key}
                  href={`/devices/new?category=${key}`}
                  className="rounded-3xl border border-line bg-card p-5 transition hover:-translate-y-0.5 hover:border-olive"
                >
                  <p className="font-display text-lg font-medium text-ink">{categoryLabel[key]}</p>
                  <p className="mt-1 text-sm text-muted">{line}</p>
                </Link>
              ))}
            </div>
          </Container>
        </section>

        <section id="students" className="scroll-mt-20 py-4 pb-16">
          <Container>
            <SectionHeading
              eyebrow="Student donation"
              title={
                <>
                  Refurbished devices, <span className="font-bold">requested by name</span>
                </>
              }
              text="Students ask for what they actually need. A listing can be a gift, a low student price, or already handed over."
            />
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {listings.length === 0 ? <p className="text-sm text-muted">No refurbished devices are listed yet.</p> : null}
              {listings.slice(0, 3).map((item) => (
                <Card key={item.id}>
                  <div className="flex items-center justify-between gap-3">
                    <Pill tone={item.donation === "available" ? "lime" : "paper"}>{item.donation}</Pill>
                    <span className="text-xs font-semibold text-muted">{categoryLabel[item.category]}</span>
                  </div>
                  <h3 className="mt-4 text-xl font-medium text-ink">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{item.note}</p>
                  <p className="mt-4 font-display text-lg text-olive">
                    {item.studentPrice === null ? "Donation" : formatInr(item.studentPrice)}
                  </p>
                  <p className="mt-1 text-xs text-muted">{item.campus}</p>
                </Card>
              ))}
            </div>
            <div className="mt-6">
              <Button href="/marketplace" variant="olive">
                Open the student marketplace
              </Button>
            </div>
          </Container>
        </section>

        <section id="rewards" className="scroll-mt-20 py-16">
          <Container>
            <SectionHeading
              eyebrow="Scrapo Rewards"
              title={
                <>
                  A monthly board for people who <span className="font-bold">keep going</span>
                </>
              }
              text="Points come from listings, completed pickups, and donations. Eco levels mark lifetime progress."
            />
            <div className="mt-10 grid items-end gap-4 md:grid-cols-3">
              {podium.length === 0 ? <p className="text-sm text-muted">No points on the board yet.</p> : null}
              {podium.map((entry) => (
                <Card
                  key={entry.rank}
                  className={entry.rank === 1 ? "border-lime md:-translate-y-4" : ""}
                >
                  <p className="text-sm font-semibold text-olive">#{entry.rank}</p>
                  <h3 className="mt-3 text-2xl font-medium text-ink">{entry.name}</h3>
                  <p className="mt-1 text-sm text-muted">{entry.city}</p>
                  <p className="mt-4 font-display text-3xl font-medium text-ink">
                    {formatNumber(entry.points)}
                    <span className="ml-2 text-sm font-sans font-semibold text-muted">pts</span>
                  </p>
                </Card>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Seed", "Sprout", "Canopy", "Grove", "Old Growth"].map((level) => (
                <Pill key={level} tone={level === "Grove" ? "olive" : "paper"}>
                  {level}
                </Pill>
              ))}
            </div>
            <Button href="/rewards" className="mt-6" variant="ghost">
              See the full board
            </Button>
          </Container>
        </section>

        <section className="pb-8">
          <Container>
            <div className="grid items-center gap-8 overflow-hidden rounded-[20px] bg-lime px-6 py-10 text-on-accent sm:px-10 lg:grid-cols-[1fr_auto]">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-on-accent sm:text-5xl">
                  Ready to make an <span className="font-extrabold">impact?</span>
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-on-accent/80">
                  List one device. The estimate, the pickup, and the student match are saved to your Scrapo account.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Button href="/signup" variant="olive" size="lg">
                    Create an account
                  </Button>
                  <Button href="/dashboard" variant="soft" size="lg">
                    Open the dashboard
                  </Button>
                </div>
              </div>
              <GlobeMark className="mx-auto h-40 w-40" />
            </div>
          </Container>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
